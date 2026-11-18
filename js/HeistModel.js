// HeistModel.js — the rules of the heist without 3D, on a fixed step of one game second.
// Plan -> deterministic replay (the project decision): simulate(tracks) computes the whole
// execution from the tracks and a seed; the scene only replays the frames it returns.
//
// A track is a list of instructions of one person:
//   { op: 'move', dir: 'U' | 'R' | 'D' | 'L' }      one cell (or the stairs), 1 s
//   { op: 'do', verb, door?: index }                 an action on the object of the cell or a door
//   { op: 'wait', s }                                 s seconds
// The plan clock follows the original planner: doors are free, only durations add up.
// The execution follows the original game (research/levels/rules.json): locked doors block,
// alarm circuits (dwell and entry delays), cameras by schedule, guards on their rounds with
// sight and fights, the police patrol, the police after an alarm, FREEZE, retracing home and
// the getaway when everyone is back in the car.

/** @satisfies {Record<string, any>} */
const HeistModel = {
    DIRS: ['U', 'R', 'D', 'L'],
    DELTA: { U: [0, -1], R: [1, 0], D: [0, 1], L: [-1, 0] },
    BACK: { U: 'D', D: 'U', L: 'R', R: 'L' },
    PATROL_STAY: 7,
    MAX_SECONDS: 1800,

    // Small deterministic generator (mulberry32).
    rng(seed) {
        let a = seed >>> 0;
        return (n) => {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
            return Math.floor(r * (n + 1));   // 0..n
        };
    },

    create(levelId, opts) {
        const L = HEIST_LEVELS[levelId];
        const o = opts || {};
        const team = (o.team || HeistRules.DEFAULT_TEAM).slice(0, 4);
        return new HeistLevelModel(L, team, o.seed != null ? o.seed : levelId * 1000 + 7);
    }
};

class HeistLevelModel {
    constructor(L, team, seed) {
        this.L = L;
        this.id = L.id;
        this.team = team;
        this.people = team.concat(['boss']);
        this.seed = seed;
        this.W = L.width;
        this.H = L.height;
        this.start = L.start;
        this.cells = L.grid.map(r => r.split(' '));
        this.tele = new Map(L.teleports.map(t => [t[0] + ',' + t[1] + ',' + t[2], [t[3], t[4]]]));
        this.doorAt = new Map();
        L.doors.forEach((d, i) => this.doorAt.set(HeistLevelModel.edgeKey(d.a, d.b), i));
        this.objAt = new Map();
        L.objects.forEach((ob, i) => this.objAt.set(ob.x + ',' + ob.y, i));
        this.circuitByName = new Map(L.circuits.map(c => [c.name, c]));
        this.circuitByBit = new Map(L.circuits.map(c => [c.bit, c]));
    }

    static edgeKey(a, b) {
        const [p, q] = (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])) ? [a, b] : [b, a];
        return p[0] + ',' + p[1] + '|' + q[0] + ',' + q[1];
    }

    walkable(x, y) {
        return x >= 0 && y >= 0 && x < this.W && y < this.H && this.cells[y][x] !== '----';
    }

    // The plan graph: where a step from (x, y) leads, or null.
    move(x, y, dir) {
        if (!this.walkable(x, y)) return null;
        const c = this.cells[y][x][HeistModel.DIRS.indexOf(dir)];
        if (c === '1') { const d = HeistModel.DELTA[dir]; return [x + d[0], y + d[1]]; }
        if (c === 'T') return this.tele.get(x + ',' + y + ',' + dir) || null;
        return null;
    }

    // Shortest plan path (list of dirs) between two cells, or null.
    path(from, to) {
        const key = (p) => p[0] + ',' + p[1];
        const prev = new Map([[key(from), null]]);
        const queue = [from];
        while (queue.length) {
            const p = queue.shift();
            if (p[0] === to[0] && p[1] === to[1]) break;
            for (const d of HeistModel.DIRS) {
                const q = this.move(p[0], p[1], d);
                if (q && !prev.has(key(q))) { prev.set(key(q), [p, d]); queue.push(q); }
            }
        }
        if (!prev.has(key(to))) return null;
        const out = [];
        let k = key(to);
        while (prev.get(k)) { const [p, d] = prev.get(k); out.push(d); k = key(p); }
        return out.reverse();
    }

    zoneBits(x, y) {
        const row = this.L.zones[y];
        return row ? (parseInt(row[x], 16) || 0) << 4 : 0;
    }

    screenOf(x, y) { return [Math.floor(x / 5), Math.floor(y / 3)]; }

    // Doors touching a cell (indices).
    doorsOf(x, y) {
        const out = [];
        this.L.doors.forEach((d, i) => {
            if ((d.a[0] === x && d.a[1] === y) || (d.b[0] === x && d.b[1] === y)) out.push(i);
        });
        return out;
    }

    // What a person may do on a cell: [{ verb, type, door?, time, circuit? }].
    verbsAt(personId, x, y) {
        const person = HeistRules.person(personId);
        const out = [];
        const oi = this.objAt.get(x + ',' + y);
        if (oi != null) {
            const ob = this.L.objects[oi];
            const circuit = ob.type === 'alarm' ? (this.circuitByName.get(ob.controls) || {}).bit : undefined;
            for (const verb of HeistRules.VERBS[ob.type] || []) {
                if (!HeistRules.allowed(person, verb)) continue;
                if (verb === 'rob' && !ob.loot && ob.type !== 'painting') continue;
                out.push({ verb, type: ob.type, time: HeistRules.duration(person, verb, ob.type, this.id, circuit), circuit });
            }
        }
        for (const di of this.doorsOf(x, y)) {
            for (const verb of HeistRules.VERBS.door) {
                out.push({ verb, type: 'door', door: di, time: HeistRules.duration(person, verb, 'door', this.id) });
            }
        }
        if (personId === 'boss') out.push({ verb: 'freeze', type: 'team', time: HeistRules.TIMES.freeze });
        return out;
    }

    // Duration of an instruction in the plan.
    opTime(personId, x, y, ins) {
        if (ins.op === 'move') return 1;
        if (ins.op === 'wait') return ins.s;
        const v = this.verbsAt(personId, x, y).find(a => a.verb === ins.verb && (ins.door == null || a.door === ins.door));
        return v ? v.time : 0;
    }

    // Plan timeline: per person the cell at every plan second and the end time.
    plan(tracks) {
        const out = {};
        for (const id of this.people) {
            let [x, y] = this.start;
            let t = 0;
            const cells = [[x, y]];
            const marks = [];
            for (const ins of tracks[id] || []) {
                if (ins.op === 'move') {
                    const q = this.move(x, y, ins.dir);
                    if (!q) { marks.push({ t, bad: true }); continue; }
                    [x, y] = q;
                    t += 1;
                    cells.push([x, y]);
                } else {
                    const d = this.opTime(id, x, y, ins);
                    for (let i = 0; i < d; i++) cells.push([x, y]);
                    marks.push({ t, verb: ins.op === 'wait' ? 'wait' : ins.verb, d });
                    t += d;
                }
            }
            out[id] = { end: t, cells, marks, at: [x, y] };
        }
        return out;
    }

    // --- Execution ----------------------------------------------------------------

    simulate(tracks) {
        const L = this.L, R = HeistRules, rnd = HeistModel.rng(this.seed);
        const S = {
            t: 0,
            doors: L.doors.map(d => d.state),
            objects: L.objects.map(ob => ({
                locked: (HeistRules.VERBS[ob.type] || []).includes('pick'),
                open: false, robbed: false
            })),
            enabled: L.circuits.reduce((m, c) => m | c.bit, 0),
            pending: {},            // circuit bit -> second of the alarm
            alarmAt: null, policeAt: null,
            patrolAt: L.police.patrolBase != null ? L.police.patrolBase + rnd(63) : null,
            patrolFrom: null, patrolTo: null,
            freezeUntil: 0,
            events: [],
            outcome: null
        };
        const P = this.people.map((id, idx) => ({
            id, idx, person: R.person(id),
            x: this.start[0], y: this.start[1],
            track: (tracks[id] || []).slice(), ip: 0, cur: null, left: 0,
            stun: 0, done: false, back: [], returning: false,
            carry: [], dwell: {}, spotted: false, act: null
        }));
        const G = L.guards.map((g) => ({
            g, phase: 0, stun: 0,
            x: g.static ? g.static[0] : g.route[0][0], y: g.static ? g.static[1] : g.route[0][1]
        }));
        const frames = [];
        const log = (kind, who, extra) => S.events.push(Object.assign({ t: S.t, kind, who }, extra || {}));
        const snap = () => frames.push({
            t: S.t,
            people: P.map(p => ({ id: p.id, x: p.x, y: p.y, stun: p.stun, carry: p.carry.length, act: p.act, done: p.done })),
            guards: G.map(q => ({ x: q.x, y: q.y, stun: q.stun })),
            camera: this.cameraAt(S.t, S.enabled),
            doors: S.doors.slice(),
            objects: S.objects.map(o => ({ open: o.open, robbed: o.robbed, locked: o.locked })),
            enabled: S.enabled,
            alarmAt: S.alarmAt, policeAt: S.policeAt,
            patrol: S.patrolFrom != null && S.t >= S.patrolFrom && S.t < S.patrolTo,
            freeze: S.freezeUntil > S.t
        });
        const atCar = (p) => p.x === this.start[0] && p.y === this.start[1];
        const raise = (why, who) => {
            if (S.alarmAt != null) return;
            S.alarmAt = S.t;
            const [base, span] = L.police.afterAlarm;
            S.policeAt = S.t + base + rnd(span);
            log('alarm', who, { why, police: S.policeAt });
        };

        // Initial state: guards on their round at second 0.
        this.moveGuards(G, 0, null, log);
        snap();

        while (!S.outcome && S.t < HeistModel.MAX_SECONDS) {
            S.t++;
            const frozen = S.freezeUntil >= S.t;
            for (const p of P) { this.stepPerson(p, S, frozen, log); this.finishIfHome(p); }
            this.checkAlarms(P, S, raise, log);
            const moved = this.moveGuards(G, S.t, P, log);
            this.checkGuards(P, G, S, moved, raise, log);
            // The police patrol passes along the street.
            if (S.patrolAt != null && S.t >= S.patrolAt && S.patrolFrom == null) {
                const street = this.screenOf(this.start[0], this.start[1])[1];
                const seen = P.some(p => this.screenOf(p.x, p.y)[1] === street);
                S.patrolFrom = S.t + (seen ? 5 + rnd(3) : 2);
                S.patrolTo = S.patrolFrom + HeistModel.PATROL_STAY;
                log('patrol', null, { from: S.patrolFrom });
            }
            if (S.patrolFrom != null && S.t >= S.patrolFrom && S.t < S.patrolTo && S.freezeUntil < S.t) {
                S.outcome = 'caught';
                log('caught', null, { by: 'patrol' });
            }
            if (S.patrolTo != null && S.t >= S.patrolTo) {
                S.patrolAt = L.police.rearmBase != null ? S.t + L.police.rearmBase + rnd(63) : null;
                S.patrolFrom = S.patrolTo = null;
            }
            if (!S.outcome && S.policeAt != null && S.t >= S.policeAt) {
                S.outcome = 'caught';
                log('caught', null, { by: 'police' });
            }
            if (!S.outcome && P.every(p => p.done && p.stun === 0 && atCar(p))) {
                S.outcome = 'escaped';
                log('getaway', null);
            }
            snap();
        }
        if (!S.outcome) S.outcome = 'timeout';
        return { frames, events: S.events, result: this.result(P, S) };
    }

    // Active camera screen at second t (null — none, or the camera circuit is off).
    cameraAt(t, enabled) {
        const c = this.L.cameras;
        if (!c || !(enabled & 0x10)) return null;
        const n = c.screens.length;
        const step = Math.floor(t / c.step) % n;   // step k covers seconds [k·step, (k+1)·step)
        return c.screens[step];
    }

    // Guards walk their rounds. A guard about to step into an intruder's cell fights him
    // instead of stepping (the emulator: the round then runs one second late).
    moveGuards(G, t, P, log) {
        const moved = [];
        G.forEach((q, gi) => {
            if (q.stun > 0) { q.stun--; moved.push(null); return; }
            if (q.g.static) { moved.push(null); return; }
            const r = q.g.route, n = r.length;
            const i = ((t - q.g.t0 - q.phase) % n + n) % n;
            const to = r[i];
            const hit = P ? P.find(p => p.stun === 0 && p.x === to[0] && p.y === to[1] &&
                !(p.x === this.start[0] && p.y === this.start[1])) : null;
            if (hit && (to[0] !== q.x || to[1] !== q.y)) {
                q.phase += 1;
                this.fight(hit, q, gi, log);
                moved.push(null);
                return;
            }
            const from = [q.x, q.y];
            q.x = to[0];
            q.y = to[1];
            moved.push(from[0] !== q.x || from[1] !== q.y ? from : null);
        });
        return moved;
    }

    fight(p, q, gi, log) {
        if (HeistRules.strength(p.person) < q.g.strength) {
            p.stun = HeistRules.knockout(p.person);
            p.cur = null;
            log('knocked-out', p.id, { guard: gi, s: p.stun });
        } else {
            q.stun = q.g.knockout;
            q.phase += q.g.knockout;
            log('guard-out', p.id, { guard: gi, s: q.stun });
        }
    }

    stepPerson(p, S, frozen, log) {
        p.act = null;
        if (p.stun > 0) { p.stun--; return; }
        if (p.done || frozen) return;
        if (!p.cur) {
            if (p.ip < p.track.length) {
                p.cur = p.track[p.ip++];
                p.left = p.cur.op === 'wait' ? p.cur.s : p.cur.op === 'do' ? this.opTime(p.id, p.x, p.y, p.cur) : 1;
            } else if (!(p.x === this.start[0] && p.y === this.start[1]) && p.back.length) {
                p.returning = true;
                p.cur = { op: 'move', dir: HeistModel.BACK[p.back[p.back.length - 1]], retrace: true };
                p.left = 1;
            } else {
                p.done = true;
                return;
            }
        }
        const c = p.cur;
        if (c.op === 'move') {
            const q = this.move(p.x, p.y, c.dir);
            if (!q) { log('bad-move', p.id); p.cur = null; return; }
            const di = this.doorAt.get(HeistLevelModel.edgeKey([p.x, p.y], q));
            if (di != null && S.doors[di] === 'locked') {
                p.act = 'blocked';
                if (!p.blockedAt) { p.blockedAt = S.t; log('blocked', p.id, { door: di }); }
                return;
            }
            p.blockedAt = null;
            if (di != null && S.doors[di] === 'closed') S.doors[di] = 'open';
            if (c.retrace) p.back.pop(); else p.back.push(c.dir);
            p.x = q[0];
            p.y = q[1];
            p.act = 'move';
            p.cur = null;
            return;
        }
        if (c.op === 'wait') {
            p.act = 'wait';
            if (--p.left <= 0) p.cur = null;
            return;
        }
        p.act = c.verb;
        if (--p.left > 0) return;
        this.applyVerb(p, c, S, log);
        p.cur = null;
    }

    // A track that ended in the car is done in the same second.
    finishIfHome(p) {
        if (!p.cur && p.stun === 0 && p.ip >= p.track.length && p.x === this.start[0] && p.y === this.start[1]) p.done = true;
    }

    applyVerb(p, c, S, log) {
        if (c.door != null) {
            const st = S.doors[c.door];
            if (c.verb === 'pick' && st === 'locked') S.doors[c.door] = 'closed';
            if (c.verb === 'lock') S.doors[c.door] = 'locked';
            if (c.verb === 'open' && st !== 'locked') S.doors[c.door] = 'open';
            if (c.verb === 'close' && st === 'open') S.doors[c.door] = 'closed';
            return;
        }
        if (c.verb === 'freeze') {
            S.freezeUntil = S.t + HeistRules.TIMES.freeze;
            log('freeze', p.id, { until: S.freezeUntil });
            return;
        }
        const oi = this.objAt.get(p.x + ',' + p.y);
        if (oi == null) return;
        const ob = this.L.objects[oi], os = S.objects[oi];
        if (c.verb === 'pick') os.locked = false;
        else if (c.verb === 'lock') os.locked = true;
        else if (c.verb === 'open') { if (!os.locked) os.open = true; else log('still-locked', p.id); }
        else if (c.verb === 'close') os.open = false;
        else if (c.verb === 'smash' || c.verb === 'blow') { os.open = true; os.locked = false; }
        else if (c.verb === 'rob') {
            const ready = ob.type === 'painting' || os.open;
            if (!ready) { log('rob-closed', p.id); return; }
            if (ob.loot && !os.robbed) { p.carry.push(oi); os.robbed = true; log('rob', p.id, { obj: oi, price: ob.loot.price }); }
        } else if (c.verb === 'disable' || c.verb === 'enable') {
            const cb = this.circuitByName.get(ob.controls);
            if (!cb) return;
            if (c.verb === 'disable') { S.enabled &= ~cb.bit; delete S.pending[cb.bit]; }
            else S.enabled |= cb.bit;
            log(c.verb, p.id, { circuit: cb.name });
        }
    }

    checkAlarms(P, S, raise, log) {
        const cam = this.cameraAt(S.t, S.enabled);
        for (const p of P) {
            const bits = this.zoneBits(p.x, p.y) & S.enabled;
            for (const c of this.L.circuits) {
                if (c.kind === 'dwell') {
                    if (bits & c.bit) {
                        p.dwell[c.bit] = (p.dwell[c.bit] || 0) + 1;
                        // The original counts the entry second too: the alarm comes one second later.
                        if (p.dwell[c.bit] > c.delay) raise(c.name, p.id);
                    } else p.dwell[c.bit] = 0;
                } else if (c.kind === 'entry' && (bits & c.bit) && S.pending[c.bit] == null) {
                    S.pending[c.bit] = S.t + c.delay;
                    log('tripped', p.id, { circuit: c.name, at: S.pending[c.bit] });
                }
            }
            if (cam) {
                const sc = this.screenOf(p.x, p.y);
                if (sc[0] === cam[0] && sc[1] === cam[1] && !(p.x === this.start[0] && p.y === this.start[1])) raise('camera', p.id);
            }
        }
        for (const [bit, at] of Object.entries(S.pending)) {
            if (at <= S.t && (S.enabled & Number(bit))) raise(this.circuitByBit.get(Number(bit)).name, null);
        }
    }

    checkGuards(P, G, S, moved, raise, log) {
        G.forEach((q, gi) => {
            if (q.stun > 0) return;
            const gs = this.screenOf(q.x, q.y);
            for (const p of P) {
                if (p.stun > 0) continue;
                const ps = this.screenOf(p.x, p.y);
                if (ps[0] === gs[0] && ps[1] === gs[1]) {
                    if (!p.spotted) { p.spotted = true; log('spotted', p.id, { guard: gi }); }
                    if (this.L.guardSightAlarm) raise('guard', p.id);
                }
                if (p.x === q.x && p.y === q.y && !(p.x === this.start[0] && p.y === this.start[1])) this.fight(p, q, gi, log);
            }
            // Guards check the doors on their round.
            const from = moved[gi];
            if (this.L.guardDoorCheck && from) {
                const di = this.doorAt.get(HeistLevelModel.edgeKey(from, [q.x, q.y]));
                if (di != null && S.doors[di] !== this.L.doors[di].state) raise('door', null);
            }
        });
    }

    result(P, S) {
        const escaped = S.outcome === 'escaped';
        const loot = {};
        let take = 0;
        for (const p of P) {
            const sum = p.carry.reduce((a, oi) => a + this.L.objects[oi].loot.price, 0);
            loot[p.id] = sum;
            if (escaped) take += sum;
        }
        return {
            outcome: S.outcome, t: S.t, loot, take,
            split: escaped ? HeistRules.split(take, this.team) : null,
            alarmAt: S.alarmAt, policeAt: S.policeAt
        };
    }
}
