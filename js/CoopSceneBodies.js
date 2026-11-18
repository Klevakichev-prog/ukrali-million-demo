// CoopSceneBodies.js — a part of CoopScene (CoopScene.js): the bodies. The heroes and the guards —
// the character models of the brief (CoopRig) with cuffs and the stars over a stunned head, beans
// sized by mass until a model arrives; placed and turned along a frame's tracks (walk, fly, slide,
// lunge, recoil), posed by their state and work; the screen points over them for the HUD — the
// loads, the work timers, the carried loot. Methods of the scene, mixed into its prototype.

/** @satisfies {ThisType<CoopScene>} */
const CoopSceneBodies = {
    // A bean: a capsule with two eyes on the front (+x of the root), r — radius in cells;
    // root — where the body stands and how it is turned and laid; bean — the stand-in parts
    // under it, replaced by the model (rig) when its file arrives.
    buildBean(hex, r, cap) {
        const c = this.cell, rad = c * r, h = rad * CoopScene.BEAN_H;
        const root = new BABYLON.Mesh('bean', this.scene);
        const bean = new BABYLON.Mesh('bean-parts', this.scene);
        bean.parent = root;
        const body = BABYLON.MeshBuilder.CreateCapsule('bean-body', { radius: rad, height: h, tessellation: CoopScene.BEAN_TESS, subdivisions: CoopScene.BEAN_SUBDIV }, this.scene);
        body.material = this.mat(hex);
        body.parent = bean;
        body.position.y = h / 2;
        for (const side of [-1, 1]) {
            const eye = BABYLON.MeshBuilder.CreateSphere('bean-eye', { diameter: rad * CoopScene.BEAN_EYE, segments: CoopScene.BEAN_EYE_SEG }, this.scene);
            eye.material = this.mat(CoopScene.HEX.eye);
            eye.parent = bean;
            eye.position.set(rad * CoopScene.BEAN_EYE_OUT, h * CoopScene.BEAN_EYE_UP, side * rad * CoopScene.BEAN_EYE_SIDE);
            const pupil = BABYLON.MeshBuilder.CreateSphere('bean-pupil', { diameter: rad * CoopScene.BEAN_PUPIL, segments: CoopScene.BEAN_PUPIL_SEG }, this.scene);
            pupil.material = this.mat(CoopScene.HEX.pupil);
            pupil.parent = bean;
            pupil.position.set(rad * CoopScene.BEAN_PUPIL_OUT, h * CoopScene.BEAN_EYE_UP, side * rad * CoopScene.BEAN_EYE_SIDE);
        }
        if (cap) {
            const hat = BABYLON.MeshBuilder.CreateCylinder('bean-cap', { height: rad * 0.5, diameter: rad * CoopScene.BEAN_CAP_D, tessellation: CoopScene.BEAN_TESS }, this.scene);
            hat.material = this.mat(CoopScene.HEX.cap);
            hat.parent = bean;
            hat.position.y = h + rad * CoopScene.BEAN_CAP_UP;
        }
        this.add(root, 'actor', { ink: false });
        return { root, bean, body, base: body.material, h, lift: h * CoopScene.BEAN_LIFT, x: 0, y: 0, yaw: 0,
            /** @type {CoopRig | null} */ rig: null, model: null, rigBase: null, mustache: false };
    },

    // Loads the character models (a hero's from his config, CoopRig.GUARD_FILE): each takes the
    // place of its bean. A missing or broken file leaves the bean, the scene does not crash.
    loadRigs() {
        const all = this.heroes.map((p, i) => [p, this.M.heroes[i].model])
            // keep: every other guard wears a mustache (i % 2)
            .concat(this.guards.map((p, i) => { p.mustache = i % 2 === 1; p.guard = true; return [p, CoopRig.GUARD_FILE]; }));
        for (const [p, url] of all) {
            if (!url) continue;
            Model3D.load(url, this.scene).then((model) => {
                if (this.disposed) return;
                const root = Model3D.build(model, this.scene, { name: 'chr' });
                const rig = new CoopRig(root);
                if (!rig.ok) {
                    Model3D.dispose(this.view, root);
                    this.modelIssue(url, CoopText.t('scene.model_nodes', { list: rig.missing.join(', ') }));
                    return;
                }
                root.parent = p.root;
                World3D.addObject(this.view, root, 'actor');
                World3D.removeObject(this.view, p.bean);
                rig.showMustache(p.mustache);
                if (p.guard) {
                    this.addCuffs(rig, p);
                    this.addStars(p);
                }
                p.rig = rig;
                p.model = root;
                p.rigBase = /** @type {BABYLON.Mesh} */ (/** @type {unknown} */ (rig.n.body)).material;
                p.h = rig.dims.h * Gltf3D.UNITS;
                p.lift = rig.dims.r * Gltf3D.UNITS;
            }).catch(() => this.modelIssue(url, CoopText.t('scene.model_unreadable')));
        }
    },

    // The handcuffs of a tied guard (Ivan 29.10): the model prop_handcuffs (rings round the wrists,
    // the bar between) hung on his left hand between the hands — a tied body holds them side by side
    // (CoopRig.CUFF_GAP). Its file node goes under hand_L as it is: both files are in glTF space.
    // Hidden until the rig shows them (CoopRig.pose → cuffs); a missing file — no cuffs.
    addCuffs(rig, p) {
        const url = CoopProps.url('prop_handcuffs');
        Model3D.load(url, this.scene).then((model) => {
            if (this.disposed || p.rig !== rig) return;
            const built = Model3D.build(model, this.scene, { name: 'cuffs' });
            const top = built.getDescendants(false).find(n => n.name === 'cuffs/prop_handcuffs');
            if (!top) {
                Model3D.dispose(this.view, built);
                this.modelIssue(url, CoopText.t('scene.model_cuffs'));
                return;
            }
            const node = /** @type {BABYLON.TransformNode} */ (top);
            node.parent = rig.n.hand_L;
            node.position.set(-rig.dims.hand[0] * CoopRig.CUFF_GAP, 0, 0);
            built.parent = rig.root;           // the empty rest of the build goes with the character
            built.setEnabled(false);
            node.setEnabled(false);
            World3D.addObject(this.view, node, 'actor');
            rig.cuffs.push(node);
        }).catch(() => this.modelIssue(url, CoopText.t('scene.model_unreadable')));
    },

    // The stars over a knocked-out guard's head (Ivan 29.10: «Хочешь оглушение — добавь звёздочки
    // мультяшные над головой»): the model prop_ko_stars, in the world (not in the body: the ring stays
    // level when he lies), placed and spun by placeBean; a missing file — no stars.
    addStars(p) {
        const url = CoopProps.url('prop_ko_stars');
        Model3D.load(url, this.scene).then((model) => {
            if (this.disposed || p.stars) return;
            const root = Model3D.build(model, this.scene, { name: 'stars' });
            root.setEnabled(false);
            World3D.addObject(this.view, root, 'actor');
            p.stars = root;
        }).catch(() => this.modelIssue(url, CoopText.t('scene.model_unreadable')));
    },

    // Where a character's head is in the world: the middle of its top (HEAD_AT of the height) in the
    // body's space — over the axis when it stands, at the end of the body when it lies.
    headAt(p) {
        const body = /** @type {BABYLON.TransformNode} */ (p.rig.n.body);
        const chain = [];
        for (let n = /** @type {BABYLON.Node | null} */ (body); n; n = n.parent) chain.unshift(n);
        for (const n of chain) if (n instanceof BABYLON.TransformNode) n.computeWorldMatrix(true);
        return BABYLON.Vector3.TransformCoordinates(new BABYLON.Vector3(0, p.rig.dims.h * CoopScene.HEAD_AT, 0), body.getWorldMatrix());
    },

    // Places a bean between cells a and b (k 0..1), facing f ('U' | 'R' | 'D' | 'L').
    // state: 'ok' | 'fall' (lying on its side for a moment) | 'out' (knocked out) | 'gone'.
    // pose (optional): lie 0..1 — how far it has gone down onto its back, fd — the direction
    // it flies and falls, yaw — where it faces, degrees (CoopModel.ANGLE; overrides f), lean 0..1
    // — stunned, rocking towards ld (where the blow pushed it; back when unknown).
    // moves (optional) — CoopRig.pose input for the model's parts.
    placeBean(p, a, b, k, f, state, pose, moves) {
        const pa = this.center(a[0], a[1]), pb = this.center(b[0], b[1]);
        const x = pa.x + (pb.x - pa.x) * k, y = pa.y + (pb.y - pa.y) * k;
        p.x = x;
        p.y = y;
        p.root.setEnabled(state !== 'gone');
        p.root.position.set(x, this.floorH, y);
        const lie = pose ? pose.lie : (state === 'fall' || state === 'out' ? 1 : 0);
        const fd = pose && pose.fd;
        const yaw = pose && pose.yaw !== undefined ? pose.yaw : CoopModel.ANGLE[lie > 0 && fd ? CoopModel.BACK[fd] : f];
        // rocking: +z tips the body back (towards yaw + 180), +x towards yaw + 90
        const tip = pose ? pose.lean * CoopScene.LEAN : 0, rel = ((pose && pose.ld ? CoopModel.ANGLE[pose.ld] : yaw + 180) - yaw) * Math.PI / 180;
        p.yaw = yaw;
        p.root.rotation.y = -yaw * Math.PI / 180;
        p.root.rotation.x = lie > 0 && !fd ? lie * Math.PI / 2 : lie > 0 ? 0 : tip * Math.sin(rel);
        p.root.rotation.z = lie > 0 && fd ? lie * Math.PI / 2 : lie > 0 ? 0 : -tip * Math.cos(rel);
        p.root.position.y = this.floorH + lie * p.lift;
        if (lie > 0) {
            // down, it lies across the middle of its cell, not with its feet there (the model's
            // touch counts half its height: CoopModel.reachOf)
            const r = p.root.rotation, mid = BABYLON.Vector3.TransformNormal(new BABYLON.Vector3(0, p.h / 2, 0),
                BABYLON.Matrix.RotationYawPitchRoll(r.y, r.x, r.z));
            p.root.position.x -= mid.x;
            p.root.position.z -= mid.z;
        }
        // knocked out — his own colours (Ivan 29.10: «Он серый — не надо так»), stars over the head
        if (p.rig) p.rig.apply(Object.assign({ lie, stun: pose ? pose.lean : 0, out: state === 'out', hatSide: CoopScene.HAT_SIDE[fd] || 1 }, moves));
        if (p.stars) {
            p.stars.setEnabled(state === 'out');
            if (state === 'out') {
                const at = this.headAt(p);
                p.stars.position.set(at.x, at.y + p.lift + CoopScene.STARS_UP * p.h, at.z);
                p.stars.rotation.y = CoopScene.STARS_SPIN * ((moves && moves.t) || 0);
            }
        }
    },

    // Where a body is between frames a and b (k 0..1): a straight cut, or, when the tick has a
    // broken line (b.tr — the touch of a crash and back, a flight after it), along it by the
    // moments of its points (b.tt; evenly without them). A body that stopped short in its cell
    // (rest — it knocked a guard out) is there, not in the middle. One that stays on its feet
    // and goes back from the touch to its cell does it in a short step (RECOIL), not slowly
    // over the rest of the tick. Returns [from, to, k] of the segment.
    along(a, b, k) {
        const from = a.rest || [a.x, a.y];
        if (!b.tr) return [from, b.rest || [b.x, b.y], k];
        const kr = CoopScene.recoilAt(a, b);
        if (kr >= 0 && k > kr) {
            const u = Math.min(1, (k - kr) / CoopScene.RECOIL);
            return [b.tr[0], b.tr[1], 1 - (1 - u) * (1 - u)];
        }
        const pts = [from].concat(b.tr), n = pts.length - 1;
        const at = [0].concat(b.tt || b.tr.map((_, i) => (i + 1) / n));
        let i = 0;
        while (i < n - 1 && k > at[i + 1]) i++;
        const span = at[i + 1] - at[i];
        return [pts[i], pts[i + 1], span > 0 ? Math.max(0, Math.min(1, (k - at[i]) / span)) : 1];
    },

    // Between two frames of a body: going down while it flies, getting up, rocking when stunned,
    // turning. Nothing of a crash plays before the bodies touch (Ivan): a body goes down and
    // starts rocking from the touch of its tick (b.kc), and turns to face the blow as it goes
    // down; it gets up only in the last RISE of the tick it rises in (a fall of one tick still
    // shows it lying on its back for a moment), turning back to where it faced. A step in a new
    // way turns it at the start of the step, the short way round, within TURN of the tick.
    // A flier bouncing back does not turn round (Ivan): it flies back the way it lies. A waiting
    // hero turns to WAIT_FACE as his wait starts and back as it ends (Ivan 24.10).
    pose(a, b, k, downA, downB) {
        const C = CoopScene, from = (kc) => Math.max(0, Math.min(1, (k - (kc || 0)) / (1 - (kc || 0))));
        const lie = downA && downB ? 1 : downA ? Math.min(1, (1 - k) / C.RISE) : downB ? from(b.kc) : 0;
        const lean = (a.stun ? 1 - k : 0) + (b.stun ? (a.stun ? k : from(b.kc)) : 0);
        const fd = b.fd || a.fd, A = CoopModel.ANGLE, face = (s) => (s.wait ? C.WAIT_FACE : A[s.f]);
        const stand = C.turn(face(a), face(b), Math.min(1, k / C.TURN));
        const yaw = fd ? C.turn(stand, A[CoopModel.BACK[fd]], Math.min(1, lie / C.LIE_TURN)) : stand;
        return { lie, fd, yaw, lean, ld: b.sd || a.sd };
    },

    // What the parts of a body do between frames a and b (CoopRig.pose input): stepping when it
    // moved or turns on the spot, working, sliding, knocked flying while it flies (arms up from the touch, down at the
    // landing, up across the ticks of a long flight), lunging up to the touch in a tick with a
    // broken line it stayed up in, squashed at the touch of a bounce. What the touch of a crash
    // ends — the stride, the lunge, the slide, the work — dies away within FADE of it; a body
    // going back to its cell from the touch takes a step back; one stepping onto the wet floor
    // walks until it is on it.
    moves(a, b, k) {
        const C = CoopScene, w = (on) => (on(a) ? 1 - k : 0) + (on(b) ? k : 0);
        const clamp = (x) => Math.max(0, Math.min(1, x)), ease = (x) => Math.sin(Math.PI / 2 * clamp(x));
        const down = (s) => !!(s.fall || s.out);
        const moved = (a.x !== b.x || a.y !== b.y) && !down(a) && !down(b);
        const touch = b.kc !== undefined, kc = b.kc || 0, after = clamp((k - kc) / (1 - kc));
        const stop = (k0) => clamp(1 - (k - k0) / C.FADE);         // 1 up to k0, then dies away
        const kt = C.bounceAt(a, b), kr = C.recoilAt(a, b), went = down(b) && !down(a);
        // a step that met somebody before it got in: it walks up to the touch, then the crash plays
        const from = a.rest || [a.x, a.y];
        const reach = !!b.tr && !down(a) && touch && (b.tr[0][0] !== from[0] || b.tr[0][1] !== from[1]);
        const onWet = moved && b.slide && !a.slide, offWet = moved && a.slide && !b.slide && !touch;
        // a turn on the spot (a hero turning to his job or to the camera to wait, a guard looking
        // round): the feet step it
        const face = (s) => (s.wait ? 'wait' : s.f);
        const spin = !moved && !down(a) && !down(b) && !a.slide && !b.slide && !touch && face(a) !== face(b);
        let walk = 0;
        if (moved && (!b.slide || onWet)) walk = 1;
        else if (spin) walk = stop(C.TURN);
        else if (reach && !a.slide) walk = kr >= 0 ? clamp((kr + C.RECOIL - k) / C.FADE) : stop(kc);
        let slide = w(s => !!s.slide);
        if (onWet) slide = clamp((k - C.WET_EDGE) / C.SLIDE_IN);
        else if (offWet) slide = 1 - clamp((k - C.WET_EDGE) / C.SLIDE_IN);
        else if (a.slide && touch) slide = stop(kc);
        let work = w(s => !!s.work);
        if (moved) work = (a.work ? stop(0) : 0) + (b.work ? clamp((k - 1 + C.FADE) / C.FADE) : 0);
        if (touch && (went || (b.stun && !a.stun))) work *= stop(kc);
        // tied (Ivan 29.10): the hands go up within the first half of the tick the tie ends in, down
        // within the first half of the tick he is untied in
        const tied = a.tied && b.tied ? 1 : b.tied ? clamp(k / C.TIE_HANDS) : a.tied ? 1 - clamp(k / C.TIE_HANDS) : 0;
        let fly = 0;
        if (went || b.fly || a.flies) {
            const up = a.flies ? 1 : ease(after / C.FLY_UP);
            const dn = b.flies ? 1 : ease((1 - (went && !b.fly ? after : k)) / C.FLY_UP);
            fly = Math.min(up, dn);
        }
        return {
            t: a.t + k,
            walk, work, slide, fly, tied,
            wait: w(s => !!s.wait), verb: b.work ? b.wv : a.wv,
            lunge: reach ? (k < kc ? k / kc : stop(kc)) : 0,
            bump: kt < 0 ? 0 : Math.max(0, 1 - Math.abs(k - kt) / C.BUMP)
        };
    },

    // The load indicator over each carrying hero (Ivan 19.10): per hero, the point over his stack
    // of loot icons on the screen (CSS px), the mass he carries in frame a and his carry limit;
    // shown — he carries something, is not caught and the point is in front of the camera.
    loadHeads(a) {
        const caps = this.capacities();
        return this.heroes.map((p, i) => {
            const held = a.loot.map((l, j) => j).filter(j => a.loot[j].holder === i);
            const load = this.M.loadIn(a, i);
            if (!held.length || a.h[i].caught) return { x: 0, y: 0, shown: false, load, cap: caps[i] };
            const s = this.carryAt(p), top = s.y + CoopScene.ICON_LIFT + held.reduce((y, j) => y + CoopScene.iconH(this.loot[j]), 0);
            const q = this.view.projectToScreen(s.x, s.z, top);
            return { x: q.x, y: q.y, shown: !q.behind, load, cap: caps[i] };
        });
    },

    // The work timer of each working hero (Ivan 19.10, the build 6381b83: over the object, not over
    // him): over the cell of what he works on (workPoint) — a drop's object is his load, so that timer
    // is over his cell (heroAt); the ticks of the job left after this tick (wl) and its whole time (wt),
    // the work's verb for the icon. A waiting hero (Ivan 24.10) has his over his cell as a drop's: the
    // wait's wl, wt, wait: true. Every timer hangs at one height, the top of a door (timerTop; Ivan
    // 24.10, the screenshot: «хорошо стоит таймер у морковки, все таймеры должны стоять так на этой
    // высоте»), not over the model's head or the object's own top. Two at one object — one timer, of
    // the one who ends first.
    workHeads(a) {
        const top = this.timerTop();
        const out = this.heroes.map((p, i) => {
            const h = a.h[i];
            const wait = !h.caught && !h.work && h.wait && h.wait.wt > 0 ? h.wait : null;
            if (!wait && (!h.work || !h.wt || h.caught)) return { x: 0, y: 0, shown: false, left: 0, total: 0, load: false };
            const w = wait ? null : this.workPoint(h, a);
            const s = w || this.heroAt(p, h), q = this.view.projectToScreen(s.x, s.z, top);
            if (w) return { x: q.x, y: q.y, shown: !q.behind, left: h.wl, total: h.wt, load: false, obj: h.wv + ':' + h.wo, verb: h.wv };
            return wait ? { x: q.x, y: q.y, shown: !q.behind, left: wait.wl, total: wait.wt, load: false, wait: true }
                : { x: q.x, y: q.y, shown: !q.behind, left: h.wl, total: h.wt, load: false, verb: h.wv };
        });
        /** @type {Record<string, number>} */
        const first = {};
        out.forEach((p, i) => { if (p.shown && p.obj && !(out[first[p.obj]] && out[first[p.obj]].left <= p.left)) first[p.obj] = i; });
        out.forEach((p, i) => { if (p.obj && first[p.obj] !== i) p.shown = false; });
        return out;
    },

    // Where the object a working hero (frame h: wv, wo) works on stands, world px { x, z }: the door
    // (a gate's keypad for its jobs), the panel, the item (in its vitrine or lying elsewhere); null —
    // a drop (its object is his load). The timer's height is timerTop, one for all.
    workPoint(h, a) {
        const top = (/** @type {any} */ v) => ({ x: v.node.position.x, z: v.node.position.z });
        const di = this.M.doors.findIndex(d => d.id === h.wo);
        const gate = di >= 0 && this.M.doors[di].lock === 'electronic';
        if ((h.wv === 'pick' || h.wv === 'lock' || h.wv === 'open' || h.wv === 'close') && di >= 0 && !gate) return top(this.doors[di]);
        if ((h.wv === 'hack' || h.wv === 'lock' || h.wv === 'open' || h.wv === 'close') && gate) {
            const k = this.props.find(v => v.door === di);
            return top(k || this.doors[di]);
        }
        if (h.wv === 'power') {
            const pi = this.M.panelIndex(h.wo), k = this.props.find(v => v.role === 'panel' && v.panel === pi);
            return k ? top(k) : null;
        }
        const li = this.M.loot.findIndex(l => l.id === h.wo);
        if (li < 0 || !['take', 'grab', 'gather', 'smash', 'unlock'].includes(h.wv)) return null;
        const p = this.loot[li].item.position;
        return { x: p.x, z: p.z };
    },

    // The far (screen-up) edge of a hero's cell in the frame (h: x, y), world px: a timer over him hangs
    // over it (Ivan 24.10: «иконка должна быть привязана к клеткам поля»), not over the model, which
    // turns and sways while it waits or works. The edge, not the centre: a door's timer hangs on the
    // wall line, the edge of the cell in front of it, and the waiting teammate beside the worker
    // shows his in the same row («у броколи в ожидании иконка всё ещё ниже»).
    heroAt(p, h) {
        const c = this.center(h.x, h.y);
        return { x: c.x, z: c.y - this.cell / 2 };
    },

    // The height every work timer hangs at, world px: the top of the level's first loaded door, not a
    // gate (CoopScene.topOf); WORK_TOP over the floor until a door's file has loaded.
    timerTop() {
        const d = (this.doors || []).find((v, i) => v.m && this.M.doors[i].lock !== 'electronic');
        return d ? CoopScene.topOf(d.m) : this.floorH + CoopScene.WORK_TOP;
    },

    // World position of the loot icon over a holder's head: the model's socket_carry or above the bean.
    carryAt(p) {
        if (!p.rig || !p.rig.n.socket_carry) return { x: p.x, y: this.floorH + p.h + CoopScene.CARRY_UP, z: p.y };
        let node = /** @type {BABYLON.Node} */ (p.rig.n.socket_carry);
        const chain = [];
        for (; node; node = node.parent) chain.unshift(node);
        for (const n of chain) if (n instanceof BABYLON.TransformNode) n.computeWorldMatrix(true);
        return p.rig.socket();
    },
};
Object.assign(CoopScene.prototype, CoopSceneBodies);
