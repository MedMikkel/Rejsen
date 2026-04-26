"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { videos } from "@/lib/videos";

export default function Home() {
  const router = useRouter();
  const backgroundRef = useRef<HTMLDivElement | null>(null);
  const depthRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const animationFrame = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, []);

  const setScenePosition = (x = 0, y = 0) => {
    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
    }

    animationFrame.current = requestAnimationFrame(() => {
      const moveX = x * 34;
      const moveY = y * 22;

      if (backgroundRef.current) {
        backgroundRef.current.style.transform = `translate3d(${-moveX}px, ${-moveY}px, 0) scale(1.14)`;
      }

      if (depthRef.current) {
        depthRef.current.style.transform = `translate3d(${moveX * 0.55}px, ${moveY * 0.45}px, 0) scale(1.04)`;
      }

      if (contentRef.current) {
        contentRef.current.style.transform = `translate3d(${moveX * 0.18}px, ${moveY * 0.12}px, 0)`;
      }
    });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const x = event.clientX / window.innerWidth - 0.5;
    const y = event.clientY / window.innerHeight - 0.5;

    setScenePosition(x, y);
  };

  return (
    <main
      className="fixed inset-0 flex items-center justify-center overflow-hidden bg-black text-white"
      onPointerLeave={() => setScenePosition()}
      onPointerMove={handlePointerMove}
    >
      <div
        className="pointer-events-none absolute -inset-12 bg-cover bg-center transition-transform duration-500 ease-out will-change-transform"
        ref={backgroundRef}
        style={{
          backgroundImage: "url('/landing-bg.png')",
          transform: "translate3d(0px, 0px, 0) scale(1.14)",
        }}
      />
      <div
        className="pointer-events-none absolute -inset-10 opacity-60 mix-blend-screen transition-transform duration-500 ease-out will-change-transform"
        ref={depthRef}
        style={{
          background:
            "radial-gradient(circle at 55% 35%, rgba(255,255,210,0.34), transparent 22%), radial-gradient(circle at 28% 78%, rgba(65,100,60,0.24), transparent 24%)",
          transform: "translate3d(0px, 0px, 0) scale(1.04)",
        }}
      />
      <video
        autoPlay
        className="pointer-events-none relative h-full w-full object-cover opacity-30"
        muted
        onEnded={() => router.replace("/map")}
        playsInline
        preload="metadata"
        src={videos.intro}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/40" />
      <div
        className="absolute bottom-10 left-1/2 w-full max-w-xl -translate-x-1/2 px-6 text-center transition-transform duration-500 ease-out will-change-transform"
        ref={contentRef}
      >
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
          Velkommen CT&apos;er
        </h1>
        <button
          className="mt-8 rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-medium uppercase tracking-[0.25em] text-white backdrop-blur transition hover:scale-105 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/70"
          onClick={() => router.replace("/map")}
          type="button"
        >
          Gå til kortet
        </button>
      </div>
    </main>
  );
}
