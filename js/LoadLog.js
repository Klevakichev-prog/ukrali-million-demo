// LoadLog.js — the loading log of a page: how long the game, the location, the level scene and
// each model file took. Every line goes to the console ([load] …) and the whole log is written
// to one file, overwritten by each page load (a level switch reloads the page):
//   dev server (tools/dev-server.mjs) — Game/logs/load.log;
//   PC build (_utils/desktop/main.js) — logs/load.log next to the exe.
// Elsewhere (a static web host) the write fails quietly: the console still has the lines.
//
// A line: the time since the page started, ms; the stage's own time, ms; the stage; a note.
// Async stages (model files) are written when they finish, so lines are in finish order; a model's
// time runs from its request to its parse and includes the wait behind other work on the main
// thread (bake of the files before it) — the bake lines are the own CPU time.
// whenIdle(cb) — every tracked load has settled; main.js closes the log with the level ready.
// Off until start() (main.js): tests and the editor load the scripts without a log.

/** @satisfies {Record<string, any>} */
const LoadLog = {
    URL: 'logs/load.log',
    /** @type {string[]} */
    lines: [],
    open: 0,                 // tracked loads still running
    /** @type {(() => void)[]} */
    _idle: [],
    _seen: new Set(),        // tracked stage names: a cached file is logged once
    _timer: 0,
    _started: false,

    // The head of the log: the date, the address, the browser, the build (PC build only).
    start() {
        if (this._started) return;
        this._started = true;
        this.lines.push('load log ' + new Date().toISOString() + '  ' + (window.location.search || '(bare address)'));
        this.lines.push('agent ' + navigator.userAgent);
        this.lines.push('       t ms    stage ms  stage');
        this.add(performance.now(), 'page and scripts');
        if (window.location.protocol === 'app:') {
            fetch('build.json').then(r => r.json()).then(b => this.note('build ' + b.hash + ' (' + b.commit + ') ' + b.time), () => {});
        }
    },

    // A free line under the head (GPU, build).
    note(text) {
        if (!this._started) return;
        this.lines.splice(2, 0, text);
        this._schedule();
    },

    // A stage that took ms; note — what it was (count of pieces, an error).
    add(ms, stage, note) {
        if (!this._started) return;
        const pad = (n, w) => String(Math.round(n)).padStart(w);
        const line = pad(performance.now(), 8) + '  ' + pad(ms, 10) + '  ' + stage + (note ? '  ' + note : '');
        this.lines.push(line);
        console.log('[load] ' + line.trim());
        this._schedule();
    },

    // The time for a stage measured by its owner (bake): 0 while the log is off.
    clock() {
        return this._started ? performance.now() : 0;
    },

    // Runs fn and logs its time; returns what fn returns.
    time(stage, fn) {
        if (!this._started) return fn();
        const t = performance.now();
        const r = fn();
        this.add(performance.now() - t, stage);
        return r;
    },

    // Logs the promise's time when it settles (once per stage name); whenIdle waits for it.
    track(stage, promise) {
        if (!this._started || this._seen.has(stage)) return promise;
        this._seen.add(stage);
        const t = performance.now();
        this.open++;
        const done = (note) => {
            this.add(performance.now() - t, stage, note);
            if (--this.open === 0) setTimeout(() => this._fireIdle());
        };
        promise.then(() => done(), (e) => done('FAILED ' + ((e && e.message) || e)));
        return promise;
    },

    // cb once nothing tracked is running (at once if nothing is).
    whenIdle(cb) {
        if (this.open === 0) cb();
        else this._idle.push(cb);
    },

    // A task later than the settle: the then() of the waiting code (bake of the walls) has run,
    // and a load it started is counted.
    _fireIdle() {
        if (this.open === 0) for (const cb of this._idle.splice(0)) cb();
    },

    text() {
        return this.lines.join('\n') + '\n';
    },

    // The write is put off a little: a burst of model lines is one request.
    _schedule() {
        if (this._timer) return;
        const ms = typeof LOAD_LOG_FLUSH_MS !== 'undefined' ? LOAD_LOG_FLUSH_MS : 500;
        this._timer = setTimeout(() => { this._timer = 0; this.flush(); }, ms);
    },

    flush() {
        fetch(this.URL, { method: 'PUT', body: this.text() }).catch(() => {});
    }
};
