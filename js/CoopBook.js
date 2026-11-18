// CoopBook.js — the levels from the level book: the Google sheet «Они Украли миллион» (Ivan 29.10: the sheet
// is the source of the levels). read(bytes) takes the sheet's xlsx export apart (values, fills, the cached
// results of formulas); level(book, n, kept) builds level n as design/levels/*.json has it. What the book
// does not hold (the solutions, the lab block, notes, a panel's effect) comes from kept — the level as the
// game has it now. A wrong cell throws, naming the sheet, the cell and what is wrong.
//
// The book: Легенда (codes; the fill of a room letter is that room's colour), Уровни (a row a level),
// Тексты, Комнаты, Двери, Добыча, Щитки, Лазеры, Камеры, Охрана, Маршруты (a table a type, a row an
// object: уровень | код | fields), Виды (the kinds of guards and cameras: their vision), Обучение (the steps
// of a tutorial, rules section 27: уровень | шаг | нажать | объект | клетка | действие | задание | текст), N · Объекты
// (the grid of level N: an object code a cell, the fill of a cell is its room), Интерфейс (the texts the
// player sees, ../design/texts/*.json: ключ | текст | где видно — texts(book)). The tool that writes
// the book and the same reader in Python: tmp/ukrali/sheet (levelbook.py, book_write.py) on the VM; the levels into design/levels: tools/levels-from-sheet.mjs.

/** @satisfies {Record<string, any>} */
const CoopBook = {
    URL: 'https://docs.google.com/spreadsheets/d/1PwL7N_rj7-y_hm-uiMBiEEieK9y30fHBpR3Pd_p1d5g/export?format=xlsx',
    FLOOR: { room: 'комната', hall: 'зал', corridor: 'коридор', office: 'кабинет', vault: 'хранилище', utility: 'подсобка',
        guards: 'охрана', loading: 'погрузка', street: 'улица', alley: 'переулок' },
    SIDE: { N: 'север', S: 'юг', E: 'восток', W: 'запад' },
    DIR8: { N: 'север', NE: 'северо-восток', E: 'восток', SE: 'юго-восток', S: 'юг', SW: 'юго-запад', W: 'запад', NW: 'северо-запад' },
    CAMERA: { local: 'местная', online: 'онлайн' },
    LOCK: { '': 'нет', mechanical: 'механический', electronic: 'электронный', vault: 'сейфовый' },
    POWERS: [['свет', 'light'], ['датчики', 'sensors'], ['лазеры', 'lasers']],
    VAN: 'Ф',
    // the letter of a loot code -> its flag
    LOOT: /** @type {Record<string, string>} */ ({ 'В': 'glass', 'П': 'stand', 'Х': 'wall', 'Т': '' }),
    // a press of the tutorial (CoopTutorial.KINDS; a plate, 'note', has no word: an empty нажать) and the action of an «act» step (CoopCheck.VERBS)
    TUT_DO: { tap: 'объект', cell: 'клетка', act: 'действие', ask: 'совет', undo: 'отменить', start: 'начать ограбление' },
    // the rows of the tutorial's window tips (rules, section 33): not steps — the texts of the plates on the plan sheet and the hero's card
    TUT_TIP: { map: 'окно плана', hero: 'окно героя' },
    // The English columns (rules, section 36, «Язык»), each sheet's last: «Тексты», «Интерфейс» — EN; «Обучение» — two.
    EN: 'EN',
    TUT_EN: { task: 'задание EN', text: 'текст EN' },
    TUT_VERB: { pick: 'вскрыть дверь', hack: 'электрозамок', lock: 'запереть', open: 'открыть', close: 'закрыть',
        power: 'погасить щиток', smash: 'разбить витрину', unlock: 'вскрыть витрину', take: 'взять', grab: 'схватить', gather: 'собрать', drop: 'положить',
        knock: 'вырубить', tie: 'связать' },
    // what the book does not hold: stays as the game has it
    KEPT: ['note', 'tasks', 'solution', 'solution_loud', 'solution_loud_all', 'lab', 'night'],
    RULE_NOTES: ['work', 'loot', 'stun', 'collision'],

    // ------------------------------------------------------------------ xlsx
    /**
     * The sheets of an xlsx: {title: rows, title + '#fill': the fills ('#rrggbb' or '')}.
     * @param {Uint8Array} bytes
     * @returns {Promise<Record<string, any[][]>>}
     */
    async read(bytes) {
        const files = await CoopBook.unzip(bytes);
        const xml = (/** @type {string} */ name) => {
            if (!(name in files)) throw new Error('xlsx: нет ' + name);
            return files[name];
        };
        const text = (/** @type {string} */ s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&amp;/g, '&');
        const ts = (/** @type {string} */ s) => [...s.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m => text(m[1])).join('');
        const attr = (/** @type {string} */ tag, /** @type {string} */ a) => {
            const m = tag.match(new RegExp('\\s' + a + '="([^"]*)"'));
            return m ? text(m[1]) : null;
        };
        const shared = 'xl/sharedStrings.xml' in files
            ? [...xml('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => ts(m[1])) : [];
        const styles = xml('xl/styles.xml');
        const fills = [...(styles.match(/<fills[^>]*>([\s\S]*?)<\/fills>/) || ['', ''])[1].matchAll(/<fill>([\s\S]*?)<\/fill>/g)].map(m => {
            const solid = /patternType="solid"/.test(m[1]), fg = m[1].match(/<fgColor[^>]*rgb="([0-9A-Fa-f]{6,8})"/);
            return solid && fg ? '#' + fg[1].slice(-6).toLowerCase() : '';
        });
        const xfFill = [...(styles.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/) || ['', ''])[1].matchAll(/<xf\b[^>]*>/g)]
            .map(m => fills[+(attr(m[0], 'fillId') || 0)] || '');
        const rels = /** @type {Record<string, string>} */ ({});
        for (const m of xml('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)) rels[attr(m[0], 'Id') || ''] = attr(m[0], 'Target') || '';
        const out = /** @type {Record<string, any[][]>} */ ({});
        for (const m of xml('xl/workbook.xml').matchAll(/<sheet\b[^>]*>/g)) {
            const name = attr(m[0], 'name') || '', target = rels[attr(m[0], 'r:id') || ''];
            const cells = new Map(), fill = new Map();
            let nr = 0, nc = 0;
            for (const c of xml('xl/' + target.replace(/^\/?(xl\/)?/, '')).matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
                const head = '<c' + c[1] + '>', body = c[2] || '';
                const r = (attr(head, 'r') || '').match(/^([A-Z]+)(\d+)$/);
                if (!r) continue;
                let col = 0;
                for (const ch of r[1]) col = col * 26 + ch.charCodeAt(0) - 64;
                const key = (+r[2] - 1) + ',' + (col - 1), s = attr(head, 's'), t = attr(head, 't');
                if (s && xfFill[+s]) fill.set(key, xfFill[+s]);
                const v = body.match(/<v>([\s\S]*?)<\/v>/);
                let val;
                if (t === 's') val = shared[+(v ? v[1] : 0)];
                else if (t === 'b') val = !!v && v[1] === '1';
                else if (t === 'inlineStr') val = ts(body);
                else if (!v) continue;
                else if (t === 'str' || t === 'e') val = text(v[1]);
                else val = +v[1];
                cells.set(key, val);
                nr = Math.max(nr, +r[2]);
                nc = Math.max(nc, col);
            }
            if (!cells.size) continue;
            const grid = (/** @type {Map<string, any>} */ src) => Array.from({ length: nr }, (_, i) =>
                Array.from({ length: nc }, (_, j) => src.has(i + ',' + j) ? src.get(i + ',' + j) : ''));
            out[name] = grid(cells);
            out[name + '#fill'] = grid(fill);
        }
        return out;
    },

    /**
     * The files of a zip (stored or deflated), as text.
     * @param {Uint8Array} b
     * @returns {Promise<Record<string, string>>}
     */
    async unzip(b) {
        const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
        let e = b.length - 22;
        while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
        if (e < 0) throw new Error('xlsx: не zip — таблица не скачалась?');
        const count = dv.getUint16(e + 10, true);
        let p = dv.getUint32(e + 16, true);
        const out = /** @type {Record<string, string>} */ ({}), dec = new TextDecoder();
        for (let i = 0; i < count; i++) {
            const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true);
            const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
            const name = dec.decode(b.subarray(p + 46, p + 46 + nlen)), local = dv.getUint32(p + 42, true);
            p += 46 + nlen + xlen + clen;
            if (!name.endsWith('.xml') && !name.endsWith('.rels')) continue;
            const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
            const raw = b.subarray(start, start + size);
            if (method === 0) out[name] = dec.decode(raw);
            else if (method === 8) {
                const stream = new Blob([/** @type {BlobPart} */ (/** @type {unknown} */ (raw))]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
                out[name] = await new Response(stream).text();
            } else throw new Error('xlsx: сжатие ' + method + ' не поддерживается (' + name + ')');
        }
        return out;
    },

    // ------------------------------------------------------------------ book -> level
    /**
     * The rows of a table for level n, as {header: value}.
     * @param {Record<string, any[][]>} book @param {string} t @param {number} n
     */
    table(book, t, n) {
        const rows = book[t];
        if (!rows) throw new Error('в таблице нет листа «' + t + '»');
        const head = rows[0].map(h => String(h).trim());
        return rows.slice(1).filter(r => r[0] !== '' && r[0] !== undefined && +r[0] === n)
            .map(r => Object.fromEntries(head.map((h, i) => [h, i < r.length ? r[i] : ''])));
    },

    // The content the book names, from the data of the game (CoopLevels.js): a loot model -> its name in
    // «Добыча».модель (objects.json, loot.models), a hero -> his code on a grid sheet (heroes.json, book).
    /** @returns {Record<string, string>} */
    models() {
        return Object.fromEntries(Object.entries(COOP_OBJECTS.loot.models).filter(([k]) => k !== 'note'));
    },
    /** @returns {Record<string, string>} */
    heroes() {
        return Object.fromEntries(COOP_HEROES.map(h => [h.id, h.book]));
    },

    /** @param {Record<string, string>} d @param {any} v @param {string} where */
    back(d, v, where) {
        const k = Object.keys(d).find(k => d[k] === v);
        if (k === undefined) throw new Error(where + ': «' + v + '» — одно из: ' + Object.values(d).join(', '));
        return k;
    },

    /** @param {any} v */
    flag(v) {
        return v === true || ['TRUE', 'ИСТИНА', '1'].includes(String(v).trim().toUpperCase());
    },

    /** An empty cell (none, null or blanks). @param {any} v */
    blank(v) {
        return v === undefined || v === null || String(v).trim() === '';
    },

    /** The column letter of a 0-based index. @param {number} i */
    col(i) {
        let s = '';
        for (i++; i; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s;
        return s;
    },

    /**
     * Greedy cover of a cell set by rects, rows first.
     * @param {number[][]} cells
     */
    rects(cells) {
        const left = new Set(cells.map(c => c[0] + ',' + c[1])), out = [];
        while (left.size) {
            const [x0, y0] = [...left].map(k => k.split(',').map(Number)).sort((a, b) => a[1] - b[1] || a[0] - b[0])[0];
            let x1 = x0, y1 = y0;
            while (left.has((x1 + 1) + ',' + y0)) x1++;
            const row = (/** @type {number} */ y) => { for (let x = x0; x <= x1; x++) if (!left.has(x + ',' + y)) return false; return true; };
            while (row(y1 + 1)) y1++;
            out.push([x0, y0, x1, y1]);
            for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) left.delete(x + ',' + y);
        }
        return out;
    },

    /**
     * The wall a painting hangs on: the wall of its cell — a side to another room or off the level, not a
     * door; in a corner the side wall (W, E) before N; no paintings on the south wall (Ivan 29.10).
     * @param {number[]} at @param {Map<string, string>} room @param {Set<string>} doors
     */
    wallOf(at, room, doors) {
        const [x, y] = at;
        for (const [side, dx, dy] of /** @type {[string, number, number][]} */ ([['W', -1, 0], ['E', 1, 0], ['N', 0, -1]])) {
            if (room.get((x + dx) + ',' + (y + dy)) !== room.get(x + ',' + y) && !doors.has(x + ',' + y + side)) return side;
        }
        return null;
    },

    /**
     * Level n of the book as design/levels/*.json has it.
     * @param {Record<string, any[][]>} book @param {number} n @param {any} [kept] the level as the game has it
     */
    level(book, n, kept) {
        const B = CoopBook, sheet = n + ' · Объекты';
        const og = book[sheet], fills = book[sheet + '#fill'];
        if (!og) throw new Error('в таблице нет листа «' + sheet + '»');
        let W = 0, H = 0;
        while (W + 1 < og[0].length && og[0][W + 1] === W) W++;
        while (H + 1 < og.length && og[H + 1][0] === H) H++;
        const at = (/** @type {any[][]} */ g, /** @type {number} */ x, /** @type {number} */ y) => String((g[y + 1] || [])[x + 1] ?? '').trim();
        const letter = new Map(), legend = book['Легенда'], lfill = book['Легенда#fill'];
        legend.slice(1).forEach((r, i) => { const f = (lfill[i + 1] || [])[0]; if (r[2] === 'комнаты' && f) letter.set(f.toLowerCase(), r[0]); });
        const rg = Array.from({ length: H }, () => Array(W).fill('')), bad = [];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const f = at(fills, x, y).toLowerCase();
            if (!f || f === '#ffffff') continue;
            if (!letter.has(f)) bad.push('«' + sheet + '» ' + B.col(x + 1) + (y + 2) + ' (x ' + x + ', y ' + y + '): цвет ' + f + ' — не цвет комнаты из «Легенды»');
            else rg[y][x] = letter.get(f);
        }
        if (bad.length) throw new Error(bad.join('\n'));
        const lv = B.table(book, 'Уровни', n)[0];
        if (!lv) throw new Error('на листе «Уровни» нет уровня ' + n);
        const trows = B.table(book, 'Тексты', n);
        const text = Object.fromEntries(trows.map(r => [r['код'], r['текст']]));
        const acc = Object.fromEntries(trows.map(r => [r['код'], r['кого (вин. п.)'] || '']));
        // the English of a text (rules, section 36, «Язык»): the column EN, last; an empty cell or no column — no field
        const en = Object.fromEntries(trows.filter(r => !B.blank(r[B.EN])).map(r => [r['код'], String(r[B.EN])]));
        const tr = (/** @type {string} */ code, /** @type {string} */ k) => (code in en ? { [k + '_en']: en[code] } : {});
        /** @type {any} */
        const L = { id: lv['id в игре'], title: text['Уровень'], ...tr('Уровень', 'title') };
        if (n) L.order = n;   // level 0 is the tutorial: off the campaign ladder (rules, section 27)
        const where = /** @type {Record<string, number[][]>} */ ({});
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = at(og, x, y); if (c) (where[c] = where[c] || []).push([x, y]); }
        const first = (/** @type {string} */ code, /** @type {string} */ t) => {
            if (!where[code]) throw new Error('«' + t + '», уровень ' + n + ': ' + code + ' нет на карте «' + sheet + '»');
            return [...where[code][0]];
        };
        const heroes = Object.entries(B.heroes()).flatMap(([h, code]) => (where[code] || []).map(c => ({ h, c })))
            .sort((a, b) => a.c[1] - b.c[1] || a.c[0] - b.c[0]);
        L.team = heroes.map(q => q.h);
        L.heroes_at = Object.fromEntries(heroes.map(q => [q.h, [...q.c]]));
        L.grid = { w: W, h: H };
        const rooms = B.table(book, 'Комнаты', n);
        const cells = /** @type {Record<string, number[][]>} */ (Object.fromEntries(rooms.map(r => [r['код'], []])));
        const van = [];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            if (rg[y][x] === B.VAN) van.push([x, y]);
            else if (rg[y][x]) {
                if (!cells[rg[y][x]]) throw new Error('«' + sheet + '» ' + B.col(x + 1) + (y + 2) + ': комнаты ' + rg[y][x] + ' нет на листе «Комнаты» уровня ' + n);
                cells[rg[y][x]].push([x, y]);
            }
        }
        // the van stands in the outside room around it (a tie: the first met)
        const near = van.flatMap(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => (rg[y + dy] || [])[x + dx])
            .filter(r => r && r !== B.VAN));
        if (van.length) {
            const count = (/** @type {string} */ r) => near.filter(q => q === r).length;
            cells[near.reduce((a, r) => count(r) > count(a) ? r : a, near[0])].push(...van);
        }
        L.zones = [];
        for (const r of rooms) {
            const code = r['код'], rs = B.rects(cells[code]);
            rs.forEach((rc, i) => {
                /** @type {any} */
                const z = { id: i ? code + '_' + (i + 1) : code, floor: B.back(B.FLOOR, r['пол'], '«Комнаты» ' + code + '.пол'), name: text[code], ...tr(code, 'name'), rect: rc };
                if (B.flag(r['снаружи'])) z.kind = 'outside';
                if (rs.length > 1) z.room = code;
                L.zones.push(z);
            });
        }
        const roomAt = new Map();
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (rg[y][x]) roomAt.set(x + ',' + y, rg[y][x]);
        L.doors = [];
        const doorSides = new Set(), step = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] }, other = { N: 'S', S: 'N', W: 'E', E: 'W' };
        for (const r of B.table(book, 'Двери', n)) {
            first(r['код'], 'Двери');
            const cs = where[r['код']].slice().sort((a, b) => a[1] - b[1] || a[0] - b[0]);
            /** @type {any} */
            const d = { id: r['код'], at: [...cs[0]], side: B.back(B.SIDE, r['сторона'], '«Двери» ' + r['код'] + '.сторона'),
                lock: B.back(B.LOCK, r['замок'], '«Двери» ' + r['код'] + '.замок') || null };
            if (cs.length > 1) d.width = cs.length;
            if (B.flag(r['датчик'])) d.sensor = true;
            if (B.flag(r['закрыта'])) d.shut = true;
            if (r['код'] in text) Object.assign(d, { name: text[r['код']] }, tr(r['код'], 'name'));
            L.doors.push(d);
            const [dx, dy] = step[/** @type {'N'} */ (d.side)];
            for (const [x, y] of cs) { doorSides.add(x + ',' + y + d.side); doorSides.add((x + dx) + ',' + (y + dy) + other[/** @type {'N'} */ (d.side)]); }
        }
        L.objects = [];
        for (const r of B.table(book, 'Щитки', n)) {
            /** @type {any} */
            const o = { id: r['код'], kind: 'power_panel', at: first(r['код'], 'Щитки'), powers: B.POWERS.filter(([lab]) => B.flag(r[lab])).map(p => p[1]) };
            if (r['код'] in text) Object.assign(o, { name: text[r['код']] }, tr(r['код'], 'name'));
            L.objects.push(o);
        }
        if (van.length) {
            const xs = van.map(c => c[0]), ys = van.map(c => c[1]);
            /** @type {any} */
            const o = { id: B.VAN, kind: 'van', rect: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
                exit: B.back(B.SIDE, lv['фургон уезжает на'], '«Уровни» фургон уезжает на'),
                police_from: B.back(B.SIDE, lv['полиция приезжает с'], '«Уровни» полиция приезжает с') };
            if (B.VAN in text) Object.assign(o, { name: text[B.VAN] }, tr(B.VAN, 'name'));
            L.objects.push(o);
        }
        for (const r of B.table(book, 'Лазеры', n)) {
            first(r['код'], 'Лазеры');
            L.objects.push({ id: r['код'], kind: 'lasers', cells: where[r['код']].slice().sort((a, b) => a[1] - b[1] || a[0] - b[0]).map(c => [...c]) });
        }
        const kinds = /** @type {Record<string, any>} */ ({});
        const kh = book['Виды'][0].map(h => String(h).trim());
        for (const r of book['Виды'].slice(1)) { const k = Object.fromEntries(kh.map((h, i) => [h, r[i]])); if (k['вид']) kinds[k['вид']] = k; }
        const kind = (/** @type {string} */ name, /** @type {string} */ who, /** @type {string} */ code) => {
            const k = kinds[name];
            if (!k || k['кто'] !== who) throw new Error(code + ': вид «' + name + '» — не вид «' + who + '» с листа «Виды»');
            return k;
        };
        const points = /** @type {Record<string, [number, number[]][]>} */ ({});
        for (const r of B.table(book, 'Маршруты', n)) (points[r['охранник']] = points[r['охранник']] || []).push([+r['№'], first(r['код'], 'Маршруты')]);
        L.guards = [];
        for (const r of B.table(book, 'Охрана', n)) {
            const code = r['код'], k = kind(r['вид'], 'охранник', code);
            /** @type {any} */
            const g = { id: code, name: text[code], ...tr(code, 'name') };
            if (acc[code]) g.name_acc = acc[code];
            if (r['стоит каждые, шагов'] !== '') g.stop_every = r['стоит каждые, шагов'];
            if (points[code]) {
                const p = points[code].sort((a, b) => a[0] - b[0]).map(q => q[1]);
                g.patrol = [...p, [...p[0]]];
            } else g.post = first(code, 'Охрана');
            if (r['смотрит']) g.facing = B.back(B.DIR8, r['смотрит'], '«Охрана» ' + code + '.смотрит');
            g.cone = { range: k['обзор, клеток'], fov_deg: k['угол обзора°'] };
            L.guards.push(g);
        }
        L.cameras = [];
        for (const r of B.table(book, 'Камеры', n)) {
            const code = r['код'], k = kind(r['вид'], 'камера', code);
            /** @type {any} */
            const c = { id: code, kind: B.back(B.CAMERA, r['тип'], '«Камеры» ' + code + '.тип') };
            if (c.kind === 'local') c.watcher = r['наблюдатель'];
            c.at = first(code, 'Камеры');
            c.dir = B.back(B.DIR8, r['смотрит'], '«Камеры» ' + code + '.смотрит');
            if (r['поворот°'] !== '') c.sweep_deg = r['поворот°'];
            c.range = k['обзор, клеток'];
            c.fov_deg = k['угол обзора°'];
            L.cameras.push(c);
        }
        L.loot = [];
        for (const r of B.table(book, 'Добыча', n)) {
            const code = r['код'], f = B.LOOT[code[0]];
            if (f === undefined) throw new Error('«Добыча» ' + code + ': код начинается не с В, П, Х или Т');
            /** @type {any} */
            const l = { id: code, model: B.back(B.models(), r['модель'], '«Добыча» ' + code + '.модель'), at: first(code, 'Добыча'),
                value: r['ценность'], mass: r['масса'], name: text[code], ...tr(code, 'name') };
            if (f === 'glass' || f === 'stand') l[f] = true;
            if (f === 'wall') {
                l.wall = B.wallOf(l.at, roomAt, doorSides);
                if (!l.wall) throw new Error('«Добыча» ' + code + ' ' + JSON.stringify(l.at) + ': у клетки нет стены для картины (северной, западной или восточной)');
            }
            if (B.flag(r['датчик'])) l.sensor = true;
            if (B.flag(r['подсказка'])) l.hint = true;
            if (B.flag(r['мульти'])) l.multi = true;   // a pile: a grab from a smashed vitrine loses a quarter (rules, section 10, 09.11)
            L.loot.push(l);
        }
        L.rules = { glass_noise_cells: lv['шум стекла, клеток'], alarm_police_ticks: lv['полиция после тревоги, тиков'], patrol_ticks: lv['патруль, тиков'] };
        L.goal = { stars: [lv['звезда 1'], lv['звезда 2'], lv['звезда 3']] };
        const steps = B.tutorial(book, n);
        if (steps.length) L.tutorial = steps;
        const tips = B.tutorialTips(book, n);
        if (Object.keys(tips).length) L.tutorial_tips = tips;
        if (kept) {
            for (const k of B.KEPT) if (k in kept) L[k] = kept[k];
            for (const k of B.RULE_NOTES) if (kept.rules && k in kept.rules) L.rules[k] = kept.rules[k];
            // dev notes on objects (the panel's effect) stay as the game has them
            const same = (/** @type {any} */ a, /** @type {any} */ b) => JSON.stringify(a) === JSON.stringify(b);
            for (const o of L.objects) {
                const old = (kept.objects || []).find((/** @type {any} */ p) => p.kind === o.kind && same(p.at, o.at) && same(p.rect, o.rect));
                if (old && old.effect) o.effect = old.effect;
            }
        }
        return L;
    },

    /**
     * The steps of level n's tutorial from the sheet «Обучение», in the order of its rows (rules, section 32: шаг is
     * for the reader, the game counts the presses itself); an empty уровень — the level of the row above. A row with
     * nothing to press and no task is a plate of text (do: 'note'); with a task — an error, not a plate (none — []).
     * @param {Record<string, any[][]>} book @param {number} n
     */
    tutorial(book, n) {
        const B = CoopBook, rows = book['Обучение'];
        if (!rows) throw new Error('в таблице нет листа «Обучение»');
        const head = rows[0].map(h => String(h).trim()), blank = (/** @type {any} */ v) => v === undefined || v === null || String(v).trim() === '';
        /** @type {any[]} */
        const out = [];
        let lv = NaN;
        rows.slice(1).forEach((cells, i) => {
            const r = Object.fromEntries(head.map((h, j) => [h, j < cells.length ? cells[j] : '']));
            if (!blank(r['уровень'])) lv = +r['уровень'];
            if (lv !== n || (blank(r['нажать']) && blank(r['задание']) && blank(r['текст']))) return;
            const w = '«Обучение», уровень ' + n + ', строка ' + (i + 2) + '.';
            if (Object.values(B.TUT_TIP).includes(String(r['нажать']).trim())) return;   // a window's tip, not a step (tutorialTips)
            // the English (rules, section 36, «Язык»): the columns «задание EN», «текст EN», last; empty — no field
            const en = (/** @type {string} */ h, /** @type {string} */ k) => (blank(r[h]) ? {} : { [k]: String(r[h]) });
            if (blank(r['нажать'])) {
                if (!blank(r['задание'])) throw new Error(w + 'нажать: пусто при задании «' + String(r['задание']).trim() + '» — без нажатия бывает только плашка с текстом');
                out.push({ do: 'note', text: String(r['текст']), ...en(B.TUT_EN.text, 'text_en') });
                return;
            }
            /** @type {any} */
            const s = { do: B.back(B.TUT_DO, r['нажать'], w + 'нажать') };
            if (s.do === 'act') s.verb = B.back(B.TUT_VERB, r['действие'], w + 'действие');
            if (s.do === 'tap' || s.do === 'act') s.obj = String(r['объект']).trim();
            // a tap with a cell only walks there (rules, section 27, «шаг 7»); a cell step needs one
            if (s.do === 'cell' || (s.do === 'tap' && !blank(r['клетка']))) {
                const m = String(r['клетка']).match(/^\s*(\d+)\s*,\s*(\d+)\s*$/);
                if (!m) throw new Error(w + 'клетка: «' + r['клетка'] + '» — два числа: x, y');
                s.at = [+m[1], +m[2]];
            }
            s.task = r['задание'] == null ? '' : String(r['задание']).trim();   // no column — an empty task: CoopCheck names it
            Object.assign(s, en(B.TUT_EN.task, 'task_en'));
            s.text = String(r['текст']);
            Object.assign(s, en(B.TUT_EN.text, 'text_en'));
            out.push(s);
        });
        return out;
    },

    /**
     * The texts of level n's tutorial window tips from the sheet «Обучение» (rules, section 33): a row «нажать: окно
     * плана» / «окно героя» anywhere among the steps, with its текст only — { map, hero }, a missing row — no field.
     * A second row of a kind, or one with задание, объект, клетка or действие, throws with its row.
     * @param {Record<string, any[][]>} book @param {number} n @returns {{ map?: string, hero?: string }}
     */
    tutorialTips(book, n) {
        const B = CoopBook, rows = book['Обучение'];
        if (!rows) throw new Error('в таблице нет листа «Обучение»');
        const head = rows[0].map(h => String(h).trim()), blank = (/** @type {any} */ v) => v === undefined || v === null || String(v).trim() === '';
        /** @type {Record<string, string>} */
        const out = {};
        let lv = NaN;
        rows.slice(1).forEach((cells, i) => {
            const r = Object.fromEntries(head.map((h, j) => [h, j < cells.length ? cells[j] : '']));
            if (!blank(r['уровень'])) lv = +r['уровень'];
            const what = String(r['нажать'] ?? '').trim(), key = Object.keys(B.TUT_TIP).find(k => B.TUT_TIP[k] === what);
            if (lv !== n || !key) return;
            const w = '«Обучение», уровень ' + n + ', строка ' + (i + 2) + '.';
            if (key in out) throw new Error(w + 'нажать: вторая строка «' + what + '»');
            for (const h of ['задание', 'объект', 'клетка', 'действие', B.TUT_EN.task]) if (!blank(r[h])) throw new Error(w + h + ': у строки «' + what + '» — только текст');
            out[key] = String(r['текст'] ?? '');
            if (!blank(r[B.TUT_EN.text])) out[key + '_en'] = String(r[B.TUT_EN.text]);   // its English (rules, section 36)
        });
        return out;
    },

    /**
     * The check of levels before they replace the game's: each must build (CoopCheck: the fields, the map)
     * — the first error throws; a solution that no longer plans (an object moved in the book) is only a
     * warning: the level loads, the solution waits for its author. Returns the warnings.
     * @param {any[]} levels
     */
    check(levels) {
        const warnings = [];
        for (const L of levels) {
            let M;
            try { M = new CoopLevelModel(L); } catch (e) { throw new Error('уровень ' + (L.order || 0) + ' (' + L.id + '): ' + e.message); }
            for (const key of CoopCheck.SOLUTIONS) {
                if (!L[key]) continue;
                try { M.solutionPlans(key); } catch (e) { warnings.push('уровень ' + (L.order || 0) + ', ' + key + ': ' + e.message); }
            }
        }
        return warnings;
    },

    /**
     * The book downloaded and its levels checked, as the game has them now (COOP_LEVELS) plus the book.
     * @returns {Promise<{levels: any[], warnings: string[]}>}
     */
    async load() {
        const r = await fetch(CoopBook.URL, { cache: 'no-store' });
        if (!r.ok) throw new Error('таблица не скачалась: HTTP ' + r.status);
        const levels = CoopBook.levels(await CoopBook.read(new Uint8Array(await r.arrayBuffer())), id => COOP_LEVELS[id]);
        return { levels, warnings: CoopBook.check(levels) };
    },

    /**
     * Every level of the book (the rows of «Уровни»), each with what the game keeps of it.
     * @param {Record<string, any[][]>} book @param {(id: string) => any} kept the level by its id, as the game has it
     */
    levels(book, kept) {
        if (!book['Уровни']) throw new Error('в таблице нет листа «Уровни»');
        return book['Уровни'].slice(1).filter(r => r[0] !== '').map(r => CoopBook.level(book, +r[0], kept(r[1])));
    },

    // ------------------------------------------------------------------ book -> texts
    TEXTS: 'Интерфейс',
    TEXTS_HEAD: ['ключ', 'текст', 'где видно'],

    /**
     * The texts of the sheet «Интерфейс» as ../design/texts/*.json have them: {area: {name: {text, en?, note}}}, in
     * the sheet's order (the key log.alarm — log.json, «alarm»). An empty row is skipped; a bad key, a key
     * twice or a key with no text throws, naming the rows.
     * @param {Record<string, any[][]>} book
     * @returns {Record<string, Record<string, {text: string, en?: string, note: string}>>}
     */
    texts(book) {
        const t = CoopBook.TEXTS, rows = book[t];
        if (!rows) throw new Error('в таблице нет листа «' + t + '»');
        const head = CoopBook.TEXTS_HEAD.map((h, i) => String(rows[0][i] ?? '').trim());
        if (head.join('|') !== CoopBook.TEXTS_HEAD.join('|')) throw new Error(t + ': заголовок не «' + CoopBook.TEXTS_HEAD.join(' | ') + '»');
        const out = /** @type {Record<string, Record<string, {text: string, en?: string, note: string}>>} */ ({}), bad = [];
        // the English (rules, section 36, «Язык»): the column EN after the sheet's own; empty or none — no field
        const enAt = rows[0].findIndex((h, i) => i >= CoopBook.TEXTS_HEAD.length && String(h ?? '').trim() === CoopBook.EN);
        rows.slice(1).forEach((r, i) => {
            const [key, text, note] = [0, 1, 2].map(j => String(r[j] ?? ''));
            if (!key.trim() && !text.trim() && !note.trim()) return;
            const at = t + '!A' + (i + 2) + ' «' + key + '»: ', m = key.trim().match(/^([a-z]\w*)\.([a-z]\w*)$/i);
            if (!m) return void bad.push(at + 'ключ — «область.имя» латиницей');
            if (!text.trim()) return void bad.push(at + 'пустой текст');
            const area = (out[m[1]] ||= {});
            if (m[2] in area) return void bad.push(at + 'ключ второй раз');
            area[m[2]] = enAt < 0 || CoopBook.blank(r[enAt]) ? { text, note } : { text, en: String(r[enAt]), note };
        });
        if (bad.length) throw new Error(bad.join('\n'));
        return out;
    }
};
