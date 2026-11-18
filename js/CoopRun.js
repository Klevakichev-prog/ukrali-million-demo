// CoopRun.js — one execution of the co-op plans (CoopLevelModel.simulate): the tick, the heroes'
// work, the guards, collisions, vision and alarms, the frames and events of the replay. The level,
// its rules and the tables it reads (job, verbsAt, the grid) — CoopModel.js. Parts of the class
// (Game/CLAUDE.md, «Parts of a class»): CoopRunGuards.js — the guards and vision; CoopRunClash.js —
// the resolution of a tick.

// One execution of the plans: state, the tick, frames and events.
// Every body (a hero or a guard) keeps its state in absolute ticks: it is down (lying or
// flying) while t < downUntil, stunned while t < stunUntil; fly = { dir, left, bounced } while
// it flies, slide — the way it slides on the wet floor.
class CoopRun {
    constructor(M, plans, opts) {
        this.M = M;
        this.ghost = !!opts.ghost;
        // tests: the bodies are taken in the opposite order — the outcome must not change
        this.reverse = !!opts.reverse;
        // a lab station may end its demo earlier (lab.ticks): a jam of close masses never ends
        this.maxTicks = opts.maxTicks || (M.L.lab && M.L.lab.ticks) || CoopModel.MAX_TICKS;
        // the guards' round for the plan's screen: on to maxTicks after the plans are over
        this.full = !!opts.full;
        this.t = 0;
        // one flag a panel (CoopLevelModel.panels), true — on; offAt — the moment it went off
        this.power = M.panels.map(() => true);
        this.offAt = M.panels.map(() => null);
        this.panelUsed = false;
        this.alarmT = null;
        this.alarmWhy = '';
        this.alarmWho = null;   // the hero whose step rang it (a door, a vitrine, a laser, a touch, seen), null — none of them
        this.doorOpen = M.openAtStart();
        /** @type {{ h: any, di: number }[]} */
        this.closing = [];   // the doors closed this tick, shut after the moves (shutDoors)
        /** @type {{ h: any, st: any, w: any, at: any }[]} */
        this.finishing = [];   // the jobs finished this tick, done after the moves (finishJobs)
        this.doorUnlocked = M.unlockedAtStart();   // picked: the lock is off, the door may still be shut (rules, section 9)
        // progress of a lock in the units of its lock's time: one with the skill adds SKILL_X a tick, others 1
        this.doorProg = M.doors.map(() => 0);
        // progress of locking a door again, on its lock as well (rules, sections 9 and 11)
        this.doorLockProg = M.doors.map(() => 0);
        // a vitrine: broken / opened; lockProg — its lock's progress in the units of its ticks, as a
        // door's; spoiled — a multi item grabbed from a smashed vitrine, a quarter of its price and mass lost (rules, section 10, 09.11)
        this.loot = M.loot.map(l => ({ x: l.at[0], y: l.at[1], holder: -1, delivered: false, broken: false, opened: false, lockProg: 0, spoiled: false }));
        this.heroes = M.heroes.map((h, i) => ({
            i, ord: i, id: h.id, name: h.fruit, acc: h.acc, fem: !!h.fem, baseMass: h.mass, skills: h.skills,
            force: h.skills.includes('force') ? CoopModel.SKILL_X : 1,
            x: h.start[0], y: h.start[1], f: 'U',
            plan: plans[i] || [], pc: 0, wait: -1, downUntil: 0, stunUntil: 0, fly: null, flew: false, fd: null, slide: null, path: null,
            prog: 0, working: false, busy: false, carry: [], knockFrom: null, trail: null, kc: undefined, sd: null, rest: null,
            caught: false, done: false, doneAt: null, span: []
        }));
        // the plan's ghost has the guards too: they answer the plans as in a run — the dark, a noise,
        // a knockout, a tie, the plan's own alarm (Ivan 06.11, rules, section 8)
        this.guards = M.guards.map((g, i) => {
            const start = g.patrol ? g.patrol[0] : g.post;
            return { def: g, k: i, ord: 100 + i, x: start[0], y: start[1], f: g.facing, state: g.patrol ? 'patrol' : 'post', idx: 0, panel: -1,
                downUntil: 0, stunUntil: 0, fly: null, flew: false, fd: null, out: false, path: null, goal: null, look: 0, prog: 0,
                knockFrom: null, trail: null, kc: undefined, sd: null, rest: null, seen: {},
                // tied (rules, section 21): lies until untied; knockEnd — when his knockout would have ended;
                // untie — the tied guard he goes to free
                tied: false, knockEnd: 0, untie: null,
                // steps — the steps of his round so far, stop — the ticks of a stop left (rules, section 8)
                steps: 0, stop: 0 };
        });
        this.camSeen = M.cameras.map(() => ({}));
        // the heroes who step this tick (a guard holding an exit attacks only one who stays: preyOf)
        this.heroMoving = new Set();
        this.events = [];
        this.frames = [];
    }

    run() {
        this.record();
        while (this.t < this.maxTicks && (this.full || !this.finished())) {
            this.tick();
            this.record();
        }
        return this.result();
    }

    // An event is stamped with the moment from which it holds (Ivan 21.10, rules, section 3, item 6):
    // «тик N» is the moment after N ticks (frames[N]). By default it happened in this tick — the
    // moment after it; at — a thing that begins at a moment (a wait, a guard on his feet).
    event(kind, text, who, at) {
        this.events.push({ t: at == null ? this.t + 1 : at, kind, text, who: who == null ? -1 : who });
    }

    // In the plan's ghost only the plan's own alarms ring — a door's or a vitrine's sensor, a laser
    // (no vision of the guards or the cameras there): the plan's timer turns to the police (rules, section 14).
    alarm(why, who) {
        if (this.alarmT !== null) return;
        this.alarmT = this.t + 1;   // the moment it rings (rules, section 3, item 6)
        this.alarmWhy = why;
        this.alarmWho = who == null ? null : who;
        this.event('alarm', CoopText.t('log.alarm', { why }));
    }

    // Panel i on or off. why — the log line; h — who did it (Ivan 23.10: the log is «who + what»,
    // as a door's line)
    setPower(i, on, why, h) {
        if (this.power[i] === on) return;
        this.power[i] = on;
        this.event('power', why, h ? h.i : null);
        this.offAt[i] = on ? null : this.t + 1;   // dark from the moment after this tick
    }

    finished() {
        return this.heroes.every(h => h.caught || (h.done && !this.isDown(h) && !h.slide));
    }

    // Every body on the floor: heroes not caught and the guards (a knocked-out one is a body too).
    bodies() {
        return this.heroes.filter(h => !h.caught).concat(this.guards);
    }

    isDown(b) { return !!(b.out || b.fly || this.t < b.downUntil); }
    isStunned(b) { return this.t < b.stunUntil; }

    // --- one tick ------------------------------------------------------------------

    tick() {
        const t = this.t;
        for (const b of this.heroes.concat(this.guards)) b.flew = false;
        // a knocked-out guard gets up after the knockout time and goes back to what he did (rules, section 8)
        for (const g of this.guards) if (g.out && t >= g.outUntil) this.guardWake(g);
        this.guardsKeepApart();

        const movers = [];
        this.switching = [];
        this.untying = [];
        this.closing = [];
        this.finishing = [];
        (this.reverse ? this.heroes.slice().reverse() : this.heroes).forEach((h) => {
            const m = this.heroIntent(h);
            if (m) movers.push({ body: h, ...m });
        });
        this.heroMoving = new Set(movers.map(m => m.body));
        this.guards.forEach((g) => {
            const m = this.guardIntent(g);
            if (m) movers.push({ body: g, ...m });
        });
        this.resolve(movers);
        this.finishJobs();
        this.guardSwitchOn();
        this.guardUntie();
        this.shutDoors();
        if (!this.ghost) {
            this.vision();
            const come = this.M.arrival(this.alarmT), police = come.police;
            // the patrol and the police are moments too: who is not in the van at that moment is caught
            if (this.t + 1 === come.t && !police) this.event('police', CoopText.t('log.patrol_here'));
            if (this.t + 1 >= come.t) {
                for (const h of this.heroes) {
                    if (this.M.onJob(h)) {
                        h.caught = true;
                        this.event('caught', CoopText.t(police ? 'log.caught_police' : 'log.caught_patrol', { who: h }), h.i);
                    }
                }
            }
        }
        this.t++;
    }

    // --- heroes ----------------------------------------------------------------------

    // The mass of the loot a hero carries and how much he may carry.
    loadOf(h) { return h.carry.reduce((s, li) => s + this.M.massOf(li, this.loot[li]), 0); }
    capacity(h) { return this.M.capacity(this.M.heroes[h.i]); }

    heroIntent(h) {
        h.waiting = null;
        if (h.caught) return null;
        h.working = false;
        if (h.fly) return this.flyIntent(h);
        if (this.isDown(h) || this.isStunned(h)) return null;
        if (h.slide) {
            // a cell of the plan slid over is passed: the hero does not come back for it
            const st = h.plan[h.pc];
            if (st && st.op === 'go' && st.to[0] === h.x && st.to[1] === h.y) { h.pc++; h.path = null; }
            return this.slideIntent(h);
        }
        for (let guard = 0; guard < 16; guard++) {
            const st = h.plan[h.pc];
            if (!st) { h.done = true; return null; }
            h.done = false;
            if (st.op === 'until') {
                if (this.t >= st.tick) { h.pc++; continue; }
                // the plan's log (Ivan 18.10 night): a wait is a line of it
                if (this.ghost && !h.span[h.pc]) this.event('wait', CoopText.t('log.wait', { who: h, wait: CoopModel.clock(st.tick - this.t), till: CoopModel.clock(st.tick) }), h.i, this.t);
                this.spent(h);
                h.waiting = { wl: st.tick - this.t - 1, wt: st.tick - h.span[h.pc].from };
                return null;
            }
            if (st.op === 'wait') {
                if (h.wait < 0) {
                    h.wait = st.ticks;
                    if (this.ghost && st.ticks > 0) this.event('wait', CoopText.t('log.wait', { who: h, wait: CoopModel.clock(st.ticks), till: CoopModel.clock(this.t + st.ticks) }), h.i, this.t);
                }
                if (h.wait <= 0) { h.wait = -1; h.pc++; continue; }
                h.wait--;
                this.spent(h);
                h.waiting = { wl: h.wait, wt: st.ticks };
                return null;
            }
            if (st.op === 'go') {
                // the cells of a path are not plan points: a hero carried along his own path (a
                // slide, a flight, a knock while he waited) goes on from where he landed, not back
                // for the cells he passed (never past a plan point — the last cell of a go, without
                // `via`); carried off = not where the plan left him
                let k = h.pc - 1;
                while (h.plan[k] && (h.plan[k].op === 'wait' || h.plan[k].op === 'until')) k--;
                const left = h.plan[k] ? (h.plan[k].op === 'go' ? h.plan[k].to : h.plan[k].at) : null;
                if (left && (h.x !== left[0] || h.y !== left[1])) {
                    k = h.pc;
                    while (h.plan[k] && h.plan[k].op === 'go' && h.plan[k].via && (h.plan[k].to[0] !== h.x || h.plan[k].to[1] !== h.y)) k++;
                    const on = h.plan[k];
                    if (on && on.op === 'go' && on.to[0] === h.x && on.to[1] === h.y) { h.pc = k + 1; h.path = null; continue; }
                }
                const [tx, ty] = st.to;
                if (h.x === tx && h.y === ty) { h.pc++; h.path = null; continue; }
                return this.walkTo(h, st.to);
            }
            // act: get to the spot first
            if (h.x !== st.at[0] || h.y !== st.at[1]) return this.walkTo(h, st.at);
            const fin = this.work(h, st);
            if (h.working) { this.spent(h); this.workClock(h, st, fin); }
            // a finished job keeps him on its step till the end of the tick (finishJobs)
            if (fin && !this.finishing.some(f => f.h === h)) { h.pc++; h.prog = 0; h.busy = false; }
            return null;
        }
        return null;
    }

    // A hero at work (Ivan 19.10): he faces what he works on; wl — the ticks of it left after this
    // one, wt — its whole time for him, wv/wo — the verb and the object (the round timer over the
    // object in the view; a drop's object is his load).
    workClock(h, st, fin) {
        const M = this.M;
        h.wv = st.verb;
        h.wo = st.target;
        const li = M.loot.findIndex(l => l.id === st.target), L = this.loot[li], G = this.guards.find(g => g.def.id === st.target);
        const f = M.faceTo(h.x, h.y, st.verb, st.target, L ? [L.x, L.y] : G && [G.x, G.y]);
        if (f) h.f = f;
        const j = M.job(st.verb, st.target);
        h.wt = M.workTicks(h, st.verb, st.target);
        h.wl = fin ? 0 : Math.max(0, Math.ceil((j.ticks - this.progOf(h, st, j)) / M.pace(h, j.skill)));
    }

    // The progress of a job in its units (CoopLevelModel.job): on the lock of its door or vitrine,
    // else on the hero.
    progOf(h, st, j) {
        if (j.lock === 'door') return this.doorProg[this.M.doors.findIndex(d => d.id === st.target)];
        if (j.lock === 'relock') return this.doorLockProg[this.M.doors.findIndex(d => d.id === st.target)];
        if (j.lock === 'vitrine') return this.loot[this.M.loot.findIndex(l => l.id === st.target)].lockProg;
        return h.prog;
    }

    // This tick goes to the hero's current step (standing or working on it): result().spans.
    spent(h) {
        const s = h.span[h.pc] || (h.span[h.pc] = { from: this.t, to: this.t });
        s.to = this.t;
    }

    walkTo(h, to) {
        const dist = Math.abs(to[0] - h.x) + Math.abs(to[1] - h.y);
        let next = null;
        if (dist === 1) next = to;
        else {
            if (!h.path || !h.path.length || h.pathTo !== to[0] + ',' + to[1]) {
                h.path = this.M.path([h.x, h.y], to, { open: this.doorOpen });
                h.pathTo = to[0] + ',' + to[1];
            }
            if (!h.path || !h.path.length) return null;
            next = h.path[0];
            if (Math.abs(next[0] - h.x) + Math.abs(next[1] - h.y) !== 1) { h.path = null; return null; }
        }
        const dir = this.dirTo(h.x, h.y, next[0], next[1]);
        if (!dir || !this.M.canStep(h.x, h.y, dir, 'hero', this.doorOpen)) return null;
        return { to: next, dir };
    }

    // Sliding on the wet floor: the next cell the way it slides. A wall stops it on the last wet
    // cell on its feet; a vitrine breaks and it falls there.
    slideIntent(h) {
        const dir = h.slide, [dx, dy] = CoopModel.DELTA[dir];
        if (!this.M.canStep(h.x, h.y, dir, 'hero', this.doorOpen)) {
            h.slide = null;
            h.path = null;
            const v = this.vitrineAt(h.x + dx, h.y + dy);
            if (v >= 0) {
                this.lungeGlass(h, dir);
                this.breakGlass(v, CoopText.t('log.crash_glass', { who: h }), h.kc, h.i);
                // it falls back from the glass, facing it, as from any body it runs into
                this.knock(h, 0, CoopModel.BACK[dir]);
                this.land(h);
            }
            return null;
        }
        return { to: [h.x + dx, h.y + dy], dir, slide: true };
    }

    // Flying: the next cell its way. A wall, a shut door or a vitrine ends the flight in its own
    // cell (it lies what is left of the flight plus LIE_TICKS — downUntil is already that).
    flyIntent(b) {
        const dir = b.fly.dir, [dx, dy] = CoopModel.DELTA[dir];
        if (!this.M.canStep(b.x, b.y, dir, 'hero', this.doorOpen)) {
            const v = this.vitrineAt(b.x + dx, b.y + dy);
            if (v >= 0) {
                this.lungeGlass(b, dir);
                this.breakGlass(v, CoopText.t('log.fly_glass', { who: this.body(b) }), b.kc, this.isGuard(b) ? null : b.i);
            }
            this.land(b);
            return null;
        }
        return { to: [b.x + dx, b.y + dy], dir, fly: true };
    }

    dirTo(x, y, tx, ty) {
        if (tx === x + 1 && ty === y) return 'R';
        if (tx === x - 1 && ty === y) return 'L';
        if (tx === x && ty === y + 1) return 'D';
        if (tx === x && ty === y - 1) return 'U';
        return null;
    }

    // The jobs finished this tick take effect at its very end, after the moves (Ivan 21.10: «любое
    // действие завершается в самом конце тика», rules, section 3): everybody sees them from the next
    // tick, whatever the order of the crew. A knock or a stun lands mid-tick (Ivan 21.10), so a job
    // is not finished then: knocked down, it is lost (fallHero has already taken the progress, rules,
    // section 11); stunned, he stays on it and finishes after the stun; two finishing the same thing — the first of the
    // crew does it, the other's step is spent (idle by then). The panel goes first: a sensor's door
    // or vitrine finished in the same tick is already dark (a tie, settled for the crew; the moves
    // of the tick met the lasers and the sensors with the light still on).
    finishJobs() {
        const first = (/** @type {any} */ f) => (f.st.verb === 'power' ? 0 : 1);
        const all = this.finishing.slice().sort((a, b) => first(a) - first(b) || a.h.i - b.h.i);
        this.finishing = [];
        const blows = [];
        for (const { h, st, w, at } of all) {
            if (!h.busy || this.isStunned(h)) continue;
            h.pc++; h.prog = 0; h.busy = false;
            if (st.verb === 'knock') { if (at.g) blows.push({ h, g: at.g }); continue; }
            if (!w.idle(this, h, at)) w.done(this, h, at, st.verb);
        }
        this.knockBlows(blows);
    }

    // The knockouts of a tick (rules, section 22), after the moves and turns, before the guards look:
    // each is judged on the guard as the tick left him, before any blow — a guard felled in this tick
    // is not knocked out by another blow of it; knocked out by more than one — for the longest time.
    knockBlows(blows) {
        const C = CoopModel, G = C.OBJECTS.guard;
        const res = blows.map(({ h, g }) => (g.out ? null : this.M.knockResult(this.M.heroes[h.i], h.x, h.y, { x: g.x, y: g.y, f: g.f, down: this.isDown(g) }, this.doorOpen)));
        for (const g of new Set(blows.map(b => b.g))) {
            const mine = blows.map((b, k) => ({ b, r: res[k] })).filter(q => q.b.g === g && q.r);
            if (!mine.length) continue;
            const ko = mine.filter(q => q.r === 'ko'), first = (ko.length ? ko : mine)[0].b.h;
            const side = C.BACK[this.dirTo(g.x, g.y, first.x, first.y)];
            if (ko.length) {
                const n = Math.max(...ko.map(q => (this.M.heroes[q.b.h.i].skills.includes('force') ? G.knockout_force_ticks : G.knockout_ticks)));
                Object.assign(g, { out: true, outUntil: this.t + n, fly: null, fd: side, stop: 0, path: null });
                for (const q of ko) this.event('stun', CoopText.t('log.knockout', { who: q.b.h, whom: g.def }), q.b.h.i);
            } else {
                this.knock(g, 0, side);
                this.land(g);
                for (const q of mine) this.event('stun', CoopText.t('log.knockdown', { who: q.b.h, whom: g.def }), q.b.h.i);
            }
        }
    }

    // The doors closed this tick shut after the moves (rules, section 9): the lock stays off — a
    // shut door offers «Открыть» again; closing rings nothing.
    shutDoors() {
        for (const { h, di } of this.closing) {
            this.doorOpen[di] = false;
            this.event('door', CoopText.t('log.door_close', { who: h, door: this.M.doors[di].name }), h.i);
        }
    }

    // A door opens: a sensor on it rings with the light on (Ivan 20.10: on the opening, not on a
    // body going through — rules, section 12).
    openDoor(h, di) {
        const d = this.M.doors[di];
        this.doorOpen[di] = this.doorUnlocked[di] = true;
        this.doorLockProg[d.lockOf] = 0;   // a leaf open: the locking of the door is lost (rules, section 9)
        this.event('door', CoopText.t('log.door_open', { who: h, door: d.name }), h.i);
        if (d.sensor && this.armed('sensors')) this.alarm(CoopText.t('log.door_sensor', { who: h, door: d.name }), h.i);
    }

    // Progress of an action; true when it is over. Per verb: idle — nothing to do (the step is
    // skipped), done — what the finished job does, at the end of the tick (finishJobs); its units, skill and the place of its progress
    // come from the one table, CoopLevelModel.job (a skill speeds any job it is set for).
    work(h, st) {
        const M = this.M;
        // out of reach: the step is skipped, as the plan buttons would not offer it; a knockout is
        // judged only at the end of its tick (finishJobs, rules, section 22)
        if (st.verb !== 'knock' && !M.verbsAt(h.id, h.x, h.y, this).some(v => v.verb === st.verb && v.target === st.target)) return true;
        const w = CoopRun.WORKS[st.verb];
        const at = { di: M.doors.findIndex(d => d.id === st.target), li: M.loot.findIndex(l => l.id === st.target), pi: M.panelIndex(st.target),
            g: this.guards.find(g => g.def.id === st.target) };
        if (!w || w.idle(this, h, at)) return true;
        h.working = h.busy = true;
        const j = M.job(st.verb, st.target), step = M.pace(h, j.skill);
        if (j.lock === 'door') this.doorProg[at.di] += step;
        else if (j.lock === 'relock') this.doorLockProg[at.di] += step;
        else if (j.lock === 'vitrine') this.loot[at.li].lockProg += step;
        else h.prog += step;
        if (this.progOf(h, st, j) < j.ticks) return false;
        this.finishing.push({ h, st, w, at });
        return true;
    }

    dropLoot(h) {
        for (const li of h.carry) {
            const L = this.loot[li];
            L.holder = -1; L.x = h.x; L.y = h.y;
        }
        h.carry = [];
    }

    vitrineAt(x, y) {
        return this.M.loot.findIndex(l => l.glass && l.at[0] === x && l.at[1] === y);
    }

    // k — the moment of the tick the glass breaks (a body reaches it, the view); none — at its end.
    breakGlass(li, why, k, who) {
        const L = this.loot[li];
        if (L.broken) return;
        L.broken = true;
        L.bk = k;
        this.event('glass', why, -1);
        if (this.M.loot[li].sensor && this.armed('sensors')) this.alarm(CoopText.t('log.glass_sensor', { why }), who);
        this.noise(this.M.loot[li].at[0], this.M.loot[li].at[1]);
    }

    // --- guards (the rest — CoopRunGuards.js) -------------------------------------------

    // The exit a guard holds after an alarm (CoopLevelModel.exitPosts), null — the level has none.
    exitOf(g) { return this.M.exitPosts()[g.k]; }

    // --- the resolution of a tick (the rest — CoopRunClash.js) --------------------------

    isGuard(b) { return !!b.def; }
    nameOf(b) { return this.isGuard(b) ? b.def.name : b.name; }
    // A body for a text's slot ({ name, acc, fem }): a guard's entry has no fem — he is a man; the
    // crew's fruits have their own gender.
    body(b) { return this.isGuard(b) ? b.def : b; }
    massOf(b) { return this.isGuard(b) ? CoopModel.GUARD_MASS : b.baseMass + this.loadOf(b); }

    // --- vision (the rest — CoopRunGuards.js) -------------------------------------------

    // vision is at the end of the tick: the angle of the moment after it, the one on the screen
    cameraAngle(c) { return this.M.cameraAngle(c, this.t + 1); }

    visible(h) { return this.M.onJob(h); }

    // Whether what (see CoopLevelModel.isArmed) works now.
    armed(what) { return this.M.isArmed(what, this.power); }

    // --- frames and the result -------------------------------------------------------

    // The cells a body has gone through this tick (a lunge into a crash, then a step back) —
    // the scene follows the broken line instead of cutting across.
    trail(b) {
        (b.trail || (b.trail = [])).push([b.x, b.y]);
    }

    // The radius of a body in the view, cells (CoopModel.bodyRadius).
    radiusOf(b) { return this.isGuard(b) ? CoopModel.GUARD_RADIUS : CoopModel.bodyRadius(b.baseMass); }

    // How far a body reaches from the middle of its cell towards dir, cells. On its feet — its
    // radius; down (lying or flying) it lies across the middle of its cell (CoopScene.placeBean):
    // half its height along itself, its radius across.
    reachOf(b, dir) {
        const r = this.radiusOf(b);
        if (!this.isDown(b) || !b.fd || (b.fd !== dir && b.fd !== CoopModel.BACK[dir])) return r;
        return (this.isGuard(b) ? CoopModel.GUARD_LENGTH : CoopModel.BODY_LENGTH * r) / 2;
    }

    // A slide or a flight into a vitrine: it reaches the glass box (a cell a tick), then the glass breaks.
    lungeGlass(b, dir) {
        const d = Math.max(0.1, 1 - CoopModel.VITRINE_HALF - this.reachOf(b, dir));
        b.kc = d;
        this.lunge(b, dir, d, d);
    }

    // The moment of an event's touch, share of the tick: the parts go their way a cell a tick (the
    // ones who stand stay) and the first two to come within the reach of each other touch.
    contactOf(e) {
        const C = CoopModel;
        let best = 1;
        for (let i = 0; i < e.parts.length; i++) {
            for (let j = i + 1; j < e.parts.length; j++) {
                const A = e.parts[i], B = e.parts[j];
                if (!A.m && !B.m) continue;
                const va = A.m ? C.DELTA[A.m.dir] : [0, 0], vb = B.m ? C.DELTA[B.m.dir] : [0, 0];
                const d0 = [B.b.x - A.b.x, B.b.y - A.b.y], dv = [vb[0] - va[0], vb[1] - va[1]];
                const toward = (d) => d[0] > 0 && !d[1] ? 'R' : d[0] < 0 && !d[1] ? 'L' : d[1] > 0 && !d[0] ? 'D' : d[1] < 0 && !d[0] ? 'U' : null;
                const ab = toward(d0), R = this.reachOf(A.b, ab) + this.reachOf(B.b, ab && C.BACK[ab]);
                // |d0 + dv t| = R: the earliest t in [0, 1]
                const a = dv[0] * dv[0] + dv[1] * dv[1], b = 2 * (d0[0] * dv[0] + d0[1] * dv[1]);
                const c = d0[0] * d0[0] + d0[1] * d0[1] - R * R;
                if (c <= 0) { best = 0; continue; }
                const disc = b * b - 4 * a * c;
                if (!a || disc < 0) continue;
                const t = (-b - Math.sqrt(disc)) / (2 * a);
                if (t >= 0 && t < best) best = t;
            }
        }
        return Math.max(0.05, Math.min(0.95, best));
    }

    // A reach of `d` cells towards dir, touching at the share k of the tick, and back (the touch
    // of a crash, without leaving the cell).
    lunge(b, dir, d, k) {
        const [dx, dy] = CoopModel.DELTA[dir];
        (b.trail || (b.trail = [])).push([b.x + dx * d, b.y + dy * d, k], [b.x, b.y]);
        b.rest = null;
    }

    // A body that stood is hit at the share k of the tick: it stays put until then.
    hold(b, k) {
        (b.trail || (b.trail = [])).push((b.rest || [b.x, b.y]).concat([k]));
    }

    // [tr, tt] — the broken line of the last tick (only when it is longer than one cell) and the
    // moment of each of its points: given at the touch, the last at 1, the rest spread by length
    // between them (the same pace along each stretch). from — where the tick started.
    tr(b, from) {
        const t = b.trail && b.trail.length > 1 ? b.trail : null;
        b.trail = null;
        if (!t) return [undefined, undefined];
        const pts = [from].concat(t), at = [0].concat(t.map(q => q[2]));
        at[at.length - 1] = 1;
        const len = (u, v) => Math.hypot(pts[v][0] - pts[u][0], pts[v][1] - pts[u][1]);
        for (let i = 1; i < at.length; i++) {
            if (at[i] !== undefined) continue;
            let j = i;
            while (at[j] === undefined) j++;
            let total = 0;
            for (let q = i - 1; q < j; q++) total += len(q, q + 1);
            let run = 0;
            for (let q = i; q < j; q++) {
                run += len(q - 1, q);
                at[q] = at[i - 1] + (at[j] - at[i - 1]) * (total ? run / total : (q - i + 1) / (j - i + 1));
            }
        }
        return [t.map(q => [q[0], q[1]]), at.slice(1)];
    }

    // A frame: the state after a tick (the frame of tick t is the state the tick t starts with).
    // fall — down (lying or flying), fly — flew a cell this tick, flies — flies on the next one, carry — how many items he
    // carries; wait — { wl, wt } of a hero on a Wait or a Wait-until step: the ticks left after this
    // one and the whole wait (as wl, wt of a work); a loot item has k — its place in the holder's stack, bk — the moment its glass broke
    // in the tick (only in the frame of that tick).
    // tr, tt — the broken line of the tick and the moment of each point (CoopModel.tr); kc — the
    // moment the body touched another one (or a vitrine) in the tick, its crash plays from there;
    // sd — where a stunned body was pushed; rest — where in its cell a body stopped short (it
    // knocked a guard out), the view keeps it there until it moves.
    record() {
        // the tick a hero's plan ran out (null — still on it): result().planEnd
        for (const h of this.heroes) h.doneAt = h.done ? (h.doneAt == null ? this.t : h.doneAt) : null;
        const prev = this.frames[this.frames.length - 1];
        const line = (b, i, kind) => {
            const p = prev ? prev[kind][i] : b, [tr, tt] = this.tr(b, p.rest || [p.x, p.y]), kc = b.kc;
            b.kc = undefined;
            return { tr, tt, kc, rest: b.rest || undefined };
        };
        this.frames.push({
            t: this.t,
            h: this.heroes.map((h, i) => Object.assign({ x: h.x, y: h.y, f: h.f, fall: this.isDown(h), fly: h.flew, flies: !!h.fly, fd: h.fd, stun: this.isStunned(h), sd: h.sd,
                slide: !!h.slide, work: h.working, wl: h.working ? h.wl : undefined, wt: h.working ? h.wt : undefined,
                wv: h.working ? h.wv : undefined, wo: h.working ? h.wo : undefined,
                wait: h.waiting || undefined, carry: h.carry.length, caught: h.caught }, line(h, i, 'h'))),
            g: this.guards.map((g, i) => Object.assign({ x: g.x, y: g.y, f: g.f, out: g.out, fall: this.isDown(g), fly: g.flew, flies: !!g.fly, fd: g.fd,
                stun: this.isStunned(g), sd: g.sd, st: g.state, tied: g.tied }, line(g, i, 'g'))),
            power: this.power.slice(),
            cams: this.M.cameras.map(c => this.camOn(c)),
            alarm: this.alarmT !== null,
            doors: this.doorOpen.slice(),
            unl: this.doorUnlocked.slice(),
            loot: this.loot.map((l, li) => ({ x: l.x, y: l.y, holder: l.holder, k: l.holder >= 0 ? this.heroes[l.holder].carry.indexOf(li) : -1,
                del: l.delivered, br: l.broken, op: l.opened, sp: l.spoiled, bk: l.bk }))
        });
        for (const l of this.loot) l.bk = undefined;
    }

    // What item li brings: a grabbed multi one — its price times grab_keep, rounded down (rules,
    // section 10, 09.11); the journal and the money both read it.
    worth(li) {
        const v = this.M.loot[li].value;
        return this.loot[li].spoiled ? Math.floor(v * CoopModel.OBJECTS.vitrine.grab_keep) : v;
    }

    result() {
        const M = this.M;
        let money = 0;
        this.loot.forEach((l, i) => { if (l.delivered) money += this.worth(i); });
        // caught — a failure (the result says «Провал»): no stars, whatever is in the van (rules, section 15)
        const caught = this.heroes.some(h => h.caught);
        const stars = caught ? 0 : M.stars.filter(s => money >= s).length;
        const left = this.heroes.filter(h => M.onJob(h)).map(h => h.i);
        return {
            frames: this.frames, events: this.events, money, stars, ticks: this.t,
            alarmT: this.alarmT, alarmWhy: this.alarmWhy, alarmWho: this.alarmWho,
            caught: this.heroes.filter(h => h.caught).map(h => h.i), left,
            powerUsed: this.panelUsed,
            // per hero: the moment his plan is over — his next step would start there (walking,
            // working, waiting count); an empty plan — 0, one that never ran out — the end of the take
            planEnd: this.heroes.map(h => (h.doneAt == null ? this.t : Math.max(0, h.doneAt - 1))),
            // per hero, per plan step: the ticks he stood or worked on it ({ from, to }, both in;
            // none for a walk or a step skipped)
            spans: this.heroes.map(h => h.span)
        };
    }
}

// What each action needs and does (CoopRun.work; its time — CoopLevelModel.job): idle — nothing
// left to do, the step is skipped; done — the finished job. at: di — the door, li — the loot item.
/** @type {Record<string, { idle: (r: CoopRun, h: any, at: any) => boolean, done: (r: CoopRun, h: any, at: any, verb: string) => void }>} */
CoopRun.WORKS = {
    // a pick or a hack leaves the door shut — «Открыть» is its own action (Ivan 20.10: all doors
    // are alike, they differ in the lock and the sensor)
    pick: {
        idle: (r, h, at) => at.di < 0 || r.doorUnlocked[at.di],
        done: (r, h, at, verb) => {
            for (const k of r.M.leavesOf(at.di)) r.doorUnlocked[k] = true;   // one lock for all the leaves
            r.doorLockProg[at.di] = 0;
            r.event('door', CoopText.t(verb === 'pick' ? 'log.pick' : 'log.hack', { who: h, door: r.M.doors[at.di].name }), h.i);
        }
    },
    // «Запереть» (Ivan 21.10): the lock back on, all the leaves shut; a new pick starts from nothing
    lock: {
        idle: (r, h, at) => at.di < 0 || !r.doorUnlocked[at.di] || r.M.leavesOf(at.di).some(k => r.doorOpen[k]),
        done: (r, h, at) => {
            for (const k of r.M.leavesOf(at.di)) r.doorUnlocked[k] = false;
            r.doorProg[at.di] = r.doorLockProg[at.di] = 0;
            r.event('door', CoopText.t('log.lock', { who: h, door: r.M.doors[at.di].name }), h.i);
        }
    },
    open: {
        idle: (r, h, at) => at.di < 0 || r.doorOpen[at.di] || !r.doorUnlocked[at.di],
        done: (r, h, at) => r.openDoor(h, at.di)
    },
    // shut at the end of the tick (shutDoors): a step through it this tick is taken, whatever the
    // order of the heroes
    close: {
        idle: (r, h, at) => at.di < 0 || !r.doorOpen[at.di],
        done: (r, h, at) => { if (!r.closing.some(c => c.di === at.di)) r.closing.push({ h, di: at.di }); }
    },
    power: {
        idle: (r, h, at) => at.pi < 0 || !r.power[at.pi],   // off already; the guard may switch it back on (rules, section 8)
        done: (r, h, at) => { r.panelUsed = true; r.setPower(at.pi, false, CoopText.t('log.power_off', { who: h, panel: r.M.panels[at.pi].name }), h); }
    },
    // a knocked-out guard next to him (rules, section 21): not knocked out (up, only felled), tied
    // already or up before the end — the step is spent; he lies tied until another guard unties him
    // a blow at a guard (rules, section 22): judged at the end of the tick, all at once (knockBlows)
    knock: {
        idle: (r, h, at) => !at.g || at.g.out,
        done: () => {}
    },
    tie: {
        idle: (r, h, at) => !at.g || !at.g.out || at.g.tied,
        done: (r, h, at) => {
            Object.assign(at.g, { tied: true, knockEnd: at.g.outUntil, outUntil: Infinity });
            r.event('tie', CoopText.t('log.tie', { who: h, whom: at.g.def }), h.i);
        }
    },
    // more than he may carry: the item stays where it lies
    take: {
        idle: (r, h, at) => {
            const L = r.loot[at.li];
            return !L || L.holder >= 0 || L.delivered || r.loadOf(h) + r.M.massOf(at.li, L) > r.capacity(h) + 1e-9;
        },
        done: (r, h, at) => {
            r.loot[at.li].holder = h.i;
            h.carry.push(at.li);
            r.event('take', CoopText.t('log.take', { who: h, loot: r.M.loot[at.li].name }), h.i);
        }
    },
    // from a smashed vitrine (rules, section 10, 09.11): grab — fast, a multi item loses a quarter of
    // its price and mass (a mono one nothing); gather — slow and whole. The buttons are offered by
    // verbsAt, which also checks the load against the mass the item will have.
    grab: {
        idle: (r, h, at) => {
            const L = r.loot[at.li], keep = r.M.loot[at.li].multi ? CoopModel.OBJECTS.vitrine.grab_keep : 1;
            return !L || L.holder >= 0 || L.delivered || r.loadOf(h) + r.M.loot[at.li].mass * keep > r.capacity(h) + 1e-9;
        },
        done: (r, h, at) => {
            if (r.M.loot[at.li].multi) r.loot[at.li].spoiled = true;
            r.loot[at.li].holder = h.i;
            h.carry.push(at.li);
            r.event('take', CoopText.t('log.grab', { who: h, loot: r.M.loot[at.li].name }), h.i);
        }
    },
    gather: {
        idle: (r, h, at) => CoopRun.WORKS.take.idle(r, h, at),
        done: (r, h, at) => {
            r.loot[at.li].holder = h.i;
            h.carry.push(at.li);
            r.event('take', CoopText.t('log.gather', { who: h, loot: r.M.loot[at.li].name }), h.i);
        }
    },
    // a whole vitrine: smash it (fast, loud) or unlock it (quiet); the item stays
    // in it for a take; a hero under a full load may do both (rules, section 10)
    smash: {
        idle: () => false,
        done: (r, h, at) => r.breakGlass(at.li, CoopText.t('log.smash', { who: h }), undefined, h.i)
    },
    unlock: {
        idle: (r, h, at) => r.loot[at.li].opened,
        done: (r, h, at) => {
            r.loot[at.li].opened = true;
            r.event('unlock', CoopText.t('log.unlock', { who: h, loot: r.M.loot[at.li].name }), h.i);
            if (r.M.loot[at.li].sensor && r.armed('sensors')) r.alarm(CoopText.t('log.unlock_sensor', { who: h }), h.i);
        }
    },
    drop: {
        idle: (r, h) => !h.carry.length,
        done: (r, h) => r.dropLoot(h)
    }
};
CoopRun.WORKS.hack = CoopRun.WORKS.pick;
