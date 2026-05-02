"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function Home() {
  const router = useRouter();
  const ambienceRef = useRef<HTMLAudioElement | null>(null);
  const backgroundRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const depthRef = useRef<HTMLDivElement | null>(null);
  const fogRef = useRef<HTMLDivElement | null>(null);
  const lightRef = useRef<HTMLDivElement | null>(null);
  const animationFrame = useRef<number | null>(null);
  const latestScenePosition = useRef({ x: 0, y: 0 });
  const navigationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }

      if (navigationTimeout.current) {
        clearTimeout(navigationTimeout.current);
      }
    };
  }, []);

  const setScenePosition = (x = 0, y = 0) => {
    latestScenePosition.current = { x, y };

    if (animationFrame.current !== null) {
      return;
    }

    animationFrame.current = requestAnimationFrame(() => {
      animationFrame.current = null;
      const { x: latestX, y: latestY } = latestScenePosition.current;
      const backgroundX = latestX * -52;
      const backgroundY = latestY * -34;
      const depthX = latestX * 36;
      const depthY = latestY * 24;
      const lightX = latestX * 64;
      const lightY = latestY * 44;
      const fogX = latestX * 24;
      const fogY = latestY * 16;
      const contentX = latestX * 5;
      const contentY = latestY * 3;

      if (backgroundRef.current) {
        backgroundRef.current.style.transform = `translate3d(${backgroundX}px, ${backgroundY}px, 0) scale(1.16)`;
      }

      if (depthRef.current) {
        depthRef.current.style.transform = `translate3d(${depthX}px, ${depthY}px, 0) scale(1.05)`;
      }

      if (lightRef.current) {
        lightRef.current.style.transform = `translate3d(${lightX}px, ${lightY}px, 0) scale(1.03)`;
      }

      if (fogRef.current) {
        fogRef.current.style.transform = `translate3d(${fogX}px, ${fogY}px, 0) scale(1.04)`;
      }

      if (contentRef.current) {
        contentRef.current.style.transform = `translate3d(calc(-50% + ${contentX}px), calc(-50% + ${contentY}px), 0)`;
      }
    });
  };

  const enterJourney = () => {
    if (isExiting) {
      return;
    }

    setIsExiting(true);
    navigationTimeout.current = setTimeout(() => {
      router.replace("/map");
    }, 720);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const x = event.clientX / window.innerWidth - 0.5;
    const y = event.clientY / window.innerHeight - 0.5;

    setScenePosition(x, y);
  };

  return (
    <main
      className={`landing-scene fixed inset-0 flex items-center justify-center overflow-hidden bg-black text-white ${
        isExiting ? "landing-scene-exiting" : ""
      }`}
      onPointerLeave={() => setScenePosition()}
      onPointerMove={handlePointerMove}
    >
      <div
        className="landing-background pointer-events-none absolute -inset-12 bg-cover bg-center transition-transform duration-700 ease-out will-change-transform"
        ref={backgroundRef}
        style={{
          backgroundImage: "url('/landing-bg.png')",
          transform: "translate3d(0px, 0px, 0) scale(1.16)",
        }}
      />
      <div
        className="landing-depth pointer-events-none absolute -inset-10 mix-blend-screen transition-transform duration-700 ease-out will-change-transform"
        ref={depthRef}
        style={{
          background:
            "radial-gradient(circle at 55% 35%, rgba(255,255,210,0.34), transparent 22%), radial-gradient(circle at 28% 78%, rgba(65,100,60,0.24), transparent 24%)",
          transform: "translate3d(0px, 0px, 0) scale(1.05)",
        }}
      />
      <div
        className="landing-light pointer-events-none absolute -inset-10 transition-transform duration-700 ease-out will-change-transform"
        ref={lightRef}
        style={{
          background:
            "radial-gradient(circle at 50% 42%, rgba(255,245,214,0.16), transparent 27%)",
          transform: "translate3d(0px, 0px, 0) scale(1.03)",
        }}
      />
      <div
        className="landing-fog pointer-events-none absolute inset-0"
        ref={fogRef}
        style={{ transform: "translate3d(0px, 0px, 0) scale(1.04)" }}
      />
      <div className="landing-vignette pointer-events-none absolute inset-0" />
      <audio
        aria-hidden="true"
        preload="none"
        ref={ambienceRef}
      />
      <div
        className="landing-content absolute left-1/2 top-1/2 w-full max-w-2xl px-6 text-center transition-transform duration-700 ease-out will-change-transform"
        ref={contentRef}
      >
        <p className="landing-kicker text-xs font-semibold uppercase tracking-[0.42em] text-amber-100/70">
          Rejsen begynder her
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-6xl">
          <span className="landing-title-line block">Velkommen</span>
          <span className="landing-title-line landing-title-line-delayed block text-amber-100">
            CT&apos;er
          </span>
        </h1>
        <button
          className="landing-enter group relative mt-10 rounded-full border border-amber-100/35 bg-black/30 px-8 py-4 text-xs font-semibold uppercase tracking-[0.32em] text-amber-50 shadow-2xl shadow-amber-200/10 backdrop-blur-md transition duration-500 hover:scale-105 hover:border-amber-100/70 hover:bg-amber-100/10 focus:outline-none focus:ring-2 focus:ring-amber-100/70"
          onClick={enterJourney}
          type="button"
        >
          <span className="absolute inset-0 rounded-full bg-amber-100/10 opacity-0 blur-xl transition duration-500 group-hover:opacity-100" />
          <span className="relative">Start rejsen</span>
        </button>
      </div>
    </main>
  );
}
