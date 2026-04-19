import { getProxied } from "/math.mjs";
import { initPerformance } from "/src/js/performance.js";
import { mountLoader } from "/src/js/loader.js";
import { wireHoverPrefetch, prefetchedUrl } from "/src/js/prefetch.js";
import { listCloaks, applyCloak, restoreCloak, reset as resetCloak } from "/src/js/cloak.js";

const frame = document.getElementById("frame");
const toolbar = document.getElementById("toolbar");
const homePage = document.getElementById("homePage");
const errorPage = document.getElementById("errorPage");
const errDetail = document.getElementById("errDetail");

const searchForm = document.getElementById("searchForm");
const searchHome = document.getElementById("searchHome");
const urlBar = document.getElementById("urlBar");

const settingsPanel = document.getElementById("settingsPanel");
const dockHome = document.getElementById("dockHome");
const dockSettings = document.getElementById("dockSettings");

const fxToggle = document.getElementById("fxToggle");
const cloakSelect = document.getElementById("cloakSelect");
const engineSelect = document.getElementById("engineSelect");

const btnBack = document.getElementById("btnBack");
const btnFwd  = document.getElementById("btnFwd");

const loader = mountLoader(document.getElementById("lineLoader"));

const ENGINES = {
    duckduckgo: { label: "DuckDuckGo", url: q => "https://duckduckgo.com/?q=" + encodeURIComponent(q) },
    google:     { label: "Google",     url: q => "https://www.google.com/search?q=" + encodeURIComponent(q) },
    bing:       { label: "Bing",       url: q => "https://www.bing.com/search?q=" + encodeURIComponent(q) },
    brave:      { label: "Brave",      url: q => "https://search.brave.com/search?q=" + encodeURIComponent(q) },
    startpage:  { label: "Startpage",  url: q => "https://www.startpage.com/do/search?q=" + encodeURIComponent(q) }
};

let currentEngine = localStorage.getItem("nocturne-engine") || "duckduckgo";
let lastURL = "";
let navStack = [];
let navIndex = -1;
let loadWatchdog = null;

function obfuscate(url) {
    try { return btoa(url).replace(/=+$/, ""); }
    catch { return btoa(encodeURIComponent(url)).replace(/=+$/, ""); }
}
function deobfuscate(s) {
    try { return atob(s); }
    catch { try { return decodeURIComponent(atob(s)); } catch { return null; } }
}

function clearWatchdog() {
    if (loadWatchdog) { clearTimeout(loadWatchdog); loadWatchdog = null; }
}

function showError(detail) {
    clearWatchdog();
    loader.fail();
    frame.classList.remove("visible");
    errorPage.classList.add("visible");
    if (errDetail && detail) errDetail.textContent = detail;
}

function finishLoad() {
    clearWatchdog();
    try {
        const doc = frame.contentDocument;
        if (doc) {
            const body = (doc.body && doc.body.innerText) || "";
            if (body.startsWith("Proxy error:")) return showError(body.slice(0, 160));
            if (body.startsWith("Service worker not active")) return showError("Service worker not active. Reload to recover.");
        }
    } catch {}
    loader.finish();
    frame.classList.add("visible");
}

function showHome(pushHistory = true) {
    clearWatchdog();
    loader.fail();
    frame.classList.remove("visible");
    frame.removeAttribute("src");
    toolbar.classList.remove("visible");
    homePage.style.display = "";
    errorPage.classList.remove("visible");
    if (pushHistory) history.pushState(null, "", "/");
    navStack = [];
    navIndex = -1;
    updateNavButtons();
}

function updateNavButtons() {
    btnBack.disabled = navIndex <= 0;
    btnFwd.disabled  = navIndex >= navStack.length - 1;
}

async function load(url, addToHistory = true) {
    try {
        clearWatchdog();

        try {
            const parsed = new URL(url);
            if (parsed.hostname === "localhost" || parsed.origin === location.origin) {
                return showError("Cannot proxy local addresses.");
            }
        } catch {}

        lastURL = url;
        errorPage.classList.remove("visible");
        if (errDetail) errDetail.textContent = "";

        toolbar.classList.add("visible");
        homePage.style.display = "none";
        frame.classList.remove("visible");

        if (addToHistory) {
            history.pushState(null, "", "/search/" + obfuscate(url));
            navStack = navStack.slice(0, navIndex + 1);
            navStack.push(url);
            navIndex = navStack.length - 1;
        }
        updateNavButtons();
        urlBar.value = url;
        loader.start();

        let proxied = prefetchedUrl(url);
        if (!proxied) {
            try { proxied = await getProxied(url); }
            catch (err) { return showError(err.message); }
        }

        loader.stage("loading");

        let loaded = false;
        frame.onload = () => {
            loaded = true;
            loader.stage("rendering");
            setTimeout(finishLoad, 60);
        };
        frame.onerror = () => showError("Failed to load page.");
        frame.src = proxied;

        setTimeout(() => {
            if (!loaded) frame.classList.add("visible");
        }, 1500);

        loadWatchdog = setTimeout(() => {
            if (loaded) return;
            clearWatchdog();
            loader.finish();
            frame.classList.add("visible");
        }, 25000);
    } catch (err) {
        showError(err.message || "Unknown error");
    }
}

function parseInput(value) {
    const v = (value || "").trim();
    if (!v) return null;
    if (/^https?:\/\//i.test(v)) return v;
    if (!v.includes(" ") && (v.includes(".") || v.startsWith("localhost"))) return "https://" + v;
    return ENGINES[currentEngine].url(v);
}

searchForm.addEventListener("submit", e => {
    e.preventDefault();
    const url = parseInput(searchHome.value);
    if (url) { searchHome.value = ""; load(url); }
});

urlBar.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    const url = parseInput(urlBar.value);
    if (url) load(url);
});

btnBack.addEventListener("click", () => {
    if (navIndex > 0) { navIndex--; updateNavButtons(); load(navStack[navIndex], false); }
});
btnFwd.addEventListener("click", () => {
    if (navIndex < navStack.length - 1) { navIndex++; updateNavButtons(); load(navStack[navIndex], false); }
});
document.getElementById("btnReload").addEventListener("click", () => { if (lastURL) load(lastURL, false); });
document.getElementById("btnFullscreen").addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else frame.requestFullscreen?.();
});

document.getElementById("retryBtn").addEventListener("click", () => { if (lastURL) load(lastURL, false); });
document.getElementById("homeFromErrorBtn").addEventListener("click", () => showHome());

dockHome.addEventListener("click", () => showHome());
dockSettings.addEventListener("click", e => {
    e.stopPropagation();
    settingsPanel.classList.toggle("open");
});

document.addEventListener("click", e => {
    if (!settingsPanel.contains(e.target) && !dockSettings.contains(e.target)) {
        settingsPanel.classList.remove("open");
    }
});

fxToggle.addEventListener("change", () => {
    const on = fxToggle.checked;
    window.dispatchEvent(new CustomEvent("nocturne:bgfx", { detail: on }));
    localStorage.setItem("nocturne-bgfx", on ? "1" : "0");
});
if (localStorage.getItem("nocturne-bgfx") === "0") {
    fxToggle.checked = false;
    fxToggle.dispatchEvent(new Event("change"));
}

const debugToggle = document.getElementById("debugToggle");
if (debugToggle) {
    debugToggle.checked = localStorage.getItem("nocturne-debug") === "1";
    debugToggle.addEventListener("change", () => {
        window.dispatchEvent(new CustomEvent("nocturne:debug", { detail: debugToggle.checked }));
    });
}

for (const id in ENGINES) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = ENGINES[id].label;
    engineSelect.appendChild(opt);
}
engineSelect.value = currentEngine;
engineSelect.addEventListener("change", () => {
    currentEngine = engineSelect.value;
    localStorage.setItem("nocturne-engine", currentEngine);
});

cloakSelect.innerHTML = '<option value="">Off</option>' +
    listCloaks().map(c => `<option value="${c.id}">${c.title.replace(/"/g, "&quot;")}</option>`).join("");
cloakSelect.value = localStorage.getItem("nocturne-cloak") || "";
cloakSelect.addEventListener("change", () => {
    const v = cloakSelect.value;
    if (v) applyCloak(v); else resetCloak();
});
restoreCloak();

document.getElementById("resetProxyBtn").addEventListener("click", () => {
    localStorage.setItem("nocturne-reset", "true");
    location.reload();
});

document.querySelectorAll(".link-btn[data-url]").forEach(btn => {
    btn.addEventListener("click", () => load(btn.getAttribute("data-url")));
});

wireHoverPrefetch();

document.addEventListener("keydown", e => {
    if (e.ctrlKey && e.key.toLowerCase() === "q") {
        e.preventDefault();
        window.location.replace("https://www.google.com");
        return;
    }
    if (e.ctrlKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        if (toolbar.classList.contains("visible")) { urlBar.focus(); urlBar.select(); }
        else searchHome.focus();
        return;
    }
    if (e.key === "Escape" && settingsPanel.classList.contains("open")) {
        settingsPanel.classList.remove("open");
    }
});

window.addEventListener("popstate", () => {
    const p = window.location.pathname;
    if (p.startsWith("/search/")) {
        const decoded = deobfuscate(p.slice(8));
        if (decoded) load(decoded, false);
    } else {
        showHome(false);
    }
});

const initPath = window.location.pathname;
if (initPath.startsWith("/search/")) {
    const decoded = deobfuscate(initPath.slice(8));
    if (decoded) load(decoded);
}

updateNavButtons();
initPerformance();
