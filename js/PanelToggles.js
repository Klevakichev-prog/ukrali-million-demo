// PanelToggles.js — panels that open by buttons: the level, the lab, the events, the crew, the
// actions (the buttons sit in the debug panel, opened by F2: hotkey). A panel is closed until its button opens it; open/closed is kept in Store, so F5
// keeps the screen as it was left. The buttons and the panels are records of UILayout.js
// (panels with visible: 0); the button label is its record text with ▸ (closed) or ▾ (open)
// and an optional note ("Банда: Брокколи").

/** @satisfies {Record<string, any>} */
const PanelToggles = {
    KEY: 'ui.panels',

    // [button, panel] of the co-op screen (its log, crew cards and actions are always on; the
    // level's name is over the screen, so it has no level panel — Ivan 05.11) and of the five
    // original levels.
    /** @type {Array<[string, string]>} */
    COOP: [['tglLab', 'labPanel']],
    /** @type {Array<[string, string]>} */
    CLASSIC: [['tglInfo', 'topPanel'], ['tglLog', 'logPanel'], ['tglCrew', 'crewPanel'], ['tglAct', 'actPanel']],

    // A button that opens and closes a panel without a label of its own (the gear of the
    // settings); closed at start, not kept.
    /** @param {string} btn @param {string} panel @param {any} [ui] */
    dropdown(btn, panel, ui) {
        const U = ui || UI, b = U.get(btn), p = U.get(panel);
        if (!b || !p) return;
        p.show(false);
        b.onClick(() => p.show(!p.visible));
    },

    // A panel opened and closed by a key instead of a button (Ivan 08.11: the debug panel — F2,
    // the gear opens the settings window).
    /** @param {string} key KeyboardEvent.key @param {string} panel @param {any} [ui] UI (a stand-in in tests) */
    hotkey(key, panel, ui) {
        const U = ui || UI, p = U.get(panel);
        if (!p) return;
        p.show(false);
        if (typeof window.addEventListener !== 'function') return;   // a page without input (node:vm in tests)
        window.addEventListener('keydown', (e) => {
            if (e.key !== key) return;
            e.preventDefault();
            p.show(!p.visible);
        });
    },

    /**
     * @param {Array<[string, string]>} pairs [button id, panel id]
     * @param {any} [ui] UI (a stand-in in tests)
     * @param {any} [store] Store (a stand-in in tests)
     */
    bind(pairs, ui, store) {
        const U = ui || UI, S = store || Store;
        const open = S.getJSON(PanelToggles.KEY, {}) || {};
        /** @type {Record<string, string>} */
        const notes = {};
        const label = (btn, panel) => {
            const b = U.get(btn), d = U.def(btn);
            if (b && d) b.setText((open[panel] ? '▾ ' : '▸ ') + d.text + (notes[btn] ? ': ' + notes[btn] : ''));
        };
        const apply = (btn, panel) => {
            const p = U.get(panel);
            if (p) p.show(!!open[panel]);
            label(btn, panel);
        };
        for (const [btn, panel] of pairs) {
            const b = U.get(btn);
            if (b) b.onClick(() => {
                open[panel] = !open[panel];
                S.set(PanelToggles.KEY, JSON.stringify(open));
                apply(btn, panel);
            });
            apply(btn, panel);
        }
        return {
            /** A short note after the button label ('' — none). @param {string} btn @param {string} note */
            note(btn, note) {
                if (notes[btn] === note) return;
                notes[btn] = note;
                const pair = pairs.find(p => p[0] === btn);
                if (pair) label(btn, pair[1]);
            }
        };
    }
};
