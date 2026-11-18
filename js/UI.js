// UI.js — the game's UI (HUD): DOM elements over the 3D canvas, laid out by UILayout.js.
//
// RULE: every UI element is a UI_LAYOUT record (js/UILayout.js), placed and styled in the
// editor's UI tab. Game code does not create, position or style HUD DOM itself — it takes an
// element by id and feeds it data:
//     UI.get('score').setText('10');  UI.get('hp').setValue(0.7);
//     UI.get('start').onClick(() => …);  UI.get('hint').show(false);
// Many elements of one kind (inventory slots): a template record in UILayout.js +
//     UI.add(Object.assign({}, UI.def('slot'), { id: 'slot2', x: 140 }));
//
// Record: { id, kind, anchor, x, y, w, h, … } (the full field list — UI.DEFAULTS).
//   kind   — 'text' | 'panel' | 'bar' | 'button' | 'image' (a picture from src, fitted whole) |
//            'ring' (a round bar: value of the circle clockwise from the top in color, the rest in fill).
//   anchor — one of 9 screen points ('top-left' … 'bottom-right'): x and y go from it to THE
//            SAME point of the element — inward from a screen edge, signed from the center.
//            A 'bottom-right' element at x 20, y 20 keeps its bottom right corner 20 px from
//            the screen corner at any screen size.
//   w, h   — size in px; a text sizes itself by its content, unless it has both — then its text wraps
//            and shrinks to fit that box, centred (UI.boxedText; rules, section 33).
//   parent — id of the element this one sits in ('' or none — the screen): anchor, x and y then
//            count from the PARENT's box, the parent clips it, and hiding the parent hides it too.
//   stretch — 'h' | 'v' | 'both' (sized kinds): the element fills its container on that axis,
//            x (y) is the inset from BOTH edges, w (h) is ignored. A full-screen dim:
//            { kind: 'panel', stretch: 'both', x: 0, y: 0 }.
//   look   — the record's look (UI.LOOKS; rules, section 34 — one colour, one role): its kind (genus) and the
//            roles of its fill, outline, shadow and text; the colours are the roles' (UI_ROLE_* in Constants.js).
//            A record without a look (or of the 'service' kind) draws its own colours, as before section 34.
//   Colors — '#rrggbb' strings, '' — none (with a look: '' — the look's role, a colour — an entity's, over it).
//   Records go in drawing order: later — on top.
// SCALE: layout numbers are px of a screen UI_REF_HEIGHT tall — the whole UI scales with the
//   real height (a 1440 px screen draws a 720 px layout twice as big). UI_REF_HEIGHT = 0 — CSS px.

/** @satisfies {Record<string, any>} */
const UI = {
    // A button's label keeps off its round corners by this share of the corner radius (a circle's
    // inscribed square leaves 1 - 1/√2 ≈ 0.29 of the radius at each side).
    CORNER_INSET: 0.29,
    // ... and shrinks to fit no smaller than this share of its font (Ivan 25.10: wrap or shrink).
    MIN_FONT: 0.6,
    // A window kept off the screen's sides by this, layout px (fitScale).
    WINDOW_PAD: 12,
    ANCHORS: ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-center', 'middle-right',
        'bottom-left', 'bottom-center', 'bottom-right'],
    KINDS: ['text', 'panel', 'bar', 'button', 'image', 'ring'],
    // The interface's font (rules, section 34, «Вид по макету главного экрана» 17.11): OpenGOST type A (js/UIFont.js,
    // embedded), one face — the weight is a stroke round the letters (UI_FONT_STROKE, the root); the signs it lacks
    // (UI_FONTS icons: ✓ ◀ ▶ ▼ − + …) come from Nunito, then the system's. Titles and button labels in capitals,
    // UI_CAPS_WEIGHT (Nunito's weight for those signs).
    FONT: '"OpenGOST type A", "Nunito", system-ui, "Segoe UI", Roboto, sans-serif',
    // The plan's signs over the scene (the layers SCENE_LAYERS: the signs, the loads, the work rings) keep Nunito
    // without the stroke.
    SCENE_FONT: '"Nunito", system-ui, "Segoe UI", Roboto, sans-serif',
    SCENE_LAYERS: ['ghostLayer'],
    TEXT_WEIGHT: String(typeof UI_TEXT_WEIGHT !== 'undefined' ? UI_TEXT_WEIGHT : 700),    // the weight of a text and a label
    CAPS_WEIGHT: String(typeof UI_CAPS_WEIGHT !== 'undefined' ? UI_CAPS_WEIGHT : 900),    // a title's and a button's
    CAPS_SPACING: '0.02em',             // the letter spacing of a text in capitals (a button's and a ribbon's: spacing)
    /** @type {CanvasRenderingContext2D | null | undefined} */
    _measure: undefined,                // textWidth's canvas: undefined — not looked for yet

    // The looks (rules, section 34): a record's look (field look) -> its kind (genus) and the ROLES of its parts —
    // fill, outline, shadow, text, border (the colours: UI.role, UI_ROLE_* in Constants.js); the numbers — UI_LINE,
    // UI_DROP, UI_SKEW_DEG, UI_DIM_ALPHA. How a look is drawn:
    //   edge  — 'filter': the outline and the shadow are drop-shadows of the element's silhouette (a skewed plate:
    //           clip-path cuts a border); 'border': a UI_LINE border; 'ring': an outline ring outside the box;
    //           'strip': a full-width strip behind the element with outlines on top and bottom; 'rule': a divider, the
    //           top line of the border role; none — the shadow
    //           is the box's (a card) or the text's (a text, a mark).
    //   skew  — true: the edge facing the screen centre is skewed by UI_SKEW_DEG (by the anchor: left -> the right
    //           edge, right -> the left one, centre -> both; a tall plate — only its header corner); 'right' — that edge.
    //   caps  — the label in capitals, UI_CAPS_WEIGHT; gray — the unavailable (the same look greyed); dim — the fill
    //           at UI_DIM_ALPHA.
    //   fade  — the unavailable text: the element at UI_OFF_ALPHA of its opacity.
    //   worn  — the plate is worn (rules 34, «Вид по макету главного экрана»; js/UIRough.js): a crumpled SVG behind the
    //           element, its outline inside the box (UI_WORN_*), the shadow below; a button is a blueprint sheet (a glow
    //           and a white grid), its first and last on a screen have a cut corner (UI.cutsOf), exactly one nick;
    //           edge 'strip' and 'ribbon' — the window's hand-cut strip and its forked title ribbon (UIRough).
    //   square — the window's ✕ (one button for every window): no cut corner, no nick, one size.
    // Kinds: plate (HUD), window (a strip, its dim and ribbon), button, card (paper), select (the chosen), mark (an
    // icon, a text on a plate, a frame), layer (paints no surface: a container, a text on a strip or a card —
    // bounded by what it lies on), service («Не трогаем»: the record's own colours, the old look).
    LOOKS: {
        plate: { genus: 'plate', fill: 'plate', outline: 'outline', shadow: 'shadow', text: 'paper', edge: 'filter', skew: true, worn: true },
        plateFlat: { genus: 'plate', fill: 'plate', outline: 'outline', shadow: 'shadow', text: 'paper', edge: 'filter', worn: true },
        // the work sign over an object (rules 34, Ivan 18.11: «белая обводка зачем? причём ещё и кривая»): a smooth disc,
        // no outline and no wear — its edge is the worker's ring
        disc: { genus: 'plate', fill: 'plate', shadow: 'shadow', text: 'paper', edge: 'filter' },
        caption: { genus: 'plate', text: 'paper', shadow: 'shadow', caps: true },
        window: { genus: 'window', fill: 'field', outline: 'outline', shadow: 'shadow', text: 'ink', edge: 'strip' },
        dim: { genus: 'window', fill: 'shadow', shadow: 'shadow', dim: true },
        // the main screen's dim (rules 36): a band under the column, fading toward the middle (UI.sideFill)
        side: { genus: 'window', fill: 'shadow', shadow: 'shadow', dim: true, side: true },
        ribbon: { genus: 'window', fill: 'plate', outline: 'outline', shadow: 'shadow', text: 'paper', caps: true, edge: 'ribbon' },
        button: { genus: 'button', fill: 'button', outline: 'outline', shadow: 'shadow', text: 'paper', caps: true, edge: 'border', worn: true },
        buttonOn: { genus: 'select', fill: 'select', outline: 'outline', shadow: 'shadow', text: 'ink', caps: true, edge: 'border', worn: true },
        buttonOff: { genus: 'button', fill: 'button', outline: 'outline', shadow: 'shadow', text: 'paper', caps: true, edge: 'border', gray: true, worn: true },
        close: { genus: 'button', fill: 'button', outline: 'outline', shadow: 'shadow', text: 'paper', caps: true, edge: 'border', worn: true, square: true },
        select: { genus: 'select', fill: 'select', outline: 'outline', text: 'ink', edge: 'ring' },
        card: { genus: 'card', fill: 'paper', shadow: 'shadow', text: 'ink' },
        mark: { genus: 'mark', text: 'paper', shadow: 'shadow' },
        // a mark on a red plate (rules 14, Ivan 17.11: «красное на красном не читается»): paper with an ink outline
        markLoud: { genus: 'mark', text: 'paper', shadow: 'shadow', stroke: 'ink' },
        frame: { genus: 'mark', outline: 'outline', edge: 'border' },
        ink: { genus: 'layer', text: 'ink' },
        inkTitle: { genus: 'layer', text: 'ink', caps: true },
        stamp: { genus: 'layer', text: 'ink', border: 'ink', caps: true },
        stampOff: { genus: 'layer', text: 'ink', border: 'ink', caps: true, gray: true },
        // an unavailable text on the window's strip (the resolution in borderless, rules 36): faded
        inkOff: { genus: 'layer', text: 'ink', fade: true },
        rule: { genus: 'layer', border: 'ink', edge: 'rule' },
        layer: { genus: 'layer' },
        service: { genus: 'service' },
    },

    // Fields of a record by kind and their defaults — a new element in the editor starts from them.
    DEFAULTS: {
        text: { parent: '', look: 'mark', anchor: 'top-left', x: 20, y: 20, w: 0, h: 0, text: 'Text', fontSize: 24, color: '', shadow: '', alpha: 1, visible: 1 },
        panel: { parent: '', look: 'plate', anchor: 'top-left', x: 20, y: 20, w: 240, h: 80, stretch: '', fill: '', border: '', radius: 0, alpha: 1, visible: 1 },
        bar: { parent: '', look: 'mark', anchor: 'top-left', x: 20, y: 20, w: 240, h: 18, stretch: '', value: 0.6, color: '', fill: '', border: '', radius: 0, alpha: 1, visible: 1 },
        button: { parent: '', look: 'button', anchor: 'bottom-center', x: 0, y: 40, w: 180, h: 48, stretch: '', text: 'Button', fontSize: 20, color: '', fill: '', border: '', radius: 0, alpha: 1, visible: 1 },
        image: { parent: '', look: 'mark', anchor: 'top-left', x: 20, y: 20, w: 240, h: 160, stretch: '', src: '', fill: '', border: '', radius: 0, alpha: 1, visible: 1 },
        ring: { parent: '', look: 'mark', anchor: 'top-left', x: 20, y: 20, w: 48, h: 48, stretch: '', value: 0.6, color: '', fill: '', alpha: 1, visible: 1 },
    },

    // A role's colour as CSS (rules, section 34; UI_ROLE_* in Constants.js): 'outline' -> '#e0dcfa'; with alpha —
    // 'rgba(…)'. Not a role — ''.
    /** @param {string} name @param {number} [alpha] @returns {string} */
    role(name, alpha) {
        const hex = {
            outline: typeof UI_ROLE_OUTLINE !== 'undefined' ? UI_ROLE_OUTLINE : 0xe0dcfa,
            shadow: typeof UI_ROLE_SHADOW !== 'undefined' ? UI_ROLE_SHADOW : 0x171e32,
            plate: typeof UI_ROLE_PLATE !== 'undefined' ? UI_ROLE_PLATE : 0x202b3b,
            field: typeof UI_ROLE_FIELD !== 'undefined' ? UI_ROLE_FIELD : 0x85a0ca,
            button: typeof UI_ROLE_BUTTON !== 'undefined' ? UI_ROLE_BUTTON : 0x244266,
            select: typeof UI_ROLE_SELECT !== 'undefined' ? UI_ROLE_SELECT : 0xf06ef7,
            paper: typeof UI_ROLE_PAPER !== 'undefined' ? UI_ROLE_PAPER : 0xd4d8fd,
            ink: typeof UI_ROLE_INK !== 'undefined' ? UI_ROLE_INK : 0x1b2a3b,
        }[name];
        if (hex === undefined) return '';
        return alpha === undefined ? '#' + hex.toString(16).padStart(6, '0')
            : 'rgba(' + [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255, alpha].join(',') + ')';
    },

    // The main screen's dim (rules 36): the shadow colour at MENU_SIDE_DIM_ALPHA at the left edge, held to
    // MENU_SIDE_HOLD of the width, 0 from MENU_SIDE_END on.
    sideFill() {
        const a = typeof MENU_SIDE_DIM_ALPHA !== 'undefined' ? MENU_SIDE_DIM_ALPHA : 0.6;
        const hold = typeof MENU_SIDE_HOLD !== 'undefined' ? MENU_SIDE_HOLD : 0.24, end = typeof MENU_SIDE_END !== 'undefined' ? MENU_SIDE_END : 0.46;
        const pc = (/** @type {number} */ k) => Math.round(k * 1000) / 10 + '%';
        return 'linear-gradient(90deg, ' + this.role('shadow', a) + ' 0%, ' + this.role('shadow', a) + ' ' + pc(hold) + ', '
            + this.role('shadow', 0) + ' ' + pc(end) + ')';
    },

    // The numbers of the looks (Constants.js, section 34), layout px and degrees.
    nums() {
        return {
            line: typeof UI_LINE !== 'undefined' ? UI_LINE : 3,
            drop: typeof UI_DROP !== 'undefined' ? UI_DROP : 3,
            loud: typeof UI_LOUD_LINE !== 'undefined' ? UI_LOUD_LINE : 2,
            skew: typeof UI_SKEW_DEG !== 'undefined' ? UI_SKEW_DEG : 12,
            corner: typeof UI_PLATE_CORNER !== 'undefined' ? UI_PLATE_CORNER : 34,
            tall: typeof UI_PLATE_TALL !== 'undefined' ? UI_PLATE_TALL : 200,
            dim: typeof UI_DIM_ALPHA !== 'undefined' ? UI_DIM_ALPHA : 0.6,
            gap: typeof UI_RING_GAP !== 'undefined' ? UI_RING_GAP : 4,
            cap: typeof UI_FONT_CAP !== 'undefined' ? UI_FONT_CAP : 0.8,
            sceneCap: typeof UI_SCENE_FONT_CAP !== 'undefined' ? UI_SCENE_FONT_CAP : 0.705,
        };
    },

    // The look a record is drawn in: UI.LOOKS[def.look]; none, unknown or 'service' — null (the record's own colours).
    /** @param {UIRecord} def */
    lookOf(def) {
        const look = def && def.look ? this.LOOKS[def.look] : null;
        return look && look.genus !== 'service' ? look : null;
    },

    // Does the record paint a surface (a fill or an outline) — by its look, else by its own colours?
    /** @param {UIRecord} def @returns {boolean} */
    paints(def) {
        const look = this.lookOf(def);
        return look ? def.kind !== 'text' && !!(look.fill || look.outline || look.border) : !!(def.fill || def.border);
    },

    // The skewed edge of a worn HUD plate def h px high with its look, as UIRough.plate takes it (the same edge
    // skewPath cuts): { left, right, tan, corner } — corner > 0: a tall plate, only its header corner that high;
    // not skewed (or on a painted parent) — null.
    /** @param {UIRecord} def @param {Record<string, any> | null} look @param {number} h */
    skewEdge(def, look, h) {
        const parent = this.parentOf(def), n = this.nums();
        if (!look || !look.skew || !n.skew || (parent && this.paints(parent.def))) return null;
        const edge = look.skew === true ? { left: 'right', right: 'left', center: 'both' }[this.parseAnchor(def.anchor).h] : look.skew;
        return { left: edge === 'left' || edge === 'both', right: edge === 'right' || edge === 'both', tan: Math.tan(n.skew * Math.PI / 180),
            corner: h > n.tall ? n.corner : 0 };
    },

    // How far a child of a skewed plate keeps off its skewed edge (rules 34, «Содержимое плашки HUD — внутри её
    // формы»): a child pressed to that edge (its anchor's side; a plate skewed both ways — either) moves away by the
    // edge's deepest cut over the child's own height: down from the top (a right edge, both edges), up from the
    // bottom (a left edge), or the header corner of a tall plate. A sized child reaching the other side narrows by as
    // much: its far side stays. def — the child w × h; pdef — the plate pw × ph. -> { dx, dw }: px off the edge, px
    // less width.
    /** @param {UIRecord} def @param {number} w @param {number} h @param {UIRecord} pdef @param {number} pw @param {number} ph */
    skewShift(def, w, h, pdef, pw, ph) {
        const none = { dx: 0, dw: 0 }, sk = pdef ? this.skewEdge(pdef, this.lookOf(pdef), ph) : null, a = this.parseAnchor(def.anchor);
        if (!sk || this.stretchOf(def).h || (a.h !== 'left' && a.h !== 'right') || !sk[a.h]) return none;
        const top = this.resolve(def, w, h, pw, ph).top, bottom = top + h, x = Number(def.x) || 0;
        const down = sk.left && sk.right || a.h === 'right';
        const dx = sk.corner ? Math.max(0, sk.corner - Math.max(0, top)) * sk.tan
            : (down ? Math.max(0, Math.min(ph, bottom)) : ph - Math.max(0, Math.min(ph, top))) * sk.tan;
        // the far side: as far in as the near one was; on a plate skewed both ways it is skewed as deep
        const sized = def.kind !== 'text' || this.boxedText(def), far = sk.left && sk.right ? dx : 0;
        return { dx, dw: sized ? Math.max(0, Math.min(dx + far, x + dx + w - (pw - x - far))) : 0 };
    },

    // The width a text child of a worn HUD plate has from where it starts to the plate's body on its other side
    // (rules 34, «Содержимое плашки HUD — внутри её формы»): over its lines (UI.skewShift taken), with its shadow
    // below and the stroke of its letters. A text that wraps by it (the hero's last step) stays inside the plate.
    // Not a text of a worn plate — null.
    /** @param {string} id @param {number} [lines] @returns {number | null} */
    roomOf(id, lines) {
        const e = this.elements.get(id), pe = e ? this.parentOf(e.def) : null, plook = pe ? this.lookOf(pe.def) : null, d = e ? e.def : null;
        if (!d || d.kind !== 'text' || !plook || !plook.worn || plook.genus !== 'plate' || typeof UIRough === 'undefined') return null;
        const ps = pe._wh || pe.def, pw = Number(ps.w) || 0, ph = Number(ps.h) || 0, a = this.parseAnchor(d.anchor).h;
        const font = e._font || Number(d.fontSize) || 20, h = font * 1.2 * (lines || 1), n = this.nums();
        if (!(pw > 0 && ph > 0) || a === 'center') return null;
        const sh = this.skewShift(d, 0, h, pe.def, pw, ph), r = this.resolve(Object.assign({}, d, { x: (Number(d.x) || 0) + sh.dx }), 0, h, pw, ph);
        const body = this.plateShape(pe.def, plook, pw, ph, pe._tilt, pe._nick).body, stroke = parseFloat(this.stroke()) || 0;
        let room = Infinity;
        for (let y = r.top; y <= r.top + h + n.drop + 0.01; y += 1) {
            const xs = [];
            for (let i = 0, j = body.length - 1; i < body.length; j = i++) {
                const [p, q] = [body[j], body[i]];
                if ((p[1] > y) !== (q[1] > y)) xs.push(p[0] + (y - p[1]) / (q[1] - p[1]) * (q[0] - p[0]));
            }
            if (xs.length) room = Math.min(room, a === 'right' ? r.left - Math.min(...xs) : Math.max(...xs) - r.left);
        }
        return Number.isFinite(room) ? Math.max(0, room - stroke) : null;
    },

    // The worn shape (UIRough.plate) of a record def w × h with its look: its seed, skewed edge (skewEdge), a button's
    // wear and the given cut corners; tilt, nick — an element's run-time tilt and nick side.
    /** @param {UIRecord} def @param {Record<string, any>} look @param {number} w @param {number} h @param {number} [tilt] @param {string} [nick] @param {number[]} [cuts] */
    plateShape(def, look, w, h, tilt, nick, cuts) {
        const button = look.genus === 'button' || look.genus === 'select';
        return UIRough.plate({ w, h, seed: UIRough.seed(def.id), button, cuts: cuts || [], skew: this.skewEdge(def, look, h), tilt, nickSide: nick || undefined });
    },

    // The width of the record's own border, layout px: a look's UI_LINE border, else 2 px of a record's colour.
    /** @param {UIRecord} def @returns {number} */
    borderWidth(def) {
        if (def.kind === 'text') return 0;
        const look = this.lookOf(def);
        if (!look) return def.border ? 2 : 0;
        if (look.border) return 2;
        return look.edge === 'border' && (look.outline || def.border) ? this.nums().line : 0;
    },

    // The embedded fonts (js/UIFont.js, UI_FONTS) as @font-face rules, once a page: a face with a cap height is
    // scaled (size-adjust) so its capitals are UI_FONT_CAP of the font size. The faces load — the labels fit again
    // (fitLabel measured them in the fallback font).
    loadFont() {
        if (typeof document === 'undefined' || typeof UI_FONTS === 'undefined' || document.getElementById('arc-ui-font')) return;
        const cap = typeof UI_FONT_CAP !== 'undefined' ? UI_FONT_CAP : 0.8;
        const style = document.createElement('style');
        style.id = 'arc-ui-font';
        style.textContent = UI_FONTS.flatMap(font => font.faces.map(f => '@font-face{font-family:"' + font.family
            + '";font-style:normal;font-weight:' + font.weight + ';font-display:block;'
            + (font.cap ? 'size-adjust:' + (cap / font.cap * 100).toFixed(2) + '%;' : '')
            + 'src:url(' + f.src + ') format("' + font.format + '");unicode-range:' + f.range + '}')).join('\n');
        document.head.appendChild(style);
        const fonts = /** @type {any} */ (document).fonts;
        if (!fonts || typeof fonts.load !== 'function') return;
        Promise.all(UI_FONTS.flatMap(font => [this.TEXT_WEIGHT, this.CAPS_WEIGHT].map(w => fonts.load(w + ' 20px "' + font.family + '"', 'Aa Яя'))))
            .then(() => { for (const e of this.elements.values()) { e._fit = null; e.apply(); } }, () => {});
    },

    /** @type {HTMLElement | null} */
    root: null,
    /** @type {HTMLCanvasElement | null} */
    canvas: null,
    /** @type {UIRecord[]} */
    layout: [],
    /** @type {Map<string, UIElement>} */
    elements: new Map(),
    editing: false,          // the editor's UI tab: every element catches the pointer, buttons do not fire
    /** @type {ResizeObserver | null} */
    _observer: null,
    /** @type {ResizeObserver | null} */
    _sizes: null,            // watches the worn elements sized by their content: their plate is drawn again on a new size
    /** @type {Map<string, number[]> | null} */
    _cuts: null,             // the cut corners of the shown buttons by id (cutsOf); null — to be found again
    _recut: false,           // a redraw of the changed cuts is queued (recut)

    // canvas — the 3D canvas the UI lies over; layout — records (UI_LAYOUT by default).
    init(canvas, layout) {
        this.dispose();
        this.canvas = canvas;
        this.loadFont();
        const root = this.root = document.createElement('div');
        root.className = 'arc-ui';
        Object.assign(root.style, { position: 'absolute', overflow: 'hidden', pointerEvents: 'none', transformOrigin: '0 0',
            fontFamily: this.FONT, webkitTextStroke: this.stroke(), userSelect: 'none', webkitUserSelect: 'none' });
        (canvas.parentElement || document.body).appendChild(root);
        if (typeof ResizeObserver !== 'undefined') {
            this._observer = new ResizeObserver(() => this.resize());
            this._observer.observe(canvas);
        }
        this.applyLayout(layout || (typeof UI_LAYOUT !== 'undefined' ? UI_LAYOUT : []));
        return this;
    },

    // The interface's weight (rules 34): a stroke of UI_FONT_STROKE round every letter in its own colour.
    stroke() {
        return (typeof UI_FONT_STROKE !== 'undefined' ? UI_FONT_STROKE : 0.5) + 'px currentColor';
    },

    // The letter spacing of a label in capitals by its look: a button's (and the chosen one's) UI_SPACING_BUTTON,
    // the window's ribbon UI_SPACING_RIBBON, other capitals CAPS_SPACING.
    /** @param {any} look @returns {string} */
    spacingOf(look) {
        if (look.edge === 'ribbon') return (typeof UI_SPACING_RIBBON !== 'undefined' ? UI_SPACING_RIBBON : 0.03) + 'em';
        if (look.genus === 'button' || look.genus === 'select') return (typeof UI_SPACING_BUTTON !== 'undefined' ? UI_SPACING_BUTTON : 0.07) + 'em';
        return this.CAPS_SPACING;
    },

    // A text's width in layout px at font size (layout px) in the HUD's font and weight (a text element's,
    // apply); no canvas to measure with — null.
    // weight — a title's (UI.CAPS_WEIGHT); none — a text's.
    /** @param {string} text @param {number} size @param {string} [weight] @returns {number | null} */
    textWidth(text, size, weight) {
        if (this._measure === undefined) {
            const c = typeof document !== 'undefined' && document.createElement('canvas');
            this._measure = (c && typeof c.getContext === 'function' && c.getContext('2d')) || null;
        }
        if (!this._measure) return null;
        this._measure.font = (weight || this.TEXT_WEIGHT) + ' ' + size + 'px ' + this.FONT;
        return this._measure.measureText(text).width;
    },

    dispose() {
        if (this._observer) this._observer.disconnect();
        if (this._sizes) this._sizes.disconnect();
        this._sizes = null;
        this._cuts = null;
        if (this.root) this.root.remove();
        this._observer = null;
        this.root = null;
        this.canvas = null;
        this.elements.clear();
    },

    get(id) {
        return this.elements.get(id) || null;
    },

    // The translation of the labels (rules 36, item 9): the game sets it (main.js — CoopText.label); null — the
    // records' own texts (the editor).
    /** @type {((id: string, text: string) => string) | null} */
    translate: null,

    // The label of a record in the player's language: its translation, the record's own text where there is none. A copy
    // of a template that keeps the template's label names it in tpl (its own id has no translation).
    /** @param {UIRecord} d @returns {string} */
    labelOf(d) {
        const text = String(d.text == null ? '' : d.text), id = d.tpl || d.id;
        return this.translate && id ? this.translate(id, text) : text;
    },

    // The language changed: every element shows its label anew (a text the code set stays — the code renders it).
    relabel() {
        for (const e of this.elements.values()) e.apply();
    },

    // The record of an element — a template for UI.add.
    def(id) {
        return this.layout.find(d => d.id === id) || null;
    },

    // Rebuild every element from the records (the editor — after an edit). What the game has
    // set — text, value, visibility, click handler — survives by id.
    applyLayout(layout) {
        if (layout) this.layout = layout;
        if (!this.root) return;
        const old = this.elements;
        for (const e of old.values()) this.unwatch(e);
        this.elements = new Map();
        this._cuts = null;
        this.root.textContent = '';
        // All elements first, then the nesting: a child may stand before its parent in the file.
        for (const def of this.layout) this.elements.set(def.id, new UIElement(def, old.get(def.id)));
        for (const def of this.layout) this._attach(this.elements.get(def.id));
        for (const def of this.layout) this.elements.get(def.id).apply();
        this.resize();
    },

    // A runtime element from a record that is not in UILayout.js (a copy of a template). after — the id of the
    // element it is drawn next to: right over it and the copies already put there, in its place of the drawing
    // order (a copy of an action button stays under a window's dim, as its template is); none or not in the same
    // container — over everything.
    /** @param {UIRecord} def @param {string} [after] */
    add(def, after) {
        if (!this.root || !def || !def.id) return null;
        this.remove(def.id);
        const e = new UIElement(def, null);
        if (after) e.el.dataset.after = after;
        this.elements.set(def.id, e);
        this._attach(e);
        this.recut();
        e.apply();
        return e;
    },

    // Removes the element together with everything nested in it.
    remove(id) {
        const e = this.elements.get(id);
        if (!e) return;
        const inside = [...this.elements.values()].filter(c => this.isInside(c.def, id));
        for (const c of inside) { this.unwatch(c); this.elements.delete(c.def.id); }
        this.unwatch(e);
        e.el.remove();
        this.elements.delete(id);
        this.recut();
    },

    // A worn element sized by its content (a text, a stretched box) is drawn again when its size changes; unwatch —
    // when it leaves (remove, applyLayout), so the observer keeps no dead element.
    /** @param {UIElement} e */
    watch(e) {
        if (typeof ResizeObserver === 'undefined' || e._watched) return;
        if (!this._sizes) this._sizes = new ResizeObserver((list) => {
            for (const r of list) {
                const x = this.elements.get(/** @type {HTMLElement} */ (r.target).dataset.ui);
                if (x && x.el === r.target) x.apply();
            }
        });
        e._watched = true;
        this._sizes.observe(e.el);
    },

    /** @param {UIElement} e */
    unwatch(e) {
        if (e && e._watched && this._sizes) this._sizes.unobserve(e.el);
        if (e) e._watched = false;
    },

    // The cut corners of a worn button (rules 34, «Срезанный угол — заданный»): [0] — top left, [2] — bottom right.
    /** @param {string} id @returns {number[]} */
    cutsOf(id) {
        if (!this._cuts) {
            this._cuts = this.screenCuts([...this.elements.values()].map(e => e.def), (d) => {
                const e = this.elements.get(d.id);
                return !!e && e.visible;
            }, this.size());
        }
        return this._cuts.get(id) || [];
    },

    // A button shown or hidden, added or removed: the cuts are found again, and the buttons whose cuts changed are
    // drawn again once, after the current batch of changes.
    recut() {
        this._cuts = null;
        if (this._recut) return;
        this._recut = true;
        Promise.resolve().then(() => {
            this._recut = false;
            for (const e of this.elements.values()) if (e._wornKey && e._cutsDrawn !== this.cutsOf(e.def.id).join('')) e.apply();
        });
    },

    // The given cut corners (rules 34): on every screen — a window (its nearest window ancestor) or the HUD — the
    // first shown worn button in reading order (top, then left) cuts its top left corner, the last (bottom, then
    // right) its bottom right one; the window's ✕ (a square look) does not count. defs — the records; shown(def) —
    // is it shown; size — the screen in layout px. -> id -> the cut corners.
    /** @param {UIRecord[]} defs @param {(d: UIRecord) => boolean} shown @param {{ w: number, h: number }} [size] @returns {Map<string, number[]>} */
    screenCuts(defs, shown, size) {
        const W = size && size.w > 0 ? size.w : 1280, H = size && size.h > 0 ? size.h : 720;
        const byId = new Map(defs.map(d => [d.id, d])), boxes = new Map(), up = (d) => (d.parent && byId.get(d.parent)) || null;
        const box = (d, depth) => {
            if (boxes.has(d.id)) return boxes.get(d.id);
            const p = up(d), pb = p && depth < 20 ? box(p, depth + 1) : { left: 0, top: 0, w: W, h: H }, st = this.stretchOf(d);
            const w = st.h ? pb.w - 2 * (Number(d.x) || 0) : Number(d.w) || 0, h = st.v ? pb.h - 2 * (Number(d.y) || 0) : Number(d.h) || 0;
            const r = this.resolve(d, w, h, pb.w, pb.h), b = { id: d.id, left: pb.left + r.left, top: pb.top + r.top, w, h };
            boxes.set(d.id, b);
            return b;
        };
        const seen = (d) => { for (let x = d, i = 0; x && i < 20; x = up(x), i++) if (!shown(x)) return false; return true; };
        const screenOf = (d) => {
            for (let x = up(d), i = 0; x && i < 20; x = up(x), i++) {
                const l = this.LOOKS[x.look];
                if (l && l.genus === 'window' && !l.dim && x.kind !== 'text') return x.id;
            }
            return '';
        };
        const groups = new Map(), out = new Map();
        for (const d of defs) {
            const l = this.LOOKS[d.look];
            if (d.kind !== 'button' || !l || !l.worn || l.square || l.genus === 'plate' || !seen(d)) continue;
            const k = screenOf(d);
            if (!groups.has(k)) groups.set(k, []);
            groups.get(k).push(box(d, 0));
        }
        const by = (a, b, k) => (k(a) > k(b) + 0.5 ? 1 : k(a) < k(b) - 0.5 ? -1 : 0);
        for (const list of groups.values()) {
            const first = list.reduce((m, b) => (by(b, m, x => x.top) || by(b, m, x => x.left)) < 0 ? b : m);
            const last = list.reduce((m, b) => (by(b, m, x => x.top + x.h) || by(b, m, x => x.left + x.w)) > 0 ? b : m);
            out.set(first.id, [0]);
            out.set(last.id, first === last ? [0, 2] : [2]);
        }
        return out;
    },

    // The element def sits in (def.parent), null — the screen. A missing parent or a cycle in
    // the chain also gives null: a bad record lands on the screen instead of breaking the tree.
    parentOf(def) {
        const seen = new Set([def.id]);
        for (let id = def.parent; id; ) {
            const e = this.elements.get(id);
            if (!e || seen.has(id)) return null;
            seen.add(id);
            id = e.def.parent;
        }
        return def.parent ? this.elements.get(def.parent) : null;
    },

    // Is a painted element of the HUD — a panel, a bar, a button or an image with a fill, a border
    // or a picture — shown under the page point (cx, cy) (client px)? A see-through one (a layer,
    // a frame without fill) is not. skip — ids not counted (and what is nested in them). A panel
    // does not catch the pointer: the game asks this to tell the cursor over the HUD from the cursor over the world.
    /** @param {number} cx @param {number} cy @param {string[]} [skip] @returns {boolean} */
    over(cx, cy, skip) {
        for (const e of this.elements.values()) {
            const d = e.def;
            if (d.kind === 'text' || d.kind === 'ring' || !(this.paints(d) || e._src || d.src)) continue;
            if (skip && (skip.includes(d.id) || skip.some(id => this.isInside(d, id)))) continue;
            if (!e.el.isConnected || !e.el.getClientRects().length) continue;
            const r = e.el.getBoundingClientRect();
            if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) return true;
        }
        return false;
    },

    // Is def nested in the element id — directly or through its ancestors?
    isInside(def, id) {
        for (let e = this.parentOf(def); e; e = this.parentOf(e.def)) if (e.def.id === id) return true;
        return false;
    },

    _attach(e) {
        const parent = this.parentOf(e.def), box = parent ? parent.el : this.root, by = e.el.dataset.after, t = by ? this.elements.get(by) : null;
        if (!t || t.el.parentNode !== box) { box.appendChild(e.el); return; }
        let ref = t.el.nextSibling;
        while (ref && ref.dataset && ref.dataset.after === by) ref = ref.nextSibling;
        box.insertBefore(e.el, ref);
    },

    // UI px per CSS px: screen height / UI_REF_HEIGHT.
    scale() {
        const ref = typeof UI_REF_HEIGHT !== 'undefined' ? UI_REF_HEIGHT : 720;
        const h = this.canvas ? this.canvas.clientHeight : 0;
        return ref > 0 && h > 0 ? h / ref : 1;
    },

    // The root covers the canvas; its inner size is the screen in layout px.
    resize() {
        const c = this.canvas, r = this.root;
        if (!c || !r) return;
        const s = this.scale();
        r.style.left = c.offsetLeft + 'px';
        r.style.top = c.offsetTop + 'px';
        r.style.width = (c.clientWidth / s) + 'px';
        r.style.height = (c.clientHeight / s) + 'px';
        r.style.transform = 'scale(' + s + ')';
        // the windows fit the new width (fitScale)
        // and the windows' ribbons keep to the screen's left edge (ribbonLeft)
        for (const e of this.elements.values()) if ((!e.def.parent && e.def.anchor === 'middle-center') || e.def.look === 'ribbon') e.apply();
    },

    // Screen size in layout px.
    size() {
        const s = this.scale(), c = this.canvas;
        return { w: c ? c.clientWidth / s : 0, h: c ? c.clientHeight / s : 0 };
    },

    // --- Anchor math (no DOM — tests/ui.test.mjs) -------------------------------------

    // 'bottom-right' -> { v: 'bottom', h: 'right' }; garbage -> top-left.
    parseAnchor(anchor) {
        const a = this.ANCHORS.includes(anchor) ? anchor : 'top-left', p = a.split('-');
        return { v: p[0], h: p[1] };
    },

    // def.stretch -> the stretched axes; a text has no size of its own to stretch.
    stretchOf(def) {
        const s = def.kind === 'text' ? '' : def.stretch;
        return { h: s === 'h' || s === 'both', v: s === 'v' || s === 'both' };
    },

    // Record -> the top left corner of an element of size w × h in a container W × H (the screen
    // or the parent's inside). On a stretched axis x (y) is the inset, whatever the anchor.
    resolve(def, w, h, W, H) {
        const a = this.parseAnchor(def.anchor), st = this.stretchOf(def), x = Number(def.x) || 0, y = Number(def.y) || 0;
        return {
            left: st.h ? x : a.h === 'right' ? W - x - w : a.h === 'center' ? W / 2 + x - w / 2 : x,
            top: st.v ? y : a.v === 'bottom' ? H - y - h : a.v === 'middle' ? H / 2 + y - h / 2 : y,
        };
    },

    // A text record with w and h is a box (rules, section 33): its text wraps and fits it as a button's label;
    // without them a text is as long as its lines.
    /** @param {UIRecord} def @returns {boolean} */
    boxedText(def) {
        return def.kind === 'text' && Number(def.w) > 0 && Number(def.h) > 0;
    },

    // A window — a middle-centre record on the screen, not in a parent — wider than a W layout px screen less
    // WINDOW_PAD a side shrinks whole to that width (rules, section 28, 12.11: the plan sheet's ✕ off a 4:3
    // screen); else 1.
    /** @param {UIRecord} def @param {number} W */
    fitScale(def, W) {
        const w = Number(def.w) || 0;
        if (def.parent || def.anchor !== 'middle-center' || def.kind === 'text' || this.stretchOf(def).h || !w) return 1;
        return w + 2 * this.WINDOW_PAD > W ? Math.max(0.05, (W - 2 * this.WINDOW_PAD) / w) : 1;
    },

    // How far a boxed text's lines keep off the edges of its worn HUD plate (rules 34, «Строка фазы — целиком в
    // плашке», Ivan 18.11: the phase line's first letter on the outline): a side — the skew's depth over the plate's
    // height where that side is skewed, its outline and UI_TEXT_PAD; the top and the bottom — the outline. Not a
    // boxed text on a worn plate — none.
    /** @param {UIRecord} def @param {number} w @param {number} h @returns {{ left: number, right: number, y: number }} */
    textPad(def, w, h) {
        const look = this.lookOf(def);
        if (!this.boxedText(def) || !look || look.genus !== 'plate' || !look.worn || typeof UIRough === 'undefined') return { left: 0, right: 0, y: 0 };
        const line = UIRough.sizes(h).line, sk = this.skewEdge(def, look, h), cut = sk ? (sk.corner || h) * sk.tan : 0;
        const pad = typeof UI_TEXT_PAD !== 'undefined' ? UI_TEXT_PAD : 4;
        return { left: line + pad + (sk && sk.left ? cut : 0), right: line + pad + (sk && sk.right ? cut : 0), y: line };
    },

    // The inside of an element in layout px, where its children stand: its box less its border (borderWidth
    // a side, apply) — a box-sizing border-box element places absolute children in its padding box.
    /** @param {UIRecord} def @returns {{ w: number, h: number }} */
    inside(def) {
        const b = this.borderWidth(def);
        return { w: (Number(def.w) || 0) - 2 * b, h: (Number(def.h) || 0) - 2 * b };
    },

    // The lines of a label: a button's — centred, whatever its anchor (Ivan 09.11: «Начать ограбление»
    // by the right edge stood pushed right, «всё съехало и не симметрично»); a text's — to its anchor's side.
    /** @param {UIRecord} def @returns {string} */
    labelAlign(def) {
        if (def.kind === 'button' || def.look === 'ribbon') return 'center';
        const h = this.parseAnchor(def.anchor).h;
        return h === 'center' ? 'center' : h;
    },

    // Where the inside of a record's container starts on a W × H screen (layout px) and its scale: the parents' boxes
    // summed, a window shrunk by fitScale about its centre. x of a ribbon is from the screen's left edge (ribbonLeft).
    /** @param {UIRecord} def @param {number} W @param {number} H @returns {{ x: number, y: number, k: number }} */
    screenOrigin(def, W, H) {
        const L = this.layout && this.layout.length ? this.layout : (typeof UI_LAYOUT !== 'undefined' ? UI_LAYOUT : []), of = (/** @type {string} */ id) => L.find(d => d.id === id);
        /** @type {UIRecord[]} */
        const chain = [];
        for (let p = def.parent ? of(def.parent) : null; p && !chain.includes(p); p = p.parent ? of(p.parent) : null) chain.unshift(p);
        let x = 0, y = 0, k = 1, cw = W, ch = H;
        for (const a of chain) {
            const st = this.stretchOf(a), w = st.h ? cw - 2 * (Number(a.x) || 0) : Number(a.w) || 0, h = st.v ? ch - 2 * (Number(a.y) || 0) : Number(a.h) || 0;
            const p = this.resolve(a, w, h, cw, ch), f = this.fitScale(a, W), b = this.borderWidth(a);
            x += k * (p.left + (1 - f) * w / 2);
            y += k * (p.top + (1 - f) * h / 2);
            k *= f;
            x += k * b;
            y += k * b;
            cw = w - 2 * b;
            ch = h - 2 * b;
        }
        return { x, y, k };
    },

    // The window's ribbon (rules, section 34; the mock v8): its x is from the screen's left edge, whatever the window's
    // width -> the left in its container.
    /** @param {UIRecord} def @param {number} W @param {number} H */
    ribbonLeft(def, W, H) {
        const o = this.screenOrigin(def, W, H);
        return ((Number(def.x) || 0) - o.x) / o.k;
    },

    // The inverse: where the element stands -> x, y of the record for the given anchor. The editor
    // changes the anchor through it, so the element stays where it was.
    toStored(anchor, left, top, w, h, W, H) {
        const a = this.parseAnchor(anchor);
        return {
            x: a.h === 'right' ? W - left - w : a.h === 'center' ? left + w / 2 - W / 2 : left,
            y: a.v === 'bottom' ? H - top - h : a.v === 'middle' ? top + h / 2 - H / 2 : top,
        };
    },
};

// One UI element: a record (def) + its DOM + what the game has set at run time.
class UIElement {
    /** @param {UIRecord} def @param {UIElement | null} prev — the same id before a rebuild */
    constructor(def, prev) {
        this.def = def;
        this.el = document.createElement('div');
        this.el.dataset.ui = def.id;
        /** @type {HTMLElement | null} */
        this.inner = null;       // bar: the filled part; text and button: the label; image: the picture
        this._text = prev ? prev._text : null;
        this._value = prev ? prev._value : null;
        this._shown = prev ? prev._shown : null;
        this._click = prev ? prev._click : null;
        this._src = prev ? prev._src : null;
        this._at = prev ? prev._at : null;
        this._wh = prev ? prev._wh : null;
        this._font = prev ? prev._font : null;
        this._fill = prev ? prev._fill : null;
        this._look = prev ? prev._look : null;
        this._outline = prev ? prev._outline : null;
        this._tilt = prev ? prev._tilt : 0;
        this._nick = prev ? prev._nick : '';
        this._wornKey = '';        // the key of the worn plate drawn in the back layer (paintWorn): same key — no redraw
        this._cutsDrawn = '';      // the cut corners it was drawn with (UI.recut)
        this._watched = false;     // UI.watch: its size is watched
        /** @type {{ key: string, font: number } | null} */
        this._fit = null;          // fitLabel's last fit
        /** @type {HTMLElement | null} */
        this.back = null;          // a look's back layer: a skewed plate's shape, a window's strip (paintLook)
        this.el.addEventListener('click', (e) => {
            if (UI.editing || this.def.kind !== 'button' || !this._click) return;
            e.stopPropagation();
            this._click(this);
        });
    }

    setText(text) { this._text = String(text); this.apply(); return this; }

    // Bar fill 0..1.
    setValue(v) { this._value = Math.max(0, Math.min(1, Number(v) || 0)); this.apply(); return this; }

    // Image source (a path or a data: URL) instead of the record's src.
    setImage(src) { this._src = String(src); this.apply(); return this; }

    show(on) {
        const was = this.visible;
        this._shown = on !== false;
        if (was !== this.visible) UI.recut();
        this.apply();
        return this;
    }

    // A worn plate's tilt, degrees (rules 34: the main screen's column — each button its own, clamped to UI_TILT_MAX;
    // the turned plate is fitted in its box). Same value — no DOM work.
    /** @param {number} deg */
    tiltTo(deg) {
        const t = Number(deg) || 0;
        if (this._tilt === t) return this;
        this._tilt = t;
        this.apply();
        return this;
    }

    // The side of a worn button's one nick (rules 36: «Мультиплеер» — the left edge); '' — where the seed puts it.
    /** @param {string} side 'top' | 'right' | 'bottom' | 'left' | '' */
    nickTo(side) {
        const v = side || '';
        if (this._nick === v) return this;
        this._nick = v;
        this.apply();
        return this;
    }

    // x, y instead of the record's (layout px from its anchor): an element that follows a point of
    // the 3D scene (a sign over a model). Same values — no DOM work.
    moveTo(x, y) {
        if (this._at && this._at.x === x && this._at.y === y) return this;
        this._at = { x, y };
        this.apply();
        return this;
    }

    // w, h instead of the record's (layout px): an element sized by a thing of the 3D scene (a sign
    // one cell wide). Same values — no DOM work.
    sizeTo(w, h) {
        if (this._wh && this._wh.w === w && this._wh.h === h) return this;
        this._wh = { w, h };
        this.apply();
        return this;
    }

    // A text's or a button's font size (layout px) instead of the record's: a label that fits a box
    // the game sizes (sizeTo). Same value — no DOM work.
    fontTo(size) {
        if (this._font === size) return this;
        this._font = size;
        this.apply();
        return this;
    }

    // A fill (any CSS background: a color, a gradient) instead of the record's; null — the record's.
    // Same value — no DOM work.
    /** @param {string | null} fill */
    setFill(fill) {
        if (this._fill === fill) return this;
        this._fill = fill;
        this.apply();
        return this;
    }

    // An outline colour (CSS) instead of the look's: the police timer's blinking outline (rules 14, Ivan 17.11:
    // «мигание белой обводки — белое/красное»); null — the look's. Same value — no DOM work.
    /** @param {string | null} color */
    setOutline(color) {
        if (this._outline === (color || null)) return this;
        this._outline = color || null;
        this.apply();
        return this;
    }

    // The fill the element is drawn with now: setFill's, else the record's, else its look's role (the chosen look's,
    // setLook) — a blinking outline goes out in it (rules 34, Ivan 18.11: «Мигает белая обводка как это сделано для
    // таймера»); none — ''.
    /** @returns {string} */
    fillColor() {
        const d = this.def, look = UI.lookOf(this._look ? Object.assign({}, d, { look: this._look }) : d);
        return this._fill != null ? this._fill : d.fill || (look && look.fill ? UI.role(look.fill) : '');
    }

    // A look (UI.LOOKS) instead of the record's: the chosen state of the same element (rules, section 34 — the
    // chosen is filled with the select role); null — the record's. Same value — no DOM work.
    /** @param {string | null} name */
    setLook(name) {
        if (this._look === (name || null)) return this;
        this._look = name || null;
        this.apply();
        return this;
    }

    onClick(fn) { this._click = fn || null; return this; }

    // The element's size in layout px as drawn (a text — by its content): a plate sized by its text.
    /** @returns {{ w: number, h: number }} */
    box() { return { w: this.el.offsetWidth, h: this.el.offsetHeight }; }

    get visible() {
        return this._shown != null ? this._shown : this.def.visible !== 0;
    }

    // The font of a button's label that fits it: from the record's size down to UI.MIN_FONT of it,
    // a pixel a step, until the wrapped text fits the box the round corners leave (pad: x — both
    // sides together, y — the top and the bottom together; UI.textPad on a plate). Measured once per text and size (apply runs every
    // frame for some buttons); a hidden or detached button is not measured. The text's own box
    // comes from a Range: the screen scale of the UI cancels out in the ratio to the button's box.
    fitLabel(size, r, pad) {
        const d = this.def, t = this.inner, wh = this._wh || d, key = [this._label, wh.w, wh.h, size, r, pad.x, pad.y, d.stretch].join('|');
        if (this._fit && this._fit.key === key) { t.style.fontSize = this._fit.font + 'px'; return; }
        if (!this.visible || !this.el.isConnected || !t.clientWidth || !this._label) return;
        const range = document.createRange(), min = Math.ceil(size * UI.MIN_FONT);
        range.selectNodeContents(t);
        const fits = () => {
            const box = t.getBoundingClientRect(), k = box.width / t.offsetWidth || 1, txt = range.getBoundingClientRect();
            return txt.width <= (t.clientWidth - pad.x) * k + 0.5 && txt.height <= (t.clientHeight - pad.y) * k + 0.5;
        };
        let font = size;
        while (font > min && !fits()) {
            font -= 1;
            t.style.fontSize = font + 'px';
        }
        this._fit = { key, font };
    }

    // The background of a look's box: its fill role (the dim — at UI_DIM_ALPHA), the record's colour over it; a
    // look drawn behind the element (edge 'filter' or 'strip') — none here, its back layer has it (paintLook).
    /** @param {Record<string, any>} look @returns {string} */
    lookFill(look) {
        if (look.edge === 'filter' || look.edge === 'strip' || look.edge === 'ribbon' || (look.worn && typeof UIRough !== 'undefined')) return '';
        if (this.def.fill) return this.def.fill;
        if (look.side) return UI.sideFill();
        return look.fill ? UI.role(look.fill, look.dim ? UI.nums().dim : undefined) : '';
    }

    // The clip-path of a skewed plate (UI.LOOKS skew), '' — a rectangle: the edge facing the screen centre leans by
    // UI_SKEW_DEG; a tall plate (UI_PLATE_TALL) cuts only its header corner, UI_PLATE_CORNER high; a plate on a
    // painted parent is not skewed.
    /** @param {Record<string, any>} look @param {number} h @returns {string} */
    skewPath(look, h) {
        const d = this.def, parent = UI.parentOf(d), n = UI.nums(), tan = Math.tan(n.skew * Math.PI / 180);
        if (!look.skew || !n.skew || (parent && UI.paints(parent.def))) return '';
        const edge = look.skew === true ? { left: 'right', right: 'left', center: 'both' }[UI.parseAnchor(d.anchor).h] : look.skew;
        if (h > n.tall) {
            const c = n.corner, cut = (c * tan).toFixed(1) + 'px';
            return edge === 'left' ? 'polygon(' + cut + ' 0, 100% 0, 100% 100%, 0 100%, 0 ' + c + 'px)'
                : edge === 'right' ? 'polygon(0 0, calc(100% - ' + cut + ') 0, 100% ' + c + 'px, 100% 100%, 0 100%)'
                    : 'polygon(' + cut + ' 0, calc(100% - ' + cut + ') 0, 100% ' + c + 'px, 100% 100%, 0 100%, 0 ' + c + 'px)';
        }
        const w = (h * tan).toFixed(1) + 'px';
        return edge === 'left' ? 'polygon(' + w + ' 0, 100% 0, 100% 100%, 0 100%)'
            : edge === 'right' ? 'polygon(0 0, 100% 0, calc(100% - ' + w + ') 100%, 0 100%)'
                : 'polygon(0 0, 100% 0, calc(100% - ' + w + ') 100%, ' + w + ' 100%)';
    }

    // A look's outline and shadow (UI.LOOKS edge; rules, section 34), and its back layer: a skewed plate's shape
    // (the outline — drop-shadows of the element: clip-path cuts a border) or a window's full-width strip. No look —
    // no back layer.
    /** @param {Record<string, any> | null} look */
    paintLook(look) {
        const d = this.def, s = this.el.style, edge = look ? look.edge : '';
        const worn = !!look && typeof UIRough !== 'undefined' && d.kind !== 'bar' && (!!look.worn || edge === 'strip' || edge === 'ribbon');
        const back = worn || edge === 'filter' || edge === 'strip';
        if (back && !this.back) { this.back = document.createElement('div'); this._wornKey = ''; }
        if (this.back && (!back || this.back.parentNode !== this.el)) {
            this.back.remove();
            if (back) this.el.insertBefore(this.back, this.el.firstChild);
            else this.back = null;
        }
        if (!look) return;
        const n = UI.nums(), line = n.line + 'px', drop = '0 ' + n.drop + 'px 0 ' + UI.role('shadow');
        const outline = this._outline || d.border || (look.outline ? UI.role(look.outline) : ''), filters = [];
        const fill = this._fill != null ? this._fill : d.fill || (look.fill ? UI.role(look.fill) : '');
        if (worn) {
            this.paintWorn(look, fill, outline, filters);
        } else if (edge === 'filter') {
            for (const [x, y] of [[n.line, 0], [-n.line, 0], [0, n.line], [0, -n.line]]) if (outline && n.line) filters.push('drop-shadow(' + x + 'px ' + y + 'px 0 ' + outline + ')');
            if (look.shadow) filters.push('drop-shadow(' + drop + ')');
            const h = Number(this._wh ? this._wh.h : d.h) || this.el.offsetHeight || 0;
            this.back.style.cssText = 'position: absolute; inset: 0; z-index: -1; background: ' + (fill || 'transparent') + ';';
            const clip = this.skewPath(look, h);
            if (clip) this.back.style.setProperty('clip-path', clip);
        } else if (edge === 'strip') {
            // a window: a strip across the whole screen behind the element; the element does not clip it
            s.overflow = 'visible';
            this.back.style.cssText = 'position: absolute; top: 0; bottom: 0; left: -5000px; right: -5000px; z-index: -1; box-sizing: border-box;'
                + ' background: ' + (fill || 'transparent') + '; border-top: ' + line + ' solid ' + outline + '; border-bottom: ' + line + ' solid ' + outline
                + ';' + (look.shadow ? ' box-shadow: ' + drop + ';' : '');
        } else if (edge === 'border' && outline && d.kind !== 'text') {
            s.border = line + ' solid ' + outline;
            if (look.shadow) s.boxShadow = drop;
        } else if (edge === 'ring' && outline) {
            s.boxShadow = '0 0 0 ' + line + ' ' + outline;
        } else if (look.shadow && d.kind === 'image') {
            filters.push('drop-shadow(' + drop + ')');
        } else if (look.shadow && look.fill && d.kind !== 'text') {
            s.boxShadow = drop;
        }
        if (look.border) {
            // a stamp: a thin border of its text's colour (an entity's colour of the record over the role); a rule — its top line
            const ink = (d.kind === 'text' ? d.color : d.border) || UI.role(look.border);
            if (d.kind === 'text' && this.inner) Object.assign(this.inner.style, { border: '2px solid ' + ink, padding: '0 6px' });
            else if (d.kind !== 'text') s[edge === 'rule' ? 'borderTop' : 'border'] = '2px solid ' + ink;
        }
        if (look.gray) filters.push('grayscale(1)');
        if (filters.length) s.filter = filters.join(' ');
    }

    // A worn look (rules 34, js/UIRough.js): the crumpled SVG in the back layer — drawn again only when its key (size,
    // colours, cuts, tilt) changes; the shadow — a drop-shadow of the element (its box clips its children, not a
    // filter); the unavailable button has none and lies lower by it. A button keeps a transparent UI_LINE border: its
    // children stay where they were.
    /** @param {Record<string, any>} look @param {string} fill @param {string} outline @param {string[]} filters */
    paintWorn(look, fill, outline, filters) {
        const d = this.def, s = this.el.style, edge = look.edge, st = UI.stretchOf(d), b = edge === 'border' ? UI.nums().line : 0;
        const rec = (d.kind !== 'text' || UI.boxedText(d)) && !st.h && !st.v, size = this._wh || d;
        const W = rec ? Number(size.w) || 0 : this.el.offsetWidth || 0, H = rec ? Number(size.h) || 0 : this.el.offsetHeight || 0;
        if (!rec) UI.watch(this);
        s.background = 'transparent';
        s.isolation = 'isolate';
        if (b) {
            // the plate lies under the transparent border (left/top −b): the clip reaches the border box, else
            // overflow: hidden cut b px of its outline (Ivan 17.11: «обводка не повторяет фигуру кнопки»)
            s.border = b + 'px solid transparent';
            s.overflow = 'clip';
            s.overflowClipMargin = b + 'px';
        }
        if (edge === 'strip' || edge === 'ribbon') s.overflow = 'visible';
        const shadow = UI.role('shadow'), button = look.genus === 'button' || look.genus === 'select';
        const cuts = button && !look.square ? UI.cutsOf(d.id) : [], skew = UI.skewEdge(d, look, H);
        const key = [edge, W, H, fill, outline, cuts.join(''), this._tilt, this._nick, JSON.stringify(skew)].join('|');
        this._cutsDrawn = cuts.join('');
        this.back.style.cssText = 'position: absolute; left: 0; top: 0; width: 0; height: 0; overflow: visible; z-index: -1; pointer-events: none;';
        if (!(W > 0 && H > 0)) {
            this._wornKey = '';
            this.back.innerHTML = '';
            return;
        }
        if (key !== this._wornKey) {
            this._wornKey = key;
            const seed = UIRough.seed(d.id), o = { w: W, h: H, seed, fill, outline, shadow };
            this.back.innerHTML = edge === 'strip' ? UIRough.strip(o) : edge === 'ribbon' ? UIRough.ribbon(o)
                : UIRough.plateSvg(UI.plateShape(d, look, W, H, this._tilt, this._nick, cuts), { w: W, h: H, left: -b, top: -b, fill, outline, grid: button });
            for (const e of UI.elements.values()) if (e._clipped && e !== this && e.def.parent === d.id) e.apply();
        }
        if (edge === 'strip' || edge === 'ribbon' || !look.shadow) return;
        const drop = UIRough.sizes(H).drop;
        if (look.gray) s.transform = (s.transform || '') + ' translateY(' + drop + 'px)';
        else filters.push('drop-shadow(0 ' + drop + 'px 0 ' + shadow + ')');
    }

    // A label's text into its inner node (rules 34): the signs the fonts lack (js/UIIcons.js) as inline SVG icons in
    // the label's colour, as high as the capitals of its font, with its text-shadow; a text without them — plain text.
    // The markup is put again only when it changes (apply runs every frame for some buttons). _label — the text
    // shown: fitLabel measures by it (the icons are not in textContent).
    /** @param {string} text @param {string} [shadow] */
    putLabel(text, shadow = '') {
        this._label = text;
        if (!text || typeof UIIcons === 'undefined' || !UIIcons.has(text)) {
            this.inner.textContent = text;
            this._html = null;
            return;
        }
        const html = UIIcons.html(text, this.inScene() ? UI.nums().sceneCap : UI.nums().cap, shadow);
        if (this._html === html && this.inner.firstChild !== null) return;
        this.inner.innerHTML = html;
        this._html = html;
    }

    // Whether the element is a sign over the scene (in one of UI.SCENE_LAYERS: the Nunito font, not scaled).
    inScene() {
        for (let e = /** @type {UIElement | null} */ (this); e; e = UI.parentOf(e.def)) if (UI.SCENE_LAYERS.includes(e.def.id)) return true;
        return false;
    }

    // A child of a worn HUD plate within the plate's shape (rules 34, «Содержимое плашки HUD — внутри её формы»):
    // off the skewed edge by UI.skewShift; the chosen strip (the select look) clipped by the plate's body — clipped
    // again when the plate's shape changes (paintWorn). The editor
    // shows the record as it is (its drag goes by the record). -> { dx, dw, clip }: px off the edge, px less width,
    // the clip-path ('' — none).
    keepInPlate() {
        const d = this.def, pe = UI.parentOf(d), plook = pe ? UI.lookOf(pe.def) : null, none = { dx: 0, dw: 0, clip: '' };
        this._clipped = false;
        if (UI.editing || !pe || !plook || !plook.worn || plook.genus !== 'plate' || typeof UIRough === 'undefined') return none;
        const sized = d.kind !== 'text' || UI.boxedText(d), size = this._wh || d, ps = pe._wh || pe.def;
        const lines = String(this._text != null ? this._text : d.text || '').split('\n').length;
        const w = sized ? Number(size.w) || 0 : 0, h = sized ? Number(size.h) || 0 : (this._font || Number(d.fontSize) || 20) * 1.2 * lines;
        const pw = Number(ps.w) || 0, ph = Number(ps.h) || 0, at = this._at ? Object.assign({}, d, this._at) : d;
        const sh = UI.skewShift(at, w, h, pe.def, pw, ph), look = UI.lookOf(this._look ? Object.assign({}, d, { look: this._look }) : d);
        this._clipped = !!look && look.edge === 'ring' && pw > 0 && ph > 0;
        if (!this._clipped) return { dx: sh.dx, dw: sh.dw, clip: '' };
        const r = UI.resolve(Object.assign({}, at, { x: (Number(at.x) || 0) + sh.dx }), w - sh.dw, h, pw, ph);
        const body = UI.plateShape(pe.def, plook, pw, ph, pe._tilt, pe._nick).body;
        return { dx: sh.dx, dw: sh.dw, clip: 'polygon(' + body.map(([bx, by]) => (bx - r.left).toFixed(1) + 'px ' + (by - r.top).toFixed(1) + 'px').join(', ') + ')' };
    }

    // Record + run-time state -> DOM. Cheap: called on every edit and every setText.
    apply() {
        const d = this.def, s = this.el.style, a = UI.parseAnchor(d.anchor), keep = this.keepInPlate();
        const x = (Number(this._at ? this._at.x : d.x) || 0) + keep.dx, y = Number(this._at ? this._at.y : d.y) || 0, px = (v) => (Number(v) || 0) + 'px';
        const boxed = UI.boxedText(d), sized = d.kind !== 'text' || boxed, st = UI.stretchOf(d);
        s.cssText = '';
        s.position = 'absolute';
        s.boxSizing = 'border-box';
        // The container is the parent's box (an absolute element positions its children) or the
        // root. A stretched axis pins both edges with the same inset; w (h) is not used there.
        const ribbon = d.look === 'ribbon' && a.h === 'left' && !!d.parent && !UI.editing, scr = ribbon ? UI.size() : null;
        s.left = ribbon && scr ? px(UI.ribbonLeft(Object.assign({}, d, { x }), scr.w, scr.h))
            : st.h || a.h === 'left' ? px(x) : a.h === 'center' ? 'calc(50% + ' + px(x) + ')' : '';
        s.right = st.h || a.h === 'right' ? px(x) : '';
        s.top = st.v || a.v === 'top' ? px(y) : a.v === 'middle' ? 'calc(50% + ' + px(y) + ')' : '';
        s.bottom = st.v || a.v === 'bottom' ? px(y) : '';
        const fit = UI.fitScale(this._wh ? Object.assign({}, d, this._wh) : d, UI.size().w);
        s.transform = 'translate(' + (!st.h && a.h === 'center' ? '-50%' : '0') + ', ' + (!st.v && a.v === 'middle' ? '-50%' : '0') + ')' + (fit < 1 ? ' scale(' + fit + ')' : '');
        if (sized && !st.h) s.width = px((Number(this._wh ? this._wh.w : d.w) || 0) - keep.dw);
        if (keep.clip) s.clipPath = keep.clip;
        if (sized && !st.v) s.height = px(this._wh ? this._wh.h : d.h);
        s.opacity = String(d.alpha == null ? 1 : Math.max(0, Math.min(1, Number(d.alpha))));
        s.display = this.visible || UI.editing ? 'block' : 'none';
        if (UI.editing && !this.visible) s.opacity = String(Number(s.opacity) * 0.35);
        s.pointerEvents = UI.editing || d.kind === 'button' ? 'auto' : 'none';
        s.cursor = UI.editing ? 'move' : d.kind === 'button' ? 'pointer' : '';
        if (UI.SCENE_LAYERS.includes(d.id)) Object.assign(s, { fontFamily: UI.SCENE_FONT, webkitTextStroke: '0' });   // the signs over the scene

        // The look (rules, section 34): the colours of its roles; a record's own colour is an entity's, over the role.
        const look = UI.lookOf(this._look ? Object.assign({}, d, { look: this._look }) : d), ink = look ? (d.color || UI.role(look.text || 'paper')) : (d.color || UI.role('paper'));
        if (look && look.fade) s.opacity = String(Number(s.opacity) * (typeof UI_OFF_ALPHA !== 'undefined' ? UI_OFF_ALPHA : 0.45));
        if (sized) {
            s.background = (this._fill != null ? this._fill : look ? this.lookFill(look) : d.fill) || 'transparent';
            s.border = look ? 'none' : d.border ? '2px solid ' + d.border : 'none';
            s.borderRadius = px(d.radius);
            s.overflow = 'hidden';
        }
        this.paintLook(look);
        if (d.kind === 'ring') {
            // a band of a quarter of the radius; the middle is see-through (a text or a panel under it shows)
            const v = this._value != null ? this._value : Math.max(0, Math.min(1, Number(d.value) || 0)), deg = (v * 360).toFixed(1) + 'deg';
            const soft = (Math.min(360, v * 360 + 1)).toFixed(1) + 'deg';   // keep: a degree of blend — the ring's end without steps
            s.background = 'conic-gradient(' + ink + ' 0 ' + deg + ', ' + (d.fill || 'transparent') + ' ' + soft + ' 360deg)';
            s.borderRadius = '50%';
            const hole = 'radial-gradient(farthest-side, transparent 74%, #000 75%)';
            s.setProperty('mask', hole);
            s.setProperty('-webkit-mask', hole);
        }
        const label = d.kind === 'text' || d.kind === 'button';
        if (label || d.kind === 'bar' || d.kind === 'image') {
            if (!this.inner) {
                this.inner = document.createElement('div');
                this._html = null;
                this.el.appendChild(this.inner);
            }
        } else if (this.inner) {
            this.inner.remove();
            this.inner = null;
        }
        if (label) {
            const t = this.inner.style;
            t.cssText = '';
            t.whiteSpace = 'pre';
            t.fontSize = px(this._font || d.fontSize || 20);
            t.fontWeight = look && look.caps ? UI.CAPS_WEIGHT : UI.TEXT_WEIGHT;
            if (look && look.caps) Object.assign(t, { textTransform: 'uppercase', letterSpacing: UI.spacingOf(look) });
            t.lineHeight = '1.2';
            t.color = ink;
            if (look && look.edge === 'ribbon') t.padding = '0 0.6em';   // the ribbon's forked tail keeps off the last letter
            t.textAlign = UI.labelAlign(d);
            if (look) {
                // a text's own shadow falls down (a text on a plate); a label on a button or a strip has none
                if (look.shadow && d.kind === 'text') t.textShadow = '0 ' + UI.nums().drop + 'px 0 ' + (d.shadow || UI.role(look.shadow));
                // a loud mark: an ink outline of UI_LOUD_LINE round the letters (eight shadows), the drop under it
                if (look.stroke && d.kind === 'text') {
                    const k = UI.nums().loud, c = UI.role(look.stroke), r = (v) => Math.round(v * 100) / 100;
                    const ring = [0, 1, 2, 3, 4, 5, 6, 7].map(i => r(k * Math.cos(i * Math.PI / 4)) + 'px ' + r(k * Math.sin(i * Math.PI / 4)) + 'px 0 ' + c);
                    t.textShadow = ring.concat(t.textShadow ? [t.textShadow] : []).join(', ');
                }
            } else if (d.shadow) t.textShadow = '0 1px 2px ' + d.shadow + ', 0 0 3px ' + d.shadow;
            this.putLabel(this._text != null ? this._text : UI.labelOf(d), t.textShadow || '');
            if (d.kind === 'button' || boxed) {
                // A label never leaves its button (Ivan 25.10): it wraps at spaces inside the box the
                // round corners leave, and only what still does not fit gets a smaller font. A text with
                // a box (the tutorial's plate, rules section 33) — the same in its whole box, centred.
                const r = boxed ? 0 : Math.min(Number(d.radius) || 0, (Number(d.w) || 0) / 2, (Number(d.h) || 0) / 2);
                const wh = this._wh || d, round = Math.max(4, Math.round(r * UI.CORNER_INSET));
                const pad = boxed ? UI.textPad(d, Number(wh.w) || 0, Number(wh.h) || 0) : { left: round, right: round, y: 0 };
                Object.assign(t, { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%',
                    boxSizing: 'border-box', padding: '0 ' + px(pad.right) + ' 0 ' + px(pad.left), whiteSpace: 'pre-wrap', overflowWrap: 'normal' });
                this.fitLabel(Number(d.fontSize) || 20, r, { x: pad.left + pad.right, y: boxed ? 2 * pad.y : 2 * round });
            }
        } else if (d.kind === 'bar') {
            const v = this._value != null ? this._value : Math.max(0, Math.min(1, Number(d.value) || 0));
            this.putLabel('');
            this.inner.style.cssText = 'height: 100%; width: ' + (v * 100) + '%; background: ' + ink + ';';
        } else if (d.kind === 'image') {
            const src = this._src != null ? this._src : String(d.src || '');
            this.putLabel('');
            this.inner.style.cssText = 'width: 100%; height: 100%; background: center / contain no-repeat'
                + (src ? ' url("' + src.replace(/"/g, '%22') + '")' : '') + ';';
        }
    }
}
