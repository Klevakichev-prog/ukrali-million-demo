// CoopSceneGround.js — a part of CoopScene (CoopScene.js): the ground. The floor texture painted by
// rooms — the routes, the vision cones, the hint and advice rims, the light off; the town round the
// level (CoopCity: houses baked into one mesh, the road and the sidewalks on its own texture, the
// puddles); the night's glow and the shop light that leaves the unlit ones dark. Methods of the
// scene, mixed into its prototype.

/** @satisfies {ThisType<CoopScene>} */
const CoopSceneGround = {
    // The town's rect in cells: the whole location and all the ground the game camera can show —
    // its area (cameraArea) widened by the frame's reach at the game zoom on a TOWN_VIEW screen
    // (cfg.townZoom — CoopGame.townZoom: level 1 fills it, times COOP_ZOOM) zoomed out to TOWN_OUT
    // (Ivan 05.11 evening: the lawn showed past the location's edge in the frame's top corners on
    // level 2). The wheel zooming out farther may still show it.
    townRect() {
        const c = this.cell, L = this.location, a = this.cameraArea(this.cfg.cameraPad);
        const V = CoopScene.TOWN_VIEW;
        const r = a ? CoopScene.frameReach({
            zoom: this.cfg.townZoom * CoopScene.TOWN_OUT, screenH: V.h, aspect: V.aspect,
            fovDeg: CAMERA_FOV_DEG, pitchDeg: CAMERA_PITCH_DEG
        }) : null;
        const x0 = Math.min(0, a ? a.x0 - r.side : 0), y0 = Math.min(0, a ? a.y0 - r.up : 0);
        const x1 = Math.max(L.width, a ? a.x1 + r.side : 0), y1 = Math.max(L.height, a ? a.y1 + r.down : 0);
        return { x0: Math.floor((x0 - this.ox) / c), y0: Math.floor((y0 - this.oy) / c), x1: Math.ceil((x1 - this.ox) / c), y1: Math.ceil((y1 - this.oy) / c) };
    },

    // What the ground shows in cell (x, y) of the town and the grid's street (CoopCity.ground).
    groundKind(x, y) {
        return CoopCity.ground(this.city, this.M, x, y);
    },

    // The town: its ground — a plate under the level's floor painted by cells (streets, sidewalks,
    // the lane lines, yards) — and its models, merged a mesh per file; they cast no shadows (the sun's
    // box stays on the level). Nothing for a level with no town.
    buildCity() {
        const city = this.city;
        if (!city) return;
        const e = city.ext, px = CoopScene.TOWN_TEX_PX, C = CoopScene.COLORS.town, w = e.x1 - e.x0, h = e.y1 - e.y0;
        const tex = new BABYLON.DynamicTexture('coop-town', { width: w * px, height: h * px }, this.scene, false);
        const ctx = /** @type {CanvasRenderingContext2D} */ (/** @type {unknown} */ (tex.getContext()));
        for (let y = e.y0; y < e.y1; y++) {
            for (let x = e.x0; x < e.x1; x++) {
                const k = this.groundKind(x, y), X = (x - e.x0) * px, Y = (y - e.y0) * px;
                ctx.fillStyle = C[k] || C.yard;
                ctx.fillRect(X, Y, px, px);
                if (k === 'walk') {
                    ctx.strokeStyle = C.seam;
                    ctx.lineWidth = 1;
                    ctx.strokeRect(X + 0.5, Y + 0.5, px - 1, px - 1);
                }
                CoopScene.paintLane(ctx, CoopCity.lane((xx, yy) => this.groundKind(xx, yy), x, y), X, Y, px, C.lane);
            }
        }
        tex.update(false);
        const m = new BABYLON.StandardMaterial('coop-town-mat', this.scene);
        m.diffuseTexture = tex;
        m.specularColor = BABYLON.Color3.Black();
        this.townMat = m;
        this.townTex = tex;
        const c = this.cell;
        const plate = BABYLON.MeshBuilder.CreateGround('coop-town', { width: w * c, height: h * c }, this.scene);
        plate.material = m;
        plate.position.set(this.ox + (e.x0 + w / 2) * c, this.floorH - CoopScene.TOWN_BELOW, this.oy + (e.y0 + h / 2) * c);
        this.add(plate, 'prop', { castShadow: false, ink: false, outline: false });
        this.unlit(plate);
        /** @type {Map<string, any[]>} */
        const byFile = new Map();
        for (const p of CoopCity.pieces(city, this.M)) {
            if (!byFile.has(p.file)) byFile.set(p.file, []);
            byFile.get(p.file).push(p);
        }
        for (const [file, places] of byFile) this.bake(file, places, { castShadow: false }, (mat, mesh) => { this.tintTown(file, mat); this.unlit(mesh); });
        if (this.night) this.paintPools(m, w, h);
    },

    // The service tint of the town's models: the panes of the '_lit' windows and the lamps' glass —
    // lit at night, by day the dark pane of a plain window and dull glass.
    tintTown(file, mat) {
        if (!/\/tint$/.test(mat.name)) return;
        const N = CoopScene.NIGHT, lamp = file === 'dec_streetlamp';
        mat.diffuseColor = World3D.hexColor3(this.night ? (lamp ? N.lamp : N.window) : (lamp ? N.lampDay : N.paneDay));
        mat.emissiveColor = this.night ? World3D.hexColor3(lamp ? N.lamp : N.window) : BABYLON.Color3.Black();
    },

    // The pools of light under the street lamps (night): a glow texture over the town's ground,
    // black but a warm round spot under each lamp's head.
    paintPools(mat, w, h) {
        const px = CoopScene.TOWN_TEX_PX, e = this.city.ext, N = CoopScene.NIGHT;
        const tex = new BABYLON.DynamicTexture('coop-town-glow', { width: w * px, height: h * px }, this.scene, false);
        const ctx = /** @type {CanvasRenderingContext2D} */ (/** @type {unknown} */ (tex.getContext()));
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w * px, h * px);
        ctx.globalCompositeOperation = 'lighter';
        for (const p of CoopCity.pieces(this.city, this.M)) {
            if (p.file !== 'dec_streetlamp') continue;
            const X = (p.x - e.x0) * px, Y = (p.y - e.y0) * px, r = N.poolCells * px;
            const g = ctx.createRadialGradient(X, Y, 0, X, Y, r);
            g.addColorStop(0, N.poolCss);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(X - r, Y - r, 2 * r, 2 * r);
        }
        tex.update(false);
        mat.emissiveTexture = tex;
    },

    // The night (the level's field night): the scene's light, sky and fog of COOP_NIGHT, and the
    // shop's light — a point light high over the building, on while the light is (paintFloor). It
    // lights the things inside only: the ground plates and the town are out of it (unlit) — Ivan 06.11:
    // its round spot lay over the roofs and the street; the rooms' floor glows by cells (paintGlow).
    buildNight() {
        const v = this.view;
        v.applyLighting(Object.assign({}, World3D.cfg(), { sky: COOP_NIGHT_SKY, fog: COOP_NIGHT_FOG, skyIntensity: COOP_NIGHT_SKYLIGHT_INTENSITY,
            skyLight: COOP_NIGHT_SKYLIGHT_COLOR, groundLight: COOP_NIGHT_GROUNDLIGHT_COLOR, sunIntensity: COOP_NIGHT_MOON_INTENSITY, sunColor: COOP_NIGHT_MOON_COLOR }));
        const b = CoopProps.building(this.M);
        if (!b) return;
        const c = this.cell, N = CoopScene.NIGHT, w = (b.x1 - b.x0) * c, d = (b.y1 - b.y0) * c;
        const pos = new BABYLON.Vector3(this.ox + (b.x0 + b.x1) / 2 * c, this.floorH + N.shopHigh * c, this.oy + (b.y0 + b.y1) / 2 * c);
        const light = new BABYLON.PointLight('coop-shop-light', pos, this.scene);
        light.diffuse = World3D.hexColor3(N.shop);
        light.specular = BABYLON.Color3.Black();
        light.range = Math.hypot(w, d) * N.shopRange;
        light.intensity = N.shopIntensity;
        light.excludedMeshes = [];
        this.shopLight = light;
        this.scene.removeLight(v.sun);             // the sun stays the scene's last light (render-conventions)
        this.scene.addLight(v.sun);
    },

    // Keeps the mesh out of the shop's light (buildNight).
    unlit(mesh) {
        if (this.shopLight) this.shopLight.excludedMeshes.push(mesh);
    },

    // The floor: one plate over the whole grid, cells painted into a texture.
    buildFloor() {
        const px = CoopScene.TEX_PX, M = this.M;
        this.floorTex = new BABYLON.DynamicTexture('coop-floor', { width: M.W * px, height: M.H * px }, this.scene, false);
        const m = new BABYLON.StandardMaterial('coop-floor-mat', this.scene);
        m.diffuseTexture = this.floorTex;
        m.specularColor = BABYLON.Color3.Black();
        this.floorMat = m;
        const w = M.W * this.cell, d = M.H * this.cell;
        const plate = BABYLON.MeshBuilder.CreateGround('coop-floor', { width: w, height: d }, this.scene);
        plate.material = m;
        if (this.night) {                            // the rooms lit by the shop's light glow (paintFloor)
            this.floorGlow = new BABYLON.DynamicTexture('coop-floor-glow', { width: M.W * px, height: M.H * px }, this.scene, false);
            this.floorGlow.level = CoopScene.NIGHT.roomGlow;
            m.emissiveTexture = this.floorGlow;
        }
        plate.position.set(this.ox + w / 2, this.floorH, this.oy + d / 2);
        this.add(plate, 'prop', { castShadow: false, ink: false, outline: false });
        this.unlit(plate);
    },

    // st: { power, seen: { guards, cameras } (CoopLevelModel.seenAt) | null,
    //       routes: [{ cells: [[x, y], …], hex, bold }],
    //       hint: [[x, y], …] — the glow under the valuable loot (CoopLevelModel.hintCells), ask: [x, y] | null — the
    //       cell of the advice of «?», vanGone — the van drove off }.
    // Repaints only when something changed.
    paintFloor(st) {
        const key = JSON.stringify(st);
        if (key === this._floorKey) return;
        this._floorKey = key;
        const M = this.M, px = CoopScene.TEX_PX, C = CoopScene.COLORS;
        const ctx = /** @type {CanvasRenderingContext2D} */ (/** @type {unknown} */ (this.floorTex.getContext()));
        for (let y = 0; y < M.H; y++) {
            for (let x = 0; x < M.W; x++) {
                const z = M.inside(x, y) ? M.L.zones[M.zone[y][x]] : null;
                const street = CoopCity.streetFloor(this.city, M, x, y);     // the town's road and sidewalk go on over the street
                const base = street ? C.town[street] : !z ? C.void : C.floor[z.floor];
                ctx.fillStyle = base;
                ctx.fillRect(x * px, y * px, px, px);
                if (street) CoopScene.paintLane(ctx, CoopCity.lane((xx, yy) => this.groundKind(xx, yy), x, y), x * px, y * px, px, C.town.lane);
                if (z && z.kind !== 'outside' && (x + y) % 2) {   // keep: the checkerboard's parity
                    ctx.fillStyle = C.checker;
                    ctx.fillRect(x * px, y * px, px, px);
                }
                if (M.isVan(x, y) && !st.vanGone) {
                    ctx.fillStyle = C.van;
                    ctx.fillRect(x * px, y * px, px, px);
                }
                if (CoopScene.dark(z, st.power)) {
                    ctx.fillStyle = C.dark;
                    ctx.fillRect(x * px, y * px, px, px);
                }
            }
        }
        // Vision: one colour for cameras (only with the power on) and guards — the same eyes of the
        // guard (Ivan 25.10: «Суть одна и та же»), the threat red of the palette.
        const cone = (cells, col) => {
            ctx.fillStyle = col;
            for (const [x, y] of cells) ctx.fillRect(x * px + CoopScene.CONE_IN, y * px + CoopScene.CONE_IN, px - 2 * CoopScene.CONE_IN, px - 2 * CoopScene.CONE_IN);
        };
        if (st.seen) {
            st.seen.cameras.forEach(c => cone(c, C.cone));
            st.seen.guards.forEach(g => cone(g, C.cone));
        }
        // The plan's trail (Ivan 21.10: half the size and round): a dot in the middle of each cell.
        for (const r of st.routes || []) {
            ctx.fillStyle = r.hex;
            const d = r.bold ? px * CoopScene.TRAIL_BOLD : px * CoopScene.TRAIL;
            for (const [x, y] of r.cells) {
                ctx.beginPath();
                ctx.arc((x + 0.5) * px, (y + 0.5) * px, d / 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        // The hint (rules, section 15): the floor of a valuable vitrine glows round its stand.
        for (const [x, y] of st.hint || []) {
            ctx.fillStyle = C.hint;
            ctx.fillRect(x * px, y * px, px, px);
            ctx.strokeStyle = C.hintRim;
            ctx.lineWidth = CoopScene.HINT_RIM_W;
            ctx.strokeRect(x * px + CoopScene.HINT_RIM_IN, y * px + CoopScene.HINT_RIM_IN, px - 2 * CoopScene.HINT_RIM_IN, px - 2 * CoopScene.HINT_RIM_IN);
        }
        // The advice of «?» (rules, section 24): its cell lit, with a thick rim.
        if (st.ask) {
            const [x, y] = st.ask;
            ctx.fillStyle = C.ask;
            ctx.fillRect(x * px, y * px, px, px);
            ctx.strokeStyle = C.askRim;
            ctx.lineWidth = CoopScene.ASK_RIM_W;
            ctx.strokeRect(x * px + CoopScene.ASK_RIM_IN, y * px + CoopScene.ASK_RIM_IN, px - 2 * CoopScene.ASK_RIM_IN, px - 2 * CoopScene.ASK_RIM_IN);
        }
        this.floorTex.update(false);
        if (this.night) this.paintGlow(ctx.canvas, st.power);
    },

    // The night: the rooms glow as the floor is painted while the light is on, the rest is black;
    // the shop's light on with it (Ivan 05.11: the panel puts it out).
    paintGlow(floor, power) {
        const M = this.M, px = CoopScene.TEX_PX, g = /** @type {CanvasRenderingContext2D} */ (/** @type {unknown} */ (this.floorGlow.getContext()));
        g.drawImage(floor, 0, 0);
        g.fillStyle = '#000';
        for (let y = 0; y < M.H; y++) {
            for (let x = 0; x < M.W; x++) if (!CoopScene.litRoom(M, x, y, power)) g.fillRect(x * px, y * px, px, px);
        }
        this.floorGlow.update(false);
        if (this.shopLight) this.shopLight.setEnabled(power !== false);
        this.glowWalls(power !== false);
    },
};
Object.assign(CoopScene.prototype, CoopSceneGround);
