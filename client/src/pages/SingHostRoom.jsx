import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import { socket, emitAsync } from "../socket.js";
import QueueList from "../components/QueueList.jsx";
import TopBar from "../components/TopBar.jsx";

const API = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

export default function SingHostRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isLoggedIn, username, role, logout } = useAuth();

  // Admins control any room via their username (server treats it as a
  // skeleton key); anonymous Quick Party hosts use the room's own one-time
  // hostToken passed in the URL instead.
  const roomHostToken = searchParams.get("hostToken") || "";
  const hostToken = isLoggedIn ? username : roomHostToken;
  const canManage = isLoggedIn || !!roomHostToken;

  const [state, setState] = useState(null);
  const [connError, setConnError] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const [hostNeedsInteraction, setHostNeedsInteraction] = useState(false);

  // Power-user membership (admin-managed, permanent rooms only).
  const [members, setMembers] = useState(null);
  const [powerUsers, setPowerUsers] = useState(null);
  const [memberToAdd, setMemberToAdd] = useState("");
  const [memberError, setMemberError] = useState("");
  const [memberBusy, setMemberBusy] = useState(false);

  const isAdmin = isLoggedIn && role === "admin";
  const roomType = state?.room?.type;

  const fetchMembers = useCallback(async () => {
    if (!isAdmin || roomType !== "permanent") return;
    try {
      const [membersRes, usersRes] = await Promise.all([
        fetch(`${API}/api/rooms/${roomId}/members`, { headers: { "X-Username": username } }),
        fetch(`${API}/api/users`, { headers: { "X-Username": username } }),
      ]);
      const membersData = await membersRes.json();
      const usersData = await usersRes.json();
      setMembers(membersData);
      setPowerUsers(usersData.filter((u) => u.role === "power"));
    } catch (err) {
      setMemberError("Could not load power users: " + err.message);
    }
  }, [isAdmin, roomType, roomId, username]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  async function handleAddMember(e) {
    e.preventDefault();
    if (!memberToAdd) return;
    setMemberError("");
    setMemberBusy(true);
    try {
      const res = await fetch(`${API}/api/rooms/${roomId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Username": username },
        body: JSON.stringify({ username: memberToAdd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add user.");
      setMembers(data);
      setMemberToAdd("");
    } catch (err) {
      setMemberError(err.message);
    } finally {
      setMemberBusy(false);
    }
  }

  async function handleRemoveMember(memberUsername) {
    setMemberError("");
    try {
      const res = await fetch(`${API}/api/rooms/${roomId}/members/${encodeURIComponent(memberUsername)}`, {
        method: "DELETE",
        headers: { "X-Username": username },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not remove user.");
      setMembers(data);
    } catch (err) {
      setMemberError(err.message);
    }
  }

  useEffect(() => {
    document.title = "Manage Room - Sing!";
  }, []);

  function handleLoginClick() {
    window.dispatchEvent(new Event("openAdminLogin"));
  }

  const joinUrl = `${window.location.origin}/join/${roomId}`;
  const hostCastUrl = `${window.location.origin}/host/${roomId}?hostToken=${hostToken}`;

  useEffect(() => {
    if (!canManage) {
      navigate("/");
    }
  }, [canManage, navigate]);

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
    socket.on("host_playback_status", ({ needsInteraction }) => mounted && setHostNeedsInteraction(needsInteraction));

    return () => {
      mounted = false;
      socket.off("connect", join);
      socket.off("state_update");
      socket.off("room_ended");
      socket.off("host_playback_status");
    };
  }, [roomId]);

  if (!canManage) return null;

  function nudgePitch(delta) {
    if (!state?.nowPlaying) return;
    const next = Math.max(-12, Math.min(12, state.nowPlaying.pitch_semitones + delta));
    socket.emit("set_pitch", { roomId, hostToken, semitones: next });
  }

  function resetPitch() {
    if (!state?.nowPlaying) return;
    socket.emit("set_pitch", { roomId, hostToken, semitones: 0 });
  }

  function sendPlayback(action) {
    socket.emit("playback_control", { roomId, hostToken, action });
    if (action === "pause") setIsPaused(true);
    if (action === "resume" || action === "restart") setIsPaused(false);
  }

  function handleSkip() {
    socket.emit("skip_current", { roomId, hostToken });
    setIsPaused(false);
  }

  function handleShuffle() {
    socket.emit("shuffle_queue", { roomId, hostToken });
  }

  function handleReorder(orderedItemIds) {
    socket.emit("reorder_queue", { roomId, queue: orderedItemIds, hostToken });
  }

  function handleRemove(itemId) {
    socket.emit("remove_from_queue", { roomId, itemId });
  }

  function handlePauseRoom() {
    if (room.status === "paused") {
      socket.emit("resume_room", { roomId, hostToken });
    } else {
      socket.emit("pause_room", { roomId, hostToken });
    }
  }

  function handleDeleteRoom() {
    if (confirm(`Delete room "${room.id}"? This action cannot be undone.`)) {
      socket.emit("delete_room", { roomId, hostToken }, (ack) => {
        if (ack?.ok) {
          // Redirect back to rooms list after successful deletion
          navigate(isLoggedIn ? "/sing-host" : "/");
        } else {
          alert("Failed to delete room: " + (ack?.error || "Unknown error"));
        }
      });
    }
  }

  if (connError) {
    return (
      <>
        <TopBar isLoggedIn={isLoggedIn} onLoginClick={handleLoginClick} onLogoutClick={logout} />
        <div className="page">
          <div style={{ color: "var(--danger)", marginBottom: 24 }}>{connError}</div>
          <Link to={isLoggedIn ? "/sing-host" : "/"} className="btn btn-secondary">
            Back to Rooms
          </Link>
        </div>
      </>
    );
  }

  if (!state) {
    return (
      <>
        <TopBar isLoggedIn={isLoggedIn} onLoginClick={handleLoginClick} onLogoutClick={logout} />
        <div className="page">
          <p className="text-dim">Connecting…</p>
        </div>
      </>
    );
  }

  const { room, queue, nowPlaying } = state;

  return (
    <>
      <TopBar isLoggedIn={isLoggedIn} onLoginClick={handleLoginClick} onLogoutClick={logout} />
      <div className="page">
        <div style={{ width: "100%", maxWidth: "1200px" }}>
          <div style={{ marginBottom: 32 }}>
            <h1 className="display" style={{ fontSize: "2.5rem", color: "var(--accent)", marginBottom: 8 }}>
              Sing! Manage Room
            </h1>
            <p className="text-dim">Control playback, adjust pitch, and manage the queue.</p>
          </div>

          {/* Room Info Box */}
          <div
            className="card main-content"
            style={{
              marginBottom: 32,
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
          >
            <div className="stack">
              <div>
                <h1 className="display" style={{ fontSize: "1.8rem", color: "var(--accent)", margin: 0, marginBottom: 4 }}>
                  {room.id}
                </h1>
                <p className="text-dim" style={{ margin: 0, marginBottom: 12 }}>
                  {room.type === "permanent" ? "📌 Permanent" : "⏱️ Session"} · {room.status}
                </p>
                <div className="row" style={{ gap: 8, marginBottom: 16 }}>
                  <button
                    className="btn btn-secondary"
                    onClick={handlePauseRoom}
                    style={{ flex: 1 }}
                  >
                    {room.status === "paused" ? "▶ Resume" : "⏸ Pause"}
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={handleDeleteRoom}
                    style={{ flex: 1 }}
                  >
                    🗑 Delete
                  </button>
                </div>
              </div>

              {/* Now Playing Box */}
              {nowPlaying ? (
                <div
                  style={{
                    padding: "16px",
                    background: "var(--field)",
                    borderRadius: "var(--radius-md)",
                    marginBottom: 16,
                  }}
                >
                  <p className="text-dim" style={{ margin: 0, fontSize: "0.85rem", marginBottom: 4 }}>
                    Now Playing
                  </p>
                  <div style={{ fontWeight: 500, fontSize: "1.1rem", marginBottom: 12 }}>{nowPlaying.title}</div>

                  {hostNeedsInteraction && (
                    <div
                      style={{
                        padding: "10px 14px",
                        marginBottom: 12,
                        borderRadius: "var(--radius-md)",
                        background: "rgba(228, 72, 61, 0.1)",
                        color: "var(--danger)",
                        fontSize: "0.9rem",
                      }}
                    >
                      ⚠️ Host Display's browser blocked playback — pause/resume/restart from here won't take effect
                      until someone taps play directly on the Host Display screen.
                    </div>
                  )}

                  <div className="row" style={{ justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 12 }}>
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
                    <button
                      className="btn btn-secondary"
                      onClick={resetPitch}
                      disabled={nowPlaying.pitch_semitones === 0}
                    >
                      Reset
                    </button>
                  </div>

                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn btn-secondary" onClick={() => sendPlayback("restart")} style={{ flex: 1 }}>
                      Restart
                    </button>
                    {isPaused ? (
                      <button className="btn btn-primary" onClick={() => sendPlayback("resume")} style={{ flex: 1 }}>
                        ▶ Resume
                      </button>
                    ) : (
                      <button className="btn btn-primary" onClick={() => sendPlayback("pause")} style={{ flex: 1 }}>
                        ❚❚ Pause
                      </button>
                    )}
                    <button className="btn btn-secondary" onClick={handleSkip} style={{ flex: 1 }}>
                      Skip
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-dim" style={{ textAlign: "center", marginBottom: 16, fontSize: "1rem" }}>
                  Queue is empty. Waiting for songs…
                </p>
              )}

              <div className="row" style={{ gap: 8 }}>
                <a href={hostCastUrl} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ flex: 1 }}>
                  Open Host Display
                </a>
                <a href={joinUrl} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ flex: 1 }}>
                  Open Guest Page
                </a>
                <a href={`/sing-host/${roomId}/join`} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ flex: 1 }}>
                  Show Join QR
                </a>
              </div>
            </div>
          </div>

          {/* Power Users (admin-managed, permanent rooms only) */}
          {isAdmin && room.type === "permanent" && (
            <div className="card stack main-content" style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: "1.2rem", margin: 0 }}>Power Users</h2>
              <p className="text-dim" style={{ margin: 0, fontSize: "0.9rem" }}>
                Power users tied to this room get full host control over it.
              </p>

              {memberError && <div style={{ color: "var(--danger)" }}>{memberError}</div>}

              {members === null && <p className="text-dim">Loading…</p>}
              {members?.length === 0 && <p className="text-dim">No power users added yet.</p>}
              {members?.map((m) => (
                <div
                  key={m.username}
                  className="row"
                  style={{ justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--hairline)" }}
                >
                  <span>{m.username}</span>
                  <button className="btn btn-secondary" onClick={() => handleRemoveMember(m.username)}>
                    Remove
                  </button>
                </div>
              ))}

              <form onSubmit={handleAddMember} className="row" style={{ gap: 8, marginTop: 8 }}>
                <select
                  value={memberToAdd}
                  onChange={(e) => setMemberToAdd(e.target.value)}
                  style={{ flex: 1 }}
                >
                  <option value="">Select a power user…</option>
                  {powerUsers
                    ?.filter((u) => !members?.some((m) => m.username === u.username))
                    .map((u) => (
                      <option key={u.username} value={u.username}>
                        {u.username}
                      </option>
                    ))}
                </select>
                <button type="submit" className="btn btn-primary" disabled={!memberToAdd || memberBusy}>
                  Add
                </button>
              </form>
            </div>
          )}

          {/* Playlist */}
          <div className="card stack main-content">
            <div>
              <h2 style={{ fontSize: "1.4rem", margin: 0, marginBottom: 8 }}>Up Next</h2>
              <p className="text-dim" style={{ margin: 0 }}>{queue?.length || 0} songs queued</p>
            </div>
            <QueueList
              queue={queue}
              nowPlaying={null}
              onShuffle={handleShuffle}
              onRemove={handleRemove}
              onReorder={handleReorder}
            />
          </div>

          {/* Back Button */}
          <div style={{ marginTop: 32, textAlign: "center" }}>
            <Link to={isLoggedIn ? "/sing-host" : "/"} className="btn btn-secondary">
              {isLoggedIn ? "← Back to All Rooms" : "← Back to Home"}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
