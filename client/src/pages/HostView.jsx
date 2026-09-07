import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import YouTube from "react-youtube";
import { socket, emitAsync } from "../socket.js";
import QRDisplay from "../components/QRDisplay.jsx";

export default function HostView() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const hostToken = searchParams.get("hostToken") || "";

  const [state, setState] = useState(null);
  const [connError, setConnError] = useState("");
  const [replaced, setReplaced] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");
  const [extensionDetected, setExtensionDetected] = useState(
    () => document.documentElement.dataset.karaokePitchSync === "installed"
  );
  const [extensionNoticeDismissed, setExtensionNoticeDismissed] = useState(false);

  const playerRef = useRef(null);
  const videoFrameRef = useRef(null);
  const interactionCheckRef = useRef(null);

  const joinUrl = `${window.location.origin}/join/${roomId}`;

  useEffect(() => {
    document.title = `Room ${roomId} - Sing!`;
  }, [roomId]);

  // Browsers block programmatic play() calls that aren't triggered by a
  // real click/tap on this page -- which is exactly what a remote
  // resume/restart from Manage Room, or an autoplay on song change, is.
  // Since that failure is silent (no error, no event), the only reliable
  // way to catch it is to check shortly after whether playback actually
  // started. When it didn't, this both shows a real button here for
  // someone at the TV to tap, AND reports it back to the room so Manage
  // Room can show a heads-up instead of its own controls silently doing
  // nothing -- a remote click can never satisfy the "real gesture on this
  // page" requirement itself, so this status round-trip is the honest
  // substitute for a true remote override.
  function reportInteractionStatus(value) {
    setNeedsInteraction(value);
    socket.emit("host_playback_status", { roomId, needsInteraction: value });
  }

  function scheduleInteractionCheck() {
    if (interactionCheckRef.current) clearTimeout(interactionCheckRef.current);
    interactionCheckRef.current = setTimeout(() => {
      const state = playerRef.current?.getPlayerState?.();
      if (state !== 1 && state !== 3) {
        reportInteractionStatus(true);
      }
    }, 1500);
  }

  useEffect(() => {
    reportInteractionStatus(false);
    return () => {
      if (interactionCheckRef.current) clearTimeout(interactionCheckRef.current);
    };
  }, [state?.nowPlaying?.video_id]);

  useEffect(() => {
    let mounted = true;

    async function join() {
      const ack = await emitAsync("join_room", { roomId });
      if (!mounted) return;
      if (!ack.ok) {
        setConnError(ack.error || "Could not join room.");
        return;
      }
      setState(ack.state);
      // Claim this tab as the one live Host Display for the room -- if
      // another one was already open, it gets bumped to a disabled screen.
      socket.emit("claim_host_display", { roomId });
    }

    if (socket.connected) join();
    socket.on("connect", join);
    socket.on("state_update", (s) => mounted && setState(s));
    socket.on("room_ended", () => mounted && setConnError("This session room has ended."));
    socket.on("host_display_replaced", () => mounted && setReplaced(true));

    return () => {
      mounted = false;
      socket.off("connect", join);
      socket.off("state_update");
      socket.off("room_ended");
      socket.off("host_display_replaced");
    };
  }, [roomId]);

  useEffect(() => {
    function handlePlaybackControl({ action }) {
      const player = playerRef.current;
      if (!player) return;
      if (action === "pause") {
        player.pauseVideo();
      } else if (action === "resume") {
        player.playVideo();
        scheduleInteractionCheck();
      } else if (action === "restart") {
        player.seekTo(0);
        player.playVideo();
        scheduleInteractionCheck();
      }
    }
    socket.on("playback_control", handlePlaybackControl);
    return () => socket.off("playback_control", handlePlaybackControl);
  }, []);

  useEffect(() => {
    if (extensionDetected) return;
    function handleReady() {
      setExtensionDetected(true);
    }
    window.addEventListener("karaoke-pitch-sync-ready", handleReady);
    const interval = setInterval(() => {
      if (document.documentElement.dataset.karaokePitchSync === "installed") {
        setExtensionDetected(true);
      }
    }, 1000);
    const timeout = setTimeout(() => clearInterval(interval), 8000);
    return () => {
      window.removeEventListener("karaoke-pitch-sync-ready", handleReady);
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [extensionDetected]);

  useEffect(() => {
    function handleFullscreenChange() {
      const active = document.fullscreenElement === videoFrameRef.current;
      setIsFullscreen(active);
      if (active) setFullscreenError("");
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
      return;
    }
    setFullscreenError("");
    // Chrome refuses fullscreen while this tab is being captured (which is
    // exactly what the pitch-sync extension does while it's running) --
    // a browser security behavior, not something this page can override.
    // requestFullscreen() rejects rather than throwing, so without this
    // catch it fails completely silently.
    videoFrameRef.current?.requestFullscreen().catch(() => {
      setFullscreenError(
        "Fullscreen was blocked. If Pitch Sync is running, stop it first — Chrome won't fullscreen a tab it's " +
          "capturing. Otherwise, try launching Chrome in kiosk mode instead."
      );
    });
  }

  const handleVideoEnd = useCallback(() => {
    if (!hostToken) return;
    socket.emit("video_ended", { roomId, hostToken });
  }, [roomId, hostToken]);

  if (replaced) {
    return (
      <div className="host-stage">
        <h1 className="display" style={{ fontSize: "2.2rem", color: "var(--text-on-dark)" }}>
          This display was opened elsewhere
        </h1>
        <p className="text-dim">
          Only one Host Display can be active per room at a time. Close this tab, or reopen it from Manage Room to
          take over again.
        </p>
      </div>
    );
  }

  if (connError) {
    return (
      <div className="host-stage">
        <h1 className="display" style={{ color: "var(--danger)" }}>
          {connError}
        </h1>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="host-stage">
        <p className="text-dim">Connecting…</p>
      </div>
    );
  }

  const { room, queue, nowPlaying } = state;

  if (room.status === "paused") {
    return (
      <div className="host-stage">
        <h1 className="display" style={{ fontSize: "2.5rem", color: "var(--accent-on-dark)" }}>
          Room paused
        </h1>
        <p className="text-dim">Your queue and song history are saved.</p>
      </div>
    );
  }

  return (
    <div className="host-stage">
      {!extensionDetected && !extensionNoticeDismissed && (
        <div className="host-extension-notice">
          <span>
            Pitch-sync extension not detected — songs will play at their original key. Load it via{" "}
            <code>chrome://extensions</code> → Developer mode → Load unpacked → select the{" "}
            <code>extension/</code> folder.
          </span>
          <button className="btn btn-secondary" onClick={() => setExtensionNoticeDismissed(true)}>
            Dismiss
          </button>
        </div>
      )}
      {nowPlaying ? (
        <>
          <div className="host-video-frame" ref={videoFrameRef}>
            <YouTube
              videoId={nowPlaying.video_id}
              opts={{
                width: "100%",
                height: "100%",
                playerVars: { autoplay: 1, controls: 1, rel: 0 },
              }}
              onEnd={handleVideoEnd}
              onReady={(e) => {
                playerRef.current = e.target;
                scheduleInteractionCheck();
              }}
              onStateChange={(e) => {
                if (e.data === 1) {
                  reportInteractionStatus(false);
                  if (interactionCheckRef.current) clearTimeout(interactionCheckRef.current);
                }
              }}
              style={{ width: "100%", height: "100%" }}
            />
            {needsInteraction && (
              <button
                className="host-tap-to-play"
                onClick={() => {
                  playerRef.current?.playVideo();
                  reportInteractionStatus(false);
                }}
              >
                ▶ Tap to play
              </button>
            )}
            {fullscreenError && <div className="host-fullscreen-error">{fullscreenError}</div>}
            <button
              className="btn btn-secondary host-fullscreen-btn"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="host-eyebrow">Scan · Search · Sing</p>
          <h1 className="display" style={{ fontSize: "2.6rem", color: "var(--text-on-dark)" }}>
            {queue.length === 0 ? "No song queued — scan to pick one!" : "Get ready…"}
          </h1>
          <QRDisplay url={joinUrl} />
          <p className="text-dim">{joinUrl}</p>
        </>
      )}

      {queue.length > 0 && (
        <div className="host-next-up">
          <p className="text-dim" style={{ marginBottom: 6, fontWeight: 500 }}>
            Up next
          </p>
          <p style={{ margin: 0 }}>{queue[0].title}</p>
        </div>
      )}
    </div>
  );
}
