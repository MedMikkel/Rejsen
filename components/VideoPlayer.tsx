"use client";

import { useEffect, useRef, useState } from "react";

type VideoPlayerProps = {
  src: string;
  onEnd: () => void;
  className?: string;
  onError?: () => void;
};

export function VideoPlayer({
  src,
  onEnd,
  className = "",
  onError,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onErrorRef = useRef(onError);
  const unmuteTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playbackState, setPlaybackState] = useState({
    hasError: false,
    isReady: false,
    needsUserStart: false,
    src,
  });
  const isCurrentSource = playbackState.src === src;
  const isReady = isCurrentSource && playbackState.isReady;
  const hasError = isCurrentSource && playbackState.hasError;
  const needsUserStart = isCurrentSource && playbackState.needsUserStart;

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

      if (unmuteTimeout.current) {
        clearTimeout(unmuteTimeout.current);
      }
    };
  }, [src]);

  const requestPlayback = () => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.muted = true;
    const playPromise = video.play();

    if (!playPromise) {
      return;
    }

    playPromise
      .then(() => {
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

  const handlePlaying = () => {
    if (unmuteTimeout.current) {
      clearTimeout(unmuteTimeout.current);
    }

    setPlaybackState({
      hasError: false,
      isReady: true,
      needsUserStart: false,
      src,
    });

    unmuteTimeout.current = setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.muted = false;
      }
    }, 400);
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

  if (hasError) {
    return (
      <p className="text-center text-sm font-medium text-white/70">
        Videoen kunne ikke indlæses.
      </p>
    );
  }

  return (
    <>
      {!isReady ? (
        <div className="absolute flex flex-col items-center gap-3 text-sm font-medium text-white/60">
          <span className="h-8 w-8 animate-spin rounded-full border border-white/20 border-t-white/80" />
          <p>Indlæser video...</p>
        </div>
      ) : null}
      {needsUserStart ? (
        <button
          className="absolute rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-medium uppercase tracking-[0.2em] text-white backdrop-blur transition hover:scale-105 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/70"
          onClick={requestPlayback}
          type="button"
        >
          Tryk for at starte video
        </button>
      ) : null}
      <video
        autoPlay
        className={`${className} ${isReady ? "opacity-100" : "opacity-0"}`}
        muted
        onCanPlay={() => {
          setPlaybackState({
            hasError: false,
            isReady: true,
            needsUserStart: false,
            src,
          });
          requestPlayback();
        }}
        onEnded={onEnd}
        onError={handleError}
        onLoadedMetadata={requestPlayback}
        onPlaying={handlePlaying}
        playsInline
        preload="metadata"
        ref={videoRef}
        src={src}
      />
    </>
  );
}
