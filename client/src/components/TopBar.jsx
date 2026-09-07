import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";

export default function TopBar({ isLoggedIn, onLoginClick, onLogoutClick }) {
  const navigate = useNavigate();
  const { role } = useAuth();

  return (
    <div className="top-bar">
      <div className="top-bar-inner">
        <Link to="/" className="logo" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <img src="/sing-logo.png" alt="Sing!" style={{ height: "75px", width: "auto" }} />
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {isLoggedIn && role === "admin" && (
            <Link to="/manage-users" className="btn btn-secondary">
              Manage Users
            </Link>
          )}
          <button
            className="btn btn-secondary"
            onClick={() => {
              if (isLoggedIn) {
                onLogoutClick();
                navigate("/");
              } else {
                onLoginClick();
              }
            }}
          >
            {isLoggedIn ? "Log out" : "Log in"}
          </button>
        </div>
      </div>
    </div>
  );
}
