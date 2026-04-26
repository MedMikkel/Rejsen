"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VideoPlayer } from "@/components/VideoPlayer";

type VideoOverlayProps = {
  src: string;
  onClose: () => void;
  onEnded: () => void;
};

export function VideoOverlay({ src, onClose, onEnded }: VideoOverlayProps) {
  const [hasVideoError, setHasVideoError] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimeout.current) {
        clearTimeout(closeTimeout.current);
      }
    };
  }, []);

  const fadeOutThen = useCallback(
    (callback: () => void) => {
      if (isClosing) {
        return;
      }

      setIsClosing(true);
      closeTimeout.current = setTimeout(callback, 360);
    },
    [isClosing],
  );

  return (
    <div
      className={`video-overlay fixed inset-0 z-50 flex items-center justify-center bg-black px-6 text-white ${
        isClosing ? "video-overlay-closing" : ""
      }`}
    >
      {hasVideoError ? (
        <div className="max-w-md text-center">
          <p className="text-lg font-medium">Videoen kunne ikke indlæses.</p>
          <p className="mt-2 text-sm text-white/60">
            Filen findes muligvis ikke endnu.
          </p>
          <button
            className="mt-6 rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-medium uppercase tracking-[0.2em] text-white transition hover:scale-105 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/70"
            onClick={() => fadeOutThen(onClose)}
            type="button"
          >
            Tilbage til kortet
          </button>
        </div>
      ) : (
        <VideoPlayer
          className="max-h-full max-w-full transition-opacity duration-300"
          onEnd={() => fadeOutThen(onEnded)}
          onError={() => setHasVideoError(true)}
          src={src}
        />
      )}
    </div>
  );
}
