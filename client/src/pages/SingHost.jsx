import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import TopBar from "../components/TopBar.jsx";

const API = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

export default function SingHost() {
  const navigate = useNavigate();
  const { isLoggedIn, username, logout } = useAuth();
  const [rooms, setRooms] = useState(null);
  const [listError, setListError] = useState("");

  useEffect(() => {
    document.title = "Admin - Sing!";
  }, []);

  function handleLoginClick() {
    window.dispatchEvent(new Event("openAdminLogin"));
  }

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/admin/rooms`, {
        headers: { "X-Username": username },
      });
      if (res.status === 401 || res.status === 403) {
        logout();
        navigate("/");
        return;
      }
      const data = await res.json();
      setListError("");
      setRooms(data);
    } catch (err) {
      setListError("Could not reach the server: " + err.message);
    }
  }, [username, logout, navigate]);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/");
      return;
    }
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, [isLoggedIn, fetchRooms, navigate]);

  if (!isLoggedIn) {
    return null;
  }

  return (
    <>
      <TopBar isLoggedIn={isLoggedIn} onLoginClick={handleLoginClick} onLogoutClick={logout} />
      <div className="page">
        <div style={{ width: "100%", maxWidth: "1200px" }}>
          <div style={{ marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h1 className="display" style={{ fontSize: "2.5rem", color: "var(--accent)", marginBottom: 8 }}>
                Sing! Host
              </h1>
              <p className="text-dim">Manage your karaoke rooms, control playback, and view the queue.</p>
            </div>
            <Link to="/" className="btn btn-secondary">
              Create New Room
            </Link>
          </div>

          {listError && (
            <div style={{ color: "var(--danger)", marginBottom: 24, padding: "12px 16px", background: "rgba(228, 72, 61, 0.1)", borderRadius: "var(--radius-md)" }}>
              {listError}
            </div>
          )}

          {rooms === null && <p className="text-dim">Loading rooms…</p>}
          {rooms?.length === 0 && (
            <div className="card stack" style={{ maxWidth: 500, textAlign: "center" }}>
              <p className="text-dim">No rooms yet. Create one from the lobby.</p>
              <Link to="/" className="btn btn-primary" style={{ alignSelf: "center", minWidth: "200px" }}>
                Create Room
              </Link>
            </div>
          )}

          {rooms && rooms.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {rooms.map((room) => (
                <Link
                  key={room.id}
                  to={`/sing-host/${room.id}`}
                  className="card"
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    transition: "all 160ms var(--ease)",
                    cursor: "pointer",
                    borderColor: room.status === "paused" ? "var(--border-strong)" : "var(--hairline)",
                  }}
                >
                  <div style={{ marginBottom: 12 }}>
                    <h3 style={{ fontSize: "1.2rem", margin: 0, marginBottom: 4 }}>
                      {room.id}
                      {room.status === "paused" && <span className="pill" style={{ marginLeft: 8 }}>Paused</span>}
                    </h3>
                    <p className="text-dim" style={{ margin: 0, fontSize: "0.9rem" }}>
                      {room.type === "permanent" ? "📌 Permanent" : "⏱️ Session"}
                    </p>
                  </div>

                  <div
                    style={{
                      padding: "12px",
                      background: "var(--field)",
                      borderRadius: "var(--radius-md)",
                      marginBottom: 12,
                    }}
                  >
                    {room.nowPlayingTitle ? (
                      <>
                        <p className="text-dim" style={{ margin: 0, fontSize: "0.85rem", marginBottom: 4 }}>
                          Now Playing
                        </p>
                        <p style={{ margin: 0, fontWeight: 500, fontSize: "0.95rem" }}>{room.nowPlayingTitle}</p>
                      </>
                    ) : (
                      <p className="text-dim" style={{ margin: 0 }}>Queue empty</p>
                    )}
                  </div>

                  <p className="text-dim" style={{ margin: 0, fontSize: "0.9rem" }}>
                    {room.queueLength} song{room.queueLength !== 1 ? "s" : ""} in queue
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
