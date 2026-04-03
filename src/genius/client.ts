import * as cheerio from "cheerio";
import { loadConfig } from "../config.js";
import { cacheGet, cacheSet } from "../cache.js";

const BASE_URL = "https://api.genius.com";

async function geniusFetch(path: string, params?: Record<string, string>): Promise<any> {
  const config = loadConfig();
  if (!config.genius.accessToken) throw new Error("Genius not configured. Use the setup wizard.");

  const url = new URL(`${BASE_URL}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${config.genius.accessToken}` },
  });
  if (!res.ok) throw new Error(`Genius API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.response;
}

export async function searchSongs(query: string, limit = 10): Promise<any[]> {
  const cacheKey = `genius:search:${query}:${limit}`;
  const cached = cacheGet<any[]>(cacheKey);
  if (cached) return cached;

  const response = await geniusFetch("/search", { q: query, per_page: String(limit) });
  const results = response.hits?.map((h: any) => h.result) || [];
  cacheSet(cacheKey, results);
  return results;
}

export async function getSongById(songId: number): Promise<any> {
  const cacheKey = `genius:song:${songId}`;
  const cached = cacheGet<any>(cacheKey);
  if (cached) return cached;

  const response = await geniusFetch(`/songs/${songId}`);
  const song = response.song;
  cacheSet(cacheKey, song, 24 * 60 * 60 * 1000); // 24h cache
  return song;
}

export async function getArtistById(artistId: number): Promise<any> {
  const cacheKey = `genius:artist:${artistId}`;
  const cached = cacheGet<any>(cacheKey);
  if (cached) return cached;

  const response = await geniusFetch(`/artists/${artistId}`);
  const artist = response.artist;
  cacheSet(cacheKey, artist, 24 * 60 * 60 * 1000);
  return artist;
}

export async function getArtistSongs(artistId: number, limit = 20): Promise<any[]> {
  const response = await geniusFetch(`/artists/${artistId}/songs`, { per_page: String(limit), sort: "popularity" });
  return response.songs || [];
}

export async function scrapeLyrics(url: string): Promise<string> {
  const cacheKey = `genius:lyrics:${url}`;
  const cached = cacheGet<string>(cacheKey);
  if (cached) return cached;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch lyrics page: ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  // Genius stores lyrics in [data-lyrics-container] divs
  let lyrics = "";
  $('[data-lyrics-container="true"]').each((_, el) => {
    // Replace <br> with newlines before extracting text
    $(el).find("br").replaceWith("\n");
    lyrics += $(el).text() + "\n";
  });

  lyrics = lyrics.trim();
  if (!lyrics) throw new Error("Could not extract lyrics from page");

  cacheSet(cacheKey, lyrics, 7 * 24 * 60 * 60 * 1000); // 7 day cache for lyrics
  return lyrics;
}

export function isGeniusConfigured(): boolean {
  const config = loadConfig();
  return !!config.genius.accessToken;
}
