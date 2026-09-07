import { getRoom, verifyHost, pauseRoom, resumeRoom, endSessionRoom, deleteRoom } from "./rooms.js";
import {
  getFullState,
  addToQueue,
  removeFromQueue,
  shuffleQueue,
  advanceQueue,
  updateNowPlayingPitch,
  updateItemPitch,
  reorderQueue,
} from "./queue.js";
import { searchYoutube } from "./youtube.js";

const PLAYBACK_ACTIONS = new Set(["pause", "resume", "restart"]);

// Tracks which single socket is the "live" Host Display for each room, so
// opening a second one anywhere can bump the first. In-memory and
// per-server-process by design -- a fresh server restart just lets
// whichever Host Display reconnects first reclaim the room, which is fine.
const activeHostDisplays = new Map();

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

    // Only one Host Display should be "live" per room at a time. Claiming
    // bumps whatever socket previously held it -- that client gets a
    // host_display_replaced event and shows a disabled screen instead of
    // silently double-playing audio/video in two places.
    socket.on("claim_host_display", ({ roomId }, ack) => {
      const room = getRoom(roomId);
      if (!room) {
        ack?.({ ok: false, error: "Room not found." });
        return;
      }

      const previousSocketId = activeHostDisplays.get(roomId);
      if (previousSocketId && previousSocketId !== socket.id) {
        io.to(previousSocketId).emit("host_display_replaced");
      }

      activeHostDisplays.set(roomId, socket.id);
      socket.data.hostDisplayRoomId = roomId;
      ack?.({ ok: true });
    });

    socket.on("disconnect", () => {
      const rid = socket.data.hostDisplayRoomId;
      if (rid && activeHostDisplays.get(rid) === socket.id) {
        activeHostDisplays.delete(rid);
      }
    });

    // Host Display reports whether a play command it just tried to obey
    // actually took effect, or was silently blocked by the browser's
    // autoplay policy (which no remote command can force past -- only a
    // real click on that page can). Relayed to everyone else in the room
    // (Manage Room) so a blocked remote control shows a heads-up instead
    // of silently doing nothing. Informational only, no auth needed.
    socket.on("host_playback_status", ({ roomId, needsInteraction }) => {
      socket.to(roomChannel(roomId)).emit("host_playback_status", { needsInteraction });
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

    // Host-only: shuffling the whole queue (unlike a guest reordering just
    // their own songs) is a room-management action.
    socket.on("shuffle_queue", ({ roomId, hostToken }, ack) => {
      if (!verifyHost(roomId, hostToken)) {
        ack?.({ ok: false, error: "Invalid host token." });
        return;
      }
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

    // Host-only: live-adjust the currently playing song's pitch without
    // re-queuing it. Broadcasts state_update, which is also what the
    // pitch-shifter bridge endpoint and the Chrome extension read from.
    socket.on("set_pitch", ({ roomId, hostToken, semitones }, ack) => {
      if (!verifyHost(roomId, hostToken)) {
        ack?.({ ok: false, error: "Invalid host token." });
        return;
      }
      updateNowPlayingPitch(roomId, semitones);
      broadcastState(io, roomId);
      ack?.({ ok: true });
    });

    // Host-only: live remote control of the host display's YouTube player.
    // Deliberately not persisted -- a live signal, not room state.
    socket.on("playback_control", ({ roomId, hostToken, action }, ack) => {
      if (!verifyHost(roomId, hostToken)) {
        ack?.({ ok: false, error: "Invalid host token." });
        return;
      }
      if (!PLAYBACK_ACTIONS.has(action)) {
        ack?.({ ok: false, error: "Invalid playback action." });
        return;
      }
      io.to(roomChannel(roomId)).emit("playback_control", { action });
      ack?.({ ok: true });
    });

    socket.on("end_session_room", ({ roomId, hostToken }, ack) => {
      const room = getRoom(roomId);
      if (!verifyHost(roomId, hostToken)) {
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

    // Guest-only: adjust pitch for a specific queued item before it plays
    socket.on("set_item_pitch", ({ roomId, itemId, semitones }, ack) => {
      try {
        updateItemPitch(roomId, itemId, semitones);
        broadcastState(io, roomId);
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });

    // Guest-only: cut (end and skip) the current song
    socket.on("cut_song", ({ roomId, itemId }, ack) => {
      try {
        advanceQueue(roomId);
        broadcastState(io, roomId);
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });

    // Reorders the queue to the given full item-id order. Used two ways:
    // a host (Manage Room) freely reordering anything, sending hostToken;
    // or a guest reordering just their own songs client-side (the client
    // only ever moves the guest's own items within the full order before
    // sending it here) — that path is unauthenticated, same trust model as
    // this app's other guest-facing queue actions (cut/remove/set pitch).
    socket.on("reorder_queue", ({ roomId, queue, hostToken }, ack) => {
      try {
        if (hostToken && !verifyHost(roomId, hostToken)) {
          ack?.({ ok: false, error: "Invalid host token." });
          return;
        }
        reorderQueue(roomId, queue);
        broadcastState(io, roomId);
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });

    // Host-only: delete a room (end session or delete permanent)
    socket.on("delete_room", ({ roomId, hostToken }, ack) => {
      try {
        if (!verifyHost(roomId, hostToken)) {
          ack?.({ ok: false, error: "Invalid host token." });
          return;
        }
        const room = getRoom(roomId);
        if (!room) {
          ack?.({ ok: false, error: "Room not found." });
          return;
        }
        // Delete fully removes the room (and its queue/history) for both
        // session and permanent rooms, freeing the id/slug for reuse.
        io.to(roomChannel(roomId)).emit("room_ended");
        if (room.type === "session") {
          endSessionRoom(roomId);
        } else {
          deleteRoom(roomId);
        }
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });
  });
}
