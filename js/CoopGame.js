// CoopGame.js — the co-op reference level on top of the kit (the default game; the five
// levels of the original are Game.js, opened with ?classic). main.js creates it after the
// location and the camera (window.app.game) and calls update(dt) every frame BEFORE the render.
//
// PLAN: pick a hero (his card on the left), Go on — tap a cell and he walks there (the shortest
// way through doors the plans have open by the time he gets there; none — the hint «дверь
// заперта»); at the bottom — Go, Wait with − and + beside it (Ivan 18.10: Wait says 0 at start
// and a tap lists the plans' events — a door opened, the light off — later than his plan ends;
// a picked one sets the ticks till it; − and + set them by one; a tap on Wait with more than 0
// adds that wait and Wait is 0 again), the special action of his cell
// (it changes with what is next to him), Undo the last press, Clear his plan (Undo brings it
// back) and Ready (asks «Точно готов?»; a ready hero's plan is locked; when all four are ready
// the heist runs — there is no Play button). The card (tall): the icon, the player, below — online and
// ready as icons, the tick his plan ends at, its last step; on the right — the plan log, the plan
// sheet (CoopPlanMap: what is known about the level) and the settings: Wait until the shown
// moment, scrub, speed, the solution, the debug panels.
// HEIST is another phase with its own screen: none of the plan's parts (cards, actions, the plan
// sheet) — the banner with the tick and the alarm, the heist log, the time controls at the
// bottom (back, pause / on, speed, forward) and the settings (debug: back to the plan). A take
// scrubbed back from its end shows the result again when it gets there. The plan shows the
// ghost of the crew (CoopModel with no collisions and no vision), the guards answering the plans.
// PLAY runs CoopModel.simulate once and the scene replays its frames; the camera follows the
// crew. The HUD is fed through UI.get by id; the layout lives in UILayout.js.
// Parts of the class (Game/CLAUDE.md, «Parts of a class»): CoopGamePlan.js — the presses and the
// plans; CoopGameTutorial.js — the hard tutorial and the start windows; CoopGameHint.js — the hint
// under the cursor and «?»; CoopGameTags.js — the signs, loads, timers and action buttons over the
// scene; CoopGameHud.js — the HUD drawn from the state.

class CoopGame {
    // A co-op level from the address: ?level=<id>; no ?level — null. An unknown id or a lab
    // station (those open with ?lab) throws: a typo must not open another level quietly.
    /** @param {string} search */
    static levelFromUrl(search) {
        const m = /[?&]level=([^&]*)/.exec(search);
        if (!m) return null;
        const id = decodeURIComponent(m[1]), L = COOP_LEVELS[id];
        if (!L) throw new Error(CoopText.t('game.level_missing', { id, list: Object.values(COOP_LEVELS).filter(l => !l.lab).map(l => l.id).join(', ') }));
        if (L.lab) throw new Error(CoopText.t('game.level_is_lab', { id }));
        return id;
    }

    // The game mode from the address: &mode=coop or &mode=single (the main screen's Кооператив
    // and Кампания); none or another word — null (CoopGame.START_MODE).
    /** @param {string} search @returns {'single' | 'coop' | null} */
    static modeFromUrl(search) {
        const m = /[?&]mode=(coop|single)\b/.exec(search);
        return m ? /** @type {'single' | 'coop'} */ (m[1]) : null;
    }

    // Day or night over the level's own (the walls' picture stand, CoopStand): &night=1 — night, &night=0 — day;
    // none — null, the level's field night. The scene only: the model has no night.
    /** @param {string} search @returns {boolean | null} */
    static nightFromUrl(search) {
        const m = /[?&]night=([01])(?:&|$)/.exec(search);
        return m ? m[1] === '1' : null;
    }

    // A level of the campaign (the main screen's Кампания): &campaign=1 — its won takes go to the
    // player's profile (Profile.js); a level from the desktop scene menu is not.
    /** @param {string} search */
    static campaignFromUrl(search) {
        return /[?&]campaign=1(?:&|$)/.test(search);
    }

    // A take into the profile: a won take of a campaign level keeps the level's best (Profile.record).
    /** @param {string} id @param {any} r @param {any} o CoopModel.outcome; single player — null @param {boolean} campaign */
    static recordTake(id, r, o, campaign) {
        if (!campaign || !CoopGame.won(r, o)) return;
        const p = Profile.load();
        Profile.record(p, id, r.money);
        Profile.save(p);
    }

    // Where «Завершить» on the result goes: after a won take (CoopGame.won) the next ladder level in
    // the same mode and campaign, the main screen ('') when there is none; a lost take — null (grey).
    /** @param {string} id @param {boolean} won @param {string} mode @param {boolean} campaign */
    static finishTarget(id, won, mode, campaign) {
        if (!won) return null;
        const next = MainMenu.next(id);
        return next ? MainMenu.address(next, mode, campaign) : '';
    }

    /** @param {{ location: Location3D, camera: CameraController }} app */
    // menu (optional) — the main screen's background (COOP_MENU, CoopGameMenu.js): the level is its copy
    // with the gang, staged as a still scene with the signs of the level's solution.
    /** @param {any} app @param {any} [menu] */
    constructor(app, menu) {
        this.app = app;
        this.menu = menu || null;
        this.c = CoopGame.cfg();
        // ?lab — the mechanics lab: a station level, its knobs set before the model is made
        const labId = CoopLab.levelFromUrl();
        if (labId) CoopLab.applyStored();
        this.labId = labId;
        this.M = this.menu ? CoopGame.menuModel(this.menu) : CoopModel.create(labId || CoopGame.levelFromUrl(window.location.search) || undefined);
        /** @type {any[] | null} the plan's signs of the menu's background (CoopGame.menuSigns), over the level as it is */
        this.menuGhosts = this.menu ? CoopGame.menuSigns(CoopModel.create(this.menu.level), this.menu.signs, this.menu.signs_until) : null;
        this.c.townZoom = CoopGame.townZoom(this.c, CoopScene.TOWN_VIEW);
        if (!this.menu) this.c.night = CoopGame.nightFromUrl(window.location.search);
        this.scene = new CoopScene(app.location, this.M, this.c);
        // Rejected character models (the files load after this line) — a warning on screen.
        this.scene.onModelIssue = (lines) => {
            const el = UI.get('modelWarn');
            if (el) { el.setText(lines.join('\n')); el.show(true); }
        };
        this.speeds = [1, CoopGame.SPEED_2, CoopGame.SPEED_3];
        this.speedIdx = 0;
        this.fast = false;                // the take plays a tick where nobody moves (playRate)
        this.actIds = [];
        this.ghostIds = [];                          // the plan's signs: [[id, …] per cell of scene.ghosts]
        this.waitN = this.c.waitTicks;               // the ticks written on Wait (0 — a tap lists events)
        this.waitIds = [];                           // the open list of events over Wait
        /** @type {number | null} */
        this.heroAt = null;                          // the hero whose window is open (showHero)
        this.ready = this.M.heroes.map(() => false);
        this.plans = this.M.heroes.map(() => []);
        this.history = this.M.heroes.map(() => []);
        this.sel = 0;
        this.mode = 'plan';
        this.gameMode = CoopGame.modeFromUrl(window.location.search) || CoopGame.START_MODE;   // 'single' | 'coop' (Ivan 19.10): rules and screens differ a little
        this.campaign = CoopGame.campaignFromUrl(window.location.search);   // a level of the campaign: its won takes count
        this.taskStars = CoopGame.TASK_STARS;        // co-op: the tasks are for this goal in stars (rules, section 13)
        this.hintOn = CoopGame.HINT_ON;              // the valuable loot lit in the hall and on the sheet (rules, section 15)
        this.run = null;
        this.outro = 0;              // seconds played of the van driving off at the end of a take
        /** @type {number | null} */
        this.intro = null;           // seconds played of the van's drive in at the start (rules, section 35); null — none
        this.introHold = false;      // a level but the tutorial: the drive in waits on its first frame under the start sheet
        /** @type {((e: any) => void) | null} */
        this.introEat = null;        // its capture of the presses (introInput) and where it listens
        /** @type {any} */
        this.introOn = null;
        this.planT = null;
        this.bindHud();
        this.attachInput(World3D.canvas);
        this.frameLevel();
        this.showResult(null);
        this.refresh();
        this.startIntro();
        this.lab = labId ? new CoopLab(this) : null;
        /** @type {CoopStand | null} */
        this.stand = null;           // the walls' picture stand (F2; main.js opens it on a level)
        if (this.lab) this.solution();
        if (this.menu) this.stageMenu();
    }

    // The lab changed a number of the model: the plan view is recomputed, a take starts over.
    retune() {
        if (this.mode === 'run') { this.mode = 'plan'; this.play(); } else this.refresh();
    }

    // The Overcooked camera: high and steep, close enough that the level is bigger than the
    // screen; it follows the focus (the selected hero in the plan, the crew in a take).
    frameLevel() {
        const cam = this.app.camera;
        cam.home();
        this.fit();
        cam.setArea(this.scene.cameraArea(this.c.cameraPad));
        cam.follow(this.scene.focus);
    }

    // One camera distance on every level (Ivan 07.11: «на всех уровнях зафиксируем положение камеры как
    // на уровне 1 — не надо от размера уровня менять удаление камеры»): the zoom at which level 1
    // (CoopGame.firstLevel) fills the free band (the window less COOP_FIT_TOP_PX / BOTTOM_PX; now the
    // whole), times COOP_ZOOM (the config: 1 — level 1 fills the window). A level that fits at it
    // (level 1 at COOP_ZOOM ≤ 1) is held whole and still (fitted); a bigger one — the camera follows
    // the focus. Again on resize.
    fit() {
        const cv = World3D.canvas, W = (cv && cv.clientWidth) || CoopGame.SCREEN_W, H = (cv && cv.clientHeight) || CoopGame.SCREEN_H;
        const s = UI.scale(), top = this.c.fitTop * s, bottom = this.c.fitBottom * s;
        const cam = this.app.camera, one = CoopGame.firstLevel() || this.M;
        const at = (/** @type {{ W: number, H: number }} */ L, /** @type {number} */ zoom = 0) => CoopGame.fitZoom({
            wPx: L.W * this.c.cellPx, hPx: L.H * this.c.cellPx, wallPx: this.c.wallH, zoom,
            freeW: W, freeH: H - top - bottom, screenH: H, fovDeg: cam.c.fov, pitchDeg: cam.c.pitch, margin: this.c.fitMargin
        });
        this.zoom = at(one).zoom * this.c.zoom;
        this.fitted = at(this.M).zoom >= this.zoom - 1e-9;
        const f = at(this.M, this.zoom);
        cam.zoomTarget = cam.zoom = this.zoom;
        // Screen px (up) the level's middle has to rise to stand in the middle of the free band.
        this.fitRise = this.fitted ? (bottom - top) / 2 - (f.box.top + f.box.bottom) / 2 : 0;
        this.fitSize = W + 'x' + H;
    }

    // The zoom at which a level of wPx × hPx world px (walls wallPx high) seen by the camera
    // (fov, pitch; screenH CSS px tall) fills margin of a freeW × freeH screen band; box — its
    // size on screen at that zoom: width and the top/bottom edges, px up from the look-at point.
    // dist = F / zoom, F = screenH / (2·tan(fov/2)) (CameraControl.distance); a ground point
    // y px beyond the look-at point and h px high is at depth dist + y·cos p − h·sin p.
    // o.zoom given — no search: the box at that zoom.
    /** @param {{ wPx: number, hPx: number, wallPx: number, freeW: number, freeH: number, screenH: number, fovDeg: number, pitchDeg: number, margin: number, zoom?: number }} o */
    static fitZoom(o) {
        const p = o.pitchDeg * Math.PI / 180, F = o.screenH / (2 * Math.tan(o.fovDeg * Math.PI / 360));
        const box = (/** @type {number} */ z) => {
            let w = 0, top = -Infinity, bottom = Infinity;
            for (const y of [-o.hPx / 2, o.hPx / 2]) {
                for (const h of [0, o.wallPx]) {
                    const k = F / (F / z + y * Math.cos(p) - h * Math.sin(p));
                    const up = (y * Math.sin(p) + h * Math.cos(p)) * k;
                    w = Math.max(w, o.wPx * k);
                    top = Math.max(top, up);
                    bottom = Math.min(bottom, up);
                }
            }
            return { w, top, bottom };
        };
        const fits = (/** @type {number} */ z) => {
            const b = box(z);
            return b.w <= o.freeW * o.margin && b.top - b.bottom <= o.freeH * o.margin;
        };
        if (o.zoom) return { zoom: o.zoom, box: box(o.zoom) };
        let lo = CoopGame.FIT_ZOOM_MIN, hi = CoopGame.FIT_ZOOM_MAX;
        for (let i = 0; i < CoopGame.FIT_STEPS; i++) {
            const mid = (lo + hi) / 2;
            if (fits(mid)) lo = mid; else hi = mid;
        }
        return { zoom: lo, box: box(lo) };
    }

    // Where a ground point dx, dy world px (east, south) off the camera's look-at point stands on a screenW ×
    // screenH screen, CSS px from its top left — the camera of fitZoom (north up, fov, pitch, zoom): the look-at
    // point in the middle; y px beyond it (north) is at depth dist + y·cos p, as in fitZoom with h = 0.
    /** @param {{ dx: number, dy: number, zoom: number, screenW: number, screenH: number, fovDeg: number, pitchDeg: number }} o */
    static toScreen(o) {
        const p = o.pitchDeg * Math.PI / 180, F = o.screenH / (2 * Math.tan(o.fovDeg * Math.PI / 360)), y = -o.dy;
        const k = F / (F / o.zoom + y * Math.cos(p));
        return { x: o.screenW / 2 + o.dx * k, y: o.screenH / 2 - y * Math.sin(p) * k };
    }

    // The tutorial's camera (rules, section 27, «Охота за багами 12.11»): the shift of the look-at point, world
    // px (east, south), that puts the ground point dx, dy off it (toScreen) onto the edge of the free part of the
    // screen — o.free: CSS px kept off at each side; inside it — none. Bands wider than the screen — the point
    // goes midway between them.
    /** @param {{ dx: number, dy: number, zoom: number, screenW: number, screenH: number, fovDeg: number, pitchDeg: number, free: { left: number, right: number, top: number, bottom: number } }} o */
    static seeShift(o) {
        const p = o.pitchDeg * Math.PI / 180, F = o.screenH / (2 * Math.tan(o.fovDeg * Math.PI / 360)), dist = F / o.zoom;
        const sp = Math.sin(p), cp = Math.cos(p), fr = o.free;
        const fit = (/** @type {number} */ v, /** @type {number} */ lo, /** @type {number} */ hi) => lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v));
        // up — screen px above the middle of a point y px beyond the look-at point, and back
        const up = (/** @type {number} */ y) => y * sp * F / (dist + y * cp), beyond = (/** @type {number} */ u) => u * dist / (F * sp - u * cp);
        const y = -o.dy, u = up(y), u2 = fit(u, fr.bottom - o.screenH / 2, o.screenH / 2 - fr.top);
        const y2 = u2 === u ? y : beyond(u2), k = F / (dist + y2 * cp);
        const r = o.dx * k, r2 = fit(r, fr.left - o.screenW / 2, o.screenW / 2 - fr.right);
        return { x: r2 === r ? 0 : o.dx - r2 / k, y: y2 - y };
    }

    // The game zoom on a screen V ({ h, aspect }, CoopScene.TOWN_VIEW) — the frame the town round
    // the level is laid for (CoopScene.townRect): level 1 fills it, times COOP_ZOOM (as fit).
    /** @param {any} c CoopGame.cfg() @param {{ h: number, aspect: number }} V */
    static townZoom(c, V) {
        const one = CoopGame.firstLevel();
        if (!one) return c.zoom;
        return CoopGame.fitZoom({
            wPx: one.W * c.cellPx, hPx: one.H * c.cellPx, wallPx: c.wallH, freeW: V.h * V.aspect, freeH: V.h, screenH: V.h,
            fovDeg: CAMERA_FOV_DEG, pitchDeg: CAMERA_PITCH_DEG,
            margin: c.fitMargin
        }).zoom * c.zoom;
    }

    // Level 1 — the first by order of the levels (not the lab stations): { W, H } in cells; null — none.
    static firstLevel() {
        const L = Object.values(COOP_LEVELS).filter((/** @type {any} */ l) => !l.lab && l.order != null)
            .sort((/** @type {any} */ a, /** @type {any} */ b) => a.order - b.order)[0];
        if (!L) return null;
        const c = CoopGame.FIRST;
        if (c.id !== L.id) { const M = CoopModel.create(L.id); Object.assign(c, { id: L.id, W: M.W, H: M.H }); }
        return c;
    }

    // --- Plans (CoopGamePlan.js) --------------------------------------------------------

    // Why a press is not added (rules, section 23): hero k's plan ends past the ceiling L
    // (CoopModel.limit, CoopModel.lateBy), and the ceiling.
    /** @param {any} M @param {any} L @param {number} k */
    static lateText(M, L, k) {
        return CoopText.t('game.late', { why: CoopGame.lateWhy(M, L, k) });
    }
    // The same without «не добавлено»: the hover's «Клик: не добавится — …».
    /** @param {any} M @param {any} L @param {number} k */
    static lateWhy(M, L, k) {
        const clock = CoopGame.clock;
        return CoopText.t(L.police ? 'game.late_police' : 'game.late_patrol', { who: M.heroes[k].fruit, end: clock(L.ends[k]), t: clock(L.t), alarm: clock(L.alarmT), why: L.why });
    }

    // --- Input -----------------------------------------------------------------------

    attachInput(canvas) {
        if (!canvas) return;
        // the menu over the level (the settings, the main screen) takes Esc itself (MainMenu.escape)
        window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !e.repeat && !(typeof MainMenu !== 'undefined' && MainMenu.busy())) this.escape(); });
        const presses = new Map();
        canvas.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            presses.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), multi: presses.size > 0 });
            if (presses.size > 1) for (const p of presses.values()) p.multi = true;
        });
        const up = (e) => {
            const p = presses.get(e.pointerId);
            presses.delete(e.pointerId);
            if (!p || p.multi || e.type === 'pointercancel') return;
            if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > CoopGame.TAP_SLOP_PX || performance.now() - p.t > CoopGame.TAP_MAX_MS) return;
            const r = canvas.getBoundingClientRect();
            this.onTap(e.clientX - r.left, e.clientY - r.top);
        };
        canvas.addEventListener('pointerup', up);
        canvas.addEventListener('pointercancel', up);
        // the hint over an object (rules, section 26): a mouse with no button down; a drag of the
        // camera, a finger and the pointer off the canvas (onto a button) — none
        canvas.addEventListener('pointermove', (e) => {
            if (e.pointerType !== 'mouse' || e.buttons !== 0) { this.hideHover(); return; }
            const r = canvas.getBoundingClientRect();
            this.onHover(e.clientX - r.left, e.clientY - r.top, e.clientX, e.clientY);
        });
        canvas.addEventListener('pointerdown', () => this.hideHover());
        canvas.addEventListener('pointerleave', () => this.hideHover());
    }

    onTap(px, py) {
        if (this.mode !== 'plan') return;
        // a step of the tutorial on a cell takes the floor under an object too (a vitrine's model over the cell by it)
        const step = this.tutStep(), floor = !!step && step.do === 'cell';
        const obj = !floor && this.scene.pickObject ? this.scene.pickObject(px, py) : null;   // rules, section 25
        // a tutorial step's tap with a cell only walks there (rules, section 27, «шаг 7»)
        const walk = () => { const c = CoopTutorial.walkCell(this.tutStep()); if (c) this.walkTo(c[0], c[1]); else this.tapObject(obj); };
        if (obj) { this.tutPress({ do: 'tap', obj }, walk); this.rehover(); return; }
        const cell = this.scene.pickCell(px, py);
        if (cell) this.tutPress({ do: 'cell', at: [cell.x, cell.y] }, () => this.walkTo(cell.x, cell.y));
    }

    // --- The hard tutorial (CoopGameTutorial.js) -----------------------------------------

    // The tip of the tutorial's hero card: the row «окно героя» of the sheet «Обучение» (rules, section 33), {name}
    // and {skill} — the hero's name and skill word (section 29; Ivan 13.11); a hero without a skill — an empty word.
    // No row — null: no plate on the card.
    /** @param {any} L @param {any} h @returns {string|null} */
    static heroTip(L, h) {
        const t = L.tutorial_tips && L.tutorial_tips.hero;
        return typeof t === 'string' ? CoopText.fill(t, { name: h.fruit, skill: CoopGame.skillWord(h) }) : null;
    }

    // A hero's skill in one word of the texts — the same in his window, his hover tag and the tutorial's tip
    // (rules, section 29; Ivan 13.11: «берём его из локализации везде»); none — empty.
    /** @param {any} h @returns {string} */
    static skillWord(h) {
        return h.skill ? CoopText.t('game.skill_' + h.skill) : '';
    }

    // Is a blink lit t seconds after it began: period (CoopGame.BLINK_S) a period, lit its first half.
    /** @param {number} t @param {number} [period] */
    static blinkLit(t, period = CoopGame.BLINK_S) {
        return t % period < period / 2;
    }

    // A target's own outline blinking (rules 34, Ivan 18.11: «Мигает белая обводка как это сделано для таймера»):
    // lit — its look's white, else its fill: the outline goes out in the element. No element — nothing.
    /** @param {any} el @param {boolean} lit */
    static outlineBlink(el, lit) {
        if (el) el.setOutline(lit ? null : el.fillColor() || null);
    }

    // The police timer's warning at left ticks (rules, section 14; Ivan 12.11): from TIMER_WARN_S left a step
    // of red every TIMER_WARN_STEP_S (k — the step of all, 0 none), from TIMER_BLINK_LEFT_S its outline blinks.
    /** @param {number} left */
    static timerWarn(left) {
        const W = CoopGame.TIMER_WARN_S, step = CoopGame.TIMER_WARN_STEP_S, steps = Math.max(1, Math.ceil(W / step));
        const n = left > W ? 0 : Math.min(steps, Math.floor((W - left) / step) + 1);
        return { k: n / steps, blink: left <= CoopGame.TIMER_BLINK_LEFT_S };
    }

    // The timer panel's fill at warning k: null — the look's; from the first step — the threat's colour (rules,
    // section 34: no shades in between, they would leave the palette).
    /** @param {number} k */
    static timerFill(k) {
        return k > 0 ? CoopGame.TIMER_RED : null;
    }

    // --- Ready, the heist and its take ------------------------------------------------

    bindHud() {
        this.buildLoadTags();
        // the red lines of the log (an alarm): copies of log0 … over them
        for (let i = 0; i < CoopGame.LOG_LINES; i++) {
            const d = UI.def('log' + i);
            if (d && !UI.get('logRed' + i)) UI.add(Object.assign({}, d, { id: 'logRed' + i, color: CoopGame.LOG_RED, text: '', visible: 0 }));
            // the advice's line: the plate's text (rules, section 34)
            if (d && !UI.get('logAsk' + i)) UI.add(Object.assign({}, d, { id: 'logAsk' + i, text: '', visible: 0 }));
            // the tutorial's ✓ of a step done (rules, section 27) over the line's own, in the colour of the hero who did
            // the step (section 34; renderHud recolours it by the line)
            if (d && !UI.get('logOk' + i)) UI.add(Object.assign({}, d, { id: 'logOk' + i, color: cssColor(this.M.heroes[0].color), text: '', visible: 0 }));
        }
        // the frame round each hero's last line of the plan's log (Ivan 23.10), in his palette color (heroes.json color)
        const mt = UI.def('logMarkTpl');
        if (mt) this.M.heroes.forEach((h, k) => {
            if (!UI.get('logMark' + k)) UI.add(Object.assign({}, mt, { id: 'logMark' + k, border: cssColor(h.color), visible: 0 }));
        });
        // the bar between two log lines where a hero's plan ends among other heroes' lines (Ivan 24.10):
        // one panel per hero and per share of the line's width (n heroes on one border), w = full / n
        const bt = UI.def('logBarTpl'), nH = this.M.heroes.length;
        if (bt) this.M.heroes.forEach((h, k) => {
            for (let n = 1; n <= nH; n++) if (!UI.get('logBar' + k + '_' + n)) {
                UI.add(Object.assign({}, bt, { id: 'logBar' + k + '_' + n, w: bt.w / n, fill: cssColor(h.color), visible: 0 }));
            }
        });
        this.buildWorkTags();
        this.toggles = PanelToggles.bind(PanelToggles.COOP);
        // the hard tutorial (rules, section 27): its steps, null — a level without one
        this.tutSteps = CoopTutorial.steps(this.M.L);
        this.tutK = 0;
        this.tutEnds = [];
        // the debug panel (Ivan 08.11); the gear — the settings window. Not in the tutorial: its Wait,
        // Example, Play, mode and the sheet's levels would go round the steps.
        if (!this.tutSteps && !MainMenu.demo()) PanelToggles.hotkey('F2', 'setPanel');   // no debug panel in the tutorial and the demo (rules 38)
        else { const p = UI.get('setPanel'); if (p) p.show(false); }
        const on = (id, fn) => {
            const el = UI.get(id);
            if (el) el.onClick(this.tutSteps && CoopGame.TUT_OFF.includes(id) ? () => {} : fn);
        };
        const show = (id, v) => { const el = UI.get(id); if (el) el.show(v); };
        // A tap on a hero's card (rules, section 29; Ivan 10.11: «Клик по персонажу не открывает окно персонажа»): his
        // window, on any level and in the tutorial; in the plan it picks him too (the tutorial has one hero).
        for (let i = 0; i < CoopGame.HERO_CARDS; i++) on('heroPick' + i, () => {
            if (i >= this.M.heroes.length) return;
            if (this.mode === 'plan' && !this.tutSteps) { this.sel = i; this.planT = null; this.waitN = 0; this.refresh(); }
            this.showHero(i);
        });
        // The gear: the settings window over the level; the take stands still while it is open.
        on('btnSettings', () => {
            const was = this.playing;
            this.playing = false;
            MainMenu.openSettings(() => { this.playing = was; this.renderHud(); });
        });
        on('actWait', () => {
            if (this.mode !== 'plan' || this.ready[this.sel]) return;
            if (this.waitN <= 0) { this.openWaitList(!this.waitIds.length); return; }
            const n = this.waitN;
            this.waitN = 0;
            this.push([{ op: 'wait', ticks: n }]);
        });
        on('actWaitLess', () => this.setWait(this.waitN - 1));
        on('actWaitMore', () => this.setWait(this.waitN + 1));
        // the tutorial: live on its step «Отменить» only (rules, section 32), as a step's press
        on('actUndo', () => { if (this.mode === 'plan') this.tutPress({ do: 'undo' }, () => this.undo()); });
        on('tipNext', () => this.tutNote());
        on('btnUntil', () => this.push([{ op: 'until', tick: this.viewT() }]));
        on('actClear', () => { if (this.mode === 'plan') this.clear(); });
        on('btnBack', () => this.scrub(-this.c.scrubTicks));
        on('btnFwd', () => this.scrub(this.c.scrubTicks));
        // Ready: the selected hero's plan is done — after «Да» it is locked; all four — the heist.
        // Single player (Ivan 19.10): Ready is «start the heist», asked once against a misclick.
        on('actReady', () => {
            if (this.mode !== 'plan') return;
            if (this.tutSteps && !CoopTutorial.matches(this.M, this.tutStep(), { do: 'start' })) return;
            if (this.gameMode !== 'coop') { if (!this.startWhy()) this.askReady(true); return; }
            if (this.ready[this.sel]) this.setReady(this.sel, false); else this.askReady(true);
        });
        on('confirmYes', () => {
            this.askReady(false);
            if (this.gameMode !== 'coop') this.play(); else this.setReady(this.askFor, true);
        });
        on('confirmNo', () => this.askReady(false));
        on('confirmDim', () => this.askReady(false));     // a tap beside the window is «Нет»
        on('confirmBox', () => {});                       // a tap on the window itself is nothing
        on('btnPlan', () => this.toPlan());
        on('runBack', () => this.scrub(-this.c.scrubTicks));
        on('runPause', () => { if (this.mode === 'run') { this.playing = !this.playing; this.renderHud(); } });
        on('runFwd', () => this.scrub(this.c.scrubTicks));
        on('runSpeed', () => this.nextSpeed());
        on('btnSpeed', () => this.nextSpeed());
        on('btnDemo', () => this.solution());
        on('btnGameMode', () => this.setGameMode(this.gameMode === 'coop' ? 'single' : 'coop'));
        // the goal of the tasks 1★ → 2★ → 3★ → 1★; the plan stays (rules, section 13)
        on('btnTaskStars', () => { this.taskStars = this.taskStars % this.M.stars.length + 1; this.renderHud(); });
        // the hint of the valuable loot (rules, section 15): the hall's glow and the sheet redrawn
        on('btnHint', () => { this.hintOn = !this.hintOn; this.mapDrawn = false; this.renderHud(); });
        on('btnSheet', () => this.levelsFromSheet());
        on('btnSavePlan', () => this.savePlan());
        on('btnLoadPlan', () => this.loadPlan());
        // The result window (Ivan 08.11): finish — the next level, replay — an empty plan, watch —
        // the take from its first tick; «Выйти» — MainMenu.bindBack.
        on('resultFinish', () => {
            const q = CoopGame.finishTarget(this.M.L.id, CoopGame.won(this.run, this.outcome(this.run)), this.gameMode, this.campaign);
            if (q !== null) MainMenu.go(q);
        });
        on('resultReplay', () => this.restart());
        on('resultWatch', () => this.watch());
        // The plan sheet: drawn from the level once (again after the hint is switched), shown over everything.
        on('btnMap', () => this.showMap(true));
        on('btnAsk', () => this.askAdvice());
        on('mapClose', () => this.closeMap());
        on('mapDim', () => this.closeMap());
        on('mapBox', () => {});
        // The hero's card (rules, section 29): «i» on his card on the left; ✕ or a tap beside it closes.
        for (let i = 0; i < CoopGame.HERO_CARDS; i++) on('heroInfo' + i, () => { if (i < this.M.heroes.length) this.showHero(i); });
        on('heroClose', () => this.showHero(null));
        on('heroDim', () => this.showHero(null));
        on('heroBox', () => {});
        // The classic game's parts: its level buttons, the crew and action panels, the clock;
        // the co-op has its own cards, actions and log.
        for (let i = 1; i <= CoopGame.CLASSIC_LEVELS; i++) show('lvl' + i, false);
        // the level panel only repeated the name over the screen (Ivan 05.11, the screenshot: struck out)
        for (const id of ['tglInfo', 'topPanel', 'tglLog', 'tglCrew', 'tglAct', 'btnWait', 'btnPlay', 'crewPanel', 'actPanel', 'clockPanel']) show(id, false);
        show('logPanel', true);
    }

    // The «Точно готов?» window for the selected hero.
    /** @param {boolean} on */
    askReady(on) {
        if (on) this.askFor = this.sel;
        const h = this.M.heroes[this.sel], left = this.ready.filter(r => !r).length - 1;
        const set = (id, s) => { const el = UI.get(id); if (el) el.setText(s); };
        if (this.gameMode !== 'coop') {
            set('confirmTitle', CoopText.t('game.confirm_single_title'));
            set('confirmText', CoopText.t('game.confirm_single_text'));
        } else {
            set('confirmTitle', CoopText.t('game.confirm_coop_title'));
            set('confirmText', CoopText.t(left > 0 ? 'game.confirm_coop_wait' : 'game.confirm_coop_last',
                { who: h.fruit, t: CoopGame.clock(this.ends ? this.ends[this.sel] : 0), left }));
        }
        const dim = UI.get('confirmDim');
        if (dim) dim.show(on);
        const box = UI.get('confirmBox');           // beside the dim, not in it: its alpha would dim the window
        if (box) box.show(on);
        this.tutView();
    }

    // A hero is ready (or not any more); when the whole crew is ready, the take starts.
    /** @param {number} i @param {boolean} on */
    setReady(i, on) {
        this.ready[i] = on;
        if (on && this.ready.every(Boolean)) { this.play(); return; }
        this.refresh();
    }

    /** @param {boolean} on */
    showMap(on) {
        const img = UI.get('mapImg');
        if (on && img && !this.mapDrawn) { img.setImage(CoopPlanMap.dataUrl(this.M, { hint: this.hintOn })); this.mapDrawn = true; }
        for (const id of ['mapDim', 'mapBox']) {     // the sheet beside the dim, not in it: opaque
            const el = UI.get(id);
            if (el) el.show(on);
        }
        if (!on) {
            this.mapStartT = null;                   // only the sheet of the start blinks (rules, section 28)
            // the tutorial's start sheet closed — the hero's card (rules, section 29), once
            if (this.heroStart) { this.heroStart = false; this.showHero(0, true); return; }
        }
        this.tipView();
    }

    scrub(dt) {
        if (this.mode === 'plan') {
            this.planT = Math.max(0, Math.min(this.view.frames.length - 1, this.viewT() + dt));
        } else if (this.run) {
            const end = this.run.frames.length - 1;
            this.rt = Math.max(0, Math.min(end, this.rt + dt));
            // short of the end the result is gone and comes again at the end
            if (this.rt < end) { this.shown = false; this.outro = 0; this.showResult(null); }
        }
        this.renderHud();
    }

    play() {
        if (this.mode === 'run') return;
        if (this.intro != null) this.endIntro(true, false);
        this.clearAsk();
        this.showMap(false);
        this.askReady(false);
        this.run = this.M.simulate(this.plans);
        this.mode = 'run';
        if (this.tutSteps) this.tutK = this.tutSteps.length;
        this.hideHover();
        this.rt = 0;
        this.outro = 0;
        this.playing = true;
        this.shown = false;
        this.startSpeed();
        this.scene.policeAt = this.M.arrival(this.run.alarmT).t;
        this.scene.routes = [];
        this.scene.ghosts = [];
        this.scene.selRing = null;
        this.buildGhostTags();
        this.clearActions();
        this.openWaitList(false);
        this.renderHud();
        this.tutView();
    }

    // Ivan 19.10: single player and co-op are switched in the settings; a switch drops all the
    // planning to zero — plans, undo, ready, Wait, the take — and nothing is kept anywhere.
    /** @param {string} m */
    setGameMode(m) {
        if (m === this.gameMode) return;
        this.gameMode = m;
        this.restart();
    }

    // The level again from an empty plan (Ivan 08.11, «Переиграть» on the result): plans, undo,
    // ready, Wait and the take dropped.
    restart() {
        this.endIntro(true, false);                  // the game shuts the start: the van stands, no drive in (section 35)
        this.heroStart = false;
        this.showHero(null);
        this.showMap(false);
        this.askReady(false);
        this.plans = this.M.heroes.map(() => []);
        this.history = this.M.heroes.map(() => []);
        this.sel = 0;
        this.waitN = 0;
        this.planT = null;
        this.tutK = 0;
        this.tutEnds = [];
        this.toPlan();
        this.openStartMap();
    }

    // A heist starts at the speed the player last chose with ⏩, from level to level (Store CoopGame.SPEED_KEY);
    // none chosen or not in the list any more — at the fastest (rules, section 23; Ivan 12.11).
    startSpeed() {
        const k = this.speeds.indexOf(Number(Store.get(CoopGame.SPEED_KEY)));
        this.speedIdx = k >= 0 ? k : this.speeds.indexOf(Math.max(...this.speeds));
    }

    // ⏩: the next speed, remembered for the next heists.
    nextSpeed() {
        this.speedIdx = (this.speedIdx + 1) % this.speeds.length;
        Store.set(CoopGame.SPEED_KEY, String(this.speeds[this.speedIdx]));
        this.renderHud();
    }

    // The take again from its first tick (Ivan 08.11, «Просмотреть» on the result): the heist phase,
    // not the plan; at its end the result comes again.
    watch() {
        if (!this.run) return;
        this.mode = 'run';
        this.rt = 0;
        this.outro = 0;
        this.shown = false;
        this.playing = true;
        this.startSpeed();
        this.showResult(null);
        this.renderHud();
    }

    // The co-op outcome of a take for the goal in stars; single player — null.
    /** @param {any} r */
    outcome(r) {
        return this.gameMode === 'coop' ? this.M.outcome(r, this.taskStars) : null;
    }

    toPlan() {
        this.mode = 'plan';
        this.ready = this.M.heroes.map(() => false);
        this.run = null;
        this.outro = 0;
        this.scene.policeAt = null;
        this.showResult(null);
        this.refresh();
    }

    // --- State to view (the tags — CoopGameTags.js, the HUD — CoopGameHud.js) ---------

    // The tick the plan view shows: the scrubbed one or the end of the selected hero's plan with
    // the ticks set on Wait (Ivan 19.10: they move the view just as a walk does).
    viewT() {
        if (this.planT != null) return this.planT;
        return (this.ends ? this.ends[this.sel] : 0) + this.pendingWait();
    }

    // The ticks on Wait not added yet: they count in the view only while the hero can plan.
    pendingWait() {
        return this.mode === 'plan' && !(this.ready && this.ready[this.sel]) ? this.waitN : 0;
    }

    // The frame of the plan view: the ghost run with the ticks set on Wait.
    planFrame() {
        const F = this.view.frames;
        return F[Math.min(F.length - 1, this.viewT())];
    }

    // The selection ring of a single game (Ivan 21.10 evening): who is selected and where he is; in co-op each plays his
    // own hero; none while the van drives in (rules, section 35; Ivan 17.11: the ring stood at the van's place).
    selRingOf() {
        return this.gameMode === 'coop' || this.menu || this.intro != null ? null : { hero: this.sel, mark: this.M.heroes[this.sel].mark };
    }

    // The ghost of the plans and the tick each hero's plan ends at in it.
    refresh() {
        this.ghost = this.M.ghost(this.plans);
        /** @type {string | boolean} why a tap walks nowhere: 'door', 'none' (CoopGamePlan) */
        this.noPath = false;
        this.refused = null;
        this.tapWhy = null;
        this.clearAsk();
        this.openWaitList(false);
        // the model's tick each plan runs out at: a wait at the end counts, standing still too
        this.ends = this.ghost.planEnd.slice();
        this.lim = this.M.limit(this.plans, this.ghost);   // the ceiling and the start (rules, section 23)
        // the round of each patrolling guard under them (Ivan 25.10, rules, section 8): a cell once,
        // the dot of a hero not selected, the guard's uniform colour; a guard on his post has none
        const rounds = this.M.guards.filter(g => g.patrol).map(g => ({
            cells: [...new Map(g.patrol.map((/** @type {number[]} */ c) => [c.join(','), c])).values()], hex: CoopGame.GUARD_TRAIL, bold: false }));
        // the menu's background has no trail (rules, section 36)
        this.scene.routes = this.menu ? [] : rounds.concat(this.M.heroes.map((h, i) => ({
            cells: this.plans[i].filter(s => s.op === 'go').map(s => s.to),
            hex: cssColor(h.mark), bold: i === this.sel
        })));
        this.scene.selRing = this.selRingOf();
        this.preview();
        this.buildActions(this.endOf(this.sel));
        this.renderHud();
        this.tutView();
    }

    // The language changed over the level (rules, section 36, item 9: the settings window over a level or the main
    // screen): what the code wrote, anew in it — the action buttons, the open list of Wait, the hero's window, the plan
    // sheet, the HUD and the tip. The plan's signs are icons and time; a level's own names follow from its next start.
    relang() {
        this.mapDrawn = false;
        if (this.mapOpen()) this.showMap(true);
        if (this.mode === 'plan') {
            const wait = this.waitIds.length > 0;
            this.buildActions(this.endOf(this.sel));
            if (wait) this.openWaitList(true);
        }
        if (this.heroAt != null && this.heroOpen()) this.heroTexts(this.M.heroes[this.heroAt]);
        this.renderHud();
        this.tutView();
    }

    // The plan view's run: the ghost of the plans, the selected hero's with the ticks set on Wait
    // added as a tap on Wait would add them (one wait with a wait at the end), and its ghosts.
    preview() {
        const n = this.pendingWait();
        this.viewPlans = this.plans;
        if (n > 0) {
            const plan = this.plans[this.sel].map(s => Object.assign({}, s)), last = plan[plan.length - 1];
            if (last && last.op === 'wait') last.ticks += n;
            else plan.push({ op: 'wait', ticks: n });
            this.viewPlans = this.plans.map((p, i) => (i === this.sel ? plan : p));
        }
        this.view = n > 0 ? this.M.ghost(this.viewPlans) : this.ghost;
        // the same runs on past the plans (rules, section 8): the guards for the plan's scene and buttons
        this.ghostOn = this.M.ghost(this.plans, true);
        this.round = n > 0 ? this.M.ghost(this.viewPlans, true) : this.ghostOn;
        this.scene.ghosts = this.menuGhosts || this.planGhosts();
        this.buildGhostTags();
    }

    // A hero's icon (his card's, heroes.json): the emoji, else the first letter of his fruit.
    /** @param {{ icon?: string, fruit: string }} h */
    static heroIcon(h) { return h.icon || h.fruit[0]; }

    // The font (layout px, whole) that fits a sign's text into width w: its widest line in ems (an icon
    // SIGN_EM.icon, a digit .digit, anything else .other; a variation selector and a joiner nothing) —
    // no more than max.
    /** @param {string} text @param {number} w @param {number} max */
    static signFont(text, w, max) {
        const E = CoopGame.SIGN_EM;
        const em = Math.max(...text.split('\n').map(line => Array.from(line).reduce((a, ch) => {
            const c = ch.codePointAt(0) || 0;
            // keep: code points — a joiner and a variation selector take no room, past U+2000 an icon
            return a + (c === 0xFE0F || c === 0x200D ? 0 : c > 0x2000 ? E.icon : ch >= '0' && ch <= '9' ? E.digit : E.other);
        }, 0)));
        return Math.max(1, Math.min(max, Math.floor(w / Math.max(em, 1e-9))));
    }

    update(dt) {
        const sc = this.scene;
        const cv = World3D.canvas;
        if (cv && cv.clientWidth + 'x' + cv.clientHeight !== this.fitSize) this.fit();
        if (this.mode === 'run' && this.run) {
            const F = this.run.frames, end = F.length - 1;
            this.fast = this.playRate(Math.floor(this.rt)) > this.speeds[this.speedIdx];
            if (this.playing) this.rt = Math.min(end, this.rt + dt * this.playRate(Math.floor(this.rt)) / this.c.tickS);
            const i = Math.min(end, Math.floor(this.rt));
            sc.outroS = this.outro / CoopGame.OUTRO_S;
            sc.render(F[i], F[Math.min(end, i + 1)], this.rt - i);
            // The hero of a fresh event (a crash, a stun, a door) or else the crew's middle:
            // everybody still on the job, not in the van.
            const hold = this.c.eventHoldTicks;
            const ev = CoopGame.focusEvent(this.run.events, F[i].t, hold);
            const on = sc.heroes.filter((p, k) => this.M.onJob(F[i].h[k]));
            const list = ev ? [sc.heroes[ev.who]] : on.length ? on : sc.heroes;
            sc.focus.x = list.reduce((s, p) => s + p.x, 0) / list.length;
            sc.focus.y = list.reduce((s, p) => s + p.y, 0) / list.length;
            if (this.fitted) this.fitFocus();
            this.placeLoadTags(F[i]);
            this.placeWorkTags(F[Math.min(end, i + 1)], this.rt - i);
            if (this.rt >= end && !this.shown) this.finishTake(dt * this.speeds[this.speedIdx]);
            if (this.outro > 0) sc.showPolice(F[end].t + this.outro / this.c.tickS, performance.now() / 1000);
            this.renderHud();
        } else if (this.ghost) {
            this.introTick(dt);
            const f = this.planFrame(), R = this.round.frames;
            const g = R[Math.min(R.length - 1, f.t)];
            sc.outroS = 0;
            sc.render(f, f, 0, g, g);
            this.aimPlan();
            this.placeGhostTags();
            this.placeLoadTags(f);
            this.placeWorkTags(f, 0);
        }
        this.blinkTick(dt);
        this.timerTick(dt);
    }

    // The plan's camera point (rules, section 35; Ivan 16.11): during the start's drive in — the middle of the van; after
    // it a fitted level keeps the van in the middle across, a bigger one follows the selected hero; the tutorial brings
    // its step's target in over that (tutSee).
    aimPlan() {
        const sc = this.scene, van = CoopGame.vanMid(this.M);
        const at = van && this.intro != null ? sc.center(van[0], van[1]) : sc.heroes[this.sel];
        sc.focus.x = at.x;
        sc.focus.y = at.y;
        if (this.fitted) this.fitFocus(true);
        if (this.intro == null) this.tutSee(sc.focus);
    }

    // The middle of the van's rect (all of it, the cab too), in cells; null — a level without a van.
    /** @param {any} M */
    static vanMid(M) {
        const van = M.L.objects.find((/** @type {any} */ o) => o.kind === 'van');
        return van ? [(van.rect[0] + van.rect[2]) / 2, (van.rect[1] + van.rect[3]) / 2] : null;
    }

    // A fitted level: the camera holds its middle — across, the van's middle when onVan (the plan, rules, section 35) —
    // shifted so that it stands in the free band (north is up: a look-at point further south lifts the level on screen).
    /** @param {boolean} [onVan] */
    fitFocus(onVan) {
        const van = onVan ? CoopGame.vanMid(this.M) : null;
        const sc = this.scene, c = sc.center(van ? van[0] : (this.M.W - 1) / 2, (this.M.H - 1) / 2);
        const sinP = Math.sin(this.app.camera.c.pitch * Math.PI / 180);
        sc.focus.x = c.x;
        sc.focus.y = c.y + this.fitRise / (this.zoom * sinP);
    }

    // A text's length in characters of the log: past U+2000 (not a dash or a quote) an emoji counts two.
    /** @param {string} t */
    static logChars(t) {
        // keep: code points — past U+2000 (not a dash or a quote) an emoji, two characters wide
        return [...t].reduce((w, ch) => w + (/** @type {number} */ (ch.codePointAt(0)) > 0x2000 && !/[–—«»→×½…·]/.test(ch) ? 2 : 1), 0);
    }

    // A line of the log cut at spaces into lines of at most n by len — CoopGame.LOG_WRAP characters (an emoji
    // counts two), or the width the HUD measures in the real font (logFit) — the next ones indented as the police line.
    // atColon: a line that does not fit is cut after its first «: » first, if what is before it fits — the object
    // goes down whole (Ivan 12.11: «если есть перенос, то переносить то, что после :»); the rest — at spaces.
    /** @param {string} s @param {number} [n] @param {string} [ind] @param {(t: string) => number} [len] @param {boolean} [atColon] @returns {string[]} */
    static wrapLog(s, n = CoopGame.LOG_WRAP, ind = CoopGame.LOG_INDENT, len = CoopGame.logChars, atColon = false) {
        const out = [];
        let rest = s;
        const colon = atColon ? s.indexOf(': ') : -1;
        if (len(s) > n && colon >= 0 && len(s.slice(0, colon + 1)) <= n) {
            out.push(s.slice(0, colon + 1));
            rest = ind + s.slice(colon + 1).trimStart();
        }
        while (len(rest) > n) {
            const lead = rest.length - rest.trimStart().length;
            let cutAt = -1;
            for (let i = lead + 1; i < rest.length; i++) {
                if (rest[i] !== ' ') continue;
                if (len(rest.slice(0, i)) > n) break;
                cutAt = i;
            }
            if (cutAt < 0) break;   // one long word: let it run
            out.push(rest.slice(0, cutAt).trimEnd());
            rest = ind + rest.slice(cutAt).trimStart();
        }
        out.push(rest);
        return out;
    }

    // The log's lines of events: an alarm is red (Ivan 20.10) and tells when the police (ГБР)
    // come — its second line. A red line starts with CoopGame.RED.
    /** @param {any[]} events */
    logLines(events) { return this.logRows(events).map(r => r.text); }

    // Where each hero is among the plan's log lines (Ivan 24.10: «полоса цвета героя — если он
    // находится сейчас между двумя залогированными действиями других героев»): his moment is the end
    // of his plan (ends[k]); the border «at» is under the last line with a tick ≤ it. A bar only with
    // lines on both sides, the line above not his (then his frame shows him) and no line of his on
    // that very tick (a tie: the frame is enough). Heroes on one border share it: i of n.
    /** @param {{ t: number, who: number }[]} rows @param {number[]} ends */
    static logBars(rows, ends) {
        const out = [];
        ends.forEach((m, k) => {
            let at = 0;
            while (at < rows.length && rows[at].t <= m) at++;
            if (at === 0 || at === rows.length || rows[at - 1].who === k) return;
            if (rows.some(r => r.who === k && r.t === m)) return;
            out.push({ k, at, i: 0, n: 1 });
        });
        for (const b of out) {
            const same = out.filter(x => x.at === b.at);
            b.i = same.indexOf(b);
            b.n = same.length;
        }
        return out;
    }

    /** @param {string | undefined} line */
    static isRed(line) { return !!line && line.startsWith(CoopGame.RED); }
    /** @param {string} line */
    static isAsk(line) { return !!line && line.startsWith(CoopText.t('game.ask', { line: '' })); }

    // The end of a take (Ivan 19.10): while it plays, the van drives off to its exit with whoever
    // is in it (OUTRO_S real seconds at ×1, d — the seconds played), then the result; nobody in
    // the van, or the take stopped at its end — the result at once.
    /** @param {number} d */
    finishTake(d) {
        const F = this.run.frames;
        if (this.playing && CoopGame.vanLeaves(this.M, F[F.length - 1]) && this.outro < CoopGame.OUTRO_S) {
            this.outro = Math.min(CoopGame.OUTRO_S, this.outro + d);
            if (this.outro < CoopGame.OUTRO_S) return;
        }
        this.shown = true;
        this.playing = false;
        CoopGame.recordTake(this.M.L.id, this.run, this.outcome(this.run), this.campaign);
        this.showResult(this.run);
    }

    // How fast the take plays tick i (frames i → i + 1), ticks a real tickS: the chosen speed, and
    // STILL_SPEED times that when nobody moves in it (Ivan 24.10: the ticks are the same, the
    // playback of them faster).
    playRate(i) {
        const F = this.run.frames, end = F.length - 1, v = this.speeds[this.speedIdx];
        return i < end && CoopGame.still(F[i], F[i + 1]) ? v * CoopGame.STILL_SPEED : v;
    }

    // Whether nobody moves between frames a and b: no hero or guard changes his cell, flies, falls
    // or gets up, slides, touches another body, is caught or knocked out; turning on the spot, working
    // and waiting are standing.
    static still(a, b) {
        const moves = (p, q) => !p || p.x !== q.x || p.y !== q.y || !!p.fall !== !!q.fall || !!p.flies || !!q.fly || !!q.flies
            || !!q.slide || q.kc !== undefined || !!p.caught !== !!q.caught || !!p.out !== !!q.out;
        return !b.h.some((q, i) => moves(a.h[i], q)) && !(b.g || []).some((q, i) => moves(a.g && a.g[i], q));
    }

    // The hero's event the heist camera follows while frame t plays to t + 1 (an event of that tick
    // is stamped t + 1, rules, section 3, item 6): the latest one of a hero, for hold ticks; null — none.
    /** @param {any[]} events @param {number} t @param {number} hold */
    static focusEvent(events, t, hold) {
        return events.filter((/** @type {any} */ e) => e.who >= 0 && e.t <= t + 1 && t + 1 - e.t < hold).pop() || null;
    }

    // Whether the van drives off at the end of a take (frame f — its last): somebody is in it.
    /** @param {any} M @param {any} f */
    static vanLeaves(M, f) {
        return f.h.some((/** @type {any} */ h) => M.inVan(h));
    }

    // What the timer shows at tick t: { left, police } — police: the alarm is up and the police
    // come before the patrol.
    /** @param {any} M @param {number} t @param {any} run */
    static timerOf(M, t, run) {
        const come = M.arrival(run && run.alarmT !== null && run.alarmT <= t ? run.alarmT : null);
        return { left: Math.max(0, come.t - t), police: come.police };
    }

    // A hero card's last step of a plan: a walk is told by its length, a wait and an action by
    // their text (text(step) — the action's label).
    /** @param {any[]} plan @param {(s: any) => string} text */
    static lastStep(plan, text) {
        if (!plan.length) return CoopText.t('game.plan_empty');
        const last = plan[plan.length - 1];
        if (last.op !== 'go') return text(last);
        let n = 0;
        for (let k = plan.length - 1; k >= 0 && plan[k].op === 'go'; k--) n++;
        return CoopText.t('game.last_walk', { n });
    }

    // A take that opens the next level: nobody caught, at least one star, and in co-op every task
    // of the goal done (o — CoopModel.outcome; single player — null).
    /** @param {any} r @param {any} o */
    static won(r, o) {
        return o ? !!o.ok : !r.caught.length && r.stars >= 1;
    }

    // The co-op's numbers (Constants.js, COOP_* and the shared HEIST_* of the grid). No defaults: the
    // editor does not load the co-op code, the page loads Constants.js first (CLAUDE.md invariant 3).
    static cfg() {
        return {
            cellPx: HEIST_CELL_PX,
            wallH: HEIST_WALL_H,
            wallT: HEIST_WALL_T,
            tickS: COOP_TICK_S,
            waitTicks: COOP_WAIT_TICKS,
            waitMax: COOP_WAIT_MAX,
            scrubTicks: COOP_SCRUB_TICKS,
            eventHoldTicks: COOP_EVENT_HOLD_TICKS,
            zoom: COOP_ZOOM,
            fitMargin: COOP_FIT_MARGIN,
            fitTop: COOP_FIT_TOP_PX,
            fitBottom: COOP_FIT_BOTTOM_PX,
            cameraPad: { left: COOP_CAMERA_PAD_LEFT, right: COOP_CAMERA_PAD_RIGHT, up: COOP_CAMERA_PAD_UP, down: COOP_CAMERA_PAD_DOWN },
            night: /** @type {boolean | null} */ (null)   // the stand's day / night over the level's (nightFromUrl); null — the level's
        };
    }
}

// The heist clock on the HUD: «m:ss», a tick is a second (CoopModel.clock).
CoopGame.clock = (/** @type {number} */ t) => CoopModel.clock(t);

// The special action's icon by verb (a hero card's icon is the hero's, from his config).
CoopGame.OUTRO_S = COOP_GAME_OUTRO_S;
CoopGame.INTRO_S = COOP_SCENE_INTRO_S;
// the presses the start's drive in eats (rules, section 35): a press ends it, its release and click go with it
CoopGame.INTRO_EVENTS = ['pointerdown', 'pointerup', 'click', 'keydown', 'keyup'];
CoopGame.ACT_GAP = COOP_GAME_ACT_GAP;
CoopGame.FX_ICON = /** @type {Record<string, string>} */ ({ alarm: '🚨', noise: '🔊', spoil: '💸' });   // side effects on the buttons (CoopModel.effectsOf)
CoopGame.FX_INSET = COOP_GAME_FX_INSET;
CoopGame.FX_GAP = COOP_GAME_FX_GAP;
CoopGame.FX_OVERLAP = COOP_GAME_FX_OVERLAP;
CoopGame.HOVER_OFFSET = COOP_GAME_HOVER_OFFSET;
CoopGame.HOVER_PAD = COOP_GAME_HOVER_PAD;
CoopGame.HOVER_GAP = COOP_GAME_HOVER_GAP;
CoopGame.HOVER_STAMP_PAD = COOP_GAME_HOVER_STAMP_PAD;
// the click's stamp of the tag: its tone -> the frame of that color in the layout and its text (rules, section 26)
CoopGame.HOVER_STAMPS = { ok: ['hoverStampOk', 'hoverStampOkText'], bad: ['hoverStampBad', 'hoverStampBadText'],
    muted: ['hoverStampMuted', 'hoverStampMutedText'] };
// The hard tutorial (rules, section 27): what does nothing there (the steps are the only presses) — Go stays
// on, Wait, Clear (Undo — a step's press, section 32: CoopGameTutorial.tutPress), the debug panel's buttons, «Нет» and a tap beside the start window («?» is live — section 31); the hero's card opens his
// window (rules, section 29), the pick stays — one hero.
// The sheet «План» is live (Ivan 08.11: «Кнопку план вернуть»): opening it is no press of a step.
CoopGame.TUT_OFF = ['actWait', 'actWaitLess', 'actWaitMore', 'actClear', 'btnUntil', 'btnDemo', 'btnGameMode', 'btnTaskStars',
    'btnHint', 'btnSheet', 'confirmNo', 'confirmDim'];
// The saved plan (rules, section 37): the PC build's folder next to the exe (main.js), the page's storage key
CoopGame.PLAN_DIR = '/plans/';
CoopGame.PLAN_STORE = 'coop.plan.';
// The PC build (Electron, the app:// scheme): files next to the exe; a page elsewhere — its storage.
CoopGame.onApp = () => typeof location !== 'undefined' && location.protocol === 'app:';
// the free part of the screen the tutorial's camera keeps the step's target in (rules, section 27, 12.11), UI px
CoopGame.SEE = { left: COOP_TUT_SEE_LEFT_PX, right: COOP_TUT_SEE_RIGHT_PX, top: COOP_TUT_SEE_TOP_PX, bottom: COOP_TUT_SEE_BOTTOM_PX };
CoopGame.SEE_PAD = COOP_TUT_SEE_PAD_PX;
CoopGame.BLINK_S = COOP_GAME_BLINK_S;
CoopGame.MAP_CLOSE_BLINK_S = COOP_GAME_MAP_CLOSE_BLINK_S;
CoopGame.TIMER_WARN_S = COOP_GAME_TIMER_WARN_S;
CoopGame.TIMER_WARN_STEP_S = COOP_GAME_TIMER_WARN_STEP_S;
CoopGame.TIMER_BLINK_LEFT_S = COOP_GAME_TIMER_BLINK_LEFT_S;
CoopGame.TIMER_BLINK_S = COOP_GAME_TIMER_BLINK_S;
CoopGame.TIMER_RED = cssColor(COOP_GAME_TIMER_RED);
CoopGame.GUARD_TRAIL = cssColor(COOP_SCENE_HEX_GUARD);  // the plan's trail of a patrolling guard: his uniform
CoopGame.VERB_ICON = /** @type {Record<string, string>} */ ({ open: '🚪', close: '🚧', pick: '🔓', lock: '🔒', hack: '💻', power: '⚡', take: '💰', grab: '✊', gather: '💰', smash: '🔨', unlock: '🗝', drop: '📦', tie: '🔗', knock: '👊' });
CoopGame.STILL_SPEED = COOP_GAME_STILL_SPEED;
CoopGame.ALARM_ICON = '🚨';     // after the icon of a plan's action that raises the alarm (rules, section 18)
CoopGame.WAIT_ICON = '⏳';      // the icon of a wait: the ghost's sign and the take's timer
// Wait at 0 lists these events of the plans: a door opened or closed, the light switched (a ghost run has
// no guards: only a hero turns it off); at most WAIT_LIST of them.
CoopGame.WAIT_KINDS = ['door', 'power'];
CoopGame.TASK_STARS = CoopModel.OBJECTS.plan.task_stars;   // co-op: the goal of the tasks at start, in stars (objects.json plan; Ivan 19.10)
CoopGame.HINT_ON = CoopModel.OBJECTS.plan.hint_on;         // the hint of the valuable loot at start (objects.json plan; Ivan 19.10: on for all for now; to be sold later)
CoopGame.TASK_LINES = COOP_GAME_TASK_LINES;
CoopGame.RESULT_LINES = COOP_GAME_RESULT_LINES;
CoopGame.START_MODE = 'single';  // the game mode at start (by default, 19.10: no network yet)
CoopGame.WAIT_LIST = COOP_GAME_WAIT_LIST;
CoopGame.HINT_SEP = '  ·  ';     // between the parts of the hint line
CoopGame.LOG_INDENT = '      ';   // the alarm's second line of the log, under its text
CoopGame.FIRST = { id: '', W: 0, H: 0 };   // level 1's size in cells, made once (firstLevel)
CoopGame.SIGN_GAP = COOP_GAME_SIGN_GAP;
CoopGame.SIGN_PAD = COOP_GAME_SIGN_PAD;
CoopGame.SIGN_LINE = COOP_GAME_SIGN_LINE;
CoopGame.SIGN_EM = { icon: COOP_GAME_SIGN_EM_ICON, digit: COOP_GAME_SIGN_EM_DIGIT, other: COOP_GAME_SIGN_EM_OTHER };   // a sign's text widths
CoopGame.TAG_GAP = COOP_GAME_TAG_GAP;
CoopGame.RED = '🚨 ';
CoopGame.LOG_RED = cssColor(COOP_GAME_LOG_RED);
CoopGame.LOG_WRAP = COOP_GAME_LOG_WRAP;
CoopGame.LOG_INDENT = '      ';  // the wrapped part of a line: under the text, as the police line
CoopGame.LOG_LINES = COOP_GAME_LOG_LINES;

CoopGame.TAP_SLOP_PX = COOP_GAME_TAP_SLOP_PX;
CoopGame.TAP_MAX_MS = COOP_GAME_TAP_MAX_MS;
CoopGame.SPEED_2 = COOP_GAME_SPEED_2;
CoopGame.SPEED_3 = COOP_GAME_SPEED_3;
CoopGame.SPEED_KEY = 'coop.speed';   // Store: the heist speed the player chose last
CoopGame.SCREEN_W = COOP_GAME_SCREEN_W;
CoopGame.SCREEN_H = COOP_GAME_SCREEN_H;
CoopGame.FIT_ZOOM_MIN = COOP_GAME_FIT_ZOOM_MIN;
CoopGame.FIT_ZOOM_MAX = COOP_GAME_FIT_ZOOM_MAX;
CoopGame.FIT_STEPS = COOP_GAME_FIT_STEPS;
CoopGame.WAIT_GAP = COOP_GAME_WAIT_GAP;
CoopGame.FX_MARGIN = COOP_GAME_FX_MARGIN;
CoopGame.HERO_CARDS = COOP_GAME_HERO_CARDS;
CoopGame.CLASSIC_LEVELS = COOP_GAME_CLASSIC_LEVELS;

// The main screen's background (COOP_MENU; its methods — CoopGameMenu.js).
// The menu's copy of its level: the gang for the team, each hero in his van cell; the level is as it is.
/** @param {any} m COOP_MENU */
CoopGame.menuModel = (m) => CoopModel.create(m.level, {
    team: m.gang.map((/** @type {any} */ g) => g.hero),
    heroes_at: Object.fromEntries(m.gang.map((/** @type {any} */ g) => [g.hero, g.cell]))
});

// The plan's signs of the level's solution (CoopGameTags.planGhosts over the model's run of it), one per
// spot: the sign of the first of verbs done there; a spot with none of them has none. until (optional) —
// the signs end with the first sign of this verb (the earliest), the later ones are left out.
/** @param {any} M a level's model @param {string[]} verbs @param {string} [until] */
CoopGame.menuSigns = (M, verbs, until) => {
    const S = M.L.solution || {};
    const plans = M.team.map((/** @type {string} */ r) => (S[r] ? M.planFromScript(r, S[r]) : []));
    const spots = CoopGameTags.planGhosts.call(/** @type {any} */ ({ M, view: M.ghost(plans), viewPlans: plans }));
    const out = [];
    for (const g of spots) {
        const s = verbs.map(v => g.signs.find((/** @type {any} */ x) => x.verb === v)).find(Boolean);
        if (s) out.push(Object.assign({}, g, { hero: s.hero, work: s.work, text: s.text, signs: [s] }));
    }
    const last = Math.min(...out.filter(g => g.signs[0].verb === until).map(g => g.signs[0].end));
    return out.filter(g => g.signs[0].end <= last);
};

// The menu camera's eye and target in cells (the grid's corner at 0; height in cells): offsets from the
// middle of the data's center cell.
/** @param {{ center: number[], eye: number[], target: number[] }} cam */
CoopGame.menuPose = (cam) => {
    const x = cam.center[0] + 0.5, y = cam.center[1] + 0.5;
    return { eye: [x + cam.eye[0], y + cam.eye[1], cam.eye[2]], target: [x + cam.target[0], y + cam.target[1], cam.target[2] || 0] };
};

// The vertical field of view (radians) that keeps the width of a frame of aspect frame[0]:frame[1] seen
// with fov: the same on that frame or a wider screen, wider on a narrower one.
/** @param {number} fov @param {number} aspect @param {number[]} frame */
CoopGame.menuFov = (fov, aspect, frame) => {
    const a = frame[0] / frame[1];
    return aspect >= a ? fov : 2 * Math.atan(Math.tan(fov / 2) * a / aspect);
};
