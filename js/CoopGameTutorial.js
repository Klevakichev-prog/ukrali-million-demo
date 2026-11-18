// CoopGameTutorial.js — a part of CoopGame (CoopGame.js): the hard tutorial (rules, section 27; Ivan
// 08.11) and the windows a level starts with. Only the current step's press is live (CoopTutorial),
// its target blinks — the outline, the ring, the gold frame round a button; the tip at the bottom
// (section 28); the plan sheet at start and the hero's card (section 29). Methods of the game,
// mixed into its prototype.

/** @satisfies {ThisType<CoopGame>} */
const CoopGameTutorial = {
    // The current step of the level's tutorial (CoopTutorial); none — no tutorial or it is done.
    tutStep() {
        return this.tutSteps ? this.tutSteps[this.tutK] || null : null;
    },

    // Press p (CoopTutorial.matches) made by fn: with no tutorial — made; in one — only the current
    // step's, and when it added to the plan (not refused — rules, section 23) the next step comes.
    /** @param {any} p @param {() => void} fn */
    tutPress(p, fn) {
        if (!this.tutSteps) { fn(); return; }
        if (this.mode !== 'plan' || this.mapOpen() || this.heroOpen() || !CoopTutorial.matches(this.M, this.tutStep(), p)) return;
        const was = this.plans[this.sel];
        fn();
        if (this.plans[this.sel] !== was) this.tutNext();
    },

    // «Дальше» of a plate (rules, section 32): the next row of the sheet; in the plan, no window open. The advice
    // held by the plate (tutAdvice) gets its ring or frame when a press is the current step again.
    tutNote() {
        const s = this.tutStep(), box = UI.get('confirmBox');
        if (!s || s.do !== 'note' || this.mode !== 'plan' || this.mapOpen() || this.heroOpen() || (box && box.visible)) return;
        this.tutNext();
        const a = this.askLater, now = this.tutStep();
        if (a && now && now.do !== 'note') this.showAsk(a.line, a.mark, a.cell);
    },

    // The current step is done: the next one comes. A plan press's step (tutPress), the «Совет» step, which
    // adds nothing to the plan (rules, section 31), or a plate's «Дальше» (section 32).
    tutNext() {
        this.tutEnds.push(this.ends[this.sel]);     // the log's steps (CoopTutorial.logRows)
        this.tutK++;
        this.blinkT = 0;                            // the new target comes lit
        // the new step leads the camera again: a drag or a flight let it go (rules, section 27, 12.11)
        if (this.app && this.app.camera) this.app.camera.follow(this.scene.focus);
        this.buildActions(this.endOf(this.sel));    // the buttons of the new step: live or grey (tutButton)
        this.renderHud();                           // the log: the step done, the next one
        this.tutView();
    },

    // The press of the tutorial's current step action button v makes (rules, section 27, «Отзыв 10.11 поздно»):
    // the step's own button, or the one action a tap on the step's target would add with no walk (it counts as
    // the tap); null — not the step's: the button is grey and does nothing.
    /** @param {{ verb: string, target: string }} v */
    tutButton(v) {
        const s = this.tutStep();
        if (!s) return null;
        const press = { do: 'act', verb: v.verb, target: v.target };
        if (CoopTutorial.matches(this.M, s, press)) return press;
        if (s.do !== 'tap' || CoopTutorial.walkCell(s)) return null;
        const obj = CoopTutorial.objId(this.M, s.obj), at = this.endOf(this.sel);
        const F = this.ghost && this.ghost.frames, t0 = (this.ends ? this.ends[this.sel] : 0) + this.pendingWait();
        const r = obj && this.M.tapObject(this.sel, at, obj, F || null, t0, this.ghostOn);
        return CoopTutorial.sameAsTap(r, v) ? { do: 'tap', obj } : null;
    },

    // The step's target (rules, section 27): the object outlined in the hero's color (as the hover,
    // rules, section 26), a ring on the cell, the button — the action's, «Совет» (section 31), «Начать ограбление»,
    // «Да» of its window, a plate's «Дальше» (section 32); out of the plan or done — none. All blink (blinkTick; the
    // button — its own outline, rules 34, 18.11); the step's text is in the tip at the bottom (tipView, section 28).
    tutView() {
        this.tipView();
        if (!this.tutSteps) return;
        const s = this.mode === 'plan' ? this.tutStep() : null, h = this.M.heroes[this.sel];
        const T = /** @type {any} */ ((s && CoopTutorial.target(this.M, s)) || {});
        if (this.scene.setMark) this.scene.setMark(T.obj || null, cssColor(h.color));
        this.scene.tutRing = T.cell ? { x: T.cell[0], y: T.cell[1], mark: h.mark } : null;
        const box = UI.get('confirmBox'), open = !!box && box.visible;
        const k = T.verb && this.actVerbs ? this.actVerbs.findIndex(v => v.verb === T.verb.verb && v.target === T.verb.target) : -1;
        this.tutFrameOn = T.start ? (open ? 'confirmYes' : 'actReady') : T.ask ? 'btnAsk' : T.undo ? 'actUndo' : k >= 0 && this.actIds[k] ? this.actIds[k] : null;
        this.tutNoteOn = !!T.next;
    },

    // The camera's focus f (the level's middle or the hero) moved by as little as brings the current step's target
    // (CoopTutorial.point) into the free part of the screen — the window less CoopGame.SEE and SEE_PAD in UI px
    // (rules, section 27, «Охота за багами 12.11»: В6 under the log in 4:3, the van under the edge in 16:9); the
    // camera rides there as it follows. Out of the plan, no tutorial or no point — f as it is.
    /** @param {{ x: number, y: number }} f */
    tutSee(f) {
        const s = this.mode === 'plan' && this.tutSteps ? this.tutStep() : null, at = s && CoopTutorial.point(this.M, s);
        if (!at) return;
        const cv = World3D.canvas, W = (cv && cv.clientWidth) || CoopGame.SCREEN_W, H = (cv && cv.clientHeight) || CoopGame.SCREEN_H;
        const k = UI.scale(), B = CoopGame.SEE, pad = CoopGame.SEE_PAD, p = this.scene.center(at[0], at[1]), cam = this.app.camera.c;
        const d = CoopGame.seeShift({ dx: p.x - f.x, dy: p.y - f.y, zoom: this.zoom, screenW: W, screenH: H, fovDeg: cam.fov, pitchDeg: cam.pitch,
            free: { left: (B.left + pad) * k, right: (B.right + pad) * k, top: (B.top + pad) * k, bottom: (B.bottom + pad) * k } });
        f.x += d.x;
        f.y += d.y;
    },

    // Esc (rules, section 28, 12.11): closes the open window as its ✕ does — the hero's card, else the plan sheet
    // (the tutorial's start sheet opens the card after it); true — one was closed.
    escape() {
        if (this.heroOpen()) { this.showHero(null); return true; }
        if (this.mapOpen()) { this.closeMap(); return true; }
        return false;
    },

    // The tip at the bottom of the screen (rules, section 28; Ivan 08.11): one text at a time — the plan
    // sheet open: in the tutorial its row «окно плана» on the sheet over its frame, elsewhere none (section 35,
    // Ivan 16.11); closed: in the tutorial — the current step's text over the action buttons, after the start's
    // drive in; elsewhere — none. The plate is one size
    // whatever the text (section 33): the text's box wraps and fits it (UI.apply); a plate of section 32 has
    // «Дальше» at its bottom edge, and the text's box is the part over the button.
    tipView() {
        const map = this.mapOpen(), s = this.mode === 'plan' && this.tutSteps ? this.tutStep() : null;
        const mp = UI.get('tipMapPanel'), mt = UI.get('tipMapText'), tips = this.tutSteps && this.M.L.tutorial_tips;
        // the sheet's tip: the tutorial's row «окно плана» (section 33); no row, or not the tutorial — none (section 35)
        const tip = tips && typeof tips.map === 'string' ? tips.map : null;
        if (mp) mp.show(map && tip !== null);
        if (map && mt && tip !== null) mt.setText(tip);
        const panel = UI.get('tipPanel'), text = UI.get('tipText');
        if (!panel || !text) return;
        const on = !map && !this.heroOpen() && this.intro == null && !!s;
        panel.show(on);
        const next = UI.get('tipNext'), note = on && s.do === 'note', d = text.def;
        if (next) next.show(note);
        if (on) {
            text.sizeTo(d.w, d.h - (note && next ? next.def.h : 0));
            text.setText(s.text || '');
        }
    },

    mapOpen() {
        const box = UI.get('mapBox');
        return !!box && box.visible;
    },

    // The start of a level (rules, section 35; Ivan 16.11): the tutorial — the van drives in behind the police car, then
    // the plan sheet (openStartMap); any other level — the sheet first over the drive in's first frame, held till the player
    // closes it (closeMap). A lab station or a level without a van — the sheet at once (a station has none). The camera
    // stands on the van from the first frame (aimPlan), it does not ride there.
    startIntro() {
        const sc = this.scene;
        this.intro = CoopGame.vanMid(this.M) && !this.M.L.lab ? 0 : null;
        this.introHold = this.intro !== null && !this.tutSteps;
        sc.introS = this.intro === null ? 1 : 0;
        sc.selRing = this.selRingOf();
        sc.introT = this.intro;
        const cam = this.app && this.app.camera;
        if (cam && typeof cam.lookAt === 'function' && sc.heroes) {
            this.aimPlan();
            cam.lookAt(sc.focus.x, sc.focus.y);
        }
        if (this.intro === null || this.introHold) {
            this.openStartMap();
            return;
        }
        this.introInput(true);
        this.tipView();
    },

    // The player closes the plan sheet (✕, the dim, Esc): the start's sheet held over the drive in lets it go (section 35).
    closeMap() {
        this.showMap(false);
        if (!this.introHold) return;
        this.introHold = false;
        this.introInput(true);
    },

    // A frame of the start, dt seconds: the van's share of INTRO_S — at its end it stands, the sheet opens; the police
    // car's clock runs on under the sheet (the scene drops it when the car is gone).
    /** @param {number} dt */
    introTick(dt) {
        const sc = this.scene;
        if (this.introHold) return;                  // under the start sheet the scene stands
        if (sc.introT != null) sc.introT += dt;
        if (this.intro == null) return;
        this.intro += dt;
        sc.introS = Math.min(1, this.intro / CoopGame.INTRO_S);
        if (this.intro >= CoopGame.INTRO_S) this.endIntro(false, true);
    },

    // The end of the start: skip — a press cut it short (the police car goes too; the press's release and click are still
    // eaten, introInput); open — the plan sheet now in the tutorial, a level's was there before the drive in. Not open —
    // the game ends it (the main screen, «Переиграть», «Пуск»): the van stands and the held sheet goes too.
    /** @param {boolean} skip @param {boolean} open */
    endIntro(skip, open) {
        const sc = this.scene, was = this.intro != null, held = this.introHold;
        this.intro = null;
        this.introHold = false;
        sc.introS = 1;
        sc.selRing = this.selRingOf();
        if (skip) sc.introT = null;
        if (!skip || !open) this.introInput(false);
        if (was && open && this.tutSteps) this.openStartMap();
        if (held && !open) this.showMap(false);
        this.tipView();
    },

    // While the start plays, a press ends it and is eaten whole (rules, section 35): captured on target (the window)
    // before the game and its buttons — the press, then its release and click (or a key and its release). A press with
    // the start over is the player's: the capture lets go. on false — lets go now.
    /** @param {boolean} on @param {any} [target] */
    introInput(on, target) {
        if (this.introEat && this.introOn) for (const t of CoopGame.INTRO_EVENTS) this.introOn.removeEventListener(t, this.introEat, true);
        this.introEat = null;
        this.introOn = null;
        const w = target || (typeof window !== 'undefined' ? window : null);
        if (!on || !w || typeof w.addEventListener !== 'function') return;
        /** @param {any} e */
        const eat = (e) => {
            const press = (e.type === 'pointerdown' || e.type === 'keydown') && !e.repeat;   // a held key's repeat — not a press
            if (this.intro == null && press) {
                this.introInput(false);
                return;
            }
            e.stopPropagation();
            if (!e.type.startsWith('key')) e.preventDefault();   // keys keep the browser's own (F5, F11)
            if (press) this.endIntro(true, true);
            else if (this.intro == null && (e.type === 'click' || e.type === 'keyup')) this.introInput(false);
        };
        this.introEat = eat;
        this.introOn = w;
        for (const t of CoopGame.INTRO_EVENTS) w.addEventListener(t, eat, true);
    },

    // The plan sheet a level starts with (rules, section 28): any level but a lab station; its ✕
    // blinks CoopGame.MAP_CLOSE_BLINK_S after (blinkTick) till the sheet is closed.
    openStartMap() {
        if (this.M.L.lab) return;
        this.showMap(true);
        this.mapStartT = 0;
        this.heroStart = !!this.tutSteps;            // the tutorial: the hero's card when this sheet is closed (section 29)
    },

    // The window of hero i (rules, section 29; Ivan 09.11) — his picture, name, skill word (13.11), the skills as the
    // hint over him has them and his load; null — closed. Opened by the start of the tutorial, it has
    // the tip at its bottom and its ✕ blinks as the start sheet's does.
    /** @param {number|null} i @param {boolean} [start] */
    showHero(i, start) {
        const h = i === null || i === undefined ? null : this.M.heroes[i], on = !!h;
        this.heroAt = h ? /** @type {number} */ (i) : null;
        if (h) this.heroTexts(h);
        const tip = h ? CoopGame.heroTip(this.M.L, h) : null;
        for (const id of ['heroDim', 'heroBox']) { const el = UI.get(id); if (el) el.show(on); }
        const tp = UI.get('tipHeroPanel');
        if (tp) tp.show(on && !!start && tip !== null);
        this.heroStartT = on && start ? 0 : null;
        this.tipView();
    },

    // The texts of hero h's window and its tip (showHero; CoopGame.relang — in the new language).
    /** @param {any} h */
    heroTexts(h) {
        const set = (/** @type {string} */ id, /** @type {string} */ t) => { const el = UI.get(id); if (el) el.setText(t); };
        const art = UI.get('heroArt');
        if (art) art.setImage(h.art);
        set('heroName', h.fruit);
        set('heroTitle', CoopGame.skillWord(h));
        set('heroSkills', [...CoopPlanMap.heroSkillLines(h), CoopText.t('game.hero_load', { mass: String(this.M.capacity(h)).replace('.', ',') })].join('\n'));
        const tip = CoopGame.heroTip(this.M.L, h);
        if (tip !== null) set('tipHeroText', tip);
    },

    heroOpen() {
        const box = UI.get('heroBox');
        return !!box && box.visible;
    },

    // A frame of the game, dt seconds: the targets blink their own outline white ↔ their fill (rules 34, Ivan 18.11:
    // «Мигает белая обводка как это сделано для таймера») — in the plan the tutorial step's (section 27; with its
    // object's outline and its cell's ring in the scene) and the advice's (section 24), in and out of the tutorial;
    // the ✕ of a start window after its delay (section 28). A target no more — its outline white again.
    /** @param {number} dt */
    blinkTick(dt) {
        this.blinkT = (this.blinkT || 0) + dt;
        const lit = CoopGame.blinkLit(this.blinkT), plan = this.mode === 'plan', on = new Map();
        if (this.tutSteps) {
            if (this.scene.setBlink) this.scene.setBlink(lit);
            if (plan && this.tutFrameOn) on.set(this.tutFrameOn, lit);
            if (plan && this.tutNoteOn) on.set('tipNext', lit);
        }
        if (plan && this.askMark) on.set(this.askMark, lit);
        const start = (/** @type {number | null} */ t, /** @type {string} */ id) => {
            if (t === null) return;
            const s = t - CoopGame.MAP_CLOSE_BLINK_S;
            if (s >= 0) on.set(id, CoopGame.blinkLit(s));
        };
        if (this.heroStartT != null) this.heroStartT += dt;
        if (this.mapStartT != null) this.mapStartT += dt;
        start(this.heroStartT, 'heroClose');
        start(this.mapStartT, 'mapClose');
        for (const id of this.blinking || []) if (!on.has(id)) CoopGame.outlineBlink(UI.get(id), true);
        for (const [id, l] of on) CoopGame.outlineBlink(UI.get(id), l);
        this.blinking = [...on.keys()];
    },
};
Object.assign(CoopGame.prototype, CoopGameTutorial);
