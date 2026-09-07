import { io } from "socket.io-client";

// In production, set VITE_SERVER_URL at build time to your deployed server's
// URL. In dev, Vite's proxy config forwards /api and the socket connects
// straight to localhost:3001.
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

export const socket = io(SERVER_URL, { autoConnect: true });

export function emitAsync(event, payload) {
  return new Promise((resolve) => {
    socket.emit(event, payload, resolve);
  });
}
