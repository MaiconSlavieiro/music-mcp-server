# Music MCP Server

A self-hosted MCP (Model Context Protocol) server that lets AI assistants control Spotify playback, manage playlists, and fetch lyrics and song metadata from Genius — with a built-in web setup wizard.

Works with Kiro, Claude Desktop, Cursor, and any MCP-compatible client.

## Quick Start

### With Docker (recommended)

```bash
cp .env.example .env
# edit .env with your credentials
echo '{}' > config.json
docker compose up -d
```

### Without Docker

```bash
npm install
npm run build
cp .env.example .env
# edit .env
npm start
```

### Development

```bash
npm run dev
```

Once running, open the setup wizard at `http://127.0.0.1:18960/setup`.

## Setup Wizard

The server includes a web wizard that walks you through configuration step by step:

1. **Welcome** — Set the server Base URL (used for OAuth callbacks and MCP endpoint)
2. **Spotify** — Client ID/Secret + OAuth authentication
3. **Genius** — API Access Token
4. **Security** — MCP Bearer token and web interface credentials
5. **Summary** — Tests all integrations and shows the MCP config to copy

## Configuration

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `18960` |
| `BASE_URL` | Public server URL | `http://127.0.0.1:18960` |
| `WEB_USERNAME` | Basic Auth user for the wizard | — |
| `WEB_PASSWORD` | Basic Auth password for the wizard | — |
| `MCP_AUTH_TOKEN` | Bearer token for the MCP endpoint | — |
| `SPOTIFY_CLIENT_ID` | Spotify Client ID | — |
| `SPOTIFY_CLIENT_SECRET` | Spotify Client Secret | — |
| `GENIUS_ACCESS_TOKEN` | Genius Access Token | — |

Environment variables serve as initial bootstrap. Once configured via the wizard, values are persisted in `config.json` and take priority.

### config.json

Local persistence file for tokens, credentials, and application state. Created automatically. Do not commit (already in `.gitignore`).

## Connecting to an MCP Client

Add to your `mcp.json` (Kiro, Claude Desktop, Cursor, etc.):

```json
{
  "mcpServers": {
    "music": {
      "type": "http",
      "url": "http://127.0.0.1:18960/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN_HERE"
      }
    }
  }
}
```

The wizard generates this config automatically on the Summary page.

## Available Tools

### Spotify — Search & Read

| Tool | Description |
|---|---|
| `searchSpotify` | Search for tracks, albums, artists, or playlists |
| `getNowPlaying` | Currently playing track + device and volume info |
| `getMyPlaylists` | Current user's playlists |
| `getPlaylistTracks` | Tracks in a playlist |
| `getRecentlyPlayed` | Recently played tracks |
| `getUsersSavedTracks` | Liked Songs |
| `getQueue` | Playback queue |
| `getAvailableDevices` | Spotify Connect devices |

### Spotify — Playback

| Tool | Description |
|---|---|
| `playMusic` | Play a track, album, artist, or playlist |
| `pausePlayback` | Pause playback |
| `resumePlayback` | Resume playback |
| `skipToNext` | Skip to next track |
| `skipToPrevious` | Skip to previous track |
| `addToQueue` | Add item to queue |
| `setVolume` | Set volume (0-100) |
| `adjustVolume` | Adjust volume by relative amount |

### Spotify — Playlists

| Tool | Description |
|---|---|
| `createPlaylist` | Create a new playlist |
| `addTracksToPlaylist` | Add tracks to a playlist |
| `getPlaylist` | Get playlist details |
| `updatePlaylist` | Update name, description, visibility |
| `removeTracksFromPlaylist` | Remove tracks from a playlist |
| `reorderPlaylistItems` | Reorder tracks in a playlist |

### Spotify — Albums

| Tool | Description |
|---|---|
| `getAlbums` | Get album details by ID(s) |
| `getAlbumTracks` | Get tracks from an album |
| `saveOrRemoveAlbumForUser` | Save or remove albums from library |
| `checkUsersSavedAlbums` | Check if albums are saved |

### Spotify — Library

| Tool | Description |
|---|---|
| `removeUsersSavedTracks` | Remove tracks from Liked Songs |

### Genius

| Tool | Description |
|---|---|
| `searchGeniusSong` | Search for songs on Genius |
| `getLyrics` | Get full song lyrics |
| `getSongInfo` | Song metadata (producers, writers, release date, etc.) |
| `getGeniusArtistInfo` | Artist info + top songs |

## HTTP Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | Health check |
| GET | `/setup` | Basic | Setup wizard |
| GET | `/mcp` | Bearer | MCP endpoint (httpStream) |
| GET | `/api/status` | Basic | Integration status |
| GET | `/api/test-all` | Basic | Test all integrations |
| GET | `/icon.svg` | — | Server icon |

## Getting Credentials

### Spotify

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Create an app
3. Add the Redirect URI: `{BASE_URL}/spotify/callback`
4. Copy the Client ID and Client Secret

> **Important:** Spotify does not allow `localhost` as a Redirect URI. The current rules are:
> - HTTPS is required, except for loopback addresses
> - For local development, use the explicit IP: `http://127.0.0.1:18960/spotify/callback` or `http://[::1]:18960/spotify/callback`
> - `localhost` is not permitted
>
> For HTTPS access (required in production), see the options below.

#### Exposing the Server

**Cloudflare Tunnel (recommended for personal use)**

Creates a secure tunnel without opening ports or configuring certificates:

```bash
# install cloudflared and authenticate
cloudflared tunnel login
cloudflared tunnel create music-mcp

# run the tunnel pointing to the local server
cloudflared tunnel --url http://localhost:18960
```

Cloudflare generates a `https://*.trycloudflare.com` URL that can be used as the Base URL and Redirect URI in Spotify.

For a fixed subdomain, set up a named tunnel with a DNS route on your domain.

**ngrok**

```bash
ngrok http 18960
```

Generates a temporary HTTPS URL. Useful for quick tests, but the URL changes on every restart (unless you use a fixed domain on the paid plan).

**Reverse proxy (production)**

Nginx, Caddy, or Traefik with an SSL certificate pointing to the server. Example with Caddy:

```
music.yourdomain.com {
    reverse_proxy localhost:18960
}
```

Caddy automatically provisions Let's Encrypt certificates.

### Genius

1. Go to [genius.com/api-clients](https://genius.com/api-clients)
2. Create a new API Client:
   - **App Name:** Music MCP Server
   - **Icon URL:** `{BASE_URL}/icon.svg`
   - **App Website URL:** `{BASE_URL}`
   - **Redirect URI:** `http://localhost`
3. Click "Generate Access Token" and copy it

## Architecture

```
src/
├── index.ts              # Entry point, tool registration, and HTTP routes
├── config.ts             # Config persistence (config.json + env vars)
├── cache.ts              # In-memory cache with TTL
├── auth/
│   └── rate-limiter.ts   # Rate limiting for Basic Auth
├── spotify/
│   ├── client.ts         # Spotify SDK, token refresh, helpers
│   ├── tools.ts          # Search and read tools
│   ├── playback-tools.ts # Playback control tools
│   ├── playlist-tools.ts # Playlist management tools
│   └── album-tools.ts    # Album tools
├── genius/
│   ├── client.ts         # Genius API client + lyrics scraping
│   └── tools.ts          # Genius tools
└── web/
    └── pages.ts          # Setup wizard HTML
```

- **MCP Framework:** [fastmcp](https://github.com/jlowin/fastmcp) with httpStream transport
- **HTTP:** Hono (via fastmcp)
- **Spotify SDK:** [@spotify/web-api-ts-sdk](https://github.com/spotify/spotify-web-api-ts-sdk)
- **Validation:** Zod
- **Lyrics:** Cheerio (Genius scraping)

## License

[MIT](LICENSE)
