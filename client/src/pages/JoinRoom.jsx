import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import QRDisplay from "../components/QRDisplay.jsx";
import TopBar from "../components/TopBar.jsx";

export default function JoinRoom() {
  const { roomId } = useParams();
  const { isLoggedIn, logout } = useAuth();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.title = "Join Room - Sing!";
  }, []);

  function handleLoginClick() {
    window.dispatchEvent(new Event("openAdminLogin"));
  }

  const joinUrl = `${window.location.origin}/join/${roomId}`;

  function copyToClipboard() {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <TopBar isLoggedIn={isLoggedIn} onLoginClick={handleLoginClick} onLogoutClick={logout} />
      <div className="page">
        <div style={{ width: "100%", maxWidth: "1200px" }}>
          <div style={{ marginBottom: 32 }}>
            <h1 className="display" style={{ fontSize: "2.5rem", color: "var(--accent)", marginBottom: 8 }}>
              Sing! Join Room
            </h1>
            <p className="text-dim">Scan the code or share the link to let guests queue up songs.</p>
          </div>

          <div className="card main-content" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ textAlign: "center" }}>
              <p className="text-dim" style={{ margin: 0, marginBottom: 12, fontSize: "0.9rem" }}>
                Guest QR Code
              </p>
              <QRDisplay url={joinUrl} size={240} />
            </div>
            <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 8 }}>
              <p className="text-dim" style={{ margin: 0, fontSize: "0.9rem", wordBreak: "break-all", textAlign: "center" }}>
                {joinUrl}
              </p>
              <button className="btn btn-primary" onClick={copyToClipboard} style={{ width: "100%" }}>
                {copied ? "✓ Copied!" : "Copy Link"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
