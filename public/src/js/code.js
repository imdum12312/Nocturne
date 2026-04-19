const WELCOME = `// nocturne · editor
// monaco, typed out just for you.

function greet(name) {
  return \`hello, \${name}\`;
}

const stack = {
  transport: "wisp + epoxy",
  rewriter:  "scramjet",
  shell:     "express 5",
};

console.log(greet("friend"));
console.table(stack);

// press \u2318S / ctrl+S to save, \u2325\u21E7F to format, run to execute.
`;

const STORAGE_KEY = "nocturne-editor";
const FILENAME_KEY = "nocturne-editor-filename";
const LANG_KEY = "nocturne-editor-lang";
const PREFS_KEY = "nocturne-editor-prefs";

const EXT_BY_LANG = {
    javascript: "js", typescript: "ts", python: "py", html: "html", css: "css",
    json: "json", markdown: "md", sql: "sql", rust: "rs", go: "go", plaintext: "txt"
};
const LANG_BY_EXT = {
    js: "javascript", mjs: "javascript", cjs: "javascript",
    ts: "typescript", tsx: "typescript",
    py: "python",
    html: "html", htm: "html",
    css: "css",
    json: "json",
    md: "markdown", markdown: "markdown",
    sql: "sql",
    rs: "rust",
    go: "go",
    txt: "plaintext"
};

const TEMPLATES = [
    { id: "js-starter",   lang: "javascript", name: "JavaScript", desc: "Hello + console demo.",
      code: `console.log("hello from nocturne");\n\nconst data = [1, 2, 3, 4, 5];\nconst doubled = data.map(n => n * 2);\nconsole.table({ data, doubled });\n` },
    { id: "ts-starter",   lang: "typescript", name: "TypeScript", desc: "Typed functions, interfaces.",
      code: `type User = { name: string; age: number };\n\nfunction describe(u: User): string {\n  return \`\${u.name} (\${u.age})\`;\n}\n\nconst u: User = { name: "Ada", age: 30 };\nconsole.log(describe(u));\n` },
    { id: "html-page",    lang: "html",       name: "HTML page", desc: "Minimal document.",
      code: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>Page</title>\n  <style>\n    body { font-family: sans-serif; background: #0a0b14; color: #eae6ff; padding: 40px; }\n    h1 { color: #c9c1ff; }\n  </style>\n</head>\n<body>\n  <h1>Hello, night.</h1>\n  <p>This is a starter page.</p>\n</body>\n</html>\n` },
    { id: "html-canvas",  lang: "html",       name: "Canvas sketch", desc: "Animated canvas.",
      code: `<!DOCTYPE html>\n<html><head><style>body{margin:0;background:#05060d}canvas{display:block}</style></head>\n<body>\n<canvas id="c" width="600" height="400"></canvas>\n<script>\nconst c = document.getElementById("c").getContext("2d");\nlet t = 0;\nfunction draw(){\n  c.fillStyle = "rgba(5,6,13,0.2)";\n  c.fillRect(0,0,600,400);\n  for(let i=0;i<40;i++){\n    const a = t*0.01 + i*0.1;\n    const x = 300 + Math.cos(a)*(100+i*3);\n    const y = 200 + Math.sin(a*1.3)*(80+i*2);\n    c.fillStyle = \`hsla(\${(i*8+t)%360}, 70%, 70%, 0.5)\`;\n    c.beginPath(); c.arc(x,y,2,0,Math.PI*2); c.fill();\n  }\n  t++;\n  requestAnimationFrame(draw);\n}\ndraw();\n<\/script>\n</body></html>\n` },
    { id: "css-demo",     lang: "css",        name: "CSS demo", desc: "Style helpers applied.",
      code: `body {\n  background: #0a0b14;\n  color: #eae6ff;\n  font-family: system-ui, sans-serif;\n  padding: 40px;\n}\n\nh1 { color: #c9c1ff; letter-spacing: -0.02em; }\n\n.box {\n  padding: 16px 20px;\n  background: rgba(200,195,230,0.05);\n  border: 1px solid rgba(200,195,230,0.12);\n  border-radius: 10px;\n  margin: 10px 0;\n}\n\n.card { box-shadow: 0 20px 40px rgba(0,0,0,0.4); }\n\n.primary {\n  background: linear-gradient(180deg, #b8b0da, #8a80b6);\n  color: #0a0b14;\n  font-weight: 600;\n}\n\nbutton {\n  padding: 8px 18px;\n  border-radius: 8px;\n  border: 1px solid rgba(200,195,230,0.2);\n  background: transparent;\n  color: inherit;\n  cursor: pointer;\n}\n` },
    { id: "json-pkg",     lang: "json",       name: "JSON", desc: "Small object tree.",
      code: `{\n  "name": "nocturne",\n  "version": "1.0.0",\n  "stack": {\n    "transport": "wisp",\n    "rewriter":  "scramjet",\n    "editor":    "monaco"\n  },\n  "tags": ["proxy", "midnight", "unblocker"]\n}\n` },
    { id: "md-readme",    lang: "markdown",   name: "Markdown", desc: "Readme scaffold.",
      code: `# Nocturne\n\nA midnight-themed web proxy.\n\n## Features\n\n- Scramjet + Epoxy + Bare-Mux + Wisp\n- **Monaco** editor with live preview\n- Tab cloaks, search engine picker\n\n---\n\n> Press **Run** to preview this markdown.\n\n\`\`\`js\nconst hi = "hello";\nconsole.log(hi);\n\`\`\`\n` },
    { id: "py-starter",   lang: "python",     name: "Python", desc: "Reference only — no runtime.",
      code: `def fib(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a\n\nprint([fib(i) for i in range(10)])\n` },
    { id: "blank",        lang: "plaintext",  name: "Blank",  desc: "Start with nothing.",
      code: `` }
];

import { AIPanel } from "/src/js/ai.js";

require.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.47.0/min/vs" }});

require(["vs/editor/editor.main"], () => {
    defineTheme();

    const prefs = loadPrefs();
    const savedLang = localStorage.getItem(LANG_KEY) || "javascript";
    const savedValue = localStorage.getItem(STORAGE_KEY);
    const hashPayload = parseShareHash();

    const hasSavedCode = typeof savedValue === "string" && savedValue.trim().length > 0;

    const editor = monaco.editor.create(document.getElementById("editor"), {
        value: "",
        language: savedLang,
        theme: "nocturne",
        fontSize: prefs.fontSize,
        fontFamily: "'JetBrains Mono', Menlo, Consolas, monospace",
        fontLigatures: prefs.ligatures,
        lineHeight: 22,
        letterSpacing: 0.2,
        lineNumbers: "on",
        minimap: { enabled: prefs.minimap },
        scrollBeyondLastLine: false,
        renderLineHighlight: "line",
        smoothScrolling: true,
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
        cursorStyle: "line",
        padding: { top: 18, bottom: 18 },
        roundedSelection: true,
        automaticLayout: true,
        wordWrap: prefs.wrap ? "on" : "off",
        tabSize: 4,
        bracketPairColorization: { enabled: true },
        guides: { indentation: true, highlightActiveIndentation: true, bracketPairs: true },
        renderWhitespace: "none",
        scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
            useShadows: false
        }
    });

    document.getElementById("codeBooting")?.classList.add("hide");
    setTimeout(() => document.getElementById("codeBooting")?.remove(), 400);

    const fileNameEl = document.getElementById("fileName");
    const langSelect = document.getElementById("langSelect");
    const stStatus   = document.getElementById("stStatus");
    const stLang     = document.getElementById("stLang");
    const stLines    = document.getElementById("stLines");
    const stChars    = document.getElementById("stChars");
    const cursorInfo = document.getElementById("cursorInfo");
    const outputPanel = document.getElementById("outputPanel");
    const outputLog   = document.getElementById("outputLog");
    const btnCloseOut = document.getElementById("btnCloseOut");
    const btnClearOut = document.getElementById("btnClearOut");
    const prefsPanel  = document.getElementById("prefsPanel");
    const tplOverlay  = document.getElementById("templateOverlay");
    const tplGrid     = document.getElementById("templateGrid");

    langSelect.value = savedLang;
    stLang.textContent = savedLang;
    fileNameEl.value = localStorage.getItem(FILENAME_KEY) || "untitled";

    function updateStats() {
        const v = editor.getValue();
        const lines = v.split("\n").length;
        stLines.textContent = lines + " line" + (lines === 1 ? "" : "s");
        stChars.textContent = v.length + " char" + (v.length === 1 ? "" : "s");
        const pos = editor.getPosition();
        if (pos) cursorInfo.textContent = `ln ${pos.lineNumber}, col ${pos.column}`;
    }

    let saveTimer = null;
    let isTyping = false;
    function scheduleSave() {
        if (isTyping) return;
        stStatus.textContent = "editing";
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            localStorage.setItem(STORAGE_KEY, editor.getValue());
            stStatus.textContent = "saved";
        }, 500);
    }
    function saveNow() {
        clearTimeout(saveTimer);
        localStorage.setItem(STORAGE_KEY, editor.getValue());
        stStatus.textContent = "saved";
        flashStatus();
    }
    function flashStatus() {
        stStatus.classList.remove("flash");
        void stStatus.offsetWidth;
        stStatus.classList.add("flash");
    }

    editor.onDidChangeModelContent(() => { updateStats(); scheduleSave(); });
    editor.onDidChangeCursorPosition(updateStats);
    updateStats();

    function setLang(lang, persist = true) {
        if (!lang) return;
        monaco.editor.setModelLanguage(editor.getModel(), lang);
        langSelect.value = lang;
        stLang.textContent = lang;
        if (persist) localStorage.setItem(LANG_KEY, lang);
    }

    langSelect.addEventListener("change", () => setLang(langSelect.value));
    fileNameEl.addEventListener("input", () => localStorage.setItem(FILENAME_KEY, fileNameEl.value || "untitled"));
    fileNameEl.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); fileNameEl.blur(); } });

    document.getElementById("btnFormat").addEventListener("click", () => {
        editor.getAction("editor.action.formatDocument")?.run();
    });

    document.getElementById("btnCopy").addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(editor.getValue());
            stStatus.textContent = "copied";
            flashStatus();
            setTimeout(() => stStatus.textContent = "ready", 1200);
        } catch { stStatus.textContent = "copy failed"; }
    });

    document.getElementById("btnClear").addEventListener("click", () => {
        editor.setValue("");
        localStorage.removeItem(STORAGE_KEY);
        editor.focus();
    });

    document.getElementById("btnRun").addEventListener("click", () => runCode(editor, langSelect.value, outputPanel, outputLog));
    btnCloseOut?.addEventListener("click", () => outputPanel.classList.remove("open", "open-preview"));
    btnClearOut?.addEventListener("click", () => { outputLog.innerHTML = ""; });

    const aiPanelEl = document.getElementById("aiPanel");
    const ai = new AIPanel(aiPanelEl, {
        getCode: () => editor.getValue(),
        getLang: () => langSelect.value,
        onInsert: (code) => {
            const sel = editor.getSelection();
            const op = { range: sel, text: code, forceMoveMarkers: true };
            editor.executeEdits("ai-insert", [op]);
            editor.focus();
            aiPanelEl.classList.remove("open");
        }
    });
    document.getElementById("btnAi").addEventListener("click", e => {
        e.stopPropagation();
        aiPanelEl.classList.toggle("open");
        if (aiPanelEl.classList.contains("open")) {
            setTimeout(() => aiPanelEl.querySelector(".ai-input")?.focus(), 200);
        }
    });
    document.getElementById("btnAiClose").addEventListener("click", () => aiPanelEl.classList.remove("open"));

    document.getElementById("btnShare").addEventListener("click", async () => {
        const code = editor.getValue();
        const lang = langSelect.value;
        const enc = encodeShare(code, lang);
        const url = `${location.origin}/code.html#c=${enc.c}&l=${enc.l}`;
        try {
            await navigator.clipboard.writeText(url);
            stStatus.textContent = "link copied";
            flashStatus();
            setTimeout(() => stStatus.textContent = "ready", 1500);
        } catch {
            history.replaceState(null, "", url);
            stStatus.textContent = "link in address bar";
        }
    });

    document.getElementById("btnDownload").addEventListener("click", () => {
        const lang = langSelect.value;
        const ext = EXT_BY_LANG[lang] || "txt";
        const base = (fileNameEl.value || "untitled").replace(/\.[^.]+$/, "");
        const blob = new Blob([editor.getValue()], { type: "text/plain;charset=utf-8" });
        const u = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = u; a.download = `${base}.${ext}`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(u);
        stStatus.textContent = "downloaded";
        flashStatus();
        setTimeout(() => stStatus.textContent = "ready", 1200);
    });

    const uploadInput = document.getElementById("uploadInput");
    document.getElementById("btnUpload").addEventListener("click", () => uploadInput.click());
    uploadInput.addEventListener("change", async e => {
        const file = e.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        editor.setValue(text);
        const ext = (file.name.split(".").pop() || "").toLowerCase();
        const detected = LANG_BY_EXT[ext];
        if (detected) setLang(detected);
        const base = file.name.replace(/\.[^.]+$/, "");
        fileNameEl.value = base || "untitled";
        localStorage.setItem(FILENAME_KEY, fileNameEl.value);
        saveNow();
        e.target.value = "";
    });

    document.getElementById("btnPrefs").addEventListener("click", e => {
        e.stopPropagation();
        prefsPanel.classList.toggle("open");
        tplOverlay.classList.remove("open");
    });
    document.addEventListener("click", e => {
        if (!prefsPanel.contains(e.target) && !document.getElementById("btnPrefs").contains(e.target)) {
            prefsPanel.classList.remove("open");
        }
    });

    setupPrefsUI(editor);

    document.getElementById("btnTemplate").addEventListener("click", e => {
        e.stopPropagation();
        renderTemplates(tplGrid, (tpl) => {
            editor.setValue(tpl.code);
            setLang(tpl.lang);
            fileNameEl.value = tpl.id === "blank" ? "untitled" : tpl.id;
            localStorage.setItem(FILENAME_KEY, fileNameEl.value);
            saveNow();
            tplOverlay.classList.remove("open");
            editor.focus();
        });
        tplOverlay.classList.add("open");
        prefsPanel.classList.remove("open");
    });
    document.getElementById("btnTemplateClose").addEventListener("click", () => tplOverlay.classList.remove("open"));
    tplOverlay.addEventListener("click", e => { if (e.target === tplOverlay) tplOverlay.classList.remove("open"); });

    editor.onDidPaste(() => {
        const code = editor.getValue();
        if (!code.trim()) return;
        const detected = detectLanguage(code);
        if (detected && detected !== langSelect.value) {
            setLang(detected);
            stStatus.textContent = `detected ${detected}`;
            flashStatus();
            setTimeout(() => stStatus.textContent = "saved", 1800);
        }
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, saveNow);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runCode(editor, langSelect.value, outputPanel, outputLog));

    document.addEventListener("keydown", e => {
        const mod = e.ctrlKey || e.metaKey;
        if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); saveNow(); }
        if (mod && e.key === "Enter") { e.preventDefault(); runCode(editor, langSelect.value, outputPanel, outputLog); }
        if (e.key === "Escape") {
            prefsPanel.classList.remove("open");
            tplOverlay.classList.remove("open");
        }
    });

    if (hashPayload) {
        editor.setValue(hashPayload.code);
        setLang(hashPayload.lang);
        updateStats();
        saveNow();
        history.replaceState(null, "", "/code.html");
        stStatus.textContent = "loaded from link";
        flashStatus();
        editor.focus();
    } else if (hasSavedCode) {
        editor.setValue(savedValue);
        updateStats();
        editor.focus();
    } else {
        isTyping = true;
        runTypingAnimation(editor, WELCOME).then(() => {
            isTyping = false;
            updateStats();
            editor.focus();
        });
    }
});

function detectLanguage(code) {
    const s = code.trim();
    if (!s) return null;

    const scores = {
        html: 0, json: 0, python: 0, rust: 0, go: 0, sql: 0,
        markdown: 0, css: 0, typescript: 0, javascript: 0
    };

    if (/^<!DOCTYPE\s+html/i.test(s)) scores.html += 10;
    if (/^<html[\s>]/i.test(s)) scores.html += 8;
    if (/<\/?(div|span|body|head|script|style|link|meta|p|a|img|h[1-6])[\s>/]/i.test(s)) scores.html += 3;
    if (/<[a-z][\w-]*\s+[^>]*>/i.test(s)) scores.html += 2;

    if (/^[\s\n]*[{\[]/.test(s) && /[}\]][\s\n]*$/.test(s)) {
        try { JSON.parse(s); scores.json += 15; } catch {}
    }

    if (/^\s*(import|from)\s+[a-zA-Z_]/m.test(s)) scores.python += 4;
    if (/^\s*def\s+[a-zA-Z_]\w*\s*\(/m.test(s)) scores.python += 5;
    if (/^\s*class\s+[A-Z]\w*\s*[:(]/m.test(s)) scores.python += 3;
    if (/\bprint\s*\(/m.test(s) && !/console\.log/.test(s)) scores.python += 2;
    if (/:\s*$/m.test(s) && /^\s{2,4}[a-zA-Z_]/m.test(s)) scores.python += 2;
    if (/\belif\b|\band\b|\bor\b|\bnot\s+in\b|\bis\s+None\b/.test(s)) scores.python += 2;

    if (/\bfn\s+\w+\s*\(/.test(s)) scores.rust += 6;
    if (/^\s*use\s+\w+(::\w+)+;/m.test(s)) scores.rust += 5;
    if (/\blet\s+mut\s+/.test(s)) scores.rust += 4;
    if (/->\s*\w+\s*\{/.test(s)) scores.rust += 3;
    if (/\bimpl\s+\w+\s+for\b|\btrait\s+\w+/.test(s)) scores.rust += 3;

    if (/^package\s+\w+/m.test(s)) scores.go += 8;
    if (/\bfunc\s+(\(\w+\s+\*?\w+\)\s+)?\w+\s*\(/.test(s)) scores.go += 5;
    if (/\bgo\s+\w+\(/.test(s) || /\bchan\b|\bgoroutine\b/.test(s)) scores.go += 3;

    if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TABLE)\b\s/i.test(s)) scores.sql += 4;
    if (/\bFROM\s+\w+/i.test(s) && /\bWHERE\b|\bJOIN\b/i.test(s)) scores.sql += 4;
    if (/;\s*(SELECT|INSERT)/i.test(s)) scores.sql += 2;

    if (/^#{1,6}\s+\S/m.test(s)) scores.markdown += 4;
    if (/^[-*]\s+\S/m.test(s) && /\n\s*[-*]\s/m.test(s)) scores.markdown += 2;
    if (/\*\*[^*]+\*\*/.test(s) || /`[^`]+`/.test(s)) scores.markdown += 2;
    if (/^\[.+\]\(.+\)$/m.test(s)) scores.markdown += 2;
    if (/^```[\s\S]*?```$/m.test(s)) scores.markdown += 3;

    if (/^[\s\n]*[.#][\w-]+\s*\{/m.test(s)) scores.css += 5;
    if (/:\s*[a-z-]+(\s*[a-z0-9#]+)?(\s+[^;]+)?;/im.test(s) && /\{[\s\S]*?\}/.test(s)) scores.css += 3;
    if (/@media\s|@keyframes\s|@import\s/.test(s)) scores.css += 4;
    if (/\b(color|background|margin|padding|font-size|display|position|flex)\s*:/i.test(s)) scores.css += 2;

    if (/:\s*(string|number|boolean|any|void|unknown|never)\b/.test(s)) scores.typescript += 5;
    if (/\binterface\s+\w+\s*\{/.test(s)) scores.typescript += 5;
    if (/\btype\s+\w+\s*=/.test(s)) scores.typescript += 4;
    if (/\bas\s+(string|number|boolean|\w+)\b/.test(s)) scores.typescript += 2;
    if (/<[A-Z]\w*>/.test(s) && /\bfunction|const|let/.test(s)) scores.typescript += 2;

    if (/\bconsole\.(log|error|warn|info)\s*\(/.test(s)) scores.javascript += 4;
    if (/\b(const|let|var)\s+\w+\s*=/.test(s)) scores.javascript += 2;
    if (/\bfunction\s*\*?\s*\w*\s*\(/.test(s)) scores.javascript += 2;
    if (/=>\s*[\{(]/.test(s)) scores.javascript += 2;
    if (/\brequire\s*\(['"]/.test(s) || /\bimport\s+.*\bfrom\s+['"]/.test(s)) scores.javascript += 3;
    if (/\bdocument\.|\bwindow\.|\baddEventListener\(/.test(s)) scores.javascript += 2;

    let best = null;
    let bestScore = 0;
    for (const [lang, score] of Object.entries(scores)) {
        if (score > bestScore) { bestScore = score; best = lang; }
    }

    return bestScore >= 4 ? best : null;
}

function defineTheme() {
    monaco.editor.defineTheme("nocturne", {
        base: "vs-dark",
        inherit: true,
        rules: [
            { token: "",           foreground: "e8e5f4" },
            { token: "comment",    foreground: "706b8f", fontStyle: "italic" },
            { token: "keyword",    foreground: "b8b0da" },
            { token: "string",     foreground: "c9c1ff" },
            { token: "number",     foreground: "a9a3c7" },
            { token: "type",       foreground: "8a80b6" },
            { token: "function",   foreground: "d6cff2" },
            { token: "variable",   foreground: "e8e5f4" },
            { token: "operator",   foreground: "a9a3c7" },
            { token: "delimiter",  foreground: "706b8f" },
            { token: "tag",        foreground: "b8b0da" },
            { token: "attribute.name",  foreground: "8a80b6" },
            { token: "attribute.value", foreground: "c9c1ff" }
        ],
        colors: {
            "editor.background":              "#05060d",
            "editor.foreground":              "#e8e5f4",
            "editorLineNumber.foreground":    "#3f3c5a",
            "editorLineNumber.activeForeground": "#a9a3c7",
            "editor.lineHighlightBackground": "#0d0f1c",
            "editor.lineHighlightBorder":     "#0d0f1c",
            "editor.selectionBackground":     "#312c4f88",
            "editor.selectionHighlightBackground": "#25223a55",
            "editor.inactiveSelectionBackground":  "#25223a55",
            "editor.wordHighlightBackground":      "#25223a77",
            "editor.findMatchBackground":     "#4c4478",
            "editor.findMatchHighlightBackground": "#3a325e88",
            "editorCursor.foreground":        "#b8b0da",
            "editorWhitespace.foreground":    "#1e1c30",
            "editorIndentGuide.background":   "#13131f",
            "editorIndentGuide.activeBackground": "#2a2840",
            "editorBracketMatch.background":  "#3a325e55",
            "editorBracketMatch.border":      "#8a80b6",
            "editorGutter.background":        "#05060d",
            "editorWidget.background":        "#0c0d18",
            "editorWidget.border":            "#1a1b2b",
            "editorSuggestWidget.background": "#0c0d18",
            "editorSuggestWidget.border":     "#1a1b2b",
            "editorSuggestWidget.selectedBackground": "#25223a",
            "editorHoverWidget.background":   "#0c0d18",
            "editorHoverWidget.border":       "#1a1b2b",
            "scrollbar.shadow":               "#00000000",
            "scrollbarSlider.background":     "#25223a77",
            "scrollbarSlider.hoverBackground":"#312c4fbb",
            "scrollbarSlider.activeBackground":"#4c4478"
        }
    });
}

function loadPrefs() {
    const defaults = { fontSize: 13.5, wrap: true, minimap: false, ligatures: true };
    try {
        const raw = localStorage.getItem(PREFS_KEY);
        if (!raw) return defaults;
        return Object.assign({}, defaults, JSON.parse(raw));
    } catch { return defaults; }
}

function savePrefs(prefs) {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {}
}

function setupPrefsUI(editor) {
    const prefs = loadPrefs();
    const font = document.getElementById("prefFont");
    const fontVal = document.getElementById("prefFontVal");
    const wrap = document.getElementById("prefWrap");
    const mini = document.getElementById("prefMini");
    const lig = document.getElementById("prefLig");

    font.value = prefs.fontSize;
    fontVal.textContent = prefs.fontSize + "px";
    wrap.checked = prefs.wrap;
    mini.checked = prefs.minimap;
    lig.checked  = prefs.ligatures;

    font.addEventListener("input", () => {
        prefs.fontSize = parseFloat(font.value);
        fontVal.textContent = prefs.fontSize + "px";
        editor.updateOptions({ fontSize: prefs.fontSize });
        savePrefs(prefs);
    });
    wrap.addEventListener("change", () => {
        prefs.wrap = wrap.checked;
        editor.updateOptions({ wordWrap: prefs.wrap ? "on" : "off" });
        savePrefs(prefs);
    });
    mini.addEventListener("change", () => {
        prefs.minimap = mini.checked;
        editor.updateOptions({ minimap: { enabled: prefs.minimap } });
        savePrefs(prefs);
    });
    lig.addEventListener("change", () => {
        prefs.ligatures = lig.checked;
        editor.updateOptions({ fontLigatures: prefs.ligatures });
        savePrefs(prefs);
    });
}

function renderTemplates(container, onPick) {
    container.innerHTML = "";
    for (const tpl of TEMPLATES) {
        const card = document.createElement("button");
        card.className = "tm-card";
        card.innerHTML = `<div class="tm-name">${escapeHtml(tpl.name)}</div><div class="tm-lang">${escapeHtml(tpl.lang)}</div><div class="tm-desc">${escapeHtml(tpl.desc)}</div>`;
        card.addEventListener("click", () => onPick(tpl));
        container.appendChild(card);
    }
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function encodeShare(code, lang) {
    const bytes = new TextEncoder().encode(code);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const b64 = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return { c: b64, l: lang };
}

function decodeShare(c) {
    try {
        const b64 = c.replace(/-/g, "+").replace(/_/g, "/");
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new TextDecoder().decode(bytes);
    } catch { return null; }
}

function parseShareHash() {
    const h = location.hash.replace(/^#/, "");
    if (!h) return null;
    const params = new URLSearchParams(h);
    const c = params.get("c");
    const l = params.get("l");
    if (!c) return null;
    const code = decodeShare(c);
    if (code === null) return null;
    return { code, lang: l || "javascript" };
}

async function runTypingAnimation(editor, text) {
    const model = editor.getModel();
    let line = 1, col = 1;
    model.setValue("");

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        model.applyEdits([{
            range: new monaco.Range(line, col, line, col),
            text: ch
        }]);
        if (ch === "\n") { line++; col = 1; } else { col++; }
        editor.setPosition({ lineNumber: line, column: col });
        editor.revealPositionInCenterIfOutsideViewport({ lineNumber: line, column: col });

        const base = ch === "\n" ? 55 : 22;
        const jitter = Math.random() * 28;
        const pause = /[.,;{}()]/.test(ch) ? 40 : 0;
        await new Promise(r => setTimeout(r, base + jitter + pause));
    }
}

function runCode(editor, lang, panel, log) {
    panel.classList.add("open");
    panel.classList.remove("open-preview");
    log.innerHTML = "";

    const code = editor.getValue();
    if (!code.trim()) {
        appendLine(log, "info", "nothing to run");
        return;
    }

    if (lang === "javascript" || lang === "typescript") return runJS(code, log);
    if (lang === "html") { panel.classList.add("open-preview"); return runIframe(code, log); }
    if (lang === "css") {
        panel.classList.add("open-preview");
        const wrapped = `<!doctype html><html><head><style>${code}</style></head><body>
<h1>Heading 1</h1><h2>Heading 2</h2>
<p>The quick brown fox jumps over the lazy dog. <a href="#">A link</a>.</p>
<button>Button</button> <input placeholder="Input">
<ul><li>One</li><li>Two</li><li>Three</li></ul>
<div class="box">.box</div> <div class="card">.card</div> <div class="primary">.primary</div>
</body></html>`;
        return runIframe(wrapped, log);
    }
    if (lang === "json") return runJSON(code, log);
    if (lang === "markdown") {
        panel.classList.add("open-preview");
        const rendered = renderMarkdown(code);
        const wrapped = `<!doctype html><html><head><style>
body{font-family:-apple-system,BlinkMacSystemFont,Inter,sans-serif;color:#e8e5f4;background:#0a0b14;padding:24px;line-height:1.6;max-width:760px;margin:0 auto}
h1,h2,h3,h4{color:#fff;letter-spacing:-0.01em;margin-top:1em}
h1{font-size:28px}h2{font-size:22px;border-bottom:1px solid #1a1b2b;padding-bottom:6px}h3{font-size:18px}
a{color:#c9c1ff}code{background:rgba(200,195,230,0.08);padding:2px 5px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:12.5px}
pre{background:rgba(200,195,230,0.04);padding:12px;border-radius:8px;overflow-x:auto;border:1px solid #1a1b2b}
pre code{background:none;padding:0}
blockquote{border-left:2px solid #8a80b6;padding-left:14px;color:#a9a3c7;margin:1em 0}
hr{border:none;border-top:1px solid #1a1b2b;margin:2em 0}
ul,ol{padding-left:24px}img{max-width:100%}
</style></head><body>${rendered}</body></html>`;
        return runIframe(wrapped, log);
    }

    appendLine(log, "info", `run is not built-in for ${lang} yet — copy the code and paste it into a runtime for that language.`);
}

function runJS(code, log) {
    const startLine = document.createElement("div");
    startLine.className = "ol ol-meta";
    startLine.textContent = `\u25B8  run · ${new Date().toLocaleTimeString()}`;
    log.appendChild(startLine);

    const origLog  = console.log;
    const origErr  = console.error;
    const origWarn = console.warn;
    const origInfo = console.info;

    const capture = (kind) => (...args) => {
        const line = args.map(formatValue).join(" ");
        appendLine(log, kind, line);
    };

    console.log  = capture("log");
    console.error = capture("error");
    console.warn = capture("warn");
    console.info = capture("info");

    const t0 = performance.now();
    try {
        const result = new Function(code)();
        if (result !== undefined) appendLine(log, "log", "\u2190  " + formatValue(result));
    } catch (e) {
        appendLine(log, "error", e.name + ": " + e.message);
    } finally {
        console.log = origLog;
        console.error = origErr;
        console.warn = origWarn;
        console.info = origInfo;

        const doneLine = document.createElement("div");
        doneLine.className = "ol ol-meta";
        doneLine.textContent = `\u25A0  done in ${(performance.now() - t0).toFixed(1)}ms`;
        log.appendChild(doneLine);
        log.scrollTop = log.scrollHeight;
    }
}

function runIframe(htmlDoc, log) {
    log.innerHTML = "";
    const frame = document.createElement("iframe");
    frame.className = "ol-iframe";
    frame.setAttribute("sandbox", "allow-scripts allow-forms allow-modals allow-popups");
    frame.srcdoc = htmlDoc;
    log.appendChild(frame);
}

function runJSON(code, log) {
    try {
        const parsed = JSON.parse(code);
        const pretty = JSON.stringify(parsed, null, 2);
        const pre = document.createElement("pre");
        pre.className = "ol ol-json";
        pre.textContent = pretty;
        log.appendChild(pre);
        appendLine(log, "meta", `\u25A0  parsed · ${pretty.length} chars`);
    } catch (e) {
        appendLine(log, "error", e.message);
    }
}

function renderMarkdown(src) {
    const esc = (s) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    let html = src;

    const codeBlocks = [];
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (m, lang, code) => {
        const i = codeBlocks.push(`<pre><code>${esc(code)}</code></pre>`) - 1;
        return `\x00CODE${i}\x00`;
    });

    html = esc(html);

    html = html.replace(/^######\s+(.*)$/gm, "<h6>$1</h6>");
    html = html.replace(/^#####\s+(.*)$/gm, "<h5>$1</h5>");
    html = html.replace(/^####\s+(.*)$/gm, "<h4>$1</h4>");
    html = html.replace(/^###\s+(.*)$/gm, "<h3>$1</h3>");
    html = html.replace(/^##\s+(.*)$/gm, "<h2>$1</h2>");
    html = html.replace(/^#\s+(.*)$/gm, "<h1>$1</h1>");

    html = html.replace(/^---+$/gm, "<hr>");
    html = html.replace(/^&gt;\s?(.*)$/gm, "<blockquote>$1</blockquote>");

    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    html = html.replace(/(^- .+(?:\n- .+)*)/gm, m => {
        const items = m.split("\n").map(l => l.replace(/^- /, "<li>") + "</li>").join("");
        return "<ul>" + items + "</ul>";
    });
    html = html.replace(/(^\d+\. .+(?:\n\d+\. .+)*)/gm, m => {
        const items = m.split("\n").map(l => l.replace(/^\d+\. /, "<li>") + "</li>").join("");
        return "<ol>" + items + "</ol>";
    });

    html = html.split(/\n{2,}/).map(p => {
        if (/^<(h[1-6]|ul|ol|blockquote|pre|hr|table)/.test(p.trim())) return p;
        if (/^\x00CODE\d+\x00$/.test(p.trim())) return p;
        return "<p>" + p.replace(/\n/g, "<br>") + "</p>";
    }).join("\n");

    html = html.replace(/\x00CODE(\d+)\x00/g, (_, i) => codeBlocks[i]);

    return html;
}

function formatValue(v) {
    if (v === null) return "null";
    if (v === undefined) return "undefined";
    if (typeof v === "string") return v;
    if (typeof v === "function") return v.toString().split("\n")[0];
    try { return JSON.stringify(v, null, 2); }
    catch { return String(v); }
}

function appendLine(log, kind, text) {
    const el = document.createElement("div");
    el.className = "ol ol-" + kind;
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
}
