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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [extensionDetected, setExtensionDetected] = useState(
    () => document.documentElement.dataset.karaokePitchSync === "installed"
  );
  const [extensionNoticeDismissed, setExtensionNoticeDismissed] = useState(false);

  const playerRef = useRef(null);
  const videoFrameRef = useRef(null);

  const joinUrl = `${window.location.origin}/join/${roomId}`;

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
    }

    if (socket.connected) join();
    socket.on("connect", join);
    socket.on("state_update", (s) => mounted && setState(s));
    socket.on("room_ended", () => mounted && setConnError("This session room has ended."));

    return () => {
      mounted = false;
      socket.off("connect", join);
      socket.off("state_update");
      socket.off("room_ended");
    };
  }, [roomId]);

  // Live remote control from the admin panel (pause/resume/restart the
  // actual player in place) -- a transient signal, not part of state_update.
  useEffect(() => {
    function handlePlaybackControl({ action }) {
      const player = playerRef.current;
      if (!player) return;
      if (action === "pause") player.pauseVideo();
      else if (action === "resume") player.playVideo();
      else if (action === "restart") {
        player.seekTo(0);
        player.playVideo();
      }
    }
    socket.on("playback_control", handlePlaybackControl);
    return () => socket.off("playback_control", handlePlaybackControl);
  }, []);

  // A website can't install a Chrome extension itself -- the best it can
  // do is detect one that's already installed (via the tiny content
  // script it injects into this page, see extension/content-detect.js)
  // and prompt the host to set it up manually if it's missing.
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
      setIsFullscreen(document.fullscreenElement === videoFrameRef.current);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      videoFrameRef.current?.requestFullscreen();
    }
  }

  const handleVideoEnd = useCallback(() => {
    if (!hostToken) return;
    socket.emit("video_ended", { roomId, hostToken });
  }, [roomId, hostToken]);

  const handleSkip = () => {
    if (!hostToken) return;
    socket.emit("skip_current", { roomId, hostToken });
  };

  const handlePause = () => {
    if (!hostToken) return;
    socket.emit("pause_room", { roomId, hostToken });
  };

  const handleResume = () => {
    if (!hostToken) return;
    socket.emit("resume_room", { roomId, hostToken });
  };

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
        <button className="btn btn-primary" onClick={handleResume}>
          Resume
        </button>
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
              }}
              style={{ width: "100%", height: "100%" }}
            />
            <button
              className="btn btn-secondary host-fullscreen-btn"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            </button>
          </div>
          <div className="row">
            <span className="pill pill-energy">
              Pitch {nowPlaying.pitch_semitones > 0 ? "+" : ""}
              {nowPlaying.pitch_semitones}
            </span>
            {nowPlaying.added_by && <span className="pill">Picked by {nowPlaying.added_by}</span>}
          </div>
          {hostToken && (
            <button className="btn btn-secondary" onClick={handleSkip}>
              Skip song
            </button>
          )}
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

      {hostToken && room.type === "permanent" && (
        <button
          className="btn btn-secondary"
          style={{ position: "fixed", top: 20, right: 20 }}
          onClick={handlePause}
        >
          Pause room (end for tonight)
        </button>
      )}
    </div>
  );
}
