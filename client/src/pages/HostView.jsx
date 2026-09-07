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
        <h1 className="display" style={{ fontSize: "2.5rem", color: "var(--spotlight)" }}>
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
              {isFullscreen ? "⤡ Exit fullscreen" : "⛶ Fullscreen"}
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
          <h1 className="display" style={{ fontSize: "2.6rem", color: "var(--spotlight)" }}>
            {queue.length === 0 ? "No song queued — scan to pick one!" : "Get ready…"}
          </h1>
          <QRDisplay url={joinUrl} />
          <p className="text-dim">{joinUrl}</p>
        </>
      )}

      {queue.length > 0 && (
        <div className="host-next-up">
          <p className="text-dim" style={{ marginBottom: 6, fontWeight: 600 }}>
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
