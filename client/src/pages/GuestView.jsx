import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { socket, emitAsync } from "../socket.js";
import SearchPanel from "../components/SearchPanel.jsx";
import QueueList from "../components/QueueList.jsx";

const API = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

function getGuestName() {
  let name = localStorage.getItem("karaoke_guest_name");
  if (!name) {
    name = window.prompt("What's your name? (shown next to your song picks)") || "Guest";
    localStorage.setItem("karaoke_guest_name", name);
  }
  return name;
}

export default function GuestView() {
  const { roomId } = useParams();
  const [state, setState] = useState(null);
  const [tab, setTab] = useState("search");
  const [pendingVideo, setPendingVideo] = useState(null);
  const [pitch, setPitch] = useState(0);
  const [connError, setConnError] = useState("");
  const [guestName] = useState(getGuestName);

  useEffect(() => {
    let mounted = true;

    async function join() {
      const ack = await emitAsync("join_room", { roomId });
      if (!mounted) return;
      if (!ack.ok) {
        setConnError(ack.error || "Could not join room.");
        return;
      }
      setState(ack.state);
    }

    if (socket.connected) join();
    socket.on("connect", join);
    socket.on("state_update", (s) => mounted && setState(s));
    socket.on("room_ended", () => mounted && setConnError("This session has ended."));

    return () => {
      mounted = false;
      socket.off("connect", join);
      socket.off("state_update");
      socket.off("room_ended");
    };
  }, [roomId]);

  async function handlePickResult(video) {
    // Pre-fill pitch from this room's history for this song, if any.
    try {
      const res = await fetch(`${API}/api/rooms/${roomId}/history/${video.videoId}`);
      const entry = await res.json();
      setPitch(entry?.last_pitch_semitones ?? 0);
    } catch {
      setPitch(0);
    }
    setPendingVideo(video);
  }

  async function confirmAdd() {
    await emitAsync("add_to_queue", {
      roomId,
      video: pendingVideo,
      pitch,
      addedBy: guestName,
    });
    setPendingVideo(null);
    setTab("queue");
  }

  function handleShuffle() {
    socket.emit("shuffle_queue", { roomId });
  }

  function handleRemove(itemId) {
    socket.emit("remove_from_queue", { roomId, itemId });
  }

  if (connError) {
    return (
      <div className="guest-page">
        <h1 className="display" style={{ color: "var(--danger)" }}>
          {connError}
        </h1>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="guest-page">
        <p className="text-dim">Connecting…</p>
      </div>
    );
  }

  if (state.room.status === "paused") {
    return (
      <div className="guest-page">
        <h1 className="display" style={{ color: "var(--spotlight)" }}>
          Room is paused
        </h1>
        <p className="text-dim">Ask the host to resume the room to keep queueing songs.</p>
      </div>
    );
  }

  return (
    <div className="guest-page">
      <h1 className="display" style={{ fontSize: "1.6rem", color: "var(--spotlight)", marginBottom: 16 }}>
        🎤 {guestName}, pick a song
      </h1>

      {tab === "search" ? (
        <SearchPanel onPick={handlePickResult} />
      ) : (
        <QueueList
          queue={state.queue}
          nowPlaying={state.nowPlaying}
          onShuffle={handleShuffle}
          onRemove={handleRemove}
        />
      )}

      <div className="tab-bar">
        <button className={`tab-btn ${tab === "search" ? "active" : ""}`} onClick={() => setTab("search")}>
          Search
        </button>
        <button className={`tab-btn ${tab === "queue" ? "active" : ""}`} onClick={() => setTab("queue")}>
          Queue ({state.queue.length})
        </button>
      </div>

      {pendingVideo && (
        <div className="pitch-sheet" onClick={() => setPendingVideo(null)}>
          <div className="pitch-sheet-inner" onClick={(e) => e.stopPropagation()}>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>{pendingVideo.title}</p>
            <p className="text-dim" style={{ marginTop: 0 }}>Set the pitch before adding to the queue</p>

            <div className="pitch-slider-row">
              <button className="btn btn-secondary" onClick={() => setPitch((p) => Math.max(-12, p - 1))}>
                −1
              </button>
              <span className="pitch-value">
                {pitch > 0 ? "+" : ""}
                {pitch}
              </span>
              <button className="btn btn-secondary" onClick={() => setPitch((p) => Math.min(12, p + 1))}>
                +1
              </button>
            </div>
            <input
              type="range"
              min={-12}
              max={12}
              step={1}
              value={pitch}
              onChange={(e) => setPitch(Number(e.target.value))}
            />

            <div className="row" style={{ marginTop: 20 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPendingVideo(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={confirmAdd}>
                Add to queue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
