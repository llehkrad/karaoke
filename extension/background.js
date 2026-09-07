// Service worker. Owns the offscreen document's lifecycle and relays
// START/STOP requests from the popup into tabCapture + offscreen messages.
// Also mirrors the offscreen document's STATUS_UPDATE broadcasts onto the
// toolbar badge, so sync state is visible even with the popup closed.

let syncState = {
  active: false,
  tabId: null,
  roomId: null,
  serverUrl: null,
  lastStatus: null,
};

async function ensureOffscreenDocument() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
  if (contexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["USER_MEDIA"],
    justification: "Capture and pitch-shift the Host Display tab's audio in real time.",
  });
}

async function closeOffscreenDocumentIfOpen() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
  if (contexts.length > 0) {
    await chrome.offscreen.closeDocument();
  }
}

function updateBadge(status) {
  if (!status) {
    chrome.action.setBadgeText({ text: "" });
    return;
  }
  if (status.state === "error") {
    chrome.action.setBadgeText({ text: "!" });
    chrome.action.setBadgeBackgroundColor({ color: "#c62828" });
    return;
  }
  if (status.state === "synced") {
    const p = status.pitchSemitones ?? 0;
    chrome.action.setBadgeText({ text: p === 0 ? "0" : p > 0 ? `+${p}` : `${p}` });
    chrome.action.setBadgeBackgroundColor({ color: "#2e7d32" });
    return;
  }
  chrome.action.setBadgeText({ text: "..." });
  chrome.action.setBadgeBackgroundColor({ color: "#888888" });
}

async function handleStart({ tabId, roomId, serverUrl }, sendResponse) {
  try {
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
    await ensureOffscreenDocument();
    await chrome.runtime.sendMessage({ type: "INIT_AUDIO", streamId, roomId, serverUrl });
    syncState = { active: true, tabId, roomId, serverUrl, lastStatus: { state: "connecting" } };
    updateBadge(syncState.lastStatus);
    sendResponse({ ok: true });
  } catch (err) {
    syncState = { active: false, tabId: null, roomId: null, serverUrl: null, lastStatus: null };
    updateBadge(null);
    sendResponse({ ok: false, error: String(err?.message || err) });
  }
}

async function handleStop(sendResponse) {
  try {
    await chrome.runtime.sendMessage({ type: "TEARDOWN_AUDIO" }).catch(() => {});
    await closeOffscreenDocumentIfOpen();
  } finally {
    syncState = { active: false, tabId: null, roomId: null, serverUrl: null, lastStatus: null };
    updateBadge(null);
    sendResponse({ ok: true });
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "GET_STATUS") {
    sendResponse(syncState);
    return false;
  }
  if (msg.type === "START_SYNC") {
    handleStart(msg, sendResponse);
    return true;
  }
  if (msg.type === "STOP_SYNC") {
    handleStop(sendResponse);
    return true;
  }
  if (msg.type === "STATUS_UPDATE") {
    syncState.lastStatus = msg;
    updateBadge(msg);
  }
  return false;
});
