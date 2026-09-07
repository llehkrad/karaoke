import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import TopBar from "../components/TopBar.jsx";

const API = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

export default function ManageUsers() {
  const navigate = useNavigate();
  const { isLoggedIn, username, role, logout } = useAuth();

  const [users, setUsers] = useState(null);
  const [listError, setListError] = useState("");
  const [form, setForm] = useState({ username: "", password: "", role: "power" });
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingUsername, setEditingUsername] = useState(null);
  const [editForm, setEditForm] = useState({ password: "", role: "power" });
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deletingUsername, setDeletingUsername] = useState(null);

  useEffect(() => {
    document.title = "Manage Users - Sing!";
  }, []);

  function handleLoginClick() {
    window.dispatchEvent(new Event("openAdminLogin"));
  }

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/users`, {
        headers: { "X-Username": username },
      });
      if (res.status === 401 || res.status === 403) {
        navigate("/");
        return;
      }
      const data = await res.json();
      setListError("");
      setUsers(data);
    } catch (err) {
      setListError("Could not reach the server: " + err.message);
    }
  }, [username, navigate]);

  useEffect(() => {
    if (!isLoggedIn || role !== "admin") {
      navigate("/");
      return;
    }
    fetchUsers();
  }, [isLoggedIn, role, fetchUsers, navigate]);

  if (!isLoggedIn || role !== "admin") {
    return null;
  }

  async function handleCreate(e) {
    e.preventDefault();
    setFormError("");
    setCreating(true);
    try {
      const res = await fetch(`${API}/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Username": username },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create user.");
      setForm({ username: "", password: "", role: "power" });
      fetchUsers();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setCreating(false);
    }
  }

  function startEdit(u) {
    setEditingUsername(u.username);
    setEditForm({ password: "", role: u.role });
    setEditError("");
  }

  function cancelEdit() {
    setEditingUsername(null);
    setEditError("");
  }

  async function handleSaveEdit(targetUsername) {
    setEditError("");
    setEditSaving(true);
    try {
      const body = { role: editForm.role };
      if (editForm.password) body.password = editForm.password;
      const res = await fetch(`${API}/api/users/${encodeURIComponent(targetUsername)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Username": username },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update user.");
      setEditingUsername(null);
      fetchUsers();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(targetUsername) {
    if (!confirm(`Delete user "${targetUsername}"? This can't be undone.`)) return;
    setListError("");
    setDeletingUsername(targetUsername);
    try {
      const res = await fetch(`${API}/api/users/${encodeURIComponent(targetUsername)}`, {
        method: "DELETE",
        headers: { "X-Username": username },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not delete user.");
      fetchUsers();
    } catch (err) {
      setListError(err.message);
    } finally {
      setDeletingUsername(null);
    }
  }

  return (
    <>
      <TopBar isLoggedIn={isLoggedIn} onLoginClick={handleLoginClick} onLogoutClick={logout} />
      <div className="page">
        <div style={{ width: "100%", maxWidth: "1200px" }}>
          <div style={{ marginBottom: 32 }}>
            <h1 className="display" style={{ fontSize: "2.5rem", color: "var(--accent)", marginBottom: 8 }}>
              Sing! Manage Users
            </h1>
            <p className="text-dim">Create accounts and assign roles.</p>
          </div>

          <div className="card main-content stack" style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: "1.2rem", margin: 0 }}>Create User</h2>
            {formError && (
              <div style={{ color: "var(--danger)" }}>{formError}</div>
            )}
            <form onSubmit={handleCreate} className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                type="text"
                placeholder="Username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                style={{ flex: "1 1 180px" }}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                style={{ flex: "1 1 180px" }}
                required
              />
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                style={{ flex: "0 0 140px" }}
              >
                <option value="power">Power</option>
                <option value="admin">Admin</option>
              </select>
              <button type="submit" className="btn btn-primary" disabled={creating}>
                {creating ? "Creating…" : "Create User"}
              </button>
            </form>
          </div>

          {listError && (
            <div style={{ color: "var(--danger)", marginBottom: 24 }}>{listError}</div>
          )}

          <div className="card main-content stack">
            <h2 style={{ fontSize: "1.2rem", margin: 0 }}>All Users</h2>
            {users === null && <p className="text-dim">Loading users…</p>}
            {users?.length === 0 && <p className="text-dim">No users yet.</p>}
            {users?.map((u) => {
              const isEditing = editingUsername === u.username;
              const isSelf = u.username === username;
              return (
                <div
                  key={u.username}
                  style={{
                    padding: "10px 0",
                    borderBottom: "1px solid var(--hairline)",
                  }}
                >
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <span>{u.username}</span>
                    <div className="row" style={{ gap: 8, alignItems: "center" }}>
                      <span className="pill">{u.role}</span>
                      {!isEditing && (
                        <>
                          <button className="btn btn-secondary" onClick={() => startEdit(u)}>
                            Edit
                          </button>
                          <button
                            className="btn btn-danger"
                            onClick={() => handleDelete(u.username)}
                            disabled={isSelf || deletingUsername === u.username}
                            title={isSelf ? "You can't delete your own account" : "Delete user"}
                          >
                            {deletingUsername === u.username ? "Deleting…" : "Delete"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
                      <input
                        type="password"
                        placeholder="New password (leave blank to keep current)"
                        value={editForm.password}
                        onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                        style={{ flex: "1 1 220px" }}
                      />
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                        style={{ flex: "0 0 140px" }}
                        disabled={isSelf && u.role === "admin"}
                        title={isSelf && u.role === "admin" ? "You can't change your own admin role here" : undefined}
                      >
                        <option value="power">Power</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        className="btn btn-primary"
                        onClick={() => handleSaveEdit(u.username)}
                        disabled={editSaving}
                      >
                        {editSaving ? "Saving…" : "Save"}
                      </button>
                      <button className="btn btn-secondary" onClick={cancelEdit}>
                        Cancel
                      </button>
                      {editError && <div style={{ color: "var(--danger)", width: "100%" }}>{editError}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
