// Nocturne — web proxy server
// Express + Wisp over a single HTTP listener. Serves the static frontend,
// the Scramjet/Epoxy/Bare-Mux bundles from node_modules, and routes
// websocket upgrades into wisp-js for transport.

import { server as wisp } from "@mercuryworkshop/wisp-js/server";
import express from "express";
import compression from "compression";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// wisp: allow private ranges so VPS containers and self-tests work
wisp.options.allow_loopback_ips = true;
wisp.options.allow_private_ips = true;

const app = express();
const PORT = process.env.PORT || 8080;

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(compression({ level: 6, threshold: 1024 }));

// Cache strategy:
//   bundles + wasm → long-lived immutable (hashed builds)
//   html/js/css    → no-store so the shell updates on refresh
app.use((req, res, next) => {
    const p = req.path;
    if (/\/(scram|baremux|epoxy)\//.test(p) || p.endsWith(".wasm")) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else if (/\.(js|mjs|css|html)$/.test(p)) {
        res.setHeader("Cache-Control", "no-store");
    }
    next();
});

app.get("/ping", (req, res) => res.status(204).end());

app.use("/epoxy", express.static(path.join(__dirname, "node_modules/@mercuryworkshop/epoxy-transport/dist")));
app.use("/baremux", express.static(path.join(__dirname, "node_modules/@mercuryworkshop/bare-mux/dist")));

app.get("/bareworker.js", (req, res) => {
    res.sendFile(path.join(__dirname, "node_modules/@mercuryworkshop/bare-mux/dist/worker.js"));
});

app.use(express.static(path.join(__dirname, "public"), {
    extensions: ["html"],
    setHeaders: (res, filePath) => {
        if (filePath.endsWith(".wasm")) res.setHeader("Content-Type", "application/wasm");
    }
}));

// SPA fallback. /scramjet/* means the service worker isn't controlling yet.
app.use((req, res) => {
    if (req.path.startsWith("/scramjet/")) {
        res.status(503).type("text/plain").send("Service worker not active. Please refresh the page.");
        return;
    }
    res.sendFile(path.join(__dirname, "public/index.html"));
});

const server = http.createServer(app);

// Route websocket upgrades into wisp. Strip cookies so upstreams don't
// see our session context leak through.
server.on("upgrade", (request, socket, head) => {
    if (request.headers["cookie"]) delete request.headers["cookie"];
    wisp.routeRequest(request, socket, head);
});

process.on("uncaughtException", err => console.error("[nocturne] uncaught:", err));
process.on("unhandledRejection", reason => console.error("[nocturne] unhandled:", reason));

function shutdown(sig) {
    console.log(`\n[nocturne] ${sig} received, closing...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

server.listen(PORT, () => {
    const bar = "─".repeat(46);
    console.log();
    console.log("  \x1b[1m\x1b[35mNOCTURNE\x1b[0m");
    console.log(`  \x1b[2m${bar}\x1b[0m`);
    console.log(`  \x1b[2mlistening\x1b[0m  http://localhost:${PORT}`);
    console.log(`  \x1b[2mnode\x1b[0m       ${process.version}`);
    console.log();
});
