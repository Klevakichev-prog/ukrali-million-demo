// CoopTutorial.js — the hard tutorial (rules, section 27; Ivan 08.11.2026: «разрешаем нажимать
// только 1 разрешённый вариант»): the steps of a level's field tutorial, one press live at a time.
// A step is { do, task, text } and what to press: 'tap' — a click on an object (obj: the code of a door,
// an item or a power panel; with at: [x, y] the click only walks there, no action — Ivan 09.11), 'cell' — a click on a cell (at: [x, y]), 'act' — an action button
// (verb and obj — its target), 'ask' — the advice button «Совет» (rules, section 31: the step adds nothing to the
// plan), 'undo' — «Отменить» (section 32: takes back the plan's last press), 'start' — «Начать ограбление» (the last
// step only). 'note' — a plate of text with «Дальше» (section 32): no press of the plan, not counted as a step —
// the log, «Шаг k из N» and the sheet's list count the presses only (num). A press done
// by a step is added to the plan as any press is: the steps make an ordinary plan, the run has no
// rule of its own. CoopGame gates its input by matches() and marks target(); play() makes the
// steps' plan through the model the way the game's presses make it (the level's solution, tests).

/** @satisfies {Record<string, any>} */
const CoopTutorial = {
    KINDS: ['tap', 'cell', 'act', 'ask', 'undo', 'start', 'note'],

    // The number of each step as the player sees it (rules, section 32): the presses from 1, a plate — the number of
    // the press after it (its «Не сейчас — сначала шаг N» and the log's current step); of — the presses.
    /** @param {any[]} steps @returns {{ n: number[], of: number }} */
    nums(steps) {
        const at = [];
        let m = 0;
        for (const s of steps) at.push(s.do === 'note' ? 0 : ++m);
        const n = [];
        for (let k = steps.length - 1, next = m + 1; k >= 0; k--) { if (at[k]) next = at[k]; n[k] = next; }
        return { n, of: m };
    },

    // The presses a later «Отменить» took back (rules, section 32): their k — no number on the sheet's map, no rows in
    // the log; the map shows the plan the steps end with.
    /** @param {any[]} steps @returns {Set<number>} */
    undone(steps) {
        const stack = [], out = new Set();
        steps.forEach((s, k) => {
            if (s.do === 'undo') { if (stack.length) out.add(stack.pop()); }
            else if (s.do === 'tap' || s.do === 'cell' || s.do === 'act') stack.push(k);
        });
        return out;
    },

    // The steps of level data L; a level with no tutorial — null.
    /** @param {any} L @returns {any[] | null} */
    steps(L) {
        return L && Array.isArray(L.tutorial) && L.tutorial.length ? L.tutorial : null;
    },

    // The cell a tap of step s only walks to (rules, section 27, «шаг 7»; Ivan 09.11: «не нужно подходить
    // к витрине сверху» — «подойти тапом»): a «tap» step with a cell; null — the tap does the object's
    // action (section 25). «Only walk up» is the step's, not the tap's.
    /** @param {any} s @returns {number[] | null} */
    walkCell(s) {
        return s && s.do === 'tap' && Array.isArray(s.at) ? s.at : null;
    },

    // The object of code id: a door (its leaf), an item, a power panel -> { kind, i } (as the scene's
    // pick gives it) or null.
    /** @param {any} M @param {string} id @returns {{ kind: string, i: number } | null} */
    objId(M, id) {
        const d = M.doors.findIndex((/** @type {any} */ q) => q.id === id);
        if (d >= 0) return { kind: 'door', i: d };
        const l = M.loot.findIndex((/** @type {any} */ q) => q.id === id);
        if (l >= 0) return { kind: 'loot', i: l };
        const p = M.panels.findIndex((/** @type {any} */ q) => q.id === id);
        return p >= 0 ? { kind: 'panel', i: p } : null;
    },

    // Does press p do step s? A press: { do: 'tap', obj: { kind, i } } | { do: 'cell', at }
    // | { do: 'act', verb, target } | { do: 'start' }. A tap on any part of the object counts (a
    // door's leaf, its lock: CoopModel.tapTargets).
    /** @param {any} M @param {any} s @param {any} p */
    matches(M, s, p) {
        if (!s || !p || s.do !== p.do) return false;
        if (s.do === 'tap') return M.tapTargets(p.obj).includes(s.obj);
        if (s.do === 'cell') return p.at[0] === s.at[0] && p.at[1] === s.at[1];
        if (s.do === 'act') return p.verb === s.verb && p.target === s.obj;
        return true;
    },

    // Does action button v do what tap result r (CoopModel.tapObject) adds (rules, section 27, «Отзыв 10.11 поздно»;
    // Ivan 10.11: «кнопки в туторе которые дублируют нужное действие работали»): the tap adds only that action — the
    // hero is already where it is done, no walk.
    /** @param {any} r @param {{ verb: string, target: string }} v */
    sameAsTap(r, v) {
        return !!r && !!r.verb && r.steps.length === 1 && r.steps[0].op === 'act' && r.steps[0].verb === v.verb && r.steps[0].target === v.target;
    },

    // What the screen marks for step s: { obj } — the object outlined, { cell } — a ring on the
    // floor (in the van — over its bed, Ivan 10.11: the step counts its own cell only, not the whole van),
    // { verb: { verb, target } } — the frame on its button, { ask: true } — on «Совет», { undo: true } — on «Отменить»,
    // { next: true } — on «Дальше» of a plate, { start: true } — on «Начать ограбление».
    /** @param {any} M @param {any} s */
    target(M, s) {
        if (!s) return null;
        if (s.do === 'tap') return { obj: CoopTutorial.objId(M, s.obj) };
        if (s.do === 'cell') return { cell: s.at.slice() };
        if (s.do === 'act') return { verb: { verb: s.verb, target: s.obj } };
        if (s.do === 'ask') return { ask: true };
        if (s.do === 'undo') return { undo: true };
        if (s.do === 'note') return { next: true };
        return { start: true };
    },

    // The cell the camera brings into the free part of the screen at step s (rules, section 27, «Охота за багами
    // 12.11»): its object's (a tap, an action button — a door's first cell, an item's or a panel's) or its own (a
    // cell); «Совет», «Начать ограбление» — null.
    /** @param {any} M @param {any} s @returns {number[] | null} */
    point(M, s) {
        if (!s) return null;
        if (s.do === 'cell') return s.at.slice();
        const o = s.do === 'tap' || s.do === 'act' ? CoopTutorial.objId(M, s.obj) : null;
        if (!o) return null;
        if (o.kind === 'door') return M.doors[o.i].cells[0].slice(0, 2);
        return (o.kind === 'loot' ? M.loot[o.i] : M.panels[o.i]).at.slice();
    },

    // The advice of «Совет» at step s (rules, section 31; Ivan 14.11: «она должна срабатывать так же как ведет
    // туториал»): the step itself, not the level's solution — { task } and where its frame goes: { cell } — a ring on
    // the cell of a tap (its own cell if it only walks up) or a cell step, { verb } — the action's button,
    // { undo: true } — «Отменить» (section 32), { start: true } — «Начать ограбление»; null — no step or a plate (its
    // «Совет» does not press, section 32).
    /** @param {any} M @param {any} s */
    advice(M, s) {
        if (!s || s.do === 'note') return null;
        const T = /** @type {any} */ (CoopTutorial.target(M, s)), cell = CoopTutorial.walkCell(s) || (T.obj || T.cell ? CoopTutorial.point(M, s) : null);
        return { task: s.task, cell: cell ? cell.slice() : null, verb: T.verb || null, undo: !!T.undo, start: !!T.start };
    },

    // The plan's log of the tutorial (rules, section 27; Ivan 08.11: «после того как шаг выполнен он
    // помечается ✓, и появляется новый шаг»): «✓ Шаг j: task» of each step done, under it the plan's
    // rows (CoopGame.logRows: { text, who, t }) with t in (ends[j-1], ends[j]] — the last step done takes
    // the rows after its end too; last, the current one «Шаг k из N: task» (cur). No future steps.
    // k — the steps done, ends — the tick the plan ended at after each of them. Plates are not steps (section 32):
    // no line of their own, a plate shown — the press after it is the current one. A step's rows end where the plan
    // ends after it and every later step: a press taken back by «Отменить» keeps none, the press after the undo
    // gets its own (section 32, the dead end).
    /** @param {any[]} steps @param {number} k @param {number[]} ends @param {{ text: string, who: number, t: number }[]} rows */
    logRows(steps, k, ends, rows) {
        const out = [], N = CoopTutorial.nums(steps), done = Math.min(k, steps.length);
        const hi = [];
        for (let j = done - 1, low = Infinity; j >= 0; j--) { low = Math.min(low, ends[j]); hi[j] = low; }
        let last = -1;
        for (let j = 0; j < done; j++) if (steps[j].do !== 'note') last = j;
        let from = -Infinity;
        for (let j = 0; j < done; j++) {
            if (steps[j].do === 'note') continue;
            const to = j === last ? Infinity : hi[j];
            out.push({ text: CoopText.t('tut.step_done', { n: N.n[j], task: steps[j].task }), who: -1, t: ends[j], step: true });
            for (const r of rows) if (r.t > from && r.t <= to) out.push(r);
            from = Math.max(from, to);
        }
        const cur = steps.findIndex((s, j) => j >= k && s.do !== 'note');
        if (cur >= 0) out.push({ text: CoopText.t('tut.step_now', { n: N.n[cur], of: N.of, task: steps[cur].task }), who: -1, t: k ? ends[k - 1] : 0, step: true, cur: true });
        return out;
    },

    // The route of the steps' plan for the sheet (rules, section 27; Ivan 09.11 evening: «маршрут героя таким
    // же пунктиром как на этапе планирования только еще добавить несколько стрелочек»): the hero's cells from
    // the start, the legs — the moves between two actions of the plan (or the start and the end), the marks —
    // the steps by their target in order: { at: a door's or an item's code or 'x,y' of a cell;
    // ks — the step numbers from 1 }; «Начать ограбление» has none. -> { from, legs: [[x, y], …][], marks } or null.
    /** @param {any} M */
    route(M) {
        const steps = CoopTutorial.steps(M.L);
        if (!steps) return null;
        const r = CoopTutorial.play(M, steps), from = M.endCell([], 0);
        /** @type {number[][][]} */
        const legs = [];
        let leg = [from];
        for (const s of r.plans[0]) {
            if (s.op === 'go') { leg.push(s.to); continue; }
            if (leg.length > 1) legs.push(leg);
            leg = [leg[leg.length - 1]];
        }
        if (leg.length > 1) legs.push(leg);
        /** @type {{ at: string, ks: number[] }[]} */
        const marks = [], N = CoopTutorial.nums(steps), gone = CoopTutorial.undone(steps);
        steps.forEach((/** @type {any} */ s, /** @type {number} */ k) => {
            if (s.do === 'start' || s.do === 'ask' || s.do === 'undo' || s.do === 'note') return;     // no place on the map
            if (gone.has(k)) return;                             // taken back (section 32): not in the plan the map shows
            // a step to a cell — a cell step, a tap that only walks up — at its cell, the van's too (Ivan 10.11:
            // «подсказка 7го шага … должна быть над клеткой а не над витриной»)
            const cell = s.do === 'cell' ? s.at : CoopTutorial.walkCell(s);
            const at = cell ? cell.join(',') : s.obj;
            const m = marks.find(q => q.at === at);
            if (m) m.ks.push(N.n[k]); else marks.push({ at, ks: [N.n[k]] });
        });
        return { from, legs, marks };
    },

    // The steps made as the game makes the presses (CoopGame.tapObject, walkTo — a tap with a cell too, act — hero 0, from
    // an empty plan, no Wait), each refused as the game refuses it (rules, section 23: past the
    // ceiling; a tap with no action, a cell with no way, a button not offered there). «Отменить» gives the plan
    // back as it was before the last press; a plate and «Совет» leave it as it is (section 32, 31).
    // -> { plans, ends — the tick the plan ends at after each step, fail — { k, why, end, t } or null }.
    /** @param {any} M @param {any[]} steps */
    play(M, steps) {
        let plans = M.heroes.map(() => []);
        const ends = [], hist = [];
        for (let k = 0; k < steps.length; k++) {
            const s = steps[k], G = M.ghost(plans), R = M.ghost(plans, true), t0 = G.planEnd[0], at = M.endCell(plans[0], 0);
            /** @type {any[] | null} */
            let add = null, why = '';
            if (s.do === 'ask' || s.do === 'note') { ends.push(t0); continue; }     // the plan as it is (rules, sections 31, 32)
            if (s.do === 'undo') {
                if (!hist.length) return { plans, ends, fail: { k, why: CoopText.t('tut.why_no_undo'), end: t0, t: M.limit(plans, G).t } };
                plans = hist.pop();
                ends.push(M.ghost(plans).planEnd[0]);
                continue;
            }
            if (CoopTutorial.walkCell(s)) {
                add = M.route(0, at, s.at, G.frames, t0);
                if (!add) why = CoopText.t('tut.why_no_way');
            } else if (s.do === 'tap') {
                const r = M.tapObject(0, at, CoopTutorial.objId(M, s.obj), G.frames, t0, R);
                if (r && r.verb) add = r.steps; else why = r ? r.why : CoopText.t('tut.why_no_way');
            } else if (s.do === 'cell') {
                add = M.route(0, at, s.at, G.frames, t0);
                if (!add) why = CoopText.t('tut.why_no_way');
            } else if (s.do === 'act') {
                const offered = M.verbsAt(M.heroes[0].id, at[0], at[1], M.frameState(G.frames, t0, R)).some((/** @type {any} */ v) => v.verb === s.verb && v.target === s.obj);
                if (offered) add = [{ op: 'act', verb: s.verb, target: s.obj, at: at.slice() }]; else why = CoopText.t('tut.why_no_button');
            } else {
                const L = M.limit(plans, G);
                if (L.empty || L.late.length || L.away.length) why = CoopText.t('tut.why_not_ready');
                else { ends.push(t0); continue; }
            }
            if (!add) return { plans, ends, fail: { k, why, end: t0, t: M.limit(plans, G).t } };
            const plan = M.pressed(plans[0], add), late = M.lateBy(plans, 0, plan, []);
            if (late.k >= 0) return { plans, ends, fail: { k, why: CoopText.t('tut.why_late'), end: late.L.ends[0], t: late.L.t } };
            hist.push(plans);
            plans = [plan].concat(plans.slice(1));
            ends.push(late.L.ends[0]);
        }
        return { plans, ends, fail: null };
    }
};
