// CoopSceneProps.js — a part of CoopScene (CoopScene.js): the models of the level (CoopProps)
// and what the state does to them. The walls and posts baked into one mesh per file; doors and
// their leaves swinging open, the sensor lamps; the panel, cameras, the van and the laser beam; the
// police car coming and stopping, the van driving off at the end; the loot on its vitrines and
// pedestals, the glass breaking and its shards. Methods of the scene, mixed into its prototype.

/** @satisfies {ThisType<CoopScene>} */
const CoopSceneProps = {
    // Walls and the posts at their joints: a model a placement, merged into one mesh per file
    // and material (the brief: "the game merges the pieces into one mesh") — a draw call for all
    // the segments, not one a cell.
    buildWalls() {
        /** @type {Map<string, { x: number, y: number, yaw: number }[]>} */
        const byFile = new Map();
        for (const p of CoopProps.walls(this.M).concat(CoopProps.posts(this.M))) {
            if (!byFile.has(p.file)) byFile.set(p.file, []);
            byFile.get(p.file).push(p);
        }
        for (const [file, places] of byFile) this.bake(file, places, undefined, (mat) => { this.keepPanel(mat); this.glowWall(mat); });
    },

    // The walls' inner faces (material wall_panel): kept with their model's picture, so that the acceptance stand
    // (CoopStand) can put another one on them and take it off; a wall baked later takes the stand's picture.
    keepPanel(mat) {
        if (mat.name.slice(mat.name.lastIndexOf('/') + 1) !== 'wall_panel') return;
        this._panelOwn.set(mat, mat.diffuseTexture);
        if (this._standTex) mat.diffuseTexture = this._standTex;
    },

    // The stand's picture on the walls' inner faces: url — a data: URL of a PNG or JPG, null — the model's own back.
    // The new texture samples as the model's (a glTF texture is not flipped: invertY false).
    /** @param {string | null} url */
    setWallPicture(url) {
        const old = this._standTex && (!url || this._standTex.url !== url) ? this._standTex : null;
        if (old) this._standTex = null;
        if (url && !this._standTex) {
            const own = this.ownWallPicture();
            const tex = new BABYLON.Texture(url, this.scene, { invertY: own ? own.invertY : false });
            if (own) { tex.wrapU = own.wrapU; tex.wrapV = own.wrapV; }
            this._standTex = tex;
        }
        for (const [m, own] of this._panelOwn) m.diffuseTexture = this._standTex || own;
        if (old) old.dispose();
    },

    // The model's own picture of the walls' inner faces (the stand compares with it); null — the walls not loaded yet.
    /** @returns {BABYLON.Texture | null} */
    ownWallPicture() {
        for (const own of this._panelOwn.values()) if (own) return /** @type {BABYLON.Texture} */ (own);
        return null;
    },

    // Night: the shop's light from above grazes the walls, their inner faces (material wall_panel) would
    // be near black — they glow while the light is on, as the floor does (paintGlow; Ivan 17.11).
    glowWall(mat) {
        if (!this.night || mat.name.slice(mat.name.lastIndexOf('/') + 1) !== 'wall_panel') return;
        this._wallMats.push(mat);
        const g = !this._wallsLit ? 0 : CoopScene.NIGHT.wallGlow;
        mat.emissiveColor.set(g, g, g);
    },

    glowWalls(on) {
        this._wallsLit = on;
        const g = on ? CoopScene.NIGHT.wallGlow : 0;
        for (const m of this._wallMats) m.emissiveColor.set(g, g, g);
    },

    // opts — World3D.addObject options over the walls' own; paint(mat, mesh) — called on each merged material and its mesh.
    // The model is built once: each place moves it and takes its meshes' vertices in the world, merged
    // as BABYLON.Mesh.MergeMeshes does, byte for byte (a build a place took 13 s for the town's 5000 pieces).
    // Unlike MergeMeshes, meshes of one material with different sideOrientation are merged, not dropped:
    // the glTF loader and Gltf3D keep the flag on the material, the meshes keep the default.
    bake(file, places, opts, paint) {
        this.loadModel(file).then((model) => {
            if (this.disposed) return;
            const t = LoadLog.clock();
            const node = new BABYLON.TransformNode('coop-' + file, this.scene);
            const root = Model3D.build(model, this.scene, { name: file });
            root.parent = node;
            const all = /** @type {BABYLON.Mesh[]} */ (root.getChildMeshes(false)).filter(m => m.material);
            const mats = new Set(all.map(m => m.material)), meshes = all.filter(m => m.getTotalVertices());
            const data = meshes.map(m => BABYLON.VertexData.ExtractFromMesh(m, false, false));
            /** @type {Map<string, { mesh: BABYLON.Mesh, parts: BABYLON.VertexData[] }>} */
            const groups = new Map();
            for (const p of places) {
                node.scaling.setAll(1);   // keep: a fresh node's scale — placeAt sets it only for a stretched place
                this.placeAt(node, p);
                CoopScene.fresh(node);
                meshes.forEach((m, i) => {
                    const key = m.material.name;
                    if (!groups.has(key)) groups.set(key, { mesh: m, parts: [] });
                    groups.get(key).parts.push(CoopScene.moved(data[i], m.getWorldMatrix()));
                });
            }
            for (const { mesh, parts } of groups.values()) {
                const mat = mesh.material, merged = new BABYLON.Mesh('coop-' + mat.name, this.scene);
                parts[0].merge(parts.slice(1), true).applyToMesh(merged);
                merged.checkCollisions = mesh.checkCollisions;
                merged.sideOrientation = mesh.sideOrientation;
                merged.material = mat;
                if (paint) paint(mat, merged);
                this.add(merged, 'prop', Object.assign({ bare: CoopScene.bare }, opts));
                this._modelMats.add(mat);
                mats.delete(mat);
            }
            node.dispose();
            for (const m of mats) m.dispose();
            LoadLog.add(LoadLog.clock() - t, 'bake ' + file, places.length + ' pieces');
        }, () => {});
    },

    buildDoors() {
        this.doors = CoopProps.doors(this.M).map((p) => {
            const d = { def: this.M.doors[p.i], p, file: p.file, m: null, node: null, open: /** @type {boolean | null} */ (null), unl: false,
                hinge: /** @type {BABYLON.Vector3 | null} */ (null) };
            d.node = this.spawn(p.file, p, 'prop', (m) => { d.m = m; this.showDoor(d); });
            this.tapNodes.set(d.node, { obj: { kind: 'door', i: p.i } });   // rules, section 25 (Ivan 08.11)
            return d;
        });
    },

    // unl — the lock is off (picked): the tint turns as at an open door, the leaf stays shut.
    setDoor(i, open, unl) {
        const d = this.doors[i];
        if (d.open === open && d.unl === unl) return;
        d.open = open;
        d.unl = unl;
        this.showDoor(d);
    },

    // A door as it is: an open leaf lies along the wall (Ivan 21.10 evening: «чтобы не возникало
    // ощущение, что открытая дверь закрывает проход вдоль стены») — half a turn on its hinges onto
    // the face of the wall beside the opening, on the side the door opens to; in a corner a quarter
    // turn, along the wall across (Ivan 24.10: not through a wall, not over another doorway —
    // CoopProps.openLeaf);
    // the shutter of an open gate hidden (it may not go up: it would cover the view), the tint
    // (lock plate, lamp) — locked by its lock's colour or open.
    showDoor(d) {
        if (!d.m || d.open === null) return;
        const { n, rest, mats } = d.m, H = CoopScene.HEX, lock = d.def.lock, open = d.open;
        if (n.leaf && rest.leaf) this.layLeaf(d, n.leaf, rest.leaf, open);
        if (n.jamb_free) n.jamb_free.setEnabled(!d.p.joined);   // no post where two leaves meet (Ivan 21.10)
        if (n.shutter) n.shutter.setEnabled(!open);
        if (mats.tint) {
            mats.tint.diffuseColor = World3D.hexColor3(open || d.unl ? H.opened : lock === 'vault' ? H.vault : lock === 'electronic' ? H.electro : H.locked);
        }
    },

    // The leaf at rest (shut) or turned by p.swing (a heading: rotation.y turns the other way) onto
    // what it lies on: its hinge (the leaf's own origin) moved DOOR_FLAT_OUT of a cell along p.lean —
    // clear of the jamb and the wall.
    layLeaf(d, leaf, rest, open) {
        leaf.rotation.y = rest.r.y;
        leaf.position.copyFrom(rest.p);
        if (!open) return;
        if (!d.hinge) {
            const chain = [];
            for (let node = leaf; node; node = node.parent) chain.unshift(node);
            for (const node of chain) node.computeWorldMatrix(true);
            d.hinge = leaf.getAbsolutePosition().clone();
        }
        const out = CoopScene.DOOR_FLAT_OUT * this.cell, h = d.hinge, [lx, ly] = d.p.lean;
        leaf.rotation.y = rest.r.y - d.p.swing * Math.PI / 180;
        leaf.setAbsolutePosition(new BABYLON.Vector3(h.x + lx * out, h.y, h.z + ly * out));
    },

    // The lamp of a door's sensor (Ivan 19.10: not an object in the doorway — a light on the wall
    // by the opening, the stub's node sensor): only on a door with a sensor; it blinks while the
    // sensor is armed (the light is on) and is dark without the light. sec — real seconds: it
    // blinks in the plan too.
    showSensors(power, sec) {
        const H = CoopScene.HEX;
        for (const d of this.doors) {
            if (!d.m || !d.m.n.sensor) continue;
            d.m.n.sensor.setEnabled(!!d.def.sensor);
            const lamp = d.m.mats.screen;
            if (!lamp || !d.def.sensor) continue;
            const on = CoopScene.sensorLit(power, sec);
            lamp.diffuseColor = World3D.hexColor3(on ? H.sensorOn : H.screenOff);
            lamp.emissiveColor = on ? World3D.hexColor3(H.sensorOn) : BABYLON.Color3.Black();
        }
    },

    // The wheel of a shut vault door turns while somebody works its lock.
    spinWheels(a, k) {
        for (const d of this.doors) {
            if (!d.m || !d.m.n.wheel || !d.m.rest.wheel || d.open) continue;
            if (a.h.some(h => h.work && this.M.touchesDoor(d.def, h.x, h.y))) {
                d.m.n.wheel.rotation.z = d.m.rest.wheel.r.z + (a.t + k) * CoopScene.WHEEL_TURN;
            }
        }
    },

    // The objects (CoopProps.props) and the laser beam: the beam is the game's (brief, section 7),
    // a red bar along the laser cells at the height of the emitters' window, hidden while the
    // power is off.
    buildProps() {
        const M = this.M, c = this.cell;
        /** @type {{ role: string, cam: number, door: number, panel: number, m: any, node: BABYLON.TransformNode | null, power: boolean | null }[]} */
        this.props = [];
        /** @type {{ node: BABYLON.TransformNode, home: number } | null} */
        this.van = null;
        for (const p of CoopProps.props(M, this.cfg.wallT / 2 / c)) {
            const v = { role: p.role, cam: p.cam === undefined ? -1 : p.cam, door: p.door === undefined ? -1 : p.door, panel: p.panel === undefined ? -1 : p.panel, m: null, node: null, power: null };
            v.node = this.spawn(p.file, p, 'prop', (m) => {
                v.m = m;
                if (m.n.roof) m.n.roof.setEnabled(false);    // the van: the crew stands in the bed
            }, p.file === 'prop_puddle' ? { castShadow: false } : undefined);
            this.props.push(v);
            if (p.role === 'panel') this.tapNodes.set(v.node, { obj: { kind: 'panel', i: v.panel } });
            if (p.file === 'prop_keypad') this.tapNodes.set(v.node, { obj: { kind: 'gate', i: v.door } });
            if (p.role === 'van') this.van = { node: v.node, home: v.node.position.x };
        }
        // the laser beams: one box a beam over its cells, along a row or a column
        /** @type {BABYLON.Mesh[]} */
        this.lasers = M.beams.map((/** @type {number[][]} */ cells, /** @type {number} */ i) => {
            const b = CoopScene.beamBox(cells);
            const beam = BABYLON.MeshBuilder.CreateBox('coop-lasers-' + i, { width: b.w * c || CoopScene.BEAM_T, height: CoopScene.BEAM_T, depth: b.d * c || CoopScene.BEAM_T }, this.scene);
            const bm = this.mat(CoopScene.HEX.laser);
            bm.emissiveColor = World3D.hexColor3(CoopScene.HEX.laser);
            beam.material = bm;
            beam.position.set(this.ox + b.x * c, this.floorH + CoopScene.BEAM_H, this.oy + b.y * c);
            this.add(beam, 'prop', { castShadow: false, ink: false, outline: false });
            return beam;
        });
    },

    // The police car (Ivan 19.10: after an alarm it comes along the street, from the van's
    // police_from end): hidden until it is in from beyond the level's edge (policeX) — the tick
    // policeAt the game sets for a take.
    buildPolice() {
        /** @type {number | null} */
        this.policeAt = null;
        const stop = CoopScene.policeStop(this.M);
        this.police = stop && { node: /** @type {BABYLON.TransformNode | null} */ (null), m: null, stop };
        if (!this.police) return;
        const car = this.police;
        car.node = this.spawn('prop_police_car', { x: stop.x, y: stop.y, yaw: stop.from === 'W' ? CoopModel.ANGLE.R : CoopModel.ANGLE.L }, 'prop', (m) => { car.m = m; });
        car.node.setEnabled(false);
    },

    // The police car at the moment t (ticks of the take): by the building's corner on the tick
    // policeAt (policeX); with no police the start's car (rules, section 35), introT seconds into it
    // (introPolice), facing the van's exit — gone, its clock is dropped. The lights flash red and
    // blue in turn (real seconds sec).
    showPolice(t, sec) {
        const car = this.police;
        if (!car || !car.node) return;
        const intro = this.introT != null && this.policeAt == null;
        const x = intro ? CoopScene.introPolice(this.M, /** @type {number} */ (this.introT)) : CoopScene.policeX(this.M, t, this.policeAt);
        car.node.setEnabled(x !== null);
        if (x === null) {
            if (intro) this.introT = null;
            return;
        }
        car.node.position.x = this.ox + x * this.cell;
        const van = this.M.L.objects.find((/** @type {any} */ o) => o.kind === 'van');
        const east = intro ? van.exit === 'E' : car.stop.from === 'W';
        car.node.rotation.y = -(east ? CoopModel.ANGLE.R : CoopModel.ANGLE.L) * Math.PI / 180;
        if (!car.m) return;
        const H = CoopScene.HEX, red = Math.floor(sec * CoopScene.POLICE_FLASH * 2) % 2 === 0;   // keep: red in the even halves of a flash
        for (const [mat, on, hex] of [[car.m.mats.tint, red, H.policeRed], [car.m.mats.screen, !red, H.policeBlue]]) {
            if (!mat) continue;
            mat.diffuseColor = World3D.hexColor3(on ? hex : H.screenOff);
            mat.emissiveColor = on ? World3D.hexColor3(hex) : BABYLON.Color3.Black();
        }
    },

    // The end of a take (Ivan 19.10): the van drives off to its exit (E or W) — s, 0..1 of the drive —
    // with the heroes in it (frame a: in a van cell, not caught); 0 puts it back. The start's drive in
    // (introS, rules, section 35) moves them alike. Nothing of theirs
    // stays behind (Ivan 20.10, the screenshot): the van's floor — paintFloor's vanGone.
    showOutro(a, s) {
        const dx = (CoopScene.vanAway(this.M, s) + CoopScene.vanIn(this.M, this.introS == null ? 1 : this.introS)) * this.cell;
        if (this.van && this.van.node) this.van.node.position.x = this.van.home + dx;
        if (!dx) return;
        a.h.forEach((/** @type {any} */ h, /** @type {number} */ i) => {
            const p = this.heroes[i];
            if (!p || !this.M.inVan(h)) return;
            p.root.position.x += dx;
        });
    },

    // The objects by the power (a frame's flags, one a panel) and the moment t (ticks): each
    // panel's lamp and lever by its own flag, the cameras' heads and lamps by what switches them
    // off, the screens of the monitors and the keypad by the light.
    showProps(power, t) {
        const H = CoopScene.HEX, M = this.M;
        for (const v of this.props) {
            if (!v.m) continue;
            const on = v.role === 'panel' ? (Array.isArray(power) ? power[v.panel] !== false : !!power)
                : v.role === 'camera' ? M.isArmed(M.cameras[v.cam].id, power) : M.isArmed('light', power);
            const { n, rest, mats } = v.m, flip = v.power !== on;
            v.power = on;
            if (v.role === 'camera') {
                const cam = this.M.cameras[v.cam];
                if (n.head && rest.head) n.head.rotation.y = rest.head.r.y - (this.M.cameraAngle(cam, t) - cam.base) * Math.PI / 180;
            }
            if (!flip) continue;
            if (v.role === 'panel' && n.lever && rest.lever) n.lever.rotation.x = rest.lever.r.x + (on ? 0 : CoopScene.LEVER_DOWN);
            if (mats.tint && (v.role === 'panel' || v.role === 'camera')) {
                mats.tint.diffuseColor = World3D.hexColor3(v.role === 'panel' ? (on ? H.lampOn : H.lampOff) : (on ? H.camOn : H.camOff));
            }
            if (mats.screen && v.role === 'screens') {
                mats.screen.diffuseColor = World3D.hexColor3(on ? H.screenOn : H.screenOff);
                mats.screen.emissiveColor = on ? World3D.hexColor3(H.screenGlow) : BABYLON.Color3.Black();
            }
        }
    },

    // Loot: its model (the field model of the item) on the floor, or on the cushion of its vitrine
    // (the jewel node of the vitrine model is hidden: the item stands in its place); the shards of
    // the cover wait hidden until the glass breaks. The item's width and height are the brief's
    // until its file has loaded. An item on a pedestal (stand) stands on top of prop_pedestal — its
    // own file, the model's height (rules, section 16). A painting on a wall (field wall) hangs flush on its face, facing
    // into its cell, while it is at home (rules, section 10: CoopProps.lootPose).
    buildLoot() {
        this.loot = this.M.loot.map((l, i) => {
            const at = CoopProps.lootPose(this.M, l, this.cfg.wallT / 2 / this.cell), bar = !l.glass && !l.stand;
            const v = { item: /** @type {BABYLON.TransformNode} */ (/** @type {unknown} */ (null)), home: l.at, pose: l.wall ? at : null, w: bar ? CoopScene.BAR_W : CoopScene.ITEM_W, h: bar ? CoopScene.BAR_H : CoopScene.ITEM_H,
                cushion: bar ? 0 : CoopScene.CUSHION, vitrine: null, shards: null, broken: false, bare: !l.glass, held: false };
            v.item = this.spawn(l.model, at, 'actor', (m) => { v.w = m.size.w; v.h = m.size.h; }, { castShadow: false });
            // a tap on the item, its vitrine or pedestal or the shards works the item (rules, section 25)
            const tap = (/** @type {BABYLON.Node} */ node) => this.tapNodes.set(node, { obj: { kind: 'loot', i } });
            this.tapNodes.set(v.item, { obj: { kind: 'loot', i }, held: () => v.held });
            if (l.stand) {
                tap(this.spawn('prop_pedestal', at, 'prop', (m) => { v.vitrine = m; v.cushion = m.size.h; }));
            } else if (!bar) {
                tap(this.spawn('loot_vitrine', at, 'prop', (m) => {
                    v.vitrine = m;
                    if (m.n.jewel) {
                        CoopScene.fresh(m.node);
                        v.cushion = m.n.jewel.getAbsolutePosition().y - this.floorH;
                        m.n.jewel.setEnabled(false);
                    }
                    this.showGlass(v);
                }));
                if (l.glass) tap(this.spawn('loot_vitrine_shards', at, 'prop', (m) => { v.shards = m; this.scatter(m); this.showGlass(v); }));
            }
            return v;
        });
    },

    showGlass(v) {
        if (v.vitrine && v.vitrine.n.glass) v.vitrine.n.glass.setEnabled(!v.broken && !v.bare);
        if (v.shards) v.shards.node.setEnabled(v.broken);
    },

    // The shards of a broken cover round the stand: a piece standing upright falls outwards
    // flat, every piece moves out from the middle by SHARD_OUT and lies on the floor. Works in
    // the space of the shard's parent (the model file: metres), whatever the shard's pivot.
    scatter(m) {
        CoopScene.fresh(m.node);
        for (let k = 1; k <= 6; k++) {   // keep: the model loot_vitrine_shards has shard_1…shard_6
            const s = /** @type {BABYLON.AbstractMesh} */ (/** @type {unknown} */ (m.n['shard_' + k]));
            if (!s || !s.parent || !s.getHierarchyBoundingVectors) continue;
            const box = () => {
                CoopScene.fresh(s);
                const inv = /** @type {BABYLON.TransformNode} */ (s.parent).computeWorldMatrix(true).clone().invert();
                const { min, max } = s.getHierarchyBoundingVectors(true);
                const a = BABYLON.Vector3.TransformCoordinates(min, inv), b = BABYLON.Vector3.TransformCoordinates(max, inv);
                return { lo: BABYLON.Vector3.Minimize(a, b), hi: BABYLON.Vector3.Maximize(a, b) };
            };
            let { lo, hi } = box();
            const c = lo.add(hi).scale(0.5), len = Math.hypot(c.x, c.z) || 1, dx = c.x / len, dz = c.z / len;
            if (hi.y - lo.y > Math.max(hi.x - lo.x, hi.z - lo.z)) {
                // tip over about the horizontal axis across the way out, keeping the middle in place
                const q = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(dz, 0, -dx), Math.PI / 2);
                const pivot = s.position.clone(), arm = c.subtract(pivot);
                const turned = BABYLON.Vector3.Zero();
                arm.rotateByQuaternionToRef(q, turned);
                s.rotationQuaternion = q.multiply(s.rotationQuaternion || BABYLON.Quaternion.FromEulerVector(s.rotation));
                s.position.copyFrom(c.subtract(turned));
            }
            s.position.x += dx * CoopScene.SHARD_OUT;
            s.position.z += dz * CoopScene.SHARD_OUT;
            ({ lo, hi } = box());
            s.position.y -= lo.y;
        }
    },
};
Object.assign(CoopScene.prototype, CoopSceneProps);
