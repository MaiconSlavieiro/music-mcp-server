import { SpotifyApi } from "@spotify/web-api-ts-sdk";
import { loadConfig, saveConfig } from "../config.js";

let cachedApi: SpotifyApi | null = null;
let refreshPromise: Promise<void> | null = null;

function base64Encode(str: string): string {
  return Buffer.from(str).toString("base64");
}

async function refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${base64Encode(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  if (!response.ok) throw new Error(`Refresh failed: ${await response.text()}`);
  const data = await response.json();
  return { access_token: data.access_token, expires_in: data.expires_in || 3600 };
}

export async function getSpotifyApi(): Promise<SpotifyApi> {
  const config = loadConfig();
  const { clientId, clientSecret, accessToken, refreshToken, expiresAt } = config.spotify;

  if (!clientId || !clientSecret) throw new Error("Spotify not configured. Use the setup wizard.");

  if (accessToken && refreshToken) {
    const now = Date.now();
    if (!expiresAt || expiresAt <= now) {
      // Deduplicate concurrent refresh attempts
      if (!refreshPromise) {
        refreshPromise = (async () => {
          try {
            const tokens = await refreshAccessToken(clientId, clientSecret, refreshToken);
            config.spotify.accessToken = tokens.access_token;
            config.spotify.expiresAt = Date.now() + tokens.expires_in * 1000;
            saveConfig(config);
            cachedApi = null;
          } finally {
            refreshPromise = null;
          }
        })();
      }
      await refreshPromise;
    }

    if (cachedApi) return cachedApi;

    const freshConfig = loadConfig();
    const nowMs = Date.now();
    cachedApi = SpotifyApi.withAccessToken(clientId, {
      access_token: freshConfig.spotify.accessToken,
      token_type: "Bearer",
      expires_in: Math.floor(((freshConfig.spotify.expiresAt || nowMs + 3600000) - nowMs) / 1000),
      refresh_token: refreshToken,
    });
    return cachedApi;
  }

  cachedApi = SpotifyApi.withClientCredentials(clientId, clientSecret);
  return cachedApi;
}

export async function handleSpotifyRequest<T>(action: (api: SpotifyApi) => Promise<T>): Promise<T> {
  try {
    const api = await getSpotifyApi();
    return await action(api);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    // Spotify sometimes returns empty/malformed responses for "no content" operations (204)
    if (msg.includes("Unexpected token") || msg.includes("Unexpected non-whitespace") || msg.includes("Exponent part")) {
      console.warn(`[Spotify] Ignoring parse error (likely empty 204 response): ${msg}`);
      return undefined as T;
    }
    throw new Error(`Spotify API error: ${msg}`);
  }
}

export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}:${seconds.padStart(2, "0")}`;
}

export function isSpotifyConfigured(): boolean {
  const config = loadConfig();
  return !!(config.spotify.clientId && config.spotify.clientSecret);
}

export function isSpotifyAuthenticated(): boolean {
  const config = loadConfig();
  return !!(config.spotify.accessToken && config.spotify.refreshToken);
}

export const SPOTIFY_SCOPES = [
  "user-read-private", "user-read-email", "user-read-playback-state",
  "user-modify-playback-state", "user-read-currently-playing",
  "playlist-read-private", "playlist-modify-private", "playlist-modify-public",
  "user-library-read", "user-library-modify", "user-read-recently-played",
];
