// main.js — entry point: 3D engine -> location with objects from Objects.js -> camera ->
// UI (UILayout.js) -> game (CoopGame.js — the co-op level; Game.js — the five original levels
// with ?classic in the address) -> the main screen over it (MainMenu.js, a bare address) -> frame loop (Sound3D hears from where the camera is). window.app = { location, camera, game } —
// for the console and for game code built on top of the kit.

function updateLoadingProgress(percent) {
    const bar = /** @type {HTMLElement | null} */ (document.querySelector('.loading-progress'));
    if (bar) bar.style.width = percent + '%';
}

// The loading screen goes away when the location is ready.
function hideLoader() {
    updateLoadingProgress(100);
    setTimeout(() => {
        const screen = document.getElementById('loading-screen');
        if (screen) screen.style.display = 'none';
    }, 300);
}

function showBootError(text) {
    console.error(text);
    const el = document.querySelector('.loading-text');
    if (el) el.textContent = text;
}

function startGame() {
    if (window.app) return;                 // guard against a repeated start
    // the demo (rules 38): an address of a level not in it opens the main screen, its level in co-op — single play
    const demoTo = MainMenu.demoAddress(window.location.search);
    if (demoTo !== null) { MainMenu.go(demoTo); return; }
    LoadLog.start();                        // the loading log (LoadLog.js): logs/load.log
    CoopText.setLang(Profile.load().lang);   // the player's language (rules 36, item 9): every text in it from the first one
    UI.translate = CoopText.label;           // …and the layout's labels
    document.title = CoopText.t('menu.title');
    if (typeof SimplexNoise === 'undefined') { showBootError(CoopText.t('menu.boot_no_noise')); return; }
    const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('world3d'));
    updateLoadingProgress(40);
    ScreenMode.start();   // the PC build's screen (rules 36): the 3D picture's height in fullscreen, from the first frame
    if (!LoadLog.time('engine', () => World3D.init(canvas))) { showBootError(CoopText.t('menu.boot_no_3d')); return; }
    const gl = World3D.engine.getGlInfo();
    LoadLog.note('gpu ' + gl.renderer + ' / ' + gl.vendor);

    const location = LoadLog.time('location', () => new Location3D({ objects: typeof LOCATION_OBJECTS !== 'undefined' ? LOCATION_OBJECTS : [] }));
    LoadLog.track('location ready (ground, shaders)', location.ready);
    const camera = new CameraController(location.view, {
        terrain: location.terrain,
        bounds: { w: location.width, h: location.height },
        edgeScroll: true   // the cursor at the screen's edge flies as WASD (Ivan 10.11)
    });
    camera.attach(canvas);
    UI.init(canvas);
    window.app = { location, camera, game: null };
    const classic = /[?&]classic\b/.test(window.location.search);
    let game;
    // a level that does not load (a bad address, a data error) says why instead of a blank screen
    try { game = window.app.game = LoadLog.time('game and level scene', () => classic ? new Game(window.app) : new CoopGame(window.app, MainMenu.wanted(window.location.search) ? COOP_MENU : null)); }
    catch (e) { showBootError(CoopText.t('menu.boot_level', { error: e instanceof Error ? e.message : e })); throw e; }
    // The walls' picture stand (CoopStand, the debug panel F2): on a level, not on the main screen, in the tutorial or the demo.
    if (game instanceof CoopGame && !game.menu && !game.tutSteps && !MainMenu.demo()) game.stand = new CoopStand(game);
    MainMenu.bindBack();
    MainMenu.applySettings();   // the player's volumes of sound and music (Profile.js)
    if (MainMenu.wanted(window.location.search)) MainMenu.open();
    console.log('ArcEngine: the location is up, ' + location.objects.length + ' objects.');
    updateLoadingProgress(70);

    // The level is ready when every model file has arrived and the scene's shaders are built.
    LoadLog.whenIdle(() => location.view.scene.executeWhenReady(() => LoadLog.add(performance.now(), 'level ready', 'total since the page started')));

    let last = performance.now(), first = true;
    World3D.engine.runRenderLoop(() => {
        const now = performance.now(), dt = (now - last) / 1000;
        last = now;
        game.update(Math.min(0.1, dt));
        location.update(dt);
        camera.update(dt);
        Sound3D.update(camera);
        if (first) LoadLog.time('first frame', () => World3D.renderFrame());
        else World3D.renderFrame();
        first = false;
    });
    window.addEventListener('resize', () => World3D.resize());
    location.ready.then(hideLoader);
}

window.onload = () => startGame();
