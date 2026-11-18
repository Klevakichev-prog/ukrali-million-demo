// CoopPlanMap.js — the heist plan sheet: a still top-down scheme of a co-op level with what the
// crew knows about it — rooms and walls, doors (locks, sensors), the power panel, cameras and
// their sweep, lasers, wet floor, guards (post or round), loot with its price (only the valuable with the hint), the van. Built
// from the level model (CoopLevelModel) as an SVG string; the HUD shows it in the image element
// mapImg (UI.get('mapImg').setImage(CoopPlanMap.dataUrl(M))). No 3D, no DOM: tests read the SVG.

/** @satisfies {Record<string, any>} */
const CoopPlanMap = {
    CELL: COOP_PLAN_CELL,
    SCALE_CELLS: COOP_PLAN_SCALE_CELLS,
    PAD: COOP_PLAN_PAD,
    LEGEND_W: COOP_PLAN_LEGEND_W,
    NOTE_PAD: COOP_PLAN_NOTE_PAD,
    NOTE_FONT: COOP_PLAN_NOTE_FONT,
    STEP_FONT: COOP_PLAN_STEP_FONT,
    LEGEND_FONT: COOP_PLAN_LEGEND_FONT,
    STEPS_X: COOP_PLAN_STEPS_X,
    STEPS_GAP: COOP_PLAN_STEPS_GAP,
    STEPS_BOTTOM: COOP_PLAN_STEPS_BOTTOM,
    // The sheet's width to height: the window's image (UI_LAYOUT mapImg, 1036 × 616 in mapBox) shows
    // it whole («contain»), so a sheet of these proportions fills it and its blocks stand in the window's
    // corners (Ivan 10.11: «элементы в окне плана растянуть по углам и сделать больше»).
    SHEET_ASPECT: COOP_PLAN_SHEET_ASPECT,
    SHEET_EDGE: COOP_PLAN_SHEET_EDGE,
    ROUTE_DOT: COOP_PLAN_ROUTE_DOT,
    ROUTE_MIN_LEG: COOP_PLAN_ROUTE_MIN_LEG,
    NOTE_RIGHT: COOP_PLAN_NOTE_RIGHT,
    // the sheet's other font sizes, px (Constants.js)
    PRICE_FONT: COOP_PLAN_PRICE_FONT,
    GUARD_FONT: COOP_PLAN_GUARD_FONT,
    ROOM_FONT: COOP_PLAN_ROOM_FONT,
    HEAD_FONT: COOP_PLAN_HEAD_FONT,
    ROUTE_FONT: COOP_PLAN_ROUTE_FONT,
    STICKER_FONT: COOP_PLAN_STICKER_FONT,
    BIG_FONT: COOP_PLAN_BIG_FONT,
    STAR_FONT: COOP_PLAN_STAR_FONT,
    STAMP_FONT: COOP_PLAN_STAMP_FONT,
    STAMP_KEY_FONT: COOP_PLAN_STAMP_KEY_FONT,
    ADV_MISSING: COOP_PLAN_ADV_MISSING,
    ADV_EMOJI: COOP_PLAN_ADV_EMOJI,
    HALO_W: COOP_PLAN_HALO_W,
    RING_M_FROM: COOP_PLAN_RING_M_FROM,
    SHEET_MIN_H: COOP_PLAN_SHEET_MIN_H,
    STEPS_ROOM: COOP_PLAN_STEPS_ROOM,
    STEPS_HEAD_Y: COOP_PLAN_STEPS_HEAD_Y,
    STEPS_HEAD_GAP: COOP_PLAN_STEPS_HEAD_GAP,
    STEP_GAP: COOP_PLAN_STEP_GAP,
    STEPS_KEEP: COOP_PLAN_STEPS_KEEP,
    WALL_T: COOP_PLAN_WALL_T,
    WALL_INK: COOP_PLAN_WALL_INK,
    THIN_OP: COOP_PLAN_THIN_OP,
    LASER_OP: COOP_PLAN_LASER_OP,
    EMITTER_OUT: COOP_PLAN_EMITTER_OUT,
    LOCK_OUT: COOP_PLAN_LOCK_OUT,
    DOOR_SIGN: COOP_PLAN_DOOR_SIGN,
    DOOR_RING: COOP_PLAN_DOOR_RING,
    KEYPAD_SIGN: COOP_PLAN_KEYPAD_SIGN,
    KEYPAD_RING: COOP_PLAN_KEYPAD_RING,
    CAM_SWEEP_STEP: COOP_PLAN_CAM_SWEEP_STEP,
    SIGHT_OP: COOP_PLAN_SIGHT_OP,
    CAMERA_SIGN: COOP_PLAN_CAMERA_SIGN,
    PANEL_SIGN: COOP_PLAN_PANEL_SIGN,
    PANEL_RING_OUT: COOP_PLAN_PANEL_RING_OUT,
    VAN_IN: COOP_PLAN_VAN_IN,
    VAN_RIM_IN: COOP_PLAN_VAN_RIM_IN,
    VAN_RIM_R: COOP_PLAN_VAN_RIM_R,
    VAN_RIM_W: COOP_PLAN_VAN_RIM_W,
    VAN_DASH: COOP_PLAN_VAN_DASH,
    VAN_GAP: COOP_PLAN_VAN_GAP,
    ROUTE_DOT_KEEP: COOP_PLAN_ROUTE_DOT_KEEP,
    ROUTE_ARROW: COOP_PLAN_ROUTE_ARROW,
    PILL_H: COOP_PLAN_PILL_H,
    PILL_PAD: COOP_PLAN_PILL_PAD,
    PILL_GAP: COOP_PLAN_PILL_GAP,
    PILL_DOOR_R: COOP_PLAN_PILL_DOOR_R,
    PILL_CELL_R: COOP_PLAN_PILL_CELL_R,
    PILL_TEXT_DOWN: COOP_PLAN_PILL_TEXT_DOWN,
    GEM_SIGN: COOP_PLAN_GEM_SIGN,
    GEM_UP: COOP_PLAN_GEM_UP,
    PRICE_W: COOP_PLAN_PRICE_W,
    PRICE_DOWN: COOP_PLAN_PRICE_DOWN,
    PRICE_BOTTOM: COOP_PLAN_PRICE_BOTTOM,
    LOOT_RING: COOP_PLAN_LOOT_RING,
    PATROL_W: COOP_PLAN_PATROL_W,
    PATROL_DASH: COOP_PLAN_PATROL_DASH,
    PATROL_GAP: COOP_PLAN_PATROL_GAP,
    PATROL_OP: COOP_PLAN_PATROL_OP,
    PATROL_ARROW_FROM: COOP_PLAN_PATROL_ARROW_FROM,
    PATROL_ARROW_EVERY: COOP_PLAN_PATROL_ARROW_EVERY,
    PATROL_ARROW: COOP_PLAN_PATROL_ARROW,
    POST_LINE: COOP_PLAN_POST_LINE,
    POST_LINE_W: COOP_PLAN_POST_LINE_W,
    POST_ARROW: COOP_PLAN_POST_ARROW,
    GUARD_SIGN: COOP_PLAN_GUARD_SIGN,
    GUARD_NAME_UP: COOP_PLAN_GUARD_NAME_UP,
    ROOM_SPACING: COOP_PLAN_ROOM_SPACING,
    ROOM_NAME_OP: COOP_PLAN_ROOM_NAME_OP,
    ROOM_NAME_PAD: COOP_PLAN_ROOM_NAME_PAD,
    ROOM_NAME_X: COOP_PLAN_ROOM_NAME_X,
    ROOM_NAME_Y: COOP_PLAN_ROOM_NAME_Y,
    ROOM_BOX_IN: COOP_PLAN_ROOM_BOX_IN,
    ROOM_BOX_R: COOP_PLAN_ROOM_BOX_R,
    ROOM_BOX_B: COOP_PLAN_ROOM_BOX_B,
    BOX_PAD: COOP_PLAN_BOX_PAD,
    BOX_TOP: COOP_PLAN_BOX_TOP,
    NOTE_EDGE: COOP_PLAN_NOTE_EDGE,
    STICKER_MARGIN: COOP_PLAN_STICKER_MARGIN,
    STICKER_IN: COOP_PLAN_STICKER_IN,
    LEGEND_TOP: COOP_PLAN_LEGEND_TOP,
    LEGEND_HEAD_Y: COOP_PLAN_LEGEND_HEAD_Y,
    LEGEND_HEAD_GAP: COOP_PLAN_LEGEND_HEAD_GAP,
    LEG_ICON_X: COOP_PLAN_LEG_ICON_X,
    LEG_GEM: COOP_PLAN_LEG_GEM,
    LEG_ICON: COOP_PLAN_LEG_ICON,
    LEG_RING: COOP_PLAN_LEG_RING,
    LEG_TEXT_X: COOP_PLAN_LEG_TEXT_X,
    LEG_ROW: COOP_PLAN_LEG_ROW,
    LEG_AFTER: COOP_PLAN_LEG_AFTER,
    LEG_PRICES_GAP: COOP_PLAN_LEG_PRICES_GAP,
    LEG_STARS_GAP: COOP_PLAN_LEG_STARS_GAP,
    LEG_STAR_ROW: COOP_PLAN_LEG_STAR_ROW,
    STAR_STROKE: COOP_PLAN_STAR_STROKE,
    LEG_STAR_TEXT_X: COOP_PLAN_LEG_STAR_TEXT_X,
    LEG_DANGERS_GAP: COOP_PLAN_LEG_DANGERS_GAP,
    LEG_DANGERS_HEAD: COOP_PLAN_LEG_DANGERS_HEAD,
    LEG_DANGER_DOWN: COOP_PLAN_LEG_DANGER_DOWN,
    LEG_DANGER_ICON: COOP_PLAN_LEG_DANGER_ICON,
    LEG_DANGER_LINE: COOP_PLAN_LEG_DANGER_LINE,
    LEG_DANGER_ROW: COOP_PLAN_LEG_DANGER_ROW,
    STICKER_W_CUT: COOP_PLAN_STICKER_W_CUT,
    STICKER_PAD: COOP_PLAN_STICKER_PAD,
    STICKER_BOTTOM: COOP_PLAN_STICKER_BOTTOM,
    SHADOW_X: COOP_PLAN_SHADOW_X,
    SHADOW_Y: COOP_PLAN_SHADOW_Y,
    SHADOW_OP: COOP_PLAN_SHADOW_OP,
    STICKER_TAPE_X: COOP_PLAN_STICKER_TAPE_X,
    STICKER_TAPE_Y: COOP_PLAN_STICKER_TAPE_Y,
    STICKER_TAPE: COOP_PLAN_STICKER_TAPE,
    STICKER_TAPE_ROT: COOP_PLAN_STICKER_TAPE_ROT,
    STAMP_COL: COOP_PLAN_STAMP_COL,
    STAMP_KEY_W: COOP_PLAN_STAMP_KEY_W,
    STAMP_TEXT_X: COOP_PLAN_STAMP_TEXT_X,
    STAMP_SCALE_GAP: COOP_PLAN_STAMP_SCALE_GAP,
    STAMP_PAD: COOP_PLAN_STAMP_PAD,
    STAMP_ROW: COOP_PLAN_STAMP_ROW,
    STAMP_GAP: COOP_PLAN_STAMP_GAP,
    STAMP_BOTTOM: COOP_PLAN_STAMP_BOTTOM,
    STAMP_LINE: COOP_PLAN_STAMP_LINE,
    SCALE_UP: COOP_PLAN_SCALE_UP,
    TAPE_X: COOP_PLAN_TAPE_X,
    TAPE_Y: COOP_PLAN_TAPE_Y,
    TAPE_SIZE: COOP_PLAN_TAPE_SIZE,
    TAPE_ROT: COOP_PLAN_TAPE_ROT,
    FRAME_OUT: COOP_PLAN_FRAME_OUT,
    FRAME_IN: COOP_PLAN_FRAME_IN,
    FRAME_OUT_W: COOP_PLAN_FRAME_OUT_W,
    FRAME_IN_W: COOP_PLAN_FRAME_IN_W,
    NOTE_W_PAD: COOP_PLAN_NOTE_W_PAD,
    NOTE_H_PAD: COOP_PLAN_NOTE_H_PAD,
    NOTE_TEXT_X: COOP_PLAN_NOTE_TEXT_X,
    NOTE_TEXT_Y: COOP_PLAN_NOTE_TEXT_Y,
    NOTE_BASELINE: COOP_PLAN_NOTE_BASELINE,
    NOTE_DIRS: COOP_PLAN_NOTE_DIRS,
    NOTE_RINGS: COOP_PLAN_NOTE_RINGS,
    NOTE_MARGIN: COOP_PLAN_NOTE_MARGIN,
    NOTE_MARGIN_SPOTS: COOP_PLAN_NOTE_MARGIN_SPOTS,
    NOTE_MARGIN_DY: COOP_PLAN_NOTE_MARGIN_DY,
    NOTE_MARGIN_DX: COOP_PLAN_NOTE_MARGIN_DX,
    NOTE_GAP: COOP_PLAN_NOTE_GAP,
    NOTE_COST_NOTE: COOP_PLAN_NOTE_COST_NOTE,
    NOTE_COST_CELL: COOP_PLAN_NOTE_COST_CELL,
    NOTE_COST_LEVEL: COOP_PLAN_NOTE_COST_LEVEL,
    NOTE_COST_LEADER: COOP_PLAN_NOTE_COST_LEADER,
    NOTE_COST_CROSS: COOP_PLAN_NOTE_COST_CROSS,
    LEADER_STEPS: COOP_PLAN_LEADER_STEPS,
    LEADER_MIN: COOP_PLAN_LEADER_MIN,
    LEADER_TIP: COOP_PLAN_LEADER_TIP,
    LEADER_BEND: COOP_PLAN_LEADER_BEND,
    LEADER_W: COOP_PLAN_LEADER_W,
    LEADER_ARROW: COOP_PLAN_LEADER_ARROW,
    HEAD_SPACING: COOP_PLAN_HEAD_SPACING,
    // The palette of the 2D artist brief (the game's palette, Ivan 23.10): the blueprint's ink on
    // pale paper, the legend's sticker; the marker by meaning — loot yellow, threats red (cameras
    // and guards alike, Ivan 25.10: «Суть одна и та же»), the van teal, water blue.
    INK: cssColor(COOP_PLAN_INK),
    PAPER: cssColor(COOP_PLAN_PAPER),
    STICKER: cssColor(COOP_PLAN_STICKER),
    MARK: { loot: cssColor(COOP_PLAN_MARK_LOOT), threat: cssColor(COOP_PLAN_MARK_THREAT), exit: cssColor(COOP_PLAN_MARK_EXIT), water: cssColor(COOP_PLAN_MARK_WATER) },
    ROOM: cssColor(COOP_PLAN_ROOM),
    ROOM_OP: COOP_PLAN_ROOM_ALPHA,
    ROUTE_TEXT: cssColor(COOP_PLAN_ROUTE_TEXT),
    TAPE: cssColor(COOP_PLAN_TAPE),
    TAPE_OP: COOP_PLAN_TAPE_OP,
    HAND: "plan-hand, Caveat, 'Segoe Print', cursive",
    DRAFT: "plan-draft, 'Sofia Sans Condensed', 'Arial Narrow', sans-serif",

    // The targets of the plan (Ivan 19.10): each kind ringed on the sheet in the colour of its ring
    // in the legend — the loot and the alarm by meaning, a hero's work in the colour of the hero
    // with that skill (the brief: locks and the vault — the carrot, the panel and the gate — the broccoli).
    /** @returns {Record<string, string>} */
    rings() {
        const of = (/** @type {string} */ skill) => (COOP_HEROES.find(h => (h.skills || []).includes(skill)) || { color: CoopPlanMap.INK }).color;
        return { loot: CoopPlanMap.MARK.loot, alarm: CoopPlanMap.MARK.threat, lock: of('mechanical'), panel: of('panel'), gate: of('electronic') };
    },

    // One of the 3 hands of a marker figure, the same for the same object (no stamp look).
    /** @param {string} key @returns {number} 1..3 */
    pick(key) {
        let h = 0;
        for (const ch of String(key)) h = (h * 31 + (ch.codePointAt(0) || 0)) >>> 0;   // keep: a string hash
        return 1 + h % 3;   // keep: the set has 3 hands of a marker sign
    },

    // What panel P switches off, in words: «свет, датчики».
    /** @param {any} M @param {any} P @returns {string} */
    powersText(M, P) {
        const word = (/** @type {string} */ w) => CoopText.t(['light', 'sensors', 'lasers'].includes(w) ? 'plan.power_' + w : 'plan.power_camera');
        return [...P.powers].map(word).join(', ');
    },

    // Hints, level 1 (Ivan 29.10: «явные описания ключевых объектов на Листе — План», «прямо у
    // объектов»): a short note by each key object of the level — what it does; no times (Ivan 06.11:
    // «убери таймеры с листа плана» — the dangers' deadlines stay). Built from the level and the objects config, so
    // every level has them. One note per kind of loot and per beam set: the same words by six
    // vitrines would cover the hall. → [{ id, at — the cell it points to, lines }].
    // ats — the cells the note may point to instead (any item of its kind; the layout takes the best).
    /** @param {any} M @returns {Array<{ id: string, at: number[], ats?: number[][], lines: string[] }>} */
    notes(M) {
        const num = (/** @type {number} */ v) => String(v).replace('.', ',');
        /** @type {Array<{ id: string, at: number[], ats?: number[][], lines: string[] }>} */
        const out = [];
        const van = [...M.van].map((/** @type {string} */ k) => k.split(',').map(Number));
        if (van.length) {
            out.push({ id: 'van', at: van[0], lines: [CoopText.t('plan.van'), CoopText.t('plan.van_counts'),
                CoopText.t('plan.van_loads', { list: M.heroes.map((/** @type {any} */ h) => h.icon + ' ' + num(M.capacity(h))).join(', ') })] });
        }
        for (const P of M.panels) {
            out.push({ id: 'panel:' + P.id, at: P.at, lines: [CoopPlanMap.panelLine(M, P)] });
        }
        const lasersOff = M.panels.filter((/** @type {any} */ P) => P.powers.has('lasers')).map((/** @type {any} */ P) => P.name.toLowerCase());
        const doors = new Set();
        for (const d of M.doors) {
            if (doors.has(d.lockOf) || (!d.lock && !d.sensor)) continue;
            doors.add(d.lockOf);
            out.push({ id: 'door:' + d.id, at: d.cells[0], lines: CoopPlanMap.doorLines(M, d) });
        }
        // the loot the sheet tells (the valuable with the hint): one note per kind of handling and
        // mass, by its first item — kinds that differ only in the name share it
        const marks = M.loot.some((/** @type {any} */ l) => l.hint);
        /** @type {Map<string, { l: any, names: Set<string>, all: number[][] }>} */
        const kinds = new Map();
        for (const l of M.loot) {
            if (marks && !l.hint) continue;
            const key = l.glass + '|' + l.multi + '|' + l.mass;
            if (!kinds.has(key)) kinds.set(key, { l, names: new Set(), all: [] });
            const kind = /** @type {any} */ (kinds.get(key));
            kind.names.add(l.name);
            kind.all.push(l.at);
        }
        for (const { l, names, all } of kinds.values()) {
            // «в витрине» after the loot's name, unless the name says it already («Витрина»)
            const name = names.size === 1 ? CoopPlanMap.lootName(l) : CoopText.t(l.glass ? 'plan.loot_vitrine' : 'plan.loot_any');
            out.push({ id: 'loot:' + l.id, at: l.at, ats: all, lines: CoopPlanMap.lootLines(l, name).concat([CoopText.t('plan.weight', { mass: num(l.mass) })]) });
        }
        if (M.beams.length) {
            out.push({ id: 'lasers', at: M.beams[0][0], ats: M.beams.flat(), lines: [CoopText.t('plan.lasers'), lasersOff.length ? CoopText.t('plan.lasers_off', { panel: lasersOff[0] }) : CoopText.t('plan.lasers_on')] });
        }
        for (const c of M.cameras) out.push({ id: 'camera:' + c.id, at: c.at, lines: [CoopText.t('plan.camera')] });
        for (const g of M.guards) out.push({ id: 'guard:' + g.id, at: g.patrol ? g.patrol[0] : g.post, lines: [CoopPlanMap.guardLine(g)] });
        return out;
    },

    // The words of the notes, one object at a time: the sheet's notes and the hint over an object
    // under the cursor (rules, section 26) say it alike.
    /** @param {any} M @param {any} P @returns {string} */
    panelLine(M, P) {
        return CoopText.t('plan.panel', { panel: P.name, what: CoopPlanMap.powersText(M, P) });
    },

    // A door: its name (a leaf named by its id only, «Д2», — «Дверь»), its lock, its sensor.
    /** @param {any} M @param {any} d @returns {string[]} */
    doorLines(M, d) {
        const sensorsOff = M.panels.filter((/** @type {any} */ P) => P.powers.has('sensors')).map((/** @type {any} */ P) => P.name.toLowerCase());
        const name = d.name && d.name !== d.id ? d.name : CoopText.t('plan.door');
        const lines = [d.lock ? CoopText.t('plan.door_lock', { door: name }) : name];
        if (d.sensor) lines.push(sensorsOff.length ? CoopText.t('plan.door_sensor_off', { panel: sensorsOff[0] }) : CoopText.t('plan.door_sensor'));
        return lines;
    },

    /** @param {any} l @returns {string} */
    lootName(l) {
        return l.glass && !l.name.toLowerCase().includes(CoopText.t('plan.glass_word').toLowerCase()) ? CoopText.t('plan.in_glass', { loot: l.name }) : l.name;
    },

    // A vitrine: how it opens and what a hurried grab costs a multi item (rules, section 10, 09.11);
    // other loot — its name only.
    /** @param {any} l @param {string} name @returns {string[]} */
    lootLines(l, name) {
        const lost = Math.round((1 - CoopModel.OBJECTS.vitrine.grab_keep) * 100);
        return l.glass ? [CoopText.t('plan.vitrine_open', { loot: name }), l.multi && lost > 0 ? CoopText.t('plan.vitrine_smash_grab', { lost }) : CoopText.t('plan.vitrine_smash')] : [name];
    },

    /** @param {any} g @returns {string} */
    guardLine(g) {
        return CoopText.t('plan.guard', { guard: g.name });
    },

    // The skills in the words of the rules' table (section 9): what each makes twice as fast; the
    // force — its own line; the load is in the hero's load figure.
    // (their words — plan.skill_<skill>)
    SKILL_FAST: ['mechanical', 'vault', 'electronic', 'panel', 'take'],

    // A hero's skills but the load, a line each — on his card (rules, section 29).
    /** @param {any} h @returns {string[]} */
    heroSkillLines(h) {
        const skills = h.skills || [], fast = skills.filter((/** @type {string} */ k) => CoopPlanMap.SKILL_FAST.includes(k)).map((/** @type {string} */ k) => CoopText.t('plan.skill_' + k));
        const out = [];
        if (fast.length) out.push(CoopText.t('plan.skills_fast', { list: fast.join(', ') }));
        if (skills.includes('force')) out.push(CoopText.t('plan.skill_line', { skill: CoopText.t('plan.skill_force') }));
        return out;
    },

    // Money on the sheet: «9,5 тыс.» (Ivan 05.11: rounding to whole thousands showed 9 500 as 10).
    /** @param {number} v @returns {string} */
    money(v) {
        return v >= 1000 ? CoopText.t('plan.thousands', { n: String(Math.round(v / 100) / 10).replace('.', ',') }) : String(v);   // keep: money in thousands
    },

    // The prices of the loot in one line, dearest first, in thousands: «11 · 11 · 10 · 9,5 тыс.».
    /** @param {number[]} prices @returns {string} */
    priceList(prices) {
        if (prices.every(v => v >= 1000)) return CoopText.t('plan.thousands', { n: prices.map(v => String(Math.round(v / 100) / 10).replace('.', ',')).join(' · ') });   // keep: money in thousands
        return prices.map(CoopPlanMap.money).join(' · ');
    },

    // The dangers under the legend (Ivan 29.10: «про патруль и ГБР по тревоге — отдельно под
    // легендой, назвать ОПАСНОСТИ»): [icon, line 1, line 2]. The ГБР — only where the alarm can
    // ring (rules, section 27; Ivan 09.11 struck it out on the tutorial's sheet).
    /** @param {any} M @returns {Array<string[]>} */
    dangers(M) {
        const out = [['🚓', CoopText.t('plan.patrol', { t: CoopModel.clock(M.patrolTicks) }), CoopText.t('plan.caught')]];
        if (M.canAlarm()) out.push(['🚨', CoopText.t('plan.police', { t: CoopModel.clock(M.policeTicks) }), CoopText.t('plan.caught')]);
        return out;
    },

    // opts.notes — the notes by the objects (hints, level 1; on by default, CoopPlanMap.notes).
    // opts.hint — the hint of the valuable loot is on (rules, section 15; on by default): a level
    // that marks its valuable loot (hint) draws the jewel, the price and the ring only for those,
    // the cheap ones are bare vitrines;
    // the hint off — all of them bare. A level that marks none shows all its loot ringed and priced.
    // opts.embed — the fonts and the paper inside the sheet (dataUrl: an image sees nothing outside
    // its SVG); off by default — the tests read the text, base64 is noise there.
    // The look is the 2D artist brief (design/plan-sheet-spec): a pale blueprint in ink and the
    // gang's marker over it; the signs come from the set (PLAN_SHEET_ART, design/plan-sheet-art).
    /** @param {any} M CoopLevelModel @param {{ hint?: boolean, notes?: boolean, embed?: boolean }} [opts] @returns {string} the sheet as SVG */
    svg(M, opts) {
        // pass 1 measures the sheet; pass 2 lays it out at the window's proportions: the legend's sticker
        // in the top right corner, the stamp in the bottom right one, the tutorial's steps in the bottom
        // left one, the map in the middle of the room left
        // left of the map — the steps' column (or the frame), right of it — the sticker's; the map with its
        // notes (box) only as large as they took in pass 1
        const a = CoopPlanMap.draw(M, opts, null), A = CoopPlanMap.SHEET_ASPECT, E = CoopPlanMap.SHEET_EDGE;
        // the steps keep the level's cells (a.grid — their left edge in the box) right of them; the notes
        // left of the level may stand over the steps (they keep off them)
        const lw = Math.max(E, a.stepsRight ? a.stepsRight + CoopPlanMap.STEPS_GAP - a.grid : 0), rw = a.sw + CoopPlanMap.STICKER_MARGIN + E;
        const bw = a.box[2] - a.box[0], bh = a.box[3] - a.box[1];
        const W1 = lw + bw + rw, H1 = Math.max(bh + 2 * E, a.colH, a.stepsH ? a.stepsH + CoopPlanMap.STEPS_BOTTOM + E : 0);
        const W = Math.max(W1, H1 * A), H = Math.max(H1, W1 / A);
        const dx = lw + (W - lw - rw - bw) / 2 - a.box[0], dy = (H - bh) / 2 - a.box[1];
        return CoopPlanMap.draw(M, opts, { W, H, dx, dy, sw: a.sw }).svg;
    },

    // The sheet laid out: fit — null (its natural size) or { W, H — the sheet, dx, dy — the map moved by,
    // sw — the sticker's width } -> { svg, W, H, sw, box — the map with its notes and marks [x0, y0, x1, y1],
    // stepsRight, stepsH — the steps' column (0 — none), colH — the height the sticker and the stamp take }.
    /** @param {any} M @param {{ hint?: boolean, notes?: boolean, embed?: boolean } | undefined} opts @param {{ W: number, H: number, dx: number, dy: number, sw: number } | null} fit */
    draw(M, opts, fit) {
        const marks = M.loot.some((/** @type {any} */ l) => l.hint), hintOn = !opts || opts.hint !== false;
        const known = (/** @type {any} */ l) => !marks || (hintOn && l.hint);
        const notesOn = !opts || opts.notes !== false, embed = !!(opts && opts.embed);
        const C = CoopPlanMap.CELL, P = notesOn ? CoopPlanMap.NOTE_PAD : CoopPlanMap.PAD, ink = CoopPlanMap.INK;
        const MK = CoopPlanMap.MARK, RING = CoopPlanMap.rings(), HAND = CoopPlanMap.HAND, DRAFT = CoopPlanMap.DRAFT;
        const ART = PLAN_SHEET_ART.symbols;
        const n1 = (/** @type {number} */ v) => Math.round(v * 10) / 10;
        // the tutorial's steps (rules, section 27): a column in the bottom left corner, the map right of it
        // the presses only: a plate is no step (section 32)
        const tasks = Array.isArray(M.L.tutorial) ? M.L.tutorial.filter((/** @type {any} */ s) => s.do !== 'note').map((/** @type {any} */ s) => (s.task || '').trim()) : [];
        const SF = CoopPlanMap.STEP_FONT, stepLines = tasks.map((/** @type {string} */ t, /** @type {number} */ k) => (k + 1) + '. ' + t);
        const advH0 = PLAN_SHEET_ART.advances.hand;
        const stepsW = tasks.length ? Math.max(...stepLines.map((/** @type {string} */ t) => [...t].reduce((w, ch) => w + (advH0[ch] || CoopPlanMap.ADV_MISSING), 0) * SF)) : 0;
        const stepsH = tasks.length ? CoopPlanMap.STEPS_HEAD_Y + CoopPlanMap.STEPS_HEAD_GAP + stepLines.length * (SF + CoopPlanMap.STEP_GAP) : 0;
        const left = tasks.length ? Math.max(P, CoopPlanMap.STEPS_X + stepsW + CoopPlanMap.STEPS_GAP) : P;
        const H0 = Math.max(M.H * C + P * 2, CoopPlanMap.SHEET_MIN_H, stepsH ? stepsH + CoopPlanMap.STEPS_BOTTOM + CoopPlanMap.STEPS_ROOM : 0);
        const dx = fit ? fit.dx : 0, dy = fit ? fit.dy : 0;
        const X = (/** @type {number} */ x) => dx + left + x * C, Y = (/** @type {number} */ y) => dy + P + y * C;
        const mid = (/** @type {number[]} */ c) => [X(c[0]) + C / 2, Y(c[1]) + C / 2];
        const esc = (/** @type {any} */ s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const money = CoopPlanMap.money, pick = CoopPlanMap.pick;
        /** @type {string[]} */
        const out = [];
        const add = (/** @type {string} */ s) => out.push(s);
        // the signs and the patterns the sheet uses: only those go to its <defs>
        const used = new Set();
        /** @type {Map<string, string>} */
        const pats = new Map();
        // A sign of the set centred on (cx, cy), s px for 64 px of its canvas (wh — the box itself);
        // a marker sign is drawn in fill.
        /** @param {string} id @param {number} cx @param {number} cy @param {number} s @param {{ attr?: string, fill?: string, op?: number, rot?: number, wh?: number[], flip?: boolean }} [o] */
        const use = (id, cx, cy, s, o = {}) => {
            used.add(id);
            const [w, h] = o.wh || [ART[id].w / 64 * s, ART[id].h / 64 * s];   // keep: the set's signs are drawn on a 64 px canvas
            // o.flip — mirrored along the sign's own x before the turn
            const tf = (o.rot ? `rotate(${n1(o.rot)} ${n1(cx)} ${n1(cy)})` : '') + (o.flip ? ` translate(${n1(2 * cx)} 0) scale(-1 1)` : '');
            return `<use ${o.attr ? o.attr + ' ' : ''}href="#s-${id}" x="${n1(cx - w / 2)}" y="${n1(cy - h / 2)}" width="${n1(w)}" height="${n1(h)}"`
                + (o.fill ? ` fill="${o.fill}"` : '') + (o.op ? ` opacity="${o.op}"` : '') + (tf ? ` transform="${tf.trim()}"` : '') + '/>';
        };
        // a seamless tile of the set over a set of cells, aligned with the level's grid
        const pat = (/** @type {string} */ id, /** @type {string} */ sym, /** @type {number} */ size, fill = '', op = 1) => {
            if (!pats.has(id)) pats.set(id, `<pattern id="p-${id}" patternUnits="userSpaceOnUse" x="${n1(X(0))}" y="${n1(Y(0))}" width="${size}" height="${size}">`
                + use(sym, size / 2, size / 2, size * 64 / ART[sym].w, { fill, op }) + '</pattern>');   // keep: the set's signs are drawn on a 64 px canvas
            return `url(#p-${id})`;
        };
        // a marker ring round (x, y) of radius r: small or middle, one of 3 hands by the object
        // the boxes the step numbers keep off (rules, section 27): the rings, the prices, the route's arrows, the room names
        /** @type {number[][]} */
        const busy = [];
        const ring = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ r, /** @type {string} */ kind, /** @type {string} */ key, attr = 'data-ring') =>
            busy.push([x - r, y - r, x + r, y + r]) && use('22-ring-' + (r > CoopPlanMap.RING_M_FROM ? 'm' : 's') + '-' + pick(key), x, y, r * 64 / (r > CoopPlanMap.RING_M_FROM ? 36 : 18), { attr: `${attr}="${kind}"`, fill: RING[kind] });   // keep: the set's rings, radius 36 and 18 of 64
        // text in the hand or the drafting font; halo — a paper outline under the letters over lines
        /** @param {number} x @param {number} y @param {string} s @param {number} size @param {{ attr?: string, font?: string, fill?: string, anchor?: string, mid?: boolean, halo?: string, extra?: string }} [o] */
        const text = (x, y, s, size, o = {}) => `<text ${o.attr ? o.attr + ' ' : ''}x="${n1(x)}" y="${n1(y)}" font-family="${o.font || HAND}" font-size="${size}"`
            + (o.anchor ? ` text-anchor="${o.anchor}"` : '') + (o.mid ? ' dominant-baseline="central"' : '')
            + (o.halo ? ` stroke="${o.halo}" stroke-width="${CoopPlanMap.HALO_W}" stroke-linejoin="round" paint-order="stroke"` : '') + (o.extra || '')
            + ` fill="${o.fill || ink}">${esc(s)}</text>`;
        const zoneOf = (/** @type {number} */ x, /** @type {number} */ y) => M.L.zones[M.zone[y][x]];

        // Rooms a shade lighter than the paper, the street and the yard thinly hatched; the grid of
        // cells over them (every 5th line brighter).
        M.L.zones.forEach((/** @type {any} */ z) => {
            const [x0, y0, x1, y1] = z.rect, isOut = z.kind === 'outside';
            const r = `x="${X(x0)}" y="${Y(y0)}" width="${(x1 - x0 + 1) * C}" height="${(y1 - y0 + 1) * C}"`;
            add(`<rect data-zone="${esc(z.id)}" ${r} fill="${isOut ? pat('street', '05-street-hatch', C * 2) : CoopPlanMap.ROOM}"${isOut ? '' : ` fill-opacity="${CoopPlanMap.ROOM_OP}"`}/>`);
            add(`<rect ${r} fill="${pat('grid', '02-grid', C * 5)}"/>`);   // keep: the set's grid sign spans 5 cells
        });

        // Wet floor and lasers lie under the walls: a beam from emitter to emitter, the marker's
        // zigzag over it.
        M.wet.forEach((/** @type {string} */ k) => {
            const [x, y] = k.split(',').map(Number);
            add(`<rect data-kind="wet" x="${X(x)}" y="${Y(y)}" width="${C}" height="${C}" fill="${pat('wet', '30-wet', C, MK.water)}"/>`);
        });
        M.beams.forEach((/** @type {number[][]} */ beam) => {
            const flat = beam.every(c => c[1] === beam[0][1]), rot = flat ? 0 : 90, [dx, dy] = flat ? [1, 0] : [0, 1];
            beam.forEach(c => add(use('14-laser-beam', mid(c)[0], mid(c)[1], C, { attr: 'data-kind="laser"', rot })));
            beam.forEach(c => add(use('29-laser-zigzag', mid(c)[0], mid(c)[1], C, { fill: MK.threat, op: CoopPlanMap.LASER_OP, rot })));
            const [ax, ay] = mid(beam[0]), [bx, by] = mid(beam[beam.length - 1]);
            add(use('14-laser-emitter', ax - dx * C * CoopPlanMap.EMITTER_OUT, ay - dy * C * CoopPlanMap.EMITTER_OUT, C, { rot }));
            add(use('14-laser-emitter', bx + dx * C * CoopPlanMap.EMITTER_OUT, by + dy * C * CoopPlanMap.EMITTER_OUT, C, { rot: rot + 180 }));
        });

        // Walls: a band of ~0.2 cell on every cell edge with a wall (the void around the level
        // counts as one) — the ink bands first, then their hatch: crossing bands read as one outline.
        // The street's or the yard's edge to the void is not a wall — a thin line.
        const wallAt = (/** @type {number} */ x, /** @type {number} */ y, /** @type {string} */ dir) => {
            const [dx, dy] = CoopModel.DELTA[dir], nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= M.W || ny >= M.H || M.zone[ny][nx] < 0) return true;
            return M.edges.get(M.edgeKey(x, y, dir)) === 'wall';
        };
        const T = Math.round(C * CoopPlanMap.WALL_T), O = CoopPlanMap.WALL_INK;
        let inkD = '', hatchD = '', thinD = '';
        const band = (/** @type {number} */ x0, /** @type {number} */ y0, /** @type {number} */ w, /** @type {number} */ h) => `M${n1(x0)},${n1(y0)}h${n1(w)}v${n1(h)}h${n1(-w)}z`;
        for (let y = 0; y < M.H; y++) {
            for (let x = 0; x < M.W; x++) {
                if (M.zone[y][x] < 0) continue;
                for (const dir of ['U', 'R', 'D', 'L']) {
                    // an edge between two cells of the level is drawn once, from its upper/left cell
                    const [dx, dy] = CoopModel.DELTA[dir], nx = x + dx, ny = y + dy;
                    const shared = nx >= 0 && ny >= 0 && nx < M.W && ny < M.H && M.zone[ny][nx] >= 0;
                    if ((dir === 'U' || dir === 'L') && shared) continue;
                    if (!wallAt(x, y, dir)) continue;
                    const ex = X(x + (dir === 'R' ? 1 : 0)), ey = Y(y + (dir === 'D' ? 1 : 0)), along = dir === 'U' || dir === 'D';
                    if (!shared && zoneOf(x, y).kind === 'outside') {
                        thinD += along ? `M${ex},${ey}h${C}` : `M${ex},${ey}v${C}`;
                        continue;
                    }
                    const [bx, by, bw, bh] = along ? [ex - T / 2, ey - T / 2, C + T, T] : [ex - T / 2, ey - T / 2, T, C + T];
                    inkD += band(bx - O, by - O, bw + 2 * O, bh + 2 * O);
                    hatchD += band(bx, by, bw, bh);
                }
            }
        }
        if (thinD) add(`<path d="${thinD}" fill="none" stroke="${ink}" stroke-opacity="${CoopPlanMap.THIN_OP}" stroke-width="1"/>`);
        if (inkD) {
            add(`<path d="${inkD}" fill="${ink}"/>`);
            add(`<path d="${hatchD}" fill="${pat('wall', '04-wall-hatch', C)}"/>`);
        }

        // Doors on their cell edges (the sign stands on the bottom edge, turned to its side): open
        // at the start — an arch, electronic — the gate's rail, the vault's — a thick leaf, else a
        // leaf with its swing. The lock and the sensor beside it along the wall, the gate's keypad
        // in its cell; the ring — of the hero whose work it is (lock, gate) or the threat (sensor).
        const TURN = /** @type {Record<string, number>} */ ({ D: 0, L: 90, U: 180, R: -90 });
        const LOCK = /** @type {Record<string, string>} */ ({ mechanical: '07-lock', vault: '08-vault-lock', electronic: '09-gate-lock' });
        // A double door is two doors with one lock (lockOf): the leaf further along the sign's x is
        // mirrored, so the pair hinges at its outer jambs and opens from the middle (Ivan 06.11).
        const along = (/** @type {any[]} */ [x, y, dir]) => ({ D: x, L: y, U: -x, R: -y })[/** @type {'D'} */ (dir)];
        const leaves = new Map(), lockOf = (/** @type {any} */ d) => d.lockOf ?? d.id;
        M.doors.forEach((/** @type {any} */ d) => leaves.set(lockOf(d), [...(leaves.get(lockOf(d)) || []), d]));
        const flipped = (/** @type {any} */ d) => {
            const pair = leaves.get(lockOf(d));
            return pair.length === 2 && along(d.cells[0]) > Math.min(...pair.map((/** @type {any} */ e) => along(e.cells[0])));   // keep: a double door is two leaves
        };
        M.doors.forEach((/** @type {any} */ d, /** @type {number} */ i) => {
            const sign = M.startOpen(i) ? '06-arch' : d.lock === 'electronic' ? '09-gate-rail' : d.lock === 'vault' ? '08-vault-door' : '06-door';
            const flip = sign === '06-door' && flipped(d);
            d.cells.forEach((/** @type {any[]} */ [x, y, dir]) => add(use(sign, mid([x, y])[0], mid([x, y])[1], C, { attr: `data-door="${esc(d.id)}"` + (flip ? ' data-flip="1"' : ''), rot: TURN[dir], flip })));
            const [x, y, dir] = d.cells[0], [dx, dy] = CoopModel.DELTA[dir];
            const cx = X(x) + C / 2 + dx * C / 2, cy = Y(y) + C / 2 + dy * C / 2;
            if (d.lock) {
                const lx = cx + (dy ? CoopPlanMap.LOCK_OUT : 0), ly = cy + (dx ? -CoopPlanMap.LOCK_OUT : 0);
                add(use(LOCK[d.lock] || '07-lock', lx, ly, C * CoopPlanMap.DOOR_SIGN));
                add(ring(lx, ly, CoopPlanMap.DOOR_RING, d.lock === 'electronic' ? 'gate' : 'lock', d.id));
            }
            if (d.sensor) {
                const sx = cx + (dy ? -CoopPlanMap.LOCK_OUT : 0), sy = cy + (dx ? CoopPlanMap.LOCK_OUT : 0);
                add(use('10-sensor', sx, sy, C * CoopPlanMap.DOOR_SIGN));
                add(ring(sx, sy, CoopPlanMap.DOOR_RING, 'alarm', d.id + 's'));
            }
            if (d.panelAt) {
                const [kx, ky] = mid(d.panelAt);
                add(use('11-keypad', kx, ky, C * CoopPlanMap.KEYPAD_SIGN));
                add(ring(kx, ky, CoopPlanMap.KEYPAD_RING, 'gate', d.id + 'k'));
            }
        });

        // What a camera sees over its whole sweep and a posted guard sees from his post: cells in
        // the cone and in line of sight, locked doors closed (as the plan starts) — the marker's
        // hatch, the camera's «///», the guard's «\\\».
        const seen = (/** @type {number[]} */ at, /** @type {number[]} */ angles, /** @type {number} */ fov, /** @type {number} */ range) => {
            /** @type {number[][]} */
            const cells = [];
            const r = Math.ceil(range);
            for (let y = at[1] - r; y <= at[1] + r; y++) {
                for (let x = at[0] - r; x <= at[0] + r; x++) {
                    if (x < 0 || y < 0 || x >= M.W || y >= M.H || M.zone[y][x] < 0 || (x === at[0] && y === at[1])) continue;
                    if (angles.some(a => M.inCone(at[0], at[1], a, fov, range, x, y, null))) cells.push([x, y]);
                }
            }
            return cells;
        };
        const shade = (/** @type {number[][]} */ cells, /** @type {string} */ fill, /** @type {string} */ attr) =>
            cells.forEach(([x, y]) => add(`<rect ${attr} x="${X(x)}" y="${Y(y)}" width="${C}" height="${C}" fill="${fill}"/>`));
        M.cameras.forEach((/** @type {any} */ c) => {
            const n = c.sweep ? Math.ceil(c.sweep / CoopPlanMap.CAM_SWEEP_STEP) : 0;
            const angles = Array.from({ length: n + 1 }, (_, i) => c.base - c.sweep / 2 + (n ? c.sweep * i / n : 0));
            shade(seen(c.at, angles, c.fov, c.range), pat('cam', '17-hatch-camera', C, MK.threat, CoopPlanMap.SIGHT_OP), `data-camera="${esc(c.id)}"`);
        });
        M.guards.filter((/** @type {any} */ g) => g.post).forEach((/** @type {any} */ g) =>
            shade(seen(g.post, [CoopModel.ANGLE[g.facing]], g.fov, g.range), pat('guard', '18-hatch-guard', C, MK.threat, CoopPlanMap.SIGHT_OP), `data-sight="${esc(g.id)}"`));
        // the camera looks to the middle of its sweep
        M.cameras.forEach((/** @type {any} */ c) => add(use('13-camera', mid(c.at)[0], mid(c.at)[1], C * CoopPlanMap.CAMERA_SIGN, { attr: `data-camera="${esc(c.id)}"`, rot: c.base })));
        M.panels.forEach((/** @type {any} */ p) => {
            const [px, py] = mid(p.at);
            add(`<g data-kind="panel" data-panel="${esc(p.id)}">`);
            add(use('12-panel', px, py, C * CoopPlanMap.PANEL_SIGN));
            add(ring(px, py, C / 2 + CoopPlanMap.PANEL_RING_OUT, 'panel', p.id));
            add(`</g>`);
        });

        // The van: the dashed frame round its bay — where the crew starts and the loot has to come; the
        // marker's van over the whole of it, the cab too (Ivan 13.11, rules, section 30).
        let vx0 = Infinity, vy0 = Infinity, vx1 = -1, vy1 = -1;
        M.van.forEach((/** @type {string} */ k) => {
            const [x, y] = k.split(',').map(Number);
            vx0 = Math.min(vx0, x); vy0 = Math.min(vy0, y); vx1 = Math.max(vx1, x); vy1 = Math.max(vy1, y);
        });
        const vanObj = M.L.objects.find((/** @type {any} */ o) => o.kind === 'van');
        if (vx1 >= 0 && vanObj) {
            const [ax0, ay0, ax1, ay1] = vanObj.rect;
            const vw = (vx1 - vx0 + 1) * C, vh = (vy1 - vy0 + 1) * C, aw = (ax1 - ax0 + 1) * C, ah = (ay1 - ay0 + 1) * C, upright = ah > aw;
            const V = CoopPlanMap.VAN_IN;
            const s = upright ? Math.min((ah - V) / 4, (aw - V) / 2) : Math.min((aw - V) / 4, (ah - V) / 2);   // keep: the van's sign is 4 × 2 of 64 px
            const R = CoopPlanMap.VAN_RIM_IN;
            add(`<g data-kind="van">`);
            add(`<rect x="${X(vx0) + R}" y="${Y(vy0) + R}" width="${vw - 2 * R}" height="${vh - 2 * R}" rx="${CoopPlanMap.VAN_RIM_R}" fill="none" stroke="${MK.exit}" stroke-width="${CoopPlanMap.VAN_RIM_W}" stroke-dasharray="${CoopPlanMap.VAN_DASH} ${CoopPlanMap.VAN_GAP}"/>`);
            add(use('24-van', X(ax0) + aw / 2, Y(ay0) + ah / 2, s, { fill: MK.exit, rot: upright ? 90 : 0 }));
            add(`</g>`);
        }

        // The tutorial's route (rules, section 27; Ivan 09.11 evening: «маршрут героя таким же пунктиром как на
        // этапе планирования только еще добавить несколько стрелочек направления движения»): the floor trail's
        // dot in each cell of the steps' plan, the hero's colour; an arrow mid-leg along the way, a leg of
        // fewer than ROUTE_MIN_LEG moves — none. Under the signs: the vitrines and the van stay on top.
        const tour = CoopTutorial.route(M), tourHex = '#' + M.heroes[0].mark.toString(16).padStart(6, '0');
        /** @type {number[][]} */
        const tourCells = [];   // the cells under the route's arrows: the room names keep off them
        if (tour) {
            add(`<g data-kind="route">`);
            for (const leg of tour.legs) for (const c of leg.slice(1)) {
                const [cx, cy] = mid(c);
                add(`<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(C * CoopPlanMap.ROUTE_DOT / 2)}" fill="${tourHex}"/>`);
                const r = CoopPlanMap.ROUTE_DOT_KEEP;
                busy.push([cx - r, cy - r, cx + r, cy + r]);
            }
            tour.legs.forEach((leg, k) => {
                if (leg.length - 1 < CoopPlanMap.ROUTE_MIN_LEG) return;
                const m = Math.floor((leg.length - 2) / 2), [ax, ay] = mid(leg[m]), [bx, by] = mid(leg[m + 1]);   // keep: the leg's middle move
                busy.push([(ax + bx) / 2 - C * CoopPlanMap.ROUTE_ARROW / 2, (ay + by) / 2 - C * CoopPlanMap.ROUTE_ARROW / 2, (ax + bx) / 2 + C * CoopPlanMap.ROUTE_ARROW / 2, (ay + by) / 2 + C * CoopPlanMap.ROUTE_ARROW / 2]);
                tourCells.push(leg[m], leg[m + 1]);
                add(use('19-route-arrow-' + pick('route' + k), (ax + bx) / 2, (ay + by) / 2, C * CoopPlanMap.ROUTE_ARROW, { attr: 'data-arrow="1"', fill: tourHex, rot: Math.atan2(by - ay, bx - ax) * 180 / Math.PI }));
            });
            add(`</g>`);
        }

        // Loot: a vitrine (with a sensor — its mark in the corner), a pedestal (its cell is shut for
        // good, rules, section 16), a painting on its wall (rules, section 10). A cheap one is a bare
        // vitrine (Ivan 20.10): no jewel, no price, no ring; a cheap painting or bust — its sign only
        // (Ivan 06.11: «алмаз это иконка для ценной добычи»); loot is always a diamond (Ivan 20.10: «не нужно вводить новую
        // иконку в виде мешка»). The price in ink under it: yellow does not read on the pale paper.
        const advH = PLAN_SHEET_ART.advances.hand;
        const em = (/** @type {string} */ t) => [...t].reduce((w, ch) => w + (advH[ch] || CoopPlanMap.ADV_MISSING), 0);
        M.loot.forEach((/** @type {any} */ l) => {
            const [lx, ly] = mid(l.at);
            add(`<g data-loot="${esc(l.id)}">`);
            if (l.glass) add(use(l.sensor ? '15-vitrine-sensor' : '15-vitrine', lx, ly, C, { attr: 'data-vitrine="1"' }));
            if (l.stand) add(use('33-pedestal', lx, ly, C, { attr: 'data-stand="1"' }));
            if (l.wall) add(use('34-painting', lx, ly, C, { attr: `data-wall="${l.wall}"`, rot: l.wall === 'W' ? -90 : l.wall === 'E' ? 90 : 0 }));
            if (known(l)) add(use('23-loot-gem', lx, ly - CoopPlanMap.GEM_UP, C * CoopPlanMap.GEM_SIGN, { attr: 'data-gem="1"', fill: MK.loot }));
            if (known(l)) {
                const label = money(l.value), size = n1(Math.min(CoopPlanMap.PRICE_FONT, C * CoopPlanMap.PRICE_W / em(label)));
                add(text(lx, ly + CoopPlanMap.PRICE_DOWN, label, size, { attr: `data-price="${l.value}"`, anchor: 'middle', halo: CoopPlanMap.PAPER }));
                busy.push([lx - em(label) * size / 2, ly + CoopPlanMap.PRICE_DOWN - size, lx + em(label) * size / 2, ly + CoopPlanMap.PRICE_BOTTOM]);
                add(ring(lx, ly, C * CoopPlanMap.LOOT_RING, 'loot', l.id));
            }
            add(`</g>`);
        });

        // Guards: the round as a dashed loop with arrows of its way, the post with the way he
        // faces; the tomato where he starts, his name over it.
        M.guards.forEach((/** @type {any} */ g) => {
            add(`<g data-guard="${esc(g.id)}">`);
            const start = g.patrol ? g.patrol[0] : g.post;
            if (g.patrol) {
                const loop = g.patrol.concat([g.patrol[0]]).map(mid);
                add(`<polyline points="${loop.map(p => p.join(',')).join(' ')}" fill="none" stroke="${MK.threat}" stroke-width="${CoopPlanMap.PATROL_W}" stroke-dasharray="${CoopPlanMap.PATROL_DASH} ${CoopPlanMap.PATROL_GAP}" stroke-linecap="round" stroke-opacity="${CoopPlanMap.PATROL_OP}"/>`);
                for (let i = CoopPlanMap.PATROL_ARROW_FROM; i + 1 < loop.length; i += CoopPlanMap.PATROL_ARROW_EVERY) {
                    const [ax, ay] = loop[i], [bx, by] = loop[i + 1];
                    add(use('19-route-arrow-' + pick(g.id + i), (ax + bx) / 2, (ay + by) / 2, C * CoopPlanMap.PATROL_ARROW, { fill: MK.threat, rot: Math.atan2(by - ay, bx - ax) * 180 / Math.PI }));
                }
            } else if (g.post) {
                const [gx, gy] = mid(g.post), [dx, dy] = CoopModel.DELTA[g.facing] || [0, 1];
                add(`<line x1="${gx}" y1="${gy}" x2="${gx + dx * C * CoopPlanMap.POST_LINE}" y2="${gy + dy * C * CoopPlanMap.POST_LINE}" stroke="${MK.threat}" stroke-width="${CoopPlanMap.POST_LINE_W}" stroke-linecap="round"/>`);
                add(use('28-arrow-' + pick(g.id), gx + dx * C * CoopPlanMap.POST_LINE, gy + dy * C * CoopPlanMap.POST_LINE, C * CoopPlanMap.POST_ARROW, { fill: MK.threat, rot: Math.atan2(dy, dx) * 180 / Math.PI }));
            }
            if (start) {
                const [gx, gy] = mid(start);
                add(use('20-guard-' + pick(g.id), gx, gy, C * CoopPlanMap.GUARD_SIGN, { fill: MK.threat }));
                add(text(gx, gy - C / 2 - CoopPlanMap.GUARD_NAME_UP, g.name, CoopPlanMap.GUARD_FONT, { anchor: 'middle', fill: MK.threat, halo: CoopPlanMap.PAPER }));
            }
            add(`</g>`);
        });

        // Room names in the drafting font on a room's top row (an L-shaped room — once), over the
        // walls: the first cells free of the objects' signs, its top row first.
        const taken = new Set();
        const take = (/** @type {number[]} */ c) => taken.add(c[0] + ',' + c[1]);
        M.loot.forEach((/** @type {any} */ l) => take(l.at));
        tourCells.forEach(take);
        M.panels.forEach((/** @type {any} */ p) => take(p.at));
        M.cameras.forEach((/** @type {any} */ c) => take(c.at));
        M.guards.forEach((/** @type {any} */ g) => take(g.patrol ? g.patrol[0] : g.post));
        M.doors.forEach((/** @type {any} */ d) => d.cells.forEach((/** @type {any[]} */ [x, y, dir]) => {
            take([x, y]);
            take([x + CoopModel.DELTA[dir][0], y + CoopModel.DELTA[dir][1]]);
            if (d.panelAt) take(d.panelAt);
        }));
        const advD = PLAN_SHEET_ART.advances.draft;
        const named = new Set();
        M.L.zones.forEach((/** @type {any} */ z) => {
            if (!z.name || named.has(z.room || z.id)) return;
            named.add(z.room || z.id);
            const name = z.name.toUpperCase(), [x0, y0, x1, y1] = z.rect;
            const k = Math.ceil(([...name].reduce((w, ch) => w + (advD[ch] || CoopPlanMap.ADV_MISSING) * CoopPlanMap.ROOM_FONT + CoopPlanMap.ROOM_SPACING, 0) + CoopPlanMap.ROOM_NAME_PAD) / C);
            let at = [x0, y0];
            search: for (let y = y0; y <= y1; y++) {
                for (let x = x0; x + k - 1 <= x1; x++) {
                    // the cell on its left free too: a ring there reaches over the edge
                    if (Array.from({ length: k + 1 }, (_, i) => x + i - 1).every(cx => !taken.has(cx + ',' + y))) { at = [x, y]; break search; }
                }
            }
            add(text(X(at[0]) + CoopPlanMap.ROOM_NAME_X, Y(at[1]) + CoopPlanMap.ROOM_NAME_Y, name, CoopPlanMap.ROOM_FONT, { font: DRAFT, fill: ink,
                extra: ` fill-opacity="${CoopPlanMap.ROOM_NAME_OP}" letter-spacing="${CoopPlanMap.ROOM_SPACING}"` }));
            busy.push([X(at[0]) + CoopPlanMap.ROOM_BOX_IN, Y(at[1]) + CoopPlanMap.ROOM_BOX_IN, X(at[0]) + CoopPlanMap.ROOM_BOX_R
                + [...name].reduce((w, ch) => w + (advD[ch] || CoopPlanMap.ADV_MISSING) * CoopPlanMap.ROOM_FONT + CoopPlanMap.ROOM_SPACING, 0), Y(at[1]) + CoopPlanMap.ROOM_BOX_B]);
        });

        // The tutorial's steps (rules, section 27; Ivan 08.11: «В туториале на план надо добавить все Шаги —
        // Задания»): every step's task, in order, in the bottom left corner of the sheet (Ivan 09.11, an
        // arrow on the screenshot — bottom left; 10.11 — «по углам»), the map right of them; the notes keep off it.
        /** @type {number[][]} */
        const keep = [];
        if (tasks.length) {
            const sx0 = CoopPlanMap.STEPS_X, sy0 = (fit ? fit.H : H0) - CoopPlanMap.STEPS_BOTTOM - stepsH;
            let y = sy0 + CoopPlanMap.STEPS_HEAD_Y;
            add(`<g data-kind="steps">` + text(sx0, y, CoopText.t('plan.steps'), CoopPlanMap.HEAD_FONT, { font: DRAFT, extra: ` font-weight="700" letter-spacing="${CoopPlanMap.HEAD_SPACING}"` }));   // keep: font-weight 700 — bold
            y += CoopPlanMap.STEPS_HEAD_GAP + SF;
            for (const line of stepLines) {
                add(text(sx0, y, line, SF));
                y += SF + CoopPlanMap.STEP_GAP;
            }
            // the list's box, unseen: the tests read it; the notes keep 8 px off it
            add(`<rect data-box="1" x="${n1(sx0)}" y="${n1(sy0)}" width="${n1(stepsW)}" height="${n1(y - sy0)}" fill="none"/></g>`);
            const kp = CoopPlanMap.STEPS_KEEP;
            keep.push([sx0 - kp, sy0 - kp, sx0 + stepsW + kp, y + kp]);
        }

        // The step numbers at their targets (rules, section 27; Ivan 09.11 evening: «пункты плана перенеси и на сам
        // план»): a pill in the hero's colour by its target — a vitrine, a door, a cell (on it; a cell of the van
        // too, Ivan 10.11: «шаг эвакуации в машине правая клетка») — on the first side clear of the rings, the
        // prices, the arrows, the room names and the pills set before it; the notes keep off the pills.
        if (tour) {
            const hit = (/** @type {number[]} */ b) => busy.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
            add(`<g data-kind="step-marks">`);
            for (const mk of tour.marks) {
                const d = M.doors.find((/** @type {any} */ q) => q.id === mk.at), l = M.loot.find((/** @type {any} */ q) => q.id === mk.at);
                const label = mk.ks.join(', '), h = CoopPlanMap.PILL_H, w = Math.max(h, em(label) * CoopPlanMap.ROUTE_FONT + CoopPlanMap.PILL_PAD);
                /** @type {number[][]} */
                let tries;
                const round = (/** @type {number} */ tx, /** @type {number} */ ty, /** @type {number} */ r) => {
                    const g = r + CoopPlanMap.PILL_GAP, q = g * 0.7;   // keep: ≈ cos 45°, the diagonal spots
                    return [[tx, ty - g - h / 2], [tx - g - w / 2, ty], [tx + g + w / 2, ty], [tx - q - w / 2, ty - q - h / 2],
                        [tx + q + w / 2, ty - q - h / 2], [tx, ty + g + h / 2], [tx - q - w / 2, ty + q + h / 2], [tx + q + w / 2, ty + q + h / 2]];
                };
                if (d) {
                    const [x, y, dir] = d.cells[0];
                    const [ex, ey] = mid([x + CoopModel.DELTA[dir][0] / 2, y + CoopModel.DELTA[dir][1] / 2]);
                    tries = round(ex, ey, CoopPlanMap.PILL_DOOR_R);
                } else if (l) {
                    const [lx, ly] = mid(l.at);
                    tries = round(lx, ly, C * CoopPlanMap.LOOT_RING);
                }
                else {
                    const [cx, cy] = mid(mk.at.split(',').map(Number));
                    tries = [[cx, cy]].concat(round(cx, cy, CoopPlanMap.PILL_CELL_R));
                }
                const box = (/** @type {number[]} */ c) => [c[0] - w / 2, c[1] - h / 2, c[0] + w / 2, c[1] + h / 2];
                const xy = tries.find(c => !hit(box(c))) || tries[0];
                busy.push(box(xy));
                keep.push(box(xy));
                add(`<g data-step="${label}" data-at="${esc(mk.at)}" data-xy="${n1(xy[0])},${n1(xy[1])}">`
                    + `<rect x="${n1(xy[0] - w / 2)}" y="${n1(xy[1] - h / 2)}" width="${n1(w)}" height="${h}" rx="${h / 2}" fill="${tourHex}"/>`
                    + text(xy[0], xy[1] + CoopPlanMap.PILL_TEXT_DOWN, label, CoopPlanMap.ROUTE_FONT, { anchor: 'middle', fill: CoopPlanMap.ROUTE_TEXT, extra: ' font-weight="700"' }) + `</g>`);   // keep: font-weight 700 — bold
            }
            add(`</g>`);
        }


        // the notes may stand right of the map too: the legend moves past the rightmost of them
        const noted = notesOn ? CoopPlanMap.drawNotes(M, add, esc, { C, P, X, Y, mid, x0: CoopPlanMap.NOTE_EDGE + dx, y0: CoopPlanMap.NOTE_EDGE + dy, W: X(M.W) + P + CoopPlanMap.NOTE_RIGHT, H: H0 + dy, use, text, pick, n1, keep }) : null, right = noted ? noted[2] : 0;
        // the map with its notes and the step numbers: what pass 2 centres (the doors' swing and the guards' names
        // reach a little out of the level)
        const box = [X(0) - CoopPlanMap.BOX_PAD, Y(0) - CoopPlanMap.BOX_TOP, X(M.W) + CoopPlanMap.BOX_PAD, Y(M.H) + CoopPlanMap.BOX_PAD];
        for (const b of (noted ? [noted] : []).concat(keep.slice(tasks.length ? 1 : 0))) {
            box[0] = Math.min(box[0], b[0]); box[1] = Math.min(box[1], b[1]); box[2] = Math.max(box[2], b[2]); box[3] = Math.max(box[3], b[3]);
        }

        // The legend on the gang's sticker in the right column: only the targets of the plan, and
        // only those the level has (Ivan 19.10: «leave only the tasks»): guards, cameras, lasers and
        // the van are on the sheet, not in the legend. A level with the hint: the ring is the
        // valuable loot's; the hint off — the loot has no ring. The sticker starts below the sheet's
        // top right corner: the close button sits there. Laid out to the window (fit) — pinned to the right edge.
        const SM = CoopPlanMap.STICKER_MARGIN, lx = fit ? fit.W - SM - fit.sw + CoopPlanMap.STICKER_IN : Math.max(X(M.W) + SM, right + SM), top = CoopPlanMap.LEGEND_TOP;
        /** @type {string[]} */
        const leg = [];
        let ly = top + CoopPlanMap.LEGEND_HEAD_Y;
        leg.push(text(lx, ly, CoopText.t('plan.sticker'), CoopPlanMap.STICKER_FONT));
        ly += CoopPlanMap.LEGEND_HEAD_GAP;
        /** @type {Array<[string, string, string | null]>} */
        const rows = [];
        const TX = CoopText.t;
        if (marks) rows.push(['23-loot-gem', TX(hintOn ? 'plan.leg_valuable' : 'plan.leg_glass'), hintOn ? 'loot' : null]);
        else rows.push(['23-loot-gem', TX(M.loot.every((/** @type {any} */ l) => l.glass) ? 'plan.leg_glass' : 'plan.leg_loot'), 'loot']);
        if (M.loot.some((/** @type {any} */ l) => l.stand)) rows.push(['33-pedestal', TX('plan.leg_stand'), null]);
        // one panel — as before; two and more — each by its name and what it switches off (rules, section 20)
        if (M.panels.length === 1) rows.push(['12-panel', TX('plan.leg_panel'), 'panel']);
        else for (const p of M.panels) rows.push(['12-panel', TX('plan.leg_panel_of', { panel: p.name.toLowerCase(), what: CoopPlanMap.powersText(M, p) }), 'panel']);
        if (M.doors.some((/** @type {any} */ d) => d.lock && d.lock !== 'electronic')) rows.push(['07-lock', TX('plan.leg_lock'), 'lock']);
        if (M.doors.some((/** @type {any} */ d) => d.sensor)) rows.push(['10-sensor', TX('plan.leg_door_sensor'), 'alarm']);
        if (M.loot.some((/** @type {any} */ l) => l.sensor)) rows.push(['15-vitrine-sensor', TX('plan.leg_vitrine_sensor'), 'alarm']);
        if (M.doors.some((/** @type {any} */ d) => d.panelAt || d.lock === 'electronic')) rows.push(['11-keypad', TX('plan.leg_keypad'), 'gate']);
        const F = CoopPlanMap.LEGEND_FONT;
        let wide = 0;
        for (const [sym, label, kind] of rows) {
            leg.push(use(sym, lx + CoopPlanMap.LEG_ICON_X, ly, sym === '23-loot-gem' ? CoopPlanMap.LEG_GEM : CoopPlanMap.LEG_ICON, sym === '23-loot-gem' ? { fill: MK.loot } : {}));
            if (kind) leg.push(ring(lx + CoopPlanMap.LEG_ICON_X, ly, CoopPlanMap.LEG_RING, kind, label, 'data-legend'));
            leg.push(text(lx + CoopPlanMap.LEG_TEXT_X, ly, label, F, { mid: true }));
            wide = Math.max(wide, CoopPlanMap.LEG_TEXT_X + em(label) * F);
            ly += CoopPlanMap.LEG_ROW;
        }
        ly += CoopPlanMap.LEG_AFTER;
        // the loot the sheet knows, its count, sum and prices, and the money each star takes (Ivan
        // 05.11: «добыча должны быть 6 шт. и их стоимость», «какая сумма на сколько звёзд»); with
        // the hint off — only the count of all: a sum would give away the price of the cheap ones
        const told = M.loot.filter(known), sum = told.reduce((/** @type {number} */ s, /** @type {any} */ l) => s + l.value, 0);
        const total = told.length ? TX('plan.loot_total', { n: told.length, sum: money(sum) }) : TX('plan.loot_count', { n: M.loot.length });
        leg.push(`<g data-kind="loot-sum">` + text(lx, ly, total, CoopPlanMap.BIG_FONT));
        wide = Math.max(wide, em(total) * CoopPlanMap.BIG_FONT);
        if (told.length) {
            ly += CoopPlanMap.LEG_PRICES_GAP;
            const prices = CoopPlanMap.priceList(told.map((/** @type {any} */ l) => l.value).sort((/** @type {number} */ a, /** @type {number} */ b) => b - a));
            leg.push(text(lx, ly, prices, F));
            wide = Math.max(wide, em(prices) * F);
        }
        leg.push(`</g>`);
        const goal = M.stars || [];
        if (goal.length) {
            ly += CoopPlanMap.LEG_STARS_GAP;
            leg.push(`<g data-kind="stars">` + text(lx, ly, TX('plan.stars'), CoopPlanMap.BIG_FONT));
            goal.forEach((/** @type {number} */ v, /** @type {number} */ k) => {
                ly += CoopPlanMap.LEG_STAR_ROW;
                leg.push(text(lx, ly, '★'.repeat(k + 1), CoopPlanMap.STAR_FONT, { attr: `data-star="${k + 1}"`, font: DRAFT, fill: MK.loot, extra: ` stroke="${ink}" stroke-width="${CoopPlanMap.STAR_STROKE}"` }));
                leg.push(text(lx + CoopPlanMap.LEG_STAR_TEXT_X, ly, TX('plan.star_from', { sum: money(v) }), F));
            });
            leg.push(`</g>`);
        }
        ly += CoopPlanMap.LEG_DANGERS_GAP;
        leg.push(`<g data-kind="dangers">` + text(lx, ly, TX('plan.dangers'), CoopPlanMap.HEAD_FONT, { font: DRAFT, fill: MK.threat, extra: ` font-weight="700" letter-spacing="${CoopPlanMap.HEAD_SPACING}"` }));   // keep: font-weight 700 — bold
        ly += CoopPlanMap.LEG_DANGERS_HEAD;
        CoopPlanMap.dangers(M).forEach(([, a, b], i) => {
            leg.push(use(i ? '36-siren' : '35-police', lx + CoopPlanMap.LEG_ICON_X, ly + CoopPlanMap.LEG_DANGER_DOWN, CoopPlanMap.LEG_DANGER_ICON, { fill: MK.threat }));
            leg.push(text(lx + CoopPlanMap.LEG_TEXT_X, ly, a, F, { mid: true }));
            leg.push(text(lx + CoopPlanMap.LEG_TEXT_X, ly + CoopPlanMap.LEG_DANGER_LINE, b, F, { mid: true }));
            wide = Math.max(wide, CoopPlanMap.LEG_TEXT_X + Math.max(em(a), em(b)) * F);
            ly += CoopPlanMap.LEG_DANGER_ROW;
        });
        leg.push(`</g>`);
        // the stamp under the sticker is as wide: the level's title and the scale bar of five cells
        // with its «5 шагов» after the stamp's label column fit in it
        const dw = (/** @type {string} */ t, /** @type {number} */ s) => [...t].reduce((w, ch) => w + (advD[ch] || CoopPlanMap.ADV_MISSING) * s, 0);
        const scale = TX('plan.scale', { n: CoopPlanMap.SCALE_CELLS });
        const stampW = CoopPlanMap.STAMP_COL + Math.max(dw(M.L.title || '', CoopPlanMap.STAMP_FONT), C * CoopPlanMap.SCALE_CELLS + CoopPlanMap.STAMP_SCALE_GAP + dw(scale, CoopPlanMap.STAMP_KEY_FONT)) + CoopPlanMap.STAMP_PAD;
        const sw = Math.ceil(Math.max(CoopPlanMap.LEGEND_W - CoopPlanMap.STICKER_W_CUT, wide + CoopPlanMap.STICKER_PAD, stampW)), sx = lx - CoopPlanMap.STICKER_IN, sh = ly - top - CoopPlanMap.STICKER_BOTTOM;
        add(use('25-sticker', sx + sw / 2 + CoopPlanMap.SHADOW_X, top + sh / 2 + CoopPlanMap.SHADOW_Y, 0, { wh: [sw, sh], fill: ink, op: CoopPlanMap.SHADOW_OP }));
        add(use('25-sticker', sx + sw / 2, top + sh / 2, 0, { wh: [sw, sh], fill: CoopPlanMap.STICKER }));
        add(use('27-tape-' + pick(M.L.id || 't'), sx + CoopPlanMap.STICKER_TAPE_X, top + CoopPlanMap.STICKER_TAPE_Y, CoopPlanMap.STICKER_TAPE, { fill: CoopPlanMap.TAPE, op: CoopPlanMap.TAPE_OP, rot: -CoopPlanMap.STICKER_TAPE_ROT }));
        leg.forEach(add);

        // The drawing's stamp under the sticker: what, where, the scale (5 cells — 5 steps), the sheet;
        // laid out to the window — in the bottom right corner.
        const sr = CoopPlanMap.STAMP_ROW, stw = sw, st = fit ? fit.H - CoopPlanMap.STAMP_BOTTOM - sr * 4 : top + sh + CoopPlanMap.STAMP_GAP;   // keep: the stamp's 4 rows — its head and 3 lines
        add(`<g data-kind="stamp" fill="none" stroke="${ink}" stroke-width="${CoopPlanMap.STAMP_LINE}"><rect x="${sx}" y="${st}" width="${stw}" height="${sr * 4}"/>`   // keep: the stamp's 4 rows — its head and 3 lines
            + [1, 2, 3].map(k => `<line x1="${sx}" y1="${st + sr * k}" x2="${sx + stw}" y2="${st + sr * k}"/>`).join('') + `<line x1="${sx + CoopPlanMap.STAMP_KEY_W}" y1="${st + sr}" x2="${sx + CoopPlanMap.STAMP_KEY_W}" y2="${st + sr * 4}"/></g>`);   // keep: the stamp's 4 rows — its head and 3 lines
        add(text(sx + CoopPlanMap.STAMP_TEXT_X, st + sr / 2, TX('plan.stamp'), CoopPlanMap.STAMP_FONT, { font: DRAFT, mid: true, extra: ' font-weight="700"' }));   // keep: font-weight 700 — bold
        [[TX('plan.stamp_object'), M.L.title || ''], [TX('plan.stamp_scale'), ''], [TX('plan.stamp_sheet'), TX('plan.stamp_sheet_n')]].forEach(([k, v], i) => {
            add(text(sx + CoopPlanMap.STAMP_TEXT_X, st + sr * (i + 1.5), k, CoopPlanMap.STAMP_KEY_FONT, { font: DRAFT, mid: true }));   // keep: the middle of a row of the stamp under its head
            if (v) add(text(sx + CoopPlanMap.STAMP_COL, st + sr * (i + 1.5), v, CoopPlanMap.STAMP_FONT, { font: DRAFT, mid: true }));   // keep: the middle of a row of the stamp under its head
        });
        const bar = sx + CoopPlanMap.STAMP_COL + C * CoopPlanMap.SCALE_CELLS / 2;
        add(use('03-scale', bar, st + sr * 2.5 - CoopPlanMap.SCALE_UP, C, { attr: `data-scale="${CoopPlanMap.SCALE_CELLS}"` })   // keep: the middle of a row of the stamp under its head
            + text(bar + C * CoopPlanMap.SCALE_CELLS / 2 + CoopPlanMap.STAMP_SCALE_GAP, st + sr * 2.5, scale, CoopPlanMap.STAMP_KEY_FONT, { font: DRAFT, mid: true }));   // keep: the middle of a row of the stamp under its head
        const W = fit ? fit.W : sx + sw + SM, H = fit ? fit.H : Math.max(H0, st + sr * 4 + CoopPlanMap.STAMP_BOTTOM);   // keep: the stamp's 4 rows — its head and 3 lines

        // tape on three corners of the sheet (not the top right: the close button)
        add(use('27-tape-' + pick('a'), CoopPlanMap.TAPE_X, CoopPlanMap.TAPE_Y, CoopPlanMap.TAPE_SIZE, { fill: CoopPlanMap.TAPE, op: CoopPlanMap.TAPE_OP, rot: -CoopPlanMap.TAPE_ROT }));
        add(use('27-tape-' + pick('b'), CoopPlanMap.TAPE_X, H - CoopPlanMap.TAPE_Y, CoopPlanMap.TAPE_SIZE, { fill: CoopPlanMap.TAPE, op: CoopPlanMap.TAPE_OP, rot: CoopPlanMap.TAPE_ROT }));
        add(use('27-tape-' + pick('c'), W - CoopPlanMap.TAPE_X, H - CoopPlanMap.TAPE_Y, CoopPlanMap.TAPE_SIZE, { fill: CoopPlanMap.TAPE, op: CoopPlanMap.TAPE_OP, rot: -CoopPlanMap.TAPE_ROT }));

        // The head last: the size is known now, and the defs — only the signs used.
        const defs = [];
        if (embed) {
            const fonts = PLAN_SHEET_ART.fonts;
            defs.push(`<style>@font-face{font-family:plan-hand;src:url(${fonts.hand}) format('woff2')}@font-face{font-family:plan-draft;src:url(${fonts.draft}) format('woff2')}</style>`);
            defs.push(`<pattern id="p-paper" patternUnits="userSpaceOnUse" width="512" height="512"><image href="${PLAN_SHEET_ART.paper}" width="512" height="512"/></pattern>`);   // keep: the set's paper image is 512 px
        }
        defs.push(...pats.values());
        for (const id of used) defs.push(`<symbol id="s-${id}" viewBox="0 0 ${ART[id].w} ${ART[id].h}"${id === '25-sticker' ? ' preserveAspectRatio="none"' : ''}>${ART[id].body}</symbol>`);
        // data-origin — the corner of cell (0, 0): the tests find the cells by it
        const head = [`<svg xmlns="http://www.w3.org/2000/svg" width="${n1(W)}" height="${n1(H)}" viewBox="0 0 ${n1(W)} ${n1(H)}" font-family="${HAND}" data-origin="${n1(X(0))},${n1(Y(0))}">`,
            `<defs>${defs.join('')}</defs>`,
            `<rect width="${W}" height="${H}" fill="${CoopPlanMap.PAPER}"/>`];
        if (embed) head.push(`<rect width="${W}" height="${H}" fill="url(#p-paper)"/>`);
        // the sheet's frame: a double line by its edge
        const fo = CoopPlanMap.FRAME_OUT, fi = CoopPlanMap.FRAME_IN;
        head.push(`<rect x="${fo}" y="${fo}" width="${W - 2 * fo}" height="${H - 2 * fo}" fill="none" stroke="${ink}" stroke-width="${CoopPlanMap.FRAME_OUT_W}"/>`
            + `<rect x="${fi}" y="${fi}" width="${W - 2 * fi}" height="${H - 2 * fi}" fill="none" stroke="${ink}" stroke-width="${CoopPlanMap.FRAME_IN_W}"/>`);
        return { svg: head.concat(out, ['</svg>']).join('\n'), W, H, sw, box, grid: X(0) - box[0], stepsRight: tasks.length ? CoopPlanMap.STEPS_X + stepsW : 0, stepsH, colH: st + sr * 4 + CoopPlanMap.STAMP_BOTTOM };   // keep: the stamp's 4 rows — its head and 3 lines
    },

    // The notes laid out by their objects: each takes the free place nearest to its object — off
    // the other notes, then off the cells of the objects; a leader line to the object.
    /** @param {any} M @param {(s: string) => void} add @param {(s: any) => string} esc @param {any} g @returns {number[] | null} the box of the notes [x0, y0, x1, y1] */
    drawNotes(M, add, esc, g) {
        const { C, X, Y, mid } = g, F = CoopPlanMap.NOTE_FONT, LH = F + 1, ink = CoopPlanMap.INK, n1 = g.n1;
        // the width of a line by the hand font's advances; a char it lacks ~0.6 em, an emoji ~1.1 em
        const adv = PLAN_SHEET_ART.advances.hand;
        const width = (/** @type {string} */ t) => [...t].reduce((w, ch) => w + (adv[ch] || (ch.codePointAt(0) > 0x2000 && !/[–—«»→×½·]/.test(ch) ? CoopPlanMap.ADV_EMOJI : CoopPlanMap.ADV_MISSING)) * F, 0);   // keep: emoji past U+2000
        /** @type {number[][]} */
        const busy = [];   // [x0, y0, x1, y1] of the objects' cells
        const cell = (/** @type {number[]} */ c) => busy.push([X(c[0]), Y(c[1]), X(c[0] + 1), Y(c[1] + 1)]);
        M.loot.forEach((/** @type {any} */ l) => cell(l.at));
        M.panels.forEach((/** @type {any} */ p) => cell(p.at));
        M.doors.forEach((/** @type {any} */ d) => d.cells.forEach((/** @type {number[]} */ c) => cell(c)));
        [...M.van].forEach((/** @type {string} */ k) => cell(k.split(',').map(Number)));
        M.cameras.forEach((/** @type {any} */ c) => cell(c.at));
        M.guards.forEach((/** @type {any} */ q) => (q.patrol || [q.post]).forEach((/** @type {number[]} */ c) => cell(c)));
        // the level itself (Ivan 29.10: «перенеси подсказки за пределы схемы по возможности»)
        /** @type {number[][]} */
        const level = [];
        for (let y = 0; y < M.H; y++) for (let x = 0; x < M.W; x++) if (M.zone[y][x] >= 0) level.push([X(x), Y(y), X(x + 1), Y(y + 1)]);
        const over = (/** @type {number[]} */ a, /** @type {number[]} */ b) =>
            Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
        // how many other objects' cells a leader line passes over (its own cell does not count)
        const crossed = (/** @type {number} */ x0, /** @type {number} */ y0, /** @type {number} */ x1, /** @type {number} */ y1) => {
            let n = 0;
            for (const q of busy) {
                if (x0 >= q[0] && x0 <= q[2] && y0 >= q[1] && y0 <= q[3]) continue;
                for (let i = 1; i <= CoopPlanMap.LEADER_STEPS; i++) {
                    const x = x0 + (x1 - x0) * i / CoopPlanMap.LEADER_STEPS, y = y0 + (y1 - y0) * i / CoopPlanMap.LEADER_STEPS;
                    if (x > q[0] && x < q[2] && y > q[1] && y < q[3]) { n++; break; }
                }
            }
            return n;
        };
        // a segment over a box; two segments crossing
        const hits = (/** @type {number} */ x0, /** @type {number} */ y0, /** @type {number} */ x1, /** @type {number} */ y1, /** @type {number[]} */ q) => {
            for (let i = 1; i < CoopPlanMap.LEADER_STEPS; i++) {
                const x = x0 + (x1 - x0) * i / CoopPlanMap.LEADER_STEPS, y = y0 + (y1 - y0) * i / CoopPlanMap.LEADER_STEPS;
                if (x > q[0] && x < q[2] && y > q[1] && y < q[3]) return true;
            }
            return false;
        };
        const cuts = (/** @type {number[]} */ a, /** @type {number[]} */ b) => {
            const d = (/** @type {number[]} */ p, /** @type {number[]} */ q, /** @type {number[]} */ r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
            const A = [a[0], a[1]], B = [a[2], a[3]], P2 = [b[0], b[1]], Q = [b[2], b[3]];
            return d(A, B, P2) * d(A, B, Q) < 0 && d(P2, Q, A) * d(P2, Q, B) < 0;
        };
        /** @type {number[][]} */
        const leaders = [];
        /** @type {number[][]} */
        const placed = (g.keep || []).slice();   // the places taken before the notes (the tutorial's steps)
        const dirs = Array.from({ length: CoopPlanMap.NOTE_DIRS }, (_, i) => [Math.cos(i * 2 * Math.PI / CoopPlanMap.NOTE_DIRS), Math.sin(i * 2 * Math.PI / CoopPlanMap.NOTE_DIRS)]);
        for (const n of CoopPlanMap.notes(M)) {
            const w = Math.max(...n.lines.map(width)) + CoopPlanMap.NOTE_W_PAD, h = n.lines.length * LH + CoopPlanMap.NOTE_H_PAD;
            let best = null, cost = Infinity, ax = 0, ay = 0;
            for (const at of n.ats || [n.at]) {
                const [cx0, cy0] = mid(at);
                // around the object, and in the margins by the map on its line or column
                /** @type {number[][]} */
                const spots = [];
                for (const d of CoopPlanMap.NOTE_RINGS) {
                    for (const [dx, dy] of dirs) {
                        const cx = cx0 + dx * d * C, cy = cy0 + dy * d * C;
                        spots.push([cx - w / 2 + dx * w / 2, cy - h / 2 + dy * h / 2]);
                    }
                }
                const mg = CoopPlanMap.NOTE_MARGIN, gx0 = X(0) - mg, gx1 = X(M.W) + mg, gy0 = Y(0) - mg, gy1 = Y(M.H) + mg;
                for (let k = -CoopPlanMap.NOTE_MARGIN_SPOTS; k <= CoopPlanMap.NOTE_MARGIN_SPOTS; k++) {
                    spots.push([gx0 - w, cy0 - h / 2 + k * CoopPlanMap.NOTE_MARGIN_DY], [gx1, cy0 - h / 2 + k * CoopPlanMap.NOTE_MARGIN_DY]);
                    spots.push([cx0 - w / 2 + k * CoopPlanMap.NOTE_MARGIN_DX, gy0 - h], [cx0 - w / 2 + k * CoopPlanMap.NOTE_MARGIN_DX, gy1]);
                }
                for (const [x0, y0] of spots) {
                    const b = [x0, y0, x0 + w, y0 + h];
                    const e = CoopPlanMap.NOTE_EDGE;
                    if (b[0] < (g.x0 ?? e) || b[1] < (g.y0 ?? e) || b[2] > g.W - e || b[3] > g.H - e) continue;
                    const ng = CoopPlanMap.NOTE_GAP, gap = [b[0] - ng, b[1] - ng, b[2] + ng, b[3] + ng];   // notes keep apart, not to read as one
                    const px = Math.max(b[0], Math.min(cx0, b[2])), py = Math.max(b[1], Math.min(cy0, b[3]));
                    const k = placed.reduce((s, q) => s + CoopPlanMap.NOTE_COST_NOTE * over(gap, q), 0) + busy.reduce((s, q) => s + CoopPlanMap.NOTE_COST_CELL * over(b, q), 0)
                        + level.reduce((s, q) => s + CoopPlanMap.NOTE_COST_LEVEL * over(b, q), 0) + CoopPlanMap.NOTE_COST_LEADER * Math.hypot(px - cx0, py - cy0) + CoopPlanMap.NOTE_COST_CROSS * crossed(cx0, cy0, px, py)
                        + CoopPlanMap.NOTE_COST_CROSS * placed.filter(q => hits(cx0, cy0, px, py, q)).length + CoopPlanMap.NOTE_COST_CROSS * leaders.filter(l => cuts([cx0, cy0, px, py], l)).length
                        + CoopPlanMap.NOTE_COST_CROSS * leaders.filter(l => hits(l[0], l[1], l[2], l[3], b)).length;
                    if (k < cost) { cost = k; best = b; ax = cx0; ay = cy0; }
                }
            }
            if (!best) continue;
            placed.push(best);
            const [x0, y0, x1, y1] = best, px = Math.max(x0, Math.min(ax, x1)), py = Math.max(y0, Math.min(ay, y1));
            leaders.push([ax, ay, px, py]);
            add(`<g data-note="${esc(n.id)}">`);
            // the note's box, unseen: the tests read it
            add(`<rect x="${n1(x0)}" y="${n1(y0)}" width="${n1(w)}" height="${n1(h)}" fill="none"/>`);
            // the marker's leader, a slight arc from the note to the object's edge, an arrow's tip there;
            // guards and cameras in the threat red, the rest in ink
            const col = /^(guard|camera):/.test(n.id) ? CoopPlanMap.MARK.threat : ink, len = Math.hypot(ax - px, ay - py);
            if (len > C * CoopPlanMap.LEADER_MIN) {
                const ux = (ax - px) / len, uy = (ay - py) / len, tx = ax - ux * C * CoopPlanMap.LEADER_TIP, ty = ay - uy * C * CoopPlanMap.LEADER_TIP;
                const side = g.pick(n.id) === 2 ? -1 : 1, qx = (px + tx) / 2 - uy * len * CoopPlanMap.LEADER_BEND * side, qy = (py + ty) / 2 + ux * len * CoopPlanMap.LEADER_BEND * side;   // keep: the 2nd hand bends the other way
                add(`<path d="M${n1(px)},${n1(py)}Q${n1(qx)},${n1(qy)} ${n1(tx)},${n1(ty)}" fill="none" stroke="${col}" stroke-width="${CoopPlanMap.LEADER_W}" stroke-linecap="round"/>`);
                add(g.use('28-arrow-' + g.pick(n.id), tx, ty, CoopPlanMap.LEADER_ARROW, { fill: col, rot: Math.atan2(ty - qy, tx - qx) * 180 / Math.PI }));
            }
            n.lines.forEach((t, i) => add(g.text(x0 + CoopPlanMap.NOTE_TEXT_X, y0 + CoopPlanMap.NOTE_TEXT_Y + LH * i + F * CoopPlanMap.NOTE_BASELINE, t, F, { fill: col, halo: CoopPlanMap.PAPER })));
            add(`</g>`);
        }
        // the box of the notes with their leaders' ends (none — null)
        const own = placed.slice((g.keep || []).length);
        if (!own.length) return null;
        return [Math.min(...own.map(b => b[0])), Math.min(...own.map(b => b[1])), Math.max(...own.map(b => b[2])), Math.max(...own.map(b => b[3]))];
    },

    /** The sheet as a data: URL for an image element, its fonts and paper inside. @param {any} M @param {{ hint?: boolean, notes?: boolean }} [opts] */
    dataUrl(M, opts) {
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(CoopPlanMap.svg(M, { ...opts, embed: true }));
    }
};
