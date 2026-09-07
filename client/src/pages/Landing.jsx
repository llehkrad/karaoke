import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

export default function Landing() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("session"); // 'session' | 'permanent'
  const [slug, setSlug] = useState("");
  const [existingRoomId, setExistingRoomId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function createRoom() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: mode, slug: mode === "permanent" ? slug : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create room.");
      navigate(`/host/${data.roomId}?hostToken=${data.hostToken}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function goToExistingHost() {
    if (!existingRoomId.trim()) return;
    // For a returning permanent-room host without their token saved, we can't
    // authenticate them here — this box is really for jumping back into a
    // room whose host link they still have bookmarked/saved.
    navigate(`/host/${existingRoomId.trim()}`);
  }

  return (
    <div className="page">
      <div className="card stack" style={{ marginTop: 40 }}>
        <h1 className="display" style={{ fontSize: "2rem", color: "var(--spotlight)" }}>
          Start a karaoke room
        </h1>
        <p className="text-dim" style={{ marginTop: -4 }}>
          Put this screen on your TV or laptop. Guests scan a QR code to search
          songs and build the queue from their phones.
        </p>

        <div className="row" style={{ marginTop: 12 }}>
          <button
            className={`btn ${mode === "session" ? "btn-primary" : "btn-secondary"}`}
            style={{ flex: 1 }}
            onClick={() => setMode("session")}
          >
            Session room
          </button>
          <button
            className={`btn ${mode === "permanent" ? "btn-primary" : "btn-secondary"}`}
            style={{ flex: 1 }}
            onClick={() => setMode("permanent")}
          >
            Permanent room
          </button>
        </div>

        {mode === "session" ? (
          <p className="text-dim">
            A one-off room with a random code. Ends for good when you close it.
          </p>
        ) : (
          <>
            <p className="text-dim">
              A room with a link that never changes. Pause it when you're done —
              next time you open the same link, the queue picks up where it can,
              and it remembers pitch settings from songs you've sung before.
            </p>
            <input
              type="text"
              placeholder="Name your room (e.g. Friday Karaoke)"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </>
        )}

        {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

        <button className="btn btn-primary" onClick={createRoom} disabled={loading}>
          {loading ? "Creating…" : "Create room"}
        </button>

        <hr style={{ border: "none", borderTop: "1px solid var(--stage-panel-light)", margin: "8px 0" }} />

        <p className="text-dim" style={{ marginBottom: -4 }}>
          Already have a permanent room? Jump back in with its link, or enter its ID:
        </p>
        <div className="row">
          <input
            type="text"
            placeholder="room-id"
            value={existingRoomId}
            onChange={(e) => setExistingRoomId(e.target.value)}
          />
          <button className="btn btn-secondary" onClick={goToExistingHost}>
            Go
          </button>
        </div>
      </div>
    </div>
  );
}
