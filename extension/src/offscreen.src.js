import { SoundTouchNode } from "@soundtouchjs/audio-worklet";

// Runs inside the extension's offscreen document. Receives a tabCapture
// stream ID + room ID from background.js, builds an audio graph that
// pitch-shifts the captured tab audio in real time, and opens its own
// Socket.IO connection to the karaoke server to learn what pitch to apply
// — the exact same join_room/state_update contract HostView.jsx itself
// uses, so no changes to the web app were needed for this to work.

let audioCtx = null;
let stNode = null;
let mediaStream = null;
let socket = null;

function sendStatus(status) {
  chrome.runtime.sendMessage({ type: "STATUS_UPDATE", ...status }).catch(() => {});
}

function applyState(state) {
  if (!stNode) return;
  const nowPlaying = state?.nowPlaying;
  const pitch = nowPlaying?.pitch_semitones ?? 0;
  stNode.pitchSemitones.value = pitch;
  sendStatus({
    state: "synced",
    title: nowPlaying?.title ?? null,
    pitchSemitones: pitch,
  });
}

function connectSocket(roomId, serverUrl) {
  socket = window.io(serverUrl, { transports: ["websocket", "polling"] });

  socket.on("connect", () => {
    socket.emit("join_room", { roomId }, (ack) => {
      if (!ack?.ok) {
        sendStatus({ state: "error", message: ack?.error || "Could not join room." });
        return;
      }
      applyState(ack.state);
    });
  });

  socket.on("state_update", (state) => applyState(state));

  socket.on("connect_error", (err) => {
    sendStatus({ state: "error", message: `Server connection error: ${err.message}` });
  });

  socket.on("room_ended", () => {
    sendStatus({ state: "error", message: "Room ended." });
  });
}

async function initAudio({ streamId, roomId, serverUrl }) {
  await teardownAudio();
  sendStatus({ state: "connecting" });

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId,
        },
      },
    });
  } catch (err) {
    sendStatus({ state: "error", message: `Could not capture tab audio: ${err.message}` });
    return;
  }

  audioCtx = new AudioContext();
  await SoundTouchNode.register(audioCtx, chrome.runtime.getURL("lib/soundtouch-processor.js"));
  stNode = new SoundTouchNode(audioCtx);

  const source = audioCtx.createMediaStreamSource(mediaStream);
  source.connect(stNode);
  stNode.connect(audioCtx.destination);

  connectSocket(roomId, serverUrl);
}

async function teardownAudio() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
  if (audioCtx) {
    await audioCtx.close().catch(() => {});
    audioCtx = null;
  }
  stNode = null;
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "INIT_AUDIO") {
    initAudio(msg);
  } else if (msg.type === "TEARDOWN_AUDIO") {
    teardownAudio();
  }
});
