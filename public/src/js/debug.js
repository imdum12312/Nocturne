(function () {
    const STORAGE_KEY = "nocturne-debug";

    const hud = document.createElement("div");
    hud.id = "debugHud";
    hud.innerHTML = `
        <span class="dh-metric"><span class="dh-label">fps</span><span class="dh-val" id="dhFps">—</span></span>
        <span class="dh-sep">·</span>
        <span class="dh-metric"><span class="dh-label">ping</span><span class="dh-val" id="dhPing">— ms</span></span>
    `;

    const style = document.createElement("style");
    style.textContent = `
        #debugHud {
            position: fixed;
            top: 10px;
            right: 12px;
            z-index: 300;
            display: none;
            align-items: center;
            gap: 8px;
            padding: 5px 10px;
            background: rgba(8, 9, 16, 0.78);
            border: 1px solid rgba(200, 195, 230, 0.12);
            border-radius: 7px;
            backdrop-filter: blur(10px);
            font-family: 'JetBrains Mono', 'Space Mono', monospace;
            font-size: 10px;
            letter-spacing: 0.04em;
            color: #a9a3c7;
            font-variant-numeric: tabular-nums;
            pointer-events: none;
            animation: dhIn 0.2s ease;
        }
        #debugHud.visible { display: inline-flex; }
        @keyframes dhIn {
            from { opacity: 0; transform: translateY(-4px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        #debugHud .dh-metric { display: inline-flex; align-items: baseline; gap: 5px; }
        #debugHud .dh-label { color: #706b8f; font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; }
        #debugHud .dh-val   { color: #e8e5f4; min-width: 42px; text-align: right; }
        #debugHud .dh-val.warn { color: #e0c17c; }
        #debugHud .dh-val.bad  { color: #e07cb8; }
        #debugHud .dh-sep     { color: #3f3c5a; }
    `;
    document.head.appendChild(style);
    document.body.appendChild(hud);

    const fpsEl = hud.querySelector("#dhFps");
    const pingEl = hud.querySelector("#dhPing");

    let frames = 0;
    let lastFpsTime = performance.now();
    let fpsTimer = 0;
    let pingTimer = 0;

    function tickFps(now) {
        frames++;
        const elapsed = now - lastFpsTime;
        if (elapsed >= 500) {
            const fps = Math.round((frames * 1000) / elapsed);
            fpsEl.textContent = fps;
            fpsEl.classList.toggle("warn", fps < 40 && fps >= 20);
            fpsEl.classList.toggle("bad",  fps < 20);
            frames = 0;
            lastFpsTime = now;
        }
        fpsTimer = requestAnimationFrame(tickFps);
    }

    async function tickPing() {
        const t0 = performance.now();
        try {
            const res = await fetch("/ping", { cache: "no-store" });
            if (!res.ok && res.status !== 204) throw new Error();
            const ms = Math.round(performance.now() - t0);
            pingEl.textContent = ms + " ms";
            pingEl.classList.toggle("warn", ms > 60 && ms <= 150);
            pingEl.classList.toggle("bad",  ms > 150);
        } catch {
            pingEl.textContent = "fail";
            pingEl.classList.remove("warn");
            pingEl.classList.add("bad");
        }
    }

    function start() {
        if (fpsTimer) return;
        frames = 0;
        lastFpsTime = performance.now();
        fpsTimer = requestAnimationFrame(tickFps);
        tickPing();
        pingTimer = setInterval(tickPing, 2000);
    }

    function stop() {
        if (fpsTimer) { cancelAnimationFrame(fpsTimer); fpsTimer = 0; }
        if (pingTimer) { clearInterval(pingTimer); pingTimer = 0; }
        fpsEl.textContent = "—";
        pingEl.textContent = "— ms";
        fpsEl.className = "dh-val";
        pingEl.className = "dh-val";
    }

    function apply(on) {
        hud.classList.toggle("visible", !!on);
        if (on) start(); else stop();
    }

    const initial = localStorage.getItem(STORAGE_KEY) === "1";
    apply(initial);

    window.addEventListener("nocturne:debug", e => {
        const on = !!e.detail;
        localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
        apply(on);
    });

    document.addEventListener("keydown", e => {
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "d") {
            e.preventDefault();
            const cur = localStorage.getItem(STORAGE_KEY) === "1";
            window.dispatchEvent(new CustomEvent("nocturne:debug", { detail: !cur }));
        }
    });

})();
