// CoopCheck.js — the check of a co-op level's data (design/levels/*.json, the reference level,
// the lab stations, as COOP_LEVELS has them). A typo or a missing field must not load quietly and
// change the rules (a guard without a range would see across the map): every field is known, the
// required ones are there, the values have their types and kinds, the ids are unique and the
// references point at what exists. level(L) checks the fields, map(M) — what needs the grid
// (cells inside, patrols closed and walkable). The first problem throws, naming the level, the
// field and what is wrong. tools/make-coop-levels.mjs runs it on every level before writing
// CoopLevels.js; CoopLevelModel runs it at load.

/** @satisfies {Record<string, any>} */
const CoopCheck = {
    LOCKS: ['mechanical', 'vault', 'electronic'],
    SIDES: ['N', 'S', 'E', 'W'],
    FACING: ['N', 'S', 'E', 'W', 'U', 'D', 'L', 'R'],
    OPS: ['go', 'open', 'act', 'wait', 'until'],
    // the solutions a level may carry, each with its expect (tests/coop-solutions.mjs runs them all):
    // quiet, loud, loud for everything (Ivan 29.10: a loud ★★★ «имеет право существовать»)
    SOLUTIONS: ['solution', 'solution_loud', 'solution_loud_all'],
    VERBS: ['pick', 'hack', 'lock', 'open', 'close', 'power', 'smash', 'unlock', 'take', 'grab', 'gather', 'drop', 'knock', 'tie'],
    // what a power panel may switch off besides the cameras (by id)
    POWERS: ['light', 'lasers', 'sensors'],
    // the floor of a zone — its colour in the scene (CoopScene.COLORS.floor)
    FLOORS: ['room', 'hall', 'corridor', 'office', 'vault', 'utility', 'guards', 'loading', 'street', 'alley'],
    // the model of a loot item (objects.json, loot.models; its file — CoopProps.FILES)
    LOOT_MODELS: Object.keys(CoopModel.OBJECTS.loot.models),
    // where the van drives off and where the police car comes from: the street runs east-west
    STREET_ENDS: ['E', 'W'],

    // The field checks: each takes (value, where) and throws on a bad one. A spec is
    // { field: check } with '?' after the name for an optional field.
    /** @param {string} where @param {string} what @returns {never} */
    fail(where, what) { throw new Error(where + ': ' + what); },
    str(v, w) { if (typeof v !== 'string' || !v) CoopCheck.fail(w, JSON.stringify(v) + ' is not a non-empty string'); },
    text(v, w) { if (typeof v !== 'string') CoopCheck.fail(w, JSON.stringify(v) + ' is not a text'); },
    bool(v, w) { if (typeof v !== 'boolean') CoopCheck.fail(w, JSON.stringify(v) + ' is not true or false'); },
    ticks(v, w) { if (!Number.isInteger(v) || v < 0) CoopCheck.fail(w, JSON.stringify(v) + ' is not a whole number of ticks'); },
    count(v, w) { if (!Number.isInteger(v) || v < 1) CoopCheck.fail(w, JSON.stringify(v) + ' is not a whole number from 1'); },
    num(v, w) { if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) CoopCheck.fail(w, JSON.stringify(v) + ' is not a number from 0'); },
    pos(v, w) { if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) CoopCheck.fail(w, JSON.stringify(v) + ' is not a number above 0'); },
    angle(v, w) { if (typeof v !== 'number' || !(v > 0 && v <= 360)) CoopCheck.fail(w, JSON.stringify(v) + ' is not an angle in (0, 360]'); },
    cell(v, w) { if (!Array.isArray(v) || v.length !== 2 || !v.every(Number.isInteger)) CoopCheck.fail(w, JSON.stringify(v) + ' is not a cell [x, y]'); },
    rect(v, w) {
        if (!Array.isArray(v) || v.length !== 4 || !v.every(Number.isInteger) || v[0] > v[2] || v[1] > v[3]) CoopCheck.fail(w, JSON.stringify(v) + ' is not a rect [x0, y0, x1, y1]');
    },
    /** @param {any[]} values */
    oneOf(values) { return (/** @type {any} */ v, /** @type {string} */ w) => { if (!values.includes(v)) CoopCheck.fail(w, JSON.stringify(v) + ' is not one of ' + values.map(String).join(', ')); }; },
    /** @param {Function} each */
    list(each) {
        return (/** @type {any} */ v, /** @type {string} */ w) => {
            if (!Array.isArray(v)) CoopCheck.fail(w, 'not a list');
            v.forEach((x, i) => each(x, w + '[' + (x && typeof x === 'object' && typeof x.id === 'string' ? x.id : i) + ']'));
        };
    },
    /** @param {Record<string, Function>} spec */
    obj(spec) { return (/** @type {any} */ v, /** @type {string} */ w) => CoopCheck.fields(v, w, spec); },

    // An object against its spec: no unknown field, every required one present, each checked.
    fields(v, where, spec) {
        if (!v || typeof v !== 'object' || Array.isArray(v)) CoopCheck.fail(where, 'not an object');
        const names = Object.keys(spec).map(k => k.replace('?', ''));
        // a text field's translation (rules, section 36, «Язык»): <k>_<id> beside k, a non-empty text (none — no field)
        const tr = (/** @type {string} */ k) => { const f = CoopText.langField(k); return !!f && names.includes(f.base); };
        const extra = Object.keys(v).filter(k => !names.includes(k) && !tr(k));
        for (const k of Object.keys(v)) if (tr(k)) CoopCheck.str(v[k], where + '.' + k);
        if (extra.length) CoopCheck.fail(where, 'unknown field ' + extra.join(', ') + ' (known: ' + names.join(', ') + ')');
        for (const [key, check] of Object.entries(spec)) {
            const k = key.replace('?', ''), opt = key.endsWith('?');
            if (v[k] === undefined) { if (!opt) CoopCheck.fail(where, 'no field ' + k); continue; }
            check(v[k], where + '.' + k);
        }
    },

    // The fields of a level and its parts. Text fields (note, react, effect, the prose of rules)
    // are notes for people; the model never reads them.
    spec() {
        const C = CoopCheck;
        const step = (/** @type {any} */ s, /** @type {string} */ w) => {
            if (!Array.isArray(s) || !C.OPS.includes(s[0])) C.fail(w, JSON.stringify(s) + ' is not a step (' + C.OPS.join(', ') + ')');
            const [op, a, b] = s, n = s.length;
            if (op === 'go' && !(n === 3 && Number.isInteger(a) && Number.isInteger(b))) C.fail(w, JSON.stringify(s) + ': go takes x, y');
            if (op === 'open' && !(n === 2 && typeof a === 'string')) C.fail(w, JSON.stringify(s) + ': open takes a door or vitrine id');
            if (op === 'act' && !(n === 3 && C.VERBS.includes(a) && (typeof b === 'string' || (a === 'drop' && b === null)))) C.fail(w, JSON.stringify(s) + ': act takes a verb (' + C.VERBS.join(', ') + ') and its target');
            if ((op === 'wait' || op === 'until') && !(n === 2 && Number.isInteger(a) && a >= 0)) C.fail(w, JSON.stringify(s) + ': ' + op + ' takes a whole number of ticks');
        };
        const solution = (/** @type {any} */ v, /** @type {string} */ w) => {
            if (!v || typeof v !== 'object' || Array.isArray(v)) C.fail(w, 'not an object');
            for (const [k, s] of Object.entries(v)) {
                if (k === 'note') C.text(s, w + '.note');
                else if (k === 'expect') C.fields(s, w + '.expect', { stars: C.oneOf([0, 1, 2, 3]), money: C.num, alarm: C.bool, 'caught?': C.ticks });
                else if (CoopModel.TEAM.includes(k)) C.list(step)(s, w + '.' + k);
                else C.fail(w, 'unknown field ' + k + ' (a hero id, note or expect)');
            }
            if (!v.expect && Object.keys(v).some(k => k !== 'note')) C.fail(w, 'no field expect — what the solution must achieve: { stars, money, alarm }');
        };
        const tasks = (/** @type {any} */ v, /** @type {string} */ w) => {
            if (!v || typeof v !== 'object' || Array.isArray(v)) C.fail(w, 'not an object');
            for (const [k, list] of Object.entries(v)) {
                if (k === 'note') C.text(list, w + '.note');
                else if (['1', '2', '3'].includes(k)) C.list((/** @type {any} */ t, /** @type {string} */ tw) => { if (!t || typeof t !== 'object') C.fail(tw, 'not a task'); })(list, w + '.' + k);
                else C.fail(w, 'unknown field ' + k + ' (the stars 1, 2, 3 or note)');
            }
        };
        const heroesAt = (/** @type {any} */ v, /** @type {string} */ w) => {
            if (!v || typeof v !== 'object' || Array.isArray(v)) C.fail(w, 'not an object');
            for (const [k, c] of Object.entries(v)) {
                if (!CoopModel.TEAM.includes(k)) C.fail(w, 'unknown hero ' + k + ' (heroes.json: ' + CoopModel.TEAM.join(', ') + ')');
                C.cell(c, w + '.' + k);
            }
        };
        const object = (/** @type {any} */ o, /** @type {string} */ w) => {
            const kinds = {
                power_panel: { id: C.str, kind: C.str, at: C.cell, 'name?': C.str, powers: C.list(C.str), 'effect?': C.text },
                lasers: { id: C.str, kind: C.str, cells: C.list(C.cell), 'name?': C.str },
                van: { id: C.str, kind: C.str, rect: C.rect, 'name?': C.str, exit: C.oneOf(C.STREET_ENDS), police_from: C.oneOf(C.STREET_ENDS) },
                wet_floor: { id: C.str, kind: C.str, rect: C.rect, 'name?': C.str }
            };
            const spec = o && /** @type {Record<string, any>} */ (kinds)[o.kind];
            if (!spec) C.fail(w, 'kind ' + JSON.stringify(o && o.kind) + ' is not one of ' + Object.keys(kinds).join(', '));
            C.fields(o, w, spec);
        };
        // a step of the hard tutorial (rules, section 27; CoopTutorial.js): what to press, its task (the
        // plan's log and sheet, Ivan 08.11) and its text
        // a plate (rules, section 32) — its text only: no press, no task, not counted as a step
        const tutorialStep = (/** @type {any} */ v, /** @type {string} */ w) => {
            if (v && v.do === 'note') {
                C.fields(v, w, { do: C.oneOf(CoopTutorial.KINDS), text: C.text });
                if (!String(v.text).trim()) C.fail(w + '.text', 'an empty plate — a plate is its text');
                return;
            }
            C.fields(v, w, { do: C.oneOf(CoopTutorial.KINDS), 'obj?': C.str, 'at?': C.cell, 'verb?': C.str, task: C.text, 'text?': C.text });
            if (!String(v.task).trim()) C.fail(w + '.task', 'an empty task — the log and the sheet name the step by it');
            // a tap may have a cell: the tap only walks there (CoopTutorial.walkCell)
            const need = /** @type {Record<string, string[]>} */ ({ tap: ['obj'], cell: ['at'], act: ['verb', 'obj'], ask: [], undo: [], start: [] })[v.do];
            const may = v.do === 'tap' ? ['at'] : [];
            const extra = ['obj', 'at', 'verb'].filter(k => v[k] !== undefined && !need.includes(k) && !may.includes(k)), miss = need.filter(k => v[k] === undefined);
            if (extra.length) C.fail(w, 'unknown field ' + extra.join(', ') + ' (a step «' + v.do + '» takes: ' + (need.concat(may.map(k => k + '?')).join(', ') || 'nothing') + ', task, text)');
            if (miss.length) C.fail(w, 'no field ' + miss.join(', '));
            if (v.verb !== undefined) C.oneOf(C.VERBS)(v.verb, w + '.verb');
            C.text(v.text === undefined ? '' : v.text, w + '.text');
        };
        return {
            id: C.str, title: C.str, 'note?': C.text, 'order?': C.count, 'night?': C.bool,
            'lab?': C.obj({ order: C.count, name: C.str, what: C.list(C.text), 'params?': C.list(C.str), 'ticks?': C.count }),
            'team?': C.list(C.oneOf(CoopModel.TEAM)), 'heroes_at?': heroesAt,
            grid: C.obj({ w: C.count, h: C.count }),
            zones: C.list(C.obj({ id: C.str, name: C.str, rect: C.rect, 'kind?': C.oneOf(['outside']), 'room?': C.str, floor: C.oneOf(C.FLOORS) })),
            doors: C.list(C.obj({ id: C.str, 'name?': C.str, at: C.cell, side: C.oneOf(C.SIDES), 'width?': C.count,
                'lock?': C.oneOf([null].concat(C.LOCKS)), 'sensor?': C.bool, 'shut?': C.bool, 'panel_at?': C.cell })),
            objects: C.list(object),
            cameras: C.list(C.obj({ id: C.str, kind: C.oneOf(['local', 'online']), 'watcher?': C.str, at: C.cell,
                dir: C.oneOf(Object.keys(CoopModel.ANGLE)), 'sweep_deg?': C.num, range: C.pos, fov_deg: C.angle })),
            guards: C.list(C.obj({ id: C.str, name: C.str, 'name_acc?': C.str, 'patrol?': C.list(C.cell), 'post?': C.cell,
                'facing?': C.oneOf(C.FACING), cone: C.obj({ range: C.pos, fov_deg: C.angle }), 'stop_every?': C.count, 'react?': C.text })),
            loot: C.list(C.obj({ id: C.str, name: C.str, at: C.cell, value: C.num, mass: C.num, model: C.oneOf(C.LOOT_MODELS), 'glass?': C.bool, 'stand?': C.bool, 'wall?': C.oneOf(['N', 'W', 'E']), 'sensor?': C.bool, 'hint?': C.bool, 'multi?': C.bool })),
            rules: C.obj({ glass_noise_cells: C.num, alarm_police_ticks: C.ticks, patrol_ticks: C.count,
                'work?': C.text, 'loot?': C.text, 'stun?': C.text, 'collision?': C.text }),
            goal: C.obj({ stars: C.list(C.num) }),
            'tasks?': tasks, ...Object.fromEntries(C.SOLUTIONS.map(k => [k + '?', solution])),
            'tutorial?': C.list(tutorialStep),
            // the texts of the tutorial's window tips (rules, section 33): the plan sheet's, the hero card's ({name}, {skill})
            'tutorial_tips?': C.obj({ 'map?': C.text, 'hero?': C.text })
        };
    },

    // The times of objects live in the objects config, one for every level (Ivan 20.10, rules,
    // section 9): a time field in a level throws before the field check calls it a typo.
    TIMES: { doors: ['lock_ticks'], objects: ['work_ticks', 'on_ticks'], guards: ['spot_ticks', 'knockout_ticks'], cameras: ['period_ticks'] },
    noTimes(L, id) {
        for (const [k, keys] of Object.entries(CoopCheck.TIMES)) {
            for (const o of (L && Array.isArray(L[k]) ? L[k] : [])) {
                const f = keys.find(q => o && typeof o === 'object' && q in o);
                if (f) CoopCheck.fail(id + '.' + k + '[' + o.id + '].' + f, 'the time of an object lives in design/objects/objects.json, one for every level (rules, section 9)');
            }
        }
    },

    // The fields of level L, then what ties them together: unique ids, references, one van.
    level(L) {
        const C = CoopCheck, id = L && typeof L.id === 'string' ? L.id : 'a level';
        C.noTimes(L, id);
        C.fields(L, id, C.spec());
        for (const z of L.zones) if (z.rect[2] >= L.grid.w || z.rect[3] >= L.grid.h) C.fail(id + '.zones[' + z.id + '].rect', JSON.stringify(z.rect) + ' is off the grid ' + L.grid.w + ' x ' + L.grid.h);
        const ids = new Map();
        for (const k of ['zones', 'doors', 'objects', 'cameras', 'guards', 'loot']) {
            for (const o of L[k]) {
                if (ids.has(o.id)) C.fail(id + '.' + k + '[' + o.id + ']', 'the id is taken by ' + ids.get(o.id));
                ids.set(o.id, k);
            }
        }
        for (const d of L.doors) {
            const w = id + '.doors[' + d.id + ']';
            if (!d.lock && d.sensor) C.fail(w, 'a sensor on a door without a lock: nothing ever opens it');
            // a locked door is shut anyway (rules, section 9)
            if (d.lock && d.shut) C.fail(w, 'shut with a lock: a locked door is always shut — shut is for a door without one');
            if ((d.lock === 'electronic') !== (d.panel_at !== undefined)) C.fail(w, 'panel_at is the keypad of an electronic lock — needed with it, nowhere else');
        }
        const kinds = (/** @type {string} */ k) => L.objects.filter((/** @type {any} */ o) => o.kind === k);
        if (kinds('van').length !== 1) C.fail(id + '.objects', 'a level has one van, here ' + kinds('van').length);
        // the van: bay + cab cells along the street by bay across (Ivan 13.11, rules, section 30; objects.json van)
        for (const v of kinds('van')) {
            const V = CoopModel.OBJECTS.van, [x0, y0, x1, y1] = v.rect;
            if (x1 - x0 + 1 !== V.bay + V.cab || y1 - y0 + 1 !== V.bay)
                C.fail(id + '.objects[' + v.id + '] (van).rect', JSON.stringify(v.rect) + ' is not ' + (V.bay + V.cab) + ' × ' + V.bay + ' cells (the bay ' + V.bay + ' × ' + V.bay + ' and the cab ' + V.cab + ' × ' + V.bay + ' at the exit\'s end)');
        }
        for (const p of kinds('power_panel')) {
            for (const w of p.powers) {
                if (!C.POWERS.includes(w) && !L.cameras.some((/** @type {any} */ c) => c.id === w)) C.fail(id + '.objects[' + p.id + '].powers', w + ' is not ' + C.POWERS.join(', ') + ' or a camera id');
            }
        }
        for (const o of kinds('lasers')) {
            // one beam an object: its cells in a row or a column, one after another
            const k = o.cells.every((/** @type {number[]} */ c) => c[1] === o.cells[0][1]) ? 0 : o.cells.every((/** @type {number[]} */ c) => c[0] === o.cells[0][0]) ? 1 : -1;
            const run = k < 0 ? [] : o.cells.map((/** @type {number[]} */ c) => c[k]).sort((/** @type {number} */ a, /** @type {number} */ b) => a - b);
            if (!o.cells.length || k < 0 || run.some((/** @type {number} */ v, /** @type {number} */ i) => i && v !== run[i - 1] + 1))
                C.fail(id + '.objects[' + o.id + '].cells', 'one beam: cells in a row or a column, one after another (another beam — another lasers object)');
        }
        for (const c of L.cameras) {
            const w = id + '.cameras[' + c.id + ']';
            if (c.kind === 'local') {
                const g = L.guards.find((/** @type {any} */ q) => q.id === c.watcher);
                if (!g || !g.post) C.fail(w + '.watcher', JSON.stringify(c.watcher) + ' is not a posted guard of the level (a local camera is on his monitors)');
            } else if (c.watcher !== undefined) C.fail(w + '.watcher', 'an online camera has no watcher');
        }
        for (const g of L.guards) {
            const w = id + '.guards[' + g.id + ']';
            if (!g.patrol === !g.post) C.fail(w, 'a guard has a patrol or a post, one of them');
            if (g.patrol && g.patrol.length < 2) C.fail(w + '.patrol', 'a round needs two points at least');
        }
        if (L.team && (!L.team.length || new Set(L.team).size !== L.team.length)) C.fail(id + '.team', 'empty or a hero twice');
        const team = L.team || CoopModel.TEAM;
        for (const k of Object.keys(L.heroes_at || {})) if (!team.includes(k)) C.fail(id + '.heroes_at.' + k, 'not in the team of the level');
        for (const key of C.SOLUTIONS) {
            for (const k of Object.keys(L[key] || {})) if (k !== 'note' && k !== 'expect' && !team.includes(k)) C.fail(id + '.' + key + '.' + k, 'not in the team of the level');
        }
        if (Array.isArray(L.goal.stars) && L.goal.stars.some((/** @type {number} */ s, /** @type {number} */ i) => i && s <= L.goal.stars[i - 1])) C.fail(id + '.goal.stars', 'the stars must grow');
        if (L.tutorial) {
            // the codes of what a step clicks: a door, an item, a power panel; «start» — the last step
            const codes = new Set(L.doors.concat(L.loot, L.objects.filter((/** @type {any} */ o) => o.kind === 'power_panel')).map((/** @type {any} */ o) => o.id));
            L.tutorial.forEach((/** @type {any} */ s, /** @type {number} */ i) => {
                const w = id + '.tutorial[' + i + ']';
                if (s.obj !== undefined && !codes.has(s.obj)) C.fail(w + '.obj', JSON.stringify(s.obj) + ' is not a door, an item or a power panel of the level');
                if (s.do === 'start' && i !== L.tutorial.length - 1) C.fail(w, '«start» is the last step only');
            });
            const last = L.tutorial[L.tutorial.length - 1];
            if (!last || last.do !== 'start') C.fail(id + '.tutorial', 'the last step is «start» — the tutorial ends with the heist');
        }
        if (L.rules.patrol_ticks > CoopModel.MAX_TICKS) C.fail(id + '.rules.patrol_ticks', L.rules.patrol_ticks + ' is past the end of a run, ' + CoopModel.MAX_TICKS + ' ticks');
    },

    // What needs the grid of level model M: every cell, rect, door and patrol inside the zones,
    // zones apart, one object a cell, patrols closed and walkable for a guard.
    map(M) {
        const C = CoopCheck, L = M.L, id = L.id;
        const inside = (/** @type {number[]} */ c, /** @type {string} */ w) => { if (!M.inside(c[0], c[1])) C.fail(w, JSON.stringify(c) + ' is outside the zones of the level'); };
        const owner = new Map();
        L.zones.forEach((/** @type {any} */ z) => M.eachCell(z.rect, (/** @type {number} */ x, /** @type {number} */ y) => {
            const k = x + ',' + y;
            if (owner.has(k)) C.fail(id + '.zones[' + z.id + ']', 'overlaps ' + owner.get(k) + ' at [' + k + ']');
            owner.set(k, z.id);
        }));
        for (const d of M.doors) {
            for (const [x, y, dir] of d.cells) {
                const [dx, dy] = CoopModel.DELTA[dir];
                inside([x, y], id + '.doors[' + d.id + '].at');
                inside([x + dx, y + dy], id + '.doors[' + d.id + '] (the far side)');
            }
            if (d.panelAt) inside(d.panelAt, id + '.doors[' + d.id + '].panel_at');
        }
        for (const o of L.objects) {
            const w = id + '.objects[' + o.id + ']';
            if (o.at) inside(o.at, w + '.at');
            if (o.rect) M.eachCell(o.rect, (/** @type {number} */ x, /** @type {number} */ y) => inside([x, y], w + '.rect'));
            if (o.cells) o.cells.forEach((/** @type {number[]} */ c) => inside(c, w + '.cells'));
        }
        for (const c of L.cameras) inside(c.at, id + '.cameras[' + c.id + '].at');
        const taken = new Map();
        for (const l of L.loot) {
            inside(l.at, id + '.loot[' + l.id + '].at');
            const k = l.at[0] + ',' + l.at[1];
            if (taken.has(k)) C.fail(id + '.loot[' + l.id + '].at', 'the cell of ' + taken.get(k) + ' (one cell — one object)');
            taken.set(k, l.id);
            // the loot is the thing in the vitrine (rules, section 27; Ivan 09.11: «Донесла витрина это нормально? Нет!»)
            if (l.name === 'Витрина') C.fail(id + '.loot[' + l.id + '].name', '"Витрина" is the vitrine, not the loot in it');
            // a painting on a wall (rules, section 10): a real wall of its cell — not a doorway, not the
            // seam of one room; never with glass or on a pedestal
            if (l.wall) {
                const w = id + '.loot[' + l.id + '].wall', dir = { N: 'U', W: 'L', E: 'R' }[l.wall];
                if (l.glass || l.stand) C.fail(w, 'a thing on a wall has no glass and no pedestal');
                if (!M.wallBetween(l.at[0], l.at[1], dir) || typeof M.edges.get(M.edgeKey(l.at[0], l.at[1], dir)) === 'number') C.fail(w, l.wall + ' of [' + l.at + '] is not a wall');
            }
        }
        for (const h of M.heroes) inside(h.start, id + ': the start of ' + h.id);
        (L.tutorial || []).forEach((/** @type {any} */ s, /** @type {number} */ i) => { if (s.at) inside(s.at, id + '.tutorial[' + i + '].at'); });
        L.guards.forEach((/** @type {any} */ g, /** @type {number} */ gi) => {
            const w = id + '.guards[' + g.id + ']';
            if (g.post) {
                inside(g.post, w + '.post');
                if (M.blocked.has(g.post[0] + ',' + g.post[1])) C.fail(w + '.post', 'a vitrine stands there');
                return;
            }
            const p = g.patrol, first = p[0], last = p[p.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) C.fail(w + '.patrol', 'the round ends at ' + JSON.stringify(last) + ', not where it starts ' + JSON.stringify(first) + ': he would stop there');
            const cells = M.guards[gi].patrol;
            cells.forEach((/** @type {number[]} */ c, /** @type {number} */ i) => {
                const n = cells[(i + 1) % cells.length];
                inside(c, w + '.patrol');
                const dir = Object.keys(CoopModel.DELTA).find(d => c[0] + CoopModel.DELTA[d][0] === n[0] && c[1] + CoopModel.DELTA[d][1] === n[1]);
                if (!dir || !M.canStep(c[0], c[1], dir, 'guard', null)) C.fail(w + '.patrol', 'no step ' + JSON.stringify(c) + ' -> ' + JSON.stringify(n) + ' (a wall, a vitrine or off the zones)');
            });
        });
    }
};
