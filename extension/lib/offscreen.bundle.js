(() => {
  // node_modules/@soundtouchjs/audio-worklet/dist/constants.js
  var PROCESSOR_NAME = "soundtouch-processor";

  // node_modules/@soundtouchjs/audio-worklet/dist/SoundTouchNode.js
  var SoundTouchNode = class extends AudioWorkletNode {
    static processorName = PROCESSOR_NAME;
    /**
     * Registers the SoundTouch processor module with the given AudioContext.
     * Must be called before creating SoundTouchNode instances.
     *
     * @param context - The AudioContext or OfflineAudioContext
     * @param processorUrl - URL or path to the processor script
     */
    static async register(context, processorUrl) {
      await context.audioWorklet.addModule(processorUrl);
    }
    /**
     * Creates a SoundTouchNode instance.
     * @param context - The AudioContext or OfflineAudioContext
     */
    constructor(context) {
      super(context, PROCESSOR_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2]
      });
    }
    /**
     * Pitch multiplier AudioParam (1.0 = original pitch).
     */
    get pitch() {
      return this.parameters.get("pitch");
    }
    /**
     * Tempo multiplier AudioParam (1.0 = original tempo).
     */
    get tempo() {
      return this.parameters.get("tempo");
    }
    /**
     * Rate multiplier AudioParam (affects both pitch and tempo).
     */
    get rate() {
      return this.parameters.get("rate");
    }
    /**
     * Pitch shift in semitones AudioParam (integer steps for musical key changes).
     */
    get pitchSemitones() {
      return this.parameters.get("pitchSemitones");
    }
    get playbackRate() {
      return this.parameters.get("playbackRate");
    }
  };

  // src/offscreen.src.js
  var audioCtx = null;
  var stNode = null;
  var mediaStream = null;
  var socket = null;
  function sendStatus(status) {
    chrome.runtime.sendMessage({ type: "STATUS_UPDATE", ...status }).catch(() => {
    });
  }
  function applyState(state) {
    if (!stNode) return;
    const nowPlaying = state?.nowPlaying;
    const pitch = nowPlaying?.pitch_semitones ?? 0;
    stNode.pitchSemitones.value = pitch;
    sendStatus({
      state: "synced",
      title: nowPlaying?.title ?? null,
      pitchSemitones: pitch
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
            chromeMediaSourceId: streamId
          }
        }
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
      await audioCtx.close().catch(() => {
      });
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
})();
