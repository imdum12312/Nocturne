const KEY = "nocturne-welcome-seen";

function dismiss(el) {
    if (!el || el.classList.contains("closing")) return;
    el.classList.add("closing");
    try { localStorage.setItem(KEY, "1"); } catch {}
    el.addEventListener("animationend", () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 500);
}

function show() {
    const el = document.getElementById("welcomeOverlay");
    if (!el) return;
    el.classList.remove("hidden");

    const btn = document.getElementById("welcomeDismiss");
    btn?.focus({ preventScroll: true });

    const onKey = (e) => {
        if (e.key === "Escape" || e.key === "Enter") {
            document.removeEventListener("keydown", onKey);
            dismiss(el);
        }
    };

    btn?.addEventListener("click", () => {
        document.removeEventListener("keydown", onKey);
        dismiss(el);
    });

    el.addEventListener("click", (e) => {
        if (e.target === el) {
            document.removeEventListener("keydown", onKey);
            dismiss(el);
        }
    });

    document.addEventListener("keydown", onKey);
}

try {
    if (!localStorage.getItem(KEY)) {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", show, { once: true });
        } else {
            show();
        }
    } else {
        document.getElementById("welcomeOverlay")?.remove();
    }
} catch {
    document.getElementById("welcomeOverlay")?.remove();
}
