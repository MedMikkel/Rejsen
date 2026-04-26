"use client";

import {
  memo,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { videos } from "@/lib/videos";

const VideoOverlay = dynamic(
  () => import("./VideoOverlay").then((mod) => mod.VideoOverlay),
  {
    ssr: false,
  },
);

type Point = {
  x: number;
  y: number;
};

type Size = {
  width: number;
  height: number;
};

type Location = {
  id: string;
  name: string;
  x: number;
  y: number;
  unlocked: boolean;
  videoSrc: string;
};

type Connection = {
  from: string;
  to: string;
};

type PathState = "locked" | "active" | "visited";
type DiscoveryPointType =
  | "faxeCan"
  | "calendarArtifact"
  | "instantMove";

type DiscoveryPoint = {
  id: string;
  x: number;
  y: number;
  type: DiscoveryPointType;
  content: string;
};

const locations: Location[] = [
  {
    id: "western-harbor",
    name: "Start her",
    x: 16,
    y: 62,
    unlocked: true,
    videoSrc: videos.location1,
  },
  {
    id: "mountain-pass",
    name: "At turde tage springet",
    x: 30,
    y: 40,
    unlocked: false,
    videoSrc: videos.location2,
  },
  {
    id: "central-crossroads",
    name: "Når festen falmer",
    x: 48,
    y: 48,
    unlocked: false,
    videoSrc: videos.location3,
  },
  {
    id: "eastern-watch",
    name: "Eastern Watch",
    x: 70,
    y: 34,
    unlocked: false,
    videoSrc: videos.location4,
  },
  {
    id: "southern-isle",
    name: "Southern Isle",
    x: 50,
    y: 78,
    unlocked: false,
    videoSrc: videos.location5,
  },
  {
    id: "final-sanctum",
    name: "Final Sanctum",
    x: 62,
    y: 58,
    unlocked: false,
    videoSrc: videos.finale,
  },
];

const connections: Connection[] = [
  { from: "western-harbor", to: "mountain-pass" },
  { from: "mountain-pass", to: "central-crossroads" },
  { from: "central-crossroads", to: "eastern-watch" },
  { from: "eastern-watch", to: "southern-isle" },
  { from: "southern-isle", to: "final-sanctum" },
];

const discoveryPoints: DiscoveryPoint[] = [
  {
    id: "pink-mode-artifact",
    x: 40,
    y: 73,
    type: "faxeCan",
    content: "Du fandt en gemt Faxe Kondi. Kortet skifter farve.",
  },
  {
    id: "calendar-artifact",
    x: 56,
    y: 26,
    type: "calendarArtifact",
    content: "Jeg kan alle datoer",
  },
  {
    id: "instant-move",
    x: 71,
    y: 77,
    type: "instantMove",
    content: videos.instantMove,
  },
];

const getConnectionId = (connection: Connection) =>
  `${connection.from}-${connection.to}`;

const MARKER_FEEDBACK_MS = 220;
const PATH_IGNITE_MS = 900;
const MAP_CAMERA_SCALE = 1.75;
const PINK_MODE_DISCOVERY_POINT_ID = "pink-mode-artifact";

const FINAL_LOCATION_ID = "final-sanctum";
const requiredLocationIds = locations
  .filter((location) => location.id !== FINAL_LOCATION_ID)
  .map((location) => location.id);

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const getCameraTransform = (cameraOffset: Point) =>
  `translate3d(${cameraOffset.x}px, ${cameraOffset.y}px, 0) scale(${MAP_CAMERA_SCALE})`;

const getCameraBounds = (containerSize: Size) => {
  const maxX = ((MAP_CAMERA_SCALE - 1) * containerSize.width) / 2;
  const maxY = ((MAP_CAMERA_SCALE - 1) * containerSize.height) / 2;

  return {
    maxX,
    maxY,
    minX: -maxX,
    minY: -maxY,
  };
};

const clampCameraOffset = (cameraOffset: Point, containerSize: Size): Point => {
  const bounds = getCameraBounds(containerSize);

  return {
    x: clamp(cameraOffset.x, bounds.minX, bounds.maxX),
    y: clamp(cameraOffset.y, bounds.minY, bounds.maxY),
  };
};

const getCameraOffsetForLocation = (
  location: Location,
  containerSize: Size,
): Point =>
  clampCameraOffset(
    {
      x: -MAP_CAMERA_SCALE * ((location.x / 100 - 0.5) * containerSize.width),
      y: -MAP_CAMERA_SCALE * ((location.y / 100 - 0.5) * containerSize.height),
    },
    containerSize,
  );

type EnergyPathProps = {
  containerSize: Size;
  from: Location;
  pathState: PathState;
  to: Location;
};

const EnergyPath = memo(function EnergyPath({
  containerSize,
  from,
  pathState,
  to,
}: EnergyPathProps) {
  const x1 = (from.x / 100) * containerSize.width;
  const y1 = (from.y / 100) * containerSize.height;
  const x2 = (to.x / 100) * containerSize.width;
  const y2 = (to.y / 100) * containerSize.height;
  const deltaX = x2 - x1;
  const deltaY = y2 - y1;
  const length = Math.sqrt(deltaX ** 2 + deltaY ** 2);
  const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

  if (!containerSize.width || !containerSize.height) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="energy-path-shell"
      style={{
        left: `${x1}px`,
        top: `${y1}px`,
        transform: `rotate(${angle}deg)`,
        width: `${length}px`,
      }}
    >
      <div className={`energy-path energy-path-${pathState}`} />
    </div>
  );
});

type DiscoveryPointMarkerProps = {
  discoveryPoint: DiscoveryPoint;
  onOpen: (discoveryPointId: string) => void;
};

const DiscoveryPointMarker = memo(function DiscoveryPointMarker({
  discoveryPoint,
  onOpen,
}: DiscoveryPointMarkerProps) {
  return (
    <button
      aria-label={`Åbn discovery point: ${discoveryPoint.type}`}
      className={`discovery-point-marker discovery-point-${discoveryPoint.type} discovery-point-${discoveryPoint.id}`}
      onClick={() => onOpen(discoveryPoint.id)}
      onPointerDown={(event) => event.stopPropagation()}
      style={{
        left: `${discoveryPoint.x}%`,
        top: `${discoveryPoint.y}%`,
      }}
      type="button"
    >
      {discoveryPoint.type === "calendarArtifact" ? (
        <span aria-hidden="true" className="discovery-point-calendar-icon">
          <span className="discovery-point-calendar-binding" />
        </span>
      ) : null}
      {discoveryPoint.type === "instantMove" ? (
        <span aria-hidden="true" className="discovery-point-slate-icon">
          <span className="discovery-point-slate-top" />
          <span className="discovery-point-slate-body" />
        </span>
      ) : null}
      {discoveryPoint.type === "faxeCan" ? (
        <span aria-hidden="true" className="discovery-point-can-icon">
          <span className="discovery-point-can-top" />
          <span className="discovery-point-can-tab" />
          <span className="discovery-point-can-body" />
          <span className="discovery-point-can-bottom" />
        </span>
      ) : null}
      <span className="sr-only">{discoveryPoint.content}</span>
    </button>
  );
});

type LocationMarkerProps = {
  isFinalLocation: boolean;
  isNextAvailable: boolean;
  isOpening: boolean;
  isStartLocation: boolean;
  isStartPromptVisible: boolean;
  isUnlocked: boolean;
  isVisited: boolean;
  location: Location;
  onOpen: (locationId: string) => void;
};

const LocationMarker = memo(function LocationMarker({
  isFinalLocation,
  isNextAvailable,
  isOpening,
  isStartLocation,
  isStartPromptVisible,
  isUnlocked,
  isVisited,
  location,
  onOpen,
}: LocationMarkerProps) {
  return (
    <button
      aria-label={
        isUnlocked ? `Open ${location.name}` : `${location.name} is locked`
      }
      className={`group absolute z-10 -translate-x-1/2 -translate-y-1/2 ${
        isUnlocked
          ? "cursor-pointer"
          : "cursor-not-allowed"
      }`}
      disabled={!isUnlocked}
      onClick={() => {
        if (isUnlocked) {
          onOpen(location.id);
        }
      }}
      onPointerDown={(event) => {
        if (isUnlocked) {
          event.stopPropagation();
        }
      }}
      style={{
        left: `${location.x}%`,
        top: `${location.y}%`,
      }}
      type="button"
    >
      <span className="sr-only">{location.videoSrc}</span>
      {isStartLocation && !isVisited ? (
        <span aria-hidden="true" className="start-marker-ripples">
          <span className="start-marker-ripple start-marker-ripple-1" />
          <span className="start-marker-ripple start-marker-ripple-2" />
          <span className="start-marker-ripple start-marker-ripple-3" />
        </span>
      ) : null}
      <span
        className={`location-marker-dot block h-4 w-4 rounded-full border-2 border-[#2d2114] transition duration-300 sm:h-5 sm:w-5 ${
          isUnlocked
            ? isStartLocation && !isVisited
              ? "location-marker-start h-6 w-6 border-yellow-50 bg-yellow-200 shadow-[0_0_28px_rgba(250,204,21,0.9)] ring-4 ring-yellow-100/70 group-hover:scale-110 group-hover:bg-yellow-100 group-focus:outline-none group-focus:ring-4 group-focus:ring-yellow-50 sm:h-7 sm:w-7"
              : isFinalLocation
              ? "location-marker-final h-6 w-6 border-yellow-100 bg-yellow-200 shadow-[0_0_24px_rgba(253,224,71,0.85)] ring-4 ring-yellow-200/50 group-hover:scale-110 group-hover:bg-yellow-100 group-focus:outline-none group-focus:ring-4 group-focus:ring-yellow-100/90 sm:h-7 sm:w-7"
              : "location-marker-unlocked bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.55)] group-hover:scale-110 group-hover:bg-amber-200 group-hover:shadow-[0_0_22px_rgba(252,211,77,0.78)] group-focus:outline-none group-focus:ring-4 group-focus:ring-amber-100/80"
            : "location-marker-locked bg-zinc-500 opacity-35 grayscale shadow-[0_0_8px_rgba(0,0,0,0.35)]"
        } ${isVisited ? "ring-2 ring-emerald-300" : ""} ${
          isOpening ? "scale-150 bg-amber-100 ring-4 ring-amber-100/80" : ""
        } ${isNextAvailable ? "map-marker-pulse" : ""}`}
      />
      <span
        className={`pointer-events-none absolute left-1/2 top-7 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/20 bg-black/75 px-3 py-1 text-xs font-medium text-white shadow-lg transition duration-200 group-hover:translate-y-1 group-hover:opacity-100 group-focus:translate-y-1 group-focus:opacity-100 ${
          isStartPromptVisible ? "translate-y-1 opacity-100" : "opacity-0"
        }`}
      >
        {location.name}
      </span>
    </button>
  );
});

type DiscoveryPointOverlayProps = {
  discoveryPoint: DiscoveryPoint;
  onClose: () => void;
};

const discoveryPointTypeLabels: Record<DiscoveryPointType, string> = {
  calendarArtifact: "Kalender",
  faxeCan: "Faxe Kondi",
  instantMove: "Instant move",
};

type CalendarArtifactOverlayProps = {
  onClose: () => void;
};

const CalendarArtifactOverlay = memo(function CalendarArtifactOverlay({
  onClose,
}: CalendarArtifactOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-[45] flex items-center justify-center bg-black/55 px-6 text-white"
      onClick={onClose}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        aria-label="Skjult kalenderbesked"
        className="calendar-artifact-panel relative w-full max-w-md overflow-hidden rounded-3xl border border-amber-100/30 bg-[#24190f]/90 p-7 text-center shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <span aria-hidden="true" className="calendar-artifact-fold calendar-artifact-fold-left" />
        <span aria-hidden="true" className="calendar-artifact-fold calendar-artifact-fold-right" />
        <div className="relative z-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-100/35 bg-amber-100/10 shadow-[0_0_28px_rgba(251,191,36,0.22)]">
            <span className="h-7 w-7 rounded-md border border-amber-100/70 bg-amber-100/15">
              <span className="mt-1 block h-1 border-b border-amber-100/60" />
            </span>
          </div>
          <p className="calendar-artifact-kicker mt-5 text-xs font-semibold uppercase tracking-[0.32em] text-amber-100/70">
            Fleksibel artefakt
          </p>
          <p className="sr-only">Jeg kan alle datoer</p>
          <p
            aria-hidden="true"
            className="mt-5 text-3xl font-semibold tracking-wide text-amber-50 sm:text-4xl"
          >
            <span className="calendar-artifact-word calendar-artifact-word-1">
              Jeg
            </span>{" "}
            <span className="calendar-artifact-word calendar-artifact-word-2">
              kan
            </span>{" "}
            <span className="calendar-artifact-word calendar-artifact-word-3">
              alle
            </span>{" "}
            <span className="calendar-artifact-word calendar-artifact-word-4">
              datoer
            </span>
          </p>
          <button
            className="calendar-artifact-close mt-7 rounded-full border border-amber-100/25 bg-amber-100/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-50 transition hover:scale-105 hover:bg-amber-100/20 focus:outline-none focus:ring-2 focus:ring-amber-100/70"
            onClick={onClose}
            type="button"
          >
            Fold sammen
          </button>
        </div>
      </div>
    </div>
  );
});

type InstantMoveOverlayProps = {
  onClose: () => void;
  src: string;
};

const InstantMoveOverlay = memo(function InstantMoveOverlay({
  onClose,
  src,
}: InstantMoveOverlayProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const closeTimeout = setTimeout(onClose, 5000);
    const video = videoRef.current;

    video?.play().catch(() => {});

    return () => {
      clearTimeout(closeTimeout);
    };
  }, [onClose]);

  return (
    <div className="instant-move-overlay fixed inset-0 z-[55] flex items-center justify-center bg-black/75 p-6">
      <video
        autoPlay
        className="instant-move-video max-h-full max-w-full rounded-3xl object-contain shadow-2xl"
        muted
        onEnded={onClose}
        playsInline
        preload="metadata"
        ref={videoRef}
        src={src}
      />
    </div>
  );
});

const DiscoveryPointOverlay = memo(function DiscoveryPointOverlay({
  discoveryPoint,
  onClose,
}: DiscoveryPointOverlayProps) {
  if (discoveryPoint.type === "calendarArtifact") {
    return <CalendarArtifactOverlay onClose={onClose} />;
  }

  if (discoveryPoint.type === "instantMove") {
    return <InstantMoveOverlay onClose={onClose} src={discoveryPoint.content} />;
  }

  return (
    <div
      className="fixed inset-0 z-[45] flex items-center justify-center bg-black/35 px-6 text-white"
      onClick={onClose}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        className="discovery-point-overlay max-w-sm rounded-3xl border border-white/20 bg-black/75 p-6 text-center shadow-2xl backdrop-blur"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-200/80">
          {discoveryPointTypeLabels[discoveryPoint.type]}
        </p>
        <p className="mt-4 text-base leading-relaxed text-white/90">
          {discoveryPoint.content}
        </p>
        <button
          className="mt-6 rounded-full border border-white/25 bg-white/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:scale-105 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/70"
          onClick={onClose}
          type="button"
        >
          Tilbage
        </button>
      </div>
    </div>
  );
});

type MapLayerProps = {
  activeConnectionId: string | null;
  isInteractionDisabled: boolean;
  mapContentRef: RefObject<HTMLDivElement | null>;
  mapContentSize: Size;
  mapLayerRef: RefObject<HTMLDivElement | null>;
  nextAvailableLocationId: string | undefined;
  onOpenLocation: (locationId: string) => void;
  openingLocationId: string | null;
  revealedConnectionIdSet: Set<string>;
  unlockedLocationIdSet: Set<string>;
  visitedLocationIdSet: Set<string>;
};

const MapLayer = memo(function MapLayer({
  activeConnectionId,
  isInteractionDisabled,
  mapContentRef,
  mapContentSize,
  mapLayerRef,
  nextAvailableLocationId,
  onOpenLocation,
  openingLocationId,
  revealedConnectionIdSet,
  unlockedLocationIdSet,
  visitedLocationIdSet,
}: MapLayerProps) {
  const locationById = useMemo(
    () => new Map(locations.map((location) => [location.id, location])),
    [],
  );

  return (
    <div
      className={`absolute inset-0 h-full w-full will-change-transform ${
        isInteractionDisabled ? "pointer-events-none" : ""
      }`}
      ref={mapLayerRef}
      style={{
        transform: getCameraTransform({ x: 0, y: 0 }),
        transformOrigin: "center",
      }}
    >
      <div className="map-video-zoom-layer absolute inset-0 transition-transform duration-700 ease-out will-change-transform">
        <div
          className="relative h-full w-full overflow-hidden"
          ref={mapContentRef}
        >
          <Image
            alt=""
            className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover select-none"
            draggable={false}
            fill
            priority
            sizes="100vw"
            src="/map.png"
          />
          <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_center,transparent_42%,rgba(0,0,0,0.2)_72%,rgba(0,0,0,0.48)_100%)]" />
          <div
            aria-hidden="true"
            className="map-illustration-title pointer-events-none absolute left-[45%] top-[11%] z-[3] select-none"
          >
            Sommertutorland
          </div>
          {connections.map((connection) => {
            const fromLocation = locationById.get(connection.from);
            const toLocation = locationById.get(connection.to);

            if (!fromLocation || !toLocation) {
              return null;
            }

            const connectionId = getConnectionId(connection);
            const pathState: PathState =
              activeConnectionId === connectionId
                ? "active"
                : revealedConnectionIdSet.has(connectionId)
                  ? "visited"
                  : "locked";

            return (
              <EnergyPath
                containerSize={mapContentSize}
                from={fromLocation}
                key={connectionId}
                pathState={pathState}
                to={toLocation}
              />
            );
          })}
          {locations.map((location) => {
            const isUnlocked = unlockedLocationIdSet.has(location.id);
            const isVisited = visitedLocationIdSet.has(location.id);
            const isFinalLocation = location.id === FINAL_LOCATION_ID;
            const isOpening = openingLocationId === location.id;
            const isNextAvailable = nextAvailableLocationId === location.id;
            const isStartLocation = location.id === locations[0].id;
            const isStartPromptVisible =
              isStartLocation && !isVisited;

            return (
              <LocationMarker
                isFinalLocation={isFinalLocation}
                isNextAvailable={isNextAvailable}
                isOpening={isOpening}
                isStartLocation={isStartLocation}
                isStartPromptVisible={isStartPromptVisible}
                isUnlocked={isUnlocked}
                isVisited={isVisited}
                key={location.id}
                location={location}
                onOpen={onOpenLocation}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
});

export default function MapPage() {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPinkMode, setIsPinkMode] = useState(false);
  const [openingLocationId, setOpeningLocationId] = useState<string | null>(
    null,
  );
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null,
  );
  const [selectedDiscoveryPointId, setSelectedDiscoveryPointId] = useState<
    string | null
  >(null);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(
    null,
  );
  const [revealedConnectionIds, setRevealedConnectionIds] = useState<string[]>(
    [],
  );
  const [unlockedLocationIds, setUnlockedLocationIds] = useState<string[]>([
    locations[0].id,
  ]);
  const [visitedLocationIds, setVisitedLocationIds] = useState<string[]>([]);
  const [mapContentSize, setMapContentSize] = useState<Size>({
    width: 0,
    height: 0,
  });
  const mapLayerRef = useRef<HTMLDivElement | null>(null);
  const discoveryLayerRef = useRef<HTMLDivElement | null>(null);
  const mapContentRef = useRef<HTMLDivElement | null>(null);
  const dragStart = useRef<Point | null>(null);
  const offset = useRef<Point>({ x: 0, y: 0 });
  const offsetStart = useRef<Point>({ x: 0, y: 0 });
  const openVideoTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activePathTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panFrame = useRef<number | null>(null);
  const cameraTransitionTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const hasInitializedCamera = useRef(false);

  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId),
    [selectedLocationId],
  );
  const selectedDiscoveryPoint = useMemo(
    () =>
      discoveryPoints.find(
        (discoveryPoint) => discoveryPoint.id === selectedDiscoveryPointId,
      ),
    [selectedDiscoveryPointId],
  );
  const isDiscoveryPointOpen = Boolean(selectedDiscoveryPointId);
  const isVideoOpen = Boolean(selectedLocationId || openingLocationId);
  const unlockedLocationIdSet = useMemo(
    () => new Set(unlockedLocationIds),
    [unlockedLocationIds],
  );
  const visitedLocationIdSet = useMemo(
    () => new Set(visitedLocationIds),
    [visitedLocationIds],
  );
  const revealedConnectionIdSet = useMemo(
    () => new Set(revealedConnectionIds),
    [revealedConnectionIds],
  );
  const nextAvailableLocationId = useMemo(
    () =>
      locations.find(
        (location) =>
          unlockedLocationIdSet.has(location.id) &&
          !visitedLocationIdSet.has(location.id),
      )?.id,
    [unlockedLocationIdSet, visitedLocationIdSet],
  );

  const applyCameraOffset = useCallback(
    (nextOffset: Point, shouldAnimate = false) => {
      offset.current = nextOffset;
      const nextTransform = getCameraTransform(nextOffset);
      const cameraLayers = [mapLayerRef.current, discoveryLayerRef.current];

      if (cameraTransitionTimeout.current) {
        clearTimeout(cameraTransitionTimeout.current);
        cameraTransitionTimeout.current = null;
      }

      cameraLayers.forEach((layer) => {
        if (!layer) {
          return;
        }

        layer.style.transition = shouldAnimate
          ? "transform 700ms cubic-bezier(0.16, 1, 0.3, 1)"
          : "";
        layer.style.transform = nextTransform;
      });

      if (shouldAnimate) {
        cameraTransitionTimeout.current = setTimeout(() => {
          cameraLayers.forEach((layer) => {
            if (layer) {
              layer.style.transition = "";
            }
          });
          cameraTransitionTimeout.current = null;
        }, 720);
      }
    },
    [],
  );

  useEffect(() => {
    document.body.classList.toggle("pink-mode", isPinkMode);

    return () => {
      document.body.classList.remove("pink-mode");
    };
  }, [isPinkMode]);

  useEffect(() => {
    const updateMapContentSize = () => {
      if (!mapContentRef.current) {
        return;
      }

      const nextSize = {
        width: mapContentRef.current.clientWidth,
        height: mapContentRef.current.clientHeight,
      };

      setMapContentSize((currentSize) =>
        currentSize.width === nextSize.width &&
        currentSize.height === nextSize.height
          ? currentSize
          : nextSize,
      );

      if (!hasInitializedCamera.current) {
        hasInitializedCamera.current = true;
        applyCameraOffset(getCameraOffsetForLocation(locations[0], nextSize), true);
        return;
      }

      applyCameraOffset(clampCameraOffset(offset.current, nextSize));
    };

    updateMapContentSize();

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateMapContentSize);

    if (mapContentRef.current) {
      resizeObserver?.observe(mapContentRef.current);
    }

    window.addEventListener("resize", updateMapContentSize);

    return () => {
      if (openVideoTimeout.current) {
        clearTimeout(openVideoTimeout.current);
      }

      if (activePathTimeout.current) {
        clearTimeout(activePathTimeout.current);
      }

      if (panFrame.current) {
        cancelAnimationFrame(panFrame.current);
      }

      if (cameraTransitionTimeout.current) {
        clearTimeout(cameraTransitionTimeout.current);
      }

      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateMapContentSize);
    };
  }, [applyCameraOffset]);

  const scheduleMapTransform = () => {
    if (panFrame.current) {
      return;
    }

    panFrame.current = requestAnimationFrame(() => {
      panFrame.current = null;
      applyCameraOffset(offset.current);
    });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (selectedLocationId || openingLocationId || selectedDiscoveryPointId) {
      return;
    }

    if (cameraTransitionTimeout.current) {
      clearTimeout(cameraTransitionTimeout.current);
      cameraTransitionTimeout.current = null;
    }

    [mapLayerRef.current, discoveryLayerRef.current].forEach((layer) => {
      if (layer) {
        layer.style.transition = "";
      }
    });

    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { x: event.clientX, y: event.clientY };
    offsetStart.current = offset.current;
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!dragStart.current) {
      return;
    }

    const nextX = offsetStart.current.x + event.clientX - dragStart.current.x;
    const nextY = offsetStart.current.y + event.clientY - dragStart.current.y;

    offset.current = clampCameraOffset(
      { x: nextX, y: nextY },
      mapContentSize,
    );
    scheduleMapTransform();
  };

  const stopDragging = (event: React.PointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragStart.current = null;
  };

  const completeLocation = useCallback(
    (locationId: string) => {
      const currentIndex = locations.findIndex(
        (location) => location.id === locationId,
      );
      const nextLocation = locations[currentIndex + 1];
      const completedLocationIds = visitedLocationIds.includes(locationId)
        ? visitedLocationIds
        : [...visitedLocationIds, locationId];

      setVisitedLocationIds(completedLocationIds);

      const shouldUnlockNextLocation =
        nextLocation &&
        !unlockedLocationIds.includes(nextLocation.id) &&
        (nextLocation.id !== FINAL_LOCATION_ID ||
          requiredLocationIds.every((locationId) =>
            completedLocationIds.includes(locationId),
          ));

      if (shouldUnlockNextLocation) {
        const nextConnection = connections.find(
          (connection) =>
            connection.from === locationId && connection.to === nextLocation.id,
        );

        setUnlockedLocationIds((currentIds) =>
          currentIds.includes(nextLocation.id)
            ? currentIds
            : [...currentIds, nextLocation.id],
        );

        if (nextConnection) {
          if (activePathTimeout.current) {
            clearTimeout(activePathTimeout.current);
          }

          const connectionId = getConnectionId(nextConnection);

          setRevealedConnectionIds((currentIds) =>
            currentIds.includes(connectionId)
              ? currentIds
              : [...currentIds, connectionId],
          );
          setActiveConnectionId(connectionId);
          activePathTimeout.current = setTimeout(() => {
            setActiveConnectionId(null);
          }, PATH_IGNITE_MS);
        }
      }
    },
    [unlockedLocationIds, visitedLocationIds],
  );

  const finishSelectedLocation = useCallback(() => {
    if (selectedLocationId) {
      completeLocation(selectedLocationId);
    }

    setSelectedLocationId(null);
    setOpeningLocationId(null);
  }, [completeLocation, selectedLocationId]);

  const openLocation = useCallback(
    (locationId: string) => {
      if (selectedLocationId || openingLocationId) {
        return;
      }

      if (openVideoTimeout.current) {
        clearTimeout(openVideoTimeout.current);
      }

      setOpeningLocationId(locationId);
      openVideoTimeout.current = setTimeout(() => {
        setSelectedLocationId(locationId);
      }, MARKER_FEEDBACK_MS);
    },
    [openingLocationId, selectedLocationId],
  );

  const openDiscoveryPoint = useCallback(
    (discoveryPointId: string) => {
      if (
        selectedLocationId ||
        openingLocationId ||
        selectedDiscoveryPointId
      ) {
        return;
      }

      if (discoveryPointId === PINK_MODE_DISCOVERY_POINT_ID) {
        setIsPinkMode(true);
      }

      setSelectedDiscoveryPointId(discoveryPointId);
    },
    [openingLocationId, selectedDiscoveryPointId, selectedLocationId],
  );

  const resetJourney = () => {
    if (openVideoTimeout.current) {
      clearTimeout(openVideoTimeout.current);
    }

    if (activePathTimeout.current) {
      clearTimeout(activePathTimeout.current);
    }

    setIsMenuOpen(false);
    setOpeningLocationId(null);
    setSelectedLocationId(null);
    setSelectedDiscoveryPointId(null);
    setActiveConnectionId(null);
    setRevealedConnectionIds([]);
    setUnlockedLocationIds([locations[0].id]);
    setVisitedLocationIds([]);
    dragStart.current = null;
    applyCameraOffset(
      getCameraOffsetForLocation(locations[0], mapContentSize),
      true,
    );
  };

  return (
    <main
      aria-label="Interactive world map"
      className={`fixed inset-0 overflow-hidden bg-[#1f1a12] touch-none cursor-grab select-none active:cursor-grabbing ${
        isVideoOpen ? "cinematic-video-opening" : ""
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onPointerLeave={stopDragging}
    >
      <button
        className="map-control fixed left-4 top-4 z-40 rounded-full border border-white/25 bg-black/45 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-black/65 focus:outline-none focus:ring-2 focus:ring-white/70"
        onClick={resetJourney}
        onPointerDown={(event) => event.stopPropagation()}
        type="button"
      >
        Genstart
      </button>
      <div
        className="fixed right-4 top-4 z-40"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          className="map-control rounded-full border border-white/25 bg-black/45 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-black/65 focus:outline-none focus:ring-2 focus:ring-white/70"
          onClick={() => setIsMenuOpen((current) => !current)}
          type="button"
        >
          Menu
        </button>
        {isMenuOpen ? (
          <div className="map-menu-panel mt-3 min-w-36 overflow-hidden rounded-2xl border border-white/20 bg-black/70 p-2 text-sm text-white shadow-xl backdrop-blur">
            <button
              className="block w-full rounded-xl px-4 py-2 text-left transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/60"
              onClick={() => router.replace("/")}
              type="button"
            >
              Forside
            </button>
            <button
              className="block w-full rounded-xl px-4 py-2 text-left transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/60"
              onClick={() => setIsMenuOpen(false)}
              type="button"
            >
              Kort
            </button>
          </div>
        ) : null}
      </div>
      <MapLayer
        activeConnectionId={activeConnectionId}
        isInteractionDisabled={isVideoOpen || isDiscoveryPointOpen}
        mapContentRef={mapContentRef}
        mapContentSize={mapContentSize}
        mapLayerRef={mapLayerRef}
        nextAvailableLocationId={nextAvailableLocationId}
        onOpenLocation={openLocation}
        openingLocationId={openingLocationId}
        revealedConnectionIdSet={revealedConnectionIdSet}
        unlockedLocationIdSet={unlockedLocationIdSet}
        visitedLocationIdSet={visitedLocationIdSet}
      />
      <div
        className="pointer-events-none absolute inset-0 z-30 will-change-transform"
        ref={discoveryLayerRef}
        style={{
          transform: getCameraTransform({ x: 0, y: 0 }),
          transformOrigin: "center",
        }}
      >
        {discoveryPoints.map((discoveryPoint) => (
          <DiscoveryPointMarker
            discoveryPoint={discoveryPoint}
            key={discoveryPoint.id}
            onOpen={openDiscoveryPoint}
          />
        ))}
      </div>
      {selectedDiscoveryPoint ? (
        <DiscoveryPointOverlay
          discoveryPoint={selectedDiscoveryPoint}
          onClose={() => setSelectedDiscoveryPointId(null)}
        />
      ) : null}
      {selectedLocation ? (
        <VideoOverlay
          key={selectedLocation.id}
          onClose={finishSelectedLocation}
          onEnded={finishSelectedLocation}
          src={selectedLocation.videoSrc}
        />
      ) : null}
    </main>
  );
}
