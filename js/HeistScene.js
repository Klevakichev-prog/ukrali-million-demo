// HeistScene.js — shows a level of the heist in 3D: the floor with its cells and alarm zones,
// walls, windows, doors (colored by state), objects, loot markers, the active camera screen,
// crew, the Boss and guards (character.glb over a colored disc). Pure view: it reads what
// HeistModel returns (the plan timeline, the execution frames) and decides nothing; pickCell
// answers which cell a tap hit, for input only.
//
// Cells: cell (cx, cy) spans world px [ox + cx·cell, ox + (cx+1)·cell) along x, the same with
// oy along y; the grid is centered on the location. Walls and windows are merged into one mesh
// each, objects of one type share one thin-instance mesh, doors and markers are separate
// meshes because their state changes.

class HeistScene {
    // location — Location3D; model — HeistLevelModel; cfg — Game.cfg()
    constructor(location, model, cfg) {
        this.location = location;
        this.view = location.view;
        this.scene = location.view.scene;
        this.model = model;
        this.L = model.L;
        this.cfg = cfg;
        this.cell = cfg.cellPx;
        this.ox = Math.round(location.width / 2 - this.L.width * this.cell / 2);
        this.oy = Math.round(location.height / 2 - this.L.height * this.cell / 2);
        this.floorH = location.terrain.heightAt(location.width / 2, location.height / 2) + 1;
        this._mats = new Map();
        this._meshes = [];
        this._instances = [];
        this.focus = { x: 0, y: 0 };                 // camera.follow reads it
        this.buildFloor();
        this.buildWalls();
        this.buildDoors();
        this.buildObjects();
        this.buildCameraFrame();
        this.people = model.people.map((id, i) => this.buildPerson(HeistScene.PERSON_COLORS[i % HeistScene.PERSON_COLORS.length]));
        this.guards = this.L.guards.map(() => this.buildPerson(HeistScene.HEX.guard));
        this.loadModels();
        const s = this.center(model.start[0], model.start[1]);
        this.focus.x = s.x;
        this.focus.y = s.y;
    }

    // --- Coordinates and input -----------------------------------------------------

    center(cx, cy) {
        return { x: this.ox + (cx + 0.5) * this.cell, y: this.oy + (cy + 0.5) * this.cell };
    }

    // The grid cell under a canvas point (CSS px) or null outside the grid.
    pickCell(px, py) {
        const p = this.view.pointerToGround(px, py, this.floorH, null);
        if (!p) return null;
        const x = Math.floor((p.x - this.ox) / this.cell), y = Math.floor((p.y - this.oy) / this.cell);
        if (x < 0 || y < 0 || x >= this.L.width || y >= this.L.height) return null;
        return { x, y };
    }

    // --- Building ------------------------------------------------------------------

    mat(hex) {
        let m = this._mats.get(hex);
        if (!m) {
            m = new BABYLON.StandardMaterial('heist-' + hex.toString(16), this.scene);
            m.diffuseColor = World3D.hexColor3(hex);
            m.specularColor = BABYLON.Color3.Black();
            this._mats.set(hex, m);
        }
        return m;
    }

    add(mesh, kind, opts) {
        World3D.addObject(this.view, mesh, kind || 'prop', opts);
        this._meshes.push(mesh);
        return mesh;
    }

    // The floor: one plate, cells painted into a texture (floor, void, zones, the planned path).
    buildFloor() {
        const L = this.L, px = HeistScene.TEX_PX;
        this.floorTex = new BABYLON.DynamicTexture('heist-floor', { width: L.width * px, height: L.height * px }, this.scene, false);
        const m = new BABYLON.StandardMaterial('heist-floor-mat', this.scene);
        m.diffuseTexture = this.floorTex;
        m.specularColor = BABYLON.Color3.Black();
        this.floorMat = m;
        const w = L.width * this.cell, d = L.height * this.cell;
        const plate = BABYLON.MeshBuilder.CreateGround('heist-floor', { width: w, height: d }, this.scene);
        plate.material = m;
        plate.position.set(this.ox + w / 2, this.floorH, this.oy + d / 2);
        this.add(plate, 'prop', { castShadow: false, ink: false, outline: false });
        this.paintFloor(null);
    }

    // path — [[x, y], ...] cells of the selected person's plan, or null.
    paintFloor(path, mark) {
        const L = this.L, px = HeistScene.TEX_PX, C = HeistScene.COLORS;
        const ctx = /** @type {CanvasRenderingContext2D} */ (/** @type {unknown} */ (this.floorTex.getContext()));
        const street = this.model.screenOf(this.model.start[0], this.model.start[1])[1];
        for (let y = 0; y < L.height; y++) {
            for (let x = 0; x < L.width; x++) {
                const walk = this.model.walkable(x, y);
                let col = !walk ? C.void : Math.floor(y / 3) === street ? C.street : ((x + y) % 2 ? C.floorA : C.floorB);
                ctx.fillStyle = col;
                ctx.fillRect(x * px, y * px, px, px);
                const z = this.model.zoneBits(x, y);
                if (walk && z) {
                    ctx.fillStyle = z & 0x80 ? C.zone80 : z & 0x40 ? C.zone40 : C.zone20;
                    ctx.fillRect(x * px + 2, y * px + 2, px - 4, px - 4);
                }
            }
        }
        // Screen borders of the original (5 x 3 cells).
        ctx.strokeStyle = C.screenLine;
        ctx.lineWidth = 2;
        for (let x = 0; x <= L.width; x += 5) { ctx.beginPath(); ctx.moveTo(x * px, 0); ctx.lineTo(x * px, L.height * px); ctx.stroke(); }
        for (let y = 0; y <= L.height; y += 3) { ctx.beginPath(); ctx.moveTo(0, y * px); ctx.lineTo(L.width * px, y * px); ctx.stroke(); }
        if (path) {
            ctx.fillStyle = C.path;
            for (const [x, y] of path) ctx.fillRect(x * px + px / 3, y * px + px / 3, px / 3, px / 3);
        }
        if (mark) {
            ctx.strokeStyle = C.mark;
            ctx.lineWidth = 4;
            ctx.strokeRect(mark[0] * px + 3, mark[1] * px + 3, px - 6, px - 6);
        }
        this.floorTex.update(false);
    }

    // A box for an edge between cells a and b (a wall piece, a window, a door).
    edgeBox(name, a, b, h, t, hex) {
        const c = this.cell;
        const horizontal = a[0] === b[0];            // cells above each other -> the edge runs along x
        const m = BABYLON.MeshBuilder.CreateBox(name, horizontal
            ? { width: c + t, height: h, depth: t } : { width: t, height: h, depth: c + t }, this.scene);
        m.material = this.mat(hex);
        if (horizontal) m.position.set(this.ox + (a[0] + 0.5) * c, this.floorH + h / 2, this.oy + Math.max(a[1], b[1]) * c);
        else m.position.set(this.ox + Math.max(a[0], b[0]) * c, this.floorH + h / 2, this.oy + (a[1] + 0.5) * c);
        return m;
    }

    buildWalls() {
        const C = HeistScene.HEX, H = this.cfg.wallH, T = this.cfg.wallT;
        const walls = this.L.walls.map((w, i) => this.edgeBox('w' + i, [w[0], w[1]], [w[2], w[3]], H, T, C.wall));
        const wm = walls.length ? BABYLON.Mesh.MergeMeshes(walls, true) : null;
        if (wm) { wm.name = 'heist-walls'; this.add(wm, 'prop'); }
        const wins = [];
        this.L.windows.forEach((w, i) => {
            wins.push(this.edgeBox('wl' + i, w.a, w.b, H * 0.35, T, C.wall));
            const glass = this.edgeBox('wg' + i, w.a, w.b, H * 0.4, T * 0.6, C.glass);
            glass.position.y += H * 0.35;
            wins.push(glass);
        });
        const gm = wins.length ? BABYLON.Mesh.MergeMeshes(wins, true, true, undefined, false, true) : null;
        if (gm) { gm.name = 'heist-windows'; this.add(gm, 'prop'); }
    }

    buildDoors() {
        const H = this.cfg.wallH, T = this.cfg.wallT;
        this.doors = this.L.doors.map((d, i) => {
            const m = this.edgeBox('door' + i, d.a, d.b, H * 0.9, T * 1.6, HeistScene.HEX.door);
            this.add(m, 'prop');
            return { mesh: m, base: m.position.clone(), horizontal: d.a[0] === d.b[0], state: null };
        });
    }

    setDoor(i, state) {
        const d = this.doors[i];
        if (d.state === state) return;
        d.state = state;
        const H = HeistScene.HEX;
        d.mesh.material = this.mat(state === 'locked' ? H.locked : state === 'closed' ? H.closed : H.open);
        // An open door is turned across the opening (swung), a shut one fills it.
        d.mesh.rotation.y = state === 'open' ? Math.PI / 2 : 0;
        d.mesh.position.copyFrom(d.base);
    }

    // Objects: one shape per type, copies through thin instances; loot markers and alarm
    // panels are separate meshes (their state is shown).
    buildObjects() {
        const S = HeistScene.SHAPES, byType = new Map();
        for (const o of this.L.objects) {
            if (!byType.has(o.type)) byType.set(o.type, []);
            byType.get(o.type).push(o);
        }
        this.lootMarks = new Map();
        this.panels = new Map();
        this.L.objects.forEach((o, i) => {
            const p = this.center(o.x, o.y);
            if (o.loot) {
                const m = BABYLON.MeshBuilder.CreateBox('loot' + i, { width: 12, height: 8, depth: 12 }, this.scene);
                m.material = this.mat(HeistScene.HEX.loot);
                m.position.set(p.x, this.floorH + (S[o.type] || S.case).h + 6, p.y);
                this.add(m, 'actor', { castShadow: false });
                this.lootMarks.set(i, m);
            }
            if (o.type === 'alarm') {
                const circuit = this.model.circuitByName.get(o.controls);
                const m = BABYLON.MeshBuilder.CreateBox('panel' + i, { width: 20, height: 26, depth: 20 }, this.scene);
                m.material = this.mat(HeistScene.circuitHex(circuit ? circuit.bit : 0));
                m.position.set(p.x, this.floorH + 13, p.y);
                this.add(m, 'actor');
                this.panels.set(i, { mesh: m, bit: circuit ? circuit.bit : 0 });
            }
        });
        for (const [type, list] of byType) {
            if (type === 'alarm') continue;
            const sh = S[type] || S.case;
            let src;
            if (type === 'stairs') {
                src = new BABYLON.Mesh('stairs-src', this.scene);
                for (let k = 0; k < 3; k++) {
                    const st = BABYLON.MeshBuilder.CreateBox('step' + k, { width: this.cell * 0.8, height: 6 * (k + 1), depth: this.cell * 0.26 }, this.scene);
                    st.material = this.mat(sh.hex);
                    st.parent = src;
                    st.position.set(0, 3 * (k + 1), (k - 1) * this.cell * 0.26);
                }
            } else {
                src = BABYLON.MeshBuilder.CreateBox(type + '-src', { width: this.cell * sh.w, height: sh.h, depth: this.cell * sh.d }, this.scene);
                src.material = this.mat(sh.hex);
            }
            const items = list.map(o => {
                const p = this.center(o.x, o.y);
                return { x: p.x, y: p.y, h: this.floorH + (type === 'stairs' ? 0 : sh.h / 2) + (sh.lift || 0) };
            });
            const inst = World3D.addInstances(this.view, src, 'prop', items);
            this._instances.push(inst);
            this._meshes.push(src);
        }
    }

    buildCameraFrame() {
        const c = this.cell, w = 5 * c, d = 3 * c, t = 6, h = 4;
        const root = new BABYLON.Mesh('camframe', this.scene);
        const bars = [[w, t, 0, -d / 2], [w, t, 0, d / 2], [t, d, -w / 2, 0], [t, d, w / 2, 0]];
        for (const [bw, bd, x, z] of bars) {
            const b = BABYLON.MeshBuilder.CreateBox('camframe-bar', { width: bw, height: h, depth: bd }, this.scene);
            b.material = this.mat(HeistScene.HEX.camera);
            b.parent = root;
            b.position.set(x, h / 2, z);
        }
        this.add(root, 'actor', { castShadow: false });
        this.camFrame = root;
        root.setEnabled(false);
    }

    // A person: a colored disc now, the character model when it has loaded.
    buildPerson(hex) {
        const disc = BABYLON.MeshBuilder.CreateCylinder('person-disc', { height: 3, diameter: this.cell * 0.7, tessellation: 20 }, this.scene);
        disc.material = this.mat(hex);
        this.add(disc, 'actor', { castShadow: false });
        return { disc, base: disc.material, body: null, clips: null, x: 0, y: 0, heading: Math.PI / 2 };
    }

    loadModels() {
        Model3D.load('assets/models/character.glb', this.scene).then((model) => {
            if (this.disposed) return;
            const all = this.people.concat(this.guards);
            for (const p of all) {
                const body = Model3D.build(model, this.scene, { name: 'person' });
                const s = this.cfg.personScale;
                body.scaling.set(s, s, s);
                this.add(body, 'actor');
                p.body = body;
                p.clips = Model3D.clips(body);
                this._meshes = this._meshes.filter(m => m !== body);   // bodies go through Model3D.dispose
            }
        }).catch(() => { /* no model: the discs stay */ });
    }

    // --- Frame -----------------------------------------------------------------------

    // Places a person between two cells (k 0..1); moving — the run clip.
    placePerson(p, a, b, k, state) {
        const far = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) > 1;
        const pa = this.center(a[0], a[1]), pb = this.center(b[0], b[1]);
        const t = far ? (k < 0.5 ? 0 : 1) : k;
        const x = pa.x + (pb.x - pa.x) * t, y = pa.y + (pb.y - pa.y) * t;
        const moving = !far && (a[0] !== b[0] || a[1] !== b[1]);
        if (moving) p.heading = Math.atan2(pb.y - pa.y, pb.x - pa.x);
        p.x = x;
        p.y = y;
        p.disc.position.set(x, this.floorH + 1.5, y);
        p.disc.material = state === 'stun' ? this.mat(HeistScene.HEX.stunned) : p.base;
        if (p.body) {
            p.body.position.set(x, this.floorH, y);
            p.body.rotation.y = -p.heading;
            p.body.rotation.z = state === 'stun' ? Math.PI / 2 : 0;
            p.body.setEnabled(state !== 'gone');
            if (p.clips) p.clips.play(moving ? 'run' : 'idle');
        }
    }

    // A planned moment: every person at their plan cell of second t (fr — 0..1 inside it).
    renderPlan(plan, t, fr) {
        this.model.people.forEach((id, i) => {
            const cells = plan[id].cells;
            const a = cells[Math.min(cells.length - 1, t)], b = cells[Math.min(cells.length - 1, t + 1)];
            this.placePerson(this.people[i], a, b, fr, 'ok');
        });
        this.L.guards.forEach((g, i) => {
            const at = (s) => g.static ? g.static : g.route[((s - g.t0) % g.route.length + g.route.length) % g.route.length];
            this.placePerson(this.guards[i], at(t), at(t + 1), fr, 'ok');
        });
        this.showCamera(this.model.cameraAt(t, 0xff));
        this.L.doors.forEach((d, i) => this.setDoor(i, d.state));
        for (const [i, m] of this.lootMarks) m.setEnabled(true);
        for (const [, pn] of this.panels) pn.mesh.material = this.mat(HeistScene.circuitHex(pn.bit));
    }

    // An execution moment between frames a and b.
    renderRun(a, b, fr) {
        a.people.forEach((p, i) => {
            const q = b.people[i];
            this.placePerson(this.people[i], [p.x, p.y], [q.x, q.y], fr, p.stun ? 'stun' : 'ok');
        });
        a.guards.forEach((g, i) => {
            const q = b.guards[i];
            this.placePerson(this.guards[i], [g.x, g.y], [q.x, q.y], fr, g.stun ? 'stun' : 'ok');
        });
        this.showCamera(a.camera);
        a.doors.forEach((s, i) => this.setDoor(i, s));
        for (const [i, m] of this.lootMarks) m.setEnabled(!a.objects[i].robbed);
        for (const [, pn] of this.panels) pn.mesh.material = this.mat(a.enabled & pn.bit ? HeistScene.circuitHex(pn.bit) : HeistScene.HEX.off);
    }

    showCamera(screen) {
        if (!screen) { this.camFrame.setEnabled(false); return; }
        this.camFrame.setEnabled(true);
        const c = this.cell;
        this.camFrame.position.set(this.ox + (screen[0] * 5 + 2.5) * c, this.floorH + 1, this.oy + (screen[1] * 3 + 1.5) * c);
    }

    dispose() {
        this.disposed = true;
        for (const inst of this._instances) inst.dispose();
        for (const p of this.people.concat(this.guards)) if (p.body) Model3D.dispose(this.view, p.body);
        for (const m of this._meshes) World3D.removeObject(this.view, m);
        for (const m of this._mats.values()) m.dispose();
        this.floorMat.dispose();
        this.floorTex.dispose();
    }

    static circuitHex(bit) {
        const H = HeistScene.HEX;
        return bit === 0x80 ? H.c80 : bit === 0x40 ? H.c40 : bit === 0x20 ? H.c20 : bit === 0x10 ? H.camera : H.off;
    }
}

HeistScene.TEX_PX = 32;          // texture px per cell of the floor
HeistScene.COLORS = {            // floor texture (CSS colors)
    floorA: '#d8d0c0', floorB: '#cfc6b4', street: '#8d949b', void: '#2b2d31',
    zone20: '#f2b35e', zone40: '#b894e0', zone80: '#e57b72',
    screenLine: 'rgba(40,40,60,0.35)', path: '#1f5fbf', mark: '#1f5fbf'
};
HeistScene.HEX = {               // mesh colors
    wall: 0x4a4e57, glass: 0x7fd3e6, door: 0x9a6b3c, locked: 0xc0392b, closed: 0xe08a2e, open: 0x55a84f,
    loot: 0xf2c230, camera: 0x19a88a, off: 0x777777, stunned: 0x999999,
    c20: 0xf2a33a, c40: 0x9b6fd6, c80: 0xd9534f, guard: 0xb03030
};
HeistScene.PERSON_COLORS = [0x2e86de, 0x10ac84, 0xee5253, 0xff9f43, 0x222f3e];   // crew 1-4, Boss
HeistScene.SHAPES = {            // w, d — part of the cell; h — px
    case: { w: 0.6, d: 0.6, h: 16, hex: 0xe8d44d },
    box: { w: 0.7, d: 0.5, h: 18, hex: 0xb0b7bf },
    desk: { w: 0.75, d: 0.5, h: 14, hex: 0x8b5a2b },
    sink: { w: 0.55, d: 0.55, h: 14, hex: 0xe8eef2 },
    till: { w: 0.5, d: 0.4, h: 12, hex: 0x3aa6a0 },
    safe: { w: 0.6, d: 0.6, h: 26, hex: 0x3d4148 },
    vault: { w: 0.85, d: 0.85, h: 30, hex: 0x2c3036 },
    painting: { w: 0.5, d: 0.12, h: 20, hex: 0xc9a227, lift: 8 },
    camera: { w: 0.25, d: 0.25, h: 8, hex: 0x19a88a, lift: 22 },
    stairs: { w: 0.8, d: 0.8, h: 18, hex: 0x7a7f88 },
    type_1: { w: 0.5, d: 0.5, h: 10, hex: 0x999999 }
};
