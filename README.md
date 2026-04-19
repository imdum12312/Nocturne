# Nocturne

A midnight-themed web proxy.

Built on the Mercury Workshop stack:

- **Scramjet** — client-side URL + script rewriting (WASM)
- **Epoxy Transport** — HTTPS/WebSocket proxy over Wisp
- **Bare-Mux** — unified bare-client interface
- **Wisp-JS** — single-port multiplexed transport

Server is Express 5. Everything else is static + one websocket upgrade handler.

## Run

```bash
node start.js
# or
npm install && npm start
```

Default port: `8080` (override with `PORT=3000 npm start`).

## Features

- Thin top-of-page **line loader** with `connecting → loading → rendering` stage text and a live duration counter.
- **Hover-prefetch** on quick links — the proxied URL resolves before click.
- **Service worker** caches the Scramjet / Epoxy / Bare-Mux bundles and app shell.
- **Tab cloaks** — Google Classroom, Khan, Docs, Sheets, Gmail, Drive, Canvas, Clever, DeltaMath.
- **Panic key** — `Ctrl+Q` redirects to google.com.
- **Switchable search engine** — DuckDuckGo / Google / Bing / Brave / Startpage (settings).
- **Browser back/forward** — handled via popstate, restores the proxied page.
- Preconnect + DNS-prefetch + wasm preload for faster first nav.

## Structure

```
.
├── index.js               Express + Wisp server
├── start.js               cross-platform launcher
└── public/
    ├── index.html         home + frame shell
    ├── apps.html          curated app list
    ├── math.mjs           transport + scramjet init
    ├── scramworker.js     service worker (proxy + cache)
    ├── bareworker.js      bare-mux shared worker
    ├── scram/             scramjet bundle (wasm + js)
    ├── baremux/           bare-mux module
    ├── epoxy/             epoxy-transport module
    └── src/
        ├── css/           midnight palette + loader + layout
        └── js/            app · loader · boot · bg · performance · prefetch · cloak
```

## Shortcuts

| Key       | Action                       |
|-----------|------------------------------|
| `Ctrl+L`  | Focus URL bar                |
| `Ctrl+Q`  | Panic — redirect to Google   |
| `Esc`     | Close settings               |

## Deploying to a VPS

1. Clone / rsync the repo onto the box.
2. `npm install --omit=dev`.
3. Put it behind a TLS-terminating reverse proxy (Caddy, nginx, Cloudflare).
4. Forward the `/wisp/` websocket upgrade to this process.

Example Caddyfile:

```
nocturne.example.com {
    reverse_proxy localhost:8080
}
```

Caddy passes websockets transparently — no extra config needed.
