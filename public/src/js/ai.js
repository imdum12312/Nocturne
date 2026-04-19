const SEED_KEY = "AIzaSyAvP19sxMnu3yPtAv4BOhVfpO2FTkfrGVA";
const DEFAULT_MODEL = "gemini-3-flash";
const FALLBACK_MODEL = "gemini-2.5-flash";

const KEY_STORAGE      = "nocturne-ai-key";
const MODEL_STORAGE    = "nocturne-ai-model";
const HISTORY_STORAGE  = "nocturne-ai-history";
const INCL_CODE_STORE  = "nocturne-ai-include-code";

if (!localStorage.getItem(KEY_STORAGE)) localStorage.setItem(KEY_STORAGE, SEED_KEY);
if (!localStorage.getItem(MODEL_STORAGE)) localStorage.setItem(MODEL_STORAGE, DEFAULT_MODEL);

function getKey()   { return localStorage.getItem(KEY_STORAGE) || ""; }
function getModel() { return localStorage.getItem(MODEL_STORAGE) || DEFAULT_MODEL; }

function systemPreamble(currentLang, currentCode, includeCode) {
    const base = `You are a coding assistant embedded in Nocturne, a midnight-themed web editor + proxy. You help the user read, write, refactor, and debug code.

Style rules:
- Prefer showing concise code over long explanations.
- When you return code, use proper fenced code blocks with a language tag (e.g. \`\`\`js ... \`\`\`).
- Keep prose tight — a few sentences, then code.
- If the request is ambiguous, ask one clarifying question.`;

    if (!includeCode || !currentCode.trim()) return base;

    const snippet = currentCode.length > 6000 ? currentCode.slice(0, 6000) + "\n// …(truncated)" : currentCode;
    return base + `\n\nThe user's current editor content (language: ${currentLang}):\n\`\`\`${currentLang}\n${snippet}\n\`\`\``;
}

async function callGemini(history, systemInstruction, model) {
    const contents = history.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.text }]
    }));

    const body = {
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
    };
    if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${getKey()}`;

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
            const err = await res.json();
            msg = err?.error?.message || msg;
        } catch {}
        throw new Error(msg);
    }

    const data = await res.json();
    const cand = data?.candidates?.[0];
    if (!cand) throw new Error("no candidates returned");
    if (cand.finishReason === "SAFETY") throw new Error("blocked by safety filter");

    const text = cand.content?.parts?.map(p => p.text || "").join("") || "";
    return text.trim();
}

function mdRender(text) {
    const esc = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

    const blocks = [];
    let html = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
        const i = blocks.push({ lang: lang || "plaintext", code }) - 1;
        return `\x00BLOCK${i}\x00`;
    });

    html = esc(html);
    html = html.replace(/^######\s+(.*)$/gm, "<h4>$1</h4>");
    html = html.replace(/^#####\s+(.*)$/gm, "<h4>$1</h4>");
    html = html.replace(/^####\s+(.*)$/gm, "<h4>$1</h4>");
    html = html.replace(/^###\s+(.*)$/gm, "<h4>$1</h4>");
    html = html.replace(/^##\s+(.*)$/gm, "<h3>$1</h3>");
    html = html.replace(/^#\s+(.*)$/gm, "<h3>$1</h3>");
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    html = html.replace(/^-\s+(.*)$/gm, "<li>$1</li>");
    html = html.replace(/(<li>[\s\S]*?<\/li>(\n|$))+/g, m => "<ul>" + m + "</ul>");

    html = html.split(/\n{2,}/).map(p => {
        if (/^<(h\d|ul|pre|ol|blockquote)/.test(p.trim())) return p;
        if (/^\x00BLOCK\d+\x00$/.test(p.trim())) return p;
        return "<p>" + p.replace(/\n/g, "<br>") + "</p>";
    }).join("\n");

    html = html.replace(/\x00BLOCK(\d+)\x00/g, (_, i) => {
        const b = blocks[i];
        return `<div class="ai-code"><div class="ai-code-head"><span class="ai-code-lang">${esc(b.lang)}</span><button class="ai-code-insert" data-code="${btoa(unescape(encodeURIComponent(b.code)))}">insert</button><button class="ai-code-copy" data-code="${btoa(unescape(encodeURIComponent(b.code)))}">copy</button></div><pre>${esc(b.code)}</pre></div>`;
    });

    return html;
}

export class AIPanel {
    constructor(root, opts = {}) {
        this.root = root;
        this.messagesEl = root.querySelector(".ai-messages");
        this.inputEl    = root.querySelector(".ai-input");
        this.sendBtn    = root.querySelector("#aiSend");
        this.modelLabel = root.querySelector("#aiModel");
        this.quickBar   = root.querySelector(".ai-quick");
        this.settingsEl = root.querySelector(".ai-settings");
        this.keyInput   = root.querySelector("#aiKey");
        this.modelInput = root.querySelector("#aiModelInput");
        this.inclToggle = root.querySelector("#aiIncludeCode");

        this.getCode = opts.getCode || (() => "");
        this.getLang = opts.getLang || (() => "plaintext");
        this.onInsert = opts.onInsert || (() => {});

        this.history = this.loadHistory();
        this.busy = false;

        this.renderAll();
        this.wire();
        this.updateModelLabel();
    }

    loadHistory() {
        try {
            const raw = localStorage.getItem(HISTORY_STORAGE);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    }

    saveHistory() {
        try { localStorage.setItem(HISTORY_STORAGE, JSON.stringify(this.history.slice(-40))); } catch {}
    }

    updateModelLabel() {
        if (this.modelLabel) this.modelLabel.textContent = getModel();
    }

    renderAll() {
        this.messagesEl.innerHTML = "";
        if (this.history.length === 0) {
            this.messagesEl.innerHTML = `<div class="ai-empty">
                <div class="ai-empty-title">Ask me anything</div>
                <div class="ai-empty-sub">I can explain code, refactor, debug, or generate. Use the buttons below for quick actions.</div>
            </div>`;
        } else {
            for (const m of this.history) this.renderMessage(m, false);
        }
        this.scrollToBottom();
    }

    renderMessage(msg, scroll = true) {
        const el = document.createElement("div");
        el.className = "ai-msg ai-msg-" + msg.role;

        if (msg.role === "assistant" || msg.role === "error") {
            el.innerHTML = mdRender(msg.text);
        } else {
            el.textContent = msg.text;
        }

        this.messagesEl.appendChild(el);
        if (scroll) this.scrollToBottom();
    }

    scrollToBottom() {
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }

    wire() {
        this.sendBtn.addEventListener("click", () => this.onSend());
        this.inputEl.addEventListener("keydown", e => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                this.onSend();
            }
        });

        this.quickBar.addEventListener("click", e => {
            const btn = e.target.closest("[data-action]");
            if (!btn) return;
            const action = btn.dataset.action;
            const prompts = {
                explain: "Explain what this code does, in plain language.",
                refactor: "Refactor this for clarity and idiomatic style. Keep behavior identical.",
                comment: "Add concise inline comments explaining the intent of each non-obvious section.",
                debug: "Look for bugs, edge cases, or misuses. Be specific about what's wrong and suggest fixes.",
                test: "Write a handful of unit tests that exercise the main paths and a few edge cases.",
                optimize: "Suggest performance improvements without changing observable behavior."
            };
            if (!prompts[action]) return;
            this.inputEl.value = prompts[action];
            this.onSend();
        });

        this.messagesEl.addEventListener("click", e => {
            const insertBtn = e.target.closest(".ai-code-insert");
            const copyBtn = e.target.closest(".ai-code-copy");
            if (insertBtn) {
                const code = decodeURIComponent(escape(atob(insertBtn.dataset.code)));
                this.onInsert(code);
            } else if (copyBtn) {
                const code = decodeURIComponent(escape(atob(copyBtn.dataset.code)));
                navigator.clipboard?.writeText(code).catch(() => {});
                copyBtn.textContent = "copied";
                setTimeout(() => copyBtn.textContent = "copy", 1400);
            }
        });

        const btnClear = this.root.querySelector("#btnAiClear");
        btnClear?.addEventListener("click", () => this.clearConversation());

        const btnSettings = this.root.querySelector("#btnAiSettings");
        btnSettings?.addEventListener("click", () => {
            this.settingsEl.classList.toggle("open");
            this.keyInput.value = getKey();
            this.modelInput.value = getModel();
            this.inclToggle.checked = localStorage.getItem(INCL_CODE_STORE) !== "0";
        });

        this.keyInput?.addEventListener("change", () => {
            const v = this.keyInput.value.trim();
            if (v) localStorage.setItem(KEY_STORAGE, v);
        });
        this.modelInput?.addEventListener("change", () => {
            const v = this.modelInput.value.trim() || DEFAULT_MODEL;
            localStorage.setItem(MODEL_STORAGE, v);
            this.updateModelLabel();
        });
        this.inclToggle?.addEventListener("change", () => {
            localStorage.setItem(INCL_CODE_STORE, this.inclToggle.checked ? "1" : "0");
        });

        this.root.querySelector("#btnAiKeyClear")?.addEventListener("click", () => {
            localStorage.removeItem(KEY_STORAGE);
            this.keyInput.value = "";
        });
    }

    clearConversation() {
        this.history = [];
        this.saveHistory();
        this.renderAll();
    }

    showTyping() {
        const el = document.createElement("div");
        el.className = "ai-msg ai-msg-assistant ai-typing";
        el.innerHTML = `<span class="t-dot"></span><span class="t-dot"></span><span class="t-dot"></span>`;
        this.messagesEl.appendChild(el);
        this.scrollToBottom();
        return el;
    }

    async onSend() {
        if (this.busy) return;
        const text = this.inputEl.value.trim();
        if (!text) return;

        if (this.history.length === 0) this.messagesEl.innerHTML = "";

        const userMsg = { role: "user", text };
        this.history.push(userMsg);
        this.renderMessage(userMsg);
        this.saveHistory();

        this.inputEl.value = "";
        this.busy = true;
        this.sendBtn.disabled = true;

        const typingEl = this.showTyping();

        const includeCode = localStorage.getItem(INCL_CODE_STORE) !== "0";
        const sys = systemPreamble(this.getLang(), this.getCode(), includeCode);

        let responseText;
        let modelUsed = getModel();
        try {
            responseText = await callGemini(this.history, sys, modelUsed);
        } catch (e) {
            if (modelUsed !== FALLBACK_MODEL && /not found|invalid|unsupported/i.test(e.message)) {
                try {
                    responseText = await callGemini(this.history, sys, FALLBACK_MODEL);
                    localStorage.setItem(MODEL_STORAGE, FALLBACK_MODEL);
                    this.updateModelLabel();
                } catch (e2) {
                    typingEl.remove();
                    this.renderMessage({ role: "error", text: "**Error:** " + e2.message });
                    this.busy = false; this.sendBtn.disabled = false;
                    return;
                }
            } else {
                typingEl.remove();
                this.renderMessage({ role: "error", text: "**Error:** " + e.message });
                this.busy = false; this.sendBtn.disabled = false;
                return;
            }
        }

        typingEl.remove();

        const assistantMsg = { role: "assistant", text: responseText };
        this.history.push(assistantMsg);
        this.renderMessage(assistantMsg);
        this.saveHistory();

        this.busy = false;
        this.sendBtn.disabled = false;
    }
}
