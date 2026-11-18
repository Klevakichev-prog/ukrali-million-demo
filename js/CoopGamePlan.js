// CoopGamePlan.js — a part of CoopGame (CoopGame.js): the plans. A press — a tap on a cell or an
// object, an action button, Wait with the list of the plans' events — adds steps to the selected
// hero's plan unless the ceiling refuses it (rules, section 23); Undo, Clear, the level's solution,
// the levels reloaded from the sheet, the plan saved and loaded (section 37). Methods of the game, mixed into its prototype.

/** @satisfies {ThisType<CoopGame>} */
const CoopGamePlan = {
    // The cell where the hero's plan ends so far.
    endOf(i) {
        return this.M.endCell(this.plans[i], i);
    },

    // Appends steps to the selected hero's plan (one undo step). A wait right after a wait
    // lengthens it: Wait pressed three times is one «ждать 3 т». A press after which the hero's plan,
    // or another one that was in time, ends past the plan's ceiling is not added at all, the hint
    // tells why (rules, section 23); a plan already past it does not hold the others' presses.
    push(steps) {
        if (!steps.length || this.mode !== 'plan' || this.ready[this.sel]) return;
        const plan = this.M.pressed(this.plans[this.sel], steps);
        const late = this.M.L.lab ? null : this.M.lateBy(this.plans, this.sel, plan, this.lim ? this.lim.late : []);
        this.refused = late && late.k >= 0 ? CoopGame.lateText(this.M, late.L, late.k) : null;
        if (this.refused) { this.renderHud(); return; }
        this.history[this.sel].push(this.plans[this.sel]);
        this.plans[this.sel] = plan;
        this.planT = null;
        this.refresh();
    },

    // What keeps the single player's heist from starting (rules, section 23), the first of: no
    // plan, a plan past the ceiling, a plan ending out of the van. null — «Начать ограбление» is on.
    startWhy() {
        const L = this.lim;
        if (!L || this.M.L.lab) return null;
        if (L.empty) return CoopText.t('game.plan_empty');
        if (L.late.length) return CoopText.t(L.police ? 'game.start_late_police' : 'game.start_late_patrol', { who: this.M.heroes[L.late[0]].fruit });
        if (L.away.length) return CoopText.t('game.start_away', { who: this.M.heroes[L.away[0]].fruit });
        return null;
    },

    // Takes back the last press (a walk, a wait tick, an action, a clear) of the selected hero.
    undo() {
        const h = this.history[this.sel];
        if (!h.length || this.ready[this.sel]) return;
        this.plans[this.sel] = h.pop();
        this.planT = null;
        this.refresh();
    },

    clear() {
        if (this.ready[this.sel] || !this.plans[this.sel].length) return;
        this.history[this.sel].push(this.plans[this.sel]);
        this.plans[this.sel] = [];
        this.planT = null;
        this.refresh();
    },

    // The ticks a Wait press adds: 0 (a tap lists events) … COOP_WAIT_MAX.
    /** @param {number} n */
    setWait(n) {
        this.clearAsk();
        this.openWaitList(false);
        this.waitN = Math.max(0, Math.min(this.c.waitMax, n));
        this.planT = null;
        this.preview();
        this.buildActions(this.endOf(this.sel));
        this.renderHud();
    },

    // The events of the plans worth waiting for (CoopGame.WAIT_KINDS): those after the selected
    // hero's plan ends — his own come before it; at most WAIT_LIST, the nearest first.
    waitEvents() {
        if (!this.ghost) return [];
        const after = this.ends ? this.ends[this.sel] : 0;
        return this.ghost.events.filter(e => CoopGame.WAIT_KINDS.includes(e.kind) && e.t > after).slice(0, CoopGame.WAIT_LIST);
    },

    // The list over Wait: copies of actWaitEvTpl stacked up; a tap on an event puts the ticks till
    // it on Wait (the event is only a tick: − and + go on from there). No events — one grey line.
    /** @param {boolean} on */
    openWaitList(on) {
        for (const id of this.waitIds) UI.remove(id);
        this.waitIds = [];
        const t = UI.def('actWaitEvTpl'), none = UI.def('actWaitEvNone');
        if (!on || !t) return;
        const list = this.waitEvents();
        if (!list.length && none) {
            UI.add(Object.assign({}, none, { id: 'actWaitEv0', tpl: none.id, visible: 1 }), 'actWaitEvNone');
            this.waitIds.push('actWaitEv0');
            return;
        }
        list.forEach((e, i) => {
            const id = 'actWaitEv' + i;
            UI.add(Object.assign({}, t, { id, y: t.y + i * (t.h + CoopGame.WAIT_GAP), visible: 1, text: CoopGame.clock(e.t) + ' · ' + e.text }), 'actWaitEvTpl');
            const el = UI.get(id);
            if (el) el.onClick(() => this.setWait(e.t - (this.ends ? this.ends[this.sel] : 0)));
            this.waitIds.push(id);
        });
    },

    // The route of a tap (rules, section 18; Ivan 23.10): the earliest way to the cell. A door shut
    // when the hero gets there — he waits for the plan to open it, or opens it himself (picks it
    // first if nobody does); a sensor door with the light on and a gate stay walls. One press —
    // «Отменить» takes it all back. The walk starts at the tick the hero's plan ends plus the ticks
    // set on Wait: the wait first, as a button and a tap on an object (Ivan 07.11: «Ждать» set to
    // the dark, a tap into the beam walked at once, under the light).
    walkTo(x, y) {
        [x, y] = this.M.bayOf(x, y);   // a tap on the van's cab — into its bay (rules, section 30)
        this.refused = null;
        const at = this.endOf(this.sel), n = this.pendingWait();
        if (at[0] === x && at[1] === y) return;
        const F = this.ghost && this.ghost.frames, t0 = (this.ends ? this.ends[this.sel] : 0) + n;
        const p = this.M.route(this.sel, at, [x, y], F || null, t0);
        this.noPath = !p ? (this.M.path(at, [x, y], { open: null }) ? 'door' : 'none') : false;
        if (!p) { this.renderHud(); return; }
        if (n > 0) this.waitN = 0;
        this.push(n > 0 ? [{ op: 'wait', ticks: n }].concat(p) : p);
    },

    // A tap on an object (rules, section 25; Ivan 05.11): the hero goes to it the earliest and does
    // its action by the plan's state then — one press, the ticks set on Wait first, like a button
    // («Отменить» takes it all back). Nothing to do — he only walks up, the hint says why.
    /** @param {{ kind: string, i: number }} obj */
    tapObject(obj) {
        const n = this.pendingWait(), at = this.endOf(this.sel);
        const F = this.ghost && this.ghost.frames, t0 = (this.ends ? this.ends[this.sel] : 0) + n;
        const r = this.M.tapObject(this.sel, at, obj, F || null, t0, this.ghostOn);
        if (!r) { this.refused = null; this.noPath = 'none'; this.renderHud(); return; }
        const wait = n > 0 && r.steps.length ? [{ op: 'wait', ticks: n }] : [];
        if (wait.length) this.waitN = 0;
        this.push(wait.concat(r.steps));
        if (r.why && !this.refused) { this.tapWhy = r.why; this.renderHud(); }
    },

    // An action goes after the ticks set on Wait (Ivan 20.10: the buttons are those of that tick —
    // rules, section 9): the wait first, then the action; Wait is back to 0.
    act(v) {
        const at = this.endOf(this.sel).slice(), n = this.pendingWait();
        const step = { op: 'act', verb: v.verb, target: v.target, at };
        this.waitN = n > 0 ? 0 : this.waitN;
        this.push(n > 0 ? [{ op: 'wait', ticks: n }, step] : [step]);   // one press: «Отменить» takes back both
    },

    // The level's intended solution (level.json -> solution), for a look at a full take.
    solution() {
        const S = this.M.L.solution;
        if (!S) return;
        this.toPlan();
        this.plans = this.M.team.map(r => S[r] ? this.M.planFromScript(r, S[r]) : []);
        this.history = this.M.heroes.map(() => []);
        this.planT = null;
        this.refresh();
    },

    // The levels from the level book (Ivan 29.10: the Google sheet is the source of the levels): downloaded,
    // checked like tools/make-coop-levels.mjs checks them; a broken level leaves the game's levels as they
    // are. The PC build keeps them in levels/levels.json next to the exe (main.js lays them over
    // CoopLevels.js) and reloads; on the dev server the levels go to design/levels by
    // tools/levels-from-sheet.mjs.
    async levelsFromSheet() {
        const note = (/** @type {string} */ t) => { const n = UI.get('sheetNote'); if (n) { n.setText(t); n.show(!!t); } };
        note(CoopText.t('game.sheet_loading'));
        try {
            const { levels, warnings } = await CoopBook.load();
            const warn = warnings.length ? '\n' + CoopText.t('game.sheet_warn', { n: warnings.length }) : '';
            for (const w of warnings) console.warn(w);
            if (location.protocol !== 'app:') {
                note(CoopText.t('game.sheet_checked', { n: levels.length, warn }));
                return;
            }
            const r = await fetch('/levels/levels.json', { method: 'PUT', body: JSON.stringify(levels) });
            if (!r.ok) throw new Error(CoopText.t('game.sheet_write_failed', { error: await r.text() }));
            note(CoopText.t('game.sheet_loaded', { n: levels.length, warn }));
            if (!warnings.length) location.reload();
        } catch (e) {
            note(CoopText.t('game.sheet_error'));
            console.error(e);
            alert(CoopText.t('game.sheet_alert', { error: e.message }));
        }
    },

    // «Сохранить план» / «Загрузить план» (rules, section 37; Ivan 16.11): the plans of the level as the model
    // keeps them, one record a level — the PC build's plans/<level id>.json next to the exe (main.js), the
    // page's storage elsewhere. Not in the tutorial and at the stations of the polygon.
    planFileOn() {
        return !this.tutSteps && !this.M.L.lab;
    },

    /** @param {string} key */
    planNote(key) {
        const n = UI.get('planNote');
        if (n) { n.setText(CoopText.t(key)); n.show(true); }
    },

    // Saving — while planning and in the heist (the plan is locked there). Besides the steps, for checking
    // against the model: the patrol, where each plan ends and the run of the plans now; the game reads only the steps.
    async savePlan() {
        if (!this.planFileOn()) return;
        const M = this.M, team = M.team, r = M.simulate(this.plans), app = CoopGame.onApp();
        const build = app ? await fetch('build.json').then(q => q.json()).then(b => b.hash || null, () => null) : null;
        const file = {
            level: M.L.id, patrol: M.patrolTicks, build, saved: new Date().toISOString(),
            heroes: Object.fromEntries(team.map((id, i) => [id, this.plans[i]])),
            ends: Object.fromEntries(team.map((id, i) => [id, this.ghost.planEnd[i]])),
            result: { money: r.money, stars: r.stars, alarm: r.alarmT, caught: r.caught.map((/** @type {number} */ i) => team[i]), ticks: r.ticks }
        };
        const text = JSON.stringify(file);
        let ok = false;
        try {
            ok = app ? (await fetch(CoopGame.PLAN_DIR + M.L.id + '.json', { method: 'PUT', body: text })).ok : !!Store.set(CoopGame.PLAN_STORE + M.L.id, text);
        } catch (e) {
            console.error(e);
        }
        this.planNote(ok ? 'game.plan_saved' : 'game.plan_save_failed');
    },

    // Loading — only while planning: the saved plans replace every hero's whole, by his id (a hero of the
    // crew not in the record — an empty plan, one of the record not in the crew — skipped); not checked
    // again — the ghost shows what comes of them. Readiness off, «Отменить» from here.
    async loadPlan() {
        if (this.mode !== 'plan' || !this.planFileOn()) return;
        const id = this.M.L.id;
        /** @type {any} */
        let file = null;
        try {
            if (CoopGame.onApp()) {
                const r = await fetch(CoopGame.PLAN_DIR + id + '.json');
                file = r.ok ? JSON.parse(await r.text()) : null;
            } else file = Store.getJSON(CoopGame.PLAN_STORE + id, null);
        } catch (e) {
            file = null;
        }
        const H = file && file.heroes;
        if (!H || typeof H !== 'object' || Array.isArray(H) || this.mode !== 'plan') { this.planNote('game.plan_none'); return; }
        this.plans = this.M.team.map(h => (Array.isArray(H[h]) ? H[h] : []));
        this.history = this.M.heroes.map(() => []);
        this.ready = this.M.heroes.map(() => false);
        this.waitN = 0;
        this.planT = null;
        this.refresh();
        this.planNote('game.plan_loaded');
    },
};
Object.assign(CoopGame.prototype, CoopGamePlan);
