// CoopModelPress.js — a part of CoopLevelModel (CoopModel.js): a press of the plan's screen made
// into plan steps. The route of a tap on a cell (rules, section 18), a tap on an object — where it is
// worked from, its first action, why it has none (section 25); the level as the buttons see it at a
// tick of the ghost (frameState); a press added to a plan; a plan from a short script — the level's
// solutions and the tests. Methods of the level's model, mixed into its prototype.

/** @satisfies {ThisType<CoopLevelModel>} */
const CoopModelPress = {
    // The level as the plan's buttons see it at tick t of the ghost's frames F (rules, section 9: a job
    // ends at the very end of its tick): the loot, the doors, the light; the guards as the ghost has
    // them at that tick, knocked out or tied — for «Связать» (section 21) — and at its end, where and
    // how turned — for «Вырубить», judged at the end of the blow's tick; out — lying at its start (section 22).
    // R — the same ghost run on (ghost(plans, true)): the guards past the end of F.
    frameState(F, t, R) {
        const f = F[Math.min(F.length - 1, t)], E = R ? R.frames : F;
        const at = (/** @type {number} */ k) => E[Math.min(E.length - 1, k)].g || [];
        const now = at(f.t);
        return { loot: f.loot.map((/** @type {any} */ l) => ({ x: l.x, y: l.y, holder: l.holder, delivered: l.del, broken: l.br, opened: l.op, spoiled: l.sp })),
            doorOpen: f.doors.slice(), doorUnlocked: f.unl.slice(), power: f.power,
            guards: now.map((/** @type {any} */ q) => ({ x: q.x, y: q.y, out: q.out, tied: q.tied })),
            guardsEnd: at(f.t + 1).map((/** @type {any} */ q, /** @type {number} */ k) => ({ x: q.x, y: q.y, f: q.f, down: q.fall, out: !!(now[k] && now[k].out) })) };
    },

    // The cell where hero i's plan ends so far.
    endCell(plan, i) {
        for (let k = plan.length - 1; k >= 0; k--) {
            if (plan[k].op === 'go') return plan[k].to;
            if (plan[k].at) return plan[k].at;
        }
        return this.heroes[i].start;
    },

    // A press adding steps to a plan: the new plan (a wait right after a wait lengthens it — Wait
    // pressed three times is one «ждать 3 т»).
    pressed(plan, steps) {
        const out = plan.map((/** @type {any} */ s) => Object.assign({}, s)), last = out[out.length - 1];
        if (steps.length === 1 && steps[0].op === 'wait' && last && last.op === 'wait') last.ticks += steps[0].ticks;
        else out.push(...steps.map((/** @type {any} */ s) => Object.assign({}, s)));
        return out;
    },

    // The route of a tap in the plan (rules, section 18): the steps that bring hero i from `from`
    // to `to` the earliest, starting at tick t0 of the ghost run's frames (null — the level as it
    // starts). A door shut when he gets there: opened later by the plan — he waits and goes
    // through (no work of his: a teammate's job is not sped up); unlocked — «Открыть»; locked and
    // picked by nobody — «Вскрыть» and «Открыть», a sensor door with the light on too (Ivan 24.10:
    // an alarm, the plan marks it); a gate (worked from its keypad) is a wall until the plan opens
    // it. Of equal arrivals — no alarm, then fewer works. A wait is spent near the door in a cell free of teammates (below). -> plan steps, or
    // null — no way. info, if given, gets the tick he is at `to` (t), his alarms and works on the way.
    route(i, from, to, frames, t0, info) {
        const h = this.heroes[i], start = { doors: this.openAtStart(), unl: this.unlockedAtStart(), power: true };
        const fr = (/** @type {number} */ s) => (frames ? frames[Math.min(frames.length - 1, s)] : start);
        const last = frames ? frames.length - 1 : 0;
        // the first tick from s on that frames have flag k of door e set (they stay as the last frame after it)
        const first = (/** @type {string} */ k, /** @type {number} */ e, /** @type {number} */ s) => {
            for (let u = s; u <= Math.max(s, last); u++) if (fr(u)[k][e]) return u;
            return -1;
        };
        const key = (/** @type {number[]} */ c) => c[0] + ',' + c[1];
        // A wait (Ivan 23.10): in a cell no teammate stands on or passes for its ticks, the nearest
        // to the door (steps from the cell in front of it, not through it); of equal ones — beside
        // the teammate at the door, not behind him (the least offset along the door's way).
        const others = (/** @type {number[]} */ c, /** @type {number} */ s) => !!frames && fr(s).h.some((o, j) => j !== i && o.x === c[0] && o.y === c[1]);
        const free = (/** @type {number[]} */ c, /** @type {number} */ s, /** @type {number} */ w) => {
            for (let u = s; u <= s + w; u++) if (others(c, u)) return false;
            return true;
        };
        // the cells near p on its side of door edge (p, dir), nearest first -> [{ c, d — steps to p }]
        const around = (/** @type {number[]} */ p, /** @type {string} */ dir, /** @type {boolean[]} */ open) => {
            const seen = new Map([[key(p), 0]]), list = [{ c: p, d: 0 }];
            for (let k = 0; k < list.length && list[k].d < CoopModel.WAIT_NEAR; k++) {
                const c = list[k].c;
                for (const dd of CoopModel.DIRS) {
                    if (c === p && dd === dir) continue;
                    const q = [c[0] + CoopModel.DELTA[dd][0], c[1] + CoopModel.DELTA[dd][1]];
                    if (seen.has(key(q)) || !this.canStep(c[0], c[1], dd, 'hero', open)) continue;
                    seen.set(key(q), list[k].d + 1);
                    list.push({ c: q, d: list[k].d + 1 });
                }
            }
            const [dx, dy] = CoopModel.DELTA[dir], back = (/** @type {number[]} */ c) => Math.abs((c[0] - p[0]) * dx + (c[1] - p[1]) * dy);
            return list.map((o, k) => ({ ...o, k })).sort((a, b) => a.d - b.d || back(a.c) - back(b.c) || a.k - b.k);
        };
        // the steps from the cell he waits in to p, the door's cell, when he gets to p on tick a and
        // the door is ready (open, or unlocked for his «Открыть») on tick ready: he leaves that cell
        // only then (Ivan 23.10: «ждёт до 18»), so a cell off p costs its steps
        const waitSteps = (/** @type {number[]} */ p, /** @type {string} */ dir, /** @type {number} */ a, /** @type {number} */ ready) => {
            const o = around(p, dir, fr(a).doors).find(o => free(o.c, a, ready - a));
            return o ? o.d : 0;
        };
        // crossing door e (edge p -> dir) from p reached at tick a -> { t — the tick he is through, wait, verbs,
        // alarm — his «Открыть» rings the sensor } or null
        const cross = (/** @type {number} */ e, /** @type {number} */ a, /** @type {number[]} */ p, /** @type {string} */ dir) => {
            if (fr(a).doors[e]) return { t: a + 1, wait: 0, verbs: [], alarm: false };
            const d = this.doors[e], T = first('doors', e, a);
            if (T >= 0) return { t: T + waitSteps(p, dir, a, T) + 1, wait: T - a, verbs: [], alarm: false };
            if (d.lock === 'electronic') return null;
            const U = first('unl', e, a), pick = U < 0 ? this.workTicks(h, 'pick', this.doors[d.lockOf].id) : 0;
            const opens = (U < 0 ? a : U + (U > a ? waitSteps(p, dir, a, U) : 0)) + pick, open = this.workTicks(h, 'open', d.id);
            const alarm = this.effectsOf('open', d.id, fr(opens + open).power).includes('alarm');
            const verbs = (U < 0 ? [{ verb: 'pick', target: this.doors[d.lockOf].id }] : []).concat([{ verb: 'open', target: d.id }]);
            return { t: opens + open + 1, wait: U < 0 ? 0 : U - a, verbs, alarm };
        };
        const best = new Map([[key(from), { c: from, t: t0, alarms: 0, works: 0, prev: null, via: null, seq: 0 }]]);
        const queue = [best.get(key(from))], all = this.doors.map(() => true);
        let seq = 0;
        const done = new Set();
        while (queue.length) {
            queue.sort((x, y) => x.t - y.t || x.alarms - y.alarms || x.works - y.works || x.seq - y.seq);
            const n = queue.shift();
            if (done.has(key(n.c))) continue;
            done.add(key(n.c));
            if (n.c[0] === to[0] && n.c[1] === to[1]) break;
            for (const dir of CoopModel.DIRS) {
                const [dx, dy] = CoopModel.DELTA[dir], q = [n.c[0] + dx, n.c[1] + dy];
                if (done.has(key(q)) || !this.canStep(n.c[0], n.c[1], dir, 'hero', all)) continue;
                const e = this.edges.get(this.edgeKey(n.c[0], n.c[1], dir));
                const x = typeof e === 'number' ? cross(e, n.t, n.c, dir) : { t: n.t + 1, wait: 0, verbs: [], alarm: false };
                if (!x) continue;
                const m = { c: q, t: x.t, alarms: n.alarms + (x.alarm ? 1 : 0), works: n.works + x.verbs.length, prev: n, via: x, seq: ++seq };
                const old = best.get(key(q));
                if (old && (old.t < m.t || (old.t === m.t && (old.alarms < m.alarms || (old.alarms === m.alarms && old.works <= m.works))))) continue;
                best.set(key(q), m);
                queue.push(m);
            }
        }
        const end = best.get(key(to));
        if (!end || !done.has(key(to)) || end === best.get(key(from))) return null;
        if (info) Object.assign(info, { t: end.t, alarms: end.alarms, works: end.works });
        const way = [];
        for (let n = end; n; n = n.prev) way.unshift(n);
        const dirOf = (/** @type {number[]} */ a, /** @type {number[]} */ b) => CoopModel.DIRS.find(d => a[0] + CoopModel.DELTA[d][0] === b[0] && a[1] + CoopModel.DELTA[d][1] === b[1]);
        const out = [];
        const go = (/** @type {number[]} */ c) => out.push({ op: 'go', to: c.slice(), via: true });
        const stop = () => { const g = out[out.length - 1]; if (g && g.op === 'go') delete g.via; };
        for (let j = 1; j < way.length; j++) {
            const n = way[j], p = way[j - 1].c, wait = n.via.wait;
            if (wait > 0) {
                // he is at p on tick tp and must be there, ready, on tick ready
                const tp = way[j - 1].t, ready = tp + wait, open = fr(tp).doors;
                const before = out.length > 1 ? out[out.length - 2].to : j - 1 > 0 ? from : null;
                let pick = null;
                for (const o of around(p, dirOf(p, n.c), open)) {
                    if (o.d === 0) { if (free(p, tp, wait)) { pick = { cell: p, to: [], back: [], at: tp, w: wait }; break; } continue; }
                    const base = before || p, t1 = before ? tp - 1 : tp;
                    const to = this.path(base, o.c, { open }), back = this.path(o.c, p, { open });
                    if (!to || !back || back.length !== o.d) continue;
                    const at = t1 + to.length, w = ready - at;
                    if (w >= 0 && free(o.c, at, w)) { pick = { cell: o.c, to, back, at, w }; break; }
                }
                if (!pick) pick = { cell: p, to: [], back: [], at: tp, w: wait };
                if (pick.cell !== p) { if (before) out.pop(); pick.to.forEach(go); }
                stop();
                out.push({ op: 'wait', ticks: pick.w });
                pick.back.forEach(go);
            }
            if (n.via.verbs.length) {
                stop();
                for (const v of n.via.verbs) out.push({ op: 'act', verb: v.verb, target: v.target, at: p.slice() });
            }
            go(n.c);
        }
        stop();
        return out;
    },

    // A tap on an object (rules, section 25): hero i, at `from` when his plan ends on tick t0 of the
    // ghost's frames (R — the ghost run on: the guards past them), goes to a cell the object's button
    // is offered in and does its first action by its state in the plan on the tick he gets there,
    // as the buttons would (rules, section 9). obj — { kind: 'panel' | 'loot' | 'gate' | 'door', i } (a
    // gate — by its keypad; a door — its leaf i, a gate's leaf — as its keypad, Ivan 08.11). The cells — those verbsAt gives the object an action in with the object whole
    // (a panel on, an item in place, his load empty), so an object with nothing left to do is still
    // walked up to; of them the earliest arrival by route (rules, section 18), then fewer works on
    // the way, then the object's own cell and its sides in TAP_SIDES order. A whole vitrine — «Вскрыть»
    // («Разбить» — only by its button). -> { steps, verb — { verb, target } or null, why — what
    // leaves nothing to do } or null — no way.
    tapObject(i, from, obj, frames, t0, R) {
        if (obj.kind === 'door' && this.doors[obj.i] && this.doors[obj.i].lock === 'electronic') obj = { kind: 'gate', i: obj.i };
        const h = this.heroes[i], ids = this.tapTargets(obj);
        const state = (/** @type {number} */ t) => (frames && frames.length ? this.frameState(frames, t, R) : null);
        const now = state(t0), at = this.tapAt(obj, now);
        if (!ids.length || !at) return null;
        // the object whole: the cells its button is offered in whatever the plan has done to it
        const whole = now && Object.assign({}, now, {
            loot: now.loot.map((/** @type {any} */ s, /** @type {number} */ k) => (obj.kind === 'loot' && k === obj.i
                ? { x: at[0], y: at[1], holder: -1, delivered: false, broken: false, opened: false }
                : s.holder === i ? Object.assign({}, s, { holder: -1 }) : s)),
            power: Array.isArray(now.power) ? now.power.map((/** @type {boolean} */ p, /** @type {number} */ k) => p || (obj.kind === 'panel' && k === obj.i)) : now.power
        });
        // a multi item in a smashed vitrine: the tap gathers it, «Схватить» is its button only (09.11)
        const multi = obj.kind === 'loot' && this.loot[obj.i] && this.loot[obj.i].multi;
        const mine = (/** @type {any} */ v) => ids.includes(v.target) && !CoopModel.TAP_SKIP.includes(v.verb) && !(multi && v.verb === 'grab');
        let best = null;
        for (const c of this.tapCells(obj, at)) {
            if (!this.inside(c[0], c[1]) || !this.verbsAt(h.id, c[0], c[1], whole).some(mine)) continue;
            const here = c[0] === from[0] && c[1] === from[1], info = { t: t0, works: 0 };
            const steps = here ? [] : this.route(i, from, c, frames, t0, info);
            if (!steps) continue;
            if (!best || info.t < best.t || (info.t === best.t && info.works < best.works)) best = { c, steps, t: info.t, works: info.works };
        }
        if (!best) return null;
        const st = state(best.t), v = this.verbsAt(h.id, best.c[0], best.c[1], st).find(mine);
        const verb = v ? { verb: v.verb, target: v.target } : null;
        // the item does not fit his free load on arrival: the tap plans nothing, he does not go (Ivan 13.11)
        const over = verb ? null : this.tapOver(i, obj, st);
        if (over) return { steps: [], verb: null, over, why: CoopText.t('model.why_over', { free: CoopModel.num(over.free), cap: CoopModel.num(over.cap) }) };
        const steps = best.steps.concat(verb ? [{ op: 'act', verb: verb.verb, target: verb.target, at: best.c.slice() }] : []);
        return { steps, verb, why: verb ? null : this.tapWhy(i, obj, st) };
    },

    // An item in place that hero i's load at run does not take (take, grab, gather — rules, section
    // 25): -> { free, cap } — his free load and his limit; else null.
    tapOver(i, obj, run) {
        if (obj.kind !== 'loot' || !run) return null;
        const s = run.loot[obj.i];
        if (!s || s.holder >= 0 || s.delivered) return null;
        const cap = this.capacity(this.heroes[i]), load = this.loadIn({ loot: run.loot }, i);
        if (load + this.massOf(obj.i, s) <= cap + 1e-9) return null;
        return { free: Math.max(0, Math.round((cap - load) * 100) / 100), cap };
    },

    // The ids an object's actions name (rules, section 25): a panel, an item, a gate's leaves and its
    // lock; a door — its own leaf and the lock (a double door: «Открыть» of the leaf clicked, Ivan 08.11).
    tapTargets(obj) {
        if (obj.kind === 'panel') return this.panels[obj.i] ? [this.panels[obj.i].id] : [];
        if (obj.kind === 'loot') return this.loot[obj.i] ? [this.loot[obj.i].id] : [];
        const d = this.doors[obj.i];
        if (d && obj.kind === 'door') return [d.id, this.doors[d.lockOf].id];
        return d ? this.leavesOf(obj.i).map(j => this.doors[j].id).concat([this.doors[d.lockOf].id]) : [];
    },

    // The cells a tap tries (rules, section 25), the object's own first: a door — its doorway cells on
    // either side (touchesDoor); else the cell `at` and its sides in TAP_SIDES order.
    tapCells(obj, at) {
        if (obj.kind === 'door') return this.doors[obj.i].cells.flatMap(([x, y, dir]) => [[x, y], [x + CoopModel.DELTA[dir][0], y + CoopModel.DELTA[dir][1]]]);
        return [at].concat(CoopModel.TAP_SIDES.map(d => [at[0] + CoopModel.DELTA[d][0], at[1] + CoopModel.DELTA[d][1]]));
    },

    // Where an object is worked from (rules, section 25): a panel's cell, the item's cell — its home
    // once taken (the vitrine, the pedestal, the wall stay), a gate's keypad; run — a frameState.
    tapAt(obj, run) {
        if (obj.kind === 'panel') return this.panels[obj.i] ? this.panels[obj.i].at : null;
        if (obj.kind === 'gate') return this.doors[obj.i] ? this.doors[obj.i].panelAt : null;
        if (obj.kind === 'door') return this.doors[obj.i] ? this.doors[obj.i].cells[0].slice(0, 2) : null;
        const l = this.loot[obj.i], s = run && run.loot[obj.i];
        if (!l) return null;
        return s && s.holder < 0 && !s.delivered ? [s.x, s.y] : l.at;
    },

    // Why a tap on an object has no action (rules, section 25), as the hint says it.
    tapWhy(i, obj, run) {
        const T = CoopText.t;
        if (obj.kind === 'panel') return T('model.why_panel_off');
        if (obj.kind !== 'loot') return T('model.why_nothing');
        const l = this.loot[obj.i], s = run && run.loot[obj.i];
        if (s && (s.holder >= 0 || s.delivered)) return T(l.glass ? 'model.why_vitrine_empty' : l.stand ? 'model.why_stand_empty' : 'model.why_taken');
        return T('model.why_nothing');
    },

    // A plan from a short script (the level's solution, tests): ['go', x, y] walks the shortest
    // path through the doors open so far (locked ones stay shut unless the script counts on
    // them), ['open', door] counts on a door a teammate opens, ['act', verb, target],
    // ['wait', ticks], ['until', tick]. from — the start cell (the hero's van cell by
    // default). Throws on a walk with no way or an action not on offer there.
    planFromScript(id, script, from) {
        const out = [];
        const me = this.heroes.find(h => h.id === id);
        if (!me) throw new Error(id + ': not in the crew of ' + this.id);
        let at = (from || me.start).slice();
        const flags = this.openAtStart(), unl = this.unlockedAtStart();
        const door = (id) => this.doors.findIndex(d => d.id === id);
        // the vitrines and the doors as the script leaves them, for the check of its actions;
        // ['open', id] — a door or a vitrine somebody else opens first
        const cases = { loot: this.loot.map(l => ({ x: l.at[0], y: l.at[1], holder: -1, delivered: false, broken: false, opened: false })),
            doorOpen: flags, doorUnlocked: unl };
        const item = (id) => this.loot.findIndex(l => l.id === id);
        for (const step of script) {
            const [op, a, b] = step;
            if (op === 'go') {
                const p = this.path(at, [a, b], { open: flags });
                if (!p) throw new Error(id + ': no way ' + at + ' -> ' + a + ',' + b);
                p.forEach((c, i) => out.push(i < p.length - 1 ? { op: 'go', to: c, via: true } : { op: 'go', to: c }));
                at = [a, b];
            } else if (op === 'open') {
                if (door(a) >= 0) flags[door(a)] = unl[door(a)] = true;
                else if (item(a) >= 0) cases.loot[item(a)].opened = true;
                else throw new Error(id + ': open ' + a + ' — no such door or vitrine');
            } else if (op === 'act') {
                // a tie or a knockout: a script knows no guard's place (the plan's screen checks it, the run decides)
                if (a === 'tie' || a === 'knock' ? !this.guards.some(g => g.id === b) : a !== 'drop' && !this.verbsAt(id, at[0], at[1], cases).some(v => v.verb === a && v.target === b)) {
                    throw new Error(id + ': no ' + a + ' ' + b + ' at ' + at);
                }
                if (a === 'pick' || a === 'hack') this.leavesOf(door(b)).forEach(k => { unl[k] = true; });
                if (a === 'lock') this.leavesOf(door(b)).forEach(k => { unl[k] = false; });
                if (a === 'open') flags[door(b)] = unl[door(b)] = true;
                if (a === 'close') flags[door(b)] = false;
                if (a === 'smash') cases.loot[item(b)].broken = true;
                if (a === 'unlock') cases.loot[item(b)].opened = true;
                out.push({ op: 'act', verb: a, target: b, at: at.slice() });
            } else if (op === 'wait') out.push({ op: 'wait', ticks: CoopModel.ticks(a, id + ' wait') });
            else if (op === 'until') out.push({ op: 'until', tick: CoopModel.ticks(a, id + ' until') });
            else throw new Error(id + ': unknown step ' + JSON.stringify(step) + ' (go, open, act, wait, until)');
        }
        return out;
    },

    // The plans of a solution of the level (level.json -> a key of CoopCheck.SOLUTIONS): a script
    // per hero of the crew, none — an empty plan; null — the level has no such solution.
    solutionPlans(key) {
        const S = this.L[key || 'solution'];
        if (!S) return null;
        return this.team.map(id => (S[id] ? this.planFromScript(id, S[id]) : []));
    },
};
Object.assign(CoopLevelModel.prototype, CoopModelPress);
