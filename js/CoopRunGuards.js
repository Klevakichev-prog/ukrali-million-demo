// CoopRunGuards.js — a part of CoopRun (CoopRun.js): the guards and the eyes of one execution. A
// guard's intent — his patrol or post, the chase, the panel put back on, a teammate untied, the
// exit held after an alarm (rules, section 8); guards keeping apart and going round each other;
// the noise that calls them. Vision: what guards and cameras see (a cone, walls and shut doors),
// a camera on while its panel is, the alarm by sight. Methods of the run, mixed into its prototype.

/** @satisfies {ThisType<CoopRun>} */
const CoopRunGuards = {
    guardIntent(g) {
        if (g.fly) return this.flyIntent(g);
        if (g.out || this.isDown(g) || this.isStunned(g)) return null;
        const C = CoopModel;
        const def = g.def;
        // from the tick of any alarm every guard on his feet drops his round or post and holds an
        // exit; on the way and there he steps into a hero standing next to him (rules, section 8)
        // — but the one who raised it finding a tied guard unties him first (rules, section 21)
        if (this.alarmT !== null && !['toExit', 'hold', 'toUntie', 'untie'].includes(g.state)) this.guardToExit(g);
        if (g.state === 'toExit' || g.state === 'hold') {
            const h = this.preyOf(g);
            if (h) return { to: [h.x, h.y], dir: this.dirTo(g.x, g.y, h.x, h.y), attack: true };
        }
        if (g.state === 'hold') {
            const p = this.exitOf(g);
            if (p) g.f = p.face;
            return null;
        }
        if (g.state === 'post') {
            const dark = def.post ? this.darkSince(def.id) : null;
            if (dark !== null && this.t + 1 - Math.max(dark, g.wokeAt || 0) >= C.OBJECTS.guard.dark_ticks) {
                // the dark is not an alarm (Ivan 25.10, rules, section 8): he goes to switch the
                // panel back on, checking everything on his way as always
                this.event('guard', CoopText.t('log.guard_dark', { who: def }));
                this.guardToPanel(g);
            } else return null;
        }
        // at the panel: its time goes while he stands in its cell; the switch itself — after the
        // moves (guardSwitchOn), as a hero's work ends after them (rules, section 3)
        if (g.state === 'panel') {
            if (--g.work <= 0) this.switching.push(g);
            return null;
        }
        // untying: its time goes while he stands next to him; the untie itself — after the moves (guardUntie)
        if (g.state === 'untie') {
            g.f = this.dirTo(g.x, g.y, g.untie.x, g.untie.y) || g.f;
            if (--g.work <= 0) this.untying.push(g);
            return null;
        }
        if (g.state === 'look') {
            if (--g.look <= 0) {
                g.state = 'back';
                this.guardGo(g, def.patrol ? def.patrol[g.idx] : def.post);
            } else if (g.look % 2 === 0) g.f = C.DIRS[(C.DIRS.indexOf(g.f) + 1) % 4];
            return null;
        }
        let next = null;
        // a stop of his round (Ivan 25.10, rules, section 8): he stands and looks to one side,
        // ahead, to the other side, ahead — a quarter turn a tick
        if (g.state === 'patrol' && g.stop > 0) {
            const n = C.OBJECTS.guard.stop_look_ticks, k = n - g.stop, i = C.DIRS.indexOf(g.ahead);
            g.f = k === 0 ? C.DIRS[(i + 3) % 4] : k === 2 ? C.DIRS[(i + 1) % 4] : g.ahead;
            g.stop--;
            return null;
        }
        if (g.state === 'patrol') {
            next = def.patrol[(g.idx + 1) % def.patrol.length];
        } else if (g.path && g.path.length) {
            next = g.path[0];
            // a wait of the path: he stands this tick, letting another guard by (rules, section 8)
            if (next[0] === g.x && next[1] === g.y) { g.path.shift(); return null; }
        } else {
            // reached the end of a path
            if (g.state === 'toExit') { g.state = 'hold'; const p = this.exitOf(g); if (p) g.f = p.face; return null; }
            if (g.state === 'investigate') { g.state = 'look'; g.look = C.OBJECTS.guard.look_ticks; return null; }
            if (g.state === 'toPanel') { g.state = 'panel'; g.work = C.OBJECTS.power_panel.on.ticks; return this.guardIntent(g); }
            if (g.state === 'toUntie') {
                if (!this.dirTo(g.x, g.y, g.untie.x, g.untie.y)) { this.guardToExit(g); return null; }
                g.state = 'untie';
                g.work = C.OBJECTS.guard.untie.ticks;
                return this.guardIntent(g);
            }
            // back at his post he watches the monitors again: a new dark is counted from now too
            if (g.state === 'back') { g.state = def.patrol ? 'patrol' : 'post'; if (!def.patrol) { g.f = def.facing; g.wokeAt = this.t; } return null; }
            return null;
        }
        const dir = this.dirTo(g.x, g.y, next[0], next[1]);
        if (!dir) { g.path = null; return null; }
        return { to: next, dir };
    },

    // Sends a guard to a cell (or next to it, when the cell itself is blocked). The way is the
    // shortest one, unless it meets another guard's trajectory: then the earliest way round in time
    // (rules, section 8). No way round yet — he stands this tick and tries again on the next.
    guardGo(g, to) {
        const M = this.M;
        g.goal = to;
        g.replan = false;
        let best = M.blocked.has(to[0] + ',' + to[1]) ? null : M.path([g.x, g.y], to, { guard: true, open: null });
        if (!best) {
            for (const d of CoopModel.DIRS) {
                const [dx, dy] = CoopModel.DELTA[d], q = [to[0] + dx, to[1] + dy];
                if (!M.inside(q[0], q[1]) || M.blocked.has(q[0] + ',' + q[1])) continue;
                const p = (q[0] === g.x && q[1] === g.y) ? [] : M.path([g.x, g.y], q, { guard: true, open: null });
                if (p && (!best || p.length < best.length)) best = p;
            }
        }
        if (!best) { g.path = []; return; }
        const end = best.length ? best[best.length - 1] : [g.x, g.y];
        const others = this.othersAhead(g), hold = this.holdAt(g);
        if (!this.meets(this.forecast(g, CoopModel.FORECAST_TICKS, best, hold), others, [g.x, g.y])) { g.path = best; return; }
        const around = this.pathAround(g, end, others, hold);
        if (around) { g.path = around; return; }
        g.path = [[g.x, g.y]];
        g.replan = true;
    },

    // How long a guard stands where his path ends: at an exit and back at his post — for good, at a
    // noise looking round, at the panel switching it on; back on his round — not at all.
    holdAt(g) {
        if (g.state === 'toExit') return CoopModel.FORECAST_TICKS;
        if (g.state === 'investigate') return CoopModel.OBJECTS.guard.look_ticks;
        if (g.state === 'toPanel') return CoopModel.OBJECTS.power_panel.on.ticks;
        if (g.state === 'panel') return g.work;
        if (g.state === 'toUntie') return CoopModel.OBJECTS.guard.untie.ticks;
        if (g.state === 'untie') return g.work;
        if (g.state === 'back' && !g.def.patrol) return CoopModel.FORECAST_TICKS;
        return 0;
    },

    // The cells a guard stands in at the end of the next n ticks — [0] is after this tick. A body
    // down or stunned stands until it is up, one knocked out or flying stands throughout; on his
    // round he follows it; on a path (or `path` given) he follows it, then stands `hold` ticks at
    // its end and, after that, is not forecast (null): he will build a new way then.
    forecast(g, n, path, hold) {
        const out = [], def = g.def, round = g.state === 'patrol' && !path, own = path || g.path || [];
        // how long he stands where his way ends (or where he stands now, with no way)
        let H = hold;
        if (H === undefined) {
            if (own.length) H = this.holdAt(g);
            else if (g.state === 'look') H = g.look;
            else H = n;
        }
        let x = g.x, y = g.y, idx = g.idx, i = 0, after = 0, steps = g.steps, stop = g.stop;
        const every = def.stopEvery, look = CoopModel.OBJECTS.guard.stop_look_ticks;
        let lie = (g.out || g.fly) ? n : Math.max(0, g.downUntil - this.t, g.stunUntil - this.t);
        for (let k = 0; k < n; k++) {
            if (lie > 0) lie--;
            else if (round && stop > 0) stop--;
            else if (round) {
                idx = (idx + 1) % def.patrol.length; [x, y] = def.patrol[idx];
                if (every && ++steps % every === 0) stop = look;
            }
            else if (i < own.length) [x, y] = own[i++];
            else if (++after > H) { out.push(null); continue; }
            out.push([x, y]);
        }
        return out;
    },

    // The forecasts of every other guard, with where each stands now.
    othersAhead(g) {
        return this.guards.filter(o => o !== g).map(o => ({ now: [o.x, o.y], cells: this.forecast(o, CoopModel.FORECAST_TICKS) }));
    },

    // Would a trajectory (from where the guard stands now) meet another one: the same cell on the
    // same tick, or two guards across one edge towards each other.
    meets(cells, others, from) {
        return others.some(o => cells.some((c, k) => {
            const p = o.cells[k];
            if (!c || !p) return false;
            if (c[0] === p[0] && c[1] === p[1]) return true;
            const c0 = k ? cells[k - 1] : from, p0 = k ? o.cells[k - 1] : o.now;
            return !!(c0 && p0 && c0[0] === p[0] && c0[1] === p[1] && p0[0] === c[0] && p0[1] === c[1]);
        }));
    },

    // The earliest way to `to` in time around the others' forecasts — a step or a wait a tick —
    // after which `to` stays free for `hold` ticks; the cells tick by tick (a wait repeats a cell).
    pathAround(g, to, others, hold) {
        const M = this.M, C = CoopModel, N = C.FORECAST_TICKS;
        const taken = (/** @type {number} */ k, /** @type {number[]} */ c, /** @type {number[]} */ c0) => others.some(o => {
            const p = o.cells[k], p0 = k ? o.cells[k - 1] : o.now;
            if (p && p[0] === c[0] && p[1] === c[1]) return true;
            return !!(p && p0 && p[0] === c0[0] && p[1] === c0[1] && p0[0] === c[0] && p0[1] === c[1]);
        });
        const key = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ k) => x + ',' + y + ',' + k;
        const prev = new Map([[key(g.x, g.y, -1), null]]);
        let queue = [[g.x, g.y, -1]];
        while (queue.length) {
            const next = [];
            for (const [x, y, k] of queue) {
                if (x === to[0] && y === to[1] && k >= 0) {
                    let free = true;
                    for (let j = k + 1; j <= Math.min(N - 1, k + hold) && free; j++) free = !taken(j, to, to);
                    if (free) {
                        const out = [];
                        for (let s = [x, y, k]; s && s[2] >= 0; s = prev.get(key(s[0], s[1], s[2]))) out.push([s[0], s[1]]);
                        return out.reverse();
                    }
                }
                if (k + 1 >= N) continue;
                for (const d of C.DIRS.concat([null])) {
                    const [dx, dy] = d ? C.DELTA[d] : [0, 0], q = [x + dx, y + dy];
                    if (d && !M.canStep(x, y, d, 'guard', null)) continue;
                    const kk = key(q[0], q[1], k + 1);
                    if (prev.has(kk) || taken(k + 1, q, [x, y])) continue;
                    prev.set(kk, [x, y, k]);
                    next.push([q[0], q[1], k + 1]);
                }
            }
            queue = next;
        }
        return null;
    },

    // Guards never meet (rules, section 8): every tick a guard on a way of his own checks it
    // against the others' forecasts and builds it anew when it would meet one. The order is the
    // level's, not the order the bodies are taken in: the outcome does not depend on it.
    guardsKeepApart() {
        for (const g of this.guards.slice().sort((a, b) => a.ord - b.ord)) {
            if (g.out || g.fly || g.state === 'patrol' || !g.goal) continue;
            if (!g.replan && !(g.path && g.path.length)) continue;
            if (g.replan || this.meets(this.forecast(g, CoopModel.FORECAST_TICKS), this.othersAhead(g), [g.x, g.y])) this.guardGo(g, g.goal);
        }
    },

    // The guards whose panel time ran out this tick switch it on (rules, section 8, Ivan 25.10) —
    // if they are still on their feet in its cell: knocked out or down in the moves, the switch is
    // lost. The light, the sensors, the lasers and the cameras of its list work again; then he goes
    // back to his post.
    guardSwitchOn() {
        for (const g of this.switching) {
            if (g.out || this.isDown(g) || this.isStunned(g) || g.state !== 'panel') continue;
            this.setPower(g.panel, true, CoopText.t('log.guard_power_on', { who: g.def, panel: this.M.panels[g.panel].name.toLowerCase() }));
            // another of his panels still off — on to it (rules, section 8: the nearest first, then the next)
            if (this.darkSince(g.def.id) !== null) this.guardToPanel(g);
            else { g.state = 'back'; this.guardGo(g, g.def.post); }
        }
        this.switching = [];
    },

    // The guard at the monitors goes to switch on the nearest of his panels that is off (darkPanels):
    // the shortest guard's way (rules, section 8), of equal ones — the first in the level.
    guardToPanel(g) {
        const M = this.M, len = (/** @type {number} */ i) => {
            const p = M.path([g.x, g.y], M.panels[i].at, { guard: true, open: null });
            return p ? p.length : Infinity;
        };
        const ids = this.darkPanels(g.def.id);
        g.panel = ids.reduce((a, i) => (len(i) < len(a) ? i : a), ids[0]);
        g.state = 'toPanel';
        this.guardGo(g, M.panels[g.panel].at);
    },

    // A knocked-out guard gets up where he lies, as after a fall (rules, section 8): the patrol
    // goes on from the next point of the round, Valera goes back to his post — and with the dark
    // still there for him (darkSince) his reaction starts anew from this tick (the dark time of the
    // objects config, then an alarm); after an alarm he goes to hold his exit.
    guardWake(g) {
        const def = g.def;
        g.out = false;
        g.outUntil = undefined;
        g.fd = null;
        g.stop = 0;
        // knocked out while going to untie or untying: he starts it over (rules, section 21)
        if (g.untie && g.untie.tied) this.guardToUntie(g, g.untie);
        else if (this.alarmT !== null) this.guardToExit(g);
        else if (def.patrol) { g.state = 'back'; this.guardGo(g, def.patrol[g.idx]); }
        else if (this.darkSince(def.id) !== null) { g.state = 'post'; g.wokeAt = this.t; }
        else { g.state = 'back'; this.guardGo(g, def.post); }
        this.event('guard', CoopText.t('log.guard_wakes', { who: def }), -1, this.t);
    },

    // A guard goes to untie a tied one (rules, section 21): to the cell next to him by an open edge
    // with the shortest guard's way (of equal ones — U, R, D, L); none — he holds his exit.
    guardToUntie(g, o) {
        const M = this.M;
        g.untie = o;
        g.state = 'toUntie';
        let best = null, len = Infinity;
        for (const d of CoopModel.DIRS) {
            const [dx, dy] = CoopModel.DELTA[d], q = [o.x + dx, o.y + dy];
            if (!M.inside(q[0], q[1]) || M.blocked.has(q[0] + ',' + q[1]) || !M.canStep(o.x, o.y, d, 'guard', null)) continue;
            const p = q[0] === g.x && q[1] === g.y ? [] : M.path([g.x, g.y], q, { guard: true, open: null });
            if (p && p.length < len) { best = q; len = p.length; }
        }
        if (!best) { g.untie = null; this.guardToExit(g); return; }
        this.guardGo(g, best);
    },

    // The guards whose untie time ran out this tick free the tied one — if they are still on their
    // feet untying: he gets up at once, not before his knockout would have ended; then both hold
    // the exits (rules, section 21).
    guardUntie() {
        for (const g of this.untying) {
            if (g.out || this.isDown(g) || this.isStunned(g) || g.state !== 'untie') continue;
            const o = g.untie;
            o.tied = false;
            o.outUntil = Math.max(o.knockEnd, this.t + 1);
            g.untie = null;
            this.event('guard', CoopText.t('log.guard_unties', { who: g.def, whom: o.def }));
            this.guardToExit(g);
        }
        this.untying = [];
    },

    // After a fall that moved the guard: find the way back to whatever he was doing.
    guardRecover(g) {
        const def = g.def;
        if (g.state === 'patrol') { g.state = 'back'; this.guardGo(g, def.patrol[g.idx]); }
        else if (g.state === 'post') { g.state = 'back'; this.guardGo(g, def.post); }
        else if (g.state === 'toExit' || g.state === 'hold') this.guardToExit(g);
        else if (g.state === 'toPanel' || g.state === 'panel') { g.state = 'toPanel'; this.guardGo(g, this.M.panels[g.panel].at); }
        else if (g.state === 'toUntie' || g.state === 'untie') this.guardToUntie(g, g.untie);
        else if (g.state === 'look') { g.state = 'back'; this.guardGo(g, def.patrol ? def.patrol[g.idx] : def.post); }
        else if (g.goal) this.guardGo(g, g.goal);
    },

    // A guard goes to hold his exit (rules, section 8); a level without one — he holds where he
    // stands. Back on the way after a fall he says nothing.
    guardToExit(g) {
        const p = this.exitOf(g), again = g.state === 'toExit' || g.state === 'hold';
        g.look = 0;
        if (!p) { g.state = 'hold'; g.path = null; g.goal = null; return; }
        g.state = 'toExit';
        this.guardGo(g, p.cell);
        // he goes from this moment, not before the alarm's (his own in this tick rings after it)
        if (!again) this.event('guard', CoopText.t('log.guard_to_exit', { who: g.def, door: this.M.doors[p.door].name }), -1, Math.max(this.t, this.alarmT || 0));
    },

    // The hero a guard after an alarm steps into (rules, section 8): next to him in a straight
    // line — through an open doorway too, not through a shut door — on his feet and not leaving
    // his cell this tick (standing, working, waiting); the first in the order of the crew.
    preyOf(g) {
        if (this.ghost) return null;   // the plan's ghost has no vision: nobody is attacked (rules, section 8)
        for (const h of this.heroes) {
            if (h.caught || this.isDown(h) || h.fly || h.slide || this.heroMoving.has(h) || this.M.isVan(h.x, h.y)) continue;
            // only one he sees: at his back or side a hero may knock him out (Ivan 25.10, rules, section 8)
            if (!this.sees(g, h.x, h.y)) continue;
            const d = this.dirTo(g.x, g.y, h.x, h.y);
            if (d && this.M.canStep(g.x, g.y, d, 'sight', this.doorOpen)) return h;
        }
        return null;
    },

    // After an alarm nobody goes to a noise: the guards hold the exits (rules, section 8).
    noise(x, y) {
        if (this.alarmT !== null) return;
        for (const g of this.guards) {
            if (g.out || this.isDown(g)) continue;
            if (Math.hypot(g.x - x, g.y - y) > this.M.noiseCells) continue;
            g.state = 'investigate';
            this.guardGo(g, [x, y]);
            this.event('guard', CoopText.t('log.guard_hears', { who: g.def }));
        }
    },

    // A guard who is down or stunned sees nothing.
    sees(g, x, y) {
        if (g.out || this.isDown(g) || this.isStunned(g)) return false;
        return this.inCone(g.x, g.y, CoopModel.ANGLE[g.f], g.def.fov, g.def.range, x, y);
    },

    inCone(ox, oy, angle, fov, range, x, y) {
        return this.M.inCone(ox, oy, angle, fov, range, x, y, this.doorOpen);
    },

    vision() {
        const C = CoopModel;
        for (const g of this.guards) {
            if (g.out || this.isDown(g) || this.isStunned(g)) continue;
            for (const h of this.heroes) {
                if (this.visible(h) && this.sees(g, h.x, h.y)) {
                    g.seen[h.i] = (g.seen[h.i] || 0) + 1;
                    if (g.seen[h.i] >= g.def.spot) this.alarm(CoopText.t('log.guard_spots', { who: g.def, hero: h.name }), h.i);
                } else g.seen[h.i] = 0;
            }
            for (const o of this.guards) {
                if (o === g || !o.out || !this.sees(g, o.x, o.y)) continue;
                if (!o.tied) this.alarm(CoopText.t('log.guard_body', { who: g.def, body: o.def }));
                // a tied one before the alarm: he raises it and unties him; after it bodies are not checked (rules, section 21)
                else if (this.alarmT === null && g.state !== 'toUntie' && g.state !== 'untie') {
                    this.alarm(CoopText.t('log.guard_tied', { who: g.def, body: o.def }));
                    this.guardToUntie(g, o);
                }
            }
        }
        const off = this.offStart(), at = (/** @type {number[][]} */ cells, /** @type {number} */ x, /** @type {number} */ y) => cells.some(c => c[0] === x && c[1] === y);
        for (const g of this.guards) {
            if (g.out || this.isDown(g) || this.isStunned(g)) continue;
            for (const o of off) {
                if (at(o.near, g.x, g.y) || o.see.some(c => this.sees(g, c[0], c[1]))) this.alarm(CoopText.t('log.guard_sees', { who: g.def, what: o.text }));
            }
        }
        this.M.cameras.forEach((c, ci) => {
            const seen = this.camSeen[ci];
            if (!this.camOn(c)) { for (const k in seen) seen[k] = 0; return; }
            const ang = this.cameraAngle(c);
            for (const h of this.heroes) {
                if (this.visible(h) && this.inCone(c.at[0], c.at[1], ang, c.fov, c.range, h.x, h.y)) {
                    seen[h.i] = (seen[h.i] || 0) + 1;
                    if (seen[h.i] >= C.OBJECTS.camera.spot_ticks) this.alarm(CoopText.t('log.cam_hero', { who: h }), h.i);
                } else seen[h.i] = 0;
            }
            for (const g of this.guards) {
                if (g.out && this.inCone(c.at[0], c.at[1], ang, c.fov, c.range, g.x, g.y)) this.alarm(CoopText.t(g.tied ? 'log.cam_tied' : 'log.cam_body', { body: g.def }));
            }
            // a camera is the guards' eyes: it checks the objects as a guard from afar (rules, section 8)
            for (const o of off) {
                if (o.see.some(p => this.inCone(c.at[0], c.at[1], ang, c.fov, c.range, p[0], p[1]))) this.alarm(CoopText.t('log.cam_sees', { what: o.text }));
            }
        });
    },

    // Whether a camera sees now (rules, section 8): it is not switched off with the panel, and a
    // local one has its watcher at the monitors — at his post, up; an online one needs nobody.
    camOn(c) {
        if (!this.armed(c.id)) return false;
        if (c.kind === 'online') return true;
        const g = this.guards.find(q => q.def.id === c.watcher);
        return !!g && !g.out && !this.isDown(g) && !this.isStunned(g) && g.state === 'post' && g.x === g.def.post[0] && g.y === g.def.post[1];
    },

    // The panels the guard at the monitors (guard id) sees off: their list has the light or a
    // camera he watches (a panel of only the sensors or the lasers he does not see, rules, section 20).
    darkPanels(id) {
        return this.M.panels.map((P, i) => i).filter(i => !this.power[i]
            && (this.M.panels[i].powers.has('light') || this.M.cameras.some(c => c.watcher === id && this.M.panels[i].powers.has(c.id))));
    },

    // Since when the guard at the monitors sees the dark: the earliest moment one of his panels
    // went off and stays off (darkPanels); null — he sees no dark.
    darkSince(id) {
        const ids = this.darkPanels(id);
        return ids.length ? Math.min(...ids.map(i => this.offAt[i])) : null;
    },

    // What is not as the level starts it (rules, section 8: the guards know the start, not the
    // history): [{ text, see — the cells that show it in sight, near — the
    // cells from which a guard notices it up close }]. A door shows in sight by the cells on both
    // sides of its doorway (a shut door hides the far one); its lock — only up close, from where a
    // hero works it (a gate — also its keypad). A vitrine: broken or empty — in sight, unlocked with
    // its item in — up close (the cells next to it). Loot out of a vitrine: gone from its place.
    offStart() {
        const M = this.M, D = CoopModel.DELTA, out = [];
        M.doors.forEach((d, i) => {
            const sides = d.cells.flatMap(([x, y, dir]) => [[x, y], [x + D[dir][0], y + D[dir][1]]]);
            const near = d.lock === 'electronic' && d.panelAt ? sides.concat([d.panelAt]) : sides;
            if (this.doorOpen[i] !== M.startOpen(i)) out.push({ text: CoopText.t(this.doorOpen[i] ? 'log.seen_door_open' : 'log.seen_door_shut', { door: d.name }), see: sides, near });
            else if (d.lock && this.doorUnlocked[i]) out.push({ text: CoopText.t('log.seen_lock', { door: d.name }), see: [], near });
        });
        M.loot.forEach((l, i) => {
            const L = this.loot[i], home = L.holder < 0 && !L.delivered && L.x === l.at[0] && L.y === l.at[1];
            // up close — from where a hero works it: not across a wall (found on level 3, 25.10)
            const near = l.glass ? CoopModel.DIRS.filter(dir => M.edges.get(M.edgeKey(l.at[0], l.at[1], dir)) !== 'wall').map(dir => [l.at[0] + D[dir][0], l.at[1] + D[dir][1]]) : [];
            if (l.glass && L.broken) out.push({ text: CoopText.t('log.seen_broken', { loot: l.name }), see: [l.at], near });
            else if (!home) out.push({ text: CoopText.t(l.glass ? 'log.seen_empty' : 'log.seen_gone', { loot: l.name }), see: [l.at], near });
            else if (l.glass && L.opened) out.push({ text: CoopText.t('log.seen_opened', { loot: l.name }), see: [], near });
        });
        return out;
    },
};
Object.assign(CoopRun.prototype, CoopRunGuards);
