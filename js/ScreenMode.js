// ScreenMode.js — the screen of the PC build in the settings window (rules, section 36, item 8): the mode
// (full, borderless, window), the window's size, the 3D picture's height in fullscreen. The shell
// (_utils/desktop/main.js, screen.js) owns the window and its own file; the page reaches it through
// window.desktop (_utils/desktop/preload.js). In a browser there is no window.desktop: the settings keep the old
// fullscreen button. A view — what the shell answers: { mode, window: [w, h], height, screen: [w, h], windows,
// heights, defaults }; a state — its first three fields (pick).
/** @satisfies {Record<string, any>} */
const ScreenMode = {
    MODES: ['full', 'borderless', 'window'],
    /** @type {DesktopScreenView | null} */
    view: null,
    /** @type {((v: DesktopScreenView) => void)[]} */
    listeners: [],
    started: false,

    /** @returns {DesktopApi | null} */
    api() {
        const d = typeof window !== 'undefined' ? window.desktop : null;
        return d && typeof d.screen === 'function' ? d : null;
    },

    // Once per page (main.js; MainMenu.bind): the shell's screen now, its 3D height, and the changes made outside
    // the settings window (F10, F11, the window resized by hand) — to the listeners.
    start() {
        const a = this.api();
        if (!a || this.started) return;
        this.started = true;
        this.took(a.screen());
        a.onScreen((v) => {
            this.took(v);
            for (const f of this.listeners) f(v);
        });
    },

    // The shell's screen now (the settings window opens); null — a browser.
    now() {
        const a = this.api();
        return a ? this.took(a.screen()) : null;
    },

    /** @param {(v: DesktopScreenView) => void} fn */
    listen(fn) { this.listeners.push(fn); },

    // A state into the shell, at once: the window changes, the answer is what it became.
    /** @param {DesktopScreenState} s */
    set(s) {
        return this.took(this.api().setScreen(this.pick(s)));
    },

    /** @param {DesktopScreenState} s */
    save(s) { this.api().saveScreen(this.pick(s)); },

    /** @param {DesktopScreenView} v */
    took(v) {
        this.view = v;
        if (typeof World3D !== 'undefined' && World3D.setRenderScale) World3D.setRenderScale(this.scale(v));
        return v;
    },

    /** @param {DesktopScreenState} v @returns {DesktopScreenState} */
    pick(v) { return { mode: v.mode, window: [v.window[0], v.window[1]], height: v.height }; },

    /** @param {DesktopScreenState} a @param {DesktopScreenState} b */
    same(a, b) {
        return a.mode === b.mode && a.window[0] === b.window[0] && a.window[1] === b.window[1] && a.height === b.height;
    },

    // The resolution the row shows: the window — its size; borderless — the monitor; fullscreen — the chosen height,
    // the width by the screen's shape (not distorted on 16:10 and 21:9).
    /** @param {DesktopScreenView} v @returns {[number, number]} */
    resolution(v) {
        if (v.mode === 'window') return [v.window[0], v.window[1]];
        if (v.mode === 'borderless') return [v.screen[0], v.screen[1]];
        return [Math.round(v.height * v.screen[0] / v.screen[1]), v.height];
    },

    // The 3D picture's share of the screen's pixels: below 1 only in fullscreen with a lower height; the interface
    // stays in the screen's own resolution.
    /** @param {DesktopScreenView} v */
    scale(v) { return v.mode === 'full' ? Math.min(1, v.height / v.screen[1]) : 1; },

    // ◀ (dir -1) and ▶ (+1): the list's neighbour of the current size — the window's sizes or the fullscreen's
    // heights; a size off the list (resized by hand) — the nearest one that way; null — none (the list's end,
    // borderless).
    /** @param {DesktopScreenView} v @param {number} dir @returns {DesktopScreenState | null} */
    step(v, dir) {
        const s = this.pick(v);
        if (v.mode === 'window') {
            const area = (/** @type {number[]} */ w) => w[0] * w[1], at = area(v.window);
            const next = dir > 0 ? v.windows.find(w => area(w) > at) : v.windows.filter(w => area(w) < at).pop();
            if (!next) return null;
            s.window = [next[0], next[1]];
            return s;
        }
        if (v.mode === 'full') {
            const next = dir > 0 ? v.heights.find(h => h > v.height) : v.heights.filter(h => h < v.height).pop();
            if (next === undefined) return null;
            s.height = next;
            return s;
        }
        return null;
    },
};
