import type { MaxInt } from "@spotify/web-api-ts-sdk";
import { z } from "zod";
import { handleSpotifyRequest, formatDuration } from "./client.js";

export const getAlbums = {
  name: "getAlbums" as const,
  description: "Get album details by ID(s)",
  parameters: z.object({ albumIds: z.union([z.string(), z.array(z.string()).max(20)]).describe("Album ID or array of IDs (max 20)") }),
  execute: async (args: { albumIds: string | string[] }) => {
    const ids = Array.isArray(args.albumIds) ? args.albumIds : [args.albumIds];
    if (!ids.length) return "No album IDs provided";
    const albums = await handleSpotifyRequest(api => ids.length === 1 ? api.albums.get(ids[0]).then(a => [a]) : api.albums.get(ids));
    return albums.map((a, i) => `${i + 1}. "${a.name}" by ${a.artists.map(ar => ar.name).join(", ")} (${a.release_date}) - ${a.total_tracks} tracks - ID: ${a.id}`).join("\n");
  },
};

export const getAlbumTracks = {
  name: "getAlbumTracks" as const,
  description: "Get tracks from an album",
  parameters: z.object({ albumId: z.string(), limit: z.number().min(1).max(50).optional(), offset: z.number().min(0).optional() }),
  execute: async (args: { albumId: string; limit?: number; offset?: number }) => {
    const { limit = 20, offset = 0 } = args;
    const tracks = await handleSpotifyRequest(api => api.albums.tracks(args.albumId, undefined, limit as MaxInt<50>, offset));
    return tracks.items.map((t, i) => `${offset + i + 1}. "${t.name}" by ${t.artists.map(a => a.name).join(", ")} (${formatDuration(t.duration_ms)}) - ID: ${t.id}`).join("\n") || "No tracks found";
  },
};

export const saveOrRemoveAlbumForUser = {
  name: "saveOrRemoveAlbumForUser" as const,
  description: "Save or remove albums from library",
  parameters: z.object({ albumIds: z.array(z.string()).max(20), action: z.enum(["save", "remove"]) }),
  execute: async (args: { albumIds: string[]; action: "save" | "remove" }) => {
    await handleSpotifyRequest(api => args.action === "save" ? api.currentUser.albums.saveAlbums(args.albumIds) : api.currentUser.albums.removeSavedAlbums(args.albumIds));
    return `${args.action === "save" ? "Saved" : "Removed"} ${args.albumIds.length} album(s)`;
  },
};

export const checkUsersSavedAlbums = {
  name: "checkUsersSavedAlbums" as const,
  description: "Check if albums are saved in library",
  parameters: z.object({ albumIds: z.array(z.string()).max(20) }),
  execute: async (args: { albumIds: string[] }) => {
    const status = await handleSpotifyRequest(api => api.currentUser.albums.hasSavedAlbums(args.albumIds));
    return args.albumIds.map((id, i) => `${id}: ${status[i] ? "Saved" : "Not saved"}`).join("\n");
  },
};
