import { BareMuxConnection } from "/baremux/index.mjs";

const NOCTURNE_VERSION = "5";

async function clearOldSW() {
    if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) await r.unregister();
    }
    await new Promise(r => setTimeout(r, 200));
}

if (window.self === window.top) {
    const storedVer = localStorage.getItem("nocturne-version");
    const resetFlag = localStorage.getItem("nocturne-reset");
    if (storedVer !== NOCTURNE_VERSION || resetFlag === "true") {
        await clearOldSW();
        await new Promise(resolve => {
            const req = indexedDB.deleteDatabase("$scramjet");
            req.onsuccess = resolve;
            req.onerror = resolve;
            req.onblocked = () => setTimeout(resolve, 400);
        });
        localStorage.setItem("nocturne-version", NOCTURNE_VERSION);
        localStorage.removeItem("nocturne-reset");
    }
}

async function registerSW() {
    if (!navigator.serviceWorker) throw new Error("Service workers not supported.");
    const existing = await navigator.serviceWorker.getRegistration("/");
    if (existing) existing.update().catch(() => {});
    else await navigator.serviceWorker.register("/scramworker.js", { scope: "/", updateViaCache: "none" });

    await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, rej) => setTimeout(() => rej(new Error("SW ready timeout")), 8000))
    ]);

    if (!navigator.serviceWorker.controller) {
        await new Promise(resolve => {
            navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true });
            setTimeout(resolve, 2500);
        });
    }
}

if (window.self === window.top) {
    try { await registerSW(); }
    catch (e) { localStorage.setItem("nocturne-reset", "true"); }
}

const connection = new BareMuxConnection("/bareworker.js");
const EPOXY_URL = "/epoxy/index.mjs";

function makeTransportCode() {
    return 'const { default: EpoxyBase } = await import("' + EPOXY_URL + '");\
function fixHeaders(h) {\
    if (!h) return h;\
    if (typeof h[Symbol.iterator] === "function") return h;\
    return Object.entries(h);\
}\
function entriesToObj(h) {\
    if (!h || typeof h !== "object") return h;\
    if (!Array.isArray(h)) return h;\
    const obj = {};\
    for (let i = 0; i < h.length; i++) {\
        const pair = h[i];\
        if (Array.isArray(pair) && pair.length >= 2) {\
            const key = pair[0].toLowerCase();\
            obj[key] = obj[key] ? obj[key] + ", " + pair[1] : pair[1];\
        }\
    }\
    return obj;\
}\
class EpoxyWrapped extends EpoxyBase {\
    async request(remote, method, body, headers, signal) {\
        const resp = await super.request(remote, method, body, fixHeaders(headers), signal);\
        resp.headers = entriesToObj(resp.headers);\
        return resp;\
    }\
    connect(url, protocols, reqHeaders, onopen, onmessage, onclose, onerror) {\
        return super.connect(url, protocols, fixHeaders(reqHeaders), onopen, onmessage, onclose, onerror);\
    }\
}\
return [EpoxyWrapped, "' + EPOXY_URL + '"];';
}

let _transportReady = Promise.resolve();

if (window.self === window.top) {
    const wispProto = location.protocol === "https:" ? "wss:" : "ws:";
    const wispUrl = wispProto + "//" + location.host + "/wisp/";

    _transportReady = (async () => {
        const code = makeTransportCode();
        const opts = [{ wisp: wispUrl }];
        const attempt = () => connection.setManualTransport(code, opts);

        try {
            await Promise.race([
                attempt(),
                new Promise((_, r) => setTimeout(() => r(new Error("timeout")), 7000))
            ]);
            window.dispatchEvent(new CustomEvent("nocturne:transport", { detail: { ok: true } }));
        } catch (e) {
            await new Promise(r => setTimeout(r, 400));
            try {
                await attempt();
                window.dispatchEvent(new CustomEvent("nocturne:transport", { detail: { ok: true } }));
            } catch (e2) {
                window.dispatchEvent(new CustomEvent("nocturne:transport", { detail: { ok: false, error: e2.message } }));
            }
        }
    })();
}

async function loadScramjetScript() {
    if (window.$scramjetLoadController) return;
    await new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = "/scram/scramjet.all.js";
        s.async = true;
        s.onload = res;
        s.onerror = rej;
        document.head.appendChild(s);
    });
}

function buildController() {
    const loader = window.$scramjetLoadController();
    return new loader.ScramjetController({
        files: {
            wasm: "/scram/scramjet.wasm.wasm",
            all: "/scram/scramjet.all.js",
            sync: "/scram/scramjet.sync.js"
        },
        flags: {
            rewriterLogs: false,
            captureErrors: true,
            cleanErrors: true,
            sourcemaps: false,
            scramitize: false
        },
        siteFlags: {
            ".*": {
                aggressive: true,
                rewriteUrls: true,
                handleWebSockets: true
            },
            "https?://(?:www\\.|m\\.)?youtube\\.com.*": {
                aggressive: true,
                rewriteUrls: true,
                handleWebSockets: true
            },
            "https?://(?:.*\\.)?googlevideo\\.com.*": {
                aggressive: true,
                rewriteUrls: true
            },
            "https?://(?:.*\\.)?ytimg\\.com.*": {
                rewriteUrls: true
            },
            "https?://(?:.*\\.)?wikipedia\\.org.*": {
                aggressive: true,
                rewriteUrls: true
            },
            "https?://(?:.*\\.)?wikimedia\\.org.*": {
                aggressive: true,
                rewriteUrls: true
            },
            "https?://(?:.*\\.)?discord(?:app)?\\.com.*": {
                aggressive: true,
                rewriteUrls: true,
                handleWebSockets: true
            },
            "https?://(?:.*\\.)?(?:twitter|x)\\.com.*": {
                aggressive: true,
                rewriteUrls: true
            },
            "https?://(?:.*\\.)?reddit\\.com.*": {
                aggressive: true,
                rewriteUrls: true
            }
        }
    });
}

function pingSWConfig() {
    const c = navigator.serviceWorker?.controller;
    if (!c) return;
    try { c.postMessage({ scramjet$type: "loadConfig" }); } catch {}
}

async function initScramjet() {
    let sc = buildController();
    try {
        await sc.init();
        window.__scramjet = sc;
        pingSWConfig();
        setTimeout(pingSWConfig, 400);
        setTimeout(pingSWConfig, 1200);
        window.dispatchEvent(new CustomEvent("nocturne:scramjet", { detail: { ok: true } }));
        return;
    } catch (e) {}

    try { if (sc.db) sc.db.close(); } catch {}
    await new Promise(resolve => {
        const req = indexedDB.deleteDatabase("$scramjet");
        req.onsuccess = resolve;
        req.onerror = resolve;
        req.onblocked = () => setTimeout(resolve, 400);
    });

    sc = buildController();
    await sc.init();
    window.__scramjet = sc;
    pingSWConfig();
    setTimeout(pingSWConfig, 400);
    setTimeout(pingSWConfig, 1200);
    window.dispatchEvent(new CustomEvent("nocturne:scramjet", { detail: { ok: true } }));
}

if (window.self === window.top) {
    (async () => {
        try {
            await loadScramjetScript();
            if ("locks" in navigator) await navigator.locks.request("nocturne-scramjet", initScramjet);
            else await initScramjet();
        } catch (e) {
            localStorage.setItem("nocturne-reset", "true");
            window.dispatchEvent(new CustomEvent("nocturne:scramjet", { detail: { ok: false, error: e.message } }));
        }
    })();
}

function waitFor(fn, ms = 30000) {
    return new Promise((resolve, reject) => {
        if (fn()) return resolve();
        const deadline = setTimeout(() => { clearInterval(t); reject(new Error("Proxy not ready (timeout)")); }, ms);
        const t = setInterval(() => {
            if (fn()) { clearInterval(t); clearTimeout(deadline); resolve(); }
        }, 60);
    });
}

export async function getProxied(url) {
    await Promise.all([
        waitFor(() => !!window.__scramjet),
        _transportReady
    ]);
    return window.__scramjet.encodeUrl(url);
}
