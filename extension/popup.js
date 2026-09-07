const serverUrlInput = document.getElementById("serverUrl");
const roomIdInput = document.getElementById("roomId");
const toggleBtn = document.getElementById("toggleBtn");
const statusEl = document.getElementById("status");

let activeTabId = null;
let activeRoomId = null;
let isSyncing = false;

function parseRoomId(url) {
  const match = url?.match(/\/host\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.className = kind || "";
}

function renderButton() {
  if (isSyncing) {
    toggleBtn.textContent = "Stop Pitch Sync";
    toggleBtn.className = "stop";
    toggleBtn.disabled = false;
  } else {
    toggleBtn.textContent = "Start Pitch Sync";
    toggleBtn.className = "start";
    toggleBtn.disabled = !activeRoomId;
  }
}

function renderStatusUpdate(status) {
  if (!status) {
    setStatus(activeRoomId ? "Ready." : "Open the Host Display page first.");
    return;
  }
  if (status.state === "error") {
    setStatus(status.message || "Error.", "error");
  } else if (status.state === "connecting") {
    setStatus("Connecting...");
  } else if (status.state === "synced") {
    const pitchText = status.pitchSemitones
      ? `${status.pitchSemitones > 0 ? "+" : ""}${status.pitchSemitones}`
      : "0";
    setStatus(
      status.title ? `Now playing: ${status.title}\nKey: ${pitchText}` : `Synced. No song playing.`,
      "synced"
    );
  }
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTabId = tab?.id ?? null;
  activeRoomId = parseRoomId(tab?.url);
  roomIdInput.value = activeRoomId || "(not on a Host Display page)";

  const stored = await chrome.storage.sync.get({ serverUrl: "http://localhost:3001" });
  serverUrlInput.value = stored.serverUrl;

  const status = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
  isSyncing = Boolean(status?.active);
  if (isSyncing && status?.serverUrl) {
    serverUrlInput.value = status.serverUrl;
  }
  renderButton();
  renderStatusUpdate(status?.lastStatus);
}

toggleBtn.addEventListener("click", async () => {
  if (isSyncing) {
    toggleBtn.disabled = true;
    setStatus("Stopping...");
    await chrome.runtime.sendMessage({ type: "STOP_SYNC" });
    isSyncing = false;
    renderButton();
    setStatus(activeRoomId ? "Ready." : "Open the Host Display page first.");
    return;
  }

  if (!activeRoomId || !activeTabId) {
    setStatus("Open the Host Display page (/host/<roomId>) in this tab first.", "error");
    return;
  }

  const serverUrl = serverUrlInput.value.trim().replace(/\/+$/, "");
  if (!serverUrl) {
    setStatus("Enter the server URL.", "error");
    return;
  }
  await chrome.storage.sync.set({ serverUrl });

  toggleBtn.disabled = true;
  setStatus("Starting...");
  const resp = await chrome.runtime.sendMessage({
    type: "START_SYNC",
    tabId: activeTabId,
    roomId: activeRoomId,
    serverUrl,
  });

  if (!resp?.ok) {
    setStatus(resp?.error || "Failed to start.", "error");
    toggleBtn.disabled = false;
    return;
  }

  isSyncing = true;
  renderButton();
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "STATUS_UPDATE") {
    renderStatusUpdate(msg);
  }
});

init();
