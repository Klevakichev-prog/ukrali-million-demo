// CoopGameHint.js — a part of CoopGame (CoopGame.js): the hints. The tag over an object, a guard or a
// hero under the cursor and the outline in the hero's color (rules, section 26; Ivan 08.11); the
// advice of «?» — its line in the log and its mark on the floor (section 24). Methods of the game,
// mixed into its prototype.

/** @satisfies {ThisType<CoopGame>} */
const CoopGameHint = {
    // The cursor at canvas point (px, py) (CSS px; cx, cy — the same on the page): in the plan, over the
    // model of an object a tap works (a door too, Ivan 08.11) — its outline in the selected hero's color
    // and its tag; over a guard or a hero — the tag alone; over the floor, an element of the HUD or out of the plan — none.
    /** @param {number} px @param {number} py @param {number} [cx] @param {number} [cy] */
    onHover(px, py, cx, cy) {
        const overHud = cx != null && typeof UI.over === 'function' && UI.over(cx, cy, ['hoverTip']);
        const obj = this.mode === 'plan' && !overHud && this.scene.pickHover ? this.scene.pickHover(px, py) : null;
        this.hoverAt = [px, py, cx, cy];
        const tag = obj ? this.hoverTagKept(obj) : null;
        if (!tag) { this.hideHover(); return; }
        const h = this.M.heroes[this.sel];
        // the tutorial's target keeps its own blinking outline (rules, section 27)
        const mark = !!this.tutSteps && CoopTutorial.matches(this.M, this.tutStep(), { do: 'tap', obj });
        if (this.scene.setHover) this.scene.setHover(tag.outline && !mark ? obj : null, cssColor(h.color));
        const tip = UI.get('hoverTip');
        if (!tip) return;
        this.showTag(tag);
        tip.show(true);
        this.placeHover(tip, px, py);
    },

    // The five places of the tag (rules, section 26), top to bottom; an empty one is hidden. The stamp —
    // in the frame of its tone.
    /** @param {any} tag */
    showTag(tag) {
        const put = (/** @type {string} */ id, /** @type {string[]} */ lines) => {
            const e = UI.get(id);
            if (e) { e.setText(lines.join('\n')); e.show(lines.length > 0); }
        };
        put('hoverTitle', [tag.title]);
        put('hoverState', tag.state);
        put('hoverProps', tag.props);
        put('hoverWays', tag.ways);
        put('hoverMore', tag.more);
        const rule = UI.get('hoverRule');
        if (rule) rule.show(tag.ways.length > 0 || !!tag.stamp);
        for (const [tone, [boxId, textId]] of Object.entries(CoopGame.HOVER_STAMPS)) {
            const on = !!tag.stamp && tag.stamp.tone === tone, box = UI.get(boxId), text = UI.get(textId);
            if (text) text.setText(on ? tag.stamp.text : '');
            if (box) box.show(on);
        }
    },

    // The places in a column, each by its text, the plate round them by the cursor, right and below; at an
    // edge of the screen — inside it.
    /** @param {any} tip @param {number} px @param {number} py */
    placeHover(tip, px, py) {
        const stamps = Object.values(CoopGame.HOVER_STAMPS), textOf = new Map(stamps.map(([b, t]) => [b, UI.get(t)]));
        const ids = ['hoverTitle', 'hoverState', 'hoverProps', 'hoverRule', 'hoverWays', ...stamps.map(([b]) => b), 'hoverMore'];
        const parts = ids.map(id => UI.get(id)).filter(e => e && e.visible);
        if (!parts.length || parts.some(e => typeof e.box !== 'function')) return;
        const s = UI.scale(), pad = CoopGame.HOVER_PAD, gap = CoopGame.HOVER_GAP, sp = CoopGame.HOVER_STAMP_PAD, W = UI.size();
        let y = pad, w = 0;
        for (const e of parts) {
            const stamp = textOf.get(e.def.id);
            if (stamp) { const b = stamp.box(); e.sizeTo(b.w + sp * 2, b.h + sp); }
            const b = e.box();
            e.moveTo(pad, y);
            y += b.h + gap;
            if (e.def.id !== 'hoverRule') w = Math.max(w, b.w);   // the rule spans the plate
        }
        const tw = w + pad * 2, th = y - gap + pad, x = px / s + CoopGame.HOVER_OFFSET, top = py / s + CoopGame.HOVER_OFFSET;
        tip.sizeTo(tw, th);
        tip.moveTo(x + tw > W.w ? Math.max(0, px / s - CoopGame.HOVER_OFFSET - tw) : x, top + th > W.h ? Math.max(0, py / s - CoopGame.HOVER_OFFSET - th) : top);
    },

    // The plan changed under a still cursor (a click): the tag tells the next click.
    rehover() {
        const tip = UI.get('hoverTip');
        if (!this.hoverAt || !tip || !tip.visible) return;
        const [px, py, cx, cy] = this.hoverAt;
        this.onHover(px, py, cx, cy);
    },

    hideHover() {
        if (this.scene && this.scene.setHover) this.scene.setHover(null, null);
        const tip = UI.get('hoverTip');
        if (tip && tip.visible) tip.show(false);
    },

    // The tag of an object, kept: a mouse move asks it ~60 times a second, a full plan costs ~10 ms — kept
    // while the object and what the click reads (the plans, the hero, Wait, «Идти», «Готов», the hint) stay.
    /** @param {{ kind: string, i: number }} obj */
    hoverTagKept(obj) {
        const key = [obj.kind, obj.i, this.sel, this.pendingWait(), this.ready[this.sel], this.hintOn, this.tutK].join(':'), m = this.hoverMemo;
        if (m && m.key === key && m.plans.length === this.plans.length && m.plans.every((p, k) => p === this.plans[k])) return m.tag;
        const tag = this.hoverTag(obj);
        this.hoverMemo = { key, plans: this.plans.slice(), tag };
        return tag;
    },

    // The tag over an object (rules, section 26; Ivan 13.11, the five places): the title — an icon and what
    // it is; its state in the plan's frame at the end of the selected hero's plan (a hero — of his own);
    // its properties; what can still be done, in the selected hero's time; the click's stamp, counted as
    // the click counts it; its own consequences, red. Only the object's own (Ivan 13.11): no alarm on the
    // click's way, no story of the plan. -> { title, state, props, ways, stamp — { tone: 'ok' | 'bad' |
    // 'muted', text } or null, more, outline } or null — nothing to tell.
    /** @param {{ kind: string, i: number }} obj */
    hoverTag(obj) {
        const k = obj.kind, t = this.ends ? this.ends[k === 'hero' ? obj.i : this.sel] : 0, st = this.tagState(t);
        const tag = k === 'hero' ? this.heroTag(obj.i, st) : k === 'guard' ? this.guardTag(obj.i, st) : k === 'panel' ? this.panelTag(obj.i, st)
            : k === 'loot' ? this.lootTag(obj.i, st) : k === 'door' || k === 'gate' ? this.doorTag(obj.i, st) : null;
        if (!tag) return null;
        const outline = k !== 'guard' && k !== 'hero';
        return Object.assign({ state: [], props: [], ways: [], more: [] }, tag, { stamp: outline ? this.clickStamp(obj) : null, outline });
    },

    // The plan's frame at tick t as the buttons read it (CoopModel.frameState); no ghost yet — the level as it starts.
    /** @param {number} t */
    tagState(t) {
        const M = this.M, F = this.ghost && this.ghost.frames;
        if (F && F.length) return M.frameState(F, t, this.ghostOn);
        return { loot: M.loot.map((/** @type {any} */ l) => ({ x: l.at[0], y: l.at[1], holder: -1, delivered: false, broken: false, opened: false })),
            doorOpen: M.openAtStart(), doorUnlocked: M.unlockedAtStart(), power: M.panels.map(() => true), guards: M.guards.map(() => ({ out: false, tied: false })) };
    },

    // «вскрыть (0:06) — тихо»: an action and its time for the selected hero, as on his button.
    /** @param {string} word @param {string} verb @param {string} target */
    tagWay(word, verb, target) {
        const lost = Math.round((1 - CoopModel.OBJECTS.vitrine.grab_keep) * 100);
        return CoopText.t('game.tag_way_' + word, { t: CoopGame.clock(this.M.workTicks(this.M.heroes[this.sel], verb, target)), lost });
    },

    // Does the player see item k's price (decision 20.10, as the plan sheet): on a level with valuable loot —
    // a valuable one with «Подсказка: ценные» on; else every one.
    /** @param {number} k */
    priceKnown(k) {
        const L = this.M.loot;
        return !L.some((/** @type {any} */ q) => q.hint) || (this.hintOn && !!L[k].hint);
    },

    // A vitrine, a pedestal (while its item is home, in hands or in the van), a painting, an item on the floor.
    /** @param {number} k @param {any} st */
    lootTag(k, st) {
        const M = this.M, T = CoopText.t, l = M.loot[k], s = st.loot[k];
        if (!l || !s) return null;
        const num = CoopModel.num, money = CoopPlanMap.money, known = this.priceKnown(k), icon = T('game.tag_icon_' + l.model);
        const held = s.holder >= 0, home = !held && !s.delivered && s.x === l.at[0] && s.y === l.at[1];
        if ((l.glass || l.stand) && (home || held || s.delivered)) {
            const what = known ? T('game.tag_item_price', { icon, name: l.name, price: money(l.value), mass: num(l.mass) }) : T('game.tag_item', { icon, name: l.name, mass: num(l.mass) });
            if (l.stand) {
                const title = T('game.tag_title', { icon: T('game.tag_icon_stand'), name: T('game.tag_stand') });
                return home ? { title, props: [what], ways: [this.tagWay('take', 'take', l.id)] } : { title, state: [T('game.tag_stand_empty')] };
            }
            const title = T('game.tag_title', { icon: T('game.tag_icon_vitrine'), name: T('game.tag_vitrine') });
            const word = T(s.broken ? 'game.tag_vitrine_broken' : s.opened ? 'game.tag_vitrine_opened' : 'game.tag_vitrine_locked');
            if (!home) return { title, state: [T('game.tag_empty', { state: word })] };
            const whole = !s.broken && !s.opened;
            const ways = whole ? [this.tagWay('unlock', 'unlock', l.id), this.tagWay('smash', 'smash', l.id)]
                : s.broken && l.multi ? [this.tagWay('grab', 'grab', l.id), this.tagWay('gather', 'gather', l.id)]
                    : [this.tagWay('take', s.broken ? 'grab' : 'take', l.id)];   // a mono item out of the shards is taken whole (section 10)
            const alarm = l.sensor && whole && M.isArmed('sensors', st.power);
            return { title, state: [word], props: [what].concat(l.sensor ? [T('game.tag_sensor')] : []), ways, more: alarm ? [T('game.tag_alarm')] : [] };
        }
        const title = T('game.tag_title', { icon, name: l.name });
        const state = held ? [T('game.tag_carried', { who: M.heroes[s.holder].fruit })] : s.delivered ? [T('game.tag_in_van')] : [];
        const props = [known ? T('game.tag_price', { price: money(l.value), mass: num(l.mass) }) : T('game.tag_mass', { mass: num(l.mass) })];
        return { title, state, props, ways: held || s.delivered ? [] : [this.tagWay('take', 'take', l.id)] };
    },

    // A door or a gate (its leaf i; a gate — as a door, by its electronic lock): the lock — the one of all its leaves.
    /** @param {number} i @param {any} st */
    doorTag(i, st) {
        const M = this.M, T = CoopText.t, d = M.doors[i];
        if (!d) return null;
        const L = M.doors[d.lockOf] || d, lock = L.lock || d.lock, open = !!st.doorOpen[i];
        const unlocked = !lock || open || !!st.doorUnlocked[i] || !!st.doorUnlocked[d.lockOf];
        const state = T(open ? 'game.tag_door_open' : !lock ? 'game.tag_door_shut' : unlocked ? 'game.tag_door_unlocked' : 'game.tag_door_locked_' + lock);
        const ways = [open ? this.tagWay('close', 'close', d.id) : unlocked ? this.tagWay('open', 'open', d.id)
            : lock === 'electronic' ? this.tagWay('hack', 'hack', d.id) : this.tagWay('pick', 'pick', L.id)];
        const alarm = d.sensor && !open && M.isArmed('sensors', st.power);
        return { title: T('game.tag_title', { icon: T('game.tag_icon_door'), name: T('game.tag_door') }), state: [state],
            props: d.sensor ? [T('game.tag_sensor')] : [], ways, more: alarm ? [T('game.tag_alarm')] : [] };
    },

    /** @param {number} i @param {any} st */
    panelTag(i, st) {
        const M = this.M, T = CoopText.t, P = M.panels[i];
        if (!P) return null;
        const on = !(Array.isArray(st.power) && st.power[i] === false);
        return { title: T('game.tag_title', { icon: T('game.tag_icon_panel'), name: T('game.tag_panel') }), state: [T(on ? 'game.tag_panel_on' : 'game.tag_panel_off')],
            props: [T('game.tag_powers', { what: CoopPlanMap.powersText(M, P) })], ways: on ? [this.tagWay('power', 'power', P.id)] : [] };
    },

    // A guard where the plan has him at the end of the selected hero's plan (Ivan 08.11); his actions are buttons by him.
    /** @param {number} i @param {any} st */
    guardTag(i, st) {
        const M = this.M, T = CoopText.t, g = M.guards[i], q = st.guards[i];
        if (!g) return null;
        const up = !(q && (q.out || q.tied));
        return { title: T('game.tag_title', { icon: T('game.tag_icon_guard'), name: T('game.tag_guard') }),
            state: [T(q && q.tied ? 'game.tag_guard_tied' : up ? 'game.tag_guard_up' : 'game.tag_guard_out')],
            ways: up ? [this.tagWay('knock', 'knock', g.id)] : q && !q.tied ? [this.tagWay('tie', 'tie', g.id)] : [], more: up ? [T('game.tag_guard_sees')] : [] };
    },

    // A hero at the end of his own plan: his skill in a word (section 29), his load, the money he carries —
    // the prices the player sees; carrying loot of a price not shown too — «+ ?», only such loot — «???» (Ivan 13.11).
    /** @param {number} i @param {any} st */
    heroTag(i, st) {
        const M = this.M, T = CoopText.t, h = M.heroes[i];
        if (!h) return null;
        let load = 0, sum = 0, seen = 0, more = false;
        st.loot.forEach((/** @type {any} */ s, /** @type {number} */ k) => {
            if (s.holder !== i) return;
            load += M.massOf(k, s);
            if (this.priceKnown(k)) { sum += M.loot[k].value * (s.spoiled ? CoopModel.OBJECTS.vitrine.grab_keep : 1); seen++; }
            else more = true;
        });
        const money = CoopPlanMap.money(Math.round(sum));
        return { title: T('game.tag_title', { icon: h.icon, name: h.fruit }), state: h.skill ? [T('game.tag_skill', { skill: CoopGame.skillWord(h) })] : [],
            props: [T('game.tag_load', { mass: CoopModel.num(load), cap: CoopModel.num(M.capacity(h)) }), T(more && !seen ? 'game.tag_haul_unknown' : more ? 'game.tag_haul_more' : 'game.tag_haul', { money })] };
    },

    // The click's stamp (rules, sections 25, 26): the same press tapObject makes — Wait first, the way, the
    // action — tried, not added. Refusals of the click itself — grey; it would not make it or it overloads —
    // red; nothing to do or only a walk — no stamp; else «Клик: вскрыть — готово в 0:29».
    /** @param {{ kind: string, i: number }} obj @returns {{ tone: string, text: string } | null} */
    clickStamp(obj) {
        const T = CoopText.t, muted = (/** @type {string} */ text) => ({ tone: 'muted', text });
        const n = this.pendingWait(), at = this.endOf(this.sel);
        const F = this.ghost && this.ghost.frames, t0 = (this.ends ? this.ends[this.sel] : 0) + n;
        const tap = () => this.M.tapObject(this.sel, at, obj, F || null, t0, this.ghostOn);
        // the tutorial (section 27): a click off the step does nothing — «Не сейчас» where the click would act
        // (section 31, Ivan 14.11: not on an emptied vitrine); its tap with a cell only walks there
        if (this.tutSteps && !CoopTutorial.matches(this.M, this.tutStep(), { do: 'tap', obj })) {
            const q = tap();
            // a plate shown (section 32): «Дальше» first; else the press's number, plates not counted
            const s = this.tutStep(), now = s && s.do === 'note' ? T('game.tut_not_now_next') : T('game.tut_not_now', { n: CoopTutorial.nums(this.tutSteps).n[this.tutK] });
            return q && (q.verb || q.over) ? muted(now) : null;
        }
        if (this.tutSteps && CoopTutorial.walkCell(this.tutStep())) return muted(T('game.click_walk_only'));
        if (this.ready[this.sel]) return muted(T('game.click_unready'));
        const r = tap();
        if (!r) return muted(T('game.click_no_way'));
        if (r.over) return { tone: 'bad', text: r.why };
        if (!r.steps.length) return null;
        const steps = (n > 0 ? [{ op: 'wait', ticks: n }] : []).concat(r.steps);
        const late = this.M.lateBy(this.plans, this.sel, this.M.pressed(this.plans[this.sel], steps), this.lim ? this.lim.late : []);
        if (!this.M.L.lab && late.k >= 0) return { tone: 'bad', text: T(late.L.police ? 'game.tag_late_police' : 'game.tag_late_patrol') };
        if (!r.verb) return null;
        const l = this.M.loot.find((/** @type {any} */ q) => q.id === r.verb.target);
        const verb = r.verb.verb === 'grab' && !(l && l.multi) ? 'take' : r.verb.verb;
        return { tone: 'ok', text: T('game.click_act', { act: T('game.tag_do_' + verb), t: CoopGame.clock(late.L.ends[this.sel]) }) };
    },

    // «?» (rules, section 24; Ivan 29.10): the advice of the level's solution to the selected hero —
    // a line at the end of the plan's log and a frame on the button to press or on the floor cell
    // to walk to; both stay till the plan changes or another hero is picked.
    askAdvice() {
        if (this.mode !== 'plan') return;
        if (this.tutSteps) { this.tutAdvice(); return; }
        const a = this.M.advice(this.plans, this.sel, this.ghost, this.ghostOn);
        if (!a) return;
        this.clearAsk();
        const at = this.endOf(this.sel), here = a.at && a.at[0] === at[0] && a.at[1] === at[1];
        let line = '', mark = null, cell = null;
        // the alarm and a plan past the ceiling go to the hero whose plan it is: his «Отменить» (none
        // to take back — a plan of the level's solution — «Очистить»)
        const back = () => (this.history[this.sel].length ? [CoopText.t('game.ask_undo'), 'actUndo'] : [CoopText.t('game.ask_clear'), 'actClear']);
        const other = (a.kind === 'alarm' || a.kind === 'late') && a.hero !== this.sel;
        if (other) { line = CoopText.t('game.ask_partner', { who: this.M.heroes[a.hero].fruit }); mark = 'heroCard' + a.hero; }
        if (a.kind === 'alarm') { const [b, m] = back(); line = CoopText.t('game.ask_alarm', { t: CoopGame.clock(a.t), why: a.why, then: other ? line : CoopText.t('game.ask_alarm_back', { back: b }) }); mark = mark || m; }
        else if (a.kind === 'late') { const [b, m] = back(); line = CoopText.t(a.police ? 'game.ask_late_police' : 'game.ask_late_patrol', { t: CoopGame.clock(a.t), then: other ? line : b }); mark = mark || m; }
        else if (a.kind === 'astray') { const [b, m] = back(); line = CoopText.t('game.ask_astray', { back: b }); mark = m; }
        // nothing of the plan in time (Ivan 06.11): «Очистить» — a press back rarely saves it
        else if (a.kind === 'gone') { const label = this.M.label(a.verb, a.target); line = CoopText.t('game.ask_gone', { act: label.charAt(0).toLowerCase() + label.slice(1) }); mark = 'actClear'; }
        else if (a.kind === 'partner') { line = CoopText.t('game.ask_partner', { who: this.M.heroes[a.hero].fruit }); mark = 'heroCard' + a.hero; }
        else if (a.kind === 'go') { line = CoopText.t('game.ask_go'); cell = a.at; }
        else if (a.kind === 'van') { line = CoopText.t('game.ask_van'); cell = a.at; }
        else if (a.kind === 'until') { line = CoopText.t('game.ask_until', { t: CoopGame.clock(a.tick) }); mark = this.M.heroes.length > 1 ? 'actWait' : null; }
        else if (a.kind === 'act') {
            const label = this.M.label(a.verb, a.target), k = here ? (this.actVerbs || []).findIndex(v => v.verb === a.verb && v.target === a.target) : -1;
            line = label.charAt(0).toLowerCase() + label.slice(1);
            if (k >= 0) mark = 'actSpec' + k; else cell = a.at;
        } else {
            const block = this.gameMode !== 'coop' ? this.startWhy() : null;
            line = this.gameMode === 'coop' ? CoopText.t('game.ask_ready') : block ? CoopText.t('game.ask_blocked', { why: block }) : CoopText.t('game.ask_start');
            mark = block ? 'actReadyOff' : 'actReady';
        }
        // co-op: a ready hero's plan is locked — the partners' plans changed it; «Не готов» first
        if (this.ready[this.sel] && a.kind !== 'start' && a.kind !== 'partner' && !other) { line = CoopText.t('game.ask_unready', { line }); mark = 'actReady'; cell = null; }
        this.showAsk(line, mark, cell);
    },

    // «Совет» in the tutorial (rules, section 31; Ivan 14.11): the current step, as the tutorial leads — «Рекомендация: » +
    // its task, the ring on its cell or the frame on its button. Its own step («Спросить совет») is done by the press and
    // the next one is advised. A window open (the sheet, the hero's, «Начать ограбление?») or a plate (section 32) —
    // nothing. The press advised is the next one past the plates; a plate after «Спросить совет» keeps the line in the
    // log and holds the ring or the frame till its «Дальше» (tutNote).
    tutAdvice() {
        const box = UI.get('confirmBox'), s = this.tutStep();
        if (this.mapOpen() || this.heroOpen() || (box && box.visible) || (s && s.do === 'note')) return;
        if (s && CoopTutorial.matches(this.M, s, { do: 'ask' })) this.tutNext();
        const j = this.tutSteps.findIndex((/** @type {any} */ q, /** @type {number} */ i) => i >= this.tutK && q.do !== 'note');
        const a = CoopTutorial.advice(this.M, j >= 0 ? this.tutSteps[j] : null);
        if (!a) return;
        this.clearAsk();
        const k = a.verb && this.actVerbs ? this.actVerbs.findIndex(v => v.verb === a.verb.verb && v.target === a.verb.target) : -1;
        const line = a.task.charAt(0).toLowerCase() + a.task.slice(1), mark = a.start ? 'actReady' : a.undo ? 'actUndo' : k >= 0 ? this.actIds[k] || null : null;
        if (j === this.tutK) { this.showAsk(line, mark, a.cell); return; }
        this.showAsk(line, null, null);
        this.askLater = { line, mark, cell: a.cell };
    },

    // The advice's line in the plan's log, the element mark blinking its own outline (blinkTick; rules 34, Ivan 18.11)
    // and its ring on cell (null — none).
    /** @param {string} line @param {string | null} mark @param {number[] | null} cell */
    showAsk(line, mark, cell) {
        this.askLine = CoopText.t('game.ask', { line });
        this.askMark = mark;
        this.scene.askCell = cell;
        this.renderHud();
    },

    clearAsk() {
        this.askLater = null;
        this.askLine = null;
        this.askMark = null;
        if (this.scene) this.scene.askCell = null;
    },
};
Object.assign(CoopGame.prototype, CoopGameHint);
