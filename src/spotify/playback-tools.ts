import { z } from "zod";
import { handleSpotifyRequest } from "./client.js";

export const playMusic = {
  name: "playMusic" as const,
  description: "Start playing a Spotify track, album, artist, or playlist",
  parameters: z.object({
    uri: z.string().optional().describe("Spotify URI (overrides type+id)"),
    type: z.enum(["track", "album", "artist", "playlist"]).optional(),
    id: z.string().optional().describe("Spotify ID"),
    deviceId: z.string().optional().describe("Device ID"),
  }),
  execute: async (args: { uri?: string; type?: string; id?: string; deviceId?: string }) => {
    let spotifyUri = args.uri || (args.type && args.id ? `spotify:${args.type}:${args.id}` : undefined);
    if (!spotifyUri) return "Error: provide URI or type+id";
    await handleSpotifyRequest(api => {
      const dev = args.deviceId || "";
      return args.type === "track" ? api.player.startResumePlayback(dev, undefined, [spotifyUri!]) : api.player.startResumePlayback(dev, spotifyUri);
    });
    return `Playing ${args.type || "music"} ${args.id ? `(ID: ${args.id})` : ""}`;
  },
};

export const pausePlayback = {
  name: "pausePlayback" as const,
  description: "Pause Spotify playback",
  parameters: z.object({ deviceId: z.string().optional() }),
  execute: async (args: { deviceId?: string }) => {
    await handleSpotifyRequest(api => api.player.pausePlayback(args.deviceId || ""));
    return "Playback paused";
  },
};

export const resumePlayback = {
  name: "resumePlayback" as const,
  description: "Resume Spotify playback",
  parameters: z.object({ deviceId: z.string().optional() }),
  execute: async (args: { deviceId?: string }) => {
    await handleSpotifyRequest(api => api.player.startResumePlayback(args.deviceId || ""));
    return "Playback resumed";
  },
};

export const skipToNext = {
  name: "skipToNext" as const,
  description: "Skip to next track",
  parameters: z.object({ deviceId: z.string().optional() }),
  execute: async (args: { deviceId?: string }) => {
    await handleSpotifyRequest(api => api.player.skipToNext(args.deviceId || ""));
    return "Skipped to next";
  },
};

export const skipToPrevious = {
  name: "skipToPrevious" as const,
  description: "Skip to previous track",
  parameters: z.object({ deviceId: z.string().optional() }),
  execute: async (args: { deviceId?: string }) => {
    await handleSpotifyRequest(api => api.player.skipToPrevious(args.deviceId || ""));
    return "Skipped to previous";
  },
};

export const addToQueue = {
  name: "addToQueue" as const,
  description: "Add item to playback queue",
  parameters: z.object({
    uri: z.string().optional(), type: z.enum(["track", "album", "artist", "playlist"]).optional(),
    id: z.string().optional(), deviceId: z.string().optional(),
  }),
  execute: async (args: { uri?: string; type?: string; id?: string; deviceId?: string }) => {
    const spotifyUri = args.uri || (args.type && args.id ? `spotify:${args.type}:${args.id}` : undefined);
    if (!spotifyUri) return "Error: provide URI or type+id";
    await handleSpotifyRequest(api => api.player.addItemToPlaybackQueue(spotifyUri!, args.deviceId || ""));
    return `Added to queue: ${spotifyUri}`;
  },
};

export const setVolume = {
  name: "setVolume" as const,
  description: "Set volume (0-100). Premium required.",
  parameters: z.object({ volumePercent: z.number().min(0).max(100), deviceId: z.string().optional() }),
  execute: async (args: { volumePercent: number; deviceId?: string }) => {
    await handleSpotifyRequest(api => api.player.setPlaybackVolume(Math.round(args.volumePercent), args.deviceId || ""));
    return `Volume set to ${Math.round(args.volumePercent)}%`;
  },
};

export const adjustVolume = {
  name: "adjustVolume" as const,
  description: "Adjust volume by relative amount (-100 to 100). Premium required.",
  parameters: z.object({ adjustment: z.number().min(-100).max(100), deviceId: z.string().optional() }),
  execute: async (args: { adjustment: number; deviceId?: string }) => {
    const pb = await handleSpotifyRequest(api => api.player.getPlaybackState());
    if (!pb?.device?.volume_percent && pb?.device?.volume_percent !== 0) return "No active device found";
    const newVol = Math.min(100, Math.max(0, pb.device.volume_percent + args.adjustment));
    await handleSpotifyRequest(api => api.player.setPlaybackVolume(Math.round(newVol), args.deviceId || ""));
    return `Volume ${args.adjustment > 0 ? "increased" : "decreased"} from ${pb.device.volume_percent}% to ${Math.round(newVol)}%`;
  },
};
