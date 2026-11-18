// CoopRunClash.js — a part of CoopRun (CoopRun.js): the resolution of a tick (the rule set of
// collisions, ../design/rules/rules.html). The intents of all bodies judged as events — a cell claimed
// by two or more, a swap, a step into an occupied cell — by the ratio of the masses; the outcome
// settled: who enters, who is stunned, knocked along his lane, flies, lands, falls and drops his
// load; what a body arriving in a cell sets off and the log of it. Methods of the run, mixed into its prototype.

/** @satisfies {ThisType<CoopRun>} */
const CoopRunClash = {
    // movers: [{ body, to, dir, fly?, slide? }] — the bodies that step this tick. Events are
    // found and judged on sets, so the outcome does not depend on the order of the bodies.
    resolve(movers) {
        const M = this.M;
        if (this.ghost) {
            this.place(movers.map(m => ({ m, b: m.body, to: m.to, how: m.fly ? 'fly' : 'step' })));
            return;
        }
        if (this.reverse) movers = movers.slice().reverse();
        const key = (p) => p[0] + ',' + p[1];
        const ctx = { movers, key, at: new Map(), moverOf: new Map(), claims: new Map(), primary: new Set(), swaps: [] };
        for (const b of this.bodies()) if (!M.isVan(b.x, b.y)) ctx.at.set(key([b.x, b.y]), b);
        for (const m of movers) {
            m.from = [m.body.x, m.body.y];
            ctx.moverOf.set(m.body, m);
            if (M.isVan(m.to[0], m.to[1])) continue;     // nobody collides in the van
            const k = key(m.to);
            if (!ctx.claims.has(k)) ctx.claims.set(k, []);
            ctx.claims.get(k).push(m);
        }
        for (const g of ctx.claims.values()) if (g.length > 1) g.forEach(m => ctx.primary.add(m));
        for (const m of movers) {
            const o = ctx.at.get(key(m.to)), om = o && ctx.moverOf.get(o);
            if (om && !M.isVan(m.from[0], m.from[1]) && om.to[0] === m.from[0] && om.to[1] === m.from[1] && m.body.ord < o.ord) {
                ctx.swaps.push([m, om]);
                ctx.primary.add(m);
                ctx.primary.add(om);
            }
        }
        // A step behind a body that leaves by an event (wins and enters, is knocked out of its
        // cell) passes; whether it leaves depends on the events, so the tick is judged again with
        // the bodies gone by events until nothing changes. The first pass is without the hits.
        let res = this.judgeTick(ctx, null);
        for (let i = 0; i < 8; i++) {
            const next = this.judgeTick(ctx, res.gone);
            const same = next.gone.size === res.gone.size && [...next.gone].every(([b, g]) => res.gone.has(b) && res.gone.get(b).cell === g.cell);
            res = next;
            if (same) break;
        }
        this.settle(ctx, res);
    },

    // One pass of the judgement. gone — bodies that leave their cells by events (body ->
    // { cell: key of the cell it goes to, by: the bodies of its events }), null for the first
    // pass without the hits into standing bodies.
    judgeTick(ctx, gone) {
        const M = this.M, C = CoopModel, key = ctx.key;
        const withHits = !!gone;
        const G = gone || new Map();
        // o leaves its cell by an event that m is not in (the one who knocks a body out does not
        // follow it, he enters as the winner), and not into m's cell (no passing through each other)
        const goneFrom = (o, m) => G.has(o) && G.get(o).cell !== key(m.from) && !G.get(o).by.has(m.body);
        const memo = new Map();
        // does mover m step without an event: its cell is free or its owner leaves (a rotation too)
        const steps = (m) => {
            if (ctx.primary.has(m)) return false;
            if (M.isVan(m.to[0], m.to[1])) return true;
            if (memo.has(m)) { const v = memo.get(m); return v === null ? true : v; }
            memo.set(m, null);
            const o = ctx.at.get(key(m.to)), om = o && ctx.moverOf.get(o);
            const r = !o || goneFrom(o, m) || (!!om && steps(om));
            memo.set(m, r);
            return r;
        };
        const byOrd = (a, b) => a.b.ord - b.b.ord;
        const events = [];
        for (const [k, g] of ctx.claims) {
            if (g.length < 2) continue;
            const parts = g.map(m => ({ b: m.body, m }));
            const o = ctx.at.get(k), om = o && ctx.moverOf.get(o);
            // the owner of the cell who claimed a step but did not leave counts as standing
            if (o && !(om && steps(om))) parts.push({ b: o, m: null });
            events.push({ type: 'heap', parts: parts.sort(byOrd) });
        }
        for (const [a, b] of ctx.swaps) events.push({ type: 'swap', parts: [{ b: a.body, m: a }, { b: b.body, m: b }].sort(byOrd) });
        if (withHits) {
            for (const m of ctx.movers) {
                if (ctx.primary.has(m) || steps(m)) continue;
                events.push({ type: 'hit', parts: [{ b: m.body, m }, { b: ctx.at.get(key(m.to)), m: null }] });
            }
        }
        events.sort((a, b) => a.parts[0].b.ord - b.parts[0].b.ord || a.parts.length - b.parts.length || a.type.localeCompare(b.type)
            || a.parts[1].b.ord - b.parts[1].b.ord);
        for (const e of events) this.judge(e, ctx);
        // a body in two events at once falls where it stands and lies the longer of the two
        const per = new Map();
        for (const e of events) for (const [b, o] of e.res) { if (!per.has(b)) per.set(b, []); per.get(b).push(o); }
        const fin = new Map();
        for (const [b, list] of per) {
            if (list.length === 1) { fin.set(b, list[0]); continue; }
            const ko = list.find(o => o.ko);
            if (ko) { fin.set(b, ko); continue; }
            const top = list.reduce((s, o) => ((o.n || 0) > (s.n || 0) ? o : s), list[0]);
            fin.set(b, { type: 'fall', n: Math.max(...list.map(o => o.n || 0)), side: top.side || top.dir });
        }
        // the first cell of a flight in the tick of the blow: steppable, claimed by no mover,
        // wanted by no other knocked body, its owner absent or stepping out
        const want = new Map(), cand = new Map();
        for (const [b, o] of fin) {
            if (o.type !== 'knock' || !o.dir || !M.canStep(b.x, b.y, o.dir, 'hero', this.doorOpen)) continue;
            const [dx, dy] = C.DELTA[o.dir], c = [b.x + dx, b.y + dy];
            cand.set(b, c);
            want.set(key(c), (want.get(key(c)) || 0) + 1);
        }
        const fly = new Map();
        for (const [b, c] of cand) {
            const k = key(c);
            if (want.get(k) > 1 || ctx.claims.has(k)) continue;
            const o = M.isVan(c[0], c[1]) ? null : ctx.at.get(k), om = o && ctx.moverOf.get(o);
            if (o && !(om && steps(om) && key(om.to) !== key([b.x, b.y]))) continue;
            fly.set(b, c);
        }
        // a winner enters the cell only when it is empty after the event
        const ent = new Map();
        const enters = (b) => {
            if (ent.has(b)) return ent.get(b) === true;
            ent.set(b, false);
            const m = ctx.moverOf.get(b), o = ctx.at.get(key(m.to)), om = o && ctx.moverOf.get(o);
            const r = !o || (fly.has(o) && key(fly.get(o)) !== key(m.from)) || (!!om && steps(om))
                || (fin.has(o) && fin.get(o).type === 'win' && enters(o));
            ent.set(b, r);
            return r;
        };
        const out = new Map();
        const by = (b) => new Set(events.filter(e => e.res.has(b)).flatMap(e => e.parts.map(p => p.b)));
        for (const [b, o] of fin) {
            if (o.type === 'win' && enters(b)) out.set(b, { cell: key(ctx.moverOf.get(b).to), by: by(b) });
            else if (fly.has(b)) out.set(b, { cell: key(fly.get(b)), by: by(b) });
        }
        return { events, fin, fly, enters, steps, gone: out };
    },

    // The outcome of one event for each of its bodies (e.res: body -> outcome):
    //   win { } — the heavy one, enters the cell if it is empty after the event, stunned there;
    //   stun { } — stays on its feet in its cell; knock { dir, n, side } — knocked n cells
    //   (dir null — falls where it stands); fall { n } — falls where it stands;
    //   ko — a guard knocked out; halt — the hero who knocked him out stops.
    judge(e, ctx) {
        const C = CoopModel;
        e.res = new Map();
        const ps = e.parts;
        const guard = ps.find(p => this.isGuard(p.b) && !p.b.out), hero = ps.find(p => !this.isGuard(p.b));
        // the attack of a guard after an alarm — the mirror of a takedown (rules, section 8): his
        // force 2.5 against 1.5 x (the hero's mass + load) knocks the hero out, else fells him where
        // he stands; the guard stays in his cell, the table of masses is not used
        if (ps.length === 2 && guard && hero && guard.m && guard.m.attack && !hero.m) {
            const G = C.OBJECTS.guard, strong = hero.b.skills.includes('force');
            e.attack = true;
            e.res.set(guard.b, { type: 'strike' });
            e.res.set(hero.b, { type: 'fall', n: 0, side: guard.m.dir, lie: strong ? G.knockout_hero_force_ticks : G.knockout_hero_ticks, ko: true });
            return;
        }
        // a hero moving into a guard no longer knocks him out (Ivan 25.10, rules, section 22): it is
        // a touch — an alarm and the table
        e.alarm = !!(guard && hero);
        // the table of two against the heaviest; two or more heaviest are close to each other
        const top = Math.max(...ps.map(p => this.massOf(p.b)));
        const tops = ps.filter(p => this.massOf(p.b) === top);
        const ref = tops.find(p => !p.m) || tops[0];
        const res = new Map(ps.map(p => [p, []]));
        for (const p of ps) {
            if (tops.includes(p)) continue;
            const [a, b] = this.pair(ref, p);
            res.get(p).push(b);
            res.get(ref).push(a);
        }
        for (let i = 0; i < tops.length; i++) {
            for (let j = i + 1; j < tops.length; j++) {
                const [a, b] = this.pair(tops[i], tops[j]);
                res.get(tops[i]).push(a);
                res.get(tops[j]).push(b);
            }
        }
        for (const p of ps) {
            const list = res.get(p);
            let o;
            if (tops.includes(p)) {
                // the heaviest enters only when it has knocked everybody else
                const knock = list.find(x => x.type === 'knock');
                o = knock || (list.every(x => x.type === 'win') ? { type: 'win' } : { type: 'stun' });
                if (o.type === 'win' && !p.m) o = { type: 'stun' };
            } else o = list[0];
            e.res.set(p.b, this.asFlier(p, o));
        }
    },

    // Two bodies of an event, each moving (part.m) or standing: [outcome of a, outcome of b].
    pair(a, b) {
        const C = CoopModel, ma = this.massOf(a.b), mb = this.massOf(b.b);
        const [H, L] = ma >= mb ? [a, b] : [b, a];
        const ratio = this.massOf(H.b) / this.massOf(L.b);
        const order = (oh, ol) => (H === a ? [oh, ol] : [ol, oh]);
        if (ratio < C.KNOCK_1) {
            const stun = { type: 'stun' };
            if (a.m && b.m) return [stun, stun];
            // a mover into a standing body of close mass falls where it stands, as after a flight
            // of a cell (Ivan: nobody bounces off a standing body)
            const mv = a.m ? a : b, back = { type: 'knock', dir: null, n: 1, side: C.BACK[mv.m.dir], close: true };
            return a.m ? [back, stun] : [stun, back];
        }
        const n = ratio >= C.KNOCK_3 ? 3 : ratio >= C.KNOCK_2 ? 2 : 1;
        let dir;
        if (!L.m) dir = H.m.dir;                                    // the heavy one into the light one's cell
        else if (H.m && H.m.dir === C.BACK[L.m.dir]) dir = C.BACK[L.m.dir];    // head-on: thrown back
        else dir = null;                                            // into a standing heavy one or across its lane: falls where it stands
        // falling where it stands it keeps to its lane (Ivan: nobody changes lanes): back against its
        // own way, facing what it ran into, also when the blow came across
        return order(H.m ? { type: 'win' } : { type: 'stun' }, { type: 'knock', dir, n, side: dir || C.BACK[L.m.dir] });
    },

    // A flying body in an event: it does not stand stunned, it falls; knocked back by a heavier
    // one it bounces once a flight, the second time it falls; at a close one it falls.
    asFlier(p, o) {
        if (!p.m || !p.m.fly) return o;
        const C = CoopModel, f = p.b.fly;
        if (o.type === 'stun' || (o.type === 'knock' && o.close)) return { type: 'fall', n: 0, side: f.dir };
        if (o.type === 'knock' && o.dir === C.BACK[f.dir] && !f.bounced) return Object.assign({}, o, { bounce: true });
        if (o.type === 'knock') return { type: 'fall', n: o.n, side: o.side };
        return o;
    },

    // Applies the judged tick: steps, winners entering, first cells of flights, falls, stuns.
    settle(ctx, R) {
        const C = CoopModel;
        const moves = [];
        for (const m of ctx.movers) if (!R.fin.has(m.body) && R.steps(m)) moves.push({ m, b: m.body, to: m.to, how: m.fly ? 'fly' : 'step' });
        // The touch of a crash (the view; Ivan: the bodies touch first, then the crash plays): the
        // movers of an event go a cell a tick until the first two of them touch (contactOf); by
        // then the losers have gone kc into the cell and go back, the bodies that stood stay put
        // and only then fly; everybody's reaction (falling, rocking, flying) starts at kc.
        for (const e of R.events) {
            const kc = this.contactOf(e);
            for (const p of e.parts) {
                const o = R.fin.get(p.b);
                p.b.kc = kc;
                if (!p.m) { if (R.fly.has(p.b)) this.hold(p.b, kc); continue; }
                if (o.type === 'win' && R.enters(p.b)) continue;
                this.lunge(p.b, p.m.dir, kc, kc);
                // a step that did not get in still turned him its way (a flier keeps facing the blow)
                if (!p.m.fly && !p.b.fly) p.b.f = p.m.dir;
            }
        }
        const landing = [];
        // where a stunned body is pushed (the view rocks it that way, away from the blow): one who
        // moved recoils against his way, one who stood goes along the way of who hit him
        const pushed = (b) => {
            const e = R.events.find(x => x.parts.some(q => q.b === b));
            const me = e && e.parts.find(q => q.b === b), by = e && e.parts.find(q => q.m && q.b !== b);
            return me && me.m ? C.BACK[me.m.dir] : by ? by.m.dir : null;
        };
        for (const [b, o] of [...R.fin].sort((x, y) => x[0].ord - y[0].ord)) {
            const m = ctx.moverOf.get(b);
            if (o.type === 'win') {
                if (R.enters(b)) moves.push({ m, b, to: m.to, how: b.fly ? 'flywin' : 'win' });
                else if (b.fly) landing.push(b);
                if (!b.fly) this.stun(b, pushed(b));
            } else if (o.type === 'stun') this.stun(b, pushed(b));
            else if (o.type === 'knock') {
                const bounced = !!o.bounce;
                this.knock(b, o.n, o.side);
                if (R.fly.has(b)) {
                    b.fly = { dir: o.dir, left: o.n, bounced };
                    moves.push({ m: null, b, to: R.fly.get(b), how: 'fly' });
                } else landing.push(b);
            } else if (o.type === 'fall') {
                this.knock(b, o.n, o.side, o.lie);
                landing.push(b);
            }
        }
        this.place(moves);
        for (const b of landing) this.land(b);
        for (const e of R.events) this.tell(e, R);
    },

    // Moves the bodies at once, then what each one meets on arrival (in the order of the bodies).
    place(moves) {
        moves = moves.slice().sort((x, y) => x.b.ord - y.b.ord);
        const from = moves.map(v => [v.b.x, v.b.y]);
        for (const v of moves) {
            v.b.x = v.to[0]; v.b.y = v.to[1];
            v.b.rest = null;
            this.trail(v.b);
            if (v.how !== 'fly' && v.m) v.b.f = v.m.dir;     // a knocked body keeps facing the blow
        }
        moves.forEach((v, i) => this.arrive(v, from[i]));
    },

    arrive(v, from) {
        const b = v.b, M = this.M;
        if (this.isGuard(b)) {
            if (v.how === 'step' || v.how === 'win') {
                if (b.state === 'patrol') {
                    b.idx = (b.idx + 1) % b.def.patrol.length;
                    b.steps++;
                    if (b.def.stopEvery && b.steps % b.def.stopEvery === 0) { b.stop = CoopModel.OBJECTS.guard.stop_look_ticks; b.ahead = b.f; }
                }
                else if (b.path && b.path.length) b.path.shift();
            }
        } else {
            const h = b, dir = this.dirTo(from[0], from[1], h.x, h.y);
            if (h.path && h.path.length && h.path[0][0] === h.x && h.path[0][1] === h.y) h.path.shift();
            // lasers: any hero's body, walking, flying or sliding (a door's sensor rings as it opens: openDoor)
            if (this.armed('lasers') && M.lasers.has(h.x + ',' + h.y)) {
                this.alarm(CoopText.t(v.how === 'fly' ? 'log.laser_fly' : 'log.laser_touch', { who: h }), h.i);
            }
            if (v.how === 'step') {
                if (M.isWet(h.x, h.y)) {
                    if (!h.slide) this.event('slip', CoopText.t('log.slip', { who: h }), h.i);
                    h.slide = v.m.dir;
                } else if (h.slide) { h.slide = null; h.path = null; }
            }
            if (M.isVan(h.x, h.y) && h.carry.length) {
                for (const li of h.carry) {
                    const L = this.loot[li], def = M.loot[li];
                    L.delivered = true; L.holder = -1; L.x = h.x; L.y = h.y;
                    this.event('deliver', CoopText.t('log.deliver', { who: h, loot: def.name, worth: CoopText.num(this.worth(li)) }), h.i);
                }
                h.carry = [];
            }
        }
        if (v.how === 'fly' && b.fly) {
            b.flew = true;
            // over the wet floor it flies on to the first dry cell, a tick for each extra cell
            if (--b.fly.left <= 0) {
                if (M.isWet(b.x, b.y)) { b.fly.left = 1; b.downUntil++; }
                else this.land(b);
            }
        } else if (v.how === 'flywin') {
            b.flew = true;
            this.land(b);
        }
    },

    // A blow that knocks a body down: it lies until max(old, now + n + lie) — n is the flight it
    // gets (falling where it stands it lies just as long), lie — LIE_TICKS but for a guard's attack.
    // side — where it falls to (the view), set by the first blow only.
    knock(b, n, side, lie) {
        if (!this.isDown(b)) b.fd = side;
        b.downUntil = Math.max(b.downUntil, this.t + n + (lie === undefined ? CoopModel.LIE_TICKS : lie));
        b.stunUntil = 0;
        b.fly = null;
        b.rest = null;
        if (!b.knockFrom) b.knockFrom = [b.x, b.y];
        if (!this.isGuard(b)) this.fallHero(b);
    },

    // The end of a flight (or a fall where it stands): a hero drops all his loot there, a guard
    // moved off his way finds it back.
    land(b) {
        b.fly = null;
        if (!this.isGuard(b)) {
            if (b.carry.length) {
                this.event('drop', CoopText.t('log.drop', { who: b, loot: b.carry.map(li => this.M.loot[li].name).join(', ') }), b.i);
                this.dropLoot(b);
            }
        } else if (!b.out && b.knockFrom && (b.knockFrom[0] !== b.x || b.knockFrom[1] !== b.y)) this.guardRecover(b);
        b.knockFrom = null;
    },

    // A hero knocked down loses his work: the panel and a take start over, a lock loses half its
    // progress (rounded down). His loot falls when he lands.
    fallHero(h) {
        h.slide = null;
        h.path = null;
        h.wait = -1;
        if (h.busy) {
            const st = h.plan[h.pc], j = st && st.verb ? this.M.job(st.verb, st.target) : null;
            if (j && j.lock === 'door') {
                const di = this.M.doors.findIndex(d => d.id === st.target);
                if (di >= 0 && !this.doorOpen[di]) this.doorProg[di] = Math.floor(this.doorProg[di] / 2);
            }
            if (j && j.lock === 'relock') {
                const di = this.M.doors.findIndex(d => d.id === st.target);
                if (di >= 0) this.doorLockProg[di] = Math.floor(this.doorLockProg[di] / 2);
            }
            if (j && j.lock === 'vitrine') {
                const L = this.loot[this.M.loot.findIndex(l => l.id === st.target)];
                if (L && !L.opened) L.lockProg = Math.floor(L.lockProg / 2);
            }
            h.prog = 0;
            h.busy = false;
        }
        h.working = false;
    },

    // A body that stays on its feet after a crash: stunned, a slide stops; nothing is lost.
    // side — where the blow pushed it (the view), null — unknown.
    stun(b, side) {
        b.stunUntil = Math.max(b.stunUntil, this.t + 1 + CoopModel.HIT_STUN_TICKS);
        b.sd = side || null;
        if (b.slide) { b.slide = null; b.path = null; }
    },

    // The journal line of an event, after it is settled.
    tell(e, R) {
        const ps = e.parts, out = (p) => R.fin.get(p.b);
        const cells = (n) => n > 1 ? ' ' + CoopText.t('log.cells', { n }) : '';
        const B = (b) => this.body(b);
        if (e.attack) {
            const g = ps.find(p => this.isGuard(p.b)).b, h = ps.find(p => !this.isGuard(p.b)).b;
            this.event('attack', CoopText.t(out({ b: h }).ko ? 'log.knockout' : 'log.knockdown', { who: g.def, whom: h }), h.i);
            return;
        }
        if (e.alarm) {
            // the guard of the event, even if another event of this tick knocked him out (the
            // alarm is raised all the same: judge saw him on his feet)
            const g = (ps.find(p => this.isGuard(p.b) && !p.b.out) || ps.find(p => this.isGuard(p.b))).b, h = ps.find(p => !this.isGuard(p.b)).b;
            this.alarm(CoopText.t('log.guard_bump', { who: h, guard: g.def.name }), h.i);
        }
        let text;
        if (ps.length > 2) text = CoopText.t('log.pileup', { who: ps.map(p => this.nameOf(p.b)).join(', ') });
        else {
            const moved = (p) => R.fly.has(p.b);
            const [a, b] = ps, oa = out(a), ob = out(b);
            const fa = a.m && a.m.fly ? a : b.m && b.m.fly ? b : null;
            if (fa) {
                const x = fa === a ? b : a, of = out(fa), ox = out(x);
                text = CoopText.t('log.fly_into', { who: B(fa.b), whom: B(x.b) });
                if (of.bounce && moved(fa)) text += ' ' + CoopText.t('log.bounce', { who: B(fa.b), cells: cells(of.n) });
                if (ox.type === 'knock') text += ', ' + (moved(x) ? CoopText.t('log.also_flies', { who: B(x.b), cells: cells(ox.n) }) : CoopText.t('log.also_falls', { who: B(x.b) }));
            } else if (oa.type === 'stun' && ob.type === 'stun') {
                text = CoopText.t('log.heads', { a: B(a.b), b: B(b.b) });
            } else {
                const k = oa.type === 'knock' || oa.type === 'fall' ? a : b, w = k === a ? b : a, ok = out(k);
                if (out(w).type === 'win' || (!k.m && w.m)) {
                    text = moved(k) ? CoopText.t('log.sweep', { who: B(w.b), whom: B(k.b), cells: cells(ok.n) })
                        : CoopText.t('log.knockdown', { who: B(w.b), whom: B(k.b) });
                } else {
                    text = CoopText.t('log.ram', { who: B(k.b), whom: B(w.b) }) + ' '
                        + (moved(k) ? CoopText.t('log.ram_fly', { who: B(k.b), cells: cells(ok.n) }) : CoopText.t('log.ram_fall', { who: B(k.b) }));
                }
            }
        }
        this.event('crash', text);
    },
};
Object.assign(CoopRun.prototype, CoopRunClash);
