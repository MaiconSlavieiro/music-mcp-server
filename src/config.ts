import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { scryptSync, randomBytes, timingSafeEqual, createHash } from "node:crypto";

const CONFIG_PATH = join(process.cwd(), "config.json");

let cachedConfig: AppConfig | null = null;

export interface SpotifyConfig {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface GeniusConfig {
  accessToken: string;
}

export interface AuthConfig {
  mcpToken: string;
  webUsername: string;
  webPasswordHash: string;
}

export interface ServerConfig {
  baseUrl: string; // e.g. "http://localhost:18960" or "https://music.example.com"
}

export interface AppConfig {
  server: ServerConfig;
  spotify: SpotifyConfig;
  genius: GeniusConfig;
  auth: AuthConfig;
}

const DEFAULT_CONFIG: AppConfig = {
  server: { baseUrl: "" },
  spotify: { clientId: "", clientSecret: "", accessToken: "", refreshToken: "", expiresAt: 0 },
  genius: { accessToken: "" },
  auth: { mcpToken: "", webUsername: "", webPasswordHash: "" },
};

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  // New format: "salt:hash"
  if (stored.includes(":")) {
    const [salt, hash] = stored.split(":");
    const inputHash = scryptSync(password, salt, 64);
    return timingSafeEqual(inputHash, Buffer.from(hash, "hex"));
  }
  // Legacy fallback: plain SHA-256 (will be replaced on next password change)
  const legacyHash = Buffer.from(createHash("sha256").update(password).digest("hex"), "hex");
  const storedHash = Buffer.from(stored, "hex");
  if (legacyHash.length !== storedHash.length) return false;
  return timingSafeEqual(legacyHash, storedHash);
}

export function generateToken(length = 64): string {
  return randomBytes(length).toString("base64url");
}

export function loadConfig(): AppConfig {
  if (cachedConfig) return structuredClone(cachedConfig);

  let config: AppConfig = structuredClone(DEFAULT_CONFIG);

  if (existsSync(CONFIG_PATH)) {
    try {
      const raw = readFileSync(CONFIG_PATH, "utf-8");
      const saved = JSON.parse(raw);
      config = { ...config, ...saved, server: { ...config.server, ...saved.server }, spotify: { ...config.spotify, ...saved.spotify }, genius: { ...config.genius, ...saved.genius }, auth: { ...config.auth, ...saved.auth } };
    } catch { /* use defaults */ }
  }

  // Env vars override (initial bootstrap)
  if (process.env.BASE_URL && !config.server.baseUrl) config.server.baseUrl = process.env.BASE_URL.replace(/\/$/, "");
  if (process.env.MCP_AUTH_TOKEN && !config.auth.mcpToken) config.auth.mcpToken = process.env.MCP_AUTH_TOKEN;
  if (process.env.WEB_USERNAME && !config.auth.webUsername) config.auth.webUsername = process.env.WEB_USERNAME;
  if (process.env.WEB_PASSWORD && !config.auth.webPasswordHash) config.auth.webPasswordHash = hashPassword(process.env.WEB_PASSWORD);
  if (process.env.SPOTIFY_CLIENT_ID && !config.spotify.clientId) config.spotify.clientId = process.env.SPOTIFY_CLIENT_ID;
  if (process.env.SPOTIFY_CLIENT_SECRET && !config.spotify.clientSecret) config.spotify.clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (process.env.GENIUS_ACCESS_TOKEN && !config.genius.accessToken) config.genius.accessToken = process.env.GENIUS_ACCESS_TOKEN;

  cachedConfig = config;
  return config;
}

export function saveConfig(config: AppConfig): void {
  try {
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
    cachedConfig = config;
  } catch (err) {
    console.error(`Failed to save config to ${CONFIG_PATH}:`, err);
  }
}

/**
 * Resolves the base URL for the server.
 * Priority: config.json > BASE_URL env > fallback to localhost:PORT
 */
export function getBaseUrl(): string {
  const config = loadConfig();
  if (config.server.baseUrl) return config.server.baseUrl;
  const port = process.env.PORT || "18960";
  return `http://localhost:${port}`;
}
