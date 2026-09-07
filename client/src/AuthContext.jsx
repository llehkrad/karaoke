import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();
const USERNAME_KEY = "karaoke_username";
const ROLE_KEY = "karaoke_user_role";

export function AuthProvider({ children }) {
  const [username, setUsername] = useState(() => sessionStorage.getItem(USERNAME_KEY) || "");
  const [role, setRole] = useState(() => sessionStorage.getItem(ROLE_KEY) || "");
  const [isLoggedIn, setIsLoggedIn] = useState(!!username);

  useEffect(() => {
    setIsLoggedIn(!!username);
  }, [username]);

  const login = (newUsername, newRole) => {
    sessionStorage.setItem(USERNAME_KEY, newUsername);
    sessionStorage.setItem(ROLE_KEY, newRole);
    setUsername(newUsername);
    setRole(newRole);
  };

  const logout = () => {
    sessionStorage.removeItem(USERNAME_KEY);
    sessionStorage.removeItem(ROLE_KEY);
    setUsername("");
    setRole("");
  };

  return (
    <AuthContext.Provider value={{ username, role, isLoggedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
