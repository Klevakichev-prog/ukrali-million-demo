// MainMenu.js — the main screen (Ivan 07.11.2026, its screens 08.11, rules 36 17.11): a column on the
// left — Обучение, Кампания, Мультиплеер, Настройки, Выход (the desktop build only) — over the first
// level of the ladder, which stands behind as a still scene. main.js makes it after the game when the
// address names no level, lab station or level of the original (a bare address — the desktop build
// opens one). The game's HUD is hidden while the menu is up; the main screen's dim is a band under the
// column (menuSide), a window opened from it has the window's dim (menuDim); both are buttons, like
// confirmDim, and keep taps off the scene. The column's buttons lie on the scene, each tilted its own
// way (MENU_TILTS), «Мультиплеер» nicked on its left edge.
//
// A pick opens a scene by its address, so a level starts exactly as from the desktop scene menu
// and F5 keeps it: Обучение — the tutorial level (the level with tutorial steps, off the ladder); Кампания — a
// window «Продолжить» (the first level of the ladder without a won take; grey with no campaign
// or all done) and «Начать новую» (asks first when there is a campaign to lose), then the choice of the
// difficulty (rules 36, item 6: «Лёгкий · Нормальный · Тяжёлый» a switch, «Нормальный» marked; «Начать» starts —
// the old campaign is gone only then, «Назад» — back to the campaign window), the level opens
// with &campaign=1 — only such takes count (Profile.js). Мультиплеер — a window «Закрытая игра ·
// Открытая игра · Присоединиться», each «в разработке» (no network yet). Выход closes the desktop
// build without a question (window.close()). Настройки (rules 36, 17.11) — the window of three sound rows
// «Общая громкость · Эффекты · Музыка» (a channel plays at master × its own, Profile.volume) and full screen;
// a change works at once, the profile gets it only by «Сохранить»; «Отмена» puts back what the window opened
// with, «Сбросить» — the defaults; both grey while nothing differs from the opening. ✕, Esc, a click on the dim
// close it at once when nothing is changed, else ask «Сохранить изменения?»
// (menuSetAsk: «Не сохранять» — as «Отмена», «Сохранить»; its ✕, Esc, dim — back to the settings). The gear of a
// level opens the same window with «Выйти с уровня» (openSettings): it always asks «Выйти с уровня?» (menuExitAsk,
// 17.11: «Выйти» — the changes go to the profile unasked, and off the level; «Остаться», ✕, Esc, dim — back). Esc in a window of the main screen is its
// «Назад» (escape). The language (rules 36, item 9): a button with the current one and ▲, the list over it grows upward
// (menuLangList on menuLangCatch, a click past it closes; five rows, the wheel scrolls), a row — the language at once
// (CoopText.setLang, UI.relabel), a setting of the window like the volumes. Under the title — «Украдено»:
// the money of the current campaign. «Главное меню» of the debug panel (btnMenu) goes back to the bare address;
// «Завершить» on the result opens the next ladder level in the same mode (and campaign); its «Выйти» is gone (Ivan
// 18.11: ⚙ → «Выйти с уровня»).
// The demo (rules 38, Ivan 18.11): the levels of COOP_DEMO (design/demo/demo.json) — the tutorial and levels 1–2 —
// the rest closed in the interface: «Мультиплеер» grey and dead, the campaign's ladder is the demo's levels and starts at
// the marked difficulty with no choice («Демо пройдено» at its end), an address of another level, a lab station, the
// original or co-op opens the main screen or single play (demoAddress, main.js). The demo build says so through
// window.desktop.demo; a browser — &demo=1 in the address, kept by go().
// The layout is UILayout.js (menu*): the band and the dim, the root with the title, and one panel per screen.

/** @satisfies {Record<string, any>} */
const MainMenu = {
    // The panels of the menu's screens; one is shown at a time.
    PANELS: { main: 'menuMain', campaign: 'menuCamp', diff: 'menuDiff', multi: 'menuMultiWin', soon: 'menuSoon', settings: 'menuSet' },
    // The column of the main screen, top down: each its own tilt (MENU_TILTS in Constants.js).
    COLUMN: ['menuTutorial', 'menuCampaign', 'menuMulti', 'menuSettings', 'menuExit'],
    // The side of a column button's nick (Ivan 17.11: «у мультиплеера — на левую грань»); the rest — by the seed.
    NICKS: { menuMulti: 'left' },
    // The ids that are the menu's own: everything else on the root is the game's HUD.
    OWN: ['menuSide', 'menuDim', 'menuRoot'],
    // The volume rows of the settings, top down: the row's id part -> the profile's key (Profile.SETTINGS).
    ROWS: /** @type {[string, VolumeKey][]} */ ([['Master', 'master'], ['Sound', 'sound'], ['Music', 'music']]),
    // The screen of the PC build (rules 36, item 8; ScreenMode.js): a mode's button, and the rows a browser has not
    // (it keeps menuFullscreen).
    // The choice of the difficulty (rules 36, item 6): a difficulty of Profile.DIFFICULTIES -> its button.
    DIFF_IDS: /** @type {Record<string, string>} */ ({ easy: 'menuDiffEasy', normal: 'menuDiffNormal', hard: 'menuDiffHard' }),
    MODE_IDS: { full: 'menuModeFull', borderless: 'menuModeBorderless', window: 'menuModeWindow' },
    SCREEN_ROWS: ['menuModeLabel', 'menuModeFull', 'menuModeBorderless', 'menuModeWindow', 'menuResLabel', 'menuResPrev', 'menuResValue', 'menuResNext'],
    // The icons of the on/off buttons (Ivan 08.11: «иконка либо яркая либо перечеркнутая»).
    ICONS: {
        master: { on: 'assets/ui/sound-on.svg', off: 'assets/ui/sound-off.svg' },
        sound: { on: 'assets/ui/sound-on.svg', off: 'assets/ui/sound-off.svg' },
        music: { on: 'assets/ui/music-on.svg', off: 'assets/ui/music-off.svg' },
    },
    /** @type {PlayerProfile | null} */
    profile: null,
    // The difficulty picked in the choice (DIFF_IDS); «Начать» starts the campaign at it.
    diff: 'normal',
    // Over a level (openSettings): what «Закрыть» calls; null — the main screen.
    /** @type {(() => void) | null} */
    inLevel: null,
    // The window's settings when it opened (Profile.settingsOf): «Отмена» puts them back; differs — changed().
    /** @type {Partial<PlayerProfile> | null} */
    settingsAt: null,
    // The PC build's screen when the window opened (ScreenMode.pick); null — a browser, or the window closed.
    /** @type {DesktopScreenState | null} */
    screenAt: null,
    // Is «Сохранить изменения?» up (closing the window with changes)?
    asking: false,
    // Is «Выйти с уровня?» up?
    exiting: false,
    // The language list: open, and the language its first row shows (CoopText.languages index).
    langOpen: false,
    langFirst: 0,
    // The screen shown (PANELS key).
    at: 'main',
    bound: false,

    // Is the main screen wanted for this address: none of ?level, ?lab, ?classic.
    /** @param {string} search */
    wanted(search) {
        return !/[?&](level|lab|classic)\b/.test(search);
    },

    // The demo (rules 38): the demo build (window.desktop.demo) or &demo=1 in a browser's address.
    demo() {
        const w = typeof window !== 'undefined' ? window : null;
        if (w && w.desktop && w.desktop.demo) return true;
        return !!(w && w.location && /[?&]demo=1(?:&|$)/.test(w.location.search));
    },

    // Where the demo sends an address before the level loads (rules 38): null — open it as it is (not the demo, the
    // main screen, a level of the demo); a level of the demo in co-op — the same in single play; anything else
    // (another level, a lab station, the original) — the main screen ('').
    /** @param {string} search */
    demoAddress(search) {
        if (!this.demo() || this.wanted(search)) return null;
        const m = /[?&]level=([^&]*)/.exec(search), id = m ? decodeURIComponent(m[1]) : null;
        if (/[?&](lab|classic)\b/.test(search) || !id || !COOP_DEMO.levels.includes(id)) return '';
        if (!/[?&]mode=coop(?:&|$)/.test(search)) return null;
        return '?' + search.slice(1).split('&').filter(x => x && x !== 'mode=coop' && x !== 'demo=1').join('&');
    },

    // The levels of the ladder in their order (not the lab stations, not the levels off it; in the demo — its own):
    // [{ id, title }].
    /** @returns {Array<{ id: string, title: string }>} */
    levels() {
        return Object.values(COOP_LEVELS)
            .filter((/** @type {any} */ l) => !l.lab && Number.isInteger(l.order) && (!this.demo() || COOP_DEMO.levels.includes(l.id)))
            .sort((/** @type {any} */ a, /** @type {any} */ b) => a.order - b.order)
            // the title in the player's language (rules, section 36, «Язык»): title_<lang>, none — the Russian
            .map((/** @type {any} */ l) => ({ id: l.id, title: CoopText.localize({ title: l.title || l.id, ['title_' + CoopText.lang]: l['title_' + CoopText.lang] }).title }));
    },

    // The address query that opens a level in a mode, of the campaign or not.
    /** @param {string} id @param {string} mode 'single' | 'coop' @param {boolean} [campaign] */
    address(id, mode, campaign = false) {
        return '?level=' + encodeURIComponent(id) + (mode === 'coop' ? '&mode=coop' : '') + (campaign ? '&campaign=1' : '');
    },

    // Обучение: the tutorial level (rules, section 27; Ivan 08.11: «отдельный туториальный уровень») —
    // the level whose data has tutorial steps (CoopTutorial.steps), not an id in the code.
    tutorialAddress() {
        const L = Object.values(COOP_LEVELS).find(l => CoopTutorial.steps(l));
        return L ? this.address(L.id, 'single') : null;
    },

    // The campaign window from the profile: next — the level «Продолжить» opens (null — grey),
    // done — every ladder level has its take, stolen — «Украдено».
    /** @param {PlayerProfile} p */
    campaignView(p) {
        const c = p.campaign, left = c ? this.levels().filter(l => !(l.id in c.takes)) : [];
        return { next: left.length ? left[0].id : null, done: !!c && !left.length, stolen: Profile.stolen(p) };
    },

    // The ladder level after this one; the last one, or a level off the ladder — null.
    /** @param {string} id */
    next(id) {
        const list = this.levels(), i = list.findIndex(l => l.id === id);
        return i >= 0 && i + 1 < list.length ? list[i + 1].id : null;
    },

    /** @param {string} query */
    go(query) {
        // a browser's demo keeps its &demo=1 (the demo build knows itself without it)
        const keep = this.demo() && !(window.desktop && window.desktop.demo) && !/[?&]demo=1(?:&|$)/.test(query);
        window.location.href = window.location.pathname + (keep ? (query ? query + '&' : '?') + 'demo=1' : query);
    },

    // Shows the menu over the game: hides the game's HUD on the root, binds the buttons.
    open() {
        this.bind();
        for (const d of UI.layout) {
            const el = UI.get(d.id);
            if (el && !UI.parentOf(d) && !this.OWN.includes(d.id)) el.show(false);
        }
        this.inLevel = null;
        // the level behind the menu does not drift with the cursor at the screen's edge (CameraController.edgeScroll)
        const app = /** @type {any} */ (window).app;
        if (app && app.camera) app.camera.edgeScroll = false;
        // the level behind stands as it is set: the van in its place, no plan sheet (rules, section 35)
        if (app && app.game && typeof app.game.endIntro === 'function') app.game.endIntro(true, false);
        for (const id of this.OWN) this.show(id, true);
        this.show('menuExit', this.canQuit());
        const multi = UI.get('menuMulti');
        if (multi && multi.setLook) multi.setLook(this.demo() ? 'buttonOff' : null);   // the demo: grey (rules 38)
        for (const [i, id] of this.COLUMN.entries()) {
            const el = UI.get(id), tilts = typeof MENU_TILTS !== 'undefined' ? MENU_TILTS : [];
            if (el && el.tiltTo) el.tiltTo(tilts[i] || 0);
            if (el && el.nickTo) el.nickTo(this.NICKS[id] || '');
        }
        this.screen('main');
    },

    // «Выход» — only in the desktop build: a page cannot close its browser tab.
    canQuit() {
        return typeof CoopGame !== 'undefined' && CoopGame.onApp();
    },

    // Closes the game, without a question: the progress is already saved (the desktop build quits
    // when its last window closes).
    quit() {
        window.close();
    },

    // The settings window over a level (Ivan 08.11: the gear opens it): no title, no «Украдено»;
    // closed — back to the level (onClose), «Выйти с уровня» — the main screen.
    /** @param {() => void} [onClose] */
    openSettings(onClose) {
        this.bind();
        this.inLevel = onClose || (() => {});
        for (const id of this.OWN) this.show(id, true);
        this.screen('settings');
    },

    closeSettings() {
        const done = this.inLevel;
        this.showAsk(false);
        for (const id of this.OWN) this.show(id, false);
        this.inLevel = null;
        if (done) done();
    },

    // The buttons of every screen, once; the profile is read again on every show.
    bind() {
        this.profile = Profile.load();
        if (this.bound) return;
        this.bound = true;
        const on = (id, fn) => { const el = UI.get(id); if (el) el.onClick(fn); };
        on('menuTutorial', () => { const q = this.tutorialAddress(); if (q) this.go(q); });
        on('menuCampaign', () => this.screen('campaign'));
        on('menuMulti', () => { if (!this.demo()) this.screen('multi'); });   // the demo: grey, no window (rules 38)
        on('menuSettings', () => this.screen('settings'));
        on('menuExit', () => this.quit());
        for (const id of ['menuMultiClosed', 'menuMultiOpen', 'menuMultiJoin']) on(id, () => this.screen('soon'));
        on('menuSoonBack', () => this.screen('multi'));
        for (const id of ['menuCampBack', 'menuMultiBack']) on(id, () => this.screen('main'));
        on('menuCampContinue', () => {
            const next = this.campaignView(this.profile).next;
            if (next) this.go(this.address(next, 'single', true));
        });
        on('menuCampNew', () => {
            if (this.profile.campaign) this.show('menuCampAsk', true);
            else this.pickDifficulty();
        });
        on('menuCampAskYes', () => this.pickDifficulty());
        for (const d of Profile.DIFFICULTIES) on(this.DIFF_IDS[d.id], () => { this.diff = d.id; this.renderDiff(); });
        on('menuDiffStart', () => this.startCampaign(this.diff));
        on('menuDiffBack', () => this.screen('campaign'));
        on('menuCampAskNo', () => this.show('menuCampAsk', false));
        on('menuFullscreen', () => this.toggleFullscreen());
        for (const [mode, id] of Object.entries(this.MODE_IDS)) on(id, () => this.setScreen(Object.assign(ScreenMode.pick(ScreenMode.view), { mode })));
        on('menuResPrev', () => this.setScreen(ScreenMode.step(ScreenMode.view, -1)));
        on('menuResNext', () => this.setScreen(ScreenMode.step(ScreenMode.view, 1)));
        for (const [k, key] of this.ROWS) {
            on('menu' + k + 'Down', () => this.setVolume(key, -1));
            on('menu' + k + 'Up', () => this.setVolume(key, 1));
            on('menu' + k + 'Mute', () => this.toggleSound(key));
        }
        on('menuSetReset', () => {
            Profile.resetSettings(this.profile);
            if (this.screenAt) ScreenMode.set(ScreenMode.view.defaults);
            this.changedSettings();
        });
        on('menuSetCancel', () => { if (this.changed()) { this.revertSettings(); this.leaveSettings('close'); } });
        on('menuSetSave', () => { if (this.changed()) { this.saveSettings(); this.leaveSettings('close'); } });
        on('menuLang', () => this.langList(!this.langOpen));
        on('menuLangCatch', () => this.langList(false));
        on('menuLangList', () => {});   // its own field — padding, gaps, the bar's strip — is not a click past it
        for (let i = 0; i < this.langRows(); i++) on('menuLangRow' + i, () => this.pickLang(i));
        const pastList = UI.get('menuLangCatch');
        if (pastList && pastList.el && pastList.el.addEventListener)
            pastList.el.addEventListener('wheel', (/** @type {WheelEvent} */ e) => { e.preventDefault(); this.scrollLang(Math.sign(e.deltaY)); }, { passive: false });
        on('menuSetX', () => this.closeAsk('close'));
        on('menuDim', () => { if (this.at === 'settings') this.closeAsk('close'); });
        on('menuSetExit', () => this.showExit(true));
        on('menuSetAskYes', () => { this.saveSettings(); this.leaveSettings('close'); });
        on('menuSetAskNo', () => { this.revertSettings(); this.leaveSettings('close'); });
        for (const id of ['menuSetAskX', 'menuSetAskDim']) on(id, () => this.showAsk(false));
        on('menuExitAskGo', () => { if (this.changed()) this.saveSettings(); this.leaveSettings('exit'); });
        for (const id of ['menuExitAskStay', 'menuExitAskX', 'menuExitAskDim']) on(id, () => this.showExit(false));
        document.addEventListener('fullscreenchange', () => this.renderSettings());
        ScreenMode.start();
        ScreenMode.listen((v) => this.screenOutside(v));
        if (typeof window.addEventListener === 'function')
            window.addEventListener('keydown', (/** @type {KeyboardEvent} */ e) => { if (e.key === 'Escape' && !e.repeat && this.escape()) e.preventDefault(); });
    },

    // Is the menu up (the main screen, or the settings over a level)? CoopGame leaves Esc to it then.
    busy() {
        const el = UI.get('menuRoot');
        return !!(el && el.visible);
    },

    // Esc (rules 36): the confirm — back to the settings; the settings — as their ✕; a window of the main
    // screen — its «Назад» (the campaign's «Начать заново?» — «Нет», the difficulty — the campaign window); the main
    // screen itself — nothing.
    // true — the menu took it.
    escape() {
        if (!this.busy()) return false;
        if (this.langOpen) this.langList(false);
        else if (this.asking) this.showAsk(false);
        else if (this.exiting) this.showExit(false);
        else if (this.at === 'settings') this.closeAsk('close');
        else if (this.at === 'campaign') {
            const ask = UI.get('menuCampAsk');
            if (ask && ask.visible) ask.show(false);
            else this.screen('main');
        } else if (this.at === 'diff') this.screen('campaign');
        else if (this.at === 'multi') this.screen('main');
        else if (this.at === 'soon') this.screen('multi');
        return true;
    },

    // Do the window's settings differ from what it opened with?
    changed() {
        if (this.screenAt && !ScreenMode.same(ScreenMode.view, this.screenAt)) return true;
        return !!this.settingsAt && !Profile.sameSettings(this.profile, this.settingsAt);
    },

    // ✕, Esc, the dim: nothing changed — close at once; else ask first (menuSetAsk).
    /** @param {'close'} why */
    closeAsk(why) {
        if (this.changed()) this.showAsk(true);
        else this.leaveSettings(why);
    },

    /** @param {boolean} on */
    showAsk(on) {
        this.asking = on;
        this.show('menuSetAskDim', on);
        this.show('menuSetAsk', on);
    },

    // «Выйти с уровня?» over the settings (rules 36, 17.11) — always, changed or not.
    /** @param {boolean} on */
    showExit(on) {
        this.exiting = on;
        this.show('menuExitAskDim', on);
        this.show('menuExitAsk', on);
    },

    // The window (and the confirm) closed: 'close' — back to the main screen or the level, 'exit' — off the level.
    /** @param {'close' | 'exit'} why */
    leaveSettings(why) {
        this.showAsk(false);
        this.showExit(false);
        this.langList(false);
        this.settingsAt = null;
        this.screenAt = null;
        if (why === 'exit') this.go('');
        else if (this.inLevel) this.closeSettings();
        else this.screen('main');
    },

    // «Сохранить»: the window's settings into the stored profile (read again: the campaign is the stored one).
    saveSettings() {
        const p = Profile.load();
        Object.assign(p, Profile.settingsOf(this.profile));
        Profile.save(p);
        this.profile = p;
        this.settingsAt = Profile.settingsOf(p);
        if (this.screenAt) {
            // the PC build's screen — into the build's own file (the shell starts with it)
            ScreenMode.save(ScreenMode.view);
            this.screenAt = ScreenMode.pick(ScreenMode.view);
        }
    },

    // «Отмена», «Не сохранять»: the settings the window opened with, heard at once.
    revertSettings() {
        if (this.settingsAt) Object.assign(this.profile, this.settingsAt);
        if (this.screenAt && !ScreenMode.same(ScreenMode.view, this.screenAt)) ScreenMode.set(this.screenAt);
        this.changedSettings();
    },

    /** @param {string} id @param {boolean} on */
    show(id, on) {
        const el = UI.get(id);
        if (el) el.show(on);
    },

    /** @param {string} id @param {string} s */
    text(id, s) {
        const el = UI.get(id);
        if (el) el.setText(s);
    },

    /** @param {string} name */
    screen(name) {
        for (const [k, id] of Object.entries(this.PANELS)) this.show(id, k === name);
        const level = !!this.inLevel;
        // the main screen: the band under the column; a window over it: the window's dim
        this.show('menuSide', !level);
        this.show('menuDim', level || name !== 'main');
        for (const id of ['menuTitle', 'menuSub']) this.show(id, !level);
        this.show('menuSetExit', level);
        this.at = name;
        this.renderSub();
        if (name === 'campaign') this.renderCampaign();
        if (name === 'diff') {
            this.diff = Profile.DIFFICULTY;
            this.renderDiff();
        }
        if (name === 'settings') {
            this.showAsk(false);
            this.langOpen = false;
            this.profile = Profile.load();
            this.settingsAt = Profile.settingsOf(this.profile);
            const v = ScreenMode.now();
            this.screenAt = v ? ScreenMode.pick(v) : null;
            this.renderSettings();
        }
    },

    // «Украдено» under the title.
    renderSub() {
        this.text('menuSub', CoopText.t('menu.stolen', { sum: CoopText.num(Profile.stolen(this.profile)) }));
    },

    // «Начать новую»: the choice of the difficulty; the demo has none — the marked one at once (rules 38).
    pickDifficulty() {
        if (this.demo()) this.startCampaign(Profile.DIFFICULTY);
        else this.screen('diff');
    },

    // A new campaign at a difficulty from the first level of the ladder: the old one is gone only now.
    /** @param {string} difficulty */
    startCampaign(difficulty) {
        Profile.newCampaign(this.profile, difficulty);
        Profile.save(this.profile);
        const first = this.levels()[0];
        if (first) this.go(this.address(first.id, 'single', true));
    },

    renderCampaign() {
        const v = this.campaignView(this.profile), lv = this.levels().find(l => l.id === v.next);
        this.show('menuCampAsk', false);
        this.show('menuCampContinue', !!v.next);
        this.show('menuCampContinueOff', !v.next);
        this.text('menuCampNote', !this.profile.campaign ? CoopText.t('menu.camp_none')
            : v.done ? CoopText.t(this.demo() ? 'menu.camp_demo_done' : 'menu.camp_done') : CoopText.t('menu.camp_next', { level: lv ? lv.title : v.next }));
        const c = this.profile.campaign, d = c && Profile.DIFFICULTIES.find(x => x.id === c.difficulty);
        this.show('menuCampDiff', !!d && !this.demo());   // the demo: no difficulty (rules 38)
        if (d) this.text('menuCampDiff', CoopText.t('menu.camp_difficulty', { name: d.name }));
    },

    // The choice of the difficulty, a switch (Ivan 17.11): the picked one (this.diff; on opening Profile.DIFFICULTY,
    // whatever the old campaign had) in the chosen look with ✓, as a chosen button of the settings (rules 34).
    renderDiff() {
        for (const d of Profile.DIFFICULTIES) {
            const el = UI.get(this.DIFF_IDS[d.id]), marked = d.id === this.diff;
            if (!el) continue;
            el.setText((marked ? '✓ ' : '') + d.name);
            if (el.setLook) el.setLook(marked ? 'buttonOn' : null);
        }
    },

    // «−» / «+» of a volume: the window's profile, Sound3D's channels, the row — not Store (only «Сохранить»).
    /** @param {VolumeKey} key @param {number} dir */
    setVolume(key, dir) {
        Profile.nudge(this.profile, key, dir);
        this.changedSettings();
    },

    // The on/off button of a volume.
    /** @param {VolumeKey} key */
    toggleSound(key) {
        Profile.toggle(this.profile, key);
        this.changedSettings();
    },

    // A change in the window works at once: heard, shown.
    changedSettings() {
        this.applySettings(this.profile);
        this.renderSettings();
    },

    // The stored volumes into Sound3D and the language into the texts (main.js at start, and on every change).
    /** @param {PlayerProfile} [p] */
    applySettings(p = Profile.load()) {
        Sound3D.setPlayerVolume(Profile.volume(p, 'sound'), Profile.volume(p, 'music'));
        if (CoopText.setLang(p.lang)) this.relabel();
    },

    // The language changed: the layout's labels at once, the menu's own texts with them, the level behind the window
    // (CoopGame.relang) and the game window's title.
    relabel() {
        if (UI.relabel) UI.relabel();
        const app = /** @type {any} */ (window).app;
        if (app && app.game && typeof app.game.relang === 'function') app.game.relang();
        document.title = CoopText.t('menu.title');
        if (this.profile) {
            this.renderSub();
            if (this.at === 'campaign') this.renderCampaign();
            if (this.at === 'diff') this.renderDiff();
        }
    },

    // The rows of the language list (menuLangRow0…).
    langRows() {
        let n = 0;
        while (UI.get('menuLangRow' + n)) n++;
        return n;
    },

    // The language list opened (the current language in sight) or closed.
    /** @param {boolean} on */
    langList(on) {
        this.langOpen = on;
        if (on && this.profile) {
            const all = CoopText.languages(), n = this.langRows(), at = Math.max(0, all.findIndex(l => l.id === this.profile.lang));
            if (at < this.langFirst) this.langFirst = at;
            if (at >= this.langFirst + n) this.langFirst = at - n + 1;
        }
        this.scrollLang(0);
    },

    // The wheel over the open list: a row up (-1) or down (+1), within the list.
    /** @param {number} dir */
    scrollLang(dir) {
        const max = Math.max(0, CoopText.languages().length - this.langRows());
        this.langFirst = Math.max(0, Math.min(max, this.langFirst + dir));
        this.renderLang();
    },

    // A row of the list: its language at once, the list closed.
    /** @param {number} i */
    pickLang(i) {
        const l = CoopText.languages()[this.langFirst + i];
        if (!l || !this.profile) return;
        this.profile.lang = l.id;
        this.langOpen = false;
        this.changedSettings();
    },

    // The language row: the current language and ▲ (▼ while the list is open); the list — as many rows as languages up
    // to its rows, the current one in the select look with ✓, the bar on the right when there are more languages.
    renderLang() {
        if (!this.profile) return;
        const all = CoopText.languages(), n = this.langRows(), cur = all.find(l => l.id === this.profile.lang) || all[0];
        const look = (/** @type {string} */ id, /** @type {string | null} */ name) => { const el = UI.get(id); if (el && el.setLook) el.setLook(name); };
        this.text('menuLangName', cur.name);
        this.text('menuLangArrow', this.langOpen ? '▼' : '▲');
        this.show('menuLangCatch', this.langOpen);
        if (!this.langOpen) return;
        const list = UI.get('menuLangList'), r0 = UI.get('menuLangRow0'), r1 = UI.get('menuLangRow1');
        const pitch = r0 && r1 ? r1.def.y - r0.def.y : 0, shown = Math.min(n, all.length);
        if (list) list.sizeTo(list.def.w, list.def.h - (n - shown) * pitch);
        for (let i = 0; i < n; i++) {
            const l = all[this.langFirst + i], on = !!l && l.id === cur.id;
            this.show('menuLangRow' + i, !!l);
            if (!l) continue;
            this.text('menuLangName' + i, l.name);
            this.show('menuLangTick' + i, on);
            look('menuLangRow' + i, on ? 'select' : null);
            for (const id of ['menuLangName' + i, 'menuLangTick' + i]) look(id, on ? 'ink' : null);
        }
        const scroll = all.length > n, track = UI.get('menuLangTrack'), thumb = UI.get('menuLangThumb');
        this.show('menuLangTrack', scroll);
        this.show('menuLangThumb', scroll);
        if (scroll && track && thumb) {
            const h = track.def.h;
            thumb.sizeTo(thumb.def.w, Math.round(h * n / all.length));
            thumb.moveTo(thumb.def.x, track.def.y + Math.round(h * this.langFirst / all.length));
        }
    },

    // A mode's button, ◀ ▶ (rules 36, item 8): the shell changes the window at once; null — nothing to change
    // (the list's end, borderless).
    /** @param {DesktopScreenState | null} s */
    setScreen(s) {
        if (!s || !this.screenAt) return;
        ScreenMode.set(s);
        this.renderSettings();
    },

    // F10, F11, the window resized by hand (the shell's own): no change in the window — its rows show the new
    // screen, «Отмена» and the rollback keep it.
    /** @param {DesktopScreenView} v */
    screenOutside(v) {
        if (!this.screenAt) return;
        this.screenAt = ScreenMode.pick(v);
        this.renderSettings();
    },

    toggleFullscreen() {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else document.documentElement.requestFullscreen().catch(() => {});
    },

    renderSettings() {
        const p = this.profile;
        this.text('menuFullscreen', CoopText.t('menu.fullscreen', { on: !!document.fullscreenElement }));
        this.renderScreen();
        this.renderLang();
        for (const [k, key] of this.ROWS) {
            const bar = UI.get('menu' + k + 'Bar');
            if (bar) bar.setValue(p[key]);
            this.text('menu' + k + 'Value', Math.round(p[key] * 100) + '%');
            const icon = UI.get('menu' + k + 'Icon');
            if (icon) icon.setImage(this.ICONS[key][p[key + 'On'] ? 'on' : 'off']);
        }
        // nothing to cancel or save — the two are grey, pressed (rules 34: an unavailable button)
        const off = this.changed() ? null : 'buttonOff';
        for (const id of ['menuSetCancel', 'menuSetSave']) { const el = UI.get(id); if (el && el.setLook) el.setLook(off); }
    },

    // The PC build's screen rows: the chosen mode filled with the select role and ✓ before its word; the resolution
    // — ◀ ▶ grey at the list's ends, the whole row grey in borderless (the monitor's own). A browser — the old button.
    renderScreen() {
        const v = this.screenAt ? ScreenMode.view : null;
        this.show('menuFullscreen', !v);
        for (const id of this.SCREEN_ROWS) this.show(id, !!v);
        if (!v) return;
        const look = (/** @type {string} */ id, /** @type {string | null} */ name) => { const el = UI.get(id); if (el && el.setLook) el.setLook(name); };
        for (const [mode, id] of Object.entries(this.MODE_IDS)) {
            const el = UI.get(id);
            if (!el) continue;
            el.setText((v.mode === mode ? '✓ ' : '') + CoopText.label(el.def.id, el.def.text));
            look(id, v.mode === mode ? 'buttonOn' : null);
        }
        const [w, h] = ScreenMode.resolution(v);
        this.text('menuResValue', w + ' × ' + h);
        look('menuResPrev', ScreenMode.step(v, -1) ? null : 'buttonOff');
        look('menuResNext', ScreenMode.step(v, 1) ? null : 'buttonOff');
        for (const id of ['menuResLabel', 'menuResValue']) look(id, v.mode === 'borderless' ? 'inkOff' : null);
    },

    // «Главное меню» of the debug panel: back to the bare address (the main screen).
    bindBack() {
        const el = UI.get('btnMenu');
        if (el) el.onClick(() => this.go(''));
    }
};
