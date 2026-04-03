import { FastMCP } from "fastmcp";
import { loadConfig, saveConfig, hashPassword, verifyPassword, generateToken, getBaseUrl } from "./config.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isBlocked, recordFailure, resetAttempts } from "./auth/rate-limiter.js";
import { cacheStats } from "./cache.js";
import { isSpotifyConfigured, isSpotifyAuthenticated, SPOTIFY_SCOPES } from "./spotify/client.js";
import { isGeniusConfigured } from "./genius/client.js";

// Spotify tools
import { searchSpotify, getNowPlaying, getMyPlaylists, getPlaylistTracks, getRecentlyPlayed, getUsersSavedTracks, removeUsersSavedTracks, getQueue, getAvailableDevices } from "./spotify/tools.js";
import { playMusic, pausePlayback, resumePlayback, skipToNext, skipToPrevious, addToQueue, setVolume, adjustVolume } from "./spotify/playback-tools.js";
import { createPlaylist, addTracksToPlaylist, getPlaylist, updatePlaylist, removeTracksFromPlaylist, reorderPlaylistItems } from "./spotify/playlist-tools.js";
import { getAlbums, getAlbumTracks, saveOrRemoveAlbumForUser, checkUsersSavedAlbums } from "./spotify/album-tools.js";

// Genius tools
import { searchGeniusSong, getLyrics, getSongInfo, getGeniusArtistInfo } from "./genius/tools.js";

// Web wizard
import { getWizardHtml, getSpotifySetupHtml, getGeniusSetupHtml, getSecuritySetupHtml, getSummaryHtml, escapeHtml } from "./web/pages.js";

const PORT = Number(process.env.PORT || "18960");

const server = new FastMCP({ name: "music-mcp-server", version: "1.0.0" });

// ─── Register all tools ───
const allTools = [
  searchSpotify, getNowPlaying, getMyPlaylists, getPlaylistTracks, getRecentlyPlayed,
  getUsersSavedTracks, removeUsersSavedTracks, getQueue, getAvailableDevices,
  playMusic, pausePlayback, resumePlayback, skipToNext, skipToPrevious, addToQueue, setVolume, adjustVolume,
  createPlaylist, addTracksToPlaylist, getPlaylist, updatePlaylist, removeTracksFromPlaylist, reorderPlaylistItems,
  getAlbums, getAlbumTracks, saveOrRemoveAlbumForUser, checkUsersSavedAlbums,
  searchGeniusSong, getLyrics, getSongInfo, getGeniusArtistInfo,
] as const;

for (const tool of allTools) {
  server.addTool(tool as any);
}

// ─── Custom routes via Hono ───
const app = server.getApp();

// Helper: Basic Auth check with rate limiting
function checkBasicAuth(headers: Record<string, string | undefined>, ip: string): { ok: boolean; status?: number; body?: string; wwwAuth?: boolean } {
  const config = loadConfig();
  if (!config.auth.webUsername || !config.auth.webPasswordHash) return { ok: true };

  if (isBlocked(ip)) return { ok: false, status: 429, body: "Too many failed attempts. Try again later." };

  const authHeader = headers.authorization;
  if (!authHeader || !authHeader.startsWith("Basic ")) return { ok: false, status: 401, body: "Authentication required", wwwAuth: true };

  const decoded = Buffer.from(authHeader.slice(6), "base64").toString();
  const [user, pass] = decoded.split(":");
  if (user !== config.auth.webUsername || !verifyPassword(pass, config.auth.webPasswordHash)) {
    recordFailure(ip);
    return { ok: false, status: 401, body: "Invalid credentials", wwwAuth: true };
  }

  resetAttempts(ip);
  return { ok: true };
}

function getIp(c: any): string {
  // Prefer x-real-ip set by trusted reverse proxy, fallback to x-forwarded-for first entry
  const realIp = c.req.header("x-real-ip");
  if (realIp) return realIp;
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

function guardAuth(c: any): Response | null {
  const auth = checkBasicAuth(
    { authorization: c.req.header("authorization") },
    getIp(c)
  );
  if (!auth.ok) {
    if (auth.wwwAuth) c.header("WWW-Authenticate", 'Basic realm="Music MCP Setup"');
    return c.text(auth.body || "Unauthorized", auth.status || 401);
  }
  return null;
}

// Health (public)
app.get("/health", (c) => {
  return c.json({ status: "ok", spotify: isSpotifyConfigured(), genius: isGeniusConfigured(), cache: cacheStats() });
});

// App icon (public)
app.get("/icon.svg", (c) => {
  const svg = readFileSync(join(process.cwd(), "public", "icon.svg"), "utf-8");
  return c.body(svg, 200, { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=31536000" });
});

app.get("/icon.png", (c) => c.redirect("/icon.svg", 301));

// ─── Setup Wizard pages ───
app.get("/setup", (c) => {
  const denied = guardAuth(c);
  if (denied) return denied;
  return c.html(getWizardHtml());
});

app.get("/setup/spotify", (c) => {
  const denied = guardAuth(c);
  if (denied) return denied;
  return c.html(getSpotifySetupHtml());
});

app.get("/setup/genius", (c) => {
  const denied = guardAuth(c);
  if (denied) return denied;
  return c.html(getGeniusSetupHtml());
});

app.get("/setup/security", (c) => {
  const denied = guardAuth(c);
  if (denied) return denied;
  return c.html(getSecuritySetupHtml());
});

app.get("/setup/summary", (c) => {
  const denied = guardAuth(c);
  if (denied) return denied;
  return c.html(getSummaryHtml());
});

// ─── API routes ───
app.get("/api/status", (c) => {
  const denied = guardAuth(c);
  if (denied) return denied;
  const config = loadConfig();
  return c.json({
    spotify: { configured: isSpotifyConfigured(), authenticated: isSpotifyAuthenticated(), clientId: config.spotify.clientId ? "***" + config.spotify.clientId.slice(-4) : "" },
    genius: { configured: isGeniusConfigured(), token: config.genius.accessToken ? "***" + config.genius.accessToken.slice(-4) : "" },
    auth: { mcpToken: config.auth.mcpToken ? "***" + config.auth.mcpToken.slice(-4) : "", webUsername: config.auth.webUsername },
  });
});

app.post("/api/spotify/credentials", async (c) => {
  const denied = guardAuth(c);
  if (denied) return denied;
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") return c.json({ error: "Invalid JSON body" }, 400);
  const config = loadConfig();
  if (typeof body.clientId === "string") config.spotify.clientId = body.clientId.trim();
  if (typeof body.clientSecret === "string" && body.clientSecret) config.spotify.clientSecret = body.clientSecret.trim();
  saveConfig(config);
  return c.json({ ok: true });
});

app.get("/api/spotify/auth-url", (c) => {
  const denied = guardAuth(c);
  if (denied) return denied;
  const config = loadConfig();
  if (!config.spotify.clientId || !config.spotify.clientSecret) {
    return c.json({ error: "Spotify credentials not configured" }, 400);
  }
  const state = generateToken(16);
  const redirectUri = `${getBaseUrl()}/spotify/callback`;
  const params = new URLSearchParams({
    client_id: config.spotify.clientId, response_type: "code", redirect_uri: redirectUri,
    scope: SPOTIFY_SCOPES.join(" "), state, show_dialog: "true",
  });
  return c.json({ url: `https://accounts.spotify.com/authorize?${params}`, state, redirectUri });
});

// Spotify OAuth callback (public)
app.get("/spotify/callback", async (c) => {
  const code = c.req.query("code");
  const error = c.req.query("error");
  if (error) return c.html(errorPage("Spotify Authorization Failed", error));
  if (!code) return c.html(errorPage("No Code", "No authorization code received"));

  const config = loadConfig();
  const redirectUri = `${getBaseUrl()}/spotify/callback`;

  try {
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
    });
    if (!tokenRes.ok) throw new Error(await tokenRes.text());
    const tokens = await tokenRes.json() as { access_token: string; refresh_token: string; expires_in?: number };
    config.spotify.accessToken = tokens.access_token;
    config.spotify.refreshToken = tokens.refresh_token;
    config.spotify.expiresAt = Date.now() + (tokens.expires_in || 3600) * 1000;
    saveConfig(config);
    return c.html(successPage("Spotify Connected", "You can close this window and return to the setup wizard."));
  } catch (err) {
    return c.html(errorPage("Token Exchange Failed", err instanceof Error ? err.message : String(err)));
  }
});

app.post("/api/genius/token", async (c) => {
  const denied = guardAuth(c);
  if (denied) return denied;
  const body = await c.req.json();
  const config = loadConfig();
  config.genius.accessToken = body.token || "";
  saveConfig(config);
  return c.json({ ok: true });
});

app.post("/api/genius/test", async (c) => {
  const denied = guardAuth(c);
  if (denied) return denied;

  // Accept optional token in body to save-and-test in one step
  try {
    const body = await c.req.json().catch(() => ({})) as { token?: string };
    const config = loadConfig();
    if (body.token) {
      config.genius.accessToken = body.token;
      saveConfig(config);
    }
    const token = config.genius.accessToken;
    if (!token) {
      return c.json({ ok: false, error: "No token configured. Save a token first." });
    }
    const res = await fetch("https://api.genius.com/search?q=Bohemian+Rhapsody&per_page=1", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const text = await res.text();
      return c.json({ ok: false, error: `Genius API returned ${res.status}: ${text.substring(0, 200)}` });
    }
    const data = await res.json() as any;
    const hit = data.response?.hits?.[0]?.result;
    return c.json({ ok: true, result: hit ? `${hit.title} by ${hit.primary_artist?.name}` : "API works but no results" });
  } catch (err) {
    return c.json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.post("/api/security", async (c) => {
  const denied = guardAuth(c);
  if (denied) return denied;
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") return c.json({ error: "Invalid JSON body" }, 400);
  const config = loadConfig();
  if (typeof body.mcpToken === "string") config.auth.mcpToken = body.mcpToken;
  if (typeof body.webUsername === "string") config.auth.webUsername = body.webUsername.trim();
  if (typeof body.webPassword === "string" && body.webPassword) config.auth.webPasswordHash = hashPassword(body.webPassword);
  saveConfig(config);
  return c.json({ ok: true });
});

app.get("/api/generate-token", (c) => {
  const denied = guardAuth(c);
  if (denied) return denied;
  return c.json({ token: generateToken() });
});

app.post("/api/server/base-url", async (c) => {
  const denied = guardAuth(c);
  if (denied) return denied;
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object" || typeof body.baseUrl !== "string") return c.json({ error: "Invalid body: baseUrl string required" }, 400);
  const config = loadConfig();
  config.server.baseUrl = body.baseUrl.replace(/\/$/, "");
  saveConfig(config);
  return c.json({ ok: true });
});

// Test all integrations with real API calls
app.get("/api/test-all", async (c) => {
  const denied = guardAuth(c);
  if (denied) return denied;
  const config = loadConfig();
  const results: Record<string, { ok: boolean; detail: string }> = {};

  // Test Spotify
  if (config.spotify.accessToken && config.spotify.refreshToken) {
    try {
      const { getSpotifyApi } = await import("./spotify/client.js");
      const api = await getSpotifyApi();
      const me = await api.currentUser.profile();
      results.spotify = { ok: true, detail: `Connected as ${me.display_name || me.id}` };
    } catch (err) {
      results.spotify = { ok: false, detail: err instanceof Error ? err.message : String(err) };
    }
  } else if (config.spotify.clientId && config.spotify.clientSecret) {
    results.spotify = { ok: false, detail: "Credentials set but not authenticated. Click 'Connect with Spotify' in the Spotify step." };
  } else {
    results.spotify = { ok: false, detail: "Not configured" };
  }

  // Test Genius
  if (config.genius.accessToken) {
    try {
      const res = await fetch("https://api.genius.com/search?q=test&per_page=1", {
        headers: { Authorization: `Bearer ${config.genius.accessToken}` },
      });
      if (res.ok) {
        results.genius = { ok: true, detail: "API connection verified" };
      } else {
        results.genius = { ok: false, detail: `API returned ${res.status}` };
      }
    } catch (err) {
      results.genius = { ok: false, detail: err instanceof Error ? err.message : String(err) };
    }
  } else {
    results.genius = { ok: false, detail: "Not configured" };
  }

  // Security
  results.security = {
    ok: !!(config.auth.mcpToken),
    detail: config.auth.mcpToken ? "MCP token is set" : "MCP token not configured",
  };

  return c.json(results);
});

// ─── Helper pages ───
function errorPage(title: string, msg: string) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Error</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-900 text-white flex items-center justify-center min-h-screen"><div class="bg-gray-800 rounded-xl p-8 max-w-md text-center"><h1 class="text-xl text-red-400 mb-4">❌ ${escapeHtml(title)}</h1><p class="text-gray-400">${escapeHtml(msg)}</p><a href="/setup" class="inline-block mt-4 px-6 py-2 bg-gray-700 rounded-lg hover:bg-gray-600">Back to Setup</a></div></body></html>`;
}

function successPage(title: string, msg: string) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Success</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-900 text-white flex items-center justify-center min-h-screen"><div class="bg-gray-800 rounded-xl p-8 max-w-md text-center"><h1 class="text-xl text-green-400 mb-4">✅ ${escapeHtml(title)}</h1><p class="text-gray-400">${escapeHtml(msg)}</p><script>setTimeout(()=>window.close(),3000)</script></div></body></html>`;
}

// ─── Start ───
server.start({
  transportType: "httpStream",
  httpStream: { port: PORT, host: "0.0.0.0", stateless: true },
});

console.log(`Music MCP Server running on port ${PORT}`);
console.log(`  MCP endpoint: http://localhost:${PORT}/mcp`);
console.log(`  Setup wizard: http://localhost:${PORT}/setup`);
console.log(`  Health check: http://localhost:${PORT}/health`);
