import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { socket, emitAsync } from "../socket.js";
import QueueList from "../components/QueueList.jsx";
import QRDisplay from "../components/QRDisplay.jsx";

const ADMIN_TOKEN_KEY = "karaoke_admin_token";

export default function AdminRoomControl() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const adminToken = sessionStorage.getItem(ADMIN_TOKEN_KEY) || "";

  const [state, setState] = useState(null);
  const [connError, setConnError] = useState("");
  const [isPaused, setIsPaused] = useState(false);

  const joinUrl = `${window.location.origin}/join/${roomId}`;

  useEffect(() => {
    if (!adminToken) {
      navigate("/admin");
    }
  }, [adminToken, navigate]);

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
    socket.on("room_ended", () => mounted && setConnError("This room has ended."));

    return () => {
      mounted = false;
      socket.off("connect", join);
      socket.off("state_update");
      socket.off("room_ended");
    };
  }, [roomId]);

  if (!adminToken) return null;

  function nudgePitch(delta) {
    if (!state?.nowPlaying) return;
    const next = Math.max(-12, Math.min(12, state.nowPlaying.pitch_semitones + delta));
    socket.emit("set_pitch", { roomId, hostToken: adminToken, semitones: next });
  }

  function sendPlayback(action) {
    socket.emit("playback_control", { roomId, hostToken: adminToken, action });
    if (action === "pause") setIsPaused(true);
    if (action === "resume" || action === "restart") setIsPaused(false);
  }

  function handleSkip() {
    socket.emit("skip_current", { roomId, hostToken: adminToken });
    setIsPaused(false);
  }

  function handleShuffle() {
    socket.emit("shuffle_queue", { roomId });
  }

  function handleRemove(itemId) {
    socket.emit("remove_from_queue", { roomId, itemId });
  }

  if (connError) {
    return (
      <div className="admin-shell">
        <div className="admin-header">
          <div className="admin-header-inner">
            <span className="admin-brand">Karaoke Admin</span>
          </div>
        </div>
        <div className="page">
          <p style={{ color: "var(--danger)" }}>{connError}</p>
          <Link to="/admin" className="btn btn-secondary">
            Back to rooms
          </Link>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="admin-shell">
        <div className="admin-header">
          <div className="admin-header-inner">
            <span className="admin-brand">Karaoke Admin</span>
          </div>
        </div>
        <div className="page">
          <p className="text-dim">Connecting…</p>
        </div>
      </div>
    );
  }

  const { room, queue, nowPlaying } = state;
  const hostCastUrl = `${window.location.origin}/host/${roomId}?hostToken=${adminToken}`;

  return (
    <div className="admin-shell">
      <div className="admin-header">
        <div className="admin-header-inner">
          <span className="admin-brand">Karaoke Admin</span>
          <Link to="/admin" className="btn btn-secondary">
            All rooms
          </Link>
        </div>
      </div>
      <div className="page">
        <div className="card stack admin-room-control" style={{ marginTop: 0 }}>
          <div>
            <h1 className="display" style={{ fontSize: "1.6rem", color: "var(--accent)", margin: 0 }}>
              {room.id}
            </h1>
            <p className="text-dim" style={{ margin: 0 }}>
              {room.type} · {room.status}
            </p>
          </div>

        <div className="row admin-links">
          <a href={hostCastUrl} target="_blank" rel="noreferrer" className="btn btn-secondary">
            Open Host Display
          </a>
          <a href={joinUrl} target="_blank" rel="noreferrer" className="btn btn-secondary">
            Open guest join page
          </a>
        </div>

        {nowPlaying ? (
          <div className="stack admin-now-playing">
            <p className="text-dim" style={{ marginBottom: -4 }}>
              Now playing
            </p>
            <div style={{ fontWeight: 500, fontSize: "1.1rem" }}>{nowPlaying.title}</div>

            <div className="row" style={{ alignItems: "center" }}>
              <button className="btn btn-secondary" onClick={() => nudgePitch(-1)}>
                −1
              </button>
              <span className="pill pill-energy">
                Pitch {nowPlaying.pitch_semitones > 0 ? "+" : ""}
                {nowPlaying.pitch_semitones}
              </span>
              <button className="btn btn-secondary" onClick={() => nudgePitch(1)}>
                +1
              </button>
            </div>

            <div className="admin-player-transport">
              <button className="btn btn-secondary" onClick={() => sendPlayback("restart")} title="Restart song">
                Restart
              </button>
              {isPaused ? (
                <button
                  className="btn btn-primary"
                  onClick={() => sendPlayback("resume")}
                  title="Resume"
                  aria-label="Resume"
                >
                  ▶
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={() => sendPlayback("pause")}
                  title="Pause"
                  aria-label="Pause"
                >
                  ❚❚
                </button>
              )}
              <button className="btn btn-secondary" onClick={handleSkip} title="Skip song">
                Skip
              </button>
            </div>
          </div>
        ) : (
          <p className="text-dim">No song playing.</p>
        )}

        <QueueList queue={queue} nowPlaying={null} onShuffle={handleShuffle} onRemove={handleRemove} />

        <details>
          <summary className="text-dim" style={{ cursor: "pointer" }}>
            Guest QR code
          </summary>
          <QRDisplay url={joinUrl} size={160} />
        </details>
        </div>
      </div>
    </div>
  );
}
