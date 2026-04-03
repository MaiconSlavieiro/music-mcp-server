import { loadConfig, getBaseUrl } from "../config.js";
import { isSpotifyAuthenticated } from "../spotify/client.js";
import { isGeniusConfigured } from "../genius/client.js";

function layout(title: string, step: number, body: string): string {
  const steps = [
    { label: "Welcome", href: "/setup" },
    { label: "Spotify", href: "/setup/spotify" },
    { label: "Genius", href: "/setup/genius" },
    { label: "Security", href: "/setup/security" },
    { label: "Summary", href: "/setup/summary" },
  ];
  const nav = steps.map((s, i) => {
    const num = i + 1;
    const active = num === step;
    const done = num < step;
    const cls = active ? "bg-indigo-600 text-white" : done ? "bg-green-600 text-white" : "bg-gray-700 text-gray-400";
    const icon = done ? '<i data-lucide="check" class="w-4 h-4"></i>' : `${num}`;
    const textCls = active ? "text-white font-semibold" : "text-gray-400 hover:text-white";
    return `<a href="${s.href}" class="flex items-center gap-2 cursor-pointer transition"><span class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${cls}">${icon}</span><span class="${textCls}">${s.label}</span></a>`;
  }).join('<div class="w-8 h-px bg-gray-600"></div>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${title} — Music MCP Setup</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
  <script>
    const _fetch = window.fetch;
    window.fetch = (url, opts = {}) => _fetch(url, { ...opts, credentials: 'include' });
  </script>
</head>
<body class="bg-gray-900 text-white min-h-screen">
  <div class="max-w-2xl mx-auto py-12 px-4">
    <div class="flex items-center gap-3 mb-2">
      <i data-lucide="music" class="w-7 h-7 text-indigo-400"></i>
      <h1 class="text-2xl font-bold">Music MCP Server</h1>
    </div>
    <p class="text-gray-400 mb-8">Setup Wizard</p>
    <div class="flex items-center gap-2 mb-10 flex-wrap">${nav}</div>
    <div class="bg-gray-800 rounded-xl p-8">${body}</div>
  </div>
  <script>lucide.createIcons();</script>
</body>
</html>`;
}

function statusBadge(ok: boolean, label: string): string {
  return ok
    ? `<span class="flex items-center gap-1.5 text-green-400"><i data-lucide="check-circle" class="w-4 h-4"></i> ${label}</span>`
    : `<span class="flex items-center gap-1.5 text-yellow-400"><i data-lucide="alert-circle" class="w-4 h-4"></i> ${label}</span>`;
}

export function getWizardHtml(): string {
  const spotifyOk = isSpotifyAuthenticated();
  const geniusOk = isGeniusConfigured();
  const config = loadConfig();
  const securityOk = !!(config.auth.mcpToken && config.auth.webUsername && config.auth.webPasswordHash);
  const allConfigured = spotifyOk && geniusOk && securityOk;

  // If everything is pre-configured, redirect to summary
  if (allConfigured) {
    return `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/setup/summary"></head><body></body></html>`;
  }

  return layout("Welcome", 1, `
    <h2 class="text-xl font-semibold mb-4">Welcome</h2>
    <p class="text-gray-400 mb-6">This wizard will help you configure the integrations for your Music MCP Server.</p>

    <div class="mb-8 p-4 bg-gray-700/50 rounded-lg">
      <label class="block text-sm font-medium mb-1 flex items-center gap-1.5"><i data-lucide="globe" class="w-4 h-4 text-indigo-400"></i> Server Base URL</label>
      <p class="text-xs text-gray-500 mb-2">The public URL where this server is accessible. Used for OAuth callbacks and MCP endpoint.</p>
      <div class="flex gap-2">
        <input type="text" id="baseUrl" value="${escapeHtml(getBaseUrl())}" class="flex-1 bg-gray-700 rounded-lg px-4 py-2 text-white border border-gray-600 focus:border-indigo-500 focus:outline-none font-mono text-sm" placeholder="https://music.example.com">
        <button type="button" id="saveBaseUrl" class="flex items-center gap-1.5 px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 text-sm"><i data-lucide="save" class="w-3.5 h-3.5"></i> Save</button>
      </div>
      <div id="baseUrlMsg" class="mt-2 text-sm"></div>
    </div>

    <div class="space-y-4 mb-8">
      <div class="flex justify-between items-center p-4 bg-gray-700/50 rounded-lg">
        <div class="flex items-center gap-3"><i data-lucide="disc-3" class="w-5 h-5 text-green-400"></i><div><span class="font-medium">Spotify</span><br><span class="text-sm text-gray-400">Playback, playlists, library</span></div></div>
        ${statusBadge(spotifyOk, spotifyOk ? "Connected" : "Not configured")}
      </div>
      <div class="flex justify-between items-center p-4 bg-gray-700/50 rounded-lg">
        <div class="flex items-center gap-3"><i data-lucide="mic-vocal" class="w-5 h-5 text-purple-400"></i><div><span class="font-medium">Genius</span><br><span class="text-sm text-gray-400">Lyrics, song metadata</span></div></div>
        ${statusBadge(geniusOk, geniusOk ? "Configured" : "Not configured")}
      </div>
      <div class="flex justify-between items-center p-4 bg-gray-700/50 rounded-lg">
        <div class="flex items-center gap-3"><i data-lucide="shield-check" class="w-5 h-5 text-blue-400"></i><div><span class="font-medium">Security</span><br><span class="text-sm text-gray-400">MCP token, web credentials</span></div></div>
        ${statusBadge(securityOk, securityOk ? "Configured" : "Not configured")}
      </div>
    </div>
    <a href="/setup/spotify" class="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 rounded-lg font-semibold hover:bg-indigo-500 transition">Start Setup <i data-lucide="arrow-right" class="w-4 h-4"></i></a>

    <script>
      document.getElementById('saveBaseUrl').addEventListener('click', async () => {
        const baseUrl = document.getElementById('baseUrl').value.replace(/\\/$/, '');
        const res = await fetch('/api/server/base-url', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ baseUrl }) });
        if (res.ok) {
          document.getElementById('baseUrlMsg').innerHTML = '<span class="flex items-center gap-1.5 text-green-400"><i data-lucide="check-circle" class="w-4 h-4"></i> Base URL saved!</span>';
          lucide.createIcons();
        }
      });
    </script>
  `);
}

export function getSpotifySetupHtml(): string {
  const config = loadConfig();
  const authenticated = isSpotifyAuthenticated();
  const baseUrl = getBaseUrl();
  const callbackUrl = `${baseUrl}/spotify/callback`;

  return layout("Spotify", 2, `
    <h2 class="text-xl font-semibold mb-4 flex items-center gap-2"><i data-lucide="disc-3" class="w-5 h-5 text-green-400"></i> Spotify Integration</h2>

    <p class="text-gray-400 mb-2">Create an app at <a href="https://developer.spotify.com/dashboard" target="_blank" class="text-indigo-400 underline inline-flex items-center gap-1">Spotify Developer Dashboard <i data-lucide="external-link" class="w-3 h-3"></i></a></p>
    <p class="text-gray-400 mb-2">Set the Redirect URI in your Spotify app to:</p>
    <p class="mb-4"><code class="bg-gray-900 px-2 py-1 rounded text-green-300 text-sm">${escapeHtml(callbackUrl)}</code></p>
    <div class="mb-6 p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg text-xs text-yellow-300/80">
      <i data-lucide="alert-triangle" class="w-3.5 h-3.5 inline-block mr-1 -mt-0.5"></i>
      Spotify does not allow <code class="bg-gray-900 px-1 rounded">localhost</code> as redirect URI. Use <code class="bg-gray-900 px-1 rounded">http://127.0.0.1:PORT</code> for local dev, or HTTPS via a tunnel (Cloudflare Tunnel, ngrok, etc.).
    </div>

    <form id="spotifyForm" class="space-y-4 mb-6">
      <div>
        <label class="block text-sm font-medium mb-1">Client ID</label>
        <input type="text" id="clientId" value="${escapeHtml(config.spotify.clientId)}" class="w-full bg-gray-700 rounded-lg px-4 py-2 text-white border border-gray-600 focus:border-indigo-500 focus:outline-none font-mono text-sm" placeholder="Enter Client ID">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Client Secret</label>
        <input type="password" id="clientSecret" value="${config.spotify.clientSecret ? '••••••••' : ''}" class="w-full bg-gray-700 rounded-lg px-4 py-2 text-white border border-gray-600 focus:border-indigo-500 focus:outline-none" placeholder="Enter Client Secret">
      </div>
      <button type="submit" class="flex items-center gap-2 px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 transition"><i data-lucide="save" class="w-4 h-4"></i> Save Credentials</button>
    </form>

    <div id="authSection" class="${config.spotify.clientId ? "" : "hidden"}">
      ${authenticated
        ? '<p class="flex items-center gap-2 text-green-400 mb-4"><i data-lucide="check-circle" class="w-5 h-5"></i> Spotify is connected and authenticated.</p><button id="reauthBtn" class="flex items-center gap-2 px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-500"><i data-lucide="refresh-cw" class="w-4 h-4"></i> Re-authenticate</button>'
        : '<p class="flex items-center gap-2 text-yellow-400 mb-4"><i data-lucide="alert-circle" class="w-5 h-5"></i> Credentials saved but not yet authenticated.</p><button id="authBtn" class="flex items-center gap-2 px-6 py-2 bg-green-600 rounded-lg hover:bg-green-500 font-semibold"><i data-lucide="log-in" class="w-4 h-4"></i> Connect with Spotify</button>'
      }
    </div>

    <div id="statusMsg" class="mt-4 text-sm"></div>

    <div class="flex justify-between mt-8">
      <a href="/setup" class="flex items-center gap-1.5 px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600"><i data-lucide="arrow-left" class="w-4 h-4"></i> Back</a>
      <a href="/setup/genius" class="flex items-center gap-1.5 px-6 py-3 bg-indigo-600 rounded-lg font-semibold hover:bg-indigo-500">Next: Genius <i data-lucide="arrow-right" class="w-4 h-4"></i></a>
    </div>

    <script>
      document.getElementById('spotifyForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const clientSecret = document.getElementById('clientSecret').value;
        const body = { clientId: document.getElementById('clientId').value };
        if (clientSecret && clientSecret !== '••••••••') body.clientSecret = clientSecret;
        const res = await fetch('/api/spotify/credentials', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
        if (res.ok) {
          document.getElementById('statusMsg').innerHTML = '<span class="flex items-center gap-1.5 text-green-400"><i data-lucide="check-circle" class="w-4 h-4"></i> Credentials saved!</span>';
          document.getElementById('authSection').classList.remove('hidden');
          lucide.createIcons();
        }
      });

      let pollInterval = null;
      document.addEventListener('click', async (e) => {
        if (e.target.id === 'authBtn' || e.target.id === 'reauthBtn' || e.target.closest('#authBtn') || e.target.closest('#reauthBtn')) {
          const res = await fetch('/api/spotify/auth-url');
          const data = await res.json();
          if (data.url) {
            window.open(data.url, '_blank', 'width=500,height=700');
            document.getElementById('statusMsg').innerHTML = '<span class="flex items-center gap-1.5 text-yellow-400"><i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Waiting for Spotify authorization...</span>';
            lucide.createIcons();
            if (pollInterval) clearInterval(pollInterval);
            pollInterval = setInterval(async () => {
              const sr = await fetch('/api/status');
              const st = await sr.json();
              if (st.spotify?.authenticated) {
                clearInterval(pollInterval);
                document.getElementById('statusMsg').innerHTML = '<span class="flex items-center gap-1.5 text-green-400"><i data-lucide="check-circle" class="w-4 h-4"></i> Spotify connected!</span>';
                document.getElementById('authSection').innerHTML = '<p class="flex items-center gap-2 text-green-400 mb-4"><i data-lucide="check-circle" class="w-5 h-5"></i> Spotify is connected and authenticated.</p><button id="reauthBtn" class="flex items-center gap-2 px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-500"><i data-lucide="refresh-cw" class="w-4 h-4"></i> Re-authenticate</button>';
                lucide.createIcons();
              }
            }, 2000);
            setTimeout(() => { if (pollInterval) clearInterval(pollInterval); }, 300000);
          } else {
            document.getElementById('statusMsg').innerHTML = '<span class="flex items-center gap-1.5 text-red-400"><i data-lucide="x-circle" class="w-4 h-4"></i> ' + (data.error || 'Error') + '</span>';
            lucide.createIcons();
          }
        }
      });
    </script>
  `);
}

export function getGeniusSetupHtml(): string {
  const config = loadConfig();
  const configured = isGeniusConfigured();

  return layout("Genius", 3, `
    <h2 class="text-xl font-semibold mb-4 flex items-center gap-2"><i data-lucide="mic-vocal" class="w-5 h-5 text-purple-400"></i> Genius Integration</h2>

    <div class="mb-6 p-4 bg-gray-700/50 rounded-lg text-sm text-gray-300 space-y-2">
      <p class="font-medium text-white flex items-center gap-1.5"><i data-lucide="info" class="w-4 h-4 text-blue-400"></i> How to get your Genius Access Token:</p>
      <ol class="list-decimal list-inside space-y-1 ml-1">
        <li>Go to <a href="https://genius.com/api-clients" target="_blank" class="text-indigo-400 underline inline-flex items-center gap-1">genius.com/api-clients <i data-lucide="external-link" class="w-3 h-3"></i></a></li>
        <li>Click <strong>"New API Client"</strong> and fill in the required fields:</li>
      </ol>
      <div class="ml-5 mt-1 mb-1 space-y-1 text-xs">
        <div class="flex gap-2"><span class="text-gray-400 w-28 shrink-0">App Name:</span> <code class="bg-gray-900 px-1.5 rounded">Music MCP Server</code> <span class="text-gray-500">(or any name you like)</span></div>
        <div class="flex gap-2"><span class="text-gray-400 w-28 shrink-0">Icon URL:</span> <code class="bg-gray-900 px-1.5 rounded">${escapeHtml(getBaseUrl())}/icon.svg</code></div>
        <div class="flex gap-2"><span class="text-gray-400 w-28 shrink-0">App Website URL:</span> <code class="bg-gray-900 px-1.5 rounded">${escapeHtml(getBaseUrl())}</code></div>
        <div class="flex gap-2"><span class="text-gray-400 w-28 shrink-0">Redirect URI:</span> <code class="bg-gray-900 px-1.5 rounded">http://localhost</code> <span class="text-gray-500">(not used, but required)</span></div>
      </div>
      <ol class="list-decimal list-inside space-y-1 ml-1" start="3">
        <li>Click <strong>"Save"</strong>, then click <strong>"Generate Access Token"</strong></li>
        <li>Copy the token and paste it below</li>
      </ol>
    </div>

    <form id="geniusForm" class="space-y-4 mb-6">
      <div>
        <label class="block text-sm font-medium mb-1">Client Access Token</label>
        <input type="text" id="geniusToken" value="${escapeHtml(config.genius.accessToken)}" class="w-full bg-gray-700 rounded-lg px-4 py-2 text-white border border-gray-600 focus:border-indigo-500 focus:outline-none font-mono text-sm" placeholder="Paste your Genius Client Access Token here">
      </div>
      <div class="flex gap-3">
        <button type="submit" class="flex items-center gap-2 px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-500"><i data-lucide="save" class="w-4 h-4"></i> Save Token</button>
        <button type="button" id="testBtn" class="flex items-center gap-2 px-6 py-2 bg-purple-600 rounded-lg hover:bg-purple-500"><i data-lucide="plug-zap" class="w-4 h-4"></i> Test Connection</button>
      </div>
    </form>

    ${configured
      ? '<p class="flex items-center gap-2 text-green-400 mb-4"><i data-lucide="check-circle" class="w-5 h-5"></i> Genius is configured.</p>'
      : '<p class="flex items-center gap-2 text-yellow-400 mb-4"><i data-lucide="alert-circle" class="w-5 h-5"></i> Genius not configured yet.</p>'
    }
    <div id="statusMsg" class="mt-4 text-sm"></div>

    <div class="flex justify-between mt-8">
      <a href="/setup/spotify" class="flex items-center gap-1.5 px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600"><i data-lucide="arrow-left" class="w-4 h-4"></i> Spotify</a>
      <a href="/setup/security" class="flex items-center gap-1.5 px-6 py-3 bg-indigo-600 rounded-lg font-semibold hover:bg-indigo-500">Next: Security <i data-lucide="arrow-right" class="w-4 h-4"></i></a>
    </div>

    <script>
      document.getElementById('geniusForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = document.getElementById('geniusToken').value.trim();
        if (!token) { document.getElementById('statusMsg').innerHTML = '<span class="flex items-center gap-1.5 text-red-400"><i data-lucide="x-circle" class="w-4 h-4"></i> Token cannot be empty</span>'; lucide.createIcons(); return; }
        const res = await fetch('/api/genius/token', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ token }) });
        if (res.ok) {
          document.getElementById('statusMsg').innerHTML = '<span class="flex items-center gap-1.5 text-green-400"><i data-lucide="check-circle" class="w-4 h-4"></i> Token saved!</span>';
          lucide.createIcons();
        }
      });

      document.getElementById('testBtn').addEventListener('click', async () => {
        const token = document.getElementById('geniusToken').value.trim();
        if (!token) { document.getElementById('statusMsg').innerHTML = '<span class="flex items-center gap-1.5 text-red-400"><i data-lucide="x-circle" class="w-4 h-4"></i> Enter a token first</span>'; lucide.createIcons(); return; }
        document.getElementById('statusMsg').innerHTML = '<span class="flex items-center gap-1.5 text-gray-400"><i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Testing connection...</span>';
        lucide.createIcons();
        const res = await fetch('/api/genius/test', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ token }) });
        const data = await res.json();
        document.getElementById('statusMsg').innerHTML = data.ok
          ? '<span class="flex items-center gap-1.5 text-green-400"><i data-lucide="check-circle" class="w-4 h-4"></i> Connection works! Found: "' + data.result + '"</span>'
          : '<span class="flex items-center gap-1.5 text-red-400"><i data-lucide="x-circle" class="w-4 h-4"></i> ' + data.error + '</span>';
        lucide.createIcons();
      });
    </script>
  `);
}

export function getSecuritySetupHtml(): string {
  const config = loadConfig();

  return layout("Security", 4, `
    <h2 class="text-xl font-semibold mb-4 flex items-center gap-2"><i data-lucide="shield-check" class="w-5 h-5 text-blue-400"></i> Security Settings</h2>
    <p class="text-gray-400 mb-6">Configure authentication for the MCP endpoint and this web interface.</p>

    <form id="securityForm" class="space-y-6 mb-6">
      <div>
        <label class="block text-sm font-medium mb-1">MCP Bearer Token</label>
        <p class="text-xs text-gray-500 mb-2">Used by Kiro/Claude/Cursor to authenticate with the MCP endpoint.</p>
        <div class="flex gap-2">
          <input type="text" id="mcpToken" value="${escapeHtml(config.auth.mcpToken)}" class="flex-1 bg-gray-700 rounded-lg px-4 py-2 text-white border border-gray-600 focus:border-indigo-500 focus:outline-none font-mono text-sm">
          <button type="button" id="copyTokenBtn" class="flex items-center gap-1 px-3 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 text-sm" title="Copy"><i data-lucide="clipboard-copy" class="w-4 h-4"></i></button>
          <button type="button" id="genTokenBtn" class="flex items-center gap-1.5 px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 text-sm"><i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Generate</button>
        </div>
      </div>
      <hr class="border-gray-700">
      <div>
        <label class="block text-sm font-medium mb-1">Web Username</label>
        <input type="text" id="webUsername" value="${escapeHtml(config.auth.webUsername)}" class="w-full bg-gray-700 rounded-lg px-4 py-2 text-white border border-gray-600 focus:border-indigo-500 focus:outline-none">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Web Password</label>
        <input type="password" id="webPassword" placeholder="Enter new password (leave empty to keep current)" class="w-full bg-gray-700 rounded-lg px-4 py-2 text-white border border-gray-600 focus:border-indigo-500 focus:outline-none">
      </div>
      <button type="submit" class="flex items-center gap-2 px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-500"><i data-lucide="save" class="w-4 h-4"></i> Save Security Settings</button>
    </form>

    <div id="statusMsg" class="mt-4 text-sm"></div>

    <div class="flex justify-between mt-8">
      <a href="/setup/genius" class="flex items-center gap-1.5 px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600"><i data-lucide="arrow-left" class="w-4 h-4"></i> Genius</a>
      <a href="/setup/summary" class="flex items-center gap-1.5 px-6 py-3 bg-indigo-600 rounded-lg font-semibold hover:bg-indigo-500">Next: Summary <i data-lucide="arrow-right" class="w-4 h-4"></i></a>
    </div>

    <script>
      document.getElementById('genTokenBtn').addEventListener('click', async () => {
        const res = await fetch('/api/generate-token');
        const data = await res.json();
        document.getElementById('mcpToken').value = data.token;
        const saveRes = await fetch('/api/security', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ mcpToken: data.token }) });
        if (saveRes.ok) {
          document.getElementById('statusMsg').innerHTML = '<span class="flex items-center gap-1.5 text-green-400"><i data-lucide="check-circle" class="w-4 h-4"></i> New token generated and saved!</span>';
          lucide.createIcons();
        }
      });

      document.getElementById('copyTokenBtn').addEventListener('click', () => {
        navigator.clipboard.writeText(document.getElementById('mcpToken').value).then(() => {
          document.getElementById('copyTokenBtn').innerHTML = '<i data-lucide="check" class="w-4 h-4 text-green-400"></i>';
          lucide.createIcons();
          setTimeout(() => { document.getElementById('copyTokenBtn').innerHTML = '<i data-lucide="clipboard-copy" class="w-4 h-4"></i>'; lucide.createIcons(); }, 1500);
        });
      });

      document.getElementById('securityForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = { mcpToken: document.getElementById('mcpToken').value, webUsername: document.getElementById('webUsername').value };
        const pwd = document.getElementById('webPassword').value;
        if (pwd) body.webPassword = pwd;
        const res = await fetch('/api/security', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
        if (res.ok) {
          document.getElementById('statusMsg').innerHTML = '<span class="flex items-center gap-1.5 text-green-400"><i data-lucide="check-circle" class="w-4 h-4"></i> Security settings saved!</span>';
          lucide.createIcons();
        }
      });
    </script>
  `);
}

export function getSummaryHtml(): string {
  const config = loadConfig();
  const baseUrl = getBaseUrl();
  const authenticated = isSpotifyAuthenticated();

  const mcpConfig = JSON.stringify({
    mcpServers: {
      music: {
        type: "http",
        url: `${baseUrl}/mcp`,
        ...(config.auth.mcpToken ? { headers: { Authorization: `Bearer ${config.auth.mcpToken}` } } : {}),
      }
    }
  }, null, 2);

  return layout("Summary", 5, `
    <h2 class="text-xl font-semibold mb-4 flex items-center gap-2"><i data-lucide="list-checks" class="w-5 h-5 text-green-400"></i> Status & Connection Tests</h2>
    <p class="text-gray-400 mb-4">Verifying all integrations with live API calls...</p>

    <div id="testResults" class="space-y-3 mb-6">
      <div class="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg"><i data-lucide="loader" class="w-5 h-5 text-gray-400 animate-spin"></i><span>Spotify — Testing...</span></div>
      <div class="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg"><i data-lucide="loader" class="w-5 h-5 text-gray-400 animate-spin"></i><span>Genius — Testing...</span></div>
      <div class="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg"><i data-lucide="loader" class="w-5 h-5 text-gray-400 animate-spin"></i><span>Security — Checking...</span></div>
    </div>

    <div id="actions" class="flex flex-wrap gap-3 mb-8">
      <button id="retestBtn" class="flex items-center gap-2 px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 text-sm"><i data-lucide="refresh-cw" class="w-4 h-4"></i> Re-test All</button>
      ${!authenticated && config.spotify.clientId ? '<button id="spotifyAuthBtn" class="flex items-center gap-2 px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500 text-sm"><i data-lucide="log-in" class="w-4 h-4"></i> Connect Spotify</button>' : ''}
      <button id="geniusTestBtn" class="flex items-center gap-2 px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-500 text-sm"><i data-lucide="plug-zap" class="w-4 h-4"></i> Test Genius</button>
    </div>

    <div id="actionMsg" class="text-sm mb-6"></div>

    <div class="mb-6">
      <h3 class="font-medium mb-2 flex items-center gap-2"><i data-lucide="code" class="w-4 h-4 text-gray-400"></i> MCP Client Configuration</h3>
      <p class="text-sm text-gray-400 mb-2">Add this to your Kiro/Claude/Cursor MCP config:</p>
      <div class="relative">
        <pre id="mcpConfigPre" class="bg-gray-900 rounded-lg p-4 pr-20 text-sm font-mono overflow-x-auto text-green-300">${escapeHtml(mcpConfig)}</pre>
        <button id="copyConfigBtn" class="absolute top-2 right-2 flex items-center gap-1 px-2.5 py-1.5 bg-gray-700 rounded hover:bg-gray-600 text-xs"><i data-lucide="clipboard-copy" class="w-3.5 h-3.5"></i> Copy</button>
      </div>
    </div>

    <div class="flex justify-between mt-8">
      <a href="/setup/security" class="flex items-center gap-1.5 px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600"><i data-lucide="arrow-left" class="w-4 h-4"></i> Security</a>
      <a href="/setup" class="flex items-center gap-1.5 px-6 py-3 bg-green-600 rounded-lg font-semibold hover:bg-green-500"><i data-lucide="home" class="w-4 h-4"></i> Dashboard</a>
    </div>

    <script>
      async function runTests() {
        const container = document.getElementById('testResults');
        container.innerHTML = [
          '<div class="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg"><i data-lucide="loader" class="w-5 h-5 text-gray-400 animate-spin"></i><span>Spotify — Testing...</span></div>',
          '<div class="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg"><i data-lucide="loader" class="w-5 h-5 text-gray-400 animate-spin"></i><span>Genius — Testing...</span></div>',
          '<div class="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg"><i data-lucide="loader" class="w-5 h-5 text-gray-400 animate-spin"></i><span>Security — Checking...</span></div>',
        ].join('');
        lucide.createIcons();

        const res = await fetch('/api/test-all');
        const data = await res.json();
        const row = (ok, label, detail, action) => {
          const icon = ok ? '<i data-lucide="check-circle" class="w-5 h-5 text-green-400 shrink-0"></i>' : '<i data-lucide="x-circle" class="w-5 h-5 text-red-400 shrink-0"></i>';
          const actionHtml = action || '';
          return '<div class="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg"><div class="flex items-center gap-3">' + icon + '<div><span class="font-medium">' + label + '</span><br><span class="text-sm text-gray-400">' + detail + '</span></div></div>' + actionHtml + '</div>';
        };

        const spotifyAction = !data.spotify?.ok && data.spotify?.detail?.includes('not authenticated')
          ? '<button id="spotifyAuthBtn2" class="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 rounded-lg hover:bg-green-500 text-xs shrink-0"><i data-lucide="log-in" class="w-3.5 h-3.5"></i> Connect</button>'
          : '';

        container.innerHTML =
          row(data.spotify?.ok, 'Spotify', data.spotify?.detail || 'Unknown', spotifyAction) +
          row(data.genius?.ok, 'Genius', data.genius?.detail || 'Unknown', '') +
          row(data.security?.ok, 'Security', data.security?.detail || 'Unknown', '');
        lucide.createIcons();
      }

      runTests();

      document.getElementById('retestBtn').addEventListener('click', runTests);

      // Spotify auth from summary
      document.addEventListener('click', async (e) => {
        const btn = e.target.closest('#spotifyAuthBtn, #spotifyAuthBtn2');
        if (!btn) return;
        const res = await fetch('/api/spotify/auth-url');
        const data = await res.json();
        if (data.url) {
          window.open(data.url, '_blank', 'width=500,height=700');
          document.getElementById('actionMsg').innerHTML = '<span class="flex items-center gap-1.5 text-yellow-400"><i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Waiting for Spotify authorization...</span>';
          lucide.createIcons();
          const poll = setInterval(async () => {
            const sr = await fetch('/api/status');
            const st = await sr.json();
            if (st.spotify?.authenticated) {
              clearInterval(poll);
              document.getElementById('actionMsg').innerHTML = '<span class="flex items-center gap-1.5 text-green-400"><i data-lucide="check-circle" class="w-4 h-4"></i> Spotify connected!</span>';
              lucide.createIcons();
              runTests();
            }
          }, 2000);
          setTimeout(() => clearInterval(poll), 300000);
        } else {
          document.getElementById('actionMsg').innerHTML = '<span class="flex items-center gap-1.5 text-red-400"><i data-lucide="x-circle" class="w-4 h-4"></i> ' + (data.error || 'Error') + '</span>';
          lucide.createIcons();
        }
      });

      // Genius test from summary
      document.getElementById('geniusTestBtn').addEventListener('click', async () => {
        document.getElementById('actionMsg').innerHTML = '<span class="flex items-center gap-1.5 text-gray-400"><i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Testing Genius...</span>';
        lucide.createIcons();
        const res = await fetch('/api/genius/test', { method: 'POST', headers: {'Content-Type':'application/json'}, body: '{}' });
        const data = await res.json();
        document.getElementById('actionMsg').innerHTML = data.ok
          ? '<span class="flex items-center gap-1.5 text-green-400"><i data-lucide="check-circle" class="w-4 h-4"></i> Genius works! Found: "' + data.result + '"</span>'
          : '<span class="flex items-center gap-1.5 text-red-400"><i data-lucide="x-circle" class="w-4 h-4"></i> ' + data.error + '</span>';
        lucide.createIcons();
      });

      document.getElementById('copyConfigBtn').addEventListener('click', () => {
        navigator.clipboard.writeText(document.getElementById('mcpConfigPre').textContent).then(() => {
          document.getElementById('copyConfigBtn').innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5 text-green-400"></i> Copied';
          lucide.createIcons();
          setTimeout(() => { document.getElementById('copyConfigBtn').innerHTML = '<i data-lucide="clipboard-copy" class="w-3.5 h-3.5"></i> Copy'; lucide.createIcons(); }, 1500);
        });
      });
    </script>
  `);
}

export function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
