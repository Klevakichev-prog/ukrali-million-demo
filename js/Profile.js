// Profile.js — what the game keeps for the player between launches (Ivan 08.11.2026): the
// settings of the settings window (SETTINGS: the master volume, effects and music — a volume and on/off
// each; rules 36, 17.11) and the current campaign with its difficulty (rules 36, item 6: chosen when a campaign
// starts, not changed in it). One record in Store under KEY; a broken or foreign value reads as the
// defaults, field by field.
//
// The campaign is the ladder levels in their order, single player. It remembers the best won take
// of every level (CoopGame.won): the first level without one is where «Продолжить» goes, and the
// sum of them is «Украдено» on the main screen — replaying a won level does not add it twice.
// The difficulty is only remembered for now (Ivan 08.11: what it changes — a rule of its own later). A difficulty
// stored by the old settings window (the profile's own field) goes to the current campaign; no campaign — it is gone.
// The language (rules 36, item 9) is a setting of the window too: an id of CoopText.languages(), the first by default.
// The functions take the profile record and change it in place; load() and save() go to Store.

/** @typedef {{ takes: Record<string, number>, difficulty: string }} Campaign */
/** @typedef {{ master: number, sound: number, music: number, masterOn: boolean, soundOn: boolean, musicOn: boolean, lang: string, campaign: Campaign | null }} PlayerProfile */
/** @typedef {'master' | 'sound' | 'music'} VolumeKey */

/** @satisfies {Record<string, any>} */
const Profile = {
    KEY: 'ukrali.profile',
    // The difficulties of the campaign in the order of the choice «Лёгкий · Нормальный · Тяжёлый»; DIFFICULTY — the marked one.
    DIFFICULTIES: ['easy', 'normal', 'hard'].map(id => ({ id, get name() { return CoopText.t('menu.difficulty_' + id); } })),
    DIFFICULTY: 'normal',
    VOLUME_STEPS: 10,   // a press of «−» or «+» moves a volume by 1 / VOLUME_STEPS
    // The fields of the settings window (rules 36): what «Сбросить» resets, what «Отмена» and «Сохранить» look at,
    // what a launch brings back — each has its test «сохранил → загрузил → то же» (main-menu.test.mjs).
    SETTINGS: /** @type {(keyof PlayerProfile)[]} */ (['master', 'masterOn', 'sound', 'soundOn', 'music', 'musicOn', 'lang']),

    /** @returns {PlayerProfile} */
    defaults() {
        return { master: 1, sound: 1, music: 1, masterOn: true, soundOn: true, musicOn: true, lang: CoopText.languages()[0].id, campaign: null };
    },

    // A stored value made safe: volumes 0..1, a known language and difficulty, takes — positive numbers only.
    /** @param {any} raw @returns {PlayerProfile} */
    clean(raw) {
        const p = this.defaults();
        if (!raw || typeof raw !== 'object') return p;
        const unit = (/** @type {any} */ v, /** @type {number} */ d) => (typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(1, v)) : d);
        for (const k of /** @type {VolumeKey[]} */ (['master', 'sound', 'music'])) {
            p[k] = unit(raw[k], p[k]);
            if (typeof raw[k + 'On'] === 'boolean') p[k + 'On'] = raw[k + 'On'];
        }
        if (CoopText.languages().some(l => l.id === raw.lang)) p.lang = raw.lang;
        const known = (/** @type {any} */ d) => this.DIFFICULTIES.some(x => x.id === d);
        const c = raw.campaign;
        if (c && typeof c === 'object') {
            p.campaign = { takes: {}, difficulty: known(c.difficulty) ? c.difficulty : known(raw.difficulty) ? raw.difficulty : this.DIFFICULTY };
            for (const [id, v] of Object.entries(c.takes || {}))
                if (typeof v === 'number' && isFinite(v) && v > 0) p.campaign.takes[id] = v;
        }
        return p;
    },

    /** @returns {PlayerProfile} */
    load() {
        return this.clean(Store.getJSON(this.KEY));
    },

    /** @param {PlayerProfile} p */
    save(p) {
        Store.set(this.KEY, JSON.stringify(p));
    },

    // A new campaign from the first level at a difficulty: the takes of the previous one are gone.
    /** @param {PlayerProfile} p @param {string} [difficulty] */
    newCampaign(p, difficulty) {
        p.campaign = { takes: {}, difficulty: difficulty || this.DIFFICULTY };
    },

    // A won take of a campaign level: the level keeps the best one. No campaign — nothing.
    /** @param {PlayerProfile} p @param {string} id @param {number} money */
    record(p, id, money) {
        if (!p.campaign || !(money > 0)) return;
        p.campaign.takes[id] = Math.max(p.campaign.takes[id] || 0, money);
    },

    // «Украдено»: the best takes of the campaign's levels summed; no campaign — 0.
    /** @param {PlayerProfile} p */
    stolen(p) {
        return p.campaign ? Object.values(p.campaign.takes).reduce((a, b) => a + b, 0) : 0;
    },

    // What a channel plays at (rules 36, 17.11): the master volume times its own, each 0 while it is off — the
    // master off silences both channels, their volumes stay ('sound' — the effects, 'music').
    /** @param {PlayerProfile} p @param {'sound' | 'music'} key */
    volume(p, key) {
        const level = (/** @type {VolumeKey} */ k) => (p[k + 'On'] ? p[k] : 0);
        return level('master') * level(key);
    },

    // The settings of the window alone (SETTINGS), a copy: what the window opened with.
    /** @param {PlayerProfile} p @returns {Partial<PlayerProfile>} */
    settingsOf(p) {
        return Object.fromEntries(this.SETTINGS.map(k => [k, p[k]]));
    },

    // Are the window's settings of a the same as b (a profile or settingsOf)?
    /** @param {Partial<PlayerProfile>} a @param {Partial<PlayerProfile>} b */
    sameSettings(a, b) {
        return this.SETTINGS.every(k => a[k] === b[k]);
    },

    // «Сбросить»: the window's settings to the defaults; the campaign (and its difficulty) stays.
    /** @param {PlayerProfile} p */
    resetSettings(p) {
        Object.assign(p, this.settingsOf(this.defaults()));
    },

    // On/off of a volume; the volume stays for when it is on again.
    /** @param {PlayerProfile} p @param {VolumeKey} key */
    toggle(p, key) {
        p[key + 'On'] = !p[key + 'On'];
    },

    // «−» / «+» of a volume: a step away, and it is on (my default 08.11: a press that changes the
    // volume of a silent channel should be heard).
    /** @param {PlayerProfile} p @param {VolumeKey} key @param {number} dir */
    nudge(p, key, dir) {
        p[key] = this.step(p[key], dir);
        p[key + 'On'] = true;
    },

    // A volume a press away (dir +1 / -1), on whole steps, within 0..1.
    /** @param {number} v @param {number} dir */
    step(v, dir) {
        const n = this.VOLUME_STEPS;
        return Math.max(0, Math.min(n, Math.round(v * n) + dir)) / n;
    }
};
