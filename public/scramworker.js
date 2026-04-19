try { importScripts("/scram/scramjet.all.js"); }
catch (e) { console.error("[nocturne-sw] scramjet import failed:", e); }

let sw = null;

try {
    if (typeof $scramjetLoadWorker === "function") {
        const { ScramjetServiceWorker } = $scramjetLoadWorker();
        sw = new ScramjetServiceWorker();
    } else {
        throw new Error("$scramjetLoadWorker not available");
    }
} catch (e) { console.error("[nocturne-sw] init failed:", e); }

const CACHE_NAME = "nocturne-v5";
const STATIC_ASSETS = [
    "/",
    "/index.html",
    "/math.mjs",
    "/src/css/global.css",
    "/src/css/home.css",
    "/src/css/toolbar.css",
    "/src/css/loader.css",
    "/src/css/frame.css",
    "/src/css/error.css",
    "/src/css/dock.css",
    "/src/css/settings.css",
    "/src/css/code.css",
    "/src/css/ai.css",
    "/src/js/app.js",
    "/src/js/bg.js",
    "/src/js/loader.js",
    "/src/js/performance.js",
    "/src/js/prefetch.js",
    "/src/js/cloak.js",
    "/src/js/code.js",
    "/src/js/ai.js"
];

// Self-loading config: the SW reads its scramjet config from IDB on demand.
// Retries a few times with short delays in case the client's sc.init() hasn't
// finished writing to IDB when the first fetch lands.
let configLoadPromise = null;

function loadConfigOnce(force) {
    return (async () => {
        try {
            if (force) sw.config = null;
            await sw.loadConfig();
            return !!sw.config;
        } catch (err) {
            return false;
        }
    })();
}

function ensureConfig(force) {
    if (!sw) return Promise.resolve(false);
    if (!force && sw.config) return Promise.resolve(true);
    if (configLoadPromise && !force) return configLoadPromise;
    configLoadPromise = (async () => {
        try {
            for (let attempt = 0; attempt < 20; attempt++) {
                const ok = await loadConfigOnce(force && attempt === 0);
                if (ok) return true;
                await new Promise(r => setTimeout(r, 250));
            }
            return false;
        } finally {
            configLoadPromise = null;
        }
    })();
    return configLoadPromise;
}

self.addEventListener("message", event => {
    if (event.data?.scramjet$type === "loadConfig") ensureConfig(true);
});

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", event => {
    event.waitUntil((async () => {
        await self.clients.claim();
        const names = await caches.keys();
        await Promise.all(names.map(n => n !== CACHE_NAME ? caches.delete(n) : null));

        caches.open(CACHE_NAME).then(cache => {
            for (const url of STATIC_ASSETS) cache.add(url).catch(() => {});
        });
    })());
});

function isBundleAsset(url) {
    return /\/(scram|baremux|epoxy)\//.test(url) || url.endsWith(".wasm");
}

function isAppAsset(url) {
    return /\/src\/(css|js)\//.test(url) || url.endsWith("/math.mjs") || url.endsWith("/index.html");
}

self.addEventListener("fetch", event => {
    const req = event.request;
    const url = req.url;
    const sameOrigin = url.startsWith(self.location.origin);
    const isScramPath = url.includes("/scramjet/");

    let scramHandle = isScramPath;
    if (!scramHandle && sw?.config) {
        try { scramHandle = sw.route(event); }
        catch { scramHandle = false; }
    }

    if (scramHandle) {
        event.respondWith((async () => {
            if (!sw) return new Response("Proxy not initialized", { status: 503 });
            const ok = await ensureConfig(false);
            if (!ok || !sw.fetch) {
                return new Response("Proxy error: config unavailable", { status: 500 });
            }
            try { return await sw.fetch(event); }
            catch (err) {
                return new Response("Proxy error: " + (err.message || String(err)), { status: 500 });
            }
        })());
        return;
    }

    if (sameOrigin && req.method === "GET" && (isBundleAsset(url) || isAppAsset(url))) {
        event.respondWith((async () => {
            const cache = await caches.open(CACHE_NAME);
            const cached = await cache.match(req);
            if (cached && isBundleAsset(url)) return cached;

            try {
                const fresh = await fetch(req);
                if (fresh.ok) cache.put(req, fresh.clone()).catch(() => {});
                return fresh;
            } catch (e) {
                if (cached) return cached;
                throw e;
            }
        })());
    }
});
