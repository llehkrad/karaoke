import { useState, useEffect } from "react";
import { useAuth } from "../AuthContext.jsx";

const API = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

export default function AdminLoginModal() {
  const { isLoggedIn, login } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleLoginClick = () => setShowModal(true);
    window.addEventListener("openAdminLogin", handleLoginClick);
    return () => window.removeEventListener("openAdminLogin", handleLoginClick);
  }, []);

  async function handleLogin() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/rooms/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Login failed.");
      login(data.username, data.role);
      setUsername("");
      setPassword("");
      setShowModal(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!showModal) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Login</h2>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
        />
        {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
        <div className="modal-buttons">
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleLogin} disabled={loading || !username || !password}>
            {loading ? "Logging in…" : "Log in"}
          </button>
        </div>
      </div>
    </div>
  );
}
