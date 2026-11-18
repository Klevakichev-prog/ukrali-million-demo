// Game.js — the heist game on top of the kit: the five levels of They Stole a Million.
// main.js creates it after the location and the camera (window.app.game) and calls update(dt)
// every frame BEFORE the render.
//
// The orchestrator: the player writes tracks in the PLAN (tap a cell — walk there along the
// plan path, action buttons — act in the cell, Wait, Undo, Clear, scrub the plan clock), then
// PLAY runs HeistModel.simulate once and the scene replays its frames (plan -> deterministic
// replay). The HUD is fed through UI.get by id; the layout lives in UILayout.js.

class Game {
    /** @param {{ location: Location3D, camera: CameraController }} app */
    constructor(app) {
        this.app = app;
        this.c = Game.cfg();
        /** @type {HeistScene | null} */
        this.scene = null;
        this.speeds = [1, 4, 10];
        this.speedIdx = 1;
        this.actIds = [];
        this.bindHud();
        this.attachInput(World3D.canvas);
        this.loadLevel(Game.levelFromUrl(window.location.search) || Number(Store.get('heist.level')) || 1);
    }

    // --- Levels and tracks ----------------------------------------------------------

    loadLevel(n) {
        if (!HEIST_LEVELS[n]) n = 1;
        Store.set('heist.level', String(n));
        if (this.scene) this.scene.dispose();
        this.levelId = n;
        this.model = HeistModel.create(n);
        this.tracks = {};
        this.history = {};
        for (const id of this.model.people) { this.tracks[id] = []; this.history[id] = []; }
        this.sel = 0;
        this.mode = 'plan';
        this.run = null;
        this.planT = null;
        this.scene = new HeistScene(this.app.location, this.model, this.c);
        this.frameLevel();
        this.showResult(null);
        this.refresh();
    }

    // The camera over the whole level: its center, a zoom that fits it into the frame.
    frameLevel() {
        const cam = this.app.camera, sc = this.scene;
        cam.follow(null);
        cam.home();
        const c = sc.center(this.model.W / 2 - 0.5, this.model.H / 2 - 0.5);
        cam.lookAt(c.x, c.y);
        const canvas = World3D.canvas;
        const w = canvas ? canvas.clientWidth : 1280, h = canvas ? canvas.clientHeight : 720;
        const fit = Math.min(w * 0.7 / (this.model.W * sc.cell), h * 0.8 / (this.model.H * sc.cell));
        cam.zoomTarget = cam.zoom = Math.max(0.25, Math.min(1.2, fit));
    }

    selId() { return this.model.people[this.sel]; }

    // Appends instructions to the selected person's track (one undo step).
    push(list) {
        const id = this.selId();
        if (!list.length) return;
        this.history[id].push(this.tracks[id].length);
        const tr = this.tracks[id];
        for (const ins of list) {
            const last = tr[tr.length - 1];
            if (ins.op === 'wait' && last && last.op === 'wait') last.s += ins.s;
            else tr.push(ins);
        }
        this.planT = null;
        this.refresh();
    }

    undo() {
        const id = this.selId(), h = this.history[id];
        if (!h.length) return;
        this.tracks[id].length = h.pop();
        this.planT = null;
        this.refresh();
    }

    clear() {
        const id = this.selId();
        this.tracks[id] = [];
        this.history[id] = [];
        this.planT = null;
        this.refresh();
    }

    // The verified level 1 raid (the emulator fenced it for GBP 15 000): Keyhole takes the rare
    // coin from the kitchen sink and drives home.
    demo() {
        if (this.levelId !== 1) return;
        this.loadLevel(1);
        this.sel = this.model.people.indexOf('keyhole');
        const steps = [[7, 12, 'pick'], [5, 4, 'pick'], [2, 3, 'pick'], [4, 1, 'pick'], [4, 1, 'open'], [4, 1, 'rob'], [7, 13, null]];
        for (const [x, y, verb] of steps) {
            this.walkTo(x, y);
            if (verb) this.act(this.model.verbsAt('keyhole', x, y).find(v => v.verb === verb));
        }
    }

    // --- Input -----------------------------------------------------------------------

    attachInput(canvas) {
        if (!canvas) return;
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
            if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > Game.TAP_SLOP_PX || performance.now() - p.t > Game.TAP_MAX_MS) return;
            const r = canvas.getBoundingClientRect();
            this.onTap(e.clientX - r.left, e.clientY - r.top);
        };
        canvas.addEventListener('pointerup', up);
        canvas.addEventListener('pointercancel', up);
    }

    onTap(px, py) {
        if (this.mode !== 'plan' || !this.scene) return;
        const cell = this.scene.pickCell(px, py);
        if (cell) this.walkTo(cell.x, cell.y);
    }

    walkTo(x, y) {
        const at = this.planned[this.selId()].at;
        if (at[0] === x && at[1] === y) return;
        const p = this.model.path(at, [x, y]);
        if (p) this.push(p.map(dir => ({ op: 'move', dir })));
    }

    act(v) {
        if (!v) return;
        this.push([v.door != null ? { op: 'do', verb: v.verb, door: v.door } : { op: 'do', verb: v.verb }]);
    }

    bindHud() {
        PanelToggles.bind(PanelToggles.CLASSIC);
        PanelToggles.dropdown('btnSettings', 'setPanel');
        // The co-op screen's parts (hero cards, actions at the bottom, the plan sheet) are not
        // the classic game's; its clock is.
        const show = (id, v) => { const el = UI.get(id); if (el) el.show(v); };
        for (let i = 0; i < 4; i++) show('heroCard' + i, false);
        for (const id of ['actWait', 'actSpecNone', 'actReady', 'actReadyOff', 'btnMap', 'btnAsk', 'tglLab']) show(id, false);
        show('clockPanel', true);
        const on = (id, fn) => { const el = UI.get(id); if (el) el.onClick(fn); };
        for (let n = 1; n <= 5; n++) on('lvl' + n, () => this.loadLevel(n));
        for (let i = 0; i < 5; i++) on('who' + i, () => { if (this.mode === 'plan') { this.sel = i; this.planT = null; this.refresh(); } });
        on('btnWait', () => { if (this.mode === 'plan') this.push([{ op: 'wait', s: this.c.waitStep }]); });
        on('btnUndo', () => { if (this.mode === 'plan') this.undo(); });
        on('btnClear', () => { if (this.mode === 'plan') this.clear(); });
        on('btnBack', () => this.scrub(-10));
        on('btnFwd', () => this.scrub(10));
        on('btnPlay', () => this.play());
        on('btnPlan', () => this.toPlan());
        on('btnSpeed', () => { this.speedIdx = (this.speedIdx + 1) % this.speeds.length; this.renderHud(); });
        on('btnDemo', () => this.demo());
        on('resultWatch', () => this.showResult(null));
        on('resultReplay', () => this.toPlan());
    }

    scrub(ds) {
        if (this.mode === 'plan') {
            this.planT = Math.max(0, this.viewT() + ds);
        } else if (this.run) {
            const end = this.run.frames[this.run.frames.length - 1].t;
            this.rt = Math.max(0, Math.min(end, this.rt + ds));
        }
        this.renderHud();
    }

    play() {
        if (this.mode === 'run') { this.playing = !this.playing; this.renderHud(); return; }
        this.run = this.model.simulate(this.tracks);
        this.mode = 'run';
        this.rt = 0;
        this.playing = true;
        this.shown = false;
        this.scene.paintFloor(null, null);
        this.app.camera.follow(this.scene.focus);
        this.clearActions();
        this.renderHud();
    }

    toPlan() {
        this.mode = 'plan';
        this.app.camera.follow(null);
        this.run = null;
        this.showResult(null);
        this.refresh();
    }

    // --- State to view ----------------------------------------------------------------

    // The plan second shown: the scrubbed one or the end of the selected person's track.
    viewT() {
        if (this.planT != null) return this.planT;
        return this.planned ? this.planned[this.selId()].end : 0;
    }

    refresh() {
        this.planned = this.model.plan(this.tracks);
        const me = this.planned[this.selId()];
        const t = this.viewT();
        this.scene.paintFloor(me.cells, me.at);
        this.scene.renderPlan(this.planned, t, 0);
        this.buildActions(me.at);
        this.renderHud();
    }

    clearActions() {
        for (const id of this.actIds) UI.remove(id);
        this.actIds = [];
    }

    buildActions(at) {
        this.clearActions();
        const t = UI.def('actTpl');
        if (!t) return;
        const verbs = this.model.verbsAt(this.selId(), at[0], at[1]);
        verbs.forEach((v, i) => {
            const id = 'act' + i;
            UI.add(Object.assign({}, t, { id, y: t.y + i * (t.h + 4), visible: 1,
                text: HeistText.t('verb.' + v.verb) + ' ' + HeistText.t('type.' + v.type) + ' · ' + v.time + ' с' }));
            const el = UI.get(id);
            if (el) el.onClick(() => { if (this.mode === 'plan') this.act(v); });
            this.actIds.push(id);
        });
    }

    update(dt) {
        if (!this.scene) return;
        if (this.mode === 'run' && this.run) {
            const F = this.run.frames, end = F[F.length - 1].t;
            if (this.playing) this.rt = Math.min(end, this.rt + dt * this.c.replaySpeed * this.speeds[this.speedIdx] / 4);
            const i = Math.min(F.length - 1, Math.floor(this.rt));
            const a = F[i], b = F[Math.min(F.length - 1, i + 1)];
            this.scene.renderRun(a, b, this.rt - i);
            const boss = this.scene.people[this.sel];
            this.scene.focus.x = boss.x;
            this.scene.focus.y = boss.y;
            if (this.rt >= end && !this.shown) { this.shown = true; this.playing = false; this.showResult(this.run.result); }
            this.renderHud();
        } else {
            this.scene.renderPlan(this.planned, this.viewT(), 0);
        }
    }

    renderHud() {
        const T = HeistText, set = (id, s) => { const el = UI.get(id); if (el) el.setText(s); };
        set('levelTitle', T.t('title', { n: this.levelId, name: this.model.L.title }));
        set('modeText', T.t(this.mode === 'plan' ? 'mode.plan' : 'mode.run'));
        this.model.people.forEach((id, i) => {
            const p = this.planned ? this.planned[id] : null;
            const mark = i === this.sel ? '▶ ' : '   ';
            set('who' + i, mark + (i + 1) + '. ' + (HeistRules.person(id).name) + (p ? ' · ' + T.clock(p.end) : ''));
        });
        set('btnWait', T.t('btn.wait', { s: this.c.waitStep }));
        set('btnPlay', T.t(this.mode === 'run' && this.playing ? 'btn.pause' : 'btn.play'));
        set('btnSpeed', T.t('btn.speed', { v: this.speeds[this.speedIdx] }));
        const demo = UI.get('btnDemo');
        if (demo) demo.show(this.levelId === 1);
        const hint = this.mode === 'plan' ? 'hint.plan' : 'hint.run';
        set('hint', T.t(hint));
        let status = T.t('status.none'), log = [];
        if (this.mode === 'plan') {
            const me = this.planned[this.selId()];
            set('clockText', T.t('clock.plan', { who: T.shortName(this.selId()), end: T.clock(me.end), t: T.clock(this.viewT()) }));
            const pb = this.model.L.police.patrolBase;
            status = pb != null ? T.t('status.patrolAt', { t: T.clock(pb) + '–' + T.clock(pb + 63) }) : T.t('status.none');
            log = this.tracks[this.selId()].slice(-5).map(ins => ins.op === 'move' ? '→ ' + ins.dir : ins.op === 'wait' ? 'ждать ' + ins.s + ' с' : T.t('verb.' + ins.verb));
        } else if (this.run) {
            const F = this.run.frames, f = F[Math.min(F.length - 1, Math.floor(this.rt))];
            set('clockText', T.t('clock.run', { t: T.clock(f.t) }));
            if (f.freeze) status = T.t('status.freeze');
            else if (f.patrol) status = T.t('status.patrol');
            else if (f.alarmAt != null) status = T.t('status.alarm', { t: T.clock(f.policeAt) });
            log = this.run.events.filter(e => e.t <= f.t && e.kind !== 'spotted').slice(-5).map(e => this.eventText(e));
        }
        set('statusText', status);
        for (let i = 0; i < 5; i++) set('log' + i, log[i] || '');
    }

    eventText(e) {
        const T = HeistText;
        return T.t('ev.' + e.kind, { t: T.clock(e.t), who: e.who ? T.shortName(e.who) : '', why: e.why || '',
            v: e.price != null ? T.money(e.price) : '', s: e.s || '', circuit: e.circuit || '' });
    }

    showResult(r) {
        const panel = UI.get('resultPanel');
        if (panel) panel.show(!!r);
        if (!r) return;
        const T = HeistText, set = (id, s) => { const el = UI.get(id); if (el) el.setText(s); };
        const by = this.run ? (this.run.events.find(e => e.kind === 'caught') || {}).by : null;
        set('resultTitle', r.outcome === 'escaped' ? T.t('result.escaped', { t: T.clock(r.t), take: T.money(r.take) })
            : r.outcome === 'caught' ? T.t('result.caught', { by: T.t('by.' + (by || 'police')), t: T.clock(r.t) }) : T.t('result.timeout'));
        const lines = [];
        if (r.split) for (const [id, v] of Object.entries(r.split)) lines.push(T.t('split', { name: HeistRules.person(id).name, v: T.money(v) }));
        for (let i = 0; i < 6; i++) set('res' + i, lines[i] || '');
    }

    // The heist's numbers (Constants.js, HEIST_*), with defaults: in the editor they live on window.
    // A level of the original from the address: ?classic=N (the desktop build's scene menu).
    /** @param {string} search */
    static levelFromUrl(search) {
        const m = /[?&]classic=(\d+)/.exec(search);
        return m && HEIST_LEVELS[Number(m[1])] ? Number(m[1]) : null;
    }

    static cfg() {
        const U = 'undefined';
        return {
            cellPx: typeof HEIST_CELL_PX !== U ? HEIST_CELL_PX : 48,
            wallH: typeof HEIST_WALL_H !== U ? HEIST_WALL_H : 34,
            wallT: typeof HEIST_WALL_T !== U ? HEIST_WALL_T : 5,
            replaySpeed: typeof HEIST_REPLAY_SPEED !== U ? HEIST_REPLAY_SPEED : 4,
            personScale: typeof HEIST_PERSON_SCALE !== U ? HEIST_PERSON_SCALE : 0.2,
            waitStep: typeof HEIST_WAIT_STEP !== U ? HEIST_WAIT_STEP : 5
        };
    }
}

Game.TAP_SLOP_PX = 10;    // CSS px: a press that moved farther is a drag (the camera's), not a tap
Game.TAP_MAX_MS = 500;    // ms: a longer press is not a tap
