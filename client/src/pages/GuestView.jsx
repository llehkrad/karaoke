import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { socket, emitAsync } from "../socket.js";
import SearchPanel from "../components/SearchPanel.jsx";
import TopBar from "../components/TopBar.jsx";

const API = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

function getStoredGuestName() {
  try {
    return localStorage.getItem("karaoke_guest_name");
  } catch {
    return null;
  }
}

export default function GuestView() {
  const { roomId } = useParams();
  const [state, setState] = useState(null);
  const [tab, setTab] = useState("search");
  const [pendingVideo, setPendingVideo] = useState(null);
  const [pitch, setPitch] = useState(0);
  const [connError, setConnError] = useState("");
  const [guestName, setGuestName] = useState(() => getStoredGuestName() || "Guest");
  const [editingPitchItemId, setEditingPitchItemId] = useState(null);
  const [editingPitch, setEditingPitch] = useState(0);

  useEffect(() => {
    if (getStoredGuestName()) return;
    let name = "Guest";
    try {
      name = window.prompt("What's your name? (shown next to your song picks)") || "Guest";
    } catch {
      // ignored
    }
    try {
      localStorage.setItem("karaoke_guest_name", name);
    } catch {
      // ignored
    }
    setGuestName(name);
  }, []);

  useEffect(() => {
    document.title = "Select Song - Sing!";
  }, []);

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

  function getGuestSongs() {
    return state?.queue?.filter((item) => item.added_by === guestName) || [];
  }

  function handleUpdatePitch(itemId, newPitch) {
    socket.emit("set_item_pitch", { roomId, itemId, semitones: newPitch });
    setEditingPitchItemId(null);
  }

  function handleDeleteSong(itemId) {
    socket.emit("remove_from_queue", { roomId, itemId });
  }

  function handleCutSong(itemId) {
    socket.emit("cut_song", { roomId, itemId });
  }

  // Guests can only rearrange the slots their own songs already occupy in
  // the full queue (e.g. songs at #1 and #5 can only trade places with
  // each other) -- this swaps an own song directly with the guest's next
  // own song up/down, leaving every other song's position untouched.
  function handleSwapOwnSong(itemId, direction) {
    const guestSongs = getGuestSongs();
    const guestIdx = guestSongs.findIndex((s) => s.id === itemId);
    const targetGuestIdx = direction === "up" ? guestIdx - 1 : guestIdx + 1;
    if (guestIdx === -1 || targetGuestIdx < 0 || targetGuestIdx >= guestSongs.length) return;

    const allQueue = state.queue;
    const fromIdx = allQueue.findIndex((q) => q.id === itemId);
    const toIdx = allQueue.findIndex((q) => q.id === guestSongs[targetGuestIdx].id);
    if (fromIdx === -1 || toIdx === -1) return;

    const newQueue = [...allQueue];
    [newQueue[fromIdx], newQueue[toIdx]] = [newQueue[toIdx], newQueue[fromIdx]];
    socket.emit("reorder_queue", { roomId, queue: newQueue.map((q) => q.id) });
  }

  if (connError) {
    return (
      <>
        <TopBar />
        <div className="guest-page">
          <h1 className="display" style={{ color: "var(--danger)" }}>
            {connError}
          </h1>
        </div>
      </>
    );
  }

  if (!state) {
    return (
      <>
        <TopBar />
        <div className="guest-page">
          <p className="text-dim">Connecting…</p>
        </div>
      </>
    );
  }

  if (state.room.status === "paused") {
    return (
      <>
        <TopBar />
        <div className="guest-page">
          <h1 className="display" style={{ color: "var(--accent)" }}>
            Room is paused
          </h1>
          <p className="text-dim">Ask the host to resume the room to keep queueing songs.</p>
        </div>
      </>
    );
  }

  const guestSongs = getGuestSongs();

  return (
    <>
      <TopBar />
      <div className="guest-page">
        <h1 className="display" style={{ fontSize: "1.8rem", color: "var(--accent)", marginBottom: 8 }}>
          {guestName}, pick a song
        </h1>

        <div className="tab-bar">
          <button className={`tab-btn ${tab === "search" ? "active" : ""}`} onClick={() => setTab("search")}>
            Search
          </button>
          <button className={`tab-btn ${tab === "queue" ? "active" : ""}`} onClick={() => setTab("queue")}>
            Queue ({state.queue.length})
          </button>
        </div>

        <p className="text-dim" style={{ marginBottom: 24 }}>
          {guestSongs.length} song{guestSongs.length !== 1 ? "s" : ""} queued
        </p>

        {tab === "search" ? (
          <SearchPanel onPick={handlePickResult} />
        ) : (
          <div className="guest-queue-container">
            {state.nowPlaying && (
              <div className="stack" style={{ marginBottom: 16 }}>
                <p className="text-dim" style={{ marginBottom: -4 }}>
                  Now playing
                </p>
                <div
                  className={`queue-item now-playing ${state.nowPlaying.added_by === guestName ? "guest-song" : ""}`}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, marginBottom: 2 }}>{state.nowPlaying.title}</div>
                    <div className="text-dim" style={{ fontSize: "0.85rem" }}>
                      {state.nowPlaying.added_by} · Pitch {state.nowPlaying.pitch_semitones > 0 ? "+" : ""}
                      {state.nowPlaying.pitch_semitones}
                    </div>
                  </div>
                  {state.nowPlaying.added_by === guestName && (
                    <button
                      className="btn btn-danger"
                      onClick={() => handleCutSong(state.nowPlaying.id)}
                      title="Cut this song"
                      style={{ padding: "6px 10px", fontSize: "0.85rem" }}
                    >
                      ✕ Cut
                    </button>
                  )}
                </div>
              </div>
            )}

            {state.queue.length === 0 ? (
              <div className="card" style={{ textAlign: "center" }}>
                <p className="text-dim">Queue is empty. Search for songs to get started!</p>
              </div>
            ) : (
              <div className="queue-list-items">
                {state.queue.map((item, idx) => {
                  const isGuestSong = item.added_by === guestName;
                  const guestIdx = isGuestSong ? guestSongs.findIndex((s) => s.id === item.id) : -1;

                  return (
                    <div
                      key={item.id}
                      className={`queue-item ${isGuestSong ? "guest-song" : ""}`}
                      style={{
                        border: isGuestSong ? "2px solid var(--accent)" : "1px solid var(--hairline)",
                        ...(isGuestSong && { background: "rgba(107, 102, 222, 0.05)" }),
                      }}
                    >
                      <div className="queue-position">{idx + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, marginBottom: 2 }}>{item.title}</div>
                        <div className="text-dim" style={{ fontSize: "0.85rem" }}>
                          {item.added_by} · Pitch {item.pitch_semitones > 0 ? "+" : ""}
                          {item.pitch_semitones}
                        </div>
                      </div>

                      {isGuestSong && (
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {guestSongs.length > 1 && (
                            <>
                              <button
                                className="btn btn-secondary"
                                onClick={() => handleSwapOwnSong(item.id, "up")}
                                disabled={guestIdx <= 0}
                                title="Swap with your previous song"
                                style={{ padding: "6px 10px", fontSize: "0.85rem" }}
                              >
                                ↑
                              </button>
                              <button
                                className="btn btn-secondary"
                                onClick={() => handleSwapOwnSong(item.id, "down")}
                                disabled={guestIdx === -1 || guestIdx >= guestSongs.length - 1}
                                title="Swap with your next song"
                                style={{ padding: "6px 10px", fontSize: "0.85rem" }}
                              >
                                ↓
                              </button>
                            </>
                          )}
                          <button
                            className="btn btn-secondary"
                            onClick={() => {
                              setEditingPitchItemId(item.id);
                              setEditingPitch(item.pitch_semitones);
                            }}
                            title="Adjust pitch"
                            style={{ padding: "6px 10px", fontSize: "0.85rem" }}
                          >
                            🎵
                          </button>
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleDeleteSong(item.id)}
                            title="Delete song"
                            style={{ padding: "6px 10px", fontSize: "0.85rem" }}
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {editingPitchItemId && (
              <div className="pitch-sheet" onClick={() => setEditingPitchItemId(null)}>
                <div className="pitch-sheet-inner" onClick={(e) => e.stopPropagation()}>
                  <p style={{ fontWeight: 500, marginBottom: 4 }}>Adjust Pitch</p>
                  <p className="text-dim" style={{ marginTop: 0 }}>Update before your song starts playing</p>

                  <div className="pitch-slider-row">
                    <button
                      className="btn btn-secondary"
                      onClick={() => setEditingPitch((p) => Math.max(-12, p - 1))}
                    >
                      −1
                    </button>
                    <span className="pitch-value">
                      {editingPitch > 0 ? "+" : ""}
                      {editingPitch}
                    </span>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setEditingPitch((p) => Math.min(12, p + 1))}
                    >
                      +1
                    </button>
                  </div>
                  <input
                    type="range"
                    min={-12}
                    max={12}
                    step={1}
                    value={editingPitch}
                    onChange={(e) => setEditingPitch(Number(e.target.value))}
                  />

                  <div className="row" style={{ marginTop: 20 }}>
                    <button
                      className="btn btn-secondary"
                      style={{ flex: 1 }}
                      onClick={() => setEditingPitchItemId(null)}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1 }}
                      onClick={() => handleUpdatePitch(editingPitchItemId, editingPitch)}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {pendingVideo && (
          <div className="pitch-sheet" onClick={() => setPendingVideo(null)}>
            <div className="pitch-sheet-inner" onClick={(e) => e.stopPropagation()}>
              <p style={{ fontWeight: 500, marginBottom: 4 }}>{pendingVideo.title}</p>
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
    </>
  );
}
