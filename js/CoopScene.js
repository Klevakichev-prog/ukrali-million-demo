// CoopScene.js — shows the co-op reference level in 3D: the floor painted by rooms, the laser
// beam, the planned routes and the vision cones of guards and cameras; the models of the level
// (CoopProps: walls, doors, the panel, cameras, the van, the puddle, gold bars, vitrines — each a
// .glb of the modelling brief, the stubs until the modeller's files replace them) moved by the
// state: doors swing open, the lever drops, lamps and screens change colour, the glass breaks;
// the four heroes and the guards — the character models of the brief (CoopRig: the node tree of
// section 5, moved by the replay), colored "beans" sized by mass until a model file arrives or
// without it. Pure view: it reads CoopModel frames (CoopRun.frames — a take or the ghost of
// the plan) and decides nothing; pickCell answers which cell a tap hit, for input only.
//
// Cells: cell (cx, cy) spans world px [ox + cx·cell, ox + (cx+1)·cell) along x, the same with
// oy along y; the grid is centered on the location.
//
// Parts of the class (Game/CLAUDE.md, «Parts of a class»): CoopSceneGround.js — the floor, the town,
// the night; CoopSceneProps.js — the models of the level and what the state does to them;
// CoopSceneBodies.js — the heroes and the guards.

class CoopScene {
    // location — Location3D; model — CoopLevelModel; cfg — CoopGame.cfg()
    constructor(location, model, cfg) {
        this.location = location;
        this.view = location.view;
        this.scene = location.view.scene;
        this.M = model;
        this.cfg = cfg;
        this.cell = cfg.cellPx;
        this.ox = Math.round(location.width / 2 - model.W * this.cell / 2);
        this.oy = Math.round(location.height / 2 - model.H * this.cell / 2);
        this.floorH = location.terrain.heightAt(location.width / 2, location.height / 2) + 1;
        this._mats = new Map();
        this._meshes = [];
        this.focus = { x: 0, y: 0 };                 // camera.follow reads it
        this._floorKey = '';
        /** @type {{ cells: number[][], hex: string, bold: boolean }[]} */
        this.routes = [];                            // planned routes painted on the floor
        /** @type {{ hero: number, mark: number } | null} */
        this.selRing = null;                         // the selected hero of a single game's plan (CoopGame.refresh)
        /** @type {BABYLON.Mesh | null} */
        this.ring = null;                            // his ring on the floor (showRing)
        this.hintOn = true;                          // the valuable loot's floor glows (CoopGame.hintOn, rules, section 15)
        /** @type {number[] | null} */
        this.askCell = null;                         // the cell the advice of «?» points at (CoopGame.ask, rules, section 24)
        this.outroS = 0;                             // 0..1 of the van's drive off at the end of a take (CoopGame.outro)
        this.introS = 1;                             // 0..1 of the van's drive in at the start (rules, section 35; CoopGame.intro); 1 — in its place
        // The main screen's background (CoopGame.stageMenu, rules, section 36): per hero where he stands
        // ({ at: cells, yaw: degrees }), the node names hidden, the van's floor bare.
        /** @type {{ at: number[], yaw: number }[] | null} */
        this.pins = null;
        /** @type {string[] | null} */
        this.hideNames = null;
        this.hideVan = false;
        this.hiddenAt = -1;                          // the count of the scene's nodes at the last sweep (hideNodes)
        /** @type {number | null} */
        this.introT = null;                          // real seconds of the start's police car (introPolice); null — none
        /** @type {{ hero: number, x: number, y: number, side: string | null, f: string, work: boolean, text: string, signs: { hero: number, icon: string, end: number, work: boolean, text: string }[] }[]} */
        this.ghosts = [];                            // the plan's signs by cell (CoopGame.planGhosts)
        this.disposed = false;
        /** @type {string[]} */
        this.modelIssues = [];
        /** @type {((lines: string[]) => void) | null} */
        this.onModelIssue = null;
        /** @type {BABYLON.TransformNode[]} */
        this._nodes = [];                            // where the models of the level stand
        /** @type {BABYLON.Mesh[]} */
        this._models = [];                           // their built roots
        /** @type {Map<BABYLON.Node, { obj: { kind: string, i: number }, held?: () => boolean }>} */
        this.tapNodes = new Map();                   // the models a tap works (rules, section 25)
        /** @type {Map<BABYLON.Node, { kind: string, i: number }>} */
        this.hintNodes = new Map();                  // the guards and the heroes: a hint, no tap (rules, section 26)
        /** @type {Record<string, { key: string, obj: { kind: string, i: number } | null, hex: string | null, layers: Map<number, BABYLON.HighlightLayer> } | null>} */
        this.outlines = { hover: null, mark: null };   // the object under the cursor (rules, section 26), the tutorial's target (section 27)
        /** @type {{ x: number, y: number, mark: number } | null} */
        this.tutRing = null;                         // the tutorial step's cell (CoopGame.tutView, rules, section 27)
        /** @type {BABYLON.Mesh | null} */
        this.cellRing = null;                        // its ring on the floor (showRing)
        this.blinkOn = true;                         // the target's blink is lit (setBlink)
        /** @type {Set<BABYLON.Material>} */
        this._modelMats = new Set();                 // materials of the merged walls
        /** @type {BABYLON.StandardMaterial[]} */
        this._wallMats = [];                         // night: the walls' inner faces that glow (glowWall)
        this._wallsLit = true;                       // night: the building's light is on (glowWalls)
        /** @type {Map<BABYLON.StandardMaterial, BABYLON.BaseTexture | null>} */
        this._panelOwn = new Map();                  // the walls' inner faces (wall_panel) and their model's picture (setWallPicture)
        /** @type {BABYLON.Texture | null} */
        this._standTex = null;                       // the acceptance stand's picture on them (CoopStand), null — the model's own
        this.city = CoopCity.layout(model, this.townRect());   // the town round the level (Ivan 05.11)
        // the level's field night (Ivan 05.11: level 1 at night); cfg.night — the stand's day / night over it (CoopGame.nightFromUrl)
        this.night = cfg.night != null ? !!cfg.night : !!model.L.night;
        // The loading log (LoadLog.js): the build calls' own time; the model files and the merge of
        // the walls and houses (bake) are logged when the files arrive.
        if (this.night) LoadLog.time('scene night', () => this.buildNight());
        LoadLog.time('scene floor', () => this.buildFloor());
        LoadLog.time('scene city', () => this.buildCity());
        LoadLog.time('scene walls', () => this.buildWalls());
        LoadLog.time('scene doors', () => this.buildDoors());
        LoadLog.time('scene props', () => this.buildProps());
        LoadLog.time('scene police', () => this.buildPolice());
        LoadLog.time('scene loot', () => this.buildLoot());
        this.heroes = LoadLog.time('scene heroes', () => model.heroes.map(h => this.buildBean(h.color, CoopModel.bodyRadius(h.mass), false)));
        this.guards = LoadLog.time('scene guards', () => model.guards.map(() => this.buildBean(CoopScene.HEX.guard, CoopModel.GUARD_RADIUS, true)));
        this.guards.forEach((p, i) => this.hintNodes.set(p.root, { kind: 'guard', i }));
        this.heroes.forEach((p, i) => this.hintNodes.set(p.root, { kind: 'hero', i }));   // Ivan 08.11
        LoadLog.time('scene rigs', () => this.loadRigs());
        const s = this.center(model.heroes[0].start[0], model.heroes[0].start[1]);
        this.focus.x = s.x;
        this.focus.y = s.y;
    }

    // The nodes whose name or a parent's has one of hideNames (the main screen's background, rules,
    // section 36: the van, the street's barriers) off; swept again when the scene gets nodes (models load late).
    hideNodes() {
        const s3 = this.scene, n = s3.meshes.length + s3.transformNodes.length;
        if (n === this.hiddenAt) return;
        this.hiddenAt = n;
        const re = new RegExp(this.hideNames.join('|'), 'i');
        for (const m of [...s3.meshes, ...s3.transformNodes]) {
            for (let q = /** @type {any} */ (m); q; q = q.parent) if (re.test(q.name || '')) { m.setEnabled(false); break; }
        }
    }

    // --- Coordinates and input -----------------------------------------------------

    center(cx, cy) {
        return { x: this.ox + (cx + 0.5) * this.cell, y: this.oy + (cy + 0.5) * this.cell };
    }

    // The building (CoopProps.building) widened by pad of its size on each side, world px — the
    // camera's area (CoopGame.frameLevel); pad — one share or { left, right, up, down } on the
    // north-up screen (left — west, up — north); null — a level with no rooms.
    cameraArea(pad) {
        const b = CoopProps.building(this.M);
        if (!b) return null;
        const p = typeof pad === 'number' ? { left: pad, right: pad, up: pad, down: pad } : pad;
        const c = this.cell, w = b.x1 - b.x0, h = b.y1 - b.y0;
        return {
            x0: this.ox + (b.x0 - w * p.left) * c, y0: this.oy + (b.y0 - h * p.up) * c,
            x1: this.ox + (b.x1 + w * p.right) * c, y1: this.oy + (b.y1 + h * p.down) * c
        };
    }

    // The grid cell under a canvas point (CSS px) or null outside the level.
    pickCell(px, py) {
        const p = this.view.pointerToGround(px, py, this.floorH, null);
        if (!p) return null;
        const x = Math.floor((p.x - this.ox) / this.cell), y = Math.floor((p.y - this.oy) / this.cell);
        return this.M.inside(x, y) ? { x, y } : null;
    }

    // The object under a canvas point (CSS px) a tap works (rules, section 25): the model of a power
    // panel, a keypad, a vitrine or pedestal, an item lying or on its wall, a door's leaf (Ivan 08.11)
    // -> { kind, i } (as CoopModel.tapObject takes it) or null — the floor, the van, a hero: a tap on a cell. The
    // ray is the one of pickCell (createPickingRay takes CSS px).
    pickObject(px, py) {
        const ray = this.scene.createPickingRay(px, py, BABYLON.Matrix.Identity(), this.view.camera, false);
        const hit = this.scene.pickWithRay(ray, (m) => m.isEnabled() && m.isVisible && !!this.tapObjectOf(m));
        return hit && hit.hit && hit.pickedMesh ? this.tapObjectOf(hit.pickedMesh) : null;
    }

    // The object a mesh is a part of: up its parents to a node of tapNodes; a carried item is none.
    /** @param {any} mesh */
    tapObjectOf(mesh) {
        for (let n = mesh; n; n = n.parent) {
            const o = this.tapNodes.get(n);
            if (o) return o.held && o.held() ? null : o.obj;
        }
        return null;
    }

    // The object under a canvas point (CSS px) the hint tells (rules, section 26): one a tap works
    // (pickObject) or a guard, a hero -> { kind, i } or null. The nearest model on the ray wins.
    pickHover(px, py) {
        const ray = this.scene.createPickingRay(px, py, BABYLON.Matrix.Identity(), this.view.camera, false);
        const of = (/** @type {any} */ m) => this.tapObjectOf(m) || this.hintObjectOf(m);
        const hit = this.scene.pickWithRay(ray, (m) => m.isEnabled() && m.isVisible && !!of(m));
        return hit && hit.hit && hit.pickedMesh ? of(hit.pickedMesh) : null;
    }

    /** @param {any} mesh */
    hintObjectOf(mesh) {
        for (let n = mesh; n; n = n.parent) {
            const o = this.hintNodes.get(n);
            if (o) return o;
        }
        return null;
    }

    // The outline of the object under the cursor (rules, section 26): every model of it (the item,
    // its vitrine or pedestal, the shards) in the hero's color hex, a line CoopScene.HOVER_OUTLINE_PX
    // wide over the scene's own thin one; obj null — none. A layer per rendering group of its meshes
    // (a layer outlines only the meshes of its group — World3D.outlineLayer).
    /** @param {{ kind: string, i: number } | null} obj @param {string | null} hex */
    setHover(obj, hex) { this.outline('hover', obj, hex); }

    // The tutorial step's object (rules, section 27): the same outline as the hover's, kept while the step is on.
    /** @param {{ kind: string, i: number } | null} obj @param {string | null} hex */
    setMark(obj, hex) { this.outline('mark', obj, hex); }

    // The tutorial's target blinks (rules, section 27; CoopGame.blinkTick): its outline and its ring lit or not.
    /** @param {boolean} on */
    setBlink(on) {
        this.blinkOn = on;
        const m = this.outlines.mark;
        if (m) for (const hl of m.layers.values()) hl.isEnabled = on;
        if (this.cellRing && this.tutRing) this.cellRing.setEnabled(on);
    }

    // The outline of slot ('hover', 'mark'): each its own layers, so the cursor leaving the step's
    // object does not take the step's outline away.
    /** @param {string} slot @param {{ kind: string, i: number } | null} obj @param {string | null} hex */
    outline(slot, obj, hex) {
        const key = obj ? obj.kind + ':' + obj.i + ':' + hex : '', was = this.outlines[slot];
        if ((was ? was.key : '') === key) return;
        this.drawOutline(slot, key, obj, hex);
    }

    // A model loaded (spawn): the outlines drawn again — one set before its object's model was there
    // had nothing to outline (Ivan 09.11: the tutorial's door of step 1 did not blink — rules, section 27).
    refreshOutlines() {
        for (const [slot, was] of Object.entries(this.outlines)) if (was) this.drawOutline(slot, was.key, was.obj, was.hex);
    }

    /** @param {string} slot @param {string} key @param {{ kind: string, i: number } | null} obj @param {string | null} hex */
    drawOutline(slot, key, obj, hex) {
        const was = this.outlines[slot];
        if (was) for (const hl of was.layers.values()) hl.dispose();
        this.outlines[slot] = null;
        if (!obj || !hex || typeof BABYLON.HighlightLayer !== 'function') return;
        /** @type {Map<number, BABYLON.HighlightLayer>} */
        const layers = new Map(), color = BABYLON.Color3.FromHexString(hex), r = World3D.outlineRatios();
        const kernel = World3D.outlineKernel(CoopScene.HOVER_OUTLINE_PX);
        for (const [node, o] of this.tapNodes) {
            if (o.obj.kind !== obj.kind || o.obj.i !== obj.i || (o.held && o.held())) continue;
            for (const m of /** @type {any} */ (node).getChildMeshes(false)) {
                if (!(m instanceof BABYLON.Mesh) || !m.getTotalVertices()) continue;
                const g = m.renderingGroupId || 0;
                let hl = layers.get(g);
                if (!hl) {
                    hl = new BABYLON.HighlightLayer('coop-' + slot + '-' + g, this.scene, { isStroke: true, camera: this.view.camera,
                        mainTextureRatio: r.main, blurTextureSizeRatio: r.blur, blurHorizontalSize: kernel, blurVerticalSize: kernel, renderingGroupId: g });
                    hl.innerGlow = false;
                    hl.outerGlow = true;
                    hl.neutralColor = new BABYLON.Color4(0, 0, 0, 0);
                    layers.set(g, hl);
                }
                hl.addMesh(m, color);
            }
        }
        if (slot === 'mark') for (const hl of layers.values()) hl.isEnabled = this.blinkOn;
        this.outlines[slot] = { key, obj, hex, layers };
    }

    // --- Building (the ground — CoopSceneGround.js) ----------------------------------

    mat(hex, alpha) {
        const key = hex + ':' + (alpha == null ? 1 : alpha);
        let m = this._mats.get(key);
        if (!m) {
            m = new BABYLON.StandardMaterial('coop-' + key, this.scene);
            m.diffuseColor = World3D.hexColor3(hex);
            m.specularColor = BABYLON.Color3.Black();
            if (alpha != null && alpha < 1) m.alpha = alpha;
            this._mats.set(key, m);
        }
        return m;
    }

    add(mesh, kind, opts) {
        World3D.addObject(this.view, mesh, kind || 'prop', opts);
        this._meshes.push(mesh);
        return mesh;
    }

    // How far from the look-at point the ground shows in the frame, world px: side — to the left
    // or right at the frame's top (its widest), up — to the top edge, down — to the bottom edge.
    // The camera is dist = F / zoom from the look-at point (CameraControl.distance), pitched p down;
    // an edge ray goes p ∓ fov/2 below the horizon; past the horizon — Infinity.
    /** @param {{ zoom: number, screenH: number, aspect: number, fovDeg: number, pitchDeg: number }} o */
    static frameReach(o) {
        const D = Math.PI / 180, p = o.pitchDeg * D, f = o.fovDeg * D / 2;
        const dist = o.screenH / (2 * Math.tan(f) * o.zoom), hc = dist * Math.sin(p), back = dist * Math.cos(p);
        const top = p - f, bottom = p + f;
        if (top <= 0) return { side: Infinity, up: Infinity, down: back - hc / Math.tan(bottom) };
        const depth = hc / Math.sin(top) * Math.cos(f);              // the top edge's ground point along the view axis
        return { side: depth * Math.tan(f) * o.aspect, up: hc / Math.tan(top) - back, down: back - hc / Math.tan(bottom) };
    }

    // A lane line on the top ('U') or left ('L') edge of the cell at X, Y (texture px).
    static paintLane(ctx, side, X, Y, px, color) {
        if (!side) return;
        ctx.fillStyle = color;
        const len = px * 0.5, t = Math.max(CoopScene.LANE_MIN, px * CoopScene.LANE_W);
        if (side === 'U') ctx.fillRect(X + (px - len) / 2, Y - t / 2, len, t);
        else ctx.fillRect(X - t / 2, Y + (px - len) / 2, t, len);
    }

    // A cell of a room lit at night: inside the building and the light on.
    static litRoom(M, x, y, power) {
        const z = M.inside(x, y) ? M.L.zones[M.zone[y][x]] : null;
        return power !== false && !!z && z.kind !== 'outside';
    }

    // The light cut (Ivan 19.10: every action changes the scene): the floor of the building goes
    // dark, the street and the alley stay as they are.
    /** @param {any} z @param {boolean} power */
    static dark(z, power) {
        return power === false && !!z && z.kind !== 'outside';
    }

    // --- Models of the level (CoopProps; the rest — CoopSceneProps.js) ------------------

    // A placement of CoopProps ({ x, y } in cells, yaw, scale) on a node: on the floor, turned so
    // the model's front looks to yaw, stretched. The model's X and Y (Blender) are the node's
    // z and x: Gltf3D turns a file by 90° so that its front looks along +x.
    placeAt(node, p) {
        const c = this.cell;
        node.position.set(this.ox + p.x * c, this.floorH + (p.h || 0) * c, this.oy + p.y * c);
        node.rotation.y = -p.yaw * Math.PI / 180;
        if (p.scale) node.scaling.set(p.scale[1], 1, p.scale[0]);
    }

    loadModel(file) {
        const url = CoopProps.url(file), p = Model3D.load(url, this.scene);
        p.catch(() => this.modelIssue(url, CoopText.t('scene.model_missing')));
        return p;
    }

    // Puts a model of the level on a node placed at p: the node is there at once, the model joins
    // it when the file has loaded; then(m) gets its parts (CoopScene.parts). kind — 'prop' | 'actor';
    // opts — World3D.addObject options. Returns the node.
    spawn(file, p, kind, then, opts) {
        const node = new BABYLON.TransformNode('coop-' + file, this.scene);
        this.placeAt(node, p);
        this._nodes.push(node);
        this.loadModel(file).then((model) => {
            if (this.disposed) return;
            const root = Model3D.build(model, this.scene, { name: file });
            const m = this.parts(file, root);
            m.node = node;
            m.size = CoopScene.extent(root);
            root.parent = node;
            World3D.addObject(this.view, root, kind, Object.assign({ bare: CoopScene.bare }, opts));
            this._models.push(root);
            if (then) then(m);
            if (this.tapNodes.has(node)) this.refreshOutlines();
        }, () => {});
        return node;
    }

    // The nodes and materials of a built model by their names in the file (Gltf3D puts the
    // model's name in front), the rest pose of the nodes the scene moves (Euler angles: the
    // loader gives quaternions). A node or material of CoopProps.NEEDS the file lacks — a line
    // for the modeller on screen; the model still shows.
    parts(file, root) {
        const need = CoopProps.NEEDS[file] || {}, name = (s) => s.slice(s.lastIndexOf('/') + 1);
        /** @type {Record<string, BABYLON.TransformNode>} */
        const n = {};
        /** @type {Record<string, BABYLON.StandardMaterial>} */
        const mats = {};
        for (const node of root.getDescendants(false)) {
            const k = name(node.name);
            if (!n[k]) n[k] = /** @type {BABYLON.TransformNode} */ (node);
            const mat = /** @type {BABYLON.AbstractMesh} */ (node).material;
            if (mat && !mats[name(mat.name)]) mats[name(mat.name)] = /** @type {BABYLON.StandardMaterial} */ (mat);
        }
        /** @type {Record<string, { r: BABYLON.Vector3, p: BABYLON.Vector3 }>} */
        const rest = {};
        for (const k of (need.nodes || []).concat(CoopProps.OPTIONAL[file] || [])) {
            const node = n[k];
            if (!node) continue;
            if (node.rotationQuaternion) {
                node.rotation.copyFrom(node.rotationQuaternion.toEulerAngles());
                node.rotationQuaternion = null;
            }
            rest[k] = { r: node.rotation.clone(), p: node.position.clone() };
        }
        const url = CoopProps.url(file);
        const lack = (need.nodes || []).filter(k => !n[k]), noMat = (need.mats || []).filter(k => !mats[k]);
        if (lack.length) this.modelIssue(url, CoopText.t('scene.model_nodes_moved', { list: lack.join(', ') }));
        if (noMat.length) this.modelIssue(url, CoopText.t('scene.model_material', { list: noMat.join(', ') }));
        return { root, n, mats, rest, node: /** @type {BABYLON.TransformNode | null} */ (null), size: { w: 0, h: 0 } };
    }

    // Parts drawn without ink edges and outline: see-through ones (glass, water).
    static bare(mesh) {
        const m = mesh.material;
        return !!m && (m.alpha < 1 || m.transparencyMode === BABYLON.Material.MATERIAL_ALPHABLEND);
    }

    // Width (the larger of x and z) and height of a built model standing at the origin, world px.
    static extent(root) {
        CoopScene.fresh(root);
        const { min, max } = root.getHierarchyBoundingVectors(true);
        return { w: Math.max(max.x - min.x, max.z - min.z), h: max.y - min.y };
    }

    // Fresh world matrices down a node's tree (parents first).
    static fresh(node) {
        node.computeWorldMatrix(true);
        for (const c of node.getChildren()) CoopScene.fresh(/** @type {BABYLON.TransformNode} */ (c));
    }

    // A mesh's vertex data (VertexData.ExtractFromMesh) moved by its world matrix: a copy of what the
    // matrix changes, the rest shared (VertexData.merge copies it). Field by field: a VertexData has
    // its own _applyTo bound to itself.
    static moved(data, world) {
        const v = new BABYLON.VertexData();
        for (const k of CoopScene.VERTEX_DATA) if (data[k]) v[k] = data[k];
        for (const k of CoopScene.VERTEX_MOVED) if (v[k]) v[k] = v[k].slice();
        return v.transform(world);
    }

    // Whether a sensor's lamp is lit at real second sec: armed — SENSOR_BLINK flashes a second.
    static sensorLit(power, sec) {
        return !!power && Math.floor(sec * CoopScene.SENSOR_BLINK * 2) % 2 === 0;   // keep: on in the even halves of a blink
    }

    // The box of a laser beam over its cells (cells): its middle x, y and its length along x (w)
    // or y (d) in cells; 0 across — the beam's thickness is set in px.
    static beamBox(/** @type {number[][]} */ cells) {
        const xs = cells.map(v => v[0]), ys = cells.map(v => v[1]);
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        const row = y0 === y1;
        return { x: (x0 + x1 + 1) / 2, y: (y0 + y1 + 1) / 2, w: row ? x1 - x0 + 1 : 0, d: row ? 0 : y1 - y0 + 1 };
    }

    // Where the police car stops (cells, its middle) and which end of the street it comes from
    // (the van's police_from, E or W): in the van's row, POLICE_GAP cells short of the van's end on
    // that side; null — a level without a van.
    static policeStop(M) {
        const van = M.L.objects.find((/** @type {any} */ o) => o.kind === 'van');
        if (!van) return null;
        const [x0, y0, x1, y1] = van.rect, off = CoopScene.POLICE_GAP + CoopScene.POLICE_LEN / 2;
        return { x: van.police_from === 'W' ? x0 - off : x1 + 1 + off, y: (y0 + y1 + 1) / 2, from: van.police_from };
    }

    // Where the police car is at tick t (rules, section 14; Ivan 10.11: «00 это будет время въезда к левому
    // углу здания»), its middle in cells along the street; null — not in the level yet (or no police, at null).
    // On the tick at its front is at the building's wall on its side (all the zones but the street) — no
    // nearer to the level's edge than its length, to be seen whole; before — POLICE_SPEED cells a tick
    // from beyond the edge; after — braking evenly to the stop before the van (policeStop): d cells in
    // 2d / POLICE_SPEED ticks. A stop short of the corner — at the stop from the tick at.
    static policeX(M, t, at) {
        const stop = CoopScene.policeStop(M);
        if (!stop || at === null || at === undefined) return null;
        const len = CoopScene.POLICE_LEN, v = CoopScene.POLICE_SPEED, west = stop.from === 'W';
        // along the drive: u — from the police's edge of the level to the car's front
        const rooms = M.L.zones.filter((/** @type {any} */ z) => z.kind !== 'outside');
        const wall = west ? Math.min(...rooms.map((/** @type {any} */ z) => z.rect[0])) : M.W - 1 - Math.max(...rooms.map((/** @type {any} */ z) => z.rect[2]));
        const halt = west ? stop.x + len / 2 : M.W - (stop.x - len / 2);
        const corner = Math.min(Math.max(wall, len), halt), d = halt - corner, tau = t - at;
        let u;
        if (tau <= 0) u = corner + v * tau;
        else if (!d || tau >= 2 * d / v) u = halt;
        else u = corner + v * tau - v * v * tau * tau / (4 * d);   // keep: braking evenly to a stop over d
        if (u < 0) return null;
        return west ? u - len / 2 : M.W - u + len / 2;
    }

    // Cells the van has driven along x at s (0..1) of its drive off (negative to the west): it starts
    // slowly and speeds up, and at the end its back is past the edge of the level on its exit side.
    static vanAway(M, s) {
        const van = M.L.objects.find((/** @type {any} */ o) => o.kind === 'van');
        if (!van) return 0;
        const way = van.exit === 'E' ? M.W - van.rect[0] : -(van.rect[2] + 1);
        return (way + Math.sign(way) * CoopScene.VAN_OUT) * s * s;
    }

    // The start of a level (rules, section 35; Ivan 16.11: «фургон едет за полицейской машиной, полиция уезжает на право, а
    // фургон останавливается перед дверью»): cells along x the van is short of its place at s (0..1) of its drive in —
    // from the side across from its exit, its front VAN_OUT cells past the level's edge at 0, braking evenly to 0 at 1.
    static vanIn(M, s) {
        const van = M.L.objects.find((/** @type {any} */ o) => o.kind === 'van');
        if (!van) return 0;
        const way = van.exit === 'E' ? -(van.rect[2] + 1 + CoopScene.VAN_OUT) : M.W + CoopScene.VAN_OUT - van.rect[0];
        return way * (1 - s) * (1 - s);
    }

    // The police car of the start, sec real seconds into it: its middle along x, in cells — ahead of the van, POLICE_GAP
    // between them at 0, at the van's first speed (it does not brake) towards the van's exit; null — gone, its back VAN_OUT
    // cells past the level's edge (or no van).
    static introPolice(M, sec) {
        const van = M.L.objects.find((/** @type {any} */ o) => o.kind === 'van');
        if (!van) return null;
        const east = van.exit === 'E', way = CoopScene.vanIn(M, 0), v = -2 * way / CoopScene.INTRO_S, half = CoopScene.POLICE_LEN / 2;
        const gap = CoopScene.POLICE_GAP + half, x = (east ? van.rect[2] + 1 + way + gap : van.rect[0] + way - gap) + v * sec;
        return (east ? x - half > M.W + CoopScene.VAN_OUT : x + half < -CoopScene.VAN_OUT) ? null : x;
    }

    // A character model was not taken (the bean stays in its place): one line per file, handed
    // to onModelIssue — the game shows it on screen, so the modeller swapping files sees why.
    modelIssue(url, why) {
        const line = CoopText.t('scene.model_rejected', { file: url.slice(url.lastIndexOf('/') + 1), why });
        if (this.modelIssues.includes(line)) return;
        this.modelIssues.push(line);
        if (this.onModelIssue) this.onModelIssue(this.modelIssues);
    }

    // --- Frame (the bodies — CoopSceneBodies.js) -------------------------------------

    // An angle (degrees) from p to q the short way round, w 0..1 eased.
    static turn(p, q, w) {
        const d = ((q - p) % 360 + 540) % 360 - 180, e = w * w * (3 - 2 * w);   // keep: the short way round (540 = 360 + 180); smoothstep
        return p + d * e;
    }

    // Where in the tick between frames a and b (0..1) a body on its feet touches another one and
    // goes back to its cell (it reached into a crash and stayed up); -1 — not in this tick.
    static recoilAt(a, b) {
        if (!b.tr || b.tr.length !== 2 || b.kc === undefined || b.fall || b.out || a.fall || a.out) return -1;   // keep: a reach into a crash and back is a trail of two points
        const e = b.tr[1];
        if (e[0] !== b.x || e[1] !== b.y || a.x !== b.x || a.y !== b.y) return -1;
        return b.tt ? b.tt[0] : b.kc;
    }

    // Where in the tick between frames a and b (0..1) a flier touches the body it bounces off:
    // it flew into the tick and flies on along a broken line whose first point is the touch
    // (CoopModel.lunge) and whose last one is behind where it started. -1 — no bounce in this tick.
    static bounceAt(a, b) {
        if (!a.fall || !b.fall || !a.fly || !b.fly || !b.tr || b.tr.length < 2) return -1;   // keep: a broken line has two points at least
        const t = b.tr[0], e = b.tr[b.tr.length - 1];
        if ((t[0] - a.x) * (e[0] - a.x) + (t[1] - a.y) * (e[1] - a.y) >= 0) return -1;
        return b.tt ? b.tt[0] : 1 / b.tr.length;
    }

    // A guard's frame as a body for moves(): at the panel or untying a tied one he works with his
    // hands — the move of the verb (CoopRig.WORK_MOVES; the frame has his state, st).
    static guardBody(g) {
        const verb = CoopScene.GUARD_WORK[g.st];
        return Object.assign(g, { work: !!verb, wv: verb });
    }

    // Whether a vitrine's glass is broken between loot frames a and b (k 0..1): from the moment
    // a body reaches it (b.bk), not from the end of the tick.
    static glassBroken(a, b, k) {
        return !!a.br || (!!b && !!b.br && b.bk !== undefined && k >= b.bk);
    }

    // The turn of a loot item (radians, as node.rotation.y): its front looks where the holder
    // faces this moment (yaw, degrees — the pose), turning with him — the long side of a bar
    // (the model's X) across his way.
    static iconTurn(yaw) {
        return -yaw * Math.PI / 180;
    }

    // A carried item is ICON_W wide, never bigger than itself; its height in a stack.
    static iconScale(v) {
        return Math.min(1, CoopScene.ICON_W / (v.w || CoopScene.ICON_W));
    }

    static iconH(v) {
        return v.h * CoopScene.iconScale(v) + CoopScene.ICON_GAP;
    }

    // The highest point of a built model in the world, px (counted once: the things worked on
    // stand still).
    static topOf(m) {
        if (m.top === undefined) {
            CoopScene.fresh(m.root);
            m.top = m.root.getHierarchyBoundingVectors(true).max.y;
        }
        return m.top;
    }

    // The heroes' carry limits as the model counts them (the lab's knobs change the masses).
    capacities() { return this.M.heroes.map(h => this.M.capacity(h)); }

    // The moment between frames a and b (k 0..1) of a take or of the plan's ghost; ga, gb —
    // frames to take the guards from when a, b come from the ghost (it has no guards).
    render(a, b, k, ga, gb) {
        const M = this.M;
        a.h.forEach((h, i) => {
            const q = b.h[i];
            const state = h.caught ? 'gone' : h.fall ? 'fall' : 'ok';
            const pin = this.pins && this.pins[i];
            if (pin) {   // the main screen's gang stands where its data puts it (rules, section 36)
                this.placeBean(this.heroes[i], pin.at, pin.at, 0, h.f, 'ok', { lie: 0, lean: 0, yaw: pin.yaw });
                return;
            }
            const [p0, p1, kk] = this.along(h, q, k);
            this.placeBean(this.heroes[i], p0, p1, kk, k < 0.5 ? h.f : q.f, state, this.pose(h, q, k, h.fall, q.fall),
                this.moves(Object.assign({ t: a.t }, h), Object.assign({ t: b.t }, q), k));
        });
        const G = ga || a, H = gb || b;
        G.g.forEach((g, i) => {
            const q = H.g[i], [p0, p1, kk] = this.along(g, q, k), body = CoopScene.guardBody;
            this.placeBean(this.guards[i], p0, p1, kk, k < 0.5 ? g.f : q.f, g.out ? 'out' : g.fall ? 'fall' : 'ok',
                this.pose(g, q, k, g.out || g.fall, q.out || q.fall), this.moves(body(Object.assign({ t: G.t }, g)), body(Object.assign({ t: H.t }, q)), k));
        });
        a.doors.forEach((open, i) => this.setDoor(i, !!open, !!(a.unl && a.unl[i])));
        this.spinWheels(a, k);
        for (const beam of this.lasers || []) beam.setEnabled(M.isArmed('lasers', a.power));   // what goes off is the panel's list (rules, section 8)
        this.showProps(a.power, a.t + k);
        this.showSensors(M.isArmed('sensors', a.power), performance.now() / 1000);
        this.showPolice(a.t + k, performance.now() / 1000);
        this.showOutro(a, this.outroS);
        // Carried loot is an icon over the head: the item itself, shrunk, in a stack in the order
        // it was picked up (k); dropped, it lies full size, in its vitrine — on the cushion.
        const under = (l) => a.loot.reduce((y, m, j) => y + (m.holder === l.holder && m.k < l.k ? CoopScene.iconH(this.loot[j]) : 0), 0);
        a.loot.forEach((l, i) => {
            const v = this.loot[i], broken = CoopScene.glassBroken(l, b.loot[i], k);
            if (v.broken !== broken) { v.broken = broken; this.showGlass(v); }
            v.held = l.holder >= 0;
            if (l.del) { v.item.setEnabled(false); return; }
            v.item.setEnabled(true);
            if (l.holder >= 0) {
                const s = this.carryAt(this.heroes[l.holder]);
                v.item.scaling.setAll(CoopScene.iconScale(v));
                v.item.position.set(s.x, s.y + CoopScene.ICON_LIFT + under(l), s.z);
                v.item.rotation.y = CoopScene.iconTurn(this.heroes[l.holder].yaw);
            } else {
                v.item.scaling.setAll(1);
                const home = l.x === v.home[0] && l.y === v.home[1];
                if (home && v.pose) { this.placeAt(v.item, v.pose); return; }
                v.item.rotation.y = CoopScene.iconTurn(CoopModel.ANGLE.D);
                const q = this.center(l.x, l.y);
                v.item.position.set(q.x, this.floorH + (home ? v.cushion : 0), q.y);
            }
        });
        this.paintFloor({ power: M.isArmed('light', a.power), seen: M.seenAt(Object.assign({}, G, { power: a.power, t: a.t })), routes: this.routes,
            hint: this.hintOn ? M.hintCells(a) : [], ask: this.askCell, vanGone: this.hideVan || this.outroS > 0 || this.introS < 1 });
        if (this.hideNames) this.hideNodes();
        this.showRing();
        this.showCellRing();
    }

    // The selection ring (Ivan 21.10 evening: «верни кольцо выделения для соло режима — без него не
    // понятно, кто выделен и где он»): one ring on the floor around the selected hero, the colour
    // of his route, while CoopGame sets selRing; hidden with the hero (caught, gone).
    showRing() {
        const s = this.selRing, p = s && this.heroes[s.hero];
        if (!p) {
            if (this.ring) this.ring.setEnabled(false);
            return;
        }
        if (!this.ring) this.ring = this.torus('sel-ring');
        const d = this.cell * CoopModel.bodyRadius(this.M.heroes[s.hero].mass) * CoopScene.RING;
        this.ring.scaling.set(d, d, d);
        this.ring.material = this.mat(s.mark);
        this.ring.setEnabled(p.root.isEnabled());
        this.ring.position.set(p.x, this.floorH + 1, p.y);
    }

    // A ring on the floor, 1 across (scaled by its user): the selection's, the tutorial's cell.
    /** @param {string} name */
    torus(name) {
        const m = BABYLON.MeshBuilder.CreateTorus(name, { diameter: 1, thickness: CoopScene.RING_THICK, tessellation: CoopScene.RING_TESS }, this.scene);
        this.add(m, 'actor', { ink: false, outline: false, castShadow: false });
        return m;
    }

    // The tutorial step's cell (rules, section 27): a ring on its floor in the hero's color — the
    // selection ring's torus, the size of a cell; in the van — over its bed (Ivan 10.11), the bed hides the floor.
    showCellRing() {
        const c = this.tutRing;
        if (!c) {
            if (this.cellRing) this.cellRing.setEnabled(false);
            return;
        }
        if (!this.cellRing) this.cellRing = this.torus('tut-ring');
        const d = this.cell * CoopScene.CELL_RING, m = this.center(c.x, c.y);
        this.cellRing.scaling.set(d, d, d);
        this.cellRing.material = this.mat(c.mark);
        this.cellRing.setEnabled(this.blinkOn);
        this.cellRing.position.set(m.x, this.floorH + 1 + (this.M.isVan(c.x, c.y) ? CoopScene.VAN_RING_H * this.cell : 0), m.y);
    }

    // --- Signs of the plan ---------------------------------------------------------------

    // Where the plan's steps are (CoopGame.planGhosts) there is no model (Ivan 07.11: «убираем модель
    // персонажа»), only the HUD's signs (CoopGame.buildGhostTags), in their cells (Ivan 07.11: «ровно
    // в одну клетку по ширине»). Per entry (in this.ghosts order): its spot on the floor on the screen,
    // CSS px — the cell's center or, with a side (a door, a wall — CoopModel.actSpot), the middle of
    // that side; w — the cell's width there (its left edge to its right one); shown — the
    // point is in front of the camera.
    ghostHeads() {
        return this.ghosts.map((g) => {
            const half = this.cell / 2, d = g.side ? CoopModel.DELTA[g.side] : [0, 0], m = this.center(g.x, g.y);
            const c = { x: m.x + d[0] * half, y: m.y + d[1] * half }, at = g.side ? this.wallTop(c) : this.floorH;
            const p = this.view.projectToScreen(c.x, c.y, at);
            const l = this.view.projectToScreen(c.x - half, c.y, at), r = this.view.projectToScreen(c.x + half, c.y, at);
            return { x: p.x, y: p.y, w: Math.hypot(r.x - l.x, r.y - l.y), shown: !p.behind };
        });
    }

    // The height of a wall spot's sign (Ivan 18.11: «табличка щитка … съехала вниз» — it stood on the floor at the
    // wall's foot over the signs of the cell in front): the top of what hangs there — the panel, a keypad (tapNodes)
    // within half a cell of point c; none or not loaded yet — the floor.
    /** @param {{ x: number, y: number }} c @returns {number} */
    wallTop(c) {
        const half = this.cell / 2;
        for (const [node, o] of this.tapNodes || []) {
            if (o.obj.kind !== 'panel' && o.obj.kind !== 'gate') continue;
            const q = /** @type {any} */ (node).position;   // a prop's root: it has a position
            if (Math.abs(q.x - c.x) > half || Math.abs(q.z - c.y) > half || !node.getChildMeshes().length) continue;
            return node.getHierarchyBoundingVectors(true).max.y;
        }
        return this.floorH;
    }

    dispose() {
        this.disposed = true;
        this.setHover(null, null);
        this.setMark(null, null);
        for (const p of this.heroes.concat(this.guards)) if (p.model) Model3D.dispose(this.view, p.model);
        for (const root of this._models) Model3D.dispose(this.view, root);
        for (const node of this._nodes) node.dispose();
        for (const m of this._meshes) World3D.removeObject(this.view, m);
        for (const m of this._mats.values()) m.dispose();
        for (const m of this._modelMats) m.dispose();
        this.floorMat.dispose();
        this.floorTex.dispose();
        if (this.townMat) this.townMat.dispose();
        if (this.townTex) this.townTex.dispose();
    }
}

CoopScene.TEX_PX = COOP_SCENE_TEX_PX;
CoopScene.TOWN_OUT = COOP_SCENE_TOWN_OUT;
CoopScene.TOWN_VIEW = { h: COOP_SCENE_TOWN_VIEW_H, aspect: COOP_SCENE_TOWN_VIEW_ASPECT };   // the screen the town covers
CoopScene.NIGHT = {              // the night's glow (the level's field night; Ivan 05.11)
    window: COOP_SCENE_NIGHT_WINDOW, lamp: COOP_SCENE_NIGHT_LAMP, paneDay: COOP_SCENE_NIGHT_PANE_DAY, lampDay: COOP_SCENE_NIGHT_LAMP_DAY,
    poolCss: cssColor(COOP_SCENE_NIGHT_POOL, COOP_SCENE_NIGHT_POOL_ALPHA), poolCells: COOP_SCENE_NIGHT_POOL_CELLS,  // the pool under a lamp: colour and radius
    shop: COOP_SCENE_NIGHT_SHOP, shopIntensity: COOP_SCENE_NIGHT_SHOP_INTENSITY, shopHigh: COOP_SCENE_NIGHT_SHOP_HIGH, shopRange: COOP_SCENE_NIGHT_SHOP_RANGE,
    roomGlow: COOP_SCENE_NIGHT_ROOM_GLOW, wallGlow: COOP_SCENE_NIGHT_WALL_GLOW
};
CoopScene.TOWN_TEX_PX = COOP_SCENE_TOWN_TEX_PX;
CoopScene.TOWN_BELOW = COOP_SCENE_TOWN_BELOW;
CoopScene.TRAIL_BOLD = COOP_SCENE_TRAIL_BOLD;
CoopScene.TRAIL = COOP_SCENE_TRAIL;
CoopScene.RING = COOP_SCENE_RING;
CoopScene.RING_THICK = COOP_SCENE_RING_THICK;
CoopScene.CELL_RING = COOP_SCENE_CELL_RING;
CoopScene.VAN_RING_H = COOP_SCENE_VAN_RING_H;
CoopScene.LEAN = COOP_SCENE_LEAN;
CoopScene.RISE = COOP_SCENE_RISE;
CoopScene.TURN = COOP_SCENE_TURN;
CoopScene.WAIT_FACE = COOP_SCENE_WAIT_FACE;
CoopScene.LIE_TURN = COOP_SCENE_LIE_TURN;
CoopScene.ICON_W = COOP_SCENE_ICON_W;
CoopScene.ICON_GAP = COOP_SCENE_ICON_GAP;
CoopScene.POLICE_LEN = COOP_SCENE_POLICE_LEN;
CoopScene.POLICE_GAP = COOP_SCENE_POLICE_GAP;
CoopScene.POLICE_SPEED = COOP_SCENE_POLICE_SPEED;
CoopScene.POLICE_FLASH = COOP_SCENE_POLICE_FLASH;
CoopScene.VAN_OUT = COOP_SCENE_VAN_OUT;
CoopScene.INTRO_S = COOP_SCENE_INTRO_S;
CoopScene.SENSOR_BLINK = COOP_SCENE_SENSOR_BLINK;
CoopScene.WORK_TOP = COOP_SCENE_WORK_TOP;
CoopScene.ICON_LIFT = COOP_SCENE_ICON_LIFT;
CoopScene.BUMP = COOP_SCENE_BUMP;
CoopScene.FADE = COOP_SCENE_FADE;
CoopScene.RECOIL = COOP_SCENE_RECOIL;
CoopScene.WET_EDGE = COOP_SCENE_WET_EDGE;
CoopScene.SLIDE_IN = COOP_SCENE_SLIDE_IN;
CoopScene.DOOR_FLAT_OUT = COOP_SCENE_DOOR_FLAT_OUT;
CoopScene.WHEEL_TURN = COOP_SCENE_WHEEL_TURN;
CoopScene.LEVER_DOWN = COOP_SCENE_LEVER_DOWN;
CoopScene.BEAM_H = COOP_SCENE_BEAM_H;
CoopScene.CUSHION = COOP_SCENE_CUSHION;
CoopScene.HOVER_OUTLINE_PX = COOP_SCENE_HOVER_OUTLINE_PX;
CoopScene.SHARD_OUT = COOP_SCENE_SHARD_OUT;
// The side (the model's ±X) a knocked-out body's hat falls to, by where he fell: the camera's — it looks
// north (CAMERA_AZIMUTH_DEG), so lying east-west the hat is south of him; lying north-south, either.
// Measured in the game (29.10, Valera fallen east: +X of his model points south).
CoopScene.HAT_SIDE = { R: 1, L: -1, U: 1, D: 1 };
CoopScene.STARS_UP = COOP_SCENE_STARS_UP;
CoopScene.STARS_SPIN = COOP_SCENE_STARS_SPIN;
CoopScene.HEAD_AT = COOP_SCENE_HEAD_AT;
CoopScene.TIE_HANDS = COOP_SCENE_TIE_HANDS;
CoopScene.GUARD_WORK = { panel: 'power', untie: 'untie' };   // a guard's state → the verb of his hands (CoopRig.WORK_MOVES)
CoopScene.FLY_UP = COOP_SCENE_FLY_UP;
CoopScene.LANE_W = COOP_SCENE_LANE_W;
CoopScene.LANE_MIN = COOP_SCENE_LANE_MIN;
CoopScene.CONE_IN = COOP_SCENE_CONE_IN;
CoopScene.HINT_RIM_W = COOP_SCENE_HINT_RIM_W;
CoopScene.HINT_RIM_IN = COOP_SCENE_HINT_RIM_IN;
CoopScene.ASK_RIM_W = COOP_SCENE_ASK_RIM_W;
CoopScene.ASK_RIM_IN = COOP_SCENE_ASK_RIM_IN;
CoopScene.BEAM_T = COOP_SCENE_BEAM_T;
CoopScene.BAR_W = COOP_SCENE_BAR_W;
CoopScene.BAR_H = COOP_SCENE_BAR_H;
CoopScene.ITEM_W = COOP_SCENE_ITEM_W;
CoopScene.ITEM_H = COOP_SCENE_ITEM_H;
CoopScene.BEAN_H = COOP_SCENE_BEAN_H;
CoopScene.BEAN_TESS = COOP_SCENE_BEAN_TESS;
CoopScene.BEAN_SUBDIV = COOP_SCENE_BEAN_SUBDIV;
CoopScene.BEAN_EYE = COOP_SCENE_BEAN_EYE;
CoopScene.BEAN_EYE_SEG = COOP_SCENE_BEAN_EYE_SEG;
CoopScene.BEAN_EYE_OUT = COOP_SCENE_BEAN_EYE_OUT;
CoopScene.BEAN_EYE_UP = COOP_SCENE_BEAN_EYE_UP;
CoopScene.BEAN_EYE_SIDE = COOP_SCENE_BEAN_EYE_SIDE;
CoopScene.BEAN_PUPIL = COOP_SCENE_BEAN_PUPIL;
CoopScene.BEAN_PUPIL_SEG = COOP_SCENE_BEAN_PUPIL_SEG;
CoopScene.BEAN_PUPIL_OUT = COOP_SCENE_BEAN_PUPIL_OUT;
CoopScene.BEAN_CAP_D = COOP_SCENE_BEAN_CAP_D;
CoopScene.BEAN_CAP_UP = COOP_SCENE_BEAN_CAP_UP;
CoopScene.BEAN_LIFT = COOP_SCENE_BEAN_LIFT;
CoopScene.CARRY_UP = COOP_SCENE_CARRY_UP;
CoopScene.RING_TESS = COOP_SCENE_RING_TESS;
CoopScene.COLORS = {             // floor texture (CSS colors made of Constants.js COOP_SCENE_*)
    void: cssColor(COOP_SCENE_VOID), checker: cssColor(COOP_SCENE_CHECKER, COOP_SCENE_CHECKER_ALPHA), dark: cssColor(COOP_SCENE_DARK, COOP_SCENE_DARK_ALPHA),
    floor: {                     // by the floor of a zone (its field floor, CoopCheck.FLOORS)
        room: cssColor(COOP_SCENE_FLOOR_ROOM), alley: cssColor(COOP_SCENE_FLOOR_ALLEY), street: cssColor(COOP_SCENE_FLOOR_STREET), utility: cssColor(COOP_SCENE_FLOOR_UTILITY), guards: cssColor(COOP_SCENE_FLOOR_GUARDS), office: cssColor(COOP_SCENE_FLOOR_OFFICE), vault: cssColor(COOP_SCENE_FLOOR_VAULT), corridor: cssColor(COOP_SCENE_FLOOR_CORRIDOR), hall: cssColor(COOP_SCENE_FLOOR_HALL), loading: cssColor(COOP_SCENE_FLOOR_LOADING)
    },
    van: cssColor(COOP_SCENE_VAN_FLOOR),
    town: { road: cssColor(COOP_SCENE_TOWN_ROAD), walk: cssColor(COOP_SCENE_TOWN_WALK), yard: cssColor(COOP_SCENE_TOWN_YARD), seam: cssColor(COOP_SCENE_TOWN_SEAM, COOP_SCENE_TOWN_SEAM_ALPHA), lane: cssColor(COOP_SCENE_TOWN_LANE) },   // the town's ground (CoopCity.ground)
    cone: cssColor(COOP_SCENE_CONE, COOP_SCENE_CONE_ALPHA),
    hint: cssColor(COOP_SCENE_HINT, COOP_SCENE_HINT_ALPHA), hintRim: cssColor(COOP_SCENE_HINT_RIM),
    ask: cssColor(COOP_SCENE_ASK, COOP_SCENE_ASK_ALPHA), askRim: cssColor(COOP_SCENE_ASK_RIM)
};
CoopScene.HEX = {                // state colors (the tint and screen materials), the beam, the beans
    locked: COOP_SCENE_HEX_LOCKED,
    vault: COOP_SCENE_HEX_VAULT,
    electro: COOP_SCENE_HEX_ELECTRO,
    opened: COOP_SCENE_HEX_OPENED,
    lampOn: COOP_SCENE_HEX_LAMP_ON,
    lampOff: COOP_SCENE_HEX_LAMP_OFF,
    camOn: COOP_SCENE_HEX_CAM_ON,
    camOff: COOP_SCENE_HEX_CAM_OFF,
    screenOn: COOP_SCENE_HEX_SCREEN_ON,
    screenOff: COOP_SCENE_HEX_SCREEN_OFF,
    sensorOn: COOP_SCENE_HEX_SENSOR_ON,
    policeRed: COOP_SCENE_HEX_POLICE_RED,
    policeBlue: COOP_SCENE_HEX_POLICE_BLUE,
    screenGlow: COOP_SCENE_HEX_SCREEN_GLOW,
    laser: COOP_SCENE_HEX_LASER,
    guard: COOP_SCENE_HEX_GUARD,
    cap: COOP_SCENE_HEX_CAP,
    eye: COOP_SCENE_HEX_EYE,
    pupil: COOP_SCENE_HEX_PUPIL
};
// The fields of a BABYLON.VertexData that CoopScene.moved carries over; of them the ones a matrix changes.
CoopScene.VERTEX_DATA = ['positions', 'normals', 'tangents', 'uvs', 'uvs2', 'uvs3', 'uvs4', 'uvs5', 'uvs6', 'colors',
    'matricesIndices', 'matricesWeights', 'matricesIndicesExtra', 'matricesWeightsExtra', 'indices', 'materialInfos', 'hasVertexAlpha'];
CoopScene.VERTEX_MOVED = ['positions', 'normals', 'tangents', 'indices'];
