// CoopGameMenu.js — a part of CoopGame (CoopGame.js): the main screen's background (rules, section 36,
// item 3; the mock of 17.11). The level behind the menu is night level 1 with the gang of four on the
// street by the shop, the camera from the side and above, and the plan's signs of the level's solution
// as the game shows them — one per spot, no trail. All of it is data (design/menu/main_screen.json ->
// COOP_MENU, tools/make-coop-levels.mjs): the gang is a copy of the level's team for the screen only,
// the signs come from running the solution through the model, so a moved solution moves them.
// Methods of the game, mixed into its prototype; the helpers are statics of CoopGame.

/** @satisfies {ThisType<CoopGame>} */
const CoopGameMenu = {
    // The level as the menu's still scene (the game was made with the menu's data): the gang stands
    // where the data puts it, the van and the street's barriers are hidden, the camera is held.
    stageMenu() {
        const m = this.menu, sc = this.scene;
        sc.pins = m.gang.map((/** @type {any} */ g) => ({ at: g.at, yaw: g.yaw }));
        sc.hideNames = m.hide;
        sc.hideVan = m.hide.includes('van');
        this.holdMenuCamera();
    },

    // The menu's camera (CoopGame.menuPose) set before every render, after the camera controller's
    // own update; the vertical field of view widens on a screen narrower than the data's frame, so
    // the frame's width stays (16:10 sees more above and below, not less of the shop).
    holdMenuCamera() {
        const sc = this.scene, view = sc.view, cam = view.camera, m = this.menu.camera, p = CoopGame.menuPose(m), base = cam.fov;
        const at = (/** @type {number[]} */ q) => new BABYLON.Vector3(sc.ox + q[0] * sc.cell, q[2] * sc.cell, sc.oy + q[1] * sc.cell);
        const eye = at(p.eye), target = at(p.target), engine = sc.scene.getEngine();
        const apply = () => {
            cam.fov = CoopGame.menuFov(base, engine.getRenderWidth() / Math.max(1, engine.getRenderHeight()), m.frame);
            cam.position.copyFrom(eye);
            cam.setTarget(target);
        };
        sc.scene.onBeforeRenderObservable.add(apply);
        apply();
    },
};
Object.assign(CoopGame.prototype, CoopGameMenu);
