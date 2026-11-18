// CoopText.js — the texts the player sees (Ivan 10.11.2026: a text in the game's code is «строжайше
// запрещено архитектурой»). They live in ../design/texts/*.json — a file an area, a key a text — and
// reach the game as COOP_TEXTS in the generated CoopLevels.js (tools/make-coop-levels.mjs); Ivan edits
// them in the level book's sheet «Интерфейс». Code holds the key only: CoopText.t('log.alarm', { why }).
// A template's slots:
//   {x}       the value of x; a body ({ name, acc, fem }) gives its name
//   {x.acc}   a field of x (a body's accusative: «Васю Морковкина»)
//   {x:a|b}   a form chosen by x: a body — masculine | feminine (fem; guards have none — masculine);
//             a number — one | many, or one | few | many as Russian counts (1 клетку, 2 клетки, 5 клеток);
//             true / false — a | b by false | true
// The key of a text is <file>.<key> (log.alarm — design/texts/log.json, «alarm»).
// The language (rules, section 36, item 9): the languages are COOP_LANGUAGES (design/menu/languages.json), the first —
// the texts as they are; another one takes a text from COOP_TEXTS_LANG[lang] (the field en beside text in the data) and
// shows the first language's where it has none. setLang — at once, no restart: the labels of the layout follow it
// (label, UI.relabel), what the code wrote — by its next render.

/** @satisfies {Record<string, any>} */
const CoopText = {
    SLOT: /\{([A-Za-z_][\w]*)(?:\.([A-Za-z_]\w*))?(?::([^{}]*))?\}/g,
    // The language of the texts: an id of languages(); the first by default.
    lang: 'ru',

    // The texts: COOP_TEXTS of the page (a test may hand its own).
    /** @returns {Record<string, string>} */
    all() {
        return typeof COOP_TEXTS !== 'undefined' ? COOP_TEXTS : {};
    },

    // The languages of the game: [{ id, name — in itself, locale — of numbers }], the first is the base.
    /** @returns {{ id: string, name: string, locale: string }[]} */
    languages() {
        return typeof COOP_LANGUAGES !== 'undefined' && COOP_LANGUAGES.length ? COOP_LANGUAGES : [{ id: 'ru', name: 'ru', locale: 'ru-RU' }];
    },

    // The translations: { language: { key: text } } (a test may hand its own).
    /** @returns {Record<string, Record<string, string>>} */
    translations() {
        return typeof COOP_TEXTS_LANG !== 'undefined' ? COOP_TEXTS_LANG : {};
    },

    // The language of the texts from now on; an unknown one — the first. true — it changed.
    /** @param {string} id @returns {boolean} */
    setLang(id) {
        const all = CoopText.languages(), next = all.some(l => l.id === id) ? id : all[0].id, changed = next !== CoopText.lang;
        CoopText.lang = next;
        return changed;
    },

    // The text of key in the language, null — none there.
    /** @param {string} key @returns {string | null} */
    translated(key) {
        const tr = CoopText.translations()[CoopText.lang], s = tr && tr[key];
        return typeof s === 'string' ? s : null;
    },

    // The label of a layout record in the language: its ui.<id> translation, else its own text (the first language's).
    /** @param {string} id @param {string} text @returns {string} */
    label(id, text) {
        return CoopText.translated('ui.' + id) ?? text;
    },

    // A number as the language writes it (1 234 567 / 1,234,567).
    /** @param {number} v @param {Intl.NumberFormatOptions} [opts] @returns {string} */
    num(v, opts) {
        const l = CoopText.languages().find(x => x.id === CoopText.lang);
        return v.toLocaleString(l ? l.locale : 'ru-RU', opts);
    },

    // The fields of the level and hero data the player reads (rules, section 36, «Язык»): a level's title, the names of
    // rooms, doors, objects, guards, loot and heroes (name_acc — the accusative), a tutorial step's task and text, the
    // tutorial's window tips (map, hero). Another language's text is the field <k>_<id> beside it (title_en).
    FIELDS: ['title', 'name', 'name_acc', 'task', 'text', 'map', 'hero'],

    // A translation's field: { base, lang } of 'title_en' (base a text field, lang a language after the first), else null.
    /** @param {string} key @returns {{ base: string, lang: string } | null} */
    langField(key) {
        const m = /^(\w+)_([a-z]{2})$/.exec(key);
        if (!m || !CoopText.FIELDS.includes(m[1])) return null;
        return CoopText.languages().slice(1).some(l => l.id === m[2]) ? { base: m[1], lang: m[2] } : null;
    },

    // The data (a level, a hero) in the language: a deep copy where <k>_<lang> stands in for k; a form the language lacks
    // (English has no accusative) — its base: name_acc = name_acc_en ?? name_en. The first language — obj itself.
    /** @template T @param {T} obj @param {string} [lang] @returns {T} */
    localize(obj, lang = CoopText.lang) {
        if (lang === CoopText.languages()[0].id) return obj;
        const walk = (/** @type {any} */ v) => {
            if (Array.isArray(v)) return v.map(walk);
            if (!v || typeof v !== 'object') return v;
            /** @type {Record<string, any>} */
            const out = {};
            for (const k of Object.keys(v)) out[k] = walk(v[k]);
            for (const k of Object.keys(v)) {
                const f = CoopText.langField(k);
                if (f && f.lang === lang && typeof v[k] === 'string') out[f.base] = v[k];
            }
            for (const k of Object.keys(v)) {
                const base = k.endsWith('_acc') && CoopText.FIELDS.includes(k) ? k.slice(0, -4) : null;
                if (base && v[k + '_' + lang] === undefined && typeof v[base + '_' + lang] === 'string') out[k] = v[base + '_' + lang];
            }
            return out;
        };
        return walk(obj);
    },

    // The text fields of the data (a level, a hero) with no translation into lang: their paths from where (a list's item
    // by its id). An empty text and a case form (name_acc: the base's translation stands in) are not listed.
    /** @param {any} obj @param {string} lang @param {string} where @returns {string[]} */
    untranslated(obj, lang, where) {
        /** @type {string[]} */
        const out = [];
        const walk = (/** @type {any} */ v, /** @type {string} */ w) => {
            if (Array.isArray(v)) return v.forEach((x, i) => walk(x, w + '.' + (x && typeof x.id === 'string' ? x.id : i)));
            if (!v || typeof v !== 'object') return;
            for (const [k, x] of Object.entries(v)) {
                if (CoopText.FIELDS.includes(k) && !k.endsWith('_acc') && typeof x === 'string' && x.trim() && v[k + '_' + lang] === undefined) out.push(w + '.' + k);
                else if (x && typeof x === 'object') walk(x, w + '.' + k);
            }
        };
        walk(obj, where);
        return out;
    },

    // The translations of the data (a level, a hero) whose slots are not the base's ({name} vs {who}): their faults.
    /** @param {any} obj @param {string} where @returns {string[]} */
    langFaults(obj, where) {
        /** @type {string[]} */
        const out = [];
        const names = (/** @type {string} */ s) => [...new Set(CoopText.slots(s).map(sl => sl.name))].sort().join();
        const walk = (/** @type {any} */ v, /** @type {string} */ w) => {
            if (Array.isArray(v)) return v.forEach((x, i) => walk(x, w + '.' + (x && typeof x.id === 'string' ? x.id : i)));
            if (!v || typeof v !== 'object') return;
            for (const [k, x] of Object.entries(v)) {
                const f = CoopText.langField(k);
                if (f && typeof x === 'string' && typeof v[f.base] === 'string' && names(x) !== names(v[f.base])) out.push(w + '.' + k + ': слоты не те, что у русского');
                else if (x && typeof x === 'object') walk(x, w + '.' + k);
            }
        };
        walk(obj, where);
        return out;
    },

    // The text of key with the slots filled from args. A key not in the data shows itself in ⟨ ⟩
    // (tests/coop-texts.test.mjs finds every key of the code in the data before the game does).
    /** @param {string} key @param {Record<string, any>} [args] @returns {string} */
    t(key, args) {
        const s = CoopText.translated(key) ?? CoopText.all()[key];
        if (typeof s !== 'string') return '⟨' + key + '⟩';
        return CoopText.fill(s, args || {});
    },

    // A template with its slots filled; a slot with no value stays as it is (visible, not blank).
    /** @param {string} s @param {Record<string, any>} args @returns {string} */
    fill(s, args) {
        return s.replace(CoopText.SLOT, (all, name, field, forms) => {
            if (!(name in args)) return all;
            const v = args[name];
            if (forms != null) return CoopText.form(v, forms.split('|'));
            if (field) return v != null && v[field] != null ? String(v[field]) : (v && v.name != null ? String(v.name) : '');
            return v != null && typeof v === 'object' ? String(v.name) : String(v);
        });
    },

    // The form of the forms by v: see the slots above.
    /** @param {any} v @param {string[]} forms @returns {string} */
    form(v, forms) {
        if (typeof v === 'boolean') return forms[v ? 1 : 0] ?? '';
        if (typeof v === 'number') {
            if (forms.length < 3) return forms[Math.abs(v) === 1 ? 0 : 1] ?? '';
            const n = Math.abs(Math.trunc(v)), d = n % 10, h = n % 100;
            if (d === 1 && h !== 11) return forms[0];
            return d >= 2 && d <= 4 && (h < 12 || h > 14) ? forms[1] : forms[2];
        }
        return v && v.fem ? forms[1] ?? forms[0] : forms[0];
    },

    // The slots of a template: [{ name, field, forms }] — for the data's check.
    /** @param {string} s @returns {{ name: string, field: string | undefined, forms: string[] | null }[]} */
    slots(s) {
        return [...s.matchAll(CoopText.SLOT)].map(m => ({ name: m[1], field: m[2], forms: m[3] != null ? m[3].split('|') : null }));
    },

    // The data's faults: a text not a non-empty string, a form slot with one form or more than three,
    // a brace left unmatched. [] — clean.
    /** @param {Record<string, any>} texts @returns {string[]} */
    check(texts) {
        const bad = [];
        for (const [key, s] of Object.entries(texts)) {
            if (!/^[a-z][\w]*\.[a-z][\w.]*$/i.test(key)) bad.push(key + ': ключ — «файл.имя» латиницей');
            if (typeof s !== 'string' || !s.trim()) { bad.push(key + ': пустой текст'); continue; }
            for (const sl of CoopText.slots(s)) if (sl.forms && (sl.forms.length < 2 || sl.forms.length > 3)) bad.push(key + ': {' + sl.name + ':…} — 2 или 3 формы');
            if (/[{}]/.test(s.replace(CoopText.SLOT, ''))) bad.push(key + ': лишняя фигурная скобка');
        }
        return bad;
    },
};
