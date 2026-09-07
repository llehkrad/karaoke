import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing.jsx";
import HostView from "./pages/HostView.jsx";
import GuestView from "./pages/GuestView.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import AdminRoomControl from "./pages/AdminRoomControl.jsx";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/host/:roomId" element={<HostView />} />
        <Route path="/join/:roomId" element={<GuestView />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/:roomId" element={<AdminRoomControl />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
