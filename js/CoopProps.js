// CoopProps.js — the models of the co-op level (the modelling brief, sections 6–8): which file
// stands where. The scene (CoopScene) builds nothing of its own: walls, doors, the panel, the
// van, cameras, loot — every one is a .glb in assets/models named as in the brief. The game
// ships blocking stubs with these names (design/level-models, `./run.sh`); the modeller's file
// with the same name replaces a stub (in the PC build — dropped into the `models` folder next to
// the exe) and shows up in the game as it is.
//
// Pure (no Babylon, tested in node): a placement is { file, x, y, yaw, scale? } — x, y in cells
// (fractions: the middle of an edge, a corner), yaw — where the model's front (−Y in Blender)
// looks, degrees as CoopModel.ANGLE (0 — east, 90 — south, towards the camera); scale —
// [along the model's X, along its Y] for the models stretched over a rect (the van, the puddle).

class CoopProps {
    static url(file) {
        return CoopProps.FILES[file];
    }

    // Whether a cell is inside the building (a room, not the street, the alley or the void).
    static indoor(M, x, y) {
        const z = M.inside(x, y) ? M.zone[y][x] : -1;
        return z >= 0 && M.L.zones[z].kind !== 'outside';
    }

    // The building's bounding rect in cells — of its rooms, the street and the alley left out:
    // { x0, y0, x1, y1 }, x1 and y1 past the last room cell; null — no rooms.
    static building(M) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (let y = 0; y < M.H; y++) {
            for (let x = 0; x < M.W; x++) {
                if (!CoopProps.indoor(M, x, y)) continue;
                x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
            }
        }
        return x0 > x1 ? null : { x0, y0, x1, y1 };
    }

    // What stands on the edge between cell (x, y) and its neighbour towards dir ('R' | 'D'),
    // x and y from −1 (the edges round the grid): 'in' — a wall between two rooms, 'out' — the
    // building's outer wall, 'door' — a door, an arch or a gate, null — nothing.
    static edgeKind(M, x, y, dir) {
        const a = CoopProps.indoor(M, x, y);
        const b = CoopProps.indoor(M, x + (dir === 'R' ? 1 : 0), y + (dir === 'D' ? 1 : 0));
        if (!a && !b) return null;
        const e = M.edges.get(M.edgeKey(x, y, dir));
        if (e === 'open') return null;
        if (typeof e === 'number') return 'door';
        return a && b ? 'in' : 'out';
    }

    // The edge on the side ('U' | 'R' | 'D' | 'L') of cell (x, y), as edgeKind.
    static sideKind(M, x, y, side) {
        if (side === 'U') return CoopProps.edgeKind(M, x, y - 1, 'D');
        if (side === 'D') return CoopProps.edgeKind(M, x, y, 'D');
        if (side === 'L') return CoopProps.edgeKind(M, x - 1, y, 'R');
        return CoopProps.edgeKind(M, x, y, 'R');
    }

    // Wall segments, one a cell: the middle of the edge; an outer wall shows its street side
    // (the front of env_wall_out) away from the building.
    static walls(M) {
        const out = [], A = CoopModel.ANGLE;
        for (let y = -1; y < M.H; y++) {
            for (let x = -1; x < M.W; x++) {
                for (const dir of ['R', 'D']) {
                    const k = CoopProps.edgeKind(M, x, y, dir);
                    if (k !== 'in' && k !== 'out') continue;
                    const down = dir === 'D';
                    const far = CoopProps.indoor(M, x + (down ? 0 : 1), y + (down ? 1 : 0));
                    const yaw = down ? (k === 'out' && far ? A.U : A.D) : (k === 'out' && far ? A.L : A.R);
                    out.push({ file: k === 'in' ? 'env_wall_in' : 'env_wall_out', x: down ? x + 0.5 : x + 1, y: down ? y + 1 : y + 0.5, yaw });
                }
            }
        }
        return out;
    }

    // Posts on the grid corners where walls meet or end (brief, section 6): every corner, T and
    // free end of a wall; not in the middle of a straight run, not where a wall runs on into a
    // door (the door's frame closes it).
    static posts(M) {
        const out = [];
        for (let vy = 0; vy <= M.H; vy++) {
            for (let vx = 0; vx <= M.W; vx++) {
                const right = CoopProps.edgeKind(M, vx, vy - 1, 'D'), left = CoopProps.edgeKind(M, vx - 1, vy - 1, 'D');
                const down = CoopProps.edgeKind(M, vx - 1, vy, 'R'), up = CoopProps.edgeKind(M, vx - 1, vy - 1, 'R');
                const all = [right, left, down, up], walls = all.filter(k => k === 'in' || k === 'out').length;
                const solid = all.filter(Boolean).length;
                // keep: two walls in line are a straight run — no post
                const straight = solid === 2 && ((right && left) || (up && down));
                if (walls && !straight) out.push({ file: 'env_wall_post', x: vx, y: vy, yaw: CoopModel.ANGLE.D });
            }
        }
        return out;
    }

    // The model of a door by its lock and width: a doorway (no lock, not shut) two cells wide is an
    // arch; a shut door without a lock is a door leaf however wide — stretched (rules, section 9).
    static doorFile(d) {
        if (d.lock === 'vault') return 'env_door_vault';
        if (d.lock === 'electronic') return 'env_gate_rollup';
        if (d.lock) return 'env_door_lock';
        return d.cells.length > 1 && !d.shut ? 'env_arch' : 'env_door';
    }

    // Where a loot item stands at the start: a painting on a wall (field wall) flush on the face of
    // that wall, facing into its cell (rules, section 10); any other in the middle of its cell,
    // facing the camera. inset — half the wall's thickness, cells.
    static lootPose(M, l, inset) {
        if (l.wall) return CoopProps.onWall(l.at[0], l.at[1], { N: 'U', W: 'L', E: 'R' }[l.wall], inset);
        return { x: l.at[0] + 0.5, y: l.at[1] + 0.5, yaw: CoopModel.ANGLE.D };
    }

    // Doors in the middle of their opening. One across a north–south way faces south (the
    // camera) and opens into the room south of it, one across an east–west way opens west;
    // a door wider than its model is stretched along it. The model hangs its leaf on its -X end
    // (hingeAt); a leaf of a door of several whose neighbour leaf is on that end is turned round
    // (flip) — its hinges go to the wall, a double door opens from the middle, both leaves to
    // the same side (Ivan 21.10 evening, the screenshot of the gallery's front door).
    static doors(M) {
        const mid = (d) => {
            const mids = d.cells.map(([x, y, dir]) => CoopProps.edgeMid(x, y, dir));
            return [mids.reduce((s, m) => s + m[0], 0) / mids.length, mids.reduce((s, m) => s + m[1], 0) / mids.length];
        };
        return M.doors.map((d, i) => {
            const file = CoopProps.doorFile(d), across = d.cells[0][2] === 'U' || d.cells[0][2] === 'D';
            const [x, y] = mid(d);
            const p = { i, file, x, y, yaw: across ? CoopModel.ANGLE.D : CoopModel.ANGLE.L };
            const width = CoopProps.WIDE.includes(file) ? 2 : 1;   // keep: the wide door's model is two cells
            if (d.cells.length !== width) p.scale = [d.cells.length / width, 1];
            const leaves = M.leavesOf(i);
            if (leaves.length > 1) {
                const all = leaves.map(k => mid(M.doors[k]));
                const c = [all.reduce((s, m) => s + m[0], 0) / all.length, all.reduce((s, m) => s + m[1], 0) / all.length];
                const h = CoopProps.hingeAt(p);
                if ((h[0] - x) * (x - c[0]) + (h[1] - y) * (y - c[1]) < 0) {
                    p.yaw += 180;
                    p.flip = true;
                }
                p.joined = true;   // its free end meets the neighbour leaf: no jamb there (Ivan 21.10)
            }
            return Object.assign(p, CoopProps.openLeaf(M, p));
        });
    }

    // How an open leaf lies (Ivan 21.10 evening: along the wall; 24.10, the screenshot of the
    // gallery's hall door by the utility room: «дверь не должна проходить сквозь стену и перекрывать
    // другую дверь»). It turns on its hinges till it meets something: half a turn onto the face of
    // its wall when that face is free for the leaf's length; a wall or a door across the wall line,
    // or another doorway in it, r cells from the hinge stops it where its end touches — 180° −
    // acos(r / length), in a corner (r = 0) a quarter turn, along the wall across.
    // swing — the turn, degrees as a heading (CoopModel.ANGLE, + clockwise on the map) from the
    // shut leaf (hinge → free end); lean — the unit vector the open leaf is set off what it lies on
    // (the face of its wall, of the wall across): away from that wall, towards the room or the opening.
    static openLeaf(M, p) {
        const d = M.doors[p.i], h = CoopProps.hingeAt(p), o = CoopProps.opensTo(p) * Math.PI / 180;
        const ew = d.cells[0][2] === 'U' || d.cells[0][2] === 'D';   // the wall line runs east–west
        const away = Math.sign(ew ? h[0] - p.x : h[1] - p.y), side = Math.round(ew ? Math.sin(o) : Math.cos(o));
        const len = d.cells.length, own = M.leavesOf(p.i);
        let r = len;
        for (let k = 0; k < len; k++) {
            const gx = Math.round(h[0] + (ew ? away * k : 0)), gy = Math.round(h[1] + (ew ? 0 : away * k));
            const across = ew ? CoopProps.edgeKind(M, gx - 1, side > 0 ? gy : gy - 1, 'R') : CoopProps.edgeKind(M, side > 0 ? gx : gx - 1, gy - 1, 'D');
            const next = M.edges.get(ew ? M.edgeKey(away > 0 ? gx : gx - 1, gy - 1, 'D') : M.edgeKey(gx - 1, away > 0 ? gy : gy - 1, 'R'));
            if (across || (typeof next === 'number' && !own.includes(next))) {
                r = k;
                break;
            }
        }
        const c = [p.x - h[0], p.y - h[1]], n = Math.hypot(c[0], c[1]);
        c[0] /= n;
        c[1] /= n;
        const turn = Math.sign(c[0] * Math.sin(o) - c[1] * Math.cos(o));   // + — the room is clockwise of the shut leaf
        const swing = turn * (180 - Math.acos(Math.min(1, r / len)) * 180 / Math.PI);
        const f = Math.atan2(c[1], c[0]) + swing * Math.PI / 180;
        let lean = [-Math.sin(f), Math.cos(f)];
        if (lean[0] * (Math.cos(o) + c[0]) + lean[1] * (Math.sin(o) + c[1]) < 0) lean = [-lean[0], -lean[1]];
        return { swing, lean: lean.map(v => Math.round(v * 1e9) / 1e9) };
    }

    // The hinge end of a door's leaf (cells): the model's -X end — west of a door facing south.
    static hingeAt(p) {
        const a = (p.yaw + 90) * Math.PI / 180;
        return [p.x + Math.cos(a) / 2, p.y + Math.sin(a) / 2];
    }

    // The side an open leaf lies on, degrees (CoopModel.ANGLE): the way its door faced before a
    // flip — a turned leaf opens into the same room as its neighbour.
    static opensTo(p) {
        return p.flip ? p.yaw - 180 : p.yaw;
    }

    // The middle of the edge on the side dir of cell (x, y).
    static edgeMid(x, y, dir) {
        if (dir === 'U') return [x + 0.5, y];
        if (dir === 'D') return [x + 0.5, y + 1];
        if (dir === 'L') return [x, y + 0.5];
        return [x + 1, y + 0.5];
    }

    // Which wall of cell (x, y) a wall-mounted thing hangs on: the north one first (its front
    // faces the camera), then east, west, south; null — the cell has no wall.
    static wallSide(M, x, y) {
        for (const side of ['U', 'R', 'L', 'D']) {
            const k = CoopProps.sideKind(M, x, y, side);
            if (k === 'in' || k === 'out') return side;
        }
        return null;
    }

    // In the middle of the face of the wall on the side `side` of cell (x, y), facing into the
    // cell; inset — half the wall's thickness, cells.
    static onWall(x, y, side, inset) {
        const [dx, dy] = CoopProps.STEP[side];
        return { x: x + 0.5 + dx * (0.5 - inset), y: y + 0.5 + dy * (0.5 - inset), yaw: CoopModel.ANGLE[CoopModel.BACK[side]] };
    }

    // The objects (sections 7–8 without the loot that moves): [{ file, x, y, yaw, scale?, role }];
    // role — what the scene drives in it: 'panel' (+ panel — its index), 'camera' (+ cam — its index), 'screens' (a
    // keypad + door — the index of its gate), 'van' (it drives off at the end of a take).
    // inset — half the wall's thickness, cells: wall-mounted things sit on its face.
    static props(M, inset) {
        const out = [], A = CoopModel.ANGLE;
        const put = (file, p, role, extra) => out.push(Object.assign({ file, role: role || '' }, p, extra));
        // The power panels on their walls (panel — the index in M.panels and a frame's power).
        M.panels.forEach((/** @type {any} */ P, /** @type {number} */ i) => {
            const [x, y] = P.at, side = CoopProps.wallSide(M, x, y);
            if (side) put('prop_power_panel', CoopProps.onWall(x, y, side, inset), 'panel', { panel: i });
        });
        // The keypad of a gate: on the wall by the gate's right post (east or south end), on the
        // side its panel cell is.
        M.doors.forEach((d, di) => {
            if (d.lock !== 'electronic' || !d.panelAt) return;
            const across = d.cells[0][2] === 'U' || d.cells[0][2] === 'D';
            const ends = d.cells.map(([x, y, dir]) => CoopProps.edgeMid(x, y, dir));
            const line = across ? ends[0][1] : ends[0][0], last = Math.max(...ends.map(e => across ? e[0] : e[1])) + 0.5;
            const front = across ? (d.panelAt[1] < line ? 'U' : 'D') : (d.panelAt[0] < line ? 'L' : 'R');
            const off = (front === 'U' || front === 'L' ? -1 : 1) * inset, at = last + CoopProps.KEYPAD_OUT;
            put('prop_keypad', { x: across ? at : line + off, y: across ? line + off : at, yaw: A[front] }, 'screens', { door: di });
        });
        // Cameras: in the corner (or on the wall) behind where they look.
        M.cameras.forEach((c, i) => {
            const a = c.base * Math.PI / 180, dx = Math.round(Math.cos(a)), dy = Math.round(Math.sin(a));
            const [x, y] = c.at;
            put('prop_cctv', { x: x + 0.5 - dx * (0.5 - inset), y: y + 0.5 - dy * (0.5 - inset), yaw: c.base }, 'camera', { cam: i });
        });
        // Laser emitters on the walls at both ends of each beam, facing each other.
        for (const lc of M.beams) {
            const row = lc.every(c => c[1] === lc[0][1]), k = row ? 0 : 1;
            const lo = lc.reduce((m, c) => c[k] < m[k] ? c : m), hi = lc.reduce((m, c) => c[k] > m[k] ? c : m);
            put('prop_laser_emitter', CoopProps.onWall(lo[0], lo[1], row ? 'L' : 'U', inset));
            put('prop_laser_emitter', CoopProps.onWall(hi[0], hi[1], row ? 'R' : 'D', inset));
        }
        // The wall of monitors in front of a guard on his post, on the wall of his room he faces (he
        // watches them; Ivan 25.10: on the north wall they stood behind a guard facing elsewhere):
        // straight ahead, or the nearest cell of that wall with no door or opening.
        for (const g of M.guards) {
            if (!g.post) continue;
            const [x0, y0, x1, y1] = M.L.zones[M.zone[g.post[1]][g.post[0]]].rect, f = g.facing, across = f === 'U' || f === 'D';
            const at = (/** @type {number} */ d) => across ? [g.post[0] + d, f === 'U' ? y0 : y1] : [f === 'L' ? x0 : x1, g.post[1] + d];
            for (let d = 0, n = Math.max(x1 - x0, y1 - y0); d <= n; d = d > 0 ? -d : 1 - d) {
                const [x, y] = at(d), k = x >= x0 && x <= x1 && y >= y0 && y <= y1 ? CoopProps.sideKind(M, x, y, f) : null;
                if (k === 'in' || k === 'out') { put('prop_monitors', CoopProps.onWall(x, y, f, inset), 'screens'); break; }
            }
        }
        // The puddle over each wet rect, stretched to it (the model is 3 × 2 cells), the sign on it.
        for (const o of M.L.objects.filter(q => q.kind === 'wet_floor')) {
            const [x0, y0, x1, y1] = o.rect, w = x1 - x0 + 1, h = y1 - y0 + 1;
            put('prop_puddle', { x: x0 + w / 2, y: y0 + h / 2, yaw: A.D, scale: [w / 3, h / 2] });   // keep: the model is 3 × 2 cells
            put('prop_wet_sign', { x: x0 + CoopProps.SIGN_AT, y: y0 + CoopProps.SIGN_AT, yaw: A.D });
        }
        // The van over its rect, the cab east: the model is the whole van, bay + cab cells long by bay
        // across (Ivan 13.11, rules, section 30; objects.json van), its pivot in the middle.
        const van = M.L.objects.find(q => q.kind === 'van'), V = CoopModel.OBJECTS.van;
        if (van) {
            const [x0, y0, x1, y1] = van.rect, w = x1 - x0 + 1, h = y1 - y0 + 1;
            put('prop_van', { x: x0 + w / 2, y: y0 + h / 2, yaw: A.R, scale: [h / V.bay, w / (V.bay + V.cab)] }, 'van');
        }
        return out;
    }
}

// The files, by the names of the brief (literals: the build's asset scanner finds them by these).
CoopProps.FILES = {
    env_wall_in: 'assets/models/env_wall_in.glb',
    env_wall_out: 'assets/models/env_wall_out.glb',
    env_wall_post: 'assets/models/env_wall_post.glb',
    env_arch: 'assets/models/env_arch.glb',
    env_door: 'assets/models/env_door.glb',
    env_door_lock: 'assets/models/env_door_lock.glb',
    env_door_vault: 'assets/models/env_door_vault.glb',
    env_gate_rollup: 'assets/models/env_gate_rollup.glb',
    prop_power_panel: 'assets/models/prop_power_panel.glb',
    prop_keypad: 'assets/models/prop_keypad.glb',
    prop_cctv: 'assets/models/prop_cctv.glb',
    prop_laser_emitter: 'assets/models/prop_laser_emitter.glb',
    prop_monitors: 'assets/models/prop_monitors.glb',
    prop_wet_sign: 'assets/models/prop_wet_sign.glb',
    prop_puddle: 'assets/models/prop_puddle.glb',
    prop_van: 'assets/models/prop_van.glb',
    prop_police_car: 'assets/models/prop_police_car.glb',
    loot_gold_bar: 'assets/models/loot_gold_bar.glb',
    loot_vitrine: 'assets/models/loot_vitrine.glb',
    loot_vitrine_shards: 'assets/models/loot_vitrine_shards.glb',
    loot_jewel_diamond: 'assets/models/loot_jewel_diamond.glb',
    loot_jewel_crown: 'assets/models/loot_jewel_crown.glb',
    loot_jewel_necklace: 'assets/models/loot_jewel_necklace.glb',
    loot_coins: 'assets/models/loot_coins.glb',
    loot_silver: 'assets/models/loot_silver.glb',
    loot_trinket: 'assets/models/loot_trinket.glb',
    loot_painting: 'assets/models/loot_painting.glb',
    loot_painting_large: 'assets/models/loot_painting_large.glb',
    loot_bust: 'assets/models/loot_bust.glb',
    prop_pedestal: 'assets/models/prop_pedestal.glb',
    prop_handcuffs: 'assets/models/prop_handcuffs.glb',
    prop_ko_stars: 'assets/models/prop_ko_stars.glb',
    // the town round the level (CoopCity)
    dec_house_cream_window: 'assets/models/dec_house_cream_window.glb',
    dec_house_cream_window_lit: 'assets/models/dec_house_cream_window_lit.glb',
    dec_house_cream_blind: 'assets/models/dec_house_cream_blind.glb',
    dec_house_cream_door: 'assets/models/dec_house_cream_door.glb',
    dec_house_cream_roof: 'assets/models/dec_house_cream_roof.glb',
    dec_house_brick_window: 'assets/models/dec_house_brick_window.glb',
    dec_house_brick_window_lit: 'assets/models/dec_house_brick_window_lit.glb',
    dec_house_brick_blind: 'assets/models/dec_house_brick_blind.glb',
    dec_house_brick_door: 'assets/models/dec_house_brick_door.glb',
    dec_house_brick_roof: 'assets/models/dec_house_brick_roof.glb',
    dec_house_parapet: 'assets/models/dec_house_parapet.glb',
    dec_fence: 'assets/models/dec_fence.glb',
    dec_barrier: 'assets/models/dec_barrier.glb',
    dec_streetlamp: 'assets/models/dec_streetlamp.glb'
};
CoopProps.STEP = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
CoopProps.WIDE = ['env_gate_rollup', 'env_arch'];      // models two cells wide
CoopProps.KEYPAD_OUT = COOP_PROPS_KEYPAD_OUT;
CoopProps.SIGN_AT = COOP_PROPS_SIGN_AT;
// What the game drives in each file — the nodes (by name) and the service materials; a file
// without them still shows, the scene tells the modeller what is missing (modelIssue).
CoopProps.NEEDS = {
    env_wall_in: { mats: ['wall_panel'] }, env_wall_out: { mats: ['wall_panel'] }, env_wall_post: {}, env_arch: {},
    env_door: { nodes: ['leaf'] },
    env_door_lock: { nodes: ['leaf'], mats: ['tint'] },
    env_door_vault: { nodes: ['leaf', 'wheel'], mats: ['tint'] },
    env_gate_rollup: { nodes: ['shutter'], mats: ['tint'] },
    prop_power_panel: { nodes: ['lever', 'lamp'], mats: ['tint'] },
    prop_keypad: { mats: ['screen'] },
    prop_cctv: { nodes: ['head'], mats: ['tint'] },
    prop_laser_emitter: {}, prop_monitors: { mats: ['screen'] },
    prop_wet_sign: {}, prop_puddle: {}, prop_van: {}, prop_police_car: { mats: ['tint', 'screen'] },
    loot_gold_bar: {}, loot_vitrine: { nodes: ['glass'] },
    loot_vitrine_shards: { nodes: ['shard_1', 'shard_2', 'shard_3', 'shard_4', 'shard_5', 'shard_6'] },
    loot_jewel_diamond: {}, loot_jewel_crown: {}, loot_jewel_necklace: {}, loot_coins: {}, loot_silver: {}, loot_trinket: {}, loot_painting: {}, loot_painting_large: {}, loot_bust: {},
    prop_pedestal: {}, prop_handcuffs: {}, prop_ko_stars: {},
    dec_house_cream_window: {}, dec_house_cream_blind: {}, dec_house_cream_door: {}, dec_house_cream_roof: {}, dec_house_brick_window: {}, dec_house_brick_blind: {}, dec_house_brick_door: {}, dec_house_brick_roof: {}, dec_house_parapet: {}, dec_fence: {}, dec_barrier: {}
};
// Nodes the scene looks up by name besides NEEDS (shown or hidden when present).
CoopProps.OPTIONAL = { env_door: ['jamb_free'], env_door_lock: ['sensor', 'jamb_free'], env_door_vault: ['sensor'], prop_van: ['roof', 'door_L', 'door_R'], loot_vitrine: ['jewel', 'stand'] };
