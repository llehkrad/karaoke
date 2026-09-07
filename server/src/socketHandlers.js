import { getRoom, verifyHost, pauseRoom, resumeRoom, endSessionRoom } from "./rooms.js";
import { getFullState, addToQueue, removeFromQueue, shuffleQueue, advanceQueue } from "./queue.js";
import { searchYoutube } from "./youtube.js";

function roomChannel(roomId) {
  return `room:${roomId}`;
}

function broadcastState(io, roomId) {
  const state = getFullState(roomId);
  if (state) io.to(roomChannel(roomId)).emit("state_update", state);
}

export function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    socket.on("join_room", ({ roomId }, ack) => {
      const room = getRoom(roomId);
      if (!room) {
        ack?.({ ok: false, error: "Room not found." });
        return;
      }
      socket.join(roomChannel(roomId));
      socket.data.roomId = roomId;
      ack?.({ ok: true, state: getFullState(roomId) });
    });

    socket.on("search_youtube", async ({ query }, ack) => {
      try {
        const results = await searchYoutube(query);
        ack?.({ ok: true, results });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });

    socket.on("add_to_queue", ({ roomId, video, pitch, addedBy }, ack) => {
      try {
        const room = getRoom(roomId);
        if (!room || room.status === "ended") {
          ack?.({ ok: false, error: "Room is not active." });
          return;
        }
        addToQueue(roomId, {
          videoId: video.videoId,
          title: video.title,
          thumbnail: video.thumbnail,
          channelTitle: video.channelTitle,
          pitch,
          addedBy,
        });
        broadcastState(io, roomId);
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });

    socket.on("remove_from_queue", ({ roomId, itemId }, ack) => {
      removeFromQueue(roomId, itemId);
      broadcastState(io, roomId);
      ack?.({ ok: true });
    });

    socket.on("shuffle_queue", ({ roomId }, ack) => {
      shuffleQueue(roomId);
      broadcastState(io, roomId);
      ack?.({ ok: true });
    });

    // Sent only by the host display client when the YouTube IFrame player
    // reports its "ended" state (player state 0).
    socket.on("video_ended", ({ roomId, hostToken }, ack) => {
      if (!verifyHost(roomId, hostToken)) {
        ack?.({ ok: false, error: "Invalid host token." });
        return;
      }
      advanceQueue(roomId);
      broadcastState(io, roomId);
      ack?.({ ok: true });
    });

    // Host-only: skip the current song immediately without waiting for it to end.
    socket.on("skip_current", ({ roomId, hostToken }, ack) => {
      if (!verifyHost(roomId, hostToken)) {
        ack?.({ ok: false, error: "Invalid host token." });
        return;
      }
      advanceQueue(roomId);
      broadcastState(io, roomId);
      ack?.({ ok: true });
    });

    socket.on("pause_room", ({ roomId, hostToken }, ack) => {
      if (!verifyHost(roomId, hostToken)) {
        ack?.({ ok: false, error: "Invalid host token." });
        return;
      }
      pauseRoom(roomId);
      broadcastState(io, roomId);
      ack?.({ ok: true });
    });

    socket.on("resume_room", ({ roomId, hostToken }, ack) => {
      if (!verifyHost(roomId, hostToken)) {
        ack?.({ ok: false, error: "Invalid host token." });
        return;
      }
      resumeRoom(roomId);
      broadcastState(io, roomId);
      ack?.({ ok: true });
    });

    socket.on("end_session_room", ({ roomId, hostToken }, ack) => {
      const room = getRoom(roomId);
      if (!room || room.host_token !== hostToken) {
        ack?.({ ok: false, error: "Invalid host token." });
        return;
      }
      if (room.type !== "session") {
        ack?.({ ok: false, error: "Only session rooms can be ended permanently. Use pause for permanent rooms." });
        return;
      }
      io.to(roomChannel(roomId)).emit("room_ended");
      endSessionRoom(roomId);
      ack?.({ ok: true });
    });
  });
}
