// CoopCity.js — the town round the co-op level (Ivan 05.11: «заполни карту городским пейзажем —
// улицы и дома, не нужно пустой травы»; one can't enter the houses nor use them; the level's ground
// is bounded naturally, by walls or fences). Pure view: the model knows nothing of the town.
//
// Pure (no Babylon, tested in node). Cells as the level's grid, beyond it too (x, y < 0 or ≥ W, H).
// The level's street runs on through the town: the van's rows are the road, the street's other
// rows the sidewalks; past the grid's west and east edges the road stays open — the van drives
// off and the police comes along it — and the sidewalks end in railings (Ivan 05.11, his choice
// «дорога открыта»). A road along the grid's bottom edge has a railing on that edge and a sidewalk
// beyond. Cross streets west and east and back streets north cut the town into blocks; every
// other cell of the town — and every void cell of the grid — is a house: rectangles of a few
// cells, 1..3 storeys, laid out of storey-high pieces (CoopProps placements with h — cells up).
// An alley that ends at the grid's edge ends in a plank fence with a yard behind it.

class CoopCity {
    // The town over ext — { x0, y0, x1, y1 } in cells, x1 and y1 past the end — or null for a
    // level with no van (the stations of the polygon keep their lawn).
    // Returns { ext, kind(x, y) — 'grid' | 'road' | 'walk' | 'yard' | 'house', road: [r0, r1],
    // houses: [{ id, x0, y0, x1, y1, floors, style }], house(x, y) — its index or -1,
    // fences, railings: [{ x, y, side }] — the edge on side 'U' | 'R' | 'D' | 'L' of cell (x, y) }.
    static layout(M, ext) {
        const van = M.L.objects.find((/** @type {any} */ o) => o.kind === 'van');
        if (!van) return null;
        const C = CoopCity, r0 = van.rect[1], r1 = van.rect[3];
        const zoneOf = (x, y) => M.inside(x, y) ? M.L.zones[M.zone[y][x]] : null;
        const isFloor = (x, y, floor) => { const z = zoneOf(x, y); return !!z && z.kind === 'outside' && z.floor === floor; };
        const streetRow = (y) => isFloor(0, y, 'street') || isFloor(M.W - 1, y, 'street');
        const southWalk = r1 === M.H - 1 ? M.H : null;    // the road on the grid's last row: a sidewalk beyond it
        // The main street across the whole town: the road on the van's rows, sidewalks on the street's rows.
        const mainKind = (y) => (y >= r0 && y <= r1) ? 'road' : (y === southWalk || (y >= 0 && y < M.H && streetRow(y))) ? 'walk' : null;
        // A strip of the town's street net t cells past the band of houses round the grid (t < 0 — inside the band).
        const strip = (t) => t < 0 ? null : C.STRIP[t % (C.STRIP.length + C.BLOCK)] || null;
        const m = C.BAND;
        const netKind = (x, y) => {
            const ks = [x < 0 ? strip(-1 - x - m) : x >= M.W ? strip(x - M.W - m) : null, y < 0 ? strip(-1 - y - m) : null];
            if (x < 0 || x >= M.W || y === southWalk) ks.push(mainKind(y));
            return ks.includes('road') ? 'road' : ks.includes('walk') ? 'walk' : null;
        };
        const inGrid = (x, y) => x >= 0 && y >= 0 && x < M.W && y < M.H;
        const w = ext.x1 - ext.x0, h = ext.y1 - ext.y0;
        const kinds = new Array(w * h), houseAt = new Int32Array(w * h).fill(-1);
        const at = (x, y) => (x < ext.x0 || y < ext.y0 || x >= ext.x1 || y >= ext.y1) ? -1 : (y - ext.y0) * w + (x - ext.x0);
        for (let y = ext.y0; y < ext.y1; y++) {
            for (let x = ext.x0; x < ext.x1; x++) {
                kinds[at(x, y)] = inGrid(x, y) ? (zoneOf(x, y) ? 'grid' : 'house') : (netKind(x, y) || 'house');
            }
        }
        // The alley's dead ends at the grid's edge: a fence on the edge, a yard behind it.
        const fences = [], railings = [];
        const SIDES = /** @type {const} */ ([['U', 0, -1], ['R', 1, 0], ['D', 0, 1], ['L', -1, 0]]);
        for (let y = 0; y < M.H; y++) {
            for (let x = 0; x < M.W; x++) {
                if (!isFloor(x, y, 'alley')) continue;
                for (const [side, dx, dy] of SIDES) {
                    const i = at(x + dx, y + dy);
                    if (inGrid(x + dx, y + dy) || i < 0 || kinds[i] !== 'house') continue;
                    kinds[i] = 'yard';
                    fences.push({ x, y, side });
                }
            }
        }
        // Railings: the sidewalks at the grid's west and east edges, the curb of a road on its last row.
        for (let y = 0; y < M.H; y++) {
            if (mainKind(y) !== 'walk') continue;
            if (zoneOf(0, y)) railings.push({ x: 0, y, side: 'L' });
            if (zoneOf(M.W - 1, y)) railings.push({ x: M.W - 1, y, side: 'R' });
        }
        if (southWalk !== null) for (let x = 0; x < M.W; x++) if (zoneOf(x, M.H - 1)) railings.push({ x, y: M.H - 1, side: 'D' });
        // Street lamps (Ivan 05.11, the night of level 1): on the main street's sidewalks by the road,
        // past the grid, a lamp every LAMP_STEP cells from the grid's edge, leaning over the road.
        const lamps = [];
        for (let y = ext.y0; y < ext.y1; y++) {
            const toRoad = mainKind(y) !== 'walk' ? 0 : mainKind(y + 1) === 'road' ? 1 : mainKind(y - 1) === 'road' ? -1 : 0;
            if (!toRoad) continue;
            for (let x = ext.x0; x < ext.x1; x++) {
                const d = x < 0 ? -1 - x : x - M.W;
                if (d < C.LAMP_FIRST || (d - C.LAMP_FIRST) % C.LAMP_STEP || kinds[at(x, y)] !== 'walk') continue;
                lamps.push({ x, y, side: toRoad > 0 ? 'D' : 'U' });
            }
        }
        // Houses: the house cells cut into rectangles, row by row, of a seeded size.
        const rnd = C.random(String(M.L.id || M.L.title || ''));
        const houses = [];
        const free = (x, y) => { const i = at(x, y); return i >= 0 && kinds[i] === 'house' && houseAt[i] < 0; };
        for (let y = ext.y0; y < ext.y1; y++) {
            for (let x = ext.x0; x < ext.x1; x++) {
                if (!free(x, y)) continue;
                let hw = 1, hd = 1;
                const wantW = C.HOUSE_MIN + Math.floor(rnd() * (C.HOUSE_MAX - C.HOUSE_MIN + 1));
                const wantD = C.HOUSE_MIN + Math.floor(rnd() * (C.HOUSE_MAX - C.HOUSE_MIN + 1));
                while (hw < wantW && free(x + hw, y)) hw++;
                const rowFree = (yy) => { for (let k = 0; k < hw; k++) if (!free(x + k, yy)) return false; return true; };
                while (hd < wantD && rowFree(y + hd)) hd++;
                // near the level (a cell of it within a cell of the grid) and south of the street — lower
                const near = x + hw > -1 - C.NEAR && x < M.W + C.NEAR && y + hd > -1 - C.NEAR && y < M.H + C.NEAR, south = y > r1;
                const lo = near || south ? C.FLOORS_NEAR : C.FLOORS_FAR, floors = lo + Math.floor(rnd() * C.FLOORS_MORE);
                const id = houses.length;
                houses.push({ id, x0: x, y0: y, x1: x + hw, y1: y + hd, floors, style: rnd() < 0.5 ? 'cream' : 'brick' });
                for (let yy = y; yy < y + hd; yy++) for (let xx = x; xx < x + hw; xx++) houseAt[at(xx, yy)] = id;
            }
        }
        return {
            ext, road: [r0, r1], houses, fences, railings, lamps,
            kind: (x, y) => { const i = at(x, y); return i < 0 ? null : kinds[i]; },
            house: (x, y) => { const i = at(x, y); return i < 0 ? -1 : houseAt[i]; }
        };
    }

    // What the town's ground shows in cell (x, y) of the grid's street: 'road' on the van's rows,
    // 'walk' on the others; null — not the street (the level paints it as it is).
    static streetFloor(city, M, x, y) {
        if (!city || !M.inside(x, y)) return null;
        const z = M.L.zones[M.zone[y][x]];
        if (z.kind !== 'outside' || z.floor !== 'street') return null;
        return y >= city.road[0] && y <= city.road[1] ? 'road' : 'walk';
    }

    // What the ground shows in cell (x, y): the town's kind, the grid's street as road and sidewalk,
    // 'grid' — the rest of the grid (its floor paints itself); null — past the town.
    static ground(city, M, x, y) {
        if (!city) return null;
        const k = city.kind(x, y);
        return k === 'grid' ? CoopCity.streetFloor(city, M, x, y) || 'grid' : k;
    }

    // The lane line of a two-lane road on an edge of cell (x, y): 'U' — its top edge (the middle of a
    // road running east-west), 'L' — its left one; null — none (not a road, a crossing). kind(x, y) —
    // as ground.
    static lane(kind, x, y) {
        const road = (xx, yy) => kind(xx, yy) === 'road';
        if (!road(x, y)) return null;
        // keep: a two-lane road is two cells wide (the line between them)
        if (road(x, y - 1) && !road(x, y - 2) && !road(x, y + 1)) return 'U';
        // keep: a two-lane road is two cells wide (the line between them)
        if (road(x - 1, y) && !road(x - 2, y) && !road(x + 1, y)) return 'L';
        return null;
    }

    // The models of the town (CoopProps placements, h — cells up): per house cell a roof on top,
    // per outer edge a facade piece a storey — a door once on the ground floor towards a sidewalk,
    // windows out, blind walls towards a neighbour (above his roof) and the level's rooms — and a
    // parapet round the roof over the edges with nothing as high beyond; the fences and railings;
    // the street lamps. A seeded WINDOW_LIT share of the windows are '_lit' — their pane is lit at
    // night (Ivan 05.11).
    static pieces(city, M) {
        const C = CoopCity, A = CoopModel.ANGLE, out = [], rnd = C.random('windows:' + String(M.L.id || M.L.title || ''));
        const SIDES = /** @type {const} */ ([['U', 0, -1], ['R', 1, 0], ['D', 0, 1], ['L', -1, 0]]);
        const edge = (x, y, side) => side === 'U' ? { x: x + 0.5, y, yaw: A.U } : side === 'D' ? { x: x + 0.5, y: y + 1, yaw: A.D }
            : side === 'L' ? { x, y: y + 0.5, yaw: A.L } : { x: x + 1, y: y + 0.5, yaw: A.R };
        for (const hs of city.houses) {
            const top = hs.floors * C.STOREY, file = (k) => 'dec_house_' + hs.style + '_' + k;
            /** @type {{ x: number, y: number, side: string, from: number, blind: boolean, walk: boolean }[]} */
            const faces = [];
            for (let y = hs.y0; y < hs.y1; y++) {
                for (let x = hs.x0; x < hs.x1; x++) {
                    out.push({ file: file('roof'), x: x + 0.5, y: y + 0.5, yaw: 0, h: top });
                    for (const [side, dx, dy] of SIDES) {
                        const nx = x + dx, ny = y + dy, n = city.house(nx, ny);
                        if (n === hs.id) continue;
                        const from = n >= 0 ? city.houses[n].floors : 0;
                        if (from < hs.floors) out.push(Object.assign({ file: 'dec_house_parapet', h: top }, edge(x, y, side)));
                        if (from >= hs.floors) continue;
                        const blind = n >= 0 || CoopProps.indoor(M, nx, ny) || city.kind(nx, ny) === null;
                        faces.push({ x, y, side, from, blind, walk: city.kind(nx, ny) === 'walk' });
                    }
                }
            }
            const doors = faces.filter(f => f.walk && f.from === 0), door = doors[Math.floor(doors.length / 2)];
            for (const f of faces) {
                for (let s = f.from; s < hs.floors; s++) {
                    const kind = f === door && s === 0 ? 'door' : f.blind ? 'blind' : rnd() < C.WINDOW_LIT ? 'window_lit' : 'window';
                    out.push(Object.assign({ file: file(kind), h: s * C.STOREY }, edge(f.x, f.y, f.side)));
                }
            }
        }
        for (const f of city.fences) out.push(Object.assign({ file: 'dec_fence', h: 0 }, edge(f.x, f.y, f.side)));
        for (const r of city.railings) out.push(Object.assign({ file: 'dec_barrier', h: 0 }, edge(r.x, r.y, r.side)));
        for (const l of city.lamps) {
            const dy = l.side === 'D' ? C.LAMP_OUT : -C.LAMP_OUT;
            out.push({ file: 'dec_streetlamp', x: l.x + 0.5, y: l.y + 0.5 + dy, yaw: A[l.side], h: 0 });
        }
        return out;
    }

    // A seeded generator of 0..1 (mulberry32 over the string's hash): the same town every time.
    static random(seed) {
        let a = 2166136261;   // keep: FNV-1a's offset basis — the hash of the seed
        for (let i = 0; i < seed.length; i++) a = Math.imul(a ^ seed.charCodeAt(i), 16777619);   // keep: FNV-1a's prime
        return () => {
            a = (a + 0x6d2b79f5) | 0;   // keep: mulberry32's constants, the generator itself
            let t = Math.imul(a ^ (a >>> 15), 1 | a);   // keep: mulberry32's shifts
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;   // keep: mulberry32's shifts
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;   // keep: mulberry32 — 2^32, to 0..1
        };
    }
}

CoopCity.BAND = COOP_CITY_BAND;
CoopCity.BLOCK = COOP_CITY_BLOCK;
CoopCity.STRIP = ['walk', 'road', 'road', 'walk'];   // a street across: sidewalk, two lanes, sidewalk
CoopCity.HOUSE_MIN = COOP_CITY_HOUSE_MIN;
CoopCity.HOUSE_MAX = COOP_CITY_HOUSE_MAX;
CoopCity.WINDOW_LIT = COOP_CITY_WINDOW_LIT;
CoopCity.LAMP_FIRST = COOP_CITY_LAMP_FIRST;
CoopCity.LAMP_STEP = COOP_CITY_LAMP_STEP;
CoopCity.LAMP_OUT = COOP_CITY_LAMP_OUT;
CoopCity.STOREY = COOP_CITY_STOREY;
CoopCity.NEAR = COOP_CITY_NEAR;
CoopCity.FLOORS_NEAR = COOP_CITY_FLOORS_NEAR;
CoopCity.FLOORS_FAR = COOP_CITY_FLOORS_FAR;
CoopCity.FLOORS_MORE = COOP_CITY_FLOORS_MORE;
