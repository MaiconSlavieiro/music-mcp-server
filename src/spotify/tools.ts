import type { MaxInt } from "@spotify/web-api-ts-sdk";
import { z } from "zod";
import { handleSpotifyRequest, formatDuration } from "./client.js";
import { loadConfig } from "../config.js";

function isTrack(item: any): item is { id: string; name: string; type: string; duration_ms: number; artists: { name: string }[]; album: { name: string } } {
  return item?.type === "track" && Array.isArray(item.artists) && item.album?.name;
}

// ─── READ TOOLS ───

export const searchSpotify = {
  name: "searchSpotify" as const,
  description: "Search for tracks, albums, artists, or playlists on Spotify",
  parameters: z.object({
    query: z.string().describe("The search query"),
    type: z.enum(["track", "album", "artist", "playlist"]).describe("Type of item to search for"),
    limit: z.number().min(1).max(50).optional().describe("Max results (1-50)"),
  }),
  execute: async (args: { query: string; type: "track" | "album" | "artist" | "playlist"; limit?: number }) => {
    const results = await handleSpotifyRequest(api => api.search(args.query, [args.type], undefined, (args.limit ?? 10) as MaxInt<50>));
    let text = "";
    if (args.type === "track" && results.tracks) text = results.tracks.items.map((t, i) => `${i + 1}. "${t.name}" by ${t.artists.map(a => a.name).join(", ")} (${formatDuration(t.duration_ms)}) - ID: ${t.id}`).join("\n");
    else if (args.type === "album" && results.albums) text = results.albums.items.map((a, i) => `${i + 1}. "${a.name}" by ${a.artists.map(ar => ar.name).join(", ")} - ID: ${a.id}`).join("\n");
    else if (args.type === "artist" && results.artists) text = results.artists.items.map((a, i) => `${i + 1}. ${a.name} - ID: ${a.id}`).join("\n");
    else if (args.type === "playlist" && results.playlists) text = results.playlists.items.map((p, i) => `${i + 1}. "${p?.name}" by ${p?.owner?.display_name} - ID: ${p?.id}`).join("\n");
    return text || `No ${args.type} results found for "${args.query}"`;
  },
};

export const getNowPlaying = {
  name: "getNowPlaying" as const,
  description: "Get the currently playing track on Spotify",
  parameters: z.object({}),
  execute: async () => {
    const pb = await handleSpotifyRequest(api => api.player.getPlaybackState());
    if (!pb?.item || !isTrack(pb.item)) return "Nothing is currently playing";
    const t = pb.item;
    return `${pb.is_playing ? "Playing" : "Paused"}: "${t.name}" by ${t.artists.map(a => a.name).join(", ")} (${t.album.name}) ${formatDuration(pb.progress_ms || 0)}/${formatDuration(t.duration_ms)} | Device: ${pb.device?.name} | Volume: ${pb.device?.volume_percent}%`;
  },
};

export const getMyPlaylists = {
  name: "getMyPlaylists" as const,
  description: "Get current user's playlists",
  parameters: z.object({ limit: z.number().min(1).max(50).optional().describe("Max playlists (1-50)") }),
  execute: async (args: { limit?: number }) => {
    const pl = await handleSpotifyRequest(api => api.currentUser.playlists.playlists((args.limit ?? 50) as MaxInt<50>));
    return pl.items.map((p, i) => `${i + 1}. "${p.name}" (${p.tracks?.total || 0} tracks) - ID: ${p.id}`).join("\n") || "No playlists found";
  },
};

export const getPlaylistTracks = {
  name: "getPlaylistTracks" as const,
  description: "Get tracks in a Spotify playlist",
  parameters: z.object({
    playlistId: z.string().describe("Playlist ID"),
    limit: z.number().min(1).max(50).optional().describe("Max tracks (1-50)"),
    offset: z.number().min(0).optional().describe("Offset for pagination"),
  }),
  execute: async (args: { playlistId: string; limit?: number; offset?: number }) => {
    const { limit = 50, offset = 0 } = args;
    const tracks = await handleSpotifyRequest(api => api.playlists.getPlaylistItems(args.playlistId, undefined, undefined, limit as MaxInt<50>, offset));
    return tracks.items.map((item, i) => {
      const t = item.track;
      if (!t || !isTrack(t)) return `${offset + i + 1}. [Unknown]`;
      return `${offset + i + 1}. "${t.name}" by ${t.artists.map(a => a.name).join(", ")} (${formatDuration(t.duration_ms)}) - ID: ${t.id}`;
    }).join("\n") || "No tracks found";
  },
};

export const getRecentlyPlayed = {
  name: "getRecentlyPlayed" as const,
  description: "Get recently played tracks",
  parameters: z.object({ limit: z.number().min(1).max(50).optional().describe("Max tracks (1-50)") }),
  execute: async (args: { limit?: number }) => {
    const h = await handleSpotifyRequest(api => api.player.getRecentlyPlayedTracks((args.limit ?? 50) as MaxInt<50>));
    return h.items.map((item, i) => {
      const t = item.track;
      if (!isTrack(t)) return `${i + 1}. [Unknown]`;
      return `${i + 1}. "${t.name}" by ${t.artists.map(a => a.name).join(", ")} - ${new Date(item.played_at).toLocaleString()}`;
    }).join("\n") || "No recent tracks";
  },
};

export const getUsersSavedTracks = {
  name: "getUsersSavedTracks" as const,
  description: 'Get tracks from "Liked Songs"',
  parameters: z.object({ limit: z.number().min(1).max(50).optional(), offset: z.number().min(0).optional() }),
  execute: async (args: { limit?: number; offset?: number }) => {
    const { limit = 50, offset = 0 } = args;
    const saved = await handleSpotifyRequest(api => api.currentUser.tracks.savedTracks(limit as MaxInt<50>, offset));
    return saved.items.map((item, i) => {
      const t = item.track;
      if (!isTrack(t)) return `${offset + i + 1}. [Unknown]`;
      return `${offset + i + 1}. "${t.name}" by ${t.artists.map(a => a.name).join(", ")} (${formatDuration(t.duration_ms)}) - ID: ${t.id}`;
    }).join("\n") || "No saved tracks";
  },
};

export const removeUsersSavedTracks = {
  name: "removeUsersSavedTracks" as const,
  description: 'Remove tracks from "Liked Songs" (max 40)',
  parameters: z.object({ trackIds: z.array(z.string()).max(40).describe("Track IDs to remove") }),
  execute: async (args: { trackIds: string[] }) => {
    await handleSpotifyRequest(async (api) => {
      const token = (api as any).getAccessToken?.() ?? loadConfig().spotify.accessToken;
      const res = await fetch(`https://api.spotify.com/v1/me/tracks?ids=${args.trackIds.join(",")}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Spotify API error ${res.status}: ${await res.text()}`);
    });
    return `Removed ${args.trackIds.length} track(s) from Liked Songs`;
  },
};

export const getQueue = {
  name: "getQueue" as const,
  description: "Get current queue",
  parameters: z.object({ limit: z.number().min(1).max(50).optional() }),
  execute: async (args: { limit?: number }) => {
    const q = await handleSpotifyRequest(api => api.player.getUsersQueue()) as any;
    const current = q?.currently_playing;
    let text = current ? `Now: "${current.name}" by ${current.artists?.map((a: any) => a.name).join(", ")}` : "Nothing playing";
    const upcoming = (q?.queue ?? []).slice(0, args.limit ?? 10);
    if (upcoming.length) text += "\n\nQueue:\n" + upcoming.map((t: any, i: number) => `${i + 1}. "${t.name}" by ${t.artists?.map((a: any) => a.name).join(", ")}`).join("\n");
    return text;
  },
};

export const getAvailableDevices = {
  name: "getAvailableDevices" as const,
  description: "Get available Spotify Connect devices",
  parameters: z.object({}),
  execute: async () => {
    const d = await handleSpotifyRequest(api => api.player.getAvailableDevices());
    return d.devices.map((dev, i) => `${i + 1}. ${dev.name} (${dev.type}) ${dev.is_active ? "▶ Active" : "○"} Vol: ${dev.volume_percent}% ID: ${dev.id}`).join("\n") || "No devices found";
  },
};
