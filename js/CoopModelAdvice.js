// CoopModelAdvice.js — a part of CoopLevelModel (CoopModel.js): what the plan's screen judges the
// plans by. The ceiling of the plans and a press it refuses (rules, section 23); the advice of «?»
// by the level's solution — what each hero of it needs of the others, the next step he has not
// passed, whether «Очистить» helps (section 24). Methods of the level's model, mixed into its prototype.

/** @satisfies {ThisType<CoopLevelModel>} */
const CoopModelAdvice = {
    // The ceiling of the plans and what keeps the heist from starting (rules, section 23): the
    // police by the plan's own alarm (its ghost G — simulated here if not given) or the patrol,
    // the earlier. -> { t, police, alarmT, why — the alarm's cause, late — the heroes whose plan
    // ends after t, away — those whose plan ends out of the van, empty — no plan has a step, ends — the
    // tick each plan ends at }.
    // A plan ending on the tick t itself is in time: in the van on the patrol's tick is not caught.
    limit(plans, G) {
        G = G || this.ghost(plans);
        const come = this.arrival(G.alarmT), F = G.frames;
        const late = [], away = [];
        G.planEnd.forEach((/** @type {number} */ e, /** @type {number} */ i) => {
            if (e > come.t) late.push(i);
            if (!this.inVan(F[Math.min(F.length - 1, e)].h[i])) away.push(i);
        });
        return { t: come.t, police: come.police, alarmT: G.alarmT, why: G.alarmWhy || null, ends: G.planEnd, late, away,
            empty: plans.every((/** @type {any[]} */ p) => !p.length) };
    },

    // Whether hero i's new plan is refused (rules, section 23): with it his plan, or another one
    // that was in time (not in wasLate), ends past the ceiling. -> { k — that hero, -1 — taken, L — the limit with it }.
    lateBy(plans, i, plan, wasLate) {
        const L = this.limit(plans.map((/** @type {any[]} */ p, /** @type {number} */ j) => (j === i ? plan : p)));
        const k = L.late.find((/** @type {number} */ j) => j === i || !wasLate.includes(j));
        return { k: k === undefined ? -1 : k, L };
    },

    // The steps the press the advice a to hero i asks for adds (rules, sections 18, 24): a walk — the
    // route of a tap on the cell; an action in his cell — the action; elsewhere — the walk there
    // first; a wait — Wait set to the advised tick. null — no route.
    adviceSteps(plans, i, a, G) {
        const at = this.endCell(plans[i], i), t0 = G.planEnd[i];
        const here = a.at && a.at[0] === at[0] && a.at[1] === at[1];
        if (a.kind === 'until') return [{ op: 'wait', ticks: a.tick - t0 }];
        if (a.kind === 'act' && here) return [{ op: 'act', verb: a.verb, target: a.target, at: at.slice() }];
        if (here) return [];
        return this.route(i, at, a.at, G.frames, t0);
    },

    // The tick each step of each hero's script of the level's solution ends at in its ghost:
    // [hero][step] — his script cut after the step, the others' whole (rules, section 24). Once a level.
    solutionTicks() {
        if (this._solTicks) return this._solTicks;
        const S = this.L.solution, base = this.solutionPlans();
        this._solTicks = this.team.map((id, i) => (S[id] || []).map((/** @type {any[]} */ st, /** @type {number} */ k) => {
            const plans = base.slice();
            plans[i] = this.planFromScript(id, S[id].slice(0, k + 1));
            return this.ghost(plans).planEnd[i];
        }));
        return this._solTicks;
    },

    // What each hero of the level's solution needs of the others (rules, section 24, item 4):
    // [hero i] -> [{ hero j, step m — an action of j's script, from — the first step of i's script
    // it holds up, t — the tick the action ends at in the solution }]. j's action m is needed when,
    // with j's script cut before it, i leaves his path of the solution (stuck at a door), rings
    // the alarm himself (a laser in the light) or an action of his does not come out (Ivan 06.11: the
    // ghost's guards answer the plans — no light put out, Valera stays at his post and the pear's
    // «Вырубить» misses); «from» is the step he is on at that tick. Once a level.
    solutionNeeds() {
        if (this._solNeeds) return this._solNeeds;
        const S = this.L.solution, base = this.solutionPlans(), T = this.solutionTicks();
        const run = (/** @type {any[][]} */ plans) => this.ghost(plans);
        const B0 = run(base), B = B0.frames;
        // what hero i did in the run (his events: a door opened, a guard knocked out…): «tick text»
        const did = (/** @type {any} */ r, /** @type {number} */ i) => r.events.filter((/** @type {any} */ e) => e.who === i && e.kind !== 'wait');
        /** @type {Array<Array<{ hero: number, step: number, from: number, t: number }>>} */
        const out = this.team.map(() => []);
        this.team.forEach((id, j) => (S[id] || []).forEach((/** @type {any[]} */ st, /** @type {number} */ m) => {
            if (st[0] !== 'act') return;
            const plans = base.slice();
            plans[j] = this.planFromScript(id, S[id].slice(0, m));
            const G = run(plans), F = G.frames;
            this.team.forEach((other, i) => {
                if (i === j) return;
                let tf = G.alarmT !== null && String(G.alarmWhy).includes(this.heroes[i].fruit) ? G.alarmT : Infinity;
                for (let t = 0; t < B.length && t < tf; t++) {
                    const a = F[Math.min(t, F.length - 1)].h[i], b = B[t].h[i];
                    if (a.x !== b.x || a.y !== b.y) tf = t;
                }
                // his first event the cut run lacks: the step that missed (its moment — the end of its tick, as T)
                const cut = new Set(did(G, i).map((/** @type {any} */ e) => e.t + ' ' + e.text));
                const miss = did(B0, i).find((/** @type {any} */ e) => !cut.has(e.t + ' ' + e.text));
                if (miss && miss.t < tf) tf = miss.t;
                const from = T[i].findIndex((/** @type {number} */ x) => x >= tf);
                if (from >= 0) out[i].push({ hero: j, step: m, from, t: T[j][m] });
            });
        }));
        this._solNeeds = out;
        return out;
    },

    // The advice of «?» to hero i (rules, section 24): the first step of his script in the level's
    // (quiet) solution the plans have not passed. -> null (no solution, a station of the polygon) |
    // { kind: 'alarm', t, why, hero } — the plan rings, the solution does not; hero — whose step rings it |
    // { kind: 'late', hero, t, police } — hero's plan ends past the ceiling t (rules, section 23), or
    // his next step would and he has no time to get back to the van either: «Отменить» |
    // { kind: 'partner', hero } — from his first wait on, a partner's action of the solution ends
    // before this step and is in no plan | { kind: 'go', at } | { kind: 'act', verb, target, at } |
    // { kind: 'until', tick } — a wait of the script, or till the buttons offer the advised action |
    // { kind: 'van', at } — a step into the van, or all passed (or the next step past the ceiling with
    // no action of the script before the van) and the plan ends out of it | { kind: 'start' } |
    // { kind: 'astray' } — off the path, no quiet way back to it: «Отменить» | { kind: 'gone', verb,
    // target, at } — the script's next action the buttons will not offer any more (a guard gone by, a
    // full load) or there is no time for (Ivan 06.11: nothing of the plan in time — «Очистить»). R — the ghost run on past the plans (ghost(plans, true)); alone — the
    // partner's advice asked from here: his partners are not asked in turn; peek — the advice after
    // a press, asked to judge it: it looks no press further.
    // An action is done when any plan has it (any order, any hero) and no plan took it back (a door
    // locked or closed again); a cell or a wait is passed when he gets there after the step before,
    // or when a later action of his script is done. A step the game would not add (past the ceiling)
    // is not advised; the action it leads to is gone.
    advice(plans, i, G, R, alone, peek, trial) {
        const SOL = this.L.solution;
        if (!SOL || this.L.lab) return null;
        G = G || this.ghost(plans);
        // the alarm to the hero whose step rings it: another hero's «Отменить» would not take it away
        // (a trial of «Очистить»: the partners wait for him at the doors — their alarm and lateness till
        // his plan is back are not his)
        if (!SOL.expect.alarm && G.alarmT !== null && !(trial && G.alarmWho !== null && G.alarmWho !== i)) return { kind: 'alarm', t: G.alarmT, why: G.alarmWhy, hero: G.alarmWho === null ? i : G.alarmWho };
        // a plan past the ceiling (rules, section 23): its hero takes it back first
        const lim = this.limit(plans, G);
        if (lim.late.length && !(trial && !lim.late.includes(i))) return { kind: 'late', hero: lim.late.includes(i) ? i : lim.late[0], t: lim.t, police: lim.police };
        const id = this.team[i], F = G.frames, end = G.planEnd[i], last = F[F.length - 1];
        const here = this.endCell(plans[i], i);
        const has = (/** @type {string} */ verb, /** @type {string} */ target) =>
            plans.some((/** @type {any[]} */ p) => p.some(s => s.op === 'act' && s.verb === verb && s.target === target));
        // a vitrine the plans smashed (rules, section 10, 09.11): the script's «взять» is the take a
        // smashed vitrine offers — gather a multi item, grab a mono one
        const S = (SOL[id] || []).map((/** @type {any[]} */ s) => {
            const l = s[0] === 'act' && s[1] === 'take' && has('smash', s[2]) ? this.loot.find(q => q.id === s[2]) : null;
            return l && l.glass ? ['act', l.multi ? 'gather' : 'grab', s[2]] : s;
        });
        // a door picked and locked again, opened and closed again, as the plans leave it, is not done
        const undone = (/** @type {string} */ verb, /** @type {string} */ target) => {
            const back = CoopModel.UNDO_VERB[verb], di = this.doors.findIndex(d => d.id === target);
            if (!back || di < 0 || !has(back, target)) return false;
            return verb === 'open' ? !last.doors[di] : !last.unl[di];
        };
        const done = (/** @type {string} */ verb, /** @type {string} */ target) => has(verb, target) && !undone(verb, target);
        const laterDone = (/** @type {number} */ k) => S.slice(k + 1).some((/** @type {any[]} */ s) => s[0] === 'act' && done(s[1], s[2]));
        const wait = (/** @type {number} */ k) => !!S[k] && (S[k][0] === 'until' || S[k][0] === 'open');
        const vans = S.filter((/** @type {any[]} */ s) => s[0] === 'go' && this.isVan(s[1], s[2]));
        const van = { kind: 'van', at: vans.length ? vans[vans.length - 1].slice(1) : this.heroes[i].start.slice() };
        // the press of the advice a: 'ok' — taken (rules, section 23), quiet, he still has the time to
        // get back to the van after it before the ceiling, and the advice after it is not «Отменить»
        // (a look one press ahead — not from a look ahead: peek); 'late'; 'alarm' — it rings (a tap route
        // across a laser from off the path); 'none' — no route
        const fits = (/** @type {any} */ a) => {
            const st = this.adviceSteps(plans, i, a, G);
            if (!st) return 'none';
            const plan = this.pressed(plans[i], st);
            if (this.lateBy(plans, i, plan, lim.late).k >= 0) return 'late';
            const next = plans.map((/** @type {any[]} */ p, /** @type {number} */ j) => (j === i ? plan : p));
            const G2 = this.ghost(next);
            if (G2.alarmT !== null && !SOL.expect.alarm && !(trial && G2.alarmWho !== null && G2.alarmWho !== i)) return 'alarm';
            if (a.kind === 'van') return 'ok';
            const back = this.adviceSteps(next, i, van, G2);
            if (!back || this.lateBy(plans, i, this.pressed(plan, back), lim.late).k >= 0) return 'late';
            if (peek) return 'ok';
            const after = this.advice(next, i, G2, null, true, true, trial).kind;
            return after === 'late' || after === 'astray' || after === 'gone' ? 'late' : 'ok';
        };
        // the end of the script — or a step there is no time for and no action of the script before the
        // van: in the van — the start; else back to it; no time even for that — take back
        const home = () => {
            if (this.inVan(F[Math.min(F.length - 1, end)].h[i])) return { kind: 'start' };
            const r = fits(van);
            return r === 'ok' ? van : r === 'late' ? { kind: 'late', hero: i, t: lim.t, police: lim.police } : astray(S.length);
        };
        // off the path of the solution (his own presses), the way to step k rings or there is none:
        // the latest cell of the script before it he gets to quietly — from there on the script's
        // way is quiet; none — «Отменить» back to where he left it
        const astray = (/** @type {number} */ k) => {
            for (let kk = k - 1; kk >= 0; kk--) {
                if (S[kk][0] !== 'go' || (S[kk][1] === here[0] && S[kk][2] === here[1])) continue;
                const a = { kind: this.isVan(S[kk][1], S[kk][2]) ? 'van' : 'go', at: [S[kk][1], S[kk][2]] };
                if (fits(a) === 'ok') return a;
            }
            return { kind: 'astray' };
        };
        // an action the plan's buttons do not offer yet at his end (a partner picks the door later):
        // the wait till the first tick they do; never — null
        const ready = (/** @type {string} */ verb, /** @type {string} */ target) => {
            R = R || this.ghost(plans, true);
            for (let t = end; t < R.frames.length - 1; t++) {
                if (this.verbsAt(id, here[0], here[1], this.frameState(F, t, R)).some(v => v.verb === verb && v.target === target)) return t;
            }
            return null;
        };
        // the script's next action not done from step k on and its cell (the last cell of the script
        // before it); none before a step into the van (it empties the load) -> null
        const nextAct = (/** @type {number} */ k) => {
            let c = at;
            for (let j = k; j < S.length; j++) {
                const [op, a, b] = S[j];
                if (op === 'go') { if (this.isVan(a, b)) return null; c = [a, b]; continue; }
                if (op !== 'act' || done(a, b) || (a === 'unlock' && done('smash', b)) || (a === 'smash' && done('unlock', b))) continue;
                return { j, verb: a, target: b, at: c };
            }
            return null;
        };
        // that action the buttons never offer from the earliest tick he could stand in its cell (his end
        // and the cells between, one a tick) to the end of the run — a guard gone by, a full load:
        // { kind: 'gone' }, «Очистить» — in the van too (Ivan 06.11). His plan empty — null: what blocks
        // it is another hero's plan
        const gone = (/** @type {number} */ k) => {
            const n = plans[i].length ? nextAct(k) : null;
            if (!n) return null;
            const c = n.at, own = (/** @type {any} */ v) => v.verb === n.verb && v.target === n.target;
            // a partner's action it needs is in no plan yet (Valera stays at his post till the light is out)
            if (needs.some(q => q.from <= n.j && !done(SOL[this.team[q.hero]][q.step][1], SOL[this.team[q.hero]][q.step][2]))) return null;
            // the frames of the run on (the plans' ghost F stops where the longest plan ends)
            R = R || this.ghost(plans, true);
            for (let t = end + Math.abs(c[0] - here[0]) + Math.abs(c[1] - here[1]); t < R.frames.length - 1; t++) {
                if (this.verbsAt(id, c[0], c[1], this.frameState(R.frames, t, R)).some(own)) return null;
            }
            return { kind: 'gone', verb: n.verb, target: n.target, at: c };
        };
        // «Очистить» only if it helps (Ivan 06.11; the bot looped where the partners' plans blocked
        // him): a gone action stands; looked at from a look ahead or a trial — gone, no trial of its own
        const clear = (/** @type {any} */ g) => (peek || trial || this.clearHelps(plans, i) ? g : home());
        const needs = this.solutionNeeds()[i];
        let t = 0, at = this.heroes[i].start;
        for (let k = 0; k < S.length; k++) {
            const [op, a, b] = S[k];
            if (op === 'open') continue;   // a wait for a door: the route waits by itself (rules, section 18)
            if (op === 'act') {
                const own = plans[i].findIndex((/** @type {any} */ s) => s.op === 'act' && s.verb === a && s.target === b);
                if (done(a, b)) { const sp = own >= 0 && G.spans[i][own]; if (sp) t = Math.max(t, sp.to); continue; }
                // a smashed vitrine is open too (Ivan 05.11: «вскрыть вскрытую витрину»)
                if ((a === 'unlock' && done('smash', b)) || (a === 'smash' && done('unlock', b))) continue;
            } else if (op === 'go') {
                // he stands in the cell of the script's next action already: the cells of the way to it are passed
                const n = nextAct(k);
                if (n && n.at[0] === here[0] && n.at[1] === here[1]) { at = here; continue; }
                const f = F.find((/** @type {any} */ q) => q.t >= t && q.t <= end && q.h[i].x === a && q.h[i].y === b);
                if (f) { t = f.t; at = [a, b]; continue; }
                if (laterDone(k)) { at = [a, b]; continue; }
            } else if (op === 'until') {
                if (end >= a) { t = Math.max(t, a); continue; }
                if (laterDone(k)) continue;
            }
            // a wait of the script belongs to the step after it: the partner first, then the wait
            let kk = k;
            while (wait(kk)) kk++;
            let best = null;
            for (const n of needs) {
                const s = SOL[this.team[n.hero]][n.step];
                if (n.from <= kk && !done(s[1], s[2]) && (!best || n.t < best.t)) best = n;
            }
            // a partner who has nothing left to do in time (his advice is the start) is not waited for
            // (alone — the partner's advice asked from here: it does not ask its own partners, no loop)
            if (best && !alone && this.advice(plans, best.hero, G, R, true).kind === 'start') best = null;
            if (best) return { kind: 'partner', hero: best.hero };
            const lost = gone(k);
            if (lost) return clear(lost);
            let step = op === 'go' ? { kind: this.isVan(a, b) ? 'van' : 'go', at: [a, b] }
                : op === 'until' ? { kind: 'until', tick: a } : { kind: 'act', verb: a, target: b, at };
            if (op === 'act' && at[0] === here[0] && at[1] === here[1]) {
                const t1 = ready(a, b);
                if (t1 !== null && t1 > end) step = { kind: 'until', tick: t1 };
            }
            const r = fits(step);
            if (r === 'ok') return step;
            // the script's way and waits are timed for a hero on its path: from off it, late by them, he
            // may still be in time going straight to the action's cell (its wait — ready, there)
            const n = r === 'late' && step.kind !== 'act' ? nextAct(k) : null;
            const off = (/** @type {number[]} */ c) => !c || n.at[0] !== c[0] || n.at[1] !== c[1];
            if (n && off(step.at) && off(here)) {
                const direct = { kind: 'go', at: n.at };
                if (fits(direct) === 'ok') return direct;
            }
            if (r !== 'late') return astray(k);
            // no time for the script's step: the action it leads to is gone (Ivan 06.11: «если по плану
            // уже ничего не успеть — подсказка предлагает очистить план»); none before the van — home
            const m = plans[i].length ? nextAct(k) : null;
            return m ? clear({ kind: 'gone', verb: m.verb, target: m.target, at: m.at }) : home();
        }
        return home();
    },

    // Does «Очистить» help hero i (rules, section 24; Ivan 06.11)? His plan cleared, the partners' plans
    // as they are, a novice does what the advice says to him alone — every press taken — and gets to
    // the start (or to the van with the script done). A partner's turn, the alarm, the ceiling, off the
    // path or gone again — no: what blocks him is the partners' plans, a clear would bring him back.
    /** @param {any[][]} plans @param {number} i */
    clearHelps(plans, i) {
        const key = i + JSON.stringify(plans);
        this._clearHelps = this._clearHelps || new Map();
        if (this._clearHelps.has(key)) return this._clearHelps.get(key);
        const p = plans.map((q, j) => (j === i ? [] : q));
        let ok = false;
        for (let n = 0; n < CoopModel.CLEAR_TRIAL_PRESSES; n++) {
            const G = this.ghost(p), a = this.advice(p, i, G, null, true, false, true);
            // the start with his script's actions all in the plans (an empty plan's start is no help)
            if (!a || a.kind === 'start') { ok = !!a && (this.L.solution[this.team[i]] || []).every((/** @type {any[]} */ s) => s[0] !== 'act' || p.some(q => q.some((/** @type {any} */ x) => x.op === 'act' && x.verb === s[1] && x.target === s[2]))); break; }
            if (!['go', 'act', 'until', 'van'].includes(a.kind)) break;
            const st = this.adviceSteps(p, i, a, G);
            if (!st || !st.length) break;
            p[i] = this.pressed(p[i], st);
        }
        if (this._clearHelps.size > 200) this._clearHelps.clear();
        this._clearHelps.set(key, ok);
        return ok;
    },
};
Object.assign(CoopLevelModel.prototype, CoopModelAdvice);
