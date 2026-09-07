import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import TopBar from "../components/TopBar.jsx";

const API = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

export default function Landing() {
  const navigate = useNavigate();
  const { isLoggedIn, username, logout } = useAuth();
  const [roomName, setRoomName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0);

  useEffect(() => {
    document.title = "Lobby - Sing!";
  }, []);

  // Force re-render when auth state changes
  useEffect(() => {
    setForceUpdate(prev => prev + 1);
  }, [isLoggedIn]);

  function handleLoginClick() {
    window.dispatchEvent(new Event("openAdminLogin"));
  }

  async function createSessionRoom() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "session" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create room.");
      navigate(`/sing-host/${data.roomId}?hostToken=${data.hostToken}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function createPermanentRoom() {
    if (!isLoggedIn) {
      handleLoginClick();
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Username": username },
        body: JSON.stringify({ type: "permanent", slug: roomName || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create room.");
      navigate(`/sing-host/${data.roomId}?hostToken=${data.hostToken}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <TopBar isLoggedIn={isLoggedIn} onLoginClick={handleLoginClick} onLogoutClick={logout} />
      <div className="page">
        <div style={{ width: "100%", maxWidth: "1200px" }}>
          <div style={{ marginBottom: 48 }}>
            <h1 className="display" style={{ fontSize: "3rem", color: "var(--accent)", marginBottom: 8 }}>
              Sing! Lobby
            </h1>
            <p className="text-dim" style={{ fontSize: "1.1rem", maxWidth: 600 }}>
              Start a karaoke room. Put it on your TV, share the QR code with guests, and let them queue up songs from their phones.
            </p>
          </div>

          {error && (
            <div style={{ color: "var(--danger)", marginBottom: 24, padding: "12px 16px", background: "rgba(228, 72, 61, 0.1)", borderRadius: "var(--radius-md)" }}>
              {error}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: isLoggedIn ? "repeat(2, 1fr)" : "1fr", gap: 24, maxWidth: isLoggedIn ? "100%" : "960px", margin: "0 auto" }}>
            {/* Session Room Card */}
            <div className="card stack" style={!isLoggedIn ? { maxWidth: 960 } : undefined}>
              <h2 style={{ fontSize: "1.4rem", color: "var(--accent)", margin: 0 }}>Quick Party</h2>
              <p className="text-dim">
                A one-time room with a random code. Ends when you close it—perfect for spontaneous karaoke.
              </p>
              <div style={{ marginTop: 12 }}>
                <p className="text-dim" style={{ fontSize: "0.9rem", marginBottom: 8 }}>
                  💡 No account needed
                </p>
              </div>
              <button
                className="btn btn-primary"
                onClick={createSessionRoom}
                disabled={loading}
                style={{ marginTop: "auto" }}
              >
                {loading ? "Creating…" : "Create Party Room"}
              </button>
            </div>

            {/* Permanent Room Card - Only visible when logged in */}
            {isLoggedIn && (
              <div className="card stack">
                <h2 style={{ fontSize: "1.4rem", color: "var(--accent)", margin: 0 }}>
                  Persistent Room
                </h2>
                <p className="text-dim">
                  A room with a permanent link. Pause it anytime—your queue and pitch settings are saved for next time.
                </p>
                <input
                  type="text"
                  placeholder="Room name (optional)"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                />
                <button
                  className="btn btn-primary"
                  onClick={createPermanentRoom}
                  disabled={loading}
                  style={{ marginTop: "auto" }}
                >
                  {loading ? "Creating…" : "Create Persistent Room"}
                </button>
              </div>
            )}
          </div>

          {isLoggedIn && (
            <div style={{ marginTop: 48, textAlign: "center" }}>
              <button className="btn btn-secondary" onClick={() => navigate("/sing-host")}>
                → View All Rooms
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
