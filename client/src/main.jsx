import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./AuthContext.jsx";
import Landing from "./pages/Landing.jsx";
import HostView from "./pages/HostView.jsx";
import GuestView from "./pages/GuestView.jsx";
import SingHost from "./pages/SingHost.jsx";
import SingHostRoom from "./pages/SingHostRoom.jsx";
import JoinRoom from "./pages/JoinRoom.jsx";
import ManageUsers from "./pages/ManageUsers.jsx";
import AdminLoginModal from "./components/AdminLoginModal.jsx";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <AdminLoginModal />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/host/:roomId" element={<HostView />} />
          <Route path="/join/:roomId" element={<GuestView />} />
          <Route path="/sing-host" element={<SingHost />} />
          <Route path="/sing-host/:roomId" element={<SingHostRoom />} />
          <Route path="/sing-host/:roomId/join" element={<JoinRoom />} />
          <Route path="/manage-users" element={<ManageUsers />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
