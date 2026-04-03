# Music MCP Server

Servidor MCP (Model Context Protocol) unificado para **Spotify** e **Genius**, com setup wizard web integrado.

Permite que assistentes de IA (Kiro, Claude, Cursor, etc.) controlem playback do Spotify, gerenciem playlists, busquem letras e metadados de músicas via Genius — tudo através de um único endpoint MCP.

## Quick Start

### Com Docker (recomendado)

```bash
cp .env.example .env
# edite o .env com suas credenciais
echo '{}' > config.json
docker compose up -d
```

### Sem Docker

```bash
npm install
npm run build
cp .env.example .env
# edite o .env
npm start
```

### Desenvolvimento

```bash
npm run dev
```

Após iniciar, acesse o setup wizard em `http://localhost:18960/setup`.

## Setup Wizard

O servidor inclui um wizard web que guia a configuração passo a passo:

1. **Welcome** — Define a Base URL do servidor (usada para OAuth callbacks e endpoint MCP)
2. **Spotify** — Client ID/Secret + autenticação OAuth
3. **Genius** — Access Token da API
4. **Security** — Token MCP (Bearer) e credenciais da interface web
5. **Summary** — Testa todas as integrações e exibe a config MCP para copiar

## Configuração

### Variáveis de Ambiente

| Variável | Descrição | Default |
|---|---|---|
| `PORT` | Porta do servidor | `18960` |
| `BASE_URL` | URL pública do servidor | `http://localhost:18960` |
| `WEB_USERNAME` | Usuário para Basic Auth do wizard | — |
| `WEB_PASSWORD` | Senha para Basic Auth do wizard | — |
| `MCP_AUTH_TOKEN` | Bearer token para o endpoint MCP | — |
| `SPOTIFY_CLIENT_ID` | Client ID do Spotify | — |
| `SPOTIFY_CLIENT_SECRET` | Client Secret do Spotify | — |
| `GENIUS_ACCESS_TOKEN` | Access Token do Genius | — |

As variáveis de ambiente servem como bootstrap inicial. Após configurar via wizard, os valores são persistidos em `config.json` e têm prioridade.

### config.json

Arquivo de persistência local com tokens, credenciais e estado da aplicação. Criado automaticamente. Não commitar (já está no `.gitignore`).

## Conectando ao MCP Client

Adicione ao seu `mcp.json` (Kiro, Claude Desktop, Cursor, etc.):

```json
{
  "mcpServers": {
    "music": {
      "type": "http",
      "url": "http://localhost:18960/mcp",
      "headers": {
        "Authorization": "Bearer SEU_TOKEN_AQUI"
      }
    }
  }
}
```

O wizard gera essa config automaticamente na página Summary.

## Tools Disponíveis

### Spotify — Busca e Leitura

| Tool | Descrição |
|---|---|
| `searchSpotify` | Busca tracks, albums, artists ou playlists |
| `getNowPlaying` | Track tocando agora + device e volume |
| `getMyPlaylists` | Playlists do usuário |
| `getPlaylistTracks` | Tracks de uma playlist |
| `getRecentlyPlayed` | Histórico recente |
| `getUsersSavedTracks` | Músicas curtidas (Liked Songs) |
| `getQueue` | Fila de reprodução |
| `getAvailableDevices` | Dispositivos Spotify Connect |

### Spotify — Playback

| Tool | Descrição |
|---|---|
| `playMusic` | Tocar track, album, artist ou playlist |
| `pausePlayback` | Pausar |
| `resumePlayback` | Retomar |
| `skipToNext` | Próxima faixa |
| `skipToPrevious` | Faixa anterior |
| `addToQueue` | Adicionar à fila |
| `setVolume` | Definir volume (0-100) |
| `adjustVolume` | Ajustar volume relativamente |

### Spotify — Playlists

| Tool | Descrição |
|---|---|
| `createPlaylist` | Criar playlist |
| `addTracksToPlaylist` | Adicionar tracks |
| `getPlaylist` | Detalhes de uma playlist |
| `updatePlaylist` | Atualizar nome, descrição, visibilidade |
| `removeTracksFromPlaylist` | Remover tracks |
| `reorderPlaylistItems` | Reordenar tracks |

### Spotify — Albums

| Tool | Descrição |
|---|---|
| `getAlbums` | Detalhes de album(s) |
| `getAlbumTracks` | Tracks de um album |
| `saveOrRemoveAlbumForUser` | Salvar/remover album da biblioteca |
| `checkUsersSavedAlbums` | Verificar se albums estão salvos |

### Spotify — Library

| Tool | Descrição |
|---|---|
| `removeUsersSavedTracks` | Remover tracks das Liked Songs |

### Genius

| Tool | Descrição |
|---|---|
| `searchGeniusSong` | Buscar músicas no Genius |
| `getLyrics` | Letra completa de uma música |
| `getSongInfo` | Metadados (produtores, escritores, data, etc.) |
| `getGeniusArtistInfo` | Info do artista + top songs |

## Endpoints HTTP

| Método | Path | Auth | Descrição |
|---|---|---|---|
| GET | `/health` | — | Health check |
| GET | `/setup` | Basic | Wizard de configuração |
| GET | `/mcp` | Bearer | Endpoint MCP (httpStream) |
| GET | `/api/status` | Basic | Status das integrações |
| GET | `/api/test-all` | Basic | Testa todas as integrações |
| GET | `/icon.svg` | — | Ícone do servidor |

## Obtendo Credenciais

### Spotify

1. Acesse [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Crie um app
3. Adicione o Redirect URI: `{BASE_URL}/spotify/callback`
4. Copie Client ID e Client Secret

> **Importante:** O Spotify não aceita `localhost` como Redirect URI. As regras atuais são:
> - Use HTTPS, exceto para loopback addresses
> - Para desenvolvimento local, use o IP explícito: `http://127.0.0.1:18960/spotify/callback` ou `http://[::1]:18960/spotify/callback`
> - `localhost` não é permitido
>
> Para expor o servidor com HTTPS (necessário em produção e recomendado em dev), veja as opções abaixo.

#### Expondo o servidor

**Cloudflare Tunnel (recomendado para uso pessoal)**

Cria um túnel seguro sem precisar abrir portas ou configurar certificados:

```bash
# instalar cloudflared e autenticar
cloudflared tunnel login
cloudflared tunnel create music-mcp

# rodar o túnel apontando para o servidor local
cloudflared tunnel --url http://localhost:18960
```

O Cloudflare gera uma URL `https://*.trycloudflare.com` que pode ser usada como Base URL e Redirect URI no Spotify.

Para um subdomínio fixo, configure um tunnel nomeado com DNS route no seu domínio.

**ngrok**

```bash
ngrok http 18960
```

Gera uma URL HTTPS temporária. Útil para testes rápidos, mas a URL muda a cada reinício (a menos que use um domínio fixo no plano pago).

**Reverse proxy (produção)**

Nginx, Caddy ou Traefik com certificado SSL apontando para o servidor. Exemplo com Caddy:

```
music.seudominio.com {
    reverse_proxy localhost:18960
}
```

Caddy gera certificados Let's Encrypt automaticamente.

### Genius

1. Acesse [genius.com/api-clients](https://genius.com/api-clients)
2. Crie um novo API Client:
   - **App Name:** Music MCP Server
   - **Icon URL:** `{BASE_URL}/icon.svg`
   - **App Website URL:** `{BASE_URL}`
   - **Redirect URI:** `http://localhost`
3. Clique em "Generate Access Token" e copie

## Arquitetura

```
src/
├── index.ts              # Entry point, registro de tools e rotas HTTP
├── config.ts             # Persistência de config (config.json + env vars)
├── cache.ts              # Cache em memória com TTL
├── auth/
│   └── rate-limiter.ts   # Rate limiting para Basic Auth
├── spotify/
│   ├── client.ts         # SDK do Spotify, token refresh, helpers
│   ├── tools.ts          # Tools de busca e leitura
│   ├── playback-tools.ts # Tools de controle de playback
│   ├── playlist-tools.ts # Tools de gerenciamento de playlists
│   └── album-tools.ts    # Tools de albums
├── genius/
│   ├── client.ts         # Cliente da API Genius + scraping de letras
│   └── tools.ts          # Tools do Genius
└── web/
    └── pages.ts          # HTML do setup wizard
```

- **Framework MCP:** [fastmcp](https://github.com/jlowin/fastmcp) com transporte httpStream
- **HTTP:** Hono (via fastmcp)
- **Spotify SDK:** [@spotify/web-api-ts-sdk](https://github.com/spotify/spotify-web-api-ts-sdk)
- **Validação:** Zod
- **Lyrics:** Cheerio (scraping do Genius)
