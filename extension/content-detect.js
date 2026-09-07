// Injected only into the Host Display page (see manifest.json's
// content_scripts match). Lets the web app detect whether this extension
// is installed, so it can show a setup prompt if it's missing -- a
// website has no way to install a Chrome extension on its own, so the
// best it can do is detect absence and point the host at the manual
// chrome://extensions steps.
document.documentElement.dataset.karaokePitchSync = "installed";
window.dispatchEvent(
  new CustomEvent("karaoke-pitch-sync-ready", {
    detail: { version: chrome.runtime.getManifest().version },
  })
);
