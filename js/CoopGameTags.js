// CoopGameTags.js — a part of CoopGame (CoopGame.js): the HUD elements the game makes over the
// scene. The plan's signs where a hero works or waits (the ghost's), the loads and the work timers
// over the heroes; the action buttons of the selected hero's cell at the end of his plan with their
// side effects. Copies of templates of UILayout.js (UI.add), placed every frame. Methods of the
// game, mixed into its prototype.

/** @satisfies {ThisType<CoopGame>} */
const CoopGameTags = {
    // The plan's signs (Ivan 18.10; 07.11: «убираем модель персонажа» — no copy of the hero, only the
    // signs): every step a hero stands on for a while — an action, a wait, a wait until — a sign «action,
    // the moment it ends, hero» in one line (Ivan 07.11: «нужна одна строка», «иконку героя после
    // таймера»; «🔓 0:13 🥕»: the moment of the log, rules, section 3, item 6 — the end of the last tick
    // on it). An action's sign stands where it is done (CoopModel.actSpot: an item's cell, a door, a
    // wall; Ivan 07.11: «в тех клетках, с которыми взаимодействуют»), a wait's in the cell the ghost run
    // has him in. All the signs of one spot, whoever's, are one entry (a column), the earliest end first.
    // An action that raises the alarm (a sensor door opened with the light on — rules, section 18,
    // Ivan 24.10) has 🚨 after its icon.
    planGhosts() {
        const out = [], F = this.view.frames, spans = this.view.spans, cells = new Map();
        this.viewPlans.forEach((plan, i) => {
            const who = CoopGame.heroIcon(this.M.heroes[i]);
            plan.forEach((st, k) => {
                const sp = spans[i] && spans[i][k];
                if (st.op === 'go' || !sp) return;
                const h = F[Math.min(F.length - 1, sp.from + 1)].h[i];
                const at = st.op === 'act' ? this.M.actSpot(st.verb, st.target, h.x, h.y, F[Math.min(F.length - 1, sp.from)]) : { x: h.x, y: h.y, side: null };
                const ring = st.op === 'act' && this.M.effectsOf(st.verb, st.target, F[Math.min(F.length - 1, sp.to)].power).includes('alarm');
                const sign = { hero: i, icon: st.op === 'act' ? (CoopGame.VERB_ICON[st.verb] || '✋') + (ring ? CoopGame.ALARM_ICON : '') : CoopGame.WAIT_ICON,
                    end: sp.to + 1, work: st.op === 'act', verb: st.op === 'act' ? st.verb : null };
                Object.assign(sign, { text: sign.icon + ' ' + CoopGame.clock(sign.end) + ' ' + who });
                const key = at.x + ',' + at.y + ',' + at.side;
                let cur = cells.get(key);
                if (!cur) { cur = { hero: i, x: at.x, y: at.y, side: at.side, f: h.f, work: false, text: '', signs: [] }; cells.set(key, cur); out.push(cur); }
                cur.signs.push(sign);
            });
        });
        for (const g of out) {
            g.signs.sort((a, b) => a.end - b.end);
            g.hero = g.signs[0].hero;
            g.work = g.signs.some(x => x.work);
            g.text = g.signs.map(x => x.text).join('  ');
        }
        return out;
    },

    // The plan's signs (Ivan 18.10 night: the same thing as the buttons — a plate, the icons, the time;
    // nothing see-through; Ivan 21.10: smaller, in one line; 07.11: «иконка персонажа, затем иконка
    // действия, затем время» — planGhosts): per sign a copy of
    // ghostTagTpl with its ghostTagText, in the ghostLayer under the rest of the HUD; one HUD plate for every
    // sign (rules, section 34: a colour has one role — a work's sign is no longer green).
    buildGhostTags() {
        for (const ids of this.ghostIds) for (const id of ids) UI.remove(id);
        this.ghostIds = [];
        const t = UI.def('ghostTagTpl'), tt = UI.def('ghostTagText');
        if (!t || !tt) return;
        this.ghostIds = this.scene.ghosts.map((g, i) => g.signs.map((s, k) => {
            const id = 'ghostTag' + i + '_' + k;
            UI.add(Object.assign({}, t, { id, visible: 0 }));
            UI.add(Object.assign({}, tt, { id: id + 'Text', parent: id, text: s.text }));
            return id;
        }));
    },

    // Each frame of the plan: a cell's signs in a column, one cell wide (Ivan 07.11: «ровно в одну клетку
    // по ширине» — CoopScene.ghostHeads, screen CSS px), the earliest end on the cell's center, a later
    // one on top (Ivan 21.10: «new icons grow upwards»), hidden off the screen. The font is the record's
    // or smaller — as much as the column's widest line lets (signFont); all the column's signs alike.
    placeGhostTags() {
        const heads = this.scene.ghostHeads ? this.scene.ghostHeads() : [], tt = UI.def('ghostTagText');
        if (!tt) return;
        const s = UI.scale(), gap = CoopGame.SIGN_GAP, pad = CoopGame.SIGN_PAD;
        this.ghostIds.forEach((ids, i) => {
            const p = heads[i], g = this.scene.ghosts[i];
            if (!p || !p.shown || !g) { for (const id of ids) { const el = UI.get(id); if (el) el.show(false); } return; }
            const w = Math.max(1, Math.round(p.w / s) - gap);
            const font = Math.min(...g.signs.map(z => CoopGame.signFont(z.text, w - 2 * pad, tt.fontSize)));
            const h = Math.round(CoopGame.SIGN_LINE * font + 2 * pad);
            ids.forEach((id, k) => {
                const el = UI.get(id), text = UI.get(id + 'Text');
                if (!el) return;
                el.sizeTo(w, h);
                if (text) text.fontTo(font);
                el.moveTo(Math.round(p.x / s - w / 2), Math.round(p.y / s - h / 2 - k * (h + gap)));
                el.show(true);
            });
        });
    },

    // The load indicator over a carrying hero (Ivan 19.10: «a clearer load over the head»): per hero
    // a copy of loadTpl (the bar of his limit filled by the mass he carries, «1 / 1,5») and of
    // loadFullTpl (the same, full), in the ghostLayer. The bar is the money's colour, the frame — the hero's
    // (rules, section 34: no orange of its own for «full»).
    buildLoadTags() {
        for (const ids of this.loadIds || []) for (const id of ids) UI.remove(id);
        this.loadIds = [];
        const parts = [['loadTpl', 'loadBarTpl', 'loadTextTpl'], ['loadFullTpl', 'loadFullBarTpl', 'loadFullTextTpl']];
        if (!parts.every(p => p.every(id => UI.def(id)))) return;
        this.loadIds = this.M.heroes.map((h, i) => parts.map(([box, bar, text], k) => {
            const id = 'load' + (k ? 'Full' : '') + i;
            UI.add(Object.assign({}, UI.def(box), { id, border: cssColor(h.color), visible: 0 }));
            UI.add(Object.assign({}, UI.def(bar), { id: id + 'Bar', parent: id }));
            UI.add(Object.assign({}, UI.def(text), { id: id + 'Text', parent: id }));
            return id;
        }));
    },

    // The work timer (Ivan 19.10, the screenshot of the take; over the object worked on): per hero a copy
    // of workTpl — a round plate with the ring workRingTpl (the part of the job left) and, in the ring's
    // middle, the work's icon workIconTpl over the ticks left workTextTpl (Ivan 24.10: «и иконка и таймер
    // должны быть в круге»), in the ghostLayer. Both lie on the plate, not in the ring: the ring's mask
    // cuts its middle out together with its children.
    buildWorkTags() {
        for (const id of this.workIds || []) UI.remove(id);
        this.workIds = [];
        if (!['workTpl', 'workRingTpl', 'workTextTpl', 'workIconTpl'].every(id => UI.def(id))) return;
        this.workIds = this.M.heroes.map((h, i) => {
            const id = 'work' + i;
            UI.add(Object.assign({}, UI.def('workTpl'), { id, visible: 0 }));
            UI.add(Object.assign({}, UI.def('workRingTpl'), { id: id + 'Ring', parent: id, color: cssColor(h.color) }));   // the worker's colour (rules, section 34)
            UI.add(Object.assign({}, UI.def('workIconTpl'), { id: id + 'Icon', parent: id }));
            UI.add(Object.assign({}, UI.def('workTextTpl'), { id: id + 'Text', parent: id }));
            return id;
        });
    },

    // Each frame: the timer of each working hero over what he works on (CoopScene.workHeads) — the
    // ring is the part of the job left, the number the ticks left with the one playing, the icon the
    // work's (a button's, VERB_ICON) — and of each waiting one over his cell, ⏳ (Ivan 24.10); all at one
    // height (CoopScene.timerTop). The plan shows none (Ivan 19.10):
    // the timer is the heist's. frame — the frame after the tick playing (its wl: left after it), k — how
    // far the tick has played: the ring drains smoothly from wl + 1 to wl.
    /** @param {any} frame @param {number} k */
    placeWorkTags(frame, k) {
        const heads = this.scene.workHeads ? this.scene.workHeads(frame) : [], t = UI.def('workTpl');
        if (!t || !this.workIds) return;
        const s = UI.scale();
        this.workIds.forEach((id, i) => {
            const p = heads[i], on = this.mode === 'run' && !!p && p.shown, el = UI.get(id);
            if (!el) return;
            el.show(on);
            if (!on) return;
            el.moveTo(Math.round(p.x / s - t.w / 2), Math.round(p.y / s - t.h - CoopGame.TAG_GAP));
            const ring = UI.get(id + 'Ring'), text = UI.get(id + 'Text'), icon = UI.get(id + 'Icon');
            if (ring) ring.setValue(p.total ? (p.left + 1 - k) / p.total : 0);
            if (text) text.setText(String(p.left + 1));
            if (icon) icon.setText(p.wait ? CoopGame.WAIT_ICON : CoopGame.VERB_ICON[p.verb] || '✋');
        });
    },

    // Each frame: the indicator over each carrying hero (CoopScene.loadHeads), the full one when
    // his load reached his limit; hidden when he carries nothing or is off the screen.
    /** @param {any} frame */
    placeLoadTags(frame) {
        const heads = this.scene.loadHeads ? this.scene.loadHeads(frame) : [], t = UI.def('loadTpl');
        if (!t || !this.loadIds) return;
        const s = UI.scale(), num = (/** @type {number} */ v) => CoopText.num(v, { maximumFractionDigits: 1 });
        this.loadIds.forEach(([norm, full], i) => {
            const p = heads[i], on = !!p && p.shown, isFull = on && p.load >= p.cap;
            for (const [id, me] of [[norm, on && !isFull], [full, isFull]]) {
                const el = UI.get(id);
                if (!el) continue;
                el.show(me);
                if (!me) continue;
                el.moveTo(Math.round(p.x / s - t.w / 2), Math.round(p.y / s - t.h - CoopGame.TAG_GAP));
                const bar = UI.get(id + 'Bar'), text = UI.get(id + 'Text');
                if (bar) bar.setValue(p.load / p.cap);
                if (text) text.setText(num(p.load) + ' / ' + num(p.cap));
            }
        });
    },

    clearActions() {
        for (const id of (this.fxIds || []).concat(this.actIds)) UI.remove(id);
        this.actIds = [];
        this.fxIds = [];             // the badges of the buttons' side effects
    },

    // The loot, the doors and the light as the plans leave them at the tick the selected hero's next
    // step starts — his plan's end plus the ticks set on Wait (the plan view's run, its frame at the
    // start of that tick: a job ends at the very end of its tick, Ivan 21.10, rules, section 3), for
    // the buttons: a vitrine the plan smashed or unlocked offers only a take, an item
    // taken is gone, a door opened offers only «Закрыть», a door a teammate picks by then offers
    // «Открыть» (Ivan 19.10, 20.10: the plan remembers its own steps; rules, section 9); the light —
    // for the alarm on a button; the guards as the ghost has them at that tick, answering the plans
    // (rules, section 8) — for «Связать» (rules, section 21) — and at its end, where and how turned —
    // for «Вырубить», judged at the end of the blow's tick (rules, section 22).
    stateAtEnd() {
        const n = this.pendingWait(), run = n > 0 && this.view ? this.view : this.ghost;
        const F = run && run.frames;
        if (!F || !F.length) return undefined;
        return this.M.frameState(F, this.ends[this.sel] + n, this.round);
    },

    // The special actions of the hero's cell (the end of his plan): one — a copy of actSpecTpl;
    // more (a vitrine: smash, unlock) — copies of the small actSpecSmallTpl stacked up in its place,
    // the first on top, like «Отменить» / «Очистить» (Ivan 19.10: they must not climb over the
    // plan's map; a level has no cell with two objects — rules, section 9); none — the grey actSpecNone.
    // An action with a side effect (Ivan 20.10: an alarm, noise, a spoilt item) has the effect's
    // icons in a badge (actFxTpl): at the top right of the big button; a small one is narrower by
    // the badge, which stands on its right in the place of the button.
    buildActions(at) {
        this.clearActions();
        const st = this.stateAtEnd(), power = st ? st.power : true;
        const verbs = this.M.verbsAt(this.M.heroes[this.sel].id, at[0], at[1], st).filter(v => v.verb !== 'drop');
        this.actVerbs = verbs;   // actSpec<i> is verbs[i] (the advice of «?» finds its button)
        const fx = UI.def('actFxTpl'), fxText = UI.def('actFxTextTpl');
        const tpl = verbs.length > 1 ? 'actSpecSmallTpl' : 'actSpecTpl', t = UI.def(tpl), grey = UI.def('actSpecNone');
        if (t) {
            verbs.forEach((v, i) => {
                const id = 'actSpec' + i, icon = CoopGame.VERB_ICON[v.verb], small = verbs.length > 1;
                const text = small ? icon + ' ' + v.label + ' · ' + CoopGame.clock(v.ticks) : icon + ' ' + CoopGame.clock(v.ticks) + '\n' + v.label;
                const y = t.y + (verbs.length - 1 - i) * (t.h + CoopGame.ACT_GAP);
                const icons = fx && fxText ? this.M.effectsOf(v.verb, v.target, power).map((/** @type {string} */ e) => CoopGame.FX_ICON[e]) : [];
                const w = fx ? fx.w * icons.length - (icons.length - 1) * CoopGame.FX_OVERLAP : 0, h = fx ? Math.min(fx.h, t.h - CoopGame.FX_MARGIN) : 0;
                // a small button's label fills it (Ivan 05.11: the badge covered «Разбить витрину»): with
                // a badge it gives up its right part to it — the label wraps or shrinks in the rest
                const room = small && icons.length ? w + CoopGame.FX_GAP : 0;
                // the tutorial (rules, section 27, Ivan 10.11): a button not of the step — grey, as «Отменить» there
                const off = !!this.tutSteps && !this.tutButton(v) && grey ? { look: grey.look, fill: grey.fill, color: grey.color } : {};
                // in the template's place of the drawing order: under the windows' dim (the tutorial bot, 11.11: a step went
                // through the open settings)
                UI.add(Object.assign({}, t, { id, x: t.x - room / 2, w: t.w - room, y, visible: 1, text }, off), tpl);
                const el = UI.get(id);
                if (el) el.onClick(() => {
                    if (this.mode !== 'plan') return;
                    if (!this.tutSteps) { this.act(v); return; }
                    const p = this.tutButton(v);
                    if (p) this.tutPress(p, () => this.act(v));
                });
                this.actIds.push(id);
                if (!icons.length || !fx || !fxText) return;
                const fy = small ? y + (t.h - h) / 2 : y + t.h - h - CoopGame.FX_INSET;
                const fxX = small ? t.x + t.w / 2 - w / 2 : t.x + t.w / 2 - w / 2 - CoopGame.FX_INSET * 2;
                UI.add(Object.assign({}, fx, { id: id + 'Fx', x: fxX, y: fy, w, h, visible: 1 }), id);
                UI.add(Object.assign({}, fxText, { id: id + 'FxText', parent: id + 'Fx', text: icons.join(''), visible: 1 }));
                this.fxIds.push(id + 'FxText', id + 'Fx');
            });
        }
        const none = UI.get('actSpecNone');
        if (none) none.show(this.mode === 'plan' && !this.actIds.length);
    },
};
Object.assign(CoopGame.prototype, CoopGameTags);
