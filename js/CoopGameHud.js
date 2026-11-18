// CoopGameHud.js — a part of CoopGame (CoopGame.js): the HUD drawn from the state. The plan's cards
// and buttons, the log of the plan or the heist, the banner with the tick and the alarm, the timer
// of the police and the patrol, the tasks, the result window. Methods of the game, mixed into its
// prototype.

/** @satisfies {ThisType<CoopGame>} */
const CoopGameHud = {
    renderHud() {
        const set = (id, s) => { const el = UI.get(id); if (el) el.setText(s); };
        const show = (id, v) => { const el = UI.get(id); if (el) el.show(v); };
        const clock = CoopGame.clock, plan = this.mode === 'plan';
        set('levelTitle', this.M.L.title);
        // the level's name follows the phase in one line over the screen (Ivan 05.11: «Фаза планирования —
        // лавка… в одну строчку»; 29.10 it stood on its own line under it)
        const title = this.M.L.title ? ' · ' + this.M.L.title : '';
        show('levelName', false);
        const run = !plan && this.run ? this.run : null;
        const f = run ? run.frames[Math.min(run.frames.length - 1, Math.floor(this.rt))] : null;
        // The hero cards (the plan phase): the icon, in co-op the player (no network yet — a stand-in
        // name, always online; single player — the hero's name, no online), below — online and ready as icons, the tick his plan ends at, its last
        // step (an action's «what: where» on two lines — the card is narrow).
        this.M.heroes.forEach((h, i) => {
            set('heroIcon' + i, CoopGame.heroIcon(h));
            // the hero's picture in place of the emoji (rules, section 29); no picture — the emoji
            const img = UI.get('heroIconImg' + i);
            if (img && h.iconArt) img.setImage(h.iconArt);
            show('heroIconImg' + i, !!h.iconArt);
            show('heroIcon' + i, !h.iconArt);
            const coop = this.gameMode === 'coop';
            // co-op: the player alone — «Игрок 1 · Вася Морковкин» does not fit, the picture names the hero
            set('heroNick' + i, coop ? CoopText.t('game.nick', { n: i + 1 }) : h.fruit);
            show('heroOnline' + i, coop);
            // the chosen hero: his name's row filled with the select role, the name in ink (rules, section 34)
            show('heroSel' + i, i === this.sel);
            const nick = UI.get('heroNick' + i);
            if (nick) nick.setLook(i === this.sel ? 'ink' : null);
            show('heroReady' + i, coop && !!this.ready[i]);
            show('heroNotReady' + i, coop && !this.ready[i]);
            // single (Ivan 19.10): in place of ready — the van, bright if his plan ends in it
            const home = this.M.isVan(...this.endOf(i));
            show('heroVan' + i, !coop && home);
            show('heroNoVan' + i, !coop && !home);
            set('heroTick' + i, clock(this.ends ? this.ends[i] : 0));
            set('heroLast' + i, this.heroLastText(i, CoopGame.lastStep(this.plans[i], (s) => this.stepText(s))));
        });
        // The actions at the bottom are the plan's; a take hides them, a ready hero has only
        // «Не готов» (his plan is locked).
        const edit = plan && !this.ready[this.sel];
        // Wait syncs heroes: a crew of one has nothing to wait for (Ivan 29.10, level 1 — «подупростить»)
        const waits = edit && this.M.heroes.length > 1;
        show('actWait', waits);
        show('actWaitLess', waits);
        show('actWaitMore', waits);
        for (const id of this.waitIds) show(id, waits);
        // grey while there is nothing to take back or to clear (Ivan 29.10: «не нажимаемые, пока их нельзя нажать»)
        const canUndo = this.history[this.sel].length > 0, canClear = this.plans[this.sel].length > 0;
        // the tutorial (rules, section 27): «Отменить», «Очистить» — grey; the sheet stays (Ivan 08.11); «?» is there (section 31);
        // «Отменить» is live on its own step (section 32)
        const tut = !!this.tutSteps, undoNow = tut && CoopTutorial.matches(this.M, this.tutStep(), { do: 'undo' });
        show('actUndo', edit && canUndo && (!tut || undoNow));
        show('actUndoOff', edit && !(canUndo && (!tut || undoNow)));
        show('actClear', edit && canClear && !tut);
        show('actClearOff', edit && (!canClear || tut));
        show('actSpecNone', edit && !this.actIds.length);
        for (const id of this.actIds) show(id, edit);
        // single player: grey while the plans may not start (Ivan 29.10, rules, section 23)
        const block = this.gameMode !== 'coop' ? this.startWhy() : null;
        show('actReady', plan && !block);
        show('actReadyOff', plan && !!block);
        set('actReady', CoopText.t(this.gameMode !== 'coop' ? 'game.btn_start' : this.ready[this.sel] ? 'game.btn_unready' : 'game.btn_ready'));
        // The plan phase's own parts; the heist phase has none of them.
        for (let i = 0; i < CoopGame.HERO_CARDS; i++) show('heroCard' + i, plan && i < this.M.heroes.length);
        show('btnMap', plan);
        show('btnAsk', plan && !!this.M.L.solution && !this.M.L.lab);
        for (const id of ['btnUntil', 'btnDemo']) show(id, plan);
        // the saved plan (rules, section 37): saved in the heist too, loaded only while planning
        show('btnSavePlan', this.planFileOn());
        show('btnLoadPlan', plan && this.planFileOn());
        show('btnPlan', !plan);
        // The heist phase's time controls; in the plan the settings keep the plan clock's scrub.
        for (const id of ['runBack', 'runPause', 'runSpeed', 'runFwd']) show(id, !plan);
        set('runPause', CoopText.t(this.playing ? 'game.btn_pause' : 'game.btn_resume'));
        for (const id of ['btnBack', 'btnFwd']) show(id, plan);
        show('btnSpeed', false);
        set('runBack', '⏪\n' + clock(this.c.scrubTicks));
        set('runFwd', clock(this.c.scrubTicks) + '\n▶');
        set('runSpeed', this.fast ? '⏩⏩\n×' + this.speeds[this.speedIdx] * CoopGame.STILL_SPEED : '⏩\n×' + this.speeds[this.speedIdx]);   // nobody moves: faster
        set('actWait', this.waitN > 0 ? CoopText.t('game.btn_wait', { wait: clock(this.waitN), till: clock((this.ends ? this.ends[this.sel] : 0) + this.waitN) }) : CoopText.t('game.btn_wait_zero', { wait: clock(0) }));
        set('btnUntil', CoopText.t('game.btn_until', { t: clock(this.viewT()) }));
        set('btnBack', '◀ ' + clock(this.c.scrubTicks));
        set('btnFwd', clock(this.c.scrubTicks) + ' ▶');
        set('btnSpeed', CoopText.t('game.btn_speed', { x: this.speeds[this.speedIdx] }));
        set('btnDemo', CoopText.t('game.btn_demo'));
        set('btnGameMode', CoopText.t(this.gameMode === 'coop' ? 'game.btn_mode_coop' : 'game.btn_mode_single'));
        set('btnHint', CoopText.t('game.btn_hint', { on: !!this.hintOn }));
        this.scene.hintOn = this.hintOn;
        this.renderTasks(f);
        const readyN = this.ready.filter(Boolean).length;
        // no screen has the hint line (rules 34; Ivan 06.11 on the plan's, 18.11 on the take's: «плохо читается и
        // не нужен»); the plan's text is still kept — the reasons of rules, sections 18, 23, 25 — for the screen
        // that gets them next
        show('hint', false);
        const T = CoopText.t, of = this.M.heroes.length;
        set('hint', !plan ? ''
            : this.ready[this.sel] ? T('game.hint_ready', { who: this.M.heroes[this.sel].fruit, n: readyN, of })
            : this.refused ? this.refused
            : this.noPath ? T(this.noPath === 'door' ? 'game.no_path_door' : 'game.no_path')
            : this.tapWhy ? this.tapWhy
            : T('game.hint_walk') + CoopGame.HINT_SEP
                + (this.gameMode === 'coop' ? T('game.hint_coop', { n: readyN, of }) : block ? T('game.hint_blocked', { why: block }) : T('game.hint_go')));
        let log = [], who = [], bars = [], cur = -1, done = [], mode = null;
        if (plan) {
            set('modeText', mode = (this.planT != null ? CoopText.t('game.mode_plan_at', { t: clock(this.planT) }) : CoopText.t('game.mode_plan')) + title);
            set('logTitle', CoopText.t('game.log_plan'));
            const rows = this.ghost ? this.logRows(this.ghost.events) : [];
            if (tut) {
                // the tutorial (rules, section 27): the steps done with ✓ and their rows, the current one
                // last in the gold frame; no hero's frame or bar — one hero, the step says where he is
                const out = CoopTutorial.logRows(this.tutSteps, this.tutK, this.tutEnds, rows);
                log = out.map(r => r.text);
                who = out.map(() => -1);
                done = out.map(r => !!r.step && !r.cur);
                cur = out.findIndex(r => r.cur);
            } else {
                log = rows.map(r => r.text);
                who = rows.map(r => r.who);
                bars = this.ends ? CoopGame.logBars(rows, this.ends) : [];
            }
            if (this.askLine) { log.push(this.askLine); who.push(-1); }   // the advice of «?» — the last line
        } else if (f) {
            set('modeText', mode = CoopText.t('game.mode_run', { t: clock(f.t), state: CoopText.t(f.alarm ? 'game.run_alarm' : !this.M.isArmed('light', f.power) ? 'game.run_dark' : !this.M.isArmed('sensors', f.power) ? 'game.run_sensors_off' : f.power.every(Boolean) ? 'game.run_quiet' : 'game.run_panel_off') }) + title);
            set('logTitle', CoopText.t('game.log_run'));
            log = this.logLines(run.events.filter(e => e.t <= f.t));
        }
        if (mode != null) this.fitModeText(mode);
        // the plan: the tick the plan's scene shows, the alarms of the plan's own run (rules, section 14)
        this.renderTimer(plan ? this.viewT() : f ? f.t : 0, plan ? this.view : run);
        // a long line wraps onto the next ones (Ivan 05.11: the alarm's line ran off the panel);
        // first[r] — the screen line logical line r starts at, kinds — red / advice / plain per screen line
        /** @type {string[]} */
        const lines = [], kinds = [], first = [], ok = [], okBy = [], fit = this.logFit();
        log.forEach((s, r) => {
            first.push(lines.length);
            ok[lines.length] = !!done[r];
            okBy[lines.length] = who[r] >= 0 ? who[r] : this.sel;   // the tutorial's lines are its one hero's
            const kind = CoopGame.isRed(s) ? 'red' : CoopGame.isAsk(s) ? 'ask' : '';
            for (const piece of CoopGame.wrapLog(s, fit.n, CoopGame.LOG_INDENT, fit.len, true)) { lines.push(piece); kinds.push(kind); }
        });
        first.push(lines.length);
        const N = CoopGame.LOG_LINES, cut = Math.max(0, lines.length - N);
        const vis = (/** @type {string} */ id, /** @type {boolean} */ v) => { const el = UI.get(id); if (el) el.show(v); };
        const mt = UI.def('logMarkTpl'), step = UI.def('log1') && UI.def('log0') ? UI.def('log1').y - UI.def('log0').y : 0;
        this.M.heroes.forEach((h, k) => {
            const el = UI.get('logMark' + k), r = who.lastIndexOf(k), at = r >= 0 ? first[r] - cut : -1;
            if (!el || !mt) return;
            if (at >= 0) {
                el.def.h = mt.h + (first[r + 1] - first[r] - 1) * step;   // round all the lines of a wrapped one
                el.moveTo(mt.x, mt.y + at * step);
            }
            el.show(at >= 0);
        });
        const sm = UI.get('logStepMark'), sd = UI.def('logStepMark'), sAt = cur >= 0 ? first[cur] - cut : -1;
        if (sm && sd) {
            if (sAt >= 0) {
                sm.def.border = cssColor(this.M.heroes[this.sel].color);   // the current step's frame — the hero's (rules, section 34)
                sm.def.h = (mt ? mt.h : sd.h) + (first[cur + 1] - first[cur] - 1) * step;   // round all the lines of a wrapped one
                sm.moveTo(sd.x, (mt ? mt.y : sd.y) + sAt * step);
            }
            sm.show(sAt >= 0);
        }
        const bt = UI.def('logBarTpl');
        this.M.heroes.forEach((h, k) => {
            const b = bars.find(x => x.k === k), at = b ? first[b.at] - cut : -1;
            for (let n = 1; n <= this.M.heroes.length; n++) {
                const el = UI.get('logBar' + k + '_' + n), on = !!bt && at >= 0 && b.n === n;
                if (!el) continue;
                if (on) el.moveTo(bt.x + b.i * bt.w / n, bt.y + at * step);
                el.show(on);
            }
        });
        for (let i = 0; i < N; i++) {
            const line = lines[cut + i] || '', red = kinds[cut + i] === 'red', ask = kinds[cut + i] === 'ask';
            set('log' + i, red || ask ? '' : line);
            set('logRed' + i, red ? line : '');
            vis('logRed' + i, red);
            set('logAsk' + i, ask ? line : '');
            vis('logAsk' + i, ask);
            // the ✓ in the colour of the hero who did the step; setText below draws it
            const okEl = UI.get('logOk' + i), by = ok[cut + i] && this.M.heroes[okBy[cut + i]];
            if (okEl && by) okEl.def.color = cssColor(by.color);
            set('logOk' + i, ok[cut + i] ? '✓' : '');
            vis('logOk' + i, !!ok[cut + i]);
        }
    },

    // The hero's last step on his card: the verb, the object on the next line (Ivan); a piece wider than the room the
    // card's shape leaves it (UI.roomOf over two lines; rules 34, «Содержимое плашки HUD — внутри её формы») wraps at
    // spaces. Nothing to measure with — at the colon only.
    /** @param {number} i @param {string} text */
    heroLastText(i, text) {
        const id = 'heroLast' + i, d = UI.def(id), pieces = text.replace(': ', ':\n').split('\n');
        const room = d && typeof UI.roomOf === 'function' && typeof UI.textWidth === 'function' && UI.textWidth('', d.fontSize) != null ? UI.roomOf(id, 2) : null;   // keep: the step is two lines on the card — the verb, the object
        if (room == null) return pieces.join('\n');
        const len = (/** @type {string} */ s) => /** @type {number} */ (UI.textWidth(s, d.fontSize));
        return pieces.flatMap(p => CoopGame.wrapLog(p, room, '', len)).join('\n');
    },

    // How a log line wraps (the tutorial bot in Chrome 12.11: a line of 40 characters ran off the panel in a wide
    // font): by its width in the real font within the panel less the line's inset on both sides; nothing to
    // measure with — CoopGame.LOG_WRAP characters.
    logFit() {
        const t = UI.def('log0'), p = UI.def('logPanel');
        if (!t || !p || typeof UI.textWidth !== 'function' || UI.textWidth('', t.fontSize) == null) return { n: CoopGame.LOG_WRAP, len: CoopGame.logChars };
        return { n: p.w - t.x * 2, len: (/** @type {string} */ s) => /** @type {number} */ (UI.textWidth(s, t.fontSize)) };
    },

    // The same with whose line each is: { text, who — the hero's index, -1 — nobody's (an alarm's
    // second line too), t — the event's tick }.
    /** @param {any[]} events */
    logRows(events) {
        const clock = CoopGame.clock, out = [];
        for (const e of events) {
            const who = e.who == null ? -1 : e.who;
            if (e.kind !== 'alarm') { out.push({ text: clock(e.t) + '  ' + e.text, who, t: e.t }); continue; }
            out.push({ text: CoopGame.RED + clock(e.t) + '  ' + e.text, who, t: e.t });
            out.push({ text: CoopGame.RED + CoopGame.LOG_INDENT + CoopText.t('game.log_police', { t: clock(e.t + this.M.policeTicks) }), who: -1, t: e.t });
        }
        return out;
    },

    // The timer at the bottom right (Ivan 19.10): the ticks left till the patrol — the ceiling of
    // the heist time (rules, section 14); after an alarm, till the police (ГБР) if they come first.
    // t — the tick shown (the plan's preview or the heist's frame); run — the heist, or in the plan
    // its ghost: the alarms the plan raises itself (Ivan 20.10: a door under the alarm).
    /** @param {number} t @param {any} run */
    renderTimer(t, run) {
        const set = (/** @type {string} */ id, /** @type {string} */ s) => { const el = UI.get(id); if (el) el.setText(s); };
        const t0 = CoopGame.timerOf(this.M, t, run);
        set('timerTitle', CoopText.t(t0.police ? 'game.timer_police' : 'game.timer_patrol'));
        const show = (/** @type {string} */ id, /** @type {boolean} */ v) => { const el = UI.get(id); if (el) el.show(v); };
        // the warning (rules, section 14; Ivan 12.11): the panel reddens, its outline blinks (timerTick); on the red
        // panel the digits are paper with an ink outline (Ivan 17.11: «красное на красном не читается»), else
        // ГБР's are the threat's red
        const w = CoopGame.timerWarn(t0.left), p = UI.get('timerPanel'), red = !!CoopGame.timerFill(w.k), alarm = t0.police && !red;
        set(alarm ? 'timerAlarm' : 'timerText', CoopGame.clock(t0.left));
        show('timerText', !alarm);
        show('timerAlarm', alarm);
        const digits = UI.get('timerText');
        if (digits) digits.setLook(red ? 'markLoud' : null);
        if (p) p.setFill(CoopGame.timerFill(w.k));
        this.timerBlinkOn = w.blink;
    },

    // A frame of the game, dt seconds: the police timer panel's own outline blinks white ↔ the threat's red while
    // renderTimer asks for it, from the moment it began (rules 14, Ivan 17.11: «мигание белой обводки — белое/красное»).
    /** @param {number} dt */
    timerTick(dt) {
        this.timerBlinkT = this.timerBlinkOn ? (this.timerBlinkT == null ? 0 : this.timerBlinkT + dt) : null;
        const p = UI.get('timerPanel'), lit = this.timerBlinkT != null && CoopGame.blinkLit(this.timerBlinkT, CoopGame.TIMER_BLINK_S);
        if (p) p.setOutline(lit ? CoopGame.TIMER_RED : null);
    },

    /** @param {any} s a step */
    stepText(s) {
        const clock = CoopGame.clock;
        if (s.op === 'wait') return CoopText.t('game.step_wait', { t: clock(s.ticks) });
        if (s.op === 'until') return CoopText.t('game.step_until', { t: clock(s.tick) });
        return this.M.label(s.verb, s.target);
    },

    // Co-op: the selected hero's tasks (rules, section 13) — in the plan a list, in the take a mark
    // by the frame shown: ✓ done by then, ○ not yet.
    renderTasks(f) {
        const coop = this.gameMode === 'coop';
        const show = (id, v) => { const el = UI.get(id); if (el) el.show(v); };
        const set = (id, s) => { const el = UI.get(id); if (el) el.setText(s); };
        show('taskPanel', coop);
        show('btnTaskStars', coop);
        set('btnTaskStars', CoopText.t('game.tasks_btn', { n: this.taskStars }));
        if (!coop) return;
        const mine = this.M.tasksFor(this.taskStars).filter(t => t.hero === this.sel);
        const upTo = f && this.run ? { frames: this.run.frames.slice(0, this.run.frames.indexOf(f) + 1) } : null;
        set('taskTitle', CoopText.t(mine.length ? 'game.tasks_title' : 'game.tasks_title_none', { n: this.taskStars, who: this.M.heroes[this.sel].fruit }));
        for (let i = 0; i < CoopGame.TASK_LINES; i++) {
            const t = mine[i];
            set('task' + i, !t ? '' : (upTo ? (this.M.taskDone(upTo, t) ? '✓ ' : '○ ') : '· ') + t.text);
        }
    },

    // The phase line in one line inside its plate (rules 34, «Строка фазы — целиком в плашке», Ivan 18.11): the plate
    // as wide as the text and its paddings (UI.textPad), not narrower than its record and not wider than the screen
    // less UI.WINDOW_PAD a side; what still does not fit, the label's font shrinks. No measure (tests, the editor) —
    // as it is.
    /** @param {string} text */
    fitModeText(text) {
        const el = UI.get('modeText'), d = UI.def('modeText');
        if (!el || !d || typeof UI.textWidth !== 'function' || typeof UI.textPad !== 'function' || typeof UI.size !== 'function') return;
        const tw = UI.textWidth(text, Number(d.fontSize));
        if (tw == null) return;
        const pad = UI.textPad(d, d.w, d.h), W = UI.size().w - 2 * UI.WINDOW_PAD;
        el.sizeTo(Math.round(Math.min(W, Math.max(d.w, tw + pad.left + pad.right)) * 100) / 100, d.h);
    },

    showResult(r) {
        const panel = UI.get('resultPanel');
        if (panel) panel.show(!!r);
        if (!r) return;
        const set = (id, s) => { const el = UI.get(id); if (el) el.setText(s); };
        const clock = CoopGame.clock, money = CoopText.num(r.money);
        const stars = '★'.repeat(r.stars) + '☆'.repeat(this.M.stars.length - r.stars);
        const o = this.outcome(r), won = CoopGame.won(r, o);
        const show = (id, v) => { const el = UI.get(id); if (el) el.show(v); };
        show('resultFinish', won);
        show('resultFinishOff', !won);
        // the preferred answer in the chosen magenta (rules 34, Ivan 18.11: «Нужен цвет выбора»): «Завершить» — its
        // record's look; a failed take — «Переиграть»
        const replay = UI.get('resultReplay');
        if (replay) replay.setLook(won ? '' : 'buttonOn');
        const T = CoopText.t;
        set('resultTitle', r.caught.length ? T('game.result_caught', { n: r.caught.length, of: this.M.heroes.length })
            : o && o.missed.length ? T('game.result_missed') : stars + '  ' + money);
        const name = (i) => this.M.heroes[i].fruit;
        const lines = [
            !o ? '' : o.missed.length ? T('game.res_missed', { list: o.missed.map(t => T('game.res_missed_item', { who: name(t.hero), task: t.text })).join('; ') })
                : T('game.res_tasks_ok', { n: this.taskStars }),
            T('game.res_money', { money, t: clock(r.ticks) }),
            T('game.res_stars', { list: this.M.stars.map(s => CoopText.num(s)).join(' / ') }),
            r.alarmT !== null ? T('game.res_alarm', { t: clock(r.alarmT), why: r.alarmWhy }) : T('game.res_quiet'),
            T('game.res_crashes', { n: r.events.filter(e => e.kind === 'crash').length }),
            r.caught.length ? T('game.res_caught', { list: r.caught.map(name).join(', ') }) : '',
            r.left.length ? T('game.res_left', { list: r.left.map(name).join(', ') }) : ''
        ].filter(Boolean);
        for (let i = 0; i < CoopGame.RESULT_LINES; i++) set('res' + i, lines[i] || '');
    },
};
Object.assign(CoopGame.prototype, CoopGameHud);
