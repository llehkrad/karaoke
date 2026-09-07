import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";

import { router } from "./routes.js";
import { registerSocketHandlers } from "./socketHandlers.js";

const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*"; // tighten this to your real frontend domain in production

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());
app.use("/api", router);

app.get("/health", (req, res) => res.json({ ok: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN },
});

registerSocketHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`Karaoke server listening on port ${PORT}`);
});
