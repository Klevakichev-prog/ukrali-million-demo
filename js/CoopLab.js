// CoopLab.js — the mechanics lab (?lab, ?lab=<station id>): the co-op game on a small station
// level (../design/mechanics-lab/*.json -> COOP_LEVELS, the levels with a `lab` block) that
// shows one mechanic. A panel on the left lists the stations, says what to watch and holds
// the station's knobs — numbers of the model with − / +; the take is recomputed at once.
// Changed knobs are kept in Store until «Сбросить», so they survive a reload and a station
// switch (a switch reloads the page with another ?lab=).

class CoopLab {
    /** @param {CoopGame} game */
    constructor(game) {
        this.game = game;
        this.L = game.M.L;
        // the glass noise is a number of the level, not of the code
        const N = CoopLab.PARAMS.noise;
        N.base = this.L.rules.glass_noise_cells;
        if (N.cur == null) N.cur = N.base;
        game.M.noiseCells = N.cur;
        this.build();
    }

    // The station id from the address: ?lab=<id>, bare ?lab — the first station; null — no lab.
    // An unknown id or a level that is not a station throws: a typo must not open another one.
    static levelFromUrl() {
        const m = /[?&]lab(?:=([^&]*))?(?:&|$)/.exec(window.location.search);
        if (!m) return null;
        const list = CoopLab.stations();
        if (!m[1]) return list.length ? list[0].id : null;
        const id = decodeURIComponent(m[1]);
        if (!COOP_LEVELS[id] || !COOP_LEVELS[id].lab) throw new Error('нет станции полигона «' + id + '»; станции: ' + list.map(l => l.id).join(', '));
        return id;
    }

    static stations() {
        return Object.values(COOP_LEVELS).filter(l => l.lab).sort((a, b) => a.lab.order - b.lab.order);
    }

    // Stored knobs -> the model, before the level model is created (masses size the beans).
    static applyStored() {
        const saved = Store.getJSON(CoopLab.STORE_KEY, {});
        for (const [key, v] of Object.entries(saved)) {
            const p = CoopLab.PARAMS[key];
            if (p && typeof v === 'number') p.set(v, null);
        }
    }

    // --- Panel -----------------------------------------------------------------------

    // The panel is labPanel of UILayout.js; the station buttons and the knob rows are copies of
    // its templates (labStTpl; labKTpl, labVTpl, labMTpl, labPTpl), offsets from the template.
    // Two tabs share the space under the stations: what to watch (labWhatPage) and the knobs
    // (labKnobsPage) — the long texts of the stations did not fit beside the knobs.
    build() {
        // The panel opens by its button (PanelToggles): the button is there only in the lab.
        const tgl = UI.get('tglLab');
        if (tgl) tgl.show(true);
        const copy = (tpl, id, dx, dy, extra) => {
            const t = UI.def(tpl);
            if (!t) return null;
            return UI.add(Object.assign({}, t, { id, x: t.x + dx, y: t.y + dy, visible: 1 }, extra || {}));
        };
        const st = UI.def('labStTpl');
        CoopLab.stations().forEach((lv, i) => {
            const here = lv.id === this.L.id;
            const el = st && copy('labStTpl', 'labSt' + i, (i % CoopLab.COLS) * (st.w + CoopLab.ST_GAP_X), Math.floor(i / CoopLab.COLS) * (st.h + CoopLab.ST_GAP_Y),
                { text: (here ? '▶ ' : '') + lv.lab.name });
            if (el) el.onClick(() => { if (!here) window.location.search = '?lab=' + lv.id; });
        });
        const what = UI.get('labWhat');
        if (what) what.setText(this.L.lab.what.map(s => CoopLab.wrap(s, CoopLab.WRAP)).join('\n'));
        for (const [tab, page] of CoopLab.TABS) {
            const b = UI.get(tab);
            if (b) b.onClick(() => this.tab(page));
        }
        this.tab('labWhatPage');
        const reset = UI.get('labReset');
        if (reset) reset.onClick(() => this.reset());
        const k = UI.def('labKTpl'), step = k ? CoopLab.ROW : 0;
        this.rows = (this.L.lab.params || []).filter(key => CoopLab.PARAMS[key]).map((key, i) => {
            copy('labKTpl', 'labK' + i, 0, i * step, { text: CoopLab.PARAMS[key].label });
            copy('labVTpl', 'labV' + i, 0, i * step);
            const m = copy('labMTpl', 'labM' + i, 0, i * step), p = copy('labPTpl', 'labP' + i, 0, i * step);
            if (m) m.onClick(() => this.nudge(key, -1));
            if (p) p.onClick(() => this.nudge(key, 1));
            return { key, i };
        });
        this.show();
    }

    // Shows one page of the panel; its tab is marked ▶ as the station that is on.
    tab(page) {
        for (const [tab, pg] of CoopLab.TABS) {
            const p = UI.get(pg), b = UI.get(tab), d = UI.def(tab);
            if (p) p.show(pg === page);
            if (b && d) b.setText((pg === page ? '▶ ' : '') + d.text);
        }
    }

    show() {
        const saved = Store.getJSON(CoopLab.STORE_KEY, {});
        for (const r of this.rows) {
            const p = CoopLab.PARAMS[r.key], el = UI.get('labV' + r.i);
            if (el) el.setText(CoopLab.num(p.show ? p.show(p.get()) : p.get()) + (p.unit || '') + (r.key in saved ? ' •' : ''));
        }
    }

    nudge(key, sign) {
        const p = CoopLab.PARAMS[key];
        const v = Math.round((p.get() + sign * p.step) * 100) / 100;
        if (v < p.min || v > p.max) return;
        p.set(v, this.game.M);
        const saved = Store.getJSON(CoopLab.STORE_KEY, {});
        if (v === p.base) delete saved[key]; else saved[key] = v;
        Store.set(CoopLab.STORE_KEY, JSON.stringify(saved));
        this.show();
        this.game.retune();
    }

    reset() {
        for (const p of Object.values(CoopLab.PARAMS)) p.set(p.base, this.game.M);
        Store.remove(CoopLab.STORE_KEY);
        this.show();
        this.game.retune();
    }

    // --- Text ------------------------------------------------------------------------

    static wrap(s, n) {
        const out = [];
        let line = '';
        for (const w of s.split(' ')) {
            if (line && (line + ' ' + w).length > n) { out.push(line); line = w; } else line = line ? line + ' ' + w : w;
        }
        if (line) out.push(line);
        return out.join('\n');
    }

    static num(v) {
        return String(Math.round(v * 100) / 100).replace('.', ',');
    }
}

CoopLab.STORE_KEY = 'coop.lab.knobs';
CoopLab.WRAP = COOP_LAB_WRAP;
CoopLab.COLS = COOP_LAB_COLS;
CoopLab.TABS = [['labTabWhat', 'labWhatPage'], ['labTabKnobs', 'labKnobsPage']];   // tab button -> its page
CoopLab.ROW = COOP_LAB_ROW;
CoopLab.ST_GAP_X = COOP_LAB_ST_GAP_X;
CoopLab.ST_GAP_Y = COOP_LAB_ST_GAP_Y;

// The knobs: get/set of one number of the model; base — the value in the code (for «Сбросить»
// and to mark changed ones with •); show/unit — how it reads on the panel. set(v, M) gets the
// level model when there is one: the heroes keep their own copy of the mass.
CoopLab.PARAMS = (() => {
    /** @type {Record<string, any>} */
    const P = {};
    const C = CoopModel;
    const knob = (key, label, step, min, max, extra) => {
        P[key] = Object.assign({ label, step, min, max, base: C[key], get: () => C[key], set: (v) => { C[key] = v; } }, extra || {});
    };
    for (const R of C.HEROES) {
        const id = R.id;
        P['mass.' + id] = {
            label: 'Масса: ' + R.fruit, step: 0.5, min: 0.5, max: 10, base: R.mass, get: () => R.mass,
            set: (v, M) => { R.mass = v; if (M) M.heroes.forEach(h => { if (h.id === id) h.mass = v; }); }
        };
    }
    knob('KNOCK_1', 'Тяжелее в N раз — сбит на 1 клетку', 0.1, 1, 10);
    knob('KNOCK_2', 'Тяжелее в N раз — сбит на 2 клетки', 0.1, 1, 10);
    knob('KNOCK_3', 'Тяжелее в N раз — сбит на 3 клетки', 0.1, 1, 10);
    knob('LIE_TICKS', 'Лежит после приземления, тиков', 1, 0, 20);
    knob('HIT_STUN_TICKS', 'Оглушение после удара, тиков', 1, 0, 10);
    knob('GUARD_MASS', 'Масса охранника', 0.5, 0.5, 10);
    P.noise = {
        label: 'Шум стекла, клеток', step: 1, min: 0, max: 20, base: null,
        get: () => P.noise.cur, set: (v, M) => { P.noise.cur = v; if (M) M.noiseCells = v; }, cur: null
    };
    return P;
})();
