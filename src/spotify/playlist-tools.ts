import { z } from "zod";
import { handleSpotifyRequest } from "./client.js";

export const createPlaylist = {
  name: "createPlaylist" as const,
  description: "Create a new Spotify playlist",
  parameters: z.object({
    name: z.string(), description: z.string().optional(), public: z.boolean().optional(),
  }),
  execute: async (args: { name: string; description?: string; public?: boolean }) => {
    const result = await handleSpotifyRequest(async api => {
      const me = await api.currentUser.profile();
      return api.playlists.createPlaylist(me.id, { name: args.name, description: args.description, public: args.public ?? false });
    });
    return `Created playlist "${args.name}" - ID: ${result.id} - URL: ${result.external_urls.spotify}`;
  },
};

export const addTracksToPlaylist = {
  name: "addTracksToPlaylist" as const,
  description: "Add tracks to a playlist",
  parameters: z.object({
    playlistId: z.string(), trackIds: z.array(z.string()), position: z.number().min(0).optional(),
  }),
  execute: async (args: { playlistId: string; trackIds: string[]; position?: number }) => {
    if (!args.trackIds.length) return "Error: No track IDs provided";
    const uris = args.trackIds.map(id => `spotify:track:${id}`);
    await handleSpotifyRequest(api => api.playlists.addItemsToPlaylist(args.playlistId, uris, args.position));
    return `Added ${args.trackIds.length} track(s) to playlist ${args.playlistId}`;
  },
};

export const getPlaylist = {
  name: "getPlaylist" as const,
  description: "Get playlist details",
  parameters: z.object({ playlistId: z.string() }),
  execute: async (args: { playlistId: string }) => {
    const p = await handleSpotifyRequest(api => api.playlists.getPlaylist(args.playlistId));
    return `"${p.name}" by ${p.owner?.display_name} | ${p.tracks?.total} tracks | ${p.public ? "Public" : "Private"} | ID: ${p.id}`;
  },
};

export const updatePlaylist = {
  name: "updatePlaylist" as const,
  description: "Update playlist details",
  parameters: z.object({
    playlistId: z.string(), name: z.string().optional(), description: z.string().optional(),
    public: z.boolean().optional(), collaborative: z.boolean().optional(),
  }),
  execute: async (args: { playlistId: string; name?: string; description?: string; public?: boolean; collaborative?: boolean }) => {
    const body: Record<string, string | boolean> = {};
    if (args.name) body.name = args.name;
    if (args.description !== undefined) body.description = args.description;
    if (args.public !== undefined) body.public = args.public;
    if (args.collaborative !== undefined) body.collaborative = args.collaborative;
    await handleSpotifyRequest(api => api.playlists.changePlaylistDetails(args.playlistId, body));
    return `Updated playlist ${args.playlistId}: ${Object.keys(body).join(", ")}`;
  },
};

export const removeTracksFromPlaylist = {
  name: "removeTracksFromPlaylist" as const,
  description: "Remove tracks from a playlist (max 100)",
  parameters: z.object({
    playlistId: z.string(), trackIds: z.array(z.string()).min(1).max(100), snapshotId: z.string().optional(),
  }),
  execute: async (args: { playlistId: string; trackIds: string[]; snapshotId?: string }) => {
    const tracks = args.trackIds.map(id => ({ uri: `spotify:track:${id}` }));
    await handleSpotifyRequest(api => api.playlists.removeItemsFromPlaylist(args.playlistId, { tracks, ...(args.snapshotId ? { snapshot_id: args.snapshotId } : {}) }));
    return `Removed ${args.trackIds.length} track(s) from playlist ${args.playlistId}`;
  },
};

export const reorderPlaylistItems = {
  name: "reorderPlaylistItems" as const,
  description: "Reorder tracks in a playlist",
  parameters: z.object({
    playlistId: z.string(), rangeStart: z.number().min(0), insertBefore: z.number().min(0),
    rangeLength: z.number().min(1).optional(), snapshotId: z.string().optional(),
  }),
  execute: async (args: { playlistId: string; rangeStart: number; insertBefore: number; rangeLength?: number; snapshotId?: string }) => {
    await handleSpotifyRequest(api => api.playlists.updatePlaylistItems(args.playlistId, {
      range_start: args.rangeStart, insert_before: args.insertBefore,
      ...(args.rangeLength ? { range_length: args.rangeLength } : {}),
      ...(args.snapshotId ? { snapshot_id: args.snapshotId } : {}),
    }));
    return `Moved ${args.rangeLength ?? 1} track(s) from position ${args.rangeStart} to before ${args.insertBefore}`;
  },
};
