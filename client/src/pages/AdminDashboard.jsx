import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";

const API = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";
const ADMIN_TOKEN_KEY = "karaoke_admin_token";

export default function AdminDashboard() {
  const [token, setToken] = useState(() => sessionStorage.getItem(ADMIN_TOKEN_KEY) || "");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [rooms, setRooms] = useState(null);
  const [listError, setListError] = useState("");

  async function login() {
    setLoginError("");
    setLoggingIn(true);
    try {
      const res = await fetch(`${API}/api/admin/rooms/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Login failed.");
      sessionStorage.setItem(ADMIN_TOKEN_KEY, password);
      setToken(password);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoggingIn(false);
    }
  }

  function logout() {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken("");
    setRooms(null);
  }

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/admin/rooms`, {
        headers: { "X-Admin-Token": token },
      });
      if (res.status === 401) {
        logout();
        return;
      }
      const data = await res.json();
      setListError("");
      setRooms(data);
    } catch {
      setListError("Could not reach the server.");
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, [token, fetchRooms]);

  if (!token) {
    return (
      <div className="page">
        <div className="card stack" style={{ marginTop: 40 }}>
          <h1 className="display" style={{ fontSize: "2rem", color: "var(--spotlight)" }}>
            Admin login
          </h1>
          <input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
          />
          {loginError && <p style={{ color: "var(--danger)" }}>{loginError}</p>}
          <button className="btn btn-primary" onClick={login} disabled={loggingIn}>
            {loggingIn ? "Checking…" : "Log in"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card stack admin-dashboard" style={{ marginTop: 40 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1 className="display" style={{ fontSize: "1.8rem", color: "var(--spotlight)", margin: 0 }}>
            Rooms
          </h1>
          <button className="btn btn-secondary" onClick={logout}>
            Log out
          </button>
        </div>

        {listError && <p style={{ color: "var(--danger)" }}>{listError}</p>}

        {rooms === null && <p className="text-dim">Loading…</p>}
        {rooms?.length === 0 && <p className="text-dim">No rooms yet.</p>}

        {rooms?.map((room) => (
          <Link key={room.id} to={`/admin/${room.id}`} className="admin-room-row">
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>
                {room.id} <span className="text-dim">· {room.type}</span>
              </div>
              <div className="text-dim" style={{ fontSize: "0.85rem" }}>
                {room.status === "paused"
                  ? "Paused"
                  : room.nowPlayingTitle
                  ? `Now playing: ${room.nowPlayingTitle}`
                  : "Idle"}
                {" · "}
                {room.queueLength} queued
              </div>
            </div>
            <span className="pill">Manage →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
