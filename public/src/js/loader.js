const STAGES = {
    connecting: "connecting",
    loading:    "loading",
    rendering:  "rendering"
};

class LineLoader {
    constructor(el) {
        this.el = el;
        this.stageEl = el.querySelector(".ll-stage");
        this.timerEl = el.querySelector(".ll-timer");
        this.visible = false;
        this.startTime = 0;
        this.timerHandle = 0;
    }

    _format(ms) {
        return (ms / 1000).toFixed(2) + "s";
    }

    _tick() {
        if (!this.visible || !this.timerEl) return;
        this.timerEl.textContent = this._format(performance.now() - this.startTime);
    }

    _setStage(name) {
        const label = STAGES[name] || name;
        if (this.stageEl) this.stageEl.textContent = label;
    }

    start() {
        this.el.classList.remove("finishing");
        this.el.classList.add("visible");
        this.visible = true;
        this.startTime = performance.now();
        this._setStage("connecting");
        if (this.timerEl) this.timerEl.textContent = "0.00s";
        clearInterval(this.timerHandle);
        this.timerHandle = setInterval(() => this._tick(), 50);
    }

    stage(name) {
        if (!this.visible) return;
        this._setStage(name);
    }

    finish() {
        if (!this.visible) return;
        clearInterval(this.timerHandle);
        this._tick();
        this._setStage("rendering");
        this.el.classList.add("finishing");
        setTimeout(() => {
            this.el.classList.remove("visible", "finishing");
            this.visible = false;
        }, 450);
    }

    fail() {
        clearInterval(this.timerHandle);
        this.el.classList.remove("visible", "finishing");
        this.visible = false;
    }
}

export function mountLoader(root) {
    return new LineLoader(root);
}
