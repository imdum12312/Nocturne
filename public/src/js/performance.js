export function initPerformance() {
    const run = () => {
        optimizeNetworking();
        optimizeFrame();
        preloadCriticalAssets();
    };
    if ("requestIdleCallback" in window) requestIdleCallback(run);
    else setTimeout(run, 80);
}

function optimizeNetworking() {
    const head = document.head;

    const preconnects = [
        "https://discord.com",
        "https://cdn.discordapp.com",
        "https://twitter.com",
        "https://x.com",
        "https://www.youtube.com",
        "https://m.youtube.com",
        "https://www.google.com",
        "https://www.reddit.com",
        "https://i.redd.it",
        "https://duckduckgo.com"
    ];
    for (const url of preconnects) {
        const l = document.createElement("link");
        l.rel = "preconnect";
        l.href = url;
        l.crossOrigin = "anonymous";
        head.appendChild(l);
    }

    const dns = [
        "https://abs.twimg.com",
        "https://pbs.twimg.com",
        "https://yt3.ggpht.com",
        "https://i.ytimg.com"
    ];
    for (const url of dns) {
        const l = document.createElement("link");
        l.rel = "dns-prefetch";
        l.href = url;
        head.appendChild(l);
    }
}

function preloadCriticalAssets() {
    const wasm = document.createElement("link");
    wasm.rel = "preload";
    wasm.as = "fetch";
    wasm.type = "application/wasm";
    wasm.crossOrigin = "anonymous";
    wasm.href = "/scram/scramjet.wasm.wasm";
    document.head.appendChild(wasm);
}

function optimizeFrame() {
    const frame = document.getElementById("frame");
    if (!frame) return;
    frame.setAttribute("loading", "eager");
    frame.setAttribute("fetchpriority", "high");
    frame.style.contain = "layout style paint";
}
