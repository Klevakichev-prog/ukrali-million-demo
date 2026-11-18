// CoopModel.js — the rules of the co-op heist level without 3D, on a fixed tick.
// Time is whole ticks only (Ivan, 17.10.2026): every duration in level.json and here is a
// whole number of ticks, the model never sees seconds — how long a tick lasts on screen is
// COOP_TICK_S (Constants.js), the view's business. Every body moves one cell a tick: it walks,
// flies or slides (steps and animations stay in step).
// Plan -> deterministic replay: simulate(plans) computes the whole execution from the plans
// of the four heroes; the scene only replays the frames it returns. The level comes from
// COOP_LEVELS (generated from ../design/*/level.json); the rules of collisions and work are the
// rule set agreed with Ivan on 17.10.2026 (../design/rules/rules.html).
//
// A plan is a list of steps of one hero:
//   { op: 'go', to: [x, y], via? }                walk to the next cell (one cell per step); via — a cell
//                                                 on the way, not a plan point (the last cell of a go)
//   { op: 'wait', ticks }                         stand still
//   { op: 'until', tick }                         stand still until an absolute tick (a buffer)
//   { op: 'act', verb, at: [x, y], target }       verb: pick | hack | open | close | power | smash | unlock | take | drop
// Any hero does any work; one with the skill of a job does it twice as fast. Loot has a mass: it
// is carried over the head, adds to the carrier's mass, and one carries at most his own mass
// (twice that with the skill load). The heroes — mass, model, skills — come from the config
// ../design/heroes/heroes.json (COOP_HEROES in CoopLevels.js).
// Delays chain: a step starts only when the previous one is over, so a fall shifts the rest
// of the plan up to the next 'until'. A hero knocked off the route walks back to the next
// 'go' cell by the shortest path.
// Intent: every body is in one of three states and its step follows from it. Standing (down,
// stunned, working, waiting by the plan, plan over) — no step. Walking — the next cell of the
// shortest path to the current point of the plan (a guard's: of his route), on the map only
// (walls and doors; bodies and the wet floor do not count). Flying or sliding — the next cell
// its way, it cannot stop. Nobody waits for or goes round anybody: crossing intents collide.
//
// A tick is resolved by events, whatever the order of the bodies: a cell claimed by two or more
// and a swap of cells are events; then a step into an occupied cell passes when its owner has
// left and is a hit into a standing body otherwise. The outcome of an event is the ratio of the
// masses (with loot) alone: below KNOCK_1 the masses are close (both moving — both stunned, one
// moving into a standing one falls where it stands), from KNOCK_1 / KNOCK_2 / KNOCK_3 the lighter
// one is knocked 1 / 2 / 3 cells along its lane and the heavier one enters if the cell is free.
// Nobody bounces off a standing (or lying) body: a lighter one walking or flying into it falls
// where it stands for as long as the flight would take; only an oncoming one throws back.
// A knocked body flies a cell a tick and lies LIE_TICKS after landing; one that cannot fly
// falls where it stands for the same time. A flying body hits with its mass: it pushes a lighter
// one on (a chain, a link a tick), bounces back once off a heavier one flying or walking into it,
// falls at a close one and at a standing one.

/** @satisfies {Record<string, any>} */
const CoopModel = {
    DIRS: ['U', 'R', 'D', 'L'],
    DELTA: { U: [0, -1], R: [1, 0], D: [0, 1], L: [-1, 0] },
    BACK: { U: 'D', D: 'U', L: 'R', R: 'L' },
    // The sides a tap walks up to an object from, of equal arrival (rules, section 25; Ivan 10.11: «подходил
    // слева, а не снизу» — for all taps): left, right, up, down — from below the hero stands between the
    // camera (from the south) and the object.
    TAP_SIDES: ['L', 'R', 'U', 'D'],
    ANGLE: { R: 0, D: 90, L: 180, U: -90, E: 0, S: 90, W: 180, N: -90, SE: 45, SW: 135, NW: -135, NE: -45 },
    // The skills: the kinds of work (the lock kinds of doors, the power panel, taking loot), the
    // carry limit (load) and the strength against a guard (force). Every hero has all of them at
    // the base; a hero's config (../design/heroes/heroes.json) lists only those he is better at:
    // he works SKILL_X times as fast, carries and hits SKILL_X times his mass (rules, section 9).
    SKILLS: ['mechanical', 'vault', 'electronic', 'panel', 'take', 'load', 'force'],
    /** @type {number} */
    SKILL_X: null,          // objects.json hero.skill_x (CoopModel.numbers, after this object)
    // The team (CoopModel.heroes over COOP_HEROES, after this object): the heroes in the order of
    // the config, and their ids — the keys of plans, scripts and heroes_at in the levels.
    /** @type {any[]} */
    HEROES: [],
    /** @type {string[]} */
    TEAM: [],
    // The numbers of the rules — the objects config's (../design/objects/objects.json, Ivan 10.11: a game
    // number in the code is forbidden), set by CoopModel.numbers after this object; the lab's knobs
    // (CoopLab.PARAMS) turn them at run time.
    /** @type {number} */
    GUARD_MASS: null,       // guard.mass
    // the ratio of the masses (heavy / light) from which the light one is knocked 1 / 2 / 3 cells: crash.knock_ratio
    /** @type {number} */
    KNOCK_1: null,
    /** @type {number} */
    KNOCK_2: null,
    /** @type {number} */
    KNOCK_3: null,
    /** @type {number} */
    KNOCK_SIDE: null,       // guard.knock_side: a blow at a guard's side knocks him out with force over this many guard masses (section 22)
    /** @type {number} */
    GUARD_RADIUS: null,     // guard.radius: a guard's body, cells
    /** @type {number} */
    BODY_LENGTH: null,      // hero.length_radii: a hero's height in his radii (the beans are built so, the models within 5 %)
    /** @type {number} */
    GUARD_LENGTH: null,     // guard.length: a guard's height (the potato model), cells
    /** @type {number} */
    VITRINE_HALF: null,     // vitrine.half: half the side of a vitrine box, cells
    /** @type {number} */
    BODY_RADIUS: null,      // hero.radius, hero.radius_per_mass: bodyRadius
    /** @type {number} */
    BODY_RADIUS_PER_MASS: null,
    // whole ticks
    /** @type {number} */
    LIE_TICKS: null,        // crash.lie_ticks: a knocked body lies this long after it lands
    /** @type {number} */
    HIT_STUN_TICKS: null,   // crash.hit_stun_ticks: a body in a crash that stays on its feet is stunned this long
    /** @type {number} */
    DROP_TICKS: null,       // hero.drop.ticks
    // The objects of the levels and the times of their actions — locks, the panel, guards and
    // cameras too (CoopModel.objects over COOP_OBJECTS, after this object; rules, sections 9, 10):
    // one config for every level, a level holds no times of objects (Ivan 20.10).
    /** @type {any} */
    OBJECTS: null,
    /** @type {number} */
    FORECAST_TICKS: null,   // run.forecast_ticks: how far ahead guards look at each other's trajectories (rules, section 8)
    /** @type {number} */
    MAX_TICKS: null,        // run.max_ticks
    /** @type {number} */
    CLEAR_TRIAL_PRESSES: null,   // plan.clear_trial_presses: the presses a trial of «Очистить» gives the advice to reach the start (rules, section 24)
    /** @type {Record<string, string>} */
    UNDO_VERB: null,        // plan.undo_verb: what takes a door's action back (the advice of «?», rules, section 24)
    /** @type {number} */
    WAIT_NEAR: null,        // plan.wait_near: how far from the door a tap route looks for a free cell to wait in (rules, section 18)
    /** @type {string[]} */
    TAP_SKIP: null,         // plan.tap_skip: what a tap on an object never does: by their buttons only (rules, section 25)

    // A mass as the player reads it: up to hundredths, a decimal comma (1,5).
    num(v) { return String(Math.round(v * 100) / 100).replace('.', ','); },

    // The radius of a hero in the view, cells: the beans are sized by it, a touch reaches so far.
    bodyRadius(mass) { return CoopModel.BODY_RADIUS + CoopModel.BODY_RADIUS_PER_MASS * mass; },

    // The numbers of the rules from the checked objects config onto the model's fields (see above).
    numbers(/** @type {any} */ O) {
        Object.assign(CoopModel, {
            SKILL_X: O.hero.skill_x, GUARD_MASS: O.guard.mass, KNOCK_SIDE: O.guard.knock_side,
            KNOCK_1: O.crash.knock_ratio[0], KNOCK_2: O.crash.knock_ratio[1], KNOCK_3: O.crash.knock_ratio[2],
            GUARD_RADIUS: O.guard.radius, GUARD_LENGTH: O.guard.length, BODY_LENGTH: O.hero.length_radii, VITRINE_HALF: O.vitrine.half,
            BODY_RADIUS: O.hero.radius, BODY_RADIUS_PER_MASS: O.hero.radius_per_mass,
            LIE_TICKS: O.crash.lie_ticks, HIT_STUN_TICKS: O.crash.hit_stun_ticks, DROP_TICKS: O.hero.drop.ticks,
            FORECAST_TICKS: O.run.forecast_ticks, MAX_TICKS: O.run.max_ticks,
            CLEAR_TRIAL_PRESSES: O.plan.clear_trial_presses, UNDO_VERB: O.plan.undo_verb, WAIT_NEAR: O.plan.wait_near, TAP_SKIP: O.plan.tap_skip,
        });
    },

    // The heroes of the config checked and turned into the model's records: id — the model's
    // fruit / acc — the name and its accusative for the log, colors as numbers. A bad entry
    // throws with the hero and the field: the config is edited by hand.
    heroes(/** @type {any[]} */ defs) {
        const KEYS = ['id', 'book', 'name', 'name_acc', 'fem', 'model', 'icon', 'icon_art', 'art', 'skill', 'mass', 'color', 'mark', 'skills'];
        if (!Array.isArray(defs) || !defs.length) throw new Error('heroes.json: no heroes');
        const seen = new Set(), books = new Set();
        return defs.map((d, i) => {
            const bad = (/** @type {string} */ what) => { throw new Error('heroes.json, ' + (d && d.id || '#' + (i + 1)) + ': ' + what); };
            // a name in another language (rules, section 36, «Язык»): name_en, name_acc_en
            const extra = Object.keys(d).filter(k => !KEYS.includes(k) && !(CoopText.langField(k) && KEYS.includes(/** @type {any} */ (CoopText.langField(k)).base)));
            if (extra.length) bad('unknown field ' + extra.join(', ') + ' (known: ' + KEYS.join(', ') + ')');
            if (typeof d.id !== 'string' || !d.id) bad('no id');
            if (seen.has(d.id)) bad('the id is taken by another hero');
            seen.add(d.id);
            if (typeof d.name !== 'string' || !d.name) bad('no name');
            // the code of his start on a grid sheet of the level book (CoopBook)
            if (typeof d.book !== 'string' || !d.book) bad('no book (his code on the level book\'s map)');
            if (books.has(d.book)) bad('the book code ' + d.book + ' is taken by another hero');
            books.add(d.book);
            if (typeof d.mass !== 'number' || !(d.mass > 0)) bad('mass ' + d.mass + ' is not a mass');
            if (typeof d.model !== 'string' || !/^assets\/models\/[\w.-]+\.glb$/.test(d.model)) bad('model ' + d.model + ' is not assets/models/<file>.glb');
            // the hero's pictures (rules, section 29): the full figure of his card and the icon of the card on the left
            for (const k of ['art', 'icon_art']) if (d[k] !== undefined && !/^assets\/heroes\/[\w.-]+\.png$/.test(d[k])) bad(k + ' ' + d[k] + ' is not assets/heroes/<file>.png');
            // the skill — one word of the texts, the same everywhere (rules, section 29; Ivan 13.11): its key
            if (d.skill !== undefined && !(typeof d.skill === 'string' && ('game.skill_' + d.skill) in CoopText.all())) bad('skill ' + d.skill + ' has no word game.skill_<skill> in design/texts');
            const hex = (/** @type {string} */ k) => /^#[0-9a-f]{6}$/i.test(d[k]) ? parseInt(d[k].slice(1), 16) : bad(k + ' ' + d[k] + ' is not #rrggbb');
            const skills = d.skills === undefined ? [] : d.skills;
            if (!Array.isArray(skills)) bad('skills is not a list');
            const unknown = skills.filter((/** @type {string} */ s) => !CoopModel.SKILLS.includes(s));
            if (unknown.length) bad('unknown skill ' + unknown.join(', ') + ' (known: ' + CoopModel.SKILLS.join(', ') + ')');
            if (new Set(skills).size !== skills.length) bad('a skill is listed twice');
            return { id: d.id, book: d.book, fruit: d.name, acc: d.name_acc || d.name, fem: !!d.fem, model: d.model, icon: d.icon || '',
                iconArt: d.icon_art || '', art: d.art || '', skill: d.skill || '', mass: d.mass, color: hex('color'), mark: hex('mark'), skills: skills.slice() };
        });
    },

    // A level by its id; no id — the first of the ladder (the lowest order), else the first level
    // that is not a lab station. over (optional) — fields laid over a copy of the level (the main
    // screen's gang, rules, section 36; a test's moved solution): the level itself stays as it is.
    /** @param {string} [levelId] @param {Record<string, any>} [over] */
    create(levelId, over) {
        const id = levelId || CoopModel.firstLevel();
        if (!COOP_LEVELS[id]) throw new Error('no level ' + id + ' (levels: ' + Object.keys(COOP_LEVELS).join(', ') + ')');
        // in the player's language (rules, section 36, «Язык»): the level's texts and the heroes' names — <k>_<lang> over k
        const L = CoopText.localize(over ? Object.assign({}, COOP_LEVELS[id], over) : COOP_LEVELS[id]);
        const heroes = CoopText.localize(COOP_HEROES);
        return new CoopLevelModel(L, heroes === COOP_HEROES ? CoopModel.HEROES : CoopModel.heroes(heroes));
    },

    /** @returns {string} */
    firstLevel() {
        const levels = Object.values(COOP_LEVELS).filter((/** @type {any} */ l) => !l.lab);
        const ladder = levels.filter((/** @type {any} */ l) => Number.isInteger(l.order)).sort((/** @type {any} */ a, /** @type {any} */ b) => a.order - b.order);
        return (ladder[0] || levels[0]).id;
    },

    // The objects config (design/objects/objects.json) checked: per action ticks — the time for
    // anybody, skill — the one that makes it SKILL_X times as fast (null — none); the vitrine's
    // grab_keep — the share of the price and the mass a grabbed multi item keeps (rules, section 10,
    // 09.11). A bad field throws.
    objects(/** @type {any} */ o) {
        const act = (/** @type {any} */ a, /** @type {string} */ what) => {
            if (!a) throw new Error('objects.json: no ' + what);
            CoopModel.ticks(a.ticks, 'objects.json, ' + what + '.ticks');
            if (a.skill !== null && !CoopModel.SKILLS.includes(a.skill)) throw new Error('objects.json, ' + what + '.skill: unknown skill ' + a.skill);
            return { ticks: a.ticks, skill: a.skill };
        };
        // a group of plain times: every key of `keys`, a whole number of ticks
        const times = (/** @type {any} */ g, /** @type {string} */ what, /** @type {string[]} */ keys) => {
            if (!g) throw new Error('objects.json: no ' + what);
            const out = /** @type {Record<string, number>} */ ({});
            for (const k of keys) out[k] = CoopModel.ticks(g[k], 'objects.json, ' + what + '.' + k);
            return out;
        };
        // a positive number (a mass, a ratio, a size in cells)
        const num = (/** @type {any} */ g, /** @type {string} */ what, /** @type {string} */ k) => {
            if (!g || typeof g[k] !== 'number' || !(g[k] > 0)) throw new Error('objects.json, ' + what + '.' + k + ': ' + (g && g[k]) + ' is not a positive number');
            return g[k];
        };
        const v = o && o.vitrine, l = o && o.loot, d = o && o.door, lk = o && o.lock, p = o && o.power_panel;
        if (!v || !l || !d || !lk || !p) throw new Error('objects.json: no vitrine, door, loot, lock or power_panel');
        const h = o.hero, c = o.crash, pl = o.plan, r = o.run;
        if (!h || !c || !pl || !r) throw new Error('objects.json: no hero, crash, plan or run');
        const kr = c.knock_ratio;
        if (!Array.isArray(kr) || kr.length !== 3 || kr.some((x, i) => typeof x !== 'number' || !(x >= 1) || (i && !(x > kr[i - 1]))))
            throw new Error('objects.json, crash.knock_ratio: ' + JSON.stringify(kr) + ' is not three growing ratios ≥ 1');
        const verbs = (/** @type {any} */ g, /** @type {string} */ what, /** @type {string} */ k) => {
            if (!Array.isArray(g[k]) || g[k].some((/** @type {any} */ x) => typeof x !== 'string' || !x)) throw new Error('objects.json, ' + what + '.' + k + ': not a list of verbs');
            return g[k].slice();
        };
        // the models of a loot item: id -> its name in the level book, both unique
        const models = (/** @type {any} */ m) => {
            const out = /** @type {Record<string, string>} */ ({});
            for (const [k, x] of Object.entries(m || {})) if (k !== 'note') {
                if (!/^loot_\w+$/.test(k) || typeof x !== 'string' || !x) throw new Error('objects.json, loot.models.' + k + ': not loot_<model> -> its name in the book');
                if (Object.values(out).includes(x)) throw new Error('objects.json, loot.models.' + k + ': the name ' + x + ' is taken by another model');
                out[k] = x;
            }
            if (!Object.keys(out).length) throw new Error('objects.json: no loot.models');
            return out;
        };
        if (!pl.undo_verb || typeof pl.undo_verb !== 'object' || Object.values(pl.undo_verb).some(x => typeof x !== 'string')) throw new Error('objects.json, plan.undo_verb: not verb -> verb');
        if (typeof pl.hint_on !== 'boolean') throw new Error('objects.json, plan.hint_on: ' + pl.hint_on + ' is not true / false');
        if (typeof v.grab_keep !== 'number' || !(v.grab_keep > 0 && v.grab_keep <= 1)) throw new Error('objects.json, vitrine.grab_keep: ' + v.grab_keep + ' is not a share of the item');
        // the van's lengths in cells (rules, section 30): whole, from 1
        const cells = (/** @type {any} */ g, /** @type {string} */ k) => {
            if (!g || !Number.isInteger(g[k]) || g[k] < 1) throw new Error('objects.json, van.' + k + ': ' + (g && g[k]) + ' is not a whole number of cells from 1');
            return g[k];
        };
        return { vitrine: { smash: act(v.smash, 'vitrine.smash'), unlock: act(v.unlock, 'vitrine.unlock'), grab: act(v.grab, 'vitrine.grab'),
            gather: act(v.gather, 'vitrine.gather'), grab_keep: v.grab_keep, half: num(v, 'vitrine', 'half') },
            door: { open: act(d.open, 'door.open'), close: act(d.close, 'door.close') }, loot: { take: act(l.take, 'loot.take'), models: models(l.models) },
            lock: Object.fromEntries(Object.keys(lk).filter(k => k !== 'note').map(k => [k, act(lk[k], 'lock.' + k)])),
            power_panel: { off: act(p.off, 'power_panel.off'), on: act(p.on, 'power_panel.on') },
            van: { bay: cells(o.van, 'bay'), cab: cells(o.van, 'cab') },
            guard: Object.assign(times(o.guard, 'guard', ['spot_ticks', 'knockout_ticks', 'knockout_force_ticks', 'dark_ticks', 'look_ticks',
                'knockout_hero_ticks', 'knockout_hero_force_ticks', 'stop_look_ticks']),
                { knock: act(o.guard.knock, 'guard.knock'), tie: act(o.guard.tie, 'guard.tie'), untie: act(o.guard.untie, 'guard.untie'),
                    mass: num(o.guard, 'guard', 'mass'), knock_side: num(o.guard, 'guard', 'knock_side'), radius: num(o.guard, 'guard', 'radius'), length: num(o.guard, 'guard', 'length') }),
            camera: Object.assign(times(o.camera, 'camera', ['period_ticks', 'spot_ticks']), { fov_deg: num(o.camera, 'camera', 'fov_deg') }),
            hero: { skill_x: num(h, 'hero', 'skill_x'), radius: num(h, 'hero', 'radius'), radius_per_mass: num(h, 'hero', 'radius_per_mass'),
                length_radii: num(h, 'hero', 'length_radii'), drop: act(h.drop, 'hero.drop') },
            crash: { knock_ratio: kr.slice(), lie_ticks: CoopModel.ticks(c.lie_ticks, 'objects.json, crash.lie_ticks'),
                hit_stun_ticks: CoopModel.ticks(c.hit_stun_ticks, 'objects.json, crash.hit_stun_ticks') },
            plan: { wait_near: num(pl, 'plan', 'wait_near'), clear_trial_presses: CoopModel.ticks(pl.clear_trial_presses, 'objects.json, plan.clear_trial_presses'),
                tap_skip: verbs(pl, 'plan', 'tap_skip'), undo_verb: Object.assign({}, pl.undo_verb), task_stars: CoopModel.ticks(pl.task_stars, 'objects.json, plan.task_stars'),
                hint_on: pl.hint_on },
            run: { max_ticks: CoopModel.ticks(r.max_ticks, 'objects.json, run.max_ticks'), forecast_ticks: CoopModel.ticks(r.forecast_ticks, 'objects.json, run.forecast_ticks') } };
    },

    // A duration from level.json: a whole number of ticks, anything else is a data error.
    ticks(v, what) {
        if (!Number.isInteger(v) || v < 0) throw new Error(what + ': ' + v + ' is not a whole number of ticks');
        return v;
    },

    // Ticks on the screen (Ivan 06.11): a tick is a second — «m:ss» (07.11: «уберём один ноль»),
    // moments and durations alike (the log, the HUD, the plan sheet); the model itself counts whole ticks.
    clock(t) {
        const s = Math.max(0, Math.round(t));
        return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }
};
CoopModel.HEROES = CoopModel.heroes(COOP_HEROES);
CoopModel.OBJECTS = CoopModel.objects(COOP_OBJECTS);
CoopModel.numbers(CoopModel.OBJECTS);
CoopModel.TEAM = CoopModel.HEROES.map(h => h.id);

// The level's model is cut into parts (Game/CLAUDE.md, «Parts of a class»): methods of
// CoopLevelModel mixed into its prototype — CoopModelPress.js (a press of the plan's screen made
// into steps, the plans from a script), CoopModelAdvice.js (the ceiling of the plans, «?» and
// «Очистить»).
class CoopLevelModel {
    /** @param {any} L @param {any[]} [heroes] the team's config (CoopModel.heroes), in the player's language */
    constructor(L, heroes = CoopModel.HEROES) {
        // the data checked first: a typo throws, naming the field, instead of changing the rules
        CoopCheck.level(L);
        this.L = L;
        this.id = L.id;
        /** @type {any[] | null} */
        this._exitPosts = null;    // exitPosts(), built on the first call
        this.W = L.grid.w;
        this.H = L.grid.h;
        const K = CoopModel.ticks;
        // Zones: index per cell, -1 is the void.
        this.zone = Array.from({ length: this.H }, () => Array(this.W).fill(-1));
        L.zones.forEach((z, i) => this.eachCell(z.rect, (x, y) => { this.zone[y][x] = i; }));
        // Doors: the edges they sit on. A door wider than a cell is a leaf per cell (Ivan 21.10, rules,
        // section 9): each leaf opens and closes on its own, the lock is one — lockOf, the index of
        // the first leaf, which keeps the door's id (the next ones: id_2, …). A gate with a keypad
        // opens whole, from the keypad; an archway (no lock, open at the start) has no leaves.
        this.doors = [];
        for (const d of L.doors) {
            const w = d.width || 1, cells = [];
            for (let i = 0; i < w; i++) {
                const along = d.side === 'N' || d.side === 'S';
                const x = d.at[0] + (along ? i : 0), y = d.at[1] + (along ? 0 : i);
                const dir = { N: 'U', S: 'D', E: 'R', W: 'L' }[d.side];
                cells.push([x, y, dir]);
            }
            const whole = d.panel_at || (!d.lock && !d.shut), leaves = whole ? [cells] : cells.map(c => [c]), lockOf = this.doors.length;
            leaves.forEach((part, k) => this.doors.push({ id: k ? d.id + '_' + (k + 1) : d.id, name: d.name || d.id, lock: d.lock,
                shut: !!d.shut, sensor: !!d.sensor, cells: part, panelAt: d.panel_at || null, lockOf }));
        }
        this.edges = new Map();
        for (let y = 0; y < this.H; y++) {
            for (let x = 0; x < this.W; x++) {
                for (const dir of ['R', 'D']) this.edges.set(this.edgeKey(x, y, dir), this.wallBetween(x, y, dir) ? 'wall' : 'open');
            }
        }
        this.doors.forEach((d, i) => d.cells.forEach(([x, y, dir]) => this.edges.set(this.edgeKey(x, y, dir), i)));
        // Objects.
        // Every object but the van is optional: a lab station has only what its mechanic needs.
        const obj = (kind) => L.objects.find(o => o.kind === kind);
        // the power panels (Ivan 25.10: the light and the alarm on two panels, rules, section 20):
        // each with its own list; the run keeps one on/off flag a panel, in this order
        const panels = L.objects.filter(o => o.kind === 'power_panel');
        this.panels = panels.map(p => ({ id: p.id, name: p.name || CoopText.t('model.panel_default'), at: p.at, powers: new Set() }));
        // the lasers: every beam of the level (one lasers object — one beam in a row or a column)
        this.beams = L.objects.filter(o => o.kind === 'lasers').map(o => o.cells.map(c => [c[0], c[1]]));
        this.lasers = new Set(this.beams.flat().map(c => c[0] + ',' + c[1]));
        this.wet = new Set();
        L.objects.filter(o => o.kind === 'wet_floor').forEach(o => this.eachCell(o.rect, (x, y) => this.wet.add(x + ',' + y)));
        // The van (Ivan 13.11, rules, section 30): the bay — where the gang starts and delivers, «in the van»;
        // the cab — its cells at the exit's end, shut (the rect's size is CoopCheck.level's).
        const van = obj('van'), [vx0, , vx1] = van.rect, cab = CoopModel.OBJECTS.van.cab;
        this.van = new Set();
        this.cab = new Set();
        this.eachCell(van.rect, (x, y) => ((van.exit === 'E' ? vx1 - x : x - vx0) < cab ? this.cab : this.van).add(x + ',' + y));
        this.vanBack = van.exit === 'E' ? -1 : 1;
        this.loot = L.loot.map((l) => {
            if (typeof l.mass !== 'number' || !(l.mass >= 0)) throw new Error(l.id + '.mass: ' + l.mass + ' is not a mass');
            return { id: l.id, name: l.name, at: l.at, value: l.value, mass: l.mass, model: l.model, glass: !!l.glass, stand: !!l.stand, wall: l.wall || null, sensor: !!l.sensor, hint: !!l.hint, multi: !!l.multi };
        });
        // a vitrine and a pedestal (stand: an item on it, no glass) take their cell for good (rules, section 16)
        this.blocked = new Set(this.loot.filter(l => l.glass || l.stand).map(l => l.at[0] + ',' + l.at[1]));
        // and the van's cab: nobody steps in, sight passes, like a vitrine (rules, section 30)
        this.cab.forEach(k => this.blocked.add(k));
        // a camera is local — on the monitors of a posted guard (watcher), or online — nobody to knock
        // out (Ivan 20.10, rules, section 8)
        this.cameras = L.cameras.map(c => {
            if (c.kind !== 'local' && c.kind !== 'online') throw new Error(c.id + '.kind: ' + c.kind + ' is not local or online');
            if (c.kind === 'local') {
                const w = L.guards.find(g => g.id === c.watcher);
                if (!w || !w.post) throw new Error(c.id + '.watcher: ' + c.watcher + ' has no post');
            }
            return { id: c.id, kind: c.kind, watcher: c.kind === 'local' ? c.watcher : null, at: c.at, base: CoopModel.ANGLE[c.dir], sweep: c.sweep_deg || 0,
                period: c.sweep_deg ? CoopModel.OBJECTS.camera.period_ticks : 0, range: c.range, fov: c.fov_deg || CoopModel.OBJECTS.camera.fov_deg };
        });
        // what a panel switches off is its list in the level (Ivan 20.10): the light, the lasers,
        // the sensors, cameras by id; what is on no list never goes off
        panels.forEach((panel, i) => {
            if (!Array.isArray(panel.powers)) throw new Error('power_panel.powers: not a list');
            for (const w of panel.powers) {
                if (!['light', 'lasers', 'sensors'].includes(w) && !this.cameras.some(c => c.id === w)) throw new Error('power_panel.powers: unknown ' + w);
                this.panels[i].powers.add(w);
            }
        });
        this.guards = L.guards.map((g) => ({
            id: g.id, name: g.name, acc: g.name_acc || g.name, range: g.cone.range, fov: g.cone.fov_deg,
            spot: CoopModel.OBJECTS.guard.spot_ticks,
            patrol: g.patrol ? this.expand(g.patrol) : null, post: g.post || null,
            // on his round he stops every stopEvery steps and looks round (Ivan 25.10, rules, section 8)
            stopEvery: g.stop_every === undefined ? 0 : CoopModel.ticks(g.stop_every, g.id + '.stop_every'),
            facing: { N: 'U', E: 'R', S: 'D', W: 'L' }[g.facing] || g.facing || 'D'
        }));
        // Guards never meet (rules, section 8): the rounds and posts of different guards share no cell.
        this.guards.forEach((g, i) => this.guards.forEach((o, j) => {
            if (j <= i) return;
            const cells = (/** @type {any} */ q) => new Set((q.patrol || [q.post]).map((/** @type {number[]} */ c) => c[0] + ',' + c[1]));
            const a = cells(g), b = cells(o), common = [...a].find(k => b.has(k));
            if (!common) return;
            const [x, y] = common.split(',');
            if (g.patrol && o.patrol) throw new Error('the round of ' + o.id + ' meets the round of ' + g.id + ' at [' + x + ',' + y + ']');
            const [post, round] = g.patrol ? [o, g] : [g, o];
            throw new Error(post.id + '.post [' + x + ',' + y + '] is on the ' + (round.patrol ? 'round' : 'post') + ' of ' + round.id);
        }));
        this.policeTicks = K(L.rules.alarm_police_ticks, 'rules.alarm_police_ticks');
        // the police patrol: the ceiling of the heist time (rules, section 14)
        this.patrolTicks = K(L.rules.patrol_ticks, 'rules.patrol_ticks');
        this.noiseCells = L.rules.glass_noise_cells;
        this.stars = L.goal.stars;
        // Heroes start inside the van, one per cell, unless the level puts them (heroes_at).
        const vanCells = [...this.van].map(k => k.split(',').map(Number)).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
        const at = L.heroes_at || {};
        // The gang always starts in the van (Ivan 25.10, rules, section 19); a lab station may put
        // a hero anywhere its mechanic needs.
        if (!L.lab) for (const [k, c] of Object.entries(at)) if (!this.van.has(c.join(','))) throw new Error(L.id + '.heroes_at.' + k + ': ' + JSON.stringify(c) + ' is not in the van');
        // The crew of the level (level.json -> team, hero ids; none — the whole config, in its order).
        const team = (L.team || CoopModel.TEAM).map((/** @type {string} */ id) => {
            const h = heroes.find(q => q.id === id);
            if (!h) throw new Error(L.id + '.team: no hero ' + id + ' in heroes.json');
            return h;
        });
        if (!team.length || new Set(team).size !== team.length) throw new Error(L.id + '.team: empty or a hero twice');
        this.heroes = team.map((h, i) => ({ ...h, skills: h.skills.slice(), start: at[h.id] || vanCells[i] }));
        this.team = this.heroes.map(h => h.id);
        // Co-op tasks per goal in stars (rules, section 13): checked here, handed out by tasksFor.
        this.tasks = {};
        for (const [k, list] of Object.entries(L.tasks || {})) if (k !== 'note') this.tasks[k] = list.map(d => this.parseTask(d, 'tasks.' + k));
        CoopCheck.map(this);
    }

    // Can anything of the level raise the alarm: a sensor on a door or a vitrine, a laser, a camera, a
    // guard (CoopRun.alarm's causes). The plan sheet tells the ГБР only then (rules, section 27; Ivan 09.11).
    /** @returns {boolean} */
    canAlarm() {
        return this.doors.some(d => d.sensor) || this.loot.some(l => l.sensor) || this.beams.length > 0
            || this.cameras.length > 0 || this.guards.length > 0;
    }

    // One task of the level data -> { kind, ref, loot?, count?, skill, text }; only a door with a
    // lock, the level's power panel and guard, the level's loot (rules, section 13).
    parseTask(d, where) {
        const bad = (/** @type {string} */ what) => { throw new Error(where + ': ' + what); };
        if (d.door !== undefined) {
            const i = this.doors.findIndex(x => x.id === d.door);
            if (i < 0) bad('no door ' + d.door);
            if (!this.doors[i].lock) bad('door ' + d.door + ' has no lock');
            return { kind: 'door', ref: i, skill: this.doors[i].lock, text: CoopText.t('model.task_door', { door: this.doors[i].name }) };
        }
        if (d.panel !== undefined) {
            const i = this.panelIndex(d.panel);
            if (i < 0) bad('no power panel ' + d.panel);
            return { kind: 'panel', ref: i, skill: 'panel', text: CoopText.t('model.task_panel', { panel: this.panels[i].name.toLowerCase() }) };
        }
        if (d.guard !== undefined) {
            const i = this.guards.findIndex(g => g.id === d.guard);
            if (i < 0) bad('no guard ' + d.guard);
            return { kind: 'guard', ref: i, skill: 'force', text: CoopText.t('model.task_guard', { guard: this.guards[i] }) };
        }
        if (d.loot !== undefined) {
            const loot = d.loot.map((/** @type {string} */ id) => {
                const i = this.loot.findIndex(l => l.id === id);
                if (i < 0) bad('no loot ' + id);
                return i;
            });
            if (!Number.isInteger(d.count) || d.count < 1 || d.count > loot.length) bad('count ' + d.count + ' of ' + loot.length + ' items');
            const names = [...new Set(loot.map((/** @type {number} */ i) => this.loot[i].name))].join(', ');
            return { kind: 'loot', ref: -1, loot, count: d.count, skill: 'take', text: CoopText.t('model.task_loot', { count: d.count, of: loot.length, loot: names }) };
        }
        return bad('unknown task ' + JSON.stringify(d));
    }

    // The tasks of the goal in stars, each with its hero: the one with its skill; several or
    // nobody — the one of them with fewer tasks so far, then the first in the config's order.
    /** @param {number} stars */
    tasksFor(stars) {
        const list = this.tasks[stars] || [], n = this.heroes.map(() => 0);
        return list.map(t => {
            let can = this.heroes.map((h, i) => i).filter(i => this.heroes[i].skills.includes(t.skill));
            if (!can.length) can = this.heroes.map((h, i) => i);
            const hero = can.reduce((b, i) => (n[i] < n[b] ? i : b), can[0]);
            n[hero]++;
            return Object.assign({ hero }, t);
        });
    }

    // Whether a run did the task — whoever did it (rules, section 13): a door picked (at the picking,
    // also when it is locked again later, Ivan 21.10), the light
    // cut, a guard knocked out (counted at the knockout, also when he gets up later), the count
    // of the items delivered to the van.
    taskDone(r, t) {
        const F = r.frames, last = F[F.length - 1];
        if (t.kind === 'door') return F.some((/** @type {any} */ f) => !!(f.unl ? f.unl[t.ref] : f.doors[t.ref]));
        if (t.kind === 'panel') return F.some((/** @type {any} */ f) => f.power[t.ref] === false);
        if (t.kind === 'guard') return F.some((/** @type {any} */ f) => f.g[t.ref].out);
        return t.loot.filter((/** @type {number} */ i) => last.loot[i].del).length >= t.count;
    }

    // The co-op outcome for the goal in stars: success — every task done, at least one star,
    // nobody caught (a hero left outside the van does not spoil it).
    /** @param {number} stars */
    outcome(r, stars) {
        const tasks = this.tasksFor(stars).map(t => Object.assign({ done: this.taskDone(r, t) }, t));
        const missed = tasks.filter(t => !t.done);
        return { tasks, missed, ok: !missed.length && r.stars >= 1 && !r.caught.length };
    }

    eachCell(rect, fn) {
        for (let y = rect[1]; y <= rect[3]; y++) for (let x = rect[0]; x <= rect[2]; x++) fn(x, y);
    }

    // A polyline of corner cells -> the list of cells along it (the loop closes on itself).
    expand(points) {
        const out = [];
        for (let i = 0; i + 1 < points.length; i++) {
            let [x, y] = points[i];
            const [tx, ty] = points[i + 1];
            while (x !== tx || y !== ty) {
                out.push([x, y]);
                x += Math.sign(tx - x);
                if (x === tx) y += Math.sign(ty - y);
            }
        }
        return out;
    }

    edgeKey(x, y, dir) {
        if (dir === 'R') return x + ',' + y + 'R';
        if (dir === 'L') return (x - 1) + ',' + y + 'R';
        if (dir === 'D') return x + ',' + y + 'D';
        return x + ',' + (y - 1) + 'D';
    }

    inside(x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H && this.zone[y][x] >= 0; }

    wallBetween(x, y, dir) {
        const [dx, dy] = CoopModel.DELTA[dir], nx = x + dx, ny = y + dy;
        if (!this.inside(x, y) || !this.inside(nx, ny)) return true;
        const a = this.zone[y][x], b = this.zone[ny][nx];
        if (a === b) return false;
        // the rects of one room (the same `room`, an L-shaped hall) have no wall between them
        const ra = this.L.zones[a] && this.L.zones[a].room, rb = this.L.zones[b] && this.L.zones[b].room;
        if (ra && ra === rb) return false;
        return !(this.L.zones[a].kind === 'outside' && this.L.zones[b].kind === 'outside');
    }

    isWet(x, y) { return this.wet.has(x + ',' + y); }
    isVan(x, y) { return this.van.has(x + ',' + y); }

    // Where a tap on the floor at (x, y) walks to: from the van's cab — the bay's cell next to it in its
    // row (rules, section 30: the player taps the van's picture as a whole); elsewhere — (x, y).
    bayOf(x, y) {
        let bx = x;
        while (this.cab.has(bx + ',' + y)) bx += this.vanBack;
        return [bx, y];
    }

    // A hero of a run or a frame (x, y, caught): in the van — safe, not caught; on the job — not
    // caught and out of the van, the one the patrol or the police take (rules, section 15).
    inVan(h) { return !h.caught && this.isVan(h.x, h.y); }
    onJob(h) { return !h.caught && !this.isVan(h.x, h.y); }

    // A door starts open without a lock and without `shut` (a doorway), shut otherwise; unlocked —
    // without a lock (rules, section 9: a shut door without a lock is opened at once).
    // The leaves of door i's door — the indices sharing its lock (rules, section 9).
    leavesOf(i) {
        const k = this.doors[i].lockOf;
        return this.doors.map((d, j) => j).filter(j => this.doors[j].lockOf === k);
    }

    startOpen(i) { return !this.doors[i].lock && !this.doors[i].shut; }
    openAtStart() { return this.doors.map((d, i) => this.startOpen(i)); }
    unlockedAtStart() { return this.doors.map(d => !d.lock); }

    // When the police are at the building (rules, section 14): after an alarm at alarmT (null —
    // none) the alarm's police (ГБР), if they come no later than the patrol; else the patrol.
    // -> { t — the tick, police — the alarm's police }.
    arrival(alarmT) {
        const at = alarmT === null || alarmT === undefined ? null : alarmT + this.policeTicks;
        const police = at !== null && at <= this.patrolTicks;
        return { t: police ? at : this.patrolTicks, police };
    }

    // The plan's ghost of the plans (rules, sections 8, 14): no collisions, no vision, nobody caught;
    // the guards answer the plans as in a run — the plan's screen and its buttons «Связать» and
    // «Вырубить» read them there (Ivan 06.11). full — on to MAX_TICKS after the plans are over: the
    // guards for the buttons at the end of the longest plan (judged a tick later) and for a wait
    // till a button comes (the guard has to come first).
    ghost(plans, full) {
        return this.simulate(plans, { ghost: true, full: !!full, maxTicks: CoopModel.MAX_TICKS });
    }

    // Where each guard (by his index in the level) stands after an alarm (Ivan 20.10, rules,
    // section 8): { cell, face, door } — the exit he holds. An exit is a doorway to the outside,
    // locked too (the guards have the keys); its cell is the one inside the building, of a doorway
    // two cells wide the one nearer the van; he faces into the building. The exits go by the length
    // of the guard's way from that cell to the nearest cell of the van, a tie by the order of the
    // doors: the first guard of the level takes the nearest, the second the next one; the guards
    // left over stand next to the nearest exit — beside it along the wall first, then in front.
    // No exit at all — null: he holds where he stands.
    exitPosts() {
        if (this._exitPosts) return this._exitPosts;
        const C = CoopModel, D = C.DELTA;
        const out = (/** @type {number} */ x, /** @type {number} */ y) => {
            const z = this.inside(x, y) ? this.zone[y][x] : -1;
            return z >= 0 && this.L.zones[z].kind === 'outside';
        };
        const toVan = (/** @type {number[]} */ c) => Math.min(...[...this.van].map(k => {
            const p = this.path(c, k.split(',').map(Number), { guard: true, open: null });
            return p ? p.length : Infinity;
        }));
        const exits = [];
        // an exit is a whole door, all its leaves (rules, section 9)
        this.doors.forEach((d, i) => {
            if (d.lockOf !== i) return;
            let best = null;
            for (const [x, y, dir] of this.leavesOf(i).flatMap(k => this.doors[k].cells)) {
                const [dx, dy] = D[dir], a = out(x, y), b = out(x + dx, y + dy);
                if (a === b) continue;
                const cell = a ? [x + dx, y + dy] : [x, y], face = a ? dir : C.BACK[dir], dist = toVan(cell);
                if (dist < Infinity && (!best || dist < best.dist)) best = { cell, face, door: i, dist };
            }
            if (best) exits.push(best);
        });
        exits.sort((p, q) => p.dist - q.dist || p.door - q.door);
        const taken = new Set(exits.slice(0, this.guards.length).map(e => e.cell.join(',')));
        this._exitPosts = this.guards.map((g, k) => {
            if (!exits.length) return null;
            if (k < exits.length) return { cell: exits[k].cell, face: exits[k].face, door: exits[k].door };
            const e = exits[0], side = C.DIRS.filter(d => d !== e.face && d !== C.BACK[e.face]);
            for (const d of side.concat([e.face])) {
                const [dx, dy] = D[d], c = [e.cell[0] + dx, e.cell[1] + dy];
                if (out(c[0], c[1]) || taken.has(c.join(',')) || !this.canStep(e.cell[0], e.cell[1], d, 'guard', null)) continue;
                taken.add(c.join(','));
                return { cell: c, face: e.face, door: e.door };
            }
            return { cell: e.cell, face: e.face, door: e.door };
        });
        return this._exitPosts;
    }

    // The most a hero of the team (his mass, as the lab's knobs leave it) may carry: his mass,
    // SKILL_X times with the skill load (rules, section 10); the mass hero i carries in frame f.
    capacity(h) { return h.mass * this.pace(h, 'load'); }
    loadIn(f, i) { return f.loot.reduce((s, l, j) => s + (l.holder === i ? this.massOf(j, l) : 0), 0); }
    // The mass of item j as it is now (s — its state in a run, a frame or frameState): a grabbed one
    // is lighter by the quarter it lost (rules, section 10, 09.11).
    massOf(j, s) { return this.loot[j].mass * (s && (s.spoiled || s.sp) ? CoopModel.OBJECTS.vitrine.grab_keep : 1); }

    // The hint of the valuable loot (Ivan 20.10: «витрины подсвеченные с дорогим лутом»): the cells
    // of the loot marked hint whose item lies at home in frame f — nobody carries it, it is not in
    // the van; broken and spoilt it still glows.
    hintCells(f) {
        return this.loot.map((l, i) => [l, f.loot[i]])
            .filter(([l, s]) => l.hint && s.holder < 0 && !s.del && s.x === l.at[0] && s.y === l.at[1])
            .map(([l]) => l.at.slice());
    }

    // Can a body step from (x, y) towards dir? who: 'hero' | 'guard' | 'sight'. doorsOpen —
    // the open flags of the doors in the current state (null — as the level starts: open without a lock).
    canStep(x, y, dir, who, doorsOpen) {
        const [dx, dy] = CoopModel.DELTA[dir], nx = x + dx, ny = y + dy;
        if (!this.inside(nx, ny)) return false;
        const e = this.edges.get(this.edgeKey(x, y, dir));
        if (e === 'wall') return false;
        // a shut door stops heroes and sight, not guards (they have the keys); without the flags a
        // door is as the level starts it — open without a lock
        if (typeof e === 'number' && who !== 'guard' && !(doorsOpen ? doorsOpen[e] : this.startOpen(e))) return false;
        if (who !== 'sight' && this.blocked.has(nx + ',' + ny)) return false;
        return true;
    }

    // Whether what ('light', 'lasers', 'sensors' or a camera id) works with the panels on/off
    // (power — a flag a panel, as a run's frame has it, or one flag for all of them): it goes off
    // with every panel whose list has it, so it works while all of those are on (rules, sections 8, 20).
    isArmed(what, power) {
        if (power === true) return true;
        if (!this.panels.length) return Array.isArray(power) || !!power;   // no panel: the power is never off but in a test
        return this.panels.every((p, i) => (Array.isArray(power) ? power[i] !== false : !!power) || !p.powers.has(what));
    }

    // The index of the panel with this id in panels and in a frame's power, -1 — none.
    panelIndex(id) { return this.panels.findIndex(p => p.id === id); }

    // Shortest path (list of cells, without the start) on the map only: walls and doors (the
    // wet floor is floor). open — the door flags; null treats locked doors as open. openAt(n) —
    // the door flags when the n-th step (0 — the first) is taken: the plan view routes through a
    // door only if the plans open it by the time the hero gets there (one cell a tick, no
    // waiting at a shut door); the search goes by the step number, so the first way found is the shortest one without waiting.
    path(from, to, opts) {
        const o = opts || {};
        const key = (x, y) => x + ',' + y;
        const prev = new Map([[key(from[0], from[1]), null]]);
        const depth = new Map([[key(from[0], from[1]), 0]]);
        const all = this.doors.map(() => true);
        const queue = [from];
        while (queue.length) {
            const p = queue.shift(), n = depth.get(key(p[0], p[1]));
            if (p[0] === to[0] && p[1] === to[1]) break;
            const open = o.openAt ? o.openAt(n) : o.open === null || o.open === undefined ? all : o.open;
            for (const d of CoopModel.DIRS) {
                const [dx, dy] = CoopModel.DELTA[d], q = [p[0] + dx, p[1] + dy], k = key(q[0], q[1]);
                if (prev.has(k)) continue;
                if (!this.canStep(p[0], p[1], d, o.guard ? 'guard' : 'hero', open)) continue;
                prev.set(k, p);
                depth.set(k, n + 1);
                queue.push(q);
            }
        }
        const k0 = key(to[0], to[1]);
        if (!prev.has(k0)) return null;
        const out = [];
        let c = to;
        while (prev.get(key(c[0], c[1]))) { out.push(c); c = prev.get(key(c[0], c[1])); }
        return out.reverse();
    }

    // Is (x, y) inside the vision cone from (ox, oy) looking at `angle` (deg) and not behind a
    // wall or a shut door? doorsOpen — the door flags of the moment.
    inCone(ox, oy, angle, fov, range, x, y, doorsOpen) {
        const dx = x - ox, dy = y - oy, dist = Math.hypot(dx, dy);
        if (dist === 0) return true;
        if (dist > range + 0.01) return false;
        const a = Math.atan2(dy, dx) * 180 / Math.PI;
        let diff = Math.abs(a - angle) % 360;
        if (diff > 180) diff = 360 - diff;
        if (diff > fov / 2 + 0.01) return false;
        return this.lineClear(ox, oy, x, y, doorsOpen);
    }

    lineClear(x0, y0, x1, y1, doorsOpen) {
        const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 4);
        let cx = x0, cy = y0;
        const step = (x, y, ddx, ddy) => this.canStep(x, y, ddx > 0 ? 'R' : ddx < 0 ? 'L' : ddy > 0 ? 'D' : 'U', 'sight', doorsOpen);
        for (let i = 1; i <= n; i++) {
            const px = Math.round(x0 + (x1 - x0) * i / n), py = Math.round(y0 + (y1 - y0) * i / n);
            if (px === cx && py === cy) continue;
            const sx = px - cx, sy = py - cy;
            if (sx !== 0 && sy !== 0) {
                const viaX = step(cx, cy, sx, 0) && step(cx + sx, cy, 0, sy);
                const viaY = step(cx, cy, 0, sy) && step(cx, cy + sy, sx, 0);
                if (!viaX && !viaY) return false;
            } else if (!step(cx, cy, sx, sy)) return false;
            cx = px; cy = py;
        }
        return true;
    }

    // Where camera c looks at tick t (deg).
    cameraAngle(c, t) {
        if (!c.sweep || !c.period) return c.base;
        return c.base + (c.sweep / 2) * Math.sin(2 * Math.PI * t / c.period);
    }

    // Cells seen at a recorded frame (CoopRun.frames[t]): { guards: [[x, y], …] per guard,
    // cameras: [[x, y], …] per camera (empty while it is off: CoopRun.camOn) } — for the view.
    seenAt(f) {
        const cells = (ox, oy, angle, fov, range) => {
            const out = [], r = Math.ceil(range);
            for (let y = oy - r; y <= oy + r; y++) {
                for (let x = ox - r; x <= ox + r; x++) {
                    if (this.inside(x, y) && (x !== ox || y !== oy) && this.inCone(ox, oy, angle, fov, range, x, y, f.doors)) out.push([x, y]);
                }
            }
            return out;
        };
        return {
            guards: f.g.map((g, i) => (g.out || g.fall) ? [] : cells(g.x, g.y, CoopModel.ANGLE[g.f], this.guards[i].fov, this.guards[i].range)),
            cameras: this.cameras.map((c, i) => (f.cams ? f.cams[i] : this.isArmed(c.id, f.power)) ? cells(c.at[0], c.at[1], this.cameraAngle(c, f.t), c.fov, c.range) : [])
        };
    }

    // What a hero may do from a cell: [{ verb, target, label }] (the plan buttons). Any hero
    // may do any job. run — the execution, to reach loot where it lies now (dropped, carried
    // away); without it the loot is where the level puts it.
    // A door: a locked one offers «Вскрыть», an unlocked shut one «Открыть» (Ivan 20.10: two
    // actions, the sensor rings on the opening), an open one «Закрыть» — as the run has it; a
    // gate does all that from its keypad, its «Вскрыть» is the hack (rules, section 9). An unlocked
    // door with a lock and all its leaves shut offers «Запереть» besides (Ivan 21.10).
    verbsAt(id, x, y, run) {
        const out = [];
        const shut = (/** @type {number} */ i) => (run && run.doorOpen ? !run.doorOpen[i] : !this.startOpen(i));
        // the lock is one for all the leaves of a door (lockOf, rules, section 9)
        const unlocked = (/** @type {number} */ i) => !this.doors[i].lock || !!(run && ((run.doorUnlocked && (run.doorUnlocked[i] || run.doorUnlocked[this.doors[i].lockOf])) || (run.doorOpen && run.doorOpen[i])));
        // a cell next to it with no wall or shut door between (Ivan 20.10: not through a wall)
        const near = (p) => {
            const d = Math.abs(p[0] - x) + Math.abs(p[1] - y);
            if (d !== 1) return d === 0;
            const dir = Object.keys(CoopModel.DELTA).find(k => CoopModel.DELTA[k][0] === p[0] - x && CoopModel.DELTA[k][1] === p[1] - y);
            return this.canStep(x, y, dir, 'sight', run && run.doorOpen ? run.doorOpen : null);
        };
        // a thing on a wall (the power panel, a keypad) is worked only from the cell in front of it:
        // a cell next to that one is diagonal to the thing (Ivan 19.10, rules, section 9)
        const here = (p) => p[0] === x && p[1] === y;
        this.doors.forEach((d, i) => {
            if (d.lock === 'electronic' ? !(d.panelAt && here(d.panelAt)) : !this.touchesDoor(d, x, y)) return;
            const verb = !shut(i) ? 'close' : unlocked(i) ? 'open' : d.lock === 'electronic' ? 'hack' : 'pick';
            out.push({ verb, target: verb === 'pick' ? this.doors[d.lockOf].id : d.id });
            if (verb === 'open' && d.lock && this.leavesOf(i).every(shut)) out.push({ verb: 'lock', target: this.doors[d.lockOf].id });
        });
        // a panel already off by this tick offers nothing (Ivan 25.10); the guard switched it on — again
        this.panels.forEach((p, i) => { if (here(p.at) && !(run && Array.isArray(run.power) && run.power[i] === false)) out.push({ verb: 'power', target: p.id }); });
        // a guard next to him in a straight line, no wall or shut door between (rules, section 21), lying
        // knocked out and not tied (Ivan 06.11: the plan's ghost knows it): where the ghost or the run has him
        if (run && run.guards) this.guards.forEach((g, i) => {
            const p = run.guards[i];
            if (p && p.out && !p.tied && Math.abs(p.x - x) + Math.abs(p.y - y) === 1 && near([p.x, p.y])) out.push({ verb: 'tie', target: g.id });
        });
        // «Вырубить» (rules, section 22): judged at the end of the blow's tick — where the plan's
        // screen puts the guard then (guardsEnd) and how he is turned; only if it does something, and
        // not on one lying knocked out or tied at the blow's start (Ivan 06.11)
        const ends = run && (run.guardsEnd || null), hero = this.heroes.find(q => q.id === id);
        if (ends && hero) this.guards.forEach((g, i) => {
            const p = ends[i];
            if (p && !p.out && this.knockResult(hero, x, y, p, run.doorOpen || null)) out.push({ verb: 'knock', target: g.id });
        });
        // what he carries now (the loot of the run or the frame he holds) against his limit
        const me = this.heroes.findIndex(q => q.id === id), cap = me >= 0 ? this.capacity(this.heroes[me]) : Infinity;
        const load = run && run.loot ? this.loadIn(run, me) : 0, fits = (/** @type {number} */ m) => load + m <= cap + 1e-9;
        const keep = CoopModel.OBJECTS.vitrine.grab_keep;
        this.loot.forEach((l, i) => {
            const s = run && run.loot && run.loot[i];
            if (s && (s.holder >= 0 || s.delivered)) return;
            const at = s ? [s.x, s.y] : l.at;
            // an item still in its vitrine or on its pedestal is reached from a cell next to it (they are
            // walls); a whole vitrine is smashed or unlocked first, a broken or unlocked one and a pedestal
            // are taken from (rules, sections 10 and 16)
            const home = at[0] === l.at[0] && at[1] === l.at[1], inCase = (l.glass || l.stand) && home;
            // a painting on its wall — like the panel, only from the cell in front of it (rules, section 10)
            const reach = l.wall && home ? here(at) : near(at) && !(inCase && here(at));
            if (!reach) return;
            if (inCase && l.glass && !(s && (s.broken || s.opened))) {
                out.push({ verb: 'smash', target: l.id }, { verb: 'unlock', target: l.id });
            } else if (inCase && l.glass && s && s.broken) {
                // a smashed vitrine (rules, section 10, 09.11): a multi item — grab it (a quarter lost,
                // its lighter mass checked) or gather it whole; a mono one — grab it whole
                if (fits(l.multi ? l.mass * keep : l.mass)) out.push({ verb: 'grab', target: l.id });
                if (l.multi && fits(l.mass)) out.push({ verb: 'gather', target: l.id });
            } else if (fits(this.massOf(i, s))) out.push({ verb: 'take', target: l.id });   // over the load limit — no take (rules, section 10)
        });
        out.push({ verb: 'drop', target: null });
        const h = this.heroes.find(q => q.id === id);
        return out.map(v => ({ ...v, label: this.label(v.verb, v.target), ticks: this.workTicks(h, v.verb, v.target) }));
    }

    // What an action brings besides its job (Ivan 20.10: the plan's button shows it): 'alarm' — it
    // opens a door (not a pick or a hack: they leave it shut) or a vitrine with a sensor while the light is on (power — the light then);
    // 'noise' — the glass breaks, guards near hear it; 'spoil' — a grabbed multi item loses a
    // quarter (rules, sections 10 and 12, 09.11).
    effectsOf(verb, target, power) {
        const out = [];
        const d = this.doors.find((/** @type {any} */ q) => q.id === target), l = this.loot.find((/** @type {any} */ q) => q.id === target);
        if (verb === 'open' && d && d.sensor && this.isArmed('sensors', power)) out.push('alarm');
        if ((verb === 'smash' || verb === 'unlock') && l && l.sensor && this.isArmed('sensors', power)) out.push('alarm');
        if (verb === 'smash') out.push('noise');
        if (verb === 'grab' && l && l.multi && CoopModel.OBJECTS.vitrine.grab_keep < 1) out.push('spoil');
        return out;
    }

    // The side a hero working from (x, y) faces (Ivan 19.10): the door's edge across from him (a
    // keypad — the gate's line), the vitrine or the item next to him (pos — where it lies now), a
    // thing on the wall of his own cell — that wall (the first of U, R, L, D, as CoopProps.wallSide
    // hangs it); null — he keeps his facing (an item in his own cell, a drop).
    faceTo(x, y, verb, target, pos) {
        const D = CoopModel.DELTA;
        const towards = (/** @type {number} */ px, /** @type {number} */ py) => {
            const dx = px - (x + 0.5), dy = py - (y + 0.5);
            if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return null;
            return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U');
        };
        const gate = this.doors.find(q => q.id === target && q.lock === 'electronic');
        if (!gate && (verb === 'pick' || verb === 'lock' || verb === 'open' || verb === 'close')) {
            const d = this.doors.find(q => q.id === target);
            const mids = d.cells.map(([cx, cy, dir]) => [cx + 0.5 + D[dir][0] / 2, cy + 0.5 + D[dir][1] / 2]);
            const far = (/** @type {number[]} */ m) => Math.abs(m[0] - x - 0.5) + Math.abs(m[1] - y - 0.5);
            const m = mids.reduce((a, b) => (far(b) < far(a) ? b : a));
            return towards(m[0], m[1]);
        }
        if (gate && (verb === 'hack' || verb === 'lock' || verb === 'open' || verb === 'close')) {
            const [cx, cy, dir] = gate.cells[0];
            return dir === 'U' || dir === 'D' ? (y + 0.5 < cy + 0.5 + D[dir][1] / 2 ? 'D' : 'U') : (x + 0.5 < cx + 0.5 + D[dir][0] / 2 ? 'R' : 'L');
        }
        if (verb === 'power') return ['U', 'R', 'L', 'D'].find(dir => !this.inside(x + D[dir][0], y + D[dir][1]) || this.edges.get(this.edgeKey(x, y, dir)) === 'wall') || null;
        if ((verb === 'tie' || verb === 'knock') && pos) return towards(pos[0] + 0.5, pos[1] + 0.5);   // the guard he ties or hits
        if (verb === 'take' || verb === 'grab' || verb === 'gather' || verb === 'smash' || verb === 'unlock') {
            const l = this.loot.find(q => q.id === target), at = pos || l.at;
            // a painting on its wall, taken from its own cell: she faces the wall (rules, section 10)
            if (l.wall && at[0] === l.at[0] && at[1] === l.at[1] && x === at[0] && y === at[1]) return { N: 'U', W: 'L', E: 'R' }[l.wall];
            return towards(at[0] + 0.5, at[1] + 0.5);
        }
        return null;
    }

    // Where the plan's sign of an action of a hero working from (x, y) stands (Ivan 07.11: «в тех
    // клетках, с которыми взаимодействуют»; later: «таймер над дверями можно и пониже», «для картин тоже
    // надо стеной вешать»): { x, y, side } — cell (x, y), on its side (U, R, D, L) or, side null, in
    // its middle. An item — where it lies in frame f (its vitrine, its pedestal, the floor), a painting
    // on its wall — that wall; a guard — where f has him; a door — its leaf next to him, a gate (worked
    // from its keypad) — its first leaf; a panel — the wall it hangs on (faceTo); a drop and anything
    // else — the middle of his own cell. A side is told from the cell with U or L of it: a door, a wall
    // is one place from both sides. f — a frame of a run (loot, g), the one the work starts from.
    actSpot(verb, target, x, y, f) {
        const D = CoopModel.DELTA;
        const edge = (/** @type {number} */ cx, /** @type {number} */ cy, /** @type {string} */ dir) => (dir === 'D' || dir === 'R'
            ? { x: cx + D[dir][0], y: cy + D[dir][1], side: dir === 'D' ? 'U' : 'L' } : { x: cx, y: cy, side: dir });
        const l = this.loot.findIndex(q => q.id === target);
        if (l >= 0) {
            const s = f && f.loot && f.loot[l], L = this.loot[l];
            const at = s && s.holder < 0 ? [s.x, s.y] : L.at;
            const home = at[0] === L.at[0] && at[1] === L.at[1];
            return L.wall && home ? edge(at[0], at[1], { N: 'U', W: 'L', E: 'R' }[L.wall]) : { x: at[0], y: at[1], side: null };
        }
        const g = this.guards.findIndex(q => q.id === target), p = g >= 0 && f && f.g && f.g[g];
        if (p) return { x: p.x, y: p.y, side: null };
        const d = this.doors.findIndex(q => q.id === target);
        if (d >= 0 && this.doors[d].lock === 'electronic') { const [cx, cy, dir] = this.doors[d].cells[0]; return edge(cx, cy, dir); }
        if (d >= 0) {
            for (const [cx, cy, dir] of this.doors[d].cells.concat(this.leavesOf(d).flatMap(k => this.doors[k].cells))) {
                if (cx === x && cy === y) return edge(cx, cy, dir);
                if (cx + D[dir][0] === x && cy + D[dir][1] === y) return edge(cx, cy, dir);
            }
        }
        if (verb === 'power') {
            const side = this.faceTo(x, y, verb, target);
            if (side) return edge(x, y, side);
        }
        return { x, y, side: null };
    }

    // A hero's force against a guard (Ivan 25.10, rules, section 22): his own mass — the load does
    // not count — times SKILL_X with the skill force.
    strength(h) { return h.mass * this.pace(h, 'force'); }

    // What a blow from (x, y) does to a guard g { x, y, f, down } (rules, section 22): 'ko', 'fell'
    // or null. Next to him in a straight line, no wall or shut door between; a felled one — knocked
    // out from any side; behind — by anybody; at his side — knocked out with force over twice his
    // mass, felled with force over his mass; in front — nothing.
    knockResult(h, x, y, g, doorOpen) {
        const C = CoopModel, dir = Object.keys(C.DELTA).find(k => C.DELTA[k][0] === x - g.x && C.DELTA[k][1] === y - g.y);
        if (!dir || !this.canStep(g.x, g.y, dir, 'sight', doorOpen)) return null;
        if (g.down) return 'ko';
        if (dir === g.f) return null;
        if (dir === C.BACK[g.f]) return 'ko';
        const s = this.strength(h);
        return s > C.KNOCK_SIDE * C.GUARD_MASS ? 'ko' : s > C.GUARD_MASS ? 'fell' : null;
    }

    // The name of an action on the buttons and in the plan.
    label(verb, target) {
        const d = this.doors.find(q => q.id === target), l = this.loot.find(q => q.id === target), p = this.panels.find(q => q.id === target);
        const g = this.guards.find(q => q.id === target);
        const name = (/** @type {any} */ o) => (o ? o.name : target);
        const args = { door: name(d), loot: name(l), panel: (p ? p.name : CoopText.t('model.panel_default')).toLowerCase(), guard: g || { name: target, acc: target } };
        // a mono item out of a smashed vitrine is taken whole: its grab reads «Взять» (rules, section 10)
        const key = verb === 'grab' && !(l && l.multi) ? 'take' : verb;
        const k = 'model.act_' + key;
        return k in CoopText.all() ? CoopText.t(k, args) : verb;
    }

    // The one table of the jobs (rules, sections 9 and 10): a verb on a target -> { ticks — its
    // units, the time for anybody; skill — the one that does SKILL_X units a tick (null — none);
    // lock — where its progress lives: 'door' / 'vitrine' on the lock (kept, halved, when the worker
    // falls), 'relock' — the locking of a door, on its lock too, null on the hero (lost) }. Locking
    // costs what picking or hacking that lock does (the original: lock door 24 / 12, Ivan 21.10). Every time is the objects config's (a lock by its kind);
    // the buttons' price, the work, its timer and its loss read it.
    job(verb, target) {
        const O = CoopModel.OBJECTS, none = { ticks: CoopModel.DROP_TICKS, skill: null };
        if (verb === 'pick' || verb === 'hack' || verb === 'lock') {
            const d = this.doors.find(q => q.id === target);
            const k = O.lock[d.lock];
            return { ticks: k.ticks, skill: k.skill, lock: verb === 'lock' ? 'relock' : 'door' };
        }
        if (verb === 'power') return { ticks: O.power_panel.off.ticks, skill: O.power_panel.off.skill, lock: null };
        // a hero ties a knocked-out guard, a guard unties him (rules, section 21): on the worker, lost on a fall
        if (verb === 'tie' || verb === 'untie' || verb === 'knock') return { ticks: O.guard[verb].ticks, skill: O.guard[verb].skill, lock: null };
        const a = { take: O.loot.take, smash: O.vitrine.smash, unlock: O.vitrine.unlock, grab: O.vitrine.grab, gather: O.vitrine.gather,
            open: O.door.open, close: O.door.close }[verb] || none;
        return { ticks: a.ticks, skill: a.skill, lock: verb === 'unlock' ? 'vitrine' : null };
    }

    // How much of a job a hero does in a tick: SKILL_X with its skill, else 1.
    pace(h, skill) { return h && skill && h.skills.includes(skill) ? CoopModel.SKILL_X : 1; }

    // The ticks a job takes this hero (rules, section 9), rounded up, at least 1 — the price on the buttons.
    workTicks(h, verb, target) {
        const j = this.job(verb, target);
        return Math.max(1, Math.ceil(j.ticks / this.pace(h, j.skill)));
    }

    touchesDoor(d, x, y) {
        return d.cells.some(([cx, cy, dir]) => {
            const [dx, dy] = CoopModel.DELTA[dir];
            return (cx === x && cy === y) || (cx + dx === x && cy + dy === y);
        });
    }

    // The whole execution. opts.ghost — the plan view: no collisions, vision or catching; the guards
    // answer the plans (rules, section 8).
    simulate(plans, opts) {
        return new CoopRun(this, plans, opts || {}).run();
    }
}
