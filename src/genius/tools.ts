import { z } from "zod";
import { searchSongs, getSongById, getArtistById, getArtistSongs, scrapeLyrics } from "./client.js";

export const searchGeniusSong = {
  name: "searchGeniusSong" as const,
  description: "Search for songs on Genius by title, artist, or lyrics",
  parameters: z.object({
    query: z.string().describe("Search query (song title, artist, or lyrics)"),
    limit: z.number().min(1).max(20).optional().describe("Max results (1-20)"),
  }),
  execute: async (args: { query: string; limit?: number }) => {
    const results = await searchSongs(args.query, args.limit ?? 10);
    if (!results.length) return `No results found for "${args.query}"`;
    return results.map((s, i) =>
      `${i + 1}. "${s.title}" by ${s.primary_artist?.name || "Unknown"} - ID: ${s.id}`
    ).join("\n");
  },
};

export const getLyrics = {
  name: "getLyrics" as const,
  description: "Get full lyrics of a song from Genius",
  parameters: z.object({
    query: z.string().describe("Song title and artist (e.g. 'Bohemian Rhapsody Queen')"),
  }),
  execute: async (args: { query: string }) => {
    const results = await searchSongs(args.query, 1);
    if (!results.length) return `No song found for "${args.query}"`;
    const song = results[0];
    if (!song.url) return "No lyrics URL available for this song";
    const lyrics = await scrapeLyrics(song.url);
    return `# ${song.title} — ${song.primary_artist?.name}\n\n${lyrics}`;
  },
};

export const getSongInfo = {
  name: "getSongInfo" as const,
  description: "Get detailed song metadata from Genius (producers, writers, release date, etc.)",
  parameters: z.object({
    query: z.string().describe("Song title and artist to search for"),
  }),
  execute: async (args: { query: string }) => {
    const results = await searchSongs(args.query, 1);
    if (!results.length) return `No song found for "${args.query}"`;
    const song = await getSongById(results[0].id);
    const writers = song.writer_artists?.map((w: any) => w.name).join(", ") || "Unknown";
    const producers = song.producer_artists?.map((p: any) => p.name).join(", ") || "Unknown";
    const album = song.album?.name || "Unknown";
    const releaseDate = song.release_date_for_display || "Unknown";
    return [
      `Title: ${song.title}`,
      `Artist: ${song.primary_artist?.name}`,
      `Album: ${album}`,
      `Release Date: ${releaseDate}`,
      `Writers: ${writers}`,
      `Producers: ${producers}`,
      `Genius URL: ${song.url}`,
      `Genius ID: ${song.id}`,
    ].join("\n");
  },
};

export const getGeniusArtistInfo = {
  name: "getGeniusArtistInfo" as const,
  description: "Get artist info and top songs from Genius",
  parameters: z.object({
    query: z.string().describe("Artist name to search for"),
  }),
  execute: async (args: { query: string }) => {
    const results = await searchSongs(args.query, 1);
    if (!results.length) return `No artist found for "${args.query}"`;
    const artistId = results[0].primary_artist?.id;
    if (!artistId) return "Could not find artist";
    const artist = await getArtistById(artistId);
    const topSongs = await getArtistSongs(artistId, 10);
    let text = `Artist: ${artist.name}\nGenius URL: ${artist.url}\nID: ${artist.id}`;
    if (artist.description?.plain) text += `\nBio: ${artist.description.plain.substring(0, 500)}...`;
    if (topSongs.length) text += `\n\nTop Songs:\n${topSongs.map((s, i) => `${i + 1}. ${s.title}`).join("\n")}`;
    return text;
  },
};
