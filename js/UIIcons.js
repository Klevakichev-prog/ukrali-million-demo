// UIIcons.js — the icons of the interface's labels (rules, section 34: «Значков ✓ ◀ ▶ ▼ − + в шрифте нет — они
// SVG-значки цветом надписи»). The fonts lack these signs (js/UIFont.js cuts them out of OpenGOST's unicode-range,
// Nunito has none), so a system font would draw them its own way on every machine. UI.js keeps the texts as they
// are (design/texts/*.json, UILayout.js) and, when it shows a label, puts an inline SVG in place of each sign:
// drawn in currentColor (the colour of the label), as high as the font's capitals, standing on the baseline.
// Pure markup, no DOM. Emoji are not icons and stay text.
//
// A shape is drawn in a box 10 units high (the cap height) and w units wide: strokes (s) — lines of STROKE units
// with round ends, fills (f) — solid areas. Strokes keep 0.8 units off the box's edges; the SVG does not clip.

/** @satisfies {Record<string, any>} */
const UIIcons = {
    STROKE: 1.6,          // the line of a stroked icon, in the units of the cap height (10)
    HEAVY: 2.2,           // the line of the heavy check ✔
    GAP: 0.06,            // em: the space on each side of an icon (the side bearing of a letter)

    // sign -> { w: the box's width, s: a stroked path, f: a filled path, heavy: the heavy line }
    /** @type {Record<string, { w: number, s?: string, f?: string, heavy?: boolean }>} */
    SHAPES: {
        '✓': { w: 10, s: 'M1 5.6 L3.9 8.6 L9 1.4' },
        '✔': { w: 10, s: 'M1.2 5.6 L3.9 8.6 L8.8 1.4', heavy: true },
        '✕': { w: 9, s: 'M1 1.5 L8 8.5 M8 1.5 L1 8.5' },
        '◀': { w: 9, f: 'M9 0 L0 5 L9 10 Z' },
        '▶': { w: 9, f: 'M0 0 L9 5 L0 10 Z' },
        '▲': { w: 11, f: 'M0 10 L5.5 0 L11 10 Z' },
        '▼': { w: 11, f: 'M0 0 L11 0 L5.5 10 Z' },
        '▾': { w: 8, f: 'M0 3 L8 3 L4 8.5 Z' },
        '−': { w: 9, s: 'M1 5 L8 5' },
        '+': { w: 9, s: 'M4.5 1.5 L4.5 8.5 M1 5 L8 5' },
        '●': { w: 10, f: 'M0 5 A5 5 0 1 0 10 5 A5 5 0 1 0 0 5 Z' },
        '○': { w: 10, s: 'M0.8 5 A4.2 4.2 0 1 0 9.2 5 A4.2 4.2 0 1 0 0.8 5 Z' },
        '⌂': { w: 10, s: 'M1 9.2 L1 4.6 L5 1 L9 4.6 L9 9.2 Z' },
        '★': { w: 10.5, f: 'M5.25 0.35 L6.48 3.9 L10.24 3.98 L7.25 6.25 L8.34 9.85 L5.25 7.7 L2.16 9.85 L3.25 6.25 L0.26 3.98 L4.02 3.9 Z' },
        '☆': { w: 10.5, s: 'M5.25 1.1 L6.3 4.4 L9.6 4.45 L7 6.45 L7.95 9.6 L5.25 7.7 L2.55 9.6 L3.5 6.45 L0.9 4.45 L4.2 4.4 Z' },
        '↶': { w: 10, s: 'M9 9 L9 6 A3.5 3.5 0 0 0 2 6 L2 8.2 M0.8 5.4 L2 8.2 L3.2 5.4' },
        '↩': { w: 10, s: 'M8.6 1 L8.6 4.5 A2.6 2.6 0 0 1 6 7.1 L1.6 7.1 M4.2 4.5 L1.6 7.1 L4.2 9.7' },
    },

    /** @type {RegExp | null} */
    _re: null,
    // The signs drawn as icons, one pattern (built once).
    re() {
        if (!this._re) this._re = new RegExp('[' + Object.keys(this.SHAPES).map(c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join('') + ']', 'g');
        return this._re;
    },

    /** @param {string} text @returns {boolean} whether the text has a sign drawn as an icon */
    has(text) {
        const re = this.re();
        re.lastIndex = 0;
        return re.test(text);
    },

    /** @param {string} s @returns {string} the text safe for innerHTML */
    escape(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    // One icon as inline SVG: cap — the capitals' height in ems of the label's font; shadow — the label's
    // text-shadow, '' none (an SVG takes no text-shadow: the same shadows as drop-shadow filters).
    /** @param {string} ch @param {number} cap @param {string} [shadow] @returns {string} */
    svg(ch, cap, shadow = '') {
        const sh = this.SHAPES[ch];
        if (!sh) return this.escape(ch);
        const k = cap / 10, em = (/** @type {number} */ v) => Number(v.toFixed(4)) + 'em';
        const filter = shadow ? 'filter:' + shadow.split(/,(?![^(]*\))/).map(s => 'drop-shadow(' + s.trim() + ')').join(' ') + ';' : '';
        const body = (sh.f ? '<path d="' + sh.f + '" fill="currentColor"/>' : '')
            + (sh.s ? '<path d="' + sh.s + '" fill="none" stroke="currentColor" stroke-width="' + (sh.heavy ? this.HEAVY : this.STROKE)
                + '" stroke-linecap="round" stroke-linejoin="round"/>' : '');
        return '<svg class="arc-ui-icon" viewBox="0 0 ' + sh.w + ' 10" aria-hidden="true" style="display:inline;width:' + em(sh.w * k)
            + ';height:' + em(cap) + ';vertical-align:baseline;margin:0 ' + em(this.GAP) + ';overflow:visible;' + filter + '">' + body + '</svg>';
    },

    // A label as HTML: the text escaped, each sign of SHAPES an inline SVG (see svg).
    /** @param {string} text @param {number} cap @param {string} [shadow] @returns {string} */
    html(text, cap, shadow = '') {
        const re = this.re();
        let out = '', at = 0;
        re.lastIndex = 0;
        for (let m = re.exec(text); m; m = re.exec(text)) {
            out += this.escape(text.slice(at, m.index)) + this.svg(m[0], cap, shadow);
            at = m.index + 1;
        }
        return out + this.escape(text.slice(at));
    },
};
