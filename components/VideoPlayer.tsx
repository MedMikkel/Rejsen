"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent, PointerEvent } from "react";

type VideoPlayerProps = {
  src: string;
  onEnd: () => void;
  className?: string;
  onError?: () => void;
};

const CONTROL_IDLE_DELAY = 1800;
const DEFAULT_VOLUME = 0.8;

function formatVideoTime(value: number) {
  if (!Number.isFinite(value)) {
    return "0:00";
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
}

export function VideoPlayer({
  src,
  onEnd,
  className = "",
  onError,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onErrorRef = useRef(onError);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialPlaybackSource = useRef<string | null>(null);
  const [playbackState, setPlaybackState] = useState({
    hasError: false,
    isReady: false,
    needsUserStart: false,
    src,
  });
  const [controlsVisible, setControlsVisible] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const isCurrentSource = playbackState.src === src;
  const isReady = isCurrentSource && playbackState.isReady;
  const hasError = isCurrentSource && playbackState.hasError;
  const needsUserStart = isCurrentSource && playbackState.needsUserStart;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const effectiveVolume = isMuted ? 0 : volume;
  const controlsAreVisible = isReady && (controlsVisible || isScrubbing || needsUserStart);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    const controller = new AbortController();

    fetch(src, { method: "HEAD", signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          setPlaybackState({
            hasError: true,
            isReady: true,
            needsUserStart: false,
            src,
          });
          onErrorRef.current?.();
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        console.warn("Video source check failed", error);
      });

    return () => {
      controller.abort();

      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
    };
  }, [src]);

  const scheduleControlsHide = () => {
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
    }

    controlsTimeout.current = setTimeout(() => {
      setControlsVisible(false);
    }, CONTROL_IDLE_DELAY);
  };

  const revealControls = () => {
    setControlsVisible(true);
    scheduleControlsHide();
  };

  const requestPlayback = (forceMuted = false) => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.volume = volume;
    video.muted = forceMuted || volume === 0;
    setIsMuted(video.muted);

    const playPromise = video.play();

    if (!playPromise) {
      return;
    }

    playPromise
      .then(() => {
        setIsPlaying(true);
        setPlaybackState((currentState) =>
          currentState.src === src
            ? { ...currentState, needsUserStart: false }
            : currentState,
        );
      })
      .catch(() => {
        setPlaybackState({
          hasError: false,
          isReady: true,
          needsUserStart: true,
          src,
        });
      });
  };

  const requestInitialPlayback = () => {
    if (initialPlaybackSource.current === src) {
      return;
    }

    initialPlaybackSource.current = src;
    requestPlayback(false);
  };

  const handlePlaying = () => {
    setIsPlaying(true);
    setPlaybackState({
      hasError: false,
      isReady: true,
      needsUserStart: false,
      src,
    });
  };

  const handleError = () => {
    setPlaybackState({
      hasError: true,
      isReady: true,
      needsUserStart: false,
      src,
    });
    onErrorRef.current?.();
  };

  const togglePlayback = () => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    revealControls();

    if (video.paused || video.ended) {
      requestPlayback(false);
      return;
    }

    video.pause();
  };

  const seekToPointer = (clientX: number, target: HTMLElement) => {
    const video = videoRef.current;

    if (!video || !Number.isFinite(video.duration)) {
      return;
    }

    const bounds = target.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - bounds.left) / bounds.width, 0), 1);
    const nextTime = video.duration * ratio;

    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleProgressPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsScrubbing(true);
    revealControls();
    seekToPointer(event.clientX, event.currentTarget);
  };

  const handleProgressPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) {
      return;
    }

    seekToPointer(event.clientX, event.currentTarget);
  };

  const handleProgressPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setIsScrubbing(false);
    scheduleControlsHide();
  };

  const handleProgressKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const video = videoRef.current;

    if (!video || !Number.isFinite(video.duration)) {
      return;
    }

    const step = event.key === "ArrowLeft" ? -5 : event.key === "ArrowRight" ? 5 : 0;

    if (step === 0) {
      return;
    }

    event.preventDefault();
    const nextTime = Math.min(Math.max(video.currentTime + step, 0), video.duration);
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
    revealControls();
  };

  const handleVolumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextVolume = Number(event.target.value);
    const video = videoRef.current;

    setVolume(nextVolume);
    setIsMuted(nextVolume === 0);

    if (video) {
      video.volume = nextVolume;
      video.muted = nextVolume === 0;
    }

    revealControls();
  };

  const toggleMuted = () => {
    const video = videoRef.current;
    const nextMuted = !(video?.muted ?? isMuted);

    setIsMuted(nextMuted);

    if (video) {
      video.muted = nextMuted;
      video.volume = volume;
    }

    revealControls();
  };

  const handleEnded = () => {
    setIsPlaying(false);
    onEnd();
  };

  if (hasError) {
    return (
      <p className="text-center text-sm font-medium text-white/70">
        Videoen kunne ikke indlæses.
      </p>
    );
  }

  return (
    <div
      className="relative flex max-h-full max-w-full items-center justify-center"
      onFocus={revealControls}
      onMouseEnter={revealControls}
      onMouseLeave={scheduleControlsHide}
      onMouseMove={revealControls}
    >
      {!isReady ? (
        <div className="absolute flex flex-col items-center gap-3 text-sm font-medium text-white/60">
          <span className="h-8 w-8 animate-spin rounded-full border border-white/20 border-t-white/80" />
          <p>Indlæser video...</p>
        </div>
      ) : null}
      {needsUserStart ? (
        <button
          className="absolute rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-medium uppercase tracking-[0.2em] text-white backdrop-blur transition hover:scale-105 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/70"
          onClick={() => requestPlayback(false)}
          type="button"
        >
          Tryk for at starte video
        </button>
      ) : null}
      <video
        autoPlay
        className={`${className} ${isReady ? "opacity-100" : "opacity-0"}`}
        key={src}
        muted={isMuted}
        onCanPlay={() => {
          setPlaybackState({
            hasError: false,
            isReady: true,
            needsUserStart: false,
            src,
          });
          requestInitialPlayback();
        }}
        onClick={togglePlayback}
        onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
        onEnded={handleEnded}
        onError={handleError}
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration || 0);
          requestInitialPlayback();
        }}
        onPause={() => setIsPlaying(false)}
        onPlaying={handlePlaying}
        onTimeUpdate={(event) => {
          if (!isScrubbing) {
            setCurrentTime(event.currentTarget.currentTime);
          }
        }}
        onVolumeChange={(event) => {
          setIsMuted(event.currentTarget.muted);
          setVolume(event.currentTarget.volume);
        }}
        playsInline
        preload="metadata"
        ref={videoRef}
        src={src}
      />
      <div
        className={`absolute inset-x-4 bottom-4 rounded-3xl border border-white/10 bg-black/35 px-4 py-3 text-white shadow-2xl shadow-black/40 backdrop-blur-md transition duration-300 ${
          controlsAreVisible
            ? "opacity-100"
            : "pointer-events-none translate-y-2 opacity-0"
        }`}
      >
        <div
          aria-label="Video tidslinje"
          aria-valuemax={Math.round(duration)}
          aria-valuemin={0}
          aria-valuenow={Math.round(currentTime)}
          className="group flex h-5 cursor-pointer items-center"
          onKeyDown={handleProgressKeyDown}
          onPointerDown={handleProgressPointerDown}
          onPointerMove={handleProgressPointerMove}
          onPointerUp={handleProgressPointerUp}
          role="slider"
          tabIndex={0}
        >
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white/85 shadow-[0_0_16px_rgba(255,255,255,0.35)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs font-medium text-white/75">
          <button
            aria-label={isPlaying ? "Pause video" : "Afspil video"}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-sm text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60"
            onClick={togglePlayback}
            type="button"
          >
            {isPlaying ? "II" : "▶"}
          </button>
          <span className="min-w-20 tabular-nums">
            {formatVideoTime(currentTime)} / {formatVideoTime(duration)}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              aria-label={isMuted ? "Slå lyd til" : "Slå lyd fra"}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60"
              onClick={toggleMuted}
              type="button"
            >
              {isMuted || effectiveVolume === 0 ? "×" : "♪"}
            </button>
            <input
              aria-label="Lydstyrke"
              className="h-1.5 w-24 cursor-pointer accent-white"
              max={1}
              min={0}
              onChange={handleVolumeChange}
              onInput={handleVolumeChange}
              step={0.01}
              type="range"
              value={effectiveVolume}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
