// CoopStand.js — the acceptance stand of the walls' picture (Ivan 18.11: «тестовый стенд для приёмки 3Д моделей;
// сейчас — для приёмки текстуры стен»). An artist's PNG or JPG goes on the walls' inner faces (material
// wall_panel) of the level as it is — the game's camera and light, on the PC's video card — with its checks
// beside it: format, size, aspect against the wall face, the seam of the left and the right edge (the faces
// stand side by side along a wall), brightness against the picture now (at night the walls glow by it).
// The panel standPanel opens by its button in the debug panel (F2); a picture is picked by «Текстура стен…»
// or dropped on the window. The picture is on the walls only while the panel is open: closed — the game as
// it was. The picture is kept in Store until «Сбросить», so it survives the day / night switch (a reload
// with &night= and &stand) and goes to another level with the stand. Not the player's: its texts are here.

class CoopStand {
    /** @param {CoopGame} game */
    constructor(game) {
        this.game = game;
        this.open = false;
        this.showNew = true;              // «было / стало»: the candidate on the walls, or the model's own
        this.close = false;               // «Вплотную»: the camera close, the wheel zooms
        /** @type {{ name: string, type: string, url: string, w: number, h: number, stats: any } | null} */
        this.pic = null;
        /** @type {{ w: number, h: number, stats: any } | null} */
        this.own = null;                  // the model's own picture, read off the GPU once (ownStats)
        this.note = '';                   // a line over the checks: why the picture did not come or was not kept
        /** @type {HTMLInputElement | null} */
        this.input = null;
        /** @type {number | null} */
        this.zoomInput = null;            // the camera's CAMERA_ZOOM_INPUT before «Вплотную»
        this.reading = false;             // the model's picture is being read off the GPU (ownStats)
        this.bind();
        const kept = Store.getJSON(CoopStand.STORE_KEY, null);
        if (kept && typeof kept.url === 'string') this.load(kept.name, kept.type, kept.url, false);
        if (CoopStand.wanted(window.location.search)) this.setOpen(true);
        else this.render();
    }

    // The stand open from the address (&stand: the day / night switch reloads the page with it).
    /** @param {string} search */
    static wanted(search) {
        return /[?&]stand(?:=1)?(?:&|$)/.test(search);
    }

    // The address of the same page with the night switched and the stand open: the other params kept.
    /** @param {string} search @param {boolean} night */
    static nightAddress(search, night) {
        const q = search.replace(/^\?/, '').split('&').filter(s => s && !/^(night|stand)(=|$)/.test(s));
        return '?' + q.concat(['night=' + (night ? 1 : 0), 'stand']).join('&');
    }

    bind() {
        const on = (/** @type {string} */ id, /** @type {() => void} */ fn) => { const el = UI.get(id); if (el) el.onClick(fn); };
        const tgl = UI.get('tglStand');
        if (tgl) tgl.show(true);
        on('tglStand', () => this.setOpen(!this.open));
        on('standPick', () => this.pick());
        on('standReset', () => this.reset());
        on('standSwap', () => { this.showNew = !this.showNew; this.apply(); this.render(); });
        on('standNight', () => MainMenu.go(CoopStand.nightAddress(window.location.search, !this.game.scene.night)));
        on('standClose', () => this.setClose(!this.close));
        if (typeof window.addEventListener !== 'function') return;   // a page without input (node:vm in tests)
        // A file dropped on the window: the stand opens with it. Any file drop is kept from the page
        // (the browser and the PC build would open the file instead of the game).
        const files = (/** @type {DragEvent} */ e) => !!(e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files'));
        window.addEventListener('dragover', (e) => { if (files(e)) e.preventDefault(); });
        window.addEventListener('drop', (e) => {
            if (!files(e)) return;
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) { this.setOpen(true); this.read(f); }
        });
    }

    /** @param {boolean} on */
    setOpen(on) {
        this.open = on;
        const p = UI.get('standPanel');
        if (p) p.show(on);
        if (!on && this.close) this.setClose(false);
        if (on) this.ownStats();
        this.apply();
        this.render();
    }

    // The picture on the walls: the candidate while the stand is open and «стало» is shown, else the model's own.
    apply() {
        this.game.scene.setWallPicture(this.open && this.showNew && this.pic ? this.pic.url : null);
    }

    // «Вплотную»: the camera CoopStand.CLOSE_ZOOM times the level's zoom, the wheel zooms, WASD and the screen's
    // edges fly as in the game; off — the level's camera back (CoopGame.frameLevel).
    /** @param {boolean} on */
    setClose(on) {
        this.close = on;
        const cam = this.game.app.camera;
        if (this.zoomInput === null) this.zoomInput = cam.c.zoomInput;
        cam.c.zoomInput = on ? 1 : this.zoomInput;
        if (on) cam.zoomTarget = cam._clampZoom(this.game.zoom * CoopStand.CLOSE_ZOOM);
        else this.game.frameLevel();
        this.render();
    }

    pick() {
        if (!this.input) {
            const el = /** @type {HTMLInputElement} */ (document.createElement('input'));
            el.type = 'file';
            el.accept = CoopStand.TYPES.join(',');
            el.addEventListener('change', () => { if (el.files && el.files[0]) this.read(el.files[0]); el.value = ''; });
            this.input = el;
        }
        this.input.click();
    }

    reset() {
        Store.remove(CoopStand.STORE_KEY);
        this.pic = null;
        this.note = '';
        this.showNew = true;
        this.apply();
        this.render();
    }

    /** @param {File} file */
    read(file) {
        const r = new FileReader();
        r.onload = () => this.load(file.name, file.type, String(r.result), true);
        r.onerror = () => { this.note = 'Файл не прочитался: ' + file.name; this.render(); };
        r.readAsDataURL(file);
    }

    // A picture from its data: URL: decoded, measured, put on the walls; keep — into Store (a fresh pick or drop).
    /** @param {string} name @param {string} type @param {string} url @param {boolean} keep */
    load(name, type, url, keep) {
        const img = new Image();
        img.onload = () => {
            const w = img.naturalWidth, h = img.naturalHeight;
            const s = CoopStand.scale(w, h), cw = Math.max(1, Math.round(w / s)), ch = Math.max(1, Math.round(h / s));
            const cv = /** @type {HTMLCanvasElement} */ (document.createElement('canvas'));
            cv.width = cw;
            cv.height = ch;
            const ctx = cv.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(img, 0, 0, cw, ch);
            this.pic = { name, type, url, w, h, stats: CoopStand.stats(cw, ch, ctx.getImageData(0, 0, cw, ch).data) };
            this.showNew = true;
            this.note = keep && !Store.set(CoopStand.STORE_KEY, JSON.stringify({ name, type, url }))
                ? 'Файл велик для хранилища: при смене дня и ночи картинку надо дать заново' : '';
            this.apply();
            this.render();
        };
        img.onerror = () => { this.note = 'Не картинка или битый файл: ' + name; this.render(); };
        img.src = url;
    }

    // The model's picture of the walls, read once off the GPU (the walls load after the scene): the reference
    // of brightness and the «было» line of the checks.
    ownStats() {
        if (this.own || this.reading) return;
        const tex = this.game.scene.ownWallPicture();
        if (!tex || !tex.isReady()) { if (this.open) setTimeout(() => this.ownStats(), CoopStand.RETRY_MS); return; }
        const size = tex.getSize(), p = tex.readPixels();
        if (!p) return;
        this.reading = true;
        p.then((buf) => {
            const s = CoopStand.scale(size.width, size.height);
            this.own = { w: size.width, h: size.height, stats: CoopStand.stats(size.width, size.height, /** @type {Uint8Array} */ (buf), s) };
            this.render();
        }, () => { this.reading = false; });
    }

    render() {
        const tgl = UI.get('tglStand');
        if (tgl) tgl.setText((this.open ? '▾ ' : '▸ ') + 'Стенд стен');
        const set = (/** @type {string} */ id, /** @type {string} */ t) => { const el = UI.get(id); if (el) el.setText(t); };
        set('standSwap', this.showNew ? 'Показано: стало' : 'Показано: было');
        set('standNight', this.game.scene.night ? 'Сделать день' : 'Сделать ночь');
        set('standClose', this.close ? 'Камера игры' : 'Вплотную (колесо, WASD)');
        set('standFile', this.pic ? 'Файл: ' + this.pic.name : 'Перетащи PNG / JPG в окно игры');
        const c = this.game.c;
        const lines = this.pic ? CoopStand.checks(this.pic, this.own, c.cellPx / c.wallH).map(r => (r.ok === true ? '✓ ' : r.ok === false ? '✕ ' : '· ') + r.text) : [];
        if (this.pic) {
            const bad = lines.filter(l => l.startsWith('✕')).length;
            lines.push(bad ? 'Итог: не годится — замечаний ' + bad : 'Итог: годится');
        }
        if (this.own) lines.push('', 'Сейчас в игре: ' + this.own.w + '×' + this.own.h + ', пропорция ' + CoopStand.num(this.own.w / this.own.h, 2)
            + ' (грань ' + CoopStand.num(c.cellPx / c.wallH, 2) + '), L* ' + CoopStand.num(this.own.stats.lstar, 0));
        if (this.note) lines.unshift(this.note, '');
        set('standReport', lines.join('\n'));
    }

    // The step of the pixels the checks read: the longer side counts at most CoopStand.SAMPLE.
    /** @param {number} w @param {number} h */
    static scale(w, h) {
        return Math.max(1, Math.ceil(Math.max(w, h) / CoopStand.SAMPLE));
    }

    // CIE L* (0 … 100) of an sRGB pixel: the lightness the eye sees.
    /** @param {number} r @param {number} g @param {number} b bytes */
    static lstar(r, g, b) {
        const lin = (/** @type {number} */ v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        const y = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
        return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : y * 24389 / 27;
    }

    // A picture's numbers (RGBA rows top down, w × h; step — read every step-th pixel each way):
    // lstar — the mean L*; seam — the mean |ΔL*| of the left and the right column, row by row (the edges that meet
    // at the next face along a wall); grain — the same of neighbouring columns inside (the picture's own change).
    /** @param {number} w @param {number} h @param {ArrayLike<number>} px @param {number} [step] */
    static stats(w, h, px, step = 1) {
        const L = (/** @type {number} */ x, /** @type {number} */ y) => { const i = (y * w + x) * 4; return CoopStand.lstar(px[i], px[i + 1], px[i + 2]); };
        let sum = 0, n = 0, seam = 0, rows = 0, grain = 0, pairs = 0;
        for (let y = 0; y < h; y += step) {
            let prev = L(0, y);
            seam += Math.abs(prev - L(w - 1, y));
            rows++;
            for (let x = step; x < w; x += step) {
                const v = L(x, y);
                grain += Math.abs(v - prev);
                pairs++;
                sum += v;
                n++;
                prev = v;
            }
            sum += L(0, y);
            n++;
        }
        return { lstar: sum / n, seam: seam / rows, grain: pairs ? grain / pairs : 0 };
    }

    // The checks of a picture: [{ ok: true | false | null (a number without a verdict), text }].
    // pic — { name, type, w, h, stats }; own — the model's picture now ({ stats }) or null; face — the wall face's
    // width / height (CoopGame.cfg: cellPx / wallH).
    /** @param {{ type: string, w: number, h: number, stats: any }} pic @param {{ stats: any } | null} own @param {number} face */
    static checks(pic, own, face) {
        const out = [], n = CoopStand.num, s = pic.stats;
        const fmt = pic.type === 'image/png' ? 'PNG' : pic.type === 'image/jpeg' ? 'JPG' : pic.type || 'не известен';
        out.push({ ok: CoopStand.TYPES.includes(pic.type), text: 'Формат: ' + fmt + (CoopStand.TYPES.includes(pic.type) ? '' : ' — нужен PNG или JPG') });
        const short = Math.min(pic.w, pic.h), long = Math.max(pic.w, pic.h);
        const sizeOk = short >= CoopStand.MIN_PX && long <= CoopStand.MAX_PX;
        out.push({ ok: sizeOk, text: 'Размер: ' + pic.w + '×' + pic.h + (sizeOk ? '' : short < CoopStand.MIN_PX
            ? ' — мелко, короткая сторона от ' + CoopStand.MIN_PX : ' — велико, длинная сторона до ' + CoopStand.MAX_PX) });
        const a = pic.w / pic.h, off = a / face - 1;
        out.push({ ok: Math.abs(off) <= CoopStand.ASPECT_TOL, text: 'Пропорция: ' + n(a, 2) + ' при грани ' + n(face, 2) + (Math.abs(off) <= CoopStand.ASPECT_TOL ? ''
            : ' — растянется по ' + (off < 0 ? 'ширине' : 'высоте') + ' на ' + n(Math.abs(off < 0 ? face / a - 1 : off) * 100, 0) + ' %') });
        const seamMax = Math.max(CoopStand.SEAM_MIN, CoopStand.SEAM_RATIO * s.grain);
        out.push({ ok: s.seam <= seamMax, text: 'Стык левого и правого края: ' + n(s.seam, 1) + ' L* при зерне ' + n(s.grain, 1)
            + (s.seam <= seamMax ? '' : ' — шов на стыке каждой клетки') });
        if (!own) out.push({ ok: null, text: 'Яркость: L* ' + n(s.lstar, 0) + ' (с нынешней ещё не сравнить)' });
        else {
            const dl = s.lstar - own.stats.lstar, ok = dl >= -CoopStand.NIGHT_DL;
            out.push({ ok, text: 'Яркость: L* ' + n(s.lstar, 0) + ', сейчас ' + n(own.stats.lstar, 0) + (ok ? '' : ' — ночью стены темнее на ' + n(-dl, 0)) });
        }
        return out;
    }

    // A number with a decimal comma.
    /** @param {number} v @param {number} digits */
    static num(v, digits) {
        return v.toFixed(digits).replace('.', ',');
    }
}

CoopStand.STORE_KEY = 'coop.stand.wall';
CoopStand.TYPES = ['image/png', 'image/jpeg'];
CoopStand.MIN_PX = COOP_STAND_MIN_PX;
CoopStand.MAX_PX = COOP_STAND_MAX_PX;
CoopStand.ASPECT_TOL = COOP_STAND_ASPECT_TOL;
CoopStand.SEAM_RATIO = COOP_STAND_SEAM_RATIO;
CoopStand.SEAM_MIN = COOP_STAND_SEAM_MIN;
CoopStand.NIGHT_DL = COOP_STAND_NIGHT_DL;
CoopStand.SAMPLE = COOP_STAND_SAMPLE;
CoopStand.CLOSE_ZOOM = COOP_STAND_CLOSE_ZOOM;
CoopStand.RETRY_MS = COOP_STAND_RETRY_MS;
