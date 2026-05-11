export const videos = {
  intro: "/videos/intro.mp4",
  location1: "/videos/location1.mp4",
  location2: "/videos/location2.mp4",
  location3: "/videos/location3.mp4",
  location4: "/videos/location4.mp4",
  location5: "/videos/location5.mp4",
  hojskoleMemory: "/videos/hojskole-memory.mp4",
  instantMove: "/videos/instant-move.mp4",
  finale: "/videos/finale.mp4",
} as const;

export type VideoId = keyof typeof videos;
