// UIRough.js — worn, hand-made plates of the interface (rules, section 34, «Вид по макету главного экрана», 17.11):
// a port of the menu mockup's generator design/ui-menu-mock/rough.py. Pure geometry and SVG markup, no DOM: UI.js
// draws the markup behind an element's text. A plate's shape comes from its seed (UIRough.seed(id) — the element's
// id): every plate is crumpled its own way and the same way on every run.
//
// A plate (UIRough.plate) fits its box: the outline lies inside it (so the box clips nothing and children keep their
// places), the shadow falls below (UI.js — a drop-shadow of the element). A window strip and a title ribbon
// (UIRough.strip, UIRough.ribbon) reach past their element to the screen's edges and draw their own shadow.
// Numbers — UI_WORN_*, UI_GRID_*, UI_STRIP_*, UI_RIBBON_* in Constants.js.

/** @typedef {[number, number]} Pt */

/** @satisfies {Record<string, any>} */
const UIRough = {
    _ids: 0,      // a running number for the SVG gradient and pattern ids: unique in the page

    // The numbers (Constants.js), with the mockup's values when the constants are not loaded.
    nums() {
        return {
            lineK: typeof UI_WORN_LINE_K !== 'undefined' ? UI_WORN_LINE_K : 0.09,
            dropK: typeof UI_WORN_DROP_K !== 'undefined' ? UI_WORN_DROP_K : 0.07,
            min: typeof UI_WORN_MIN !== 'undefined' ? UI_WORN_MIN : 3,
            max: typeof UI_WORN_MAX !== 'undefined' ? UI_WORN_MAX : 6,
            vary: typeof UI_WORN_LINE_VARY !== 'undefined' ? UI_WORN_LINE_VARY : 0.125,
            jitterK: typeof UI_WORN_JITTER_K !== 'undefined' ? UI_WORN_JITTER_K : 0.05,
            jitterMin: typeof UI_WORN_JITTER_MIN !== 'undefined' ? UI_WORN_JITTER_MIN : 1.5,
            jitterMax: typeof UI_WORN_JITTER_MAX !== 'undefined' ? UI_WORN_JITTER_MAX : 4,
            noise: typeof UI_WORN_NOISE !== 'undefined' ? UI_WORN_NOISE : 0.5,
            wobble: typeof UI_WORN_WOBBLE !== 'undefined' ? UI_WORN_WOBBLE : 2,
            step: typeof UI_WORN_STEP !== 'undefined' ? UI_WORN_STEP : 2,
            nick: typeof UI_WORN_NICK !== 'undefined' ? UI_WORN_NICK : 3,
            calm: typeof UI_CALM_SIDE !== 'undefined' ? UI_CALM_SIDE : 51,
            square: typeof UI_SQUARE_BUTTON !== 'undefined' ? UI_SQUARE_BUTTON : 64,
            cutMin: typeof UI_CUT_MIN !== 'undefined' ? UI_CUT_MIN : 0.24,
            cutMax: typeof UI_CUT_MAX !== 'undefined' ? UI_CUT_MAX : 0.34,
            tiltMax: typeof UI_TILT_MAX !== 'undefined' ? UI_TILT_MAX : 0.7,
            cell: typeof UI_GRID_CELL !== 'undefined' ? UI_GRID_CELL : 12,
            minor: typeof UI_GRID_MINOR !== 'undefined' ? UI_GRID_MINOR : 0.07,
            major: typeof UI_GRID_MAJOR !== 'undefined' ? UI_GRID_MAJOR : 0.13,
            white: typeof UI_GRID_WHITE !== 'undefined' ? UI_GRID_WHITE : 0xffffff,
            glow: typeof UI_GLOW !== 'undefined' ? UI_GLOW : 0.1,
            stripLine: typeof UI_STRIP_LINE !== 'undefined' ? UI_STRIP_LINE : 4,
            stripDrop: typeof UI_STRIP_DROP !== 'undefined' ? UI_STRIP_DROP : 5,
            stripSlope: typeof UI_STRIP_SLOPE !== 'undefined' ? UI_STRIP_SLOPE : 0.4,
            stripDent: typeof UI_STRIP_DENT !== 'undefined' ? UI_STRIP_DENT : 3,
            stripStep: typeof UI_STRIP_STEP !== 'undefined' ? UI_STRIP_STEP : 110,
            twist: typeof UI_RIBBON_TWIST !== 'undefined' ? UI_RIBBON_TWIST : 0.9,
            fork: typeof UI_RIBBON_FORK !== 'undefined' ? UI_RIBBON_FORK : 0.32,
            ribbonStep: typeof UI_RIBBON_STEP !== 'undefined' ? UI_RIBBON_STEP : 90,
            ribbonDent: typeof UI_RIBBON_DENT !== 'undefined' ? UI_RIBBON_DENT : 2.5,
            reach: typeof UI_REACH !== 'undefined' ? UI_REACH : 3000,
        };
    },

    // An element's seed: FNV-1a of its id.
    /** @param {string} id @returns {number} */
    seed(id) {
        let h = 2166136261;
        const s = String(id);
        for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
        return h >>> 0;
    },

    // A deterministic random generator from a seed (mulberry32): next() in [0, 1), uniform(a, b), choice(list).
    /** @param {number} seed */
    rng(seed) {
        let a = seed >>> 0;
        const next = () => {
            a = (a + 0x6d2b79f5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        return {
            next,
            /** @param {number} lo @param {number} hi */
            uniform: (lo, hi) => lo + (hi - lo) * next(),
            /** @param {any[]} list */
            choice: (list) => list[Math.min(list.length - 1, Math.floor(next() * list.length))],
        };
    },

    // The outline, the shadow and the corners' push of a plate h px high: the outline UI_WORN_LINE_K of the height,
    // the shadow UI_WORN_DROP_K, both within UI_WORN_MIN..UI_WORN_MAX.
    /** @param {number} h @returns {{ line: number, drop: number, jitter: number }} */
    sizes(h) {
        const n = this.nums(), clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v)), r1 = (v) => Math.round(v * 10) / 10;
        return { line: clamp(r1(h * n.lineK), n.min, n.max), drop: clamp(r1(h * n.dropK), n.min, n.max),
            jitter: clamp(h * n.jitterK, n.jitterMin, n.jitterMax) };
    },

    // '#rrggbb' mixed with white by k (0..1): a button's glow.
    /** @param {string} hex @param {number} k */
    lighter(hex, k) {
        const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).map(v => Math.round(v + (255 - v) * k));
        return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
    },

    /** @param {number} v */
    hex(v) { return '#' + (v >>> 0).toString(16).padStart(6, '0'); },

    /** @param {Pt[]} pts */
    pts(pts) { return pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '); },

    // Points from a (included) to b (excluded) of one crumpled side: a bow and a wobble scaled by k and the wear,
    // `nicks` torn V-notches (wear.nick times bigger) on a side over 24 px (rough.py _crumple_edge).
    /** @param {any} rnd @param {Pt} a @param {Pt} b @param {number} nicks @param {number} k @param {{ wobble: number, step: number, nick: number }} wear @returns {Pt[]} */
    edge(rnd, a, b, nicks, k, wear) {
        const kw = k * wear.wobble, kn = wear.nick, dx = b[0] - a[0], dy = b[1] - a[1], ln = Math.hypot(dx, dy) || 1;
        const ox = dy / ln, oy = -dx / ln, bow = rnd.uniform(-1.8, 1.8) * kw;
        const n = Math.max(1, Math.round(ln / (rnd.uniform(14, 26) * wear.step)));
        let marks = [[0, 0]];
        for (let i = 1; i < n; i++) marks.push([(i + rnd.uniform(-0.25, 0.25)) / n, rnd.uniform(-1.6, 1.6) * kw]);
        for (let i = 0; i < (ln > 24 ? nicks : 0); i++) {
            const t0 = rnd.uniform(0.15, 0.85), half = rnd.uniform(2.5, 5) * kn / ln;
            marks = marks.filter(m => Math.abs(m[0] - t0) > half * 1.5);
            marks.push([t0 - half, 0], [t0, -rnd.uniform(2.5, 5) * k * kn], [t0 + half, 0]);
        }
        marks.sort((p, q) => p[0] - q[0]);
        return marks.map(([t, d]) => {
            const dd = d + (t > 0 ? bow * Math.sin(Math.PI * t) : 0);
            return /** @type {Pt} */ ([a[0] + dx * t + ox * dd, a[1] + dy * t + oy * dd]);
        });
    },

    // The outline ring: every vertex pushed out along its bisector by a thickness drifting round the plate
    // (base ± vary) — an uneven, hand-inked outline (rough.py _grow).
    /** @param {Pt[]} points @param {number} base @param {any} rnd @param {number} vary @returns {Pt[]} */
    grow(points, base, rnd, vary) {
        const n = points.length, knots = Array.from({ length: 6 }, () => rnd.uniform(1 - vary, 1 + vary));
        const thick = (f) => {
            const x = f * knots.length, i = Math.floor(x) % knots.length, u = (1 - Math.cos(Math.PI * (x - Math.floor(x)))) / 2;
            return base * (knots[i] * (1 - u) + knots[(i + 1) % knots.length] * u);
        };
        const normal = (p, q) => { const dx = q[0] - p[0], dy = q[1] - p[1], ln = Math.hypot(dx, dy) || 1; return [dy / ln, -dx / ln]; };
        return points.map((p, i) => {
            const n1 = normal(points[(i - 1 + n) % n], p), n2 = normal(p, points[(i + 1) % n]);
            let mx = n1[0] + n2[0], my = n1[1] + n2[1];
            const ml = Math.hypot(mx, my) || 1;
            mx /= ml;
            my /= ml;
            const k = thick(i / n) / Math.max(0.5, mx * n1[0] + my * n1[1]);
            return /** @type {Pt} */ ([p[0] + mx * k, p[1] + my * k]);
        });
    },

    // A worn plate w × h fitted in its box [0, w] × [0, h] (rough.py crumple + plate_svg + fit):
    //   seed — UIRough.seed(id); button — a button's wear: exactly one nick (none on a square button, both sides
    //   ≤ UI_SQUARE_BUTTON); cuts — the given cut corners (0 top left, 1 top right, 2 bottom right, 3 bottom left);
    //   nickSide — 'top' | 'right' | 'bottom' | 'left'; skew — { left, right, tan, corner } (a HUD plate's skewed
    //   edge; corner > 0 — only the header corner that high); tilt — degrees, clamped to UI_TILT_MAX.
    // -> { body, ring, line, drop, nicks, cuts }: the fill polygon, the outline polygon, the outline and shadow
    //    thickness, the number of nicks, the cut corners.
    /** @param {{ w: number, h: number, seed: number, button?: boolean, cuts?: number[], nickSide?: string, skew?: any, tilt?: number }} o */
    plate(o) {
        const n = this.nums(), w = Math.max(1, o.w), h = Math.max(1, o.h), rnd = this.rng(o.seed), sz = this.sizes(h);
        const j = () => rnd.uniform(-sz.jitter, sz.jitter), cuts = (o.cuts || []).filter(i => i >= 0 && i < 4);
        const sk = o.skew || {}, t = sk.tan || 0;
        // the base corners: TL, TR, BR, BL — a skewed edge leans as UI.skewPath draws it
        /** @type {Pt[][]} */
        const corners = [[[0, 0]], [[w, 0]], [[w, h]], [[0, h]]];
        if (t && sk.corner) {
            const c = Math.min(sk.corner, h), ct = c * t;
            if (sk.left) corners[0] = [[0, c], [ct, 0]];
            if (sk.right) corners[1] = [[w - ct, 0], [w, c]];
        } else if (t) {
            if (sk.left && sk.right) { corners[2] = [[w - h * t, h]]; corners[3] = [[h * t, h]]; }
            else if (sk.left) corners[0] = [[h * t, 0]];
            else if (sk.right) corners[2] = [[w - h * t, h]];
        }
        for (const list of corners) for (const p of list) { p[0] += j(); p[1] += j(); }
        /** @type {Pt[]} */
        const keys = [];
        corners.forEach((list, i) => {
            if (!cuts.includes(i) || list.length > 1) { keys.push(...list); return; }
            const [x, y] = list[0], s = Math.min(w, h) * rnd.uniform(n.cutMin, n.cutMax);
            for (const q of [corners[(i + 3) % 4].slice(-1)[0], corners[(i + 1) % 4][0]]) {
                const ln = Math.hypot(q[0] - x, q[1] - y) || 1;
                keys.push([x + (q[0] - x) / ln * s, y + (q[1] - y) / ln * s]);
            }
        });
        const sides = keys.map((k, i) => /** @type {[Pt, Pt]} */ ([k, keys[(i + 1) % keys.length]]));
        const size = sides.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]));
        let cut = -1;
        if (o.button && Math.max(w, h) > n.square) {
            const facing = ([a, b]) => {
                const dx = b[0] - a[0], dy = b[1] - a[1], dirs = { top: [1, 0], right: [0, 1], bottom: [-1, 0], left: [0, -1] };
                return Object.keys(dirs).reduce((best, k) => dirs[k][0] * dx + dirs[k][1] * dy > dirs[best][0] * dx + dirs[best][1] * dy ? k : best, 'top');
            };
            const longest = (list) => list.reduce((b, i) => size[i] > size[b] ? i : b, list[0]);
            const all = sides.map((_, i) => i), mine = o.nickSide ? all.filter(i => facing(sides[i]) === o.nickSide) : [];
            const long = all.filter(i => size[i] > 60);
            cut = mine.length ? longest(mine) : long.length ? rnd.choice(long) : longest(all);
        }
        const wear = { wobble: n.wobble, step: n.step, nick: n.nick };
        /** @type {Pt[]} */
        const body = [];
        sides.forEach(([a, b], i) => {
            const calm = Math.min(w, h) < n.calm && size[i] < n.calm;
            body.push(...this.edge(rnd, a, b, i === cut ? 1 : 0, n.noise, calm ? Object.assign({}, wear, { wobble: 0 }) : wear));
        });
        let ring = this.grow(body, sz.line, rnd, n.vary);
        const tilt = Math.max(-n.tiltMax, Math.min(n.tiltMax, Number(o.tilt) || 0)) * Math.PI / 180;
        let shape = [body, ring];
        if (tilt) {
            const c = Math.cos(tilt), s = Math.sin(tilt), cx = w / 2, cy = h / 2;
            shape = shape.map(list => list.map(([x, y]) => /** @type {Pt} */ ([cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c])));
        }
        // fit the outline's bounds to the box: nothing sticks out, the plate is as big as its box
        const xs = shape[1].map(p => p[0]), ys = shape[1].map(p => p[1]);
        const x0 = Math.min(...xs), y0 = Math.min(...ys), kx = w / ((Math.max(...xs) - x0) || 1), ky = h / ((Math.max(...ys) - y0) || 1);
        const fit = (list) => list.map(([x, y]) => /** @type {Pt} */ ([(x - x0) * kx, (y - y0) * ky]));
        ring = fit(shape[1]);
        return { body: fit(shape[0]), ring, line: sz.line, drop: sz.drop, nicks: cut >= 0 ? 1 : 0, cuts };
    },

    // A long hand-cut edge from x0 to x1 at y, leaning by slope around cx (rough.py _edge).
    /** @param {any} rnd @returns {Pt[]} */
    cutEdge(rnd, x0, x1, y, slope, cx, step, dent) {
        const n = Math.max(2, Math.round((x1 - x0) / step)), out = [];
        for (let i = 0; i <= n; i++) {
            const x = x0 + (x1 - x0) * i / n;
            out.push(/** @type {Pt} */ ([x, y + slope * (x - cx) + rnd.uniform(-dent, dent)]));
        }
        return out;
    },

    // The SVG of a plate (UIRough.plate) w × h at left, top of its element: o.fill — its colour; o.grid — a
    // button's blueprint (a radial glow UI_GLOW lighter to the middle and a white grid every UI_GRID_CELL px);
    // o.outline — the outline's colour.
    /** @param {any} g @param {{ w: number, h: number, left?: number, top?: number, fill: string, outline: string, grid?: boolean }} o */
    plateSvg(g, o) {
        const n = this.nums(), id = 'uiw' + (++this._ids), c = n.cell, big = c * 4, white = this.hex(n.white);
        let defs = '', paint = o.fill, grid = '';
        if (o.grid && /^#[0-9a-f]{6}$/i.test(o.fill)) {
            defs = '<radialGradient id="' + id + '" cx=".5" cy=".45" r=".7"><stop offset="0" stop-color="' + this.lighter(o.fill, n.glow)
                + '"/><stop offset="1" stop-color="' + o.fill + '"/></radialGradient><pattern id="' + id + 'p" width="' + big + '" height="'
                + big + '" patternUnits="userSpaceOnUse" x="' + (-c / 2) + '" y="' + (-c / 2) + '"><path d="M' + c + ' 0V' + big + 'M' + 2 * c
                + ' 0V' + big + 'M' + 3 * c + ' 0V' + big + 'M0 ' + c + 'H' + big + 'M0 ' + 2 * c + 'H' + big + 'M0 ' + 3 * c + 'H' + big
                + '" stroke="' + white + '" stroke-opacity="' + n.minor + '" stroke-width="1"/><path d="M.5 0V' + big + 'M0 .5H' + big
                + '" stroke="' + white + '" stroke-opacity="' + n.major + '" stroke-width="1"/></pattern>';
            paint = 'url(#' + id + ')';
            grid = '<polygon points="' + this.pts(g.body) + '" fill="url(#' + id + 'p)"/>';
        }
        return '<svg xmlns="http://www.w3.org/2000/svg" width="' + o.w + '" height="' + o.h + '" style="position:absolute;left:'
            + (o.left || 0) + 'px;top:' + (o.top || 0) + 'px;overflow:visible;pointer-events:none">' + (defs ? '<defs>' + defs + '</defs>' : '')
            + '<polygon points="' + this.pts(g.ring) + '" fill="' + o.outline + '"/><polygon points="' + this.pts(g.body) + '" fill="'
            + paint + '"/>' + grid + '</svg>';
    },

    // A window's strip across the screen behind its element w × h (rough.py strip): the top and bottom edges hand
    // cut and not parallel, the outline UI_STRIP_LINE inside the box, the shadow UI_STRIP_DROP below.
    /** @param {{ w: number, h: number, seed: number, fill: string, outline: string, shadow: string }} o @returns {string} */
    strip(o) {
        const n = this.nums(), rnd = this.rng(o.seed), r = n.reach, cx = o.w / 2, line = n.stripLine, tan = Math.tan(n.stripSlope * Math.PI / 180);
        const top = this.cutEdge(rnd, -r, o.w + r, line, -tan, cx, n.stripStep, n.stripDent);
        const bot = this.cutEdge(rnd, -r, o.w + r, o.h - line, tan * 0.75, cx, n.stripStep, n.stripDent);
        const body = top.concat(bot.slice().reverse());
        const ring = top.map(([x, y]) => /** @type {Pt} */ ([x, y - line * rnd.uniform(0.8, 1.2)]))
            .concat(bot.map(([x, y]) => /** @type {Pt} */ ([x, y + line * rnd.uniform(0.8, 1.2)])).reverse());
        const drop = ring.map(([x, y]) => /** @type {Pt} */ ([x + r, y + n.stripDrop]));
        const sh = (list) => list.map(([x, y]) => /** @type {Pt} */ ([x + r, y]));
        return '<svg xmlns="http://www.w3.org/2000/svg" width="' + (o.w + 2 * r) + '" height="' + o.h + '" style="position:absolute;left:'
            + (-r) + 'px;top:0;overflow:visible;pointer-events:none"><polygon points="' + this.pts(drop) + '" fill="' + o.shadow
            + '"/><polygon points="' + this.pts(sh(ring)) + '" fill="' + o.outline + '"/><polygon points="' + this.pts(sh(body)) + '" fill="'
            + o.fill + '"/></svg>';
    },

    // A window's title ribbon behind its text w × h (rough.py ribbon): from the screen's left edge to a forked tail
    // past the text's right edge, the bottom edge turned UI_RIBBON_TWIST against the top, the long edges dented.
    /** @param {{ w: number, h: number, seed: number, fill: string, outline: string, shadow: string }} o @returns {string} */
    ribbon(o) {
        const n = this.nums(), rnd = this.rng(o.seed), r = n.reach, w = o.w, h = o.h, line = n.stripLine;
        const twist = Math.tan(n.twist * Math.PI / 180) * w, fork = h * n.fork, j = () => rnd.uniform(-n.ribbonDent, n.ribbonDent);
        const top = this.cutEdge(rnd, -r, w, 0, 0, 0, n.ribbonStep, n.ribbonDent);
        const bottom = this.cutEdge(rnd, -r, w + 6, h, 0, 0, n.ribbonStep, n.ribbonDent)
            .map(([x, y]) => /** @type {Pt} */ ([x, y + twist * Math.max(0, x) / (w + 6)]));
        /** @type {Pt[]} */
        const body = top.slice(0, -1).concat([[w + j(), j()], [w - fork + j(), h / 2 + twist / 2], [w + 6 + j(), h + twist + j()]],
            bottom.slice(0, -1).reverse());
        const ring = this.grow(body, line, rnd, 0), drop = ring.map(([x, y]) => /** @type {Pt} */ ([x, y + n.stripDrop]));
        const sh = (list) => list.map(([x, y]) => /** @type {Pt} */ ([x + r, y]));
        return '<svg xmlns="http://www.w3.org/2000/svg" width="' + (w + r + 40) + '" height="' + h + '" style="position:absolute;left:'
            + (-r) + 'px;top:0;overflow:visible;pointer-events:none"><polygon points="' + this.pts(sh(drop)) + '" fill="' + o.shadow
            + '"/><polygon points="' + this.pts(sh(ring)) + '" fill="' + o.outline + '"/><polygon points="' + this.pts(sh(body)) + '" fill="'
            + o.fill + '"/></svg>';
    },
};
