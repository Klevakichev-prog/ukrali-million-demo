// CoopRig.js — a character of the co-op level as the node tree of the modelling brief
// («ТЗ на лоуполи-модели», section 5): chr_<name> → body (eye_L, eye_R, eye_L_x, eye_R_x, hat,
// socket_carry, mustache on the guard), hand_L, hand_R (→ item), foot_L, foot_R. One rig and
// one set of moves for every model: the reference carrot, the blocking models and the
// modeller's files later — the scene only needs the node names.
//
// CoopRig.pose(input, dims) is pure (no Babylon, tested in node): what a frame of the replay
// means for every node. Coordinates are those of the model file (glTF): metres, +Y up, +Z —
// where the hero looks, +X — the hero's left. A pose is an offset from the rest pose: p — added
// to the rest position, r — Euler angles (rad), s — body scale (it grows from the floor: the
// body pivot is at the bottom). Hands and feet are children of the root, not of the body:
// squashing the body does not squash them.
// The scene keeps turning and laying the whole root (CoopScene.placeBean); the rig moves the
// parts inside it: steps, hands, the bar over the head, the hat flying off, crossed eyes.

class CoopRig {
    // root — the built model (Model3D.build); finds the nodes by name and remembers the rest pose.
    constructor(root) {
        this.root = root;
        /** @type {Record<string, BABYLON.TransformNode>} */
        this.n = {};
        const want = new Set(CoopRig.NODES);
        for (const node of root.getDescendants(false)) {
            const name = node.name.slice(node.name.lastIndexOf('/') + 1);
            if (want.has(name) && !this.n[name]) this.n[name] = /** @type {BABYLON.TransformNode} */ (node);
        }
        // Required nodes the file lacks: the scene tells the modeller which ones.
        this.missing = CoopRig.MUST.filter(k => !this.n[k]);
        this.ok = this.missing.length === 0;
        /** @type {Record<string, number[]>} */
        this.rest = {};
        for (const [k, node] of Object.entries(this.n)) {
            this.rest[k] = [node.position.x, node.position.y, node.position.z];
            node.rotationQuaternion = null;          // the loader sets one; the rig drives Euler angles
            node.rotation.set(0, 0, 0);
        }
        // Hidden by default: crossed eyes (*_x), the mustache (shown by the scene on the second guard).
        for (const [k, node] of Object.entries(this.n)) if (/_x$/.test(k) || k === 'mustache') node.setEnabled(false);
        this.dims = this.ok ? this.measure() : null;
        // The handcuffs: meshes the scene hangs on the hands (CoopScene.addCuffs), shown on a tied body.
        /** @type {BABYLON.AbstractMesh[]} */
        this.cuffs = [];
    }

    // Body height and radius, rest of the hand and the hat — what the moves are scaled by.
    measure() {
        const body = /** @type {BABYLON.Mesh} */ (/** @type {unknown} */ (this.n.body));
        const bb = body.getBoundingInfo ? body.getBoundingInfo().boundingBox : null;
        const h = bb ? bb.maximum.y : CoopRig.BEAN_H, r = bb ? Math.max(bb.maximum.x, bb.maximum.z, -bb.minimum.x, -bb.minimum.z) : CoopRig.BEAN_R;
        return { h, r, hand: this.rest.hand_L || [r + CoopRig.HAND_OUT, h * CoopRig.HAND_UP, 0],
            hatBelow: this.below(this.n.hat), hatY: this.rest.hat ? this.rest.hat[1] : h };
    }

    // How far the meshes of a node reach below its pivot, in its own space (headphone cups hang
    // lower than the pivot of the hat): a fallen hat is lifted by as much to stay on the floor.
    below(node) {
        if (!node || !node.computeWorldMatrix || typeof BABYLON === 'undefined' || !BABYLON.Matrix) return 0;
        const inv = node.computeWorldMatrix(true).clone().invert();
        let min = 0;
        const meshes = /** @type {BABYLON.AbstractMesh[]} */ ([node].concat(node.getChildMeshes ? node.getChildMeshes(false) : []));
        for (const m of meshes) {
            if (!m.getBoundingInfo) continue;
            const toNode = m.computeWorldMatrix(true).multiply(inv);
            for (const c of m.getBoundingInfo().boundingBox.vectors) {
                min = Math.min(min, BABYLON.Vector3.TransformCoordinates(c, toNode).y);
            }
        }
        return -min;
    }

    // The icon of the carried loot hangs over this point (world position), or null without the socket.
    socket() {
        const s = this.n.socket_carry;
        return s ? s.getAbsolutePosition() : null;
    }

    showMustache(on) {
        if (this.n.mustache) this.n.mustache.setEnabled(!!on);
    }

    // Applies CoopRig.pose to the nodes.
    apply(input) {
        if (!this.ok) return;
        const P = CoopRig.pose(input, this.dims);
        for (const k of CoopRig.MOVED) {
            const node = this.n[k], q = P[k];
            if (!node || !q) continue;
            const r0 = this.rest[k];
            node.position.set(r0[0] + q.p[0], r0[1] + q.p[1], r0[2] + q.p[2]);
            node.rotation.set(q.r[0], q.r[1], q.r[2]);
            if (q.s) node.scaling.set(q.s[0], q.s[1], q.s[2]);
        }
        for (const side of ['L', 'R']) {
            if (this.n['eye_' + side]) this.n['eye_' + side].setEnabled(!P.crossed);
            if (this.n['eye_' + side + '_x']) this.n['eye_' + side + '_x'].setEnabled(P.crossed);
        }
        for (const m of this.cuffs) m.setEnabled(P.cuffs);
        if (this.n.item) this.n.item.setEnabled(P.item);
    }

    // input: { t — time in ticks (continuous), walk, work, wait, slide, fly, lunge, bump, lie, stun —
    // weights 0..1 (how much of the move is on; the scene blends them between two frames),
    // verb — the work's (CoopRig.WORK_MOVES; none — as a lock is picked), out — knocked out, tied — 0..1
    // how far the hands of a tied body have gone up (the cuffs show at 1), hatSide — ±1, the model's X
    // a knocked-out body's hat falls to (the scene's: the camera's side) }. Loot is not in the hands: the scene hangs it as an icon over the
    // head (socket). dims: { h, r, hand: [x, y, z] rest of hand_L, hatY, hatBelow }.
    // Returns { body, hat, hand_L, hand_R, foot_L, foot_R: { p, r, s? }, crossed, cuffs, item }.
    static pose(input, dims) {
        const C = CoopRig, I = Object.assign({ t: 0, walk: 0, work: 0, wait: 0, slide: 0, fly: 0, lunge: 0, bump: 0, lie: 0, stun: 0, tied: 0, out: false, hatSide: 1 }, input);
        const h = dims.h, r = dims.r, hx = dims.hand[0], hy = dims.hand[1], hz = dims.hand[2];
        const ph = 2 * Math.PI * (I.t - Math.floor(I.t)), sin = Math.sin(ph), cos = Math.cos(ph);
        const lerp = (a, b, w) => a.map((v, i) => v + (b[i] - v) * w);
        const zero = () => [0, 0, 0];

        // Steps: one full stride a tick (one cell); a foot swings forward lifted, the other pushes back.
        const w = I.walk * (1 - I.slide) * (1 - I.lie);
        const stride = C.STRIDE * h * w, lift = C.LIFT * h * w;
        const feet = {
            L: [0, lift * Math.max(0, cos) * Math.abs(sin) * 2, stride * sin],
            R: [0, lift * Math.max(0, -cos) * Math.abs(sin) * 2, -stride * sin]
        };
        // Hands: swing against the feet, then each move takes them to its own place.
        const hands = { L: [0, 0, -C.SWING * h * w * sin], R: [0, 0, C.SWING * h * w * sin] };
        const body = { p: [0, C.BOB * h * w * Math.abs(Math.sin(2 * ph)), 0], r: [C.WALK_LEAN * w, 0, C.WADDLE * w * sin], s: [1, 1, 1] };

        const move = C.WORK_MOVES[I.verb] || C.WORK_MOVES.pick, D = { h, r, hx, hy, hz }, roll = { L: 0, R: 0 };
        const job = move(I.t, 1, D);
        for (const side of ['L', 'R']) {
            const sx = side === 'L' ? 1 : -1, x0 = sx * hx;
            // To an absolute place in the model (rest of the hand + offset = target).
            const to = (x, y, z) => [x - x0, y - hy, z - hz];
            // Work with the hands: each work its own move (CoopRig.WORK_MOVES).
            const m = sx > 0 ? job : move(I.t, sx, D);
            hands[side] = lerp(hands[side], to(m.hand[0], m.hand[1], m.hand[2]), I.work);
            roll[side] = (m.turn || 0) * I.work;
            // The wet floor: arms up and wide, still (Ivan: arms move only at a blow).
            hands[side] = lerp(hands[side], to(sx * hx * C.SLIDE_ARMS_WIDE, hy + C.SLIDE_ARMS_UP * h, 0), I.slide);
            // Knocked flying: arms thrown up and back.
            hands[side] = lerp(hands[side], to(sx * hx * C.FLY_ARMS_WIDE, hy + C.FLY_ARMS_UP * h, -C.FLY_ARMS_BACK * h), I.fly);
            // The lunge into a hit: both hands shoot forward.
            hands[side][2] += C.LUNGE * h * I.lunge;
            // Stunned: hands hang.
            hands[side][1] -= C.STUN_DROP * h * I.stun;
            // Lying: a starfish, limbs a little apart.
            hands[side][0] += sx * C.LIE_HANDS * h * I.lie;
            feet[side][0] += sx * C.LIE_FEET * h * I.lie;
            // Sliding and flying: feet together and ahead, off the floor.
            const up = Math.max(I.slide, I.fly);
            feet[side][2] += C.FEET_AHEAD * h * up;
            feet[side][1] += C.FLY_FEET_UP * h * I.fly + C.FOOT_TILT * C.FOOT_TOE * h * up;   // the toes tipped up stay off the floor
            // Tied (Ivan 29.10: «Лежит руки вверх сцеплены наручниками»; «когда персонаж лежит, то верх у
            // него спереди»; «над животом»): the hands stick up over the belly — in front, +Z — side by side.
            hands[side] = lerp(hands[side], to(sx * hx * C.CUFF_GAP, h * C.CUFF_UP, r + h * C.CUFF_OUT), I.tied);
        }

        // Body: squashed along its height when a flier bumps head first into a body it bounces
        // off, leaning into the work, leaning back on the wet floor, breathing when it stands still.
        const sq = C.BUMP_SQUASH * I.bump;
        body.s = [1 + sq / 2, 1 - sq + C.BREATH * (1 - w) * Math.sin(Math.PI * I.t), 1 + sq / 2];
        body.r[0] += job.lean * I.work - C.SLIDE_LEAN * I.slide;
        body.p[1] -= (job.dip || 0) * h * I.work;
        body.r[2] += C.WOBBLE * I.slide * Math.sin(2 * ph);
        // Waiting (Ivan 24.10): turning to and fro, rocking a little; the scene has turned it to the camera.
        const wp = 2 * Math.PI * I.t / C.WAIT_PERIOD;
        body.r[1] += C.WAIT_SWAY * I.wait * Math.sin(wp);
        body.r[2] += C.WAIT_ROCK * I.wait * Math.sin(2 * wp);

        // Leaning back on the wet floor tips the round bottom into the floor: the body rises by as
        // much (the small lean of the run sinks it by millimetres — left as is).
        body.p[1] += r * Math.sin(C.SLIDE_LEAN * I.slide);

        // The hat: pops up when the body flies and lands on the belly when it lies — beyond the
        // head it made a lying body longer than its cell (CoopModel.reachOf counts half the height).
        // The body lies on its back: +Z of the body is up, the belly r above the axis — the hat
        // turns a quarter about X to stand crown up on it.
        const off = I.lie * I.lie * (3 - 2 * I.lie);   // keep: smoothstep — the ease of lying down
        const pop = C.HAT_POP * h * Math.sin(Math.PI * Math.min(1, I.fly * C.HAT_POP_RATE));
        // Knocked out (Ivan 29.10: on the belly the cap covered the lying body and read as a cap on a
        // standing one's head): it falls off onto the floor (r under the axis) beside the head, on hatSide.
        const lay = I.out
            ? [I.hatSide * C.HAT_ASIDE * r, C.HAT_HEAD * h - (dims.hatY ?? h), -r + (dims.hatBelow || 0)]
            : [0, C.HAT_BELLY * h - (dims.hatY ?? h), C.HAT_SINK * r + (dims.hatBelow || 0)];
        const hat = { p: [lay[0] * off, lay[1] * off + pop * (1 - off), lay[2] * off], r: [Math.PI / 2 * off - C.HAT_POP_TILT * pop / h, 0, 0] };

        return {
            body, hat,
            hand_L: { p: hands.L, r: [0, 0, roll.L] }, hand_R: { p: hands.R, r: [0, 0, roll.R] },
            foot_L: { p: feet.L, r: [-C.FOOT_TILT * (Math.max(I.slide, I.fly)), 0, 0] },
            foot_R: { p: feet.R, r: [-C.FOOT_TILT * (Math.max(I.slide, I.fly)), 0, 0] },
            crossed: !!I.out || I.stun > C.EYES_X_STUN || I.lie > C.EYES_X_LIE,
            cuffs: I.tied >= 1,
            // Ivan 29.10 «спрячь»: a knocked-out body's item (the guard's flashlight) stuck up over him.
            item: !I.out
        };
    }
}

// Nodes of section 5; MUST — without them the file is not a character (the scene keeps the bean).
CoopRig.NODES = ['body', 'eye_L', 'eye_R', 'eye_L_x', 'eye_R_x', 'hat', 'socket_carry', 'mustache',
    'hand_L', 'hand_R', 'item', 'foot_L', 'foot_R'];
CoopRig.MUST = ['body', 'hand_L', 'hand_R', 'foot_L', 'foot_R'];
CoopRig.MOVED = ['body', 'hat', 'hand_L', 'hand_R', 'foot_L', 'foot_R'];
// The guard's model file; the heroes' come from their config (CoopModel.HEROES[].model). Literal
// paths: the asset scanner sees only literals (invariant 6).
CoopRig.GUARD_FILE = 'assets/models/chr_potato_guard.glb';
// Moves, in body heights (h) unless said otherwise.
CoopRig.STRIDE = COOP_RIG_STRIDE;
CoopRig.LIFT = COOP_RIG_LIFT;
CoopRig.SWING = COOP_RIG_SWING;
CoopRig.BOB = COOP_RIG_BOB;
CoopRig.WALK_LEAN = COOP_RIG_WALK_LEAN;
CoopRig.WADDLE = COOP_RIG_WADDLE;
CoopRig.BUMP_SQUASH = COOP_RIG_BUMP_SQUASH;
CoopRig.REACH = COOP_RIG_REACH;
CoopRig.JIGGLE = COOP_RIG_JIGGLE;
CoopRig.JIGGLE_RATE = COOP_RIG_JIGGLE_RATE;
CoopRig.WORK_LEAN = COOP_RIG_WORK_LEAN;
CoopRig.WAIT_SWAY = COOP_RIG_WAIT_SWAY;
CoopRig.WAIT_ROCK = COOP_RIG_WAIT_ROCK;
CoopRig.WAIT_PERIOD = COOP_RIG_WAIT_PERIOD;
CoopRig.SLIDE_LEAN = COOP_RIG_SLIDE_LEAN;
CoopRig.WOBBLE = COOP_RIG_WOBBLE;
CoopRig.LUNGE = COOP_RIG_LUNGE;
CoopRig.BREATH = COOP_RIG_BREATH;
CoopRig.HAT_BELLY = COOP_RIG_HAT_BELLY;
CoopRig.HAT_ASIDE = COOP_RIG_HAT_ASIDE;
CoopRig.HAT_HEAD = COOP_RIG_HAT_HEAD;
CoopRig.HAT_SINK = COOP_RIG_HAT_SINK;
CoopRig.HAT_POP = COOP_RIG_HAT_POP;
CoopRig.FOOT_TILT = COOP_RIG_FOOT_TILT;
CoopRig.FOOT_TOE = COOP_RIG_FOOT_TOE;
CoopRig.CUFF_UP = COOP_RIG_CUFF_UP;
CoopRig.CUFF_OUT = COOP_RIG_CUFF_OUT;
CoopRig.CUFF_GAP = COOP_RIG_CUFF_GAP;
CoopRig.BEAN_H = COOP_RIG_BEAN_H;
CoopRig.BEAN_R = COOP_RIG_BEAN_R;
CoopRig.HAND_OUT = COOP_RIG_HAND_OUT;
CoopRig.HAND_UP = COOP_RIG_HAND_UP;
CoopRig.SLIDE_ARMS_WIDE = COOP_RIG_SLIDE_ARMS_WIDE;
CoopRig.SLIDE_ARMS_UP = COOP_RIG_SLIDE_ARMS_UP;
CoopRig.FLY_ARMS_WIDE = COOP_RIG_FLY_ARMS_WIDE;
CoopRig.FLY_ARMS_UP = COOP_RIG_FLY_ARMS_UP;
CoopRig.FLY_ARMS_BACK = COOP_RIG_FLY_ARMS_BACK;
CoopRig.STUN_DROP = COOP_RIG_STUN_DROP;
CoopRig.LIE_HANDS = COOP_RIG_LIE_HANDS;
CoopRig.LIE_FEET = COOP_RIG_LIE_FEET;
CoopRig.FEET_AHEAD = COOP_RIG_FEET_AHEAD;
CoopRig.FLY_FEET_UP = COOP_RIG_FLY_FEET_UP;
CoopRig.HAT_POP_RATE = COOP_RIG_HAT_POP_RATE;
CoopRig.HAT_POP_TILT = COOP_RIG_HAT_POP_TILT;
CoopRig.EYES_X_STUN = COOP_RIG_EYES_X_STUN;
CoopRig.EYES_X_LIE = COOP_RIG_EYES_X_LIE;

// The placeholder moves of the works (Ivan 24.10: «заглушечные анимации на все действия, все должны
// отличаться»), per verb of CoopRun.WORKS: f(t, sx, d) → { hand — the hand's place in the model
// [x, y, z] (+z in front), turn — its roll, rad; lean — the body leaning forward, rad; dip — the body
// lower, × h }. t — ticks; sx — 1 the left hand, −1 the right; d — { h, r, hx, hy, hz } (rig dims).
CoopRig.WORK_MOVES = (() => {
    const T = 2 * Math.PI, cyc = (t, rate) => 0.5 - 0.5 * Math.cos(T * t * rate);   // 0 → 1 → 0
    const rest = (sx, d) => [sx * d.hx, d.hy, d.hz];
    return {
        // pick a lock: both hands at the lock, fiddling fast
        pick: (t, sx, d) => ({ hand: [sx * d.hx * 0.45, d.hy + 0.12 * d.h + CoopRig.JIGGLE * d.h * Math.sin(T * t * CoopRig.JIGGLE_RATE + (sx > 0 ? 0 : Math.PI)),
            d.r + CoopRig.REACH * d.h], lean: CoopRig.WORK_LEAN }),
        // a keypad: hands apart and low, tapping in turn
        hack: (t, sx, d) => ({ hand: [sx * d.hx * 0.75, d.hy + 0.04 * d.h + 0.06 * d.h * Math.max(0, Math.sin(T * t * 4 + (sx > 0 ? 0 : Math.PI))), d.r + 0.08 * d.h], lean: 0.08 }),
        // a key: the right hand in the lock turning it to and fro, the left one hangs
        unlock: (t, sx, d) => sx > 0 ? { hand: rest(sx, d), lean: 0.06 }
            : { hand: [-d.hx * 0.3, d.hy + 0.16 * d.h, d.r + 0.16 * d.h], turn: 0.9 * Math.sin(T * t), lean: 0.06 },
        // lock: the right hand circles in the lock, the left one holds the door
        lock: (t, sx, d) => sx > 0 ? { hand: [d.hx * 0.6, d.hy + 0.26 * d.h, d.r + 0.1 * d.h], lean: 0.1 }
            : { hand: [-d.hx * 0.3 + 0.05 * d.h * Math.cos(T * t * 1.5), d.hy + 0.16 * d.h + 0.05 * d.h * Math.sin(T * t * 1.5), d.r + 0.16 * d.h], lean: 0.1 },
        // open: both hands on the handle, pulling it to the body, leaning back
        open: (t, sx, d) => ({ hand: [sx * d.hx * 0.35, d.hy + 0.14 * d.h, d.r + (0.24 - 0.18 * cyc(t, 0.5)) * d.h], lean: -0.12 }),
        // close: both hands at the shoulders pushing away, leaning in
        close: (t, sx, d) => ({ hand: [sx * d.hx * 0.8, d.hy + 0.3 * d.h, d.r + (0.06 + 0.2 * cyc(t, 0.5)) * d.h], lean: 0.3 }),
        // the panel: the right hand up at the lever pulling it down, the left one on the panel
        power: (t, sx, d) => sx > 0 ? { hand: [d.hx * 0.7, d.hy + 0.2 * d.h, d.r + 0.08 * d.h], lean: 0.04 }
            : { hand: [-d.hx * 0.5, d.hy + (0.5 - 0.25 * cyc(t, 1)) * d.h, d.r + 0.12 * d.h], lean: 0.04 },
        // take: bent down, scooping with both hands from low up to the chest
        take: (t, sx, d) => ({ hand: [sx * d.hx * 0.5, d.hy + (0.35 * cyc(t, 1) - 0.2) * d.h, d.r + 0.15 * d.h], lean: 0.4, dip: 0.06 }),
        // grab from a smashed vitrine: the take's scoop, twice as fast and deeper in (rules, section 10, 09.11)
        grab: (t, sx, d) => ({ hand: [sx * d.hx * 0.5, d.hy + (0.35 * cyc(t, 2) - 0.2) * d.h, d.r + 0.2 * d.h], lean: 0.45, dip: 0.06 }),
        // gather from a smashed vitrine: the take, slow and careful
        gather: (t, sx, d) => ({ hand: [sx * d.hx * 0.5, d.hy + (0.35 * cyc(t, 0.5) - 0.2) * d.h, d.r + 0.15 * d.h], lean: 0.4, dip: 0.06 }),
        // smash: both hands over the head, then down hard
        smash: (t, sx, d) => {
            const s = t - Math.floor(t), down = s < 0.7 ? 0 : Math.sin(Math.PI * (s - 0.7) / 0.3);
            return { hand: [sx * d.hx * 0.3, d.hy + (0.55 - 0.45 * down) * d.h, d.r + (0.02 + 0.28 * down) * d.h], lean: 0.3 * down - 0.1 };
        },
        // knock out: the right fist punches forward once a tick, the left one guards the chest
        knock: (t, sx, d) => {
            const s = t - Math.floor(t), hit = s < 0.6 ? 0 : Math.sin(Math.PI * (s - 0.6) / 0.4);
            return sx > 0 ? { hand: [d.hx * 0.45, d.hy + 0.22 * d.h, d.r + 0.06 * d.h], lean: 0.05 + 0.2 * hit }
                : { hand: [-d.hx * (0.6 - 0.35 * hit), d.hy + 0.2 * d.h, d.r + (0.02 + 0.32 * hit) * d.h], lean: 0.05 + 0.2 * hit };
        },
        // tie: crouched low over the lying body, the hands winding the rope round each other
        tie: (t, sx, d) => ({ hand: [sx * d.hx * 0.25 + 0.06 * d.h * Math.cos(T * t * 2), d.hy - 0.12 * d.h + 0.05 * d.h * sx * Math.sin(T * t * 2),
            d.r + 0.2 * d.h], lean: 0.5, dip: 0.1 }),
        // untie (a guard): bent over, the hands low, pulling the knot apart and together
        untie: (t, sx, d) => ({ hand: [sx * d.hx * (0.3 + 0.35 * cyc(t, 1)), d.hy - 0.06 * d.h, d.r + 0.18 * d.h], lean: 0.35, dip: 0.04 }),
        // drop the load: both hands up to it over the head, then thrown forward
        drop: (t, sx, d) => {
            const s = cyc(t, 0.75);
            return { hand: [sx * d.hx * 0.6, d.hy + (0.5 - 0.15 * s) * d.h, 0.3 * d.h * s], lean: -0.05 + 0.15 * s };
        }
    };
})();
