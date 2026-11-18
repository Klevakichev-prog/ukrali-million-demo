// Constants.js — ALL the kit's numbers: location, camera, render. Loaded FIRST:
// the other modules read these globals. Edited by the editor (_utils/editor): the server
// patches only lines of the form `const NAME = <number>;` — keep values as numeric
// literals (colors — 0xRRGGBB); the editor won't touch a formula.
const GAME_VERSION = '0.1.0'; // build version: ?v= on scripts (tools/build.mjs) and the archive name

// localStorage shim: in a sandbox iframe and when site data is blocked, direct access throws SecurityError.
// All storage access goes through Store only.
/** @satisfies {Record<string, any>} */
const Store = {
    get(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    },
    set(key, value) {
        try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
    },
    remove(key) {
        try { localStorage.removeItem(key); } catch (e) { /* nothing to remove */ }
    },
    // JSON parsing that never throws: a broken value = as if there were no save.
    getJSON(key, fallback = null) {
        const raw = Store.get(key);
        if (raw === null) return fallback;
        try {
            const parsed = JSON.parse(raw);
            return (parsed && typeof parsed === 'object') ? parsed : fallback;
        } catch (e) {
            console.warn('Store: a broken value "' + key + '", reset.');
            Store.remove(key);
            return fallback;
        }
    }
};

// A 0xRRGGBB colour of this file as CSS: '#rrggbb', with alpha — 'rgba(r,g,b,a)' (the co-op's canvas and SVG colours).
/** @param {number} hex @param {number} [alpha] @returns {string} */
const cssColor = (hex, alpha) => alpha === undefined
    ? '#' + hex.toString(16).padStart(6, '0')
    : 'rgba(' + [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255, alpha].join(',') + ')';

// Phone or tablet: user agent, iPad posing as a Mac, touch on a small screen.
const IS_MOBILE = (() => {
    const userAgentMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const hasTouchScreen = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const isSmallScreen = Math.max(window.innerWidth, window.innerHeight) <= 1366 &&
        Math.min(window.innerWidth, window.innerHeight) <= 1024;
    const isiPad = /iPad/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return userAgentMobile || isiPad || (hasTouchScreen && isSmallScreen);
})();

// --- LOCATION (Location3D.js, Terrain3D.js). World units are px: x to the right, y down
// the map, height up (skill world3d, §Coordinates). ---
const LOCATION_WIDTH = 2048;            // px: location width (the area the game camera stays within)
const LOCATION_HEIGHT = 2048;           // px: location height
const LOCATION_GROUND = 0;              // ground texture: 0 — grass, 1 — sand, 2 — snow (Location3D.GROUNDS)
const GROUND_TILE_SIZE = 512;           // world px per one repeat of the ground texture
const TERRAIN_NOISE_AMP = 0;            // px: hill amplitude (0 — flat ground; the heist grid needs flat ground)
const TERRAIN_NOISE_SCALE = 800;        // px: hill size
const TERRAIN_NOISE_SEED = 4;           // terrain noise seed
const TERRAIN_BASE = 0;                 // px: mean ground level
const TERRAIN_CELL = 8;                 // px: terrain grid step (mobile — no finer than 12; flat ground ignores it — Terrain3D.flatCell)

// --- LOAD LOG (LoadLog.js): the loading log file, rewritten as lines come. ---
const LOAD_LOG_FLUSH_MS = 500;          // ms: a burst of log lines is written in one request after this pause

// --- MODELS (Gltf3D.js) and UI (UI.js) ---
const MODEL_CLIP_BLEND_SEC = 0.2;       // s: cross-fade between animation clips of a .glb model (idle -> run); 0 — instant
const UI_REF_HEIGHT = 720;              // px: the screen height the UI layout (UILayout.js) is drawn for; the UI scales with the screen height, 0 — no scaling

// --- UI ROLES (UI.js, UI.LOOKS; rules, section 34 — the interface after Overcooked 2): one colour, one role.
// A look of a record (UILayout.js, field look) names roles; the colours live only here. Unavailable is the
// button greyed (CSS grayscale), not a colour of its own. Entity colours (heroes, threat, money, exit) are not roles.
const UI_ROLE_OUTLINE = 0xe0dcfa;       // the outline of every plate, button and window strip
const UI_ROLE_SHADOW = 0x171e32;        // the drop shadow under a plate, a button, a card, a text; the window's dim
const UI_ROLE_PLATE = 0x202b3b;         // a HUD plate's fill (and the window's title ribbon)
const UI_ROLE_FIELD = 0x85a0ca;         // a window strip's fill
const UI_ROLE_BUTTON = 0x244266;        // a button's fill
const UI_ROLE_SELECT = 0xf06ef7;        // the chosen: a pressed button, a chosen row
const UI_ROLE_PAPER = 0xd4d8fd;         // a card's fill and a text on a dark plate or button
const UI_ROLE_INK = 0x1b2a3b;           // a text on paper, a window strip or the chosen; a card's stamp
const UI_LINE = 3;                      // UI px: the outline's thickness
const UI_DROP = 3;                      // UI px: how far the shadow falls down
const UI_LOUD_LINE = 2;                 // UI px: the ink outline of a loud mark (digits on a red plate, rules 14)
const UI_TEXT_PAD = 4;                  // UI px: a boxed text's lines keep off its plate's outline by this (rules 34, 18.11)
const UI_SKEW_DEG = 12;                 // degrees: a plate's edge facing the screen centre is skewed by this
const UI_PLATE_CORNER = 34;             // UI px: a tall plate skews only its header corner, this high
const UI_PLATE_TALL = 200;              // UI px: a plate taller than this is tall (UI_PLATE_CORNER)
const UI_DIM_ALPHA = 0.6;               // 0..1: the opacity of a window's dim (the shadow colour)
const UI_RING_GAP = 4;                  // UI px: the tutorial ring keeps this gap off its target's outline
const UI_TEXT_WEIGHT = 700;             // the weight of a text (Nunito: the signs over the scene, the fallback icons)
const UI_CAPS_WEIGHT = 900;             // the weight of a title and a button's label (Nunito, capitals)
// The interface font, OpenGOST type A (rules, section 34, «Вид по макету главного экрана» 17.11; design/ui-menu-mock).
const UI_FONT_CAP = 0.8;                // share of the font size: the height of a capital (the face is scaled to it)
const UI_SCENE_FONT_CAP = 0.705;         // share of the font size: the height of a Nunito capital (the signs over the scene, not scaled; an icon is as high)
const UI_FONT_STROKE = 0.5;             // UI px: the weight — a stroke round every letter in its own colour
const UI_SPACING_BUTTON = 0.07;         // em: the letter spacing of a button's label
const UI_SPACING_RIBBON = 0.03;         // em: the letter spacing of a window's title ribbon
// Worn plates (rules, section 34, «Вид по макету главного экрана» 17.11; start values — design/ui-menu-mock/rough.py).
const UI_WORN_LINE_K = 0.09;            // share of a plate's height: its outline (uneven by UI_WORN_LINE_VARY)
const UI_WORN_DROP_K = 0.07;            // share of a plate's height: its shadow straight down
const UI_WORN_MIN = 3;                  // UI px: the outline and the shadow are not thinner than this
const UI_WORN_MAX = 6;                  // UI px: ... and not thicker (a tall HUD plate keeps its paddings)
const UI_WORN_LINE_VARY = 0.125;        // 0..1: the outline's thickness drifts round the plate by this share (25 % x edge noise)
const UI_WORN_JITTER_K = 0.05;          // share of a plate's height: how far its corners are pushed
const UI_WORN_JITTER_MIN = 1.5;         // UI px: the corners' push, not less
const UI_WORN_JITTER_MAX = 4;           // UI px: ... and not more
const UI_WORN_NOISE = 0.5;              // a button edge's noise (Ivan 17.11: «вдвое спокойнее»)
const UI_WORN_WOBBLE = 2;               // WEAR: the edge's wave twice as deep ...
const UI_WORN_STEP = 2;                 // ... and twice as sparse
const UI_WORN_NICK = 3;                 // WEAR: a button's one nick, three times bigger
const UI_CALM_SIDE = 51;                // UI px: a side shorter than this on a plate lower than this has no wave
const UI_SQUARE_BUTTON = 64;            // UI px: a button no bigger than this both ways is square — no nick
const UI_CUT_MIN = 0.24;                // share of the short side: a given cut corner, from ...
const UI_CUT_MAX = 0.34;                // ... to
const UI_TILT_MAX = 0.7;                // degrees: a button's tilt (the main screen's column) is clamped to this
const UI_OFF_ALPHA = 0.45;              // 0..1: the opacity of an unavailable text (the resolution in «Без рамки», rules 36)
const MENU_TILTS = [-0.6, 0.5, -0.4, 0.7, -0.5]; // degrees: the main screen's column, top down (rules 36) — a list, not in the editor
const MENU_SIDE_DIM_ALPHA = 0.6;        // 0..1: the main screen's dim — a band under the column: the shadow colour this opaque at the left edge ...
const MENU_SIDE_HOLD = 0.24;            // share of the screen width: ... held so far ...
const MENU_SIDE_END = 0.46;             // ... and gone (0) here; the warm windows on the right stay lit (rules 36)
const MENU_SCREEN_WINDOWS = [[1280, 720], [1600, 900], [1920, 1080], [2560, 1440], [3840, 2160]]; // physical px: the window sizes of the PC build, those that fit with the frame (rules 36) — a list, not in the editor
const MENU_SCREEN_HEIGHTS = [720, 900, 1080, 1440, 2160]; // physical px: the 3D picture's height in the PC build's fullscreen, not above the screen; the width — by the screen's shape — a list, not in the editor
const UI_GRID_CELL = 12;                // UI px: the blueprint grid's cell on a button; every 4th line is major
const UI_GRID_MINOR = 0.07;             // 0..1: the opacity of the grid's white minor lines
const UI_GRID_MAJOR = 0.13;             // 0..1: ... and of its major lines
const UI_GRID_WHITE = 0xffffff;       // the blueprint grid's white: a button's texture, its own role — only the grid, only on a button
const UI_GLOW = 0.1;                    // 0..1: a button's glow in the middle — its fill mixed with white by this
const UI_STRIP_LINE = 4;                // UI px: a window strip's outline
const UI_STRIP_DROP = 5;                // UI px: ... and its shadow
const UI_STRIP_SLOPE = 0.4;             // degrees: the strip's top and bottom edges are not parallel by about this
const UI_STRIP_DENT = 3;                // UI px: the strip's hand-cut edges dent by up to this
const UI_STRIP_STEP = 110;              // UI px: ... a dent every this
const UI_RIBBON_TWIST = 0.9;            // degrees: the ribbon's bottom edge turned against its top
const UI_RIBBON_FORK = 0.32;            // share of the ribbon's height: the depth of its forked tail
const UI_RIBBON_STEP = 90;              // UI px: the ribbon's long edges dent every this
const UI_RIBBON_DENT = 2.5;             // UI px: ... by up to this
const UI_REACH = 3000;                  // UI px: a strip and a ribbon reach this far past their element (to the screen's edges)

// --- SOUND (Sound3D.js): channel volumes; a sound with a place on the map is heard from where
// the CAMERA is — its audible region is a sphere of AUDIO_FALLOFF_MAX around it ---
const AUDIO_MASTER_VOLUME = 0.8;        // 0..1: everything (0 — silence)
const AUDIO_MUSIC_VOLUME = 0.6;         // 0..1: the 'music' channel
const AUDIO_SFX_VOLUME = 1;             // 0..1: the 'sfx' channel — effects and object sounds
const AUDIO_FALLOFF_MIN = 150;          // px: full volume while the camera is this close to a sound (0 — it fades from the source itself)
const AUDIO_FALLOFF_MAX = 1024;         // px: from here on it is silent (fades linearly in between); an object may set its own pair. The camera stands ~800 px from its look-at point at zoom 1
const AUDIO_PAN = 0.7;                  // 0..1: how far a sound at the side of the screen goes into one ear (0 — mono)

// --- HEIST (Game.js, HeistScene.js): the five levels of They Stole a Million on a grid.
// The rules and the level data are in HeistRules.js / HeistLevels.js (measured, not tuned). ---
const HEIST_CELL_PX = 48;               // px: one grid cell in the world
const HEIST_WALL_H = 34;                // px: wall height
const HEIST_WALL_T = 5;                 // px: wall thickness
const HEIST_REPLAY_SPEED = 4;           // game seconds per real second while the replay plays
const HEIST_PERSON_SCALE = 0.3;         // scale of character.glb for crew and guards
const HEIST_WAIT_STEP = 5;              // s: the Wait button adds this much to a track

// --- COOP (CoopGame.js, CoopScene.js): the co-op reference level; the rules and the level are
// CoopModel.js / CoopLevels.js, the grid sizes are the HEIST_* above. ---
// Heist time is whole ticks (CoopModel); seconds exist only here, on the screen.
const COOP_TICK_S = 1;                  // real seconds one tick of the heist lasts in a take at ×1
const COOP_WAIT_TICKS = 0;              // ticks: what the Wait button says at start (0 — a tap lists events)
const COOP_WAIT_MAX = 200;              // ticks: the most the Wait button goes to
const COOP_SCRUB_TICKS = 2;             // ticks: ◀ / ▶ move the shown moment by this much
const COOP_EVENT_HOLD_TICKS = 3;        // ticks: in a take the camera holds on the hero of a fresh event
const COOP_ZOOM = 1.2;                  // the camera's distance on every level (Ivan 07.11): × the zoom at which level 1 fills the window — 1 fills it, 1.2 is 20% closer (Ivan 17.11), 0.8 farther
const COOP_FIT_MARGIN = 1;              // a level shown whole fills this share of the free screen
const COOP_FIT_TOP_PX = 0;              // UI px (UI_REF_HEIGHT): kept off the level on top; 0 — the level fills the whole window, the buttons lie over it
const COOP_FIT_BOTTOM_PX = 0;           // UI px: kept off the level below; 0 — the whole window
// A night level's light (the level's field night, Ivan 05.11): sky and fog, the sky light, the moon
// instead of the sun — the WORLD3D_* render keys it overrides (CoopScene.night).
const COOP_NIGHT_SKY = 0x0e1628;        // night: sky and fog colour
const COOP_NIGHT_FOG = 0.0005;          // night: fog density
const COOP_NIGHT_SKYLIGHT_INTENSITY = 0.3; // night: diffuse sky light
const COOP_NIGHT_SKYLIGHT_COLOR = 0x6f86b8; // night: sky light colour
const COOP_NIGHT_GROUNDLIGHT_COLOR = 0x161d2e; // night: fill light from below
const COOP_NIGHT_MOON_INTENSITY = 0.25; // night: the moon's strength (the sun's light)
const COOP_NIGHT_MOON_COLOR = 0x9fb4e8; // night: the moon's colour
// The camera's look-at point stays over the building (its rooms' bounding rect) widened on each screen
// side by this share of its size; the game camera looks north-up (CAMERA_AZIMUTH_DEG), so left — west,
// up — north (Ivan 05.11: the target never leaves the frame; evening: right is fine, less on the left,
// a bit less up and down).
const COOP_CAMERA_PAD_LEFT = 0.05;      // share of the building's width, on the left
const COOP_CAMERA_PAD_RIGHT = 0.15;     // on the right
const COOP_CAMERA_PAD_UP = 0.10;        // share of its height, on top
const COOP_CAMERA_PAD_DOWN = 0.10;      // below

// --- CO-OP HUD (CoopGame.js): the plan screen, its signs and buttons, the log, the tutorial, taps.
// Display numbers only (invariant 12): the rules' numbers are in ../design/objects/objects.json. ---
const COOP_GAME_OUTRO_S = 2.5;           // real seconds at ×1 the van takes to drive off at the end of a take
const COOP_GAME_ACT_GAP = 6;             // layout px between the small buttons of two actions of a cell
const COOP_GAME_FX_INSET = 7;            // px: the effects badge from the top right corner of the button
const COOP_GAME_FX_GAP = 4;              // px between a small (stacked) action button and its badge on its right
const COOP_GAME_FX_OVERLAP = 4;          // px: a badge of several icons is narrower than so many badges
const COOP_GAME_HOVER_OFFSET = 16;       // px (layout) from the cursor to the hint over an object (rules, section 26)
const COOP_GAME_HOVER_PAD = 10;          // px (layout) round the tag's places inside its plate
const COOP_GAME_HOVER_GAP = 3;           // px (layout) between the places of the tag, top to bottom
const COOP_GAME_HOVER_STAMP_PAD = 7;     // px (layout) a side between the click's stamp text and its frame (half of it above and below)
const COOP_TUT_SEE_LEFT_PX = 148;       // UI px: the tutorial's camera keeps the step's target off the left band (the hero cards; rules, section 27, 12.11)
const COOP_TUT_SEE_RIGHT_PX = 316;      // the right one (the plan's log)
const COOP_TUT_SEE_TOP_PX = 60;         // the top one (the phase's title)
const COOP_TUT_SEE_BOTTOM_PX = 180;     // the bottom one (the buttons and the tip's plate)
const COOP_TUT_SEE_PAD_PX = 40;         // and this further in, so that the object is not half under a panel
const COOP_GAME_BLINK_S = 1;             // s: the period of a target's outline blink — the tutorial's, the advice's, the ✕ of a start window (white its first half)
const COOP_GAME_MAP_CLOSE_BLINK_S = 5;   // s after the start sheet opens till its ✕ blinks (rules, section 28; Ivan 08.11)
const COOP_GAME_TIMER_WARN_S = 30;      // s (ticks) left on the police timer when its panel starts to redden (rules, section 14; Ivan 12.11)
const COOP_GAME_TIMER_WARN_STEP_S = 10; // s: from then on its gradient reddens a step this often
const COOP_GAME_TIMER_BLINK_LEFT_S = 20; // s (ticks) left when its frame starts to blink
const COOP_GAME_TIMER_BLINK_S = 1;      // s: the period of the frame's blink (lit its first half)
const COOP_GAME_TIMER_RED = 0xff3b30;        // the timer's fill from the first warning step: the threat's colour (rules, section 34)
const COOP_GAME_STILL_SPEED = 4;         // a tick where nobody moves plays this many times faster than the chosen speed (Ivan 24.10)
const COOP_GAME_TASK_LINES = 3;          // the lines of the task panel (task0 … task2 in UILayout.js)
const COOP_GAME_RESULT_LINES = 7;        // the lines of the result (res0 … res6 in UILayout.js)
const COOP_GAME_WAIT_LIST = 6;           // Wait at 0 lists at most this many events of the plans (a door, the light)          
const COOP_GAME_SIGN_GAP = 2;            // layout px between the plan's signs: the neighbour cells' and those in a column
const COOP_GAME_SIGN_PAD = 2;            // layout px inside a plan's sign, around its line
const COOP_GAME_SIGN_LINE = 1.2;         // a line of a sign's text in its font sizes (UI.js lineHeight)
const COOP_GAME_TAG_GAP = 4;             // layout px between a sign over a hero (load, work) and the point over his head
const COOP_GAME_LOG_WRAP = 40;           // characters of a log line before it wraps (the panel is 300 px, font 12)
const COOP_GAME_LOG_LINES = 20;          // lines of the log on the right (log0 … log19 in UILayout.js)
const COOP_GAME_TAP_SLOP_PX = 10;        // CSS px: a press that moved farther is a drag (the camera's), not a tap
const COOP_GAME_TAP_MAX_MS = 500;        // ms: a longer press is not a tap
const COOP_GAME_SIGN_EM_ICON = 1.3;      // font sizes: the width of an icon in a plan's sign (bold, with a margin)
const COOP_GAME_SIGN_EM_DIGIT = 0.65;    // font sizes: the width of a digit in a plan's sign
const COOP_GAME_SIGN_EM_OTHER = 0.35;    // font sizes: the width of any other character in a plan's sign
const COOP_GAME_LOG_RED = 0xff3b30;      // a red line of the log (an alarm): the threat's colour (rules, section 34)
const COOP_GAME_SPEED_2 = 2;             // the second speed of the take (⏩ cycles ×1, this, the third)
const COOP_GAME_SPEED_3 = 4;             // the third speed of the take
const COOP_GAME_SCREEN_W = 1280;         // px of the screen the level is fitted to while the canvas has no size (node, a hidden page)
const COOP_GAME_SCREEN_H = 720;          // px, its height
const COOP_GAME_FIT_ZOOM_MIN = 0.05;     // the least zoom the fit of the level searches
const COOP_GAME_FIT_ZOOM_MAX = 20;       // the greatest zoom the fit searches
const COOP_GAME_FIT_STEPS = 50;          // halvings of the fit's search (the zoom to 2^-50 of the range)
const COOP_GAME_WAIT_GAP = 6;            // layout px between the events in the list of Wait
const COOP_GAME_FX_MARGIN = 6;           // layout px: an effects badge is at least so much lower than its button
const COOP_GAME_HERO_CARDS = 4;          // the hero cards (heroPick0 …, heroInfo0 …, heroCard0 … in UILayout.js)
const COOP_GAME_CLASSIC_LEVELS = 5;      // the level buttons of the classic game (lvl1 … lvl5 in UILayout.js) the co-op hides

// --- CO-OP SCENE (CoopScene.js): rings, trails, bodies, the police car and the van, the night, state colours. ---
const COOP_SCENE_TEX_PX = 32;            // texture px per floor cell
const COOP_SCENE_TOWN_OUT = 0.62;        // the town covers the frame zoomed out (the wheel) to this share of the game zoom; 0.62 — the town of 06.11 at COOP_ZOOM 1
const COOP_SCENE_TOWN_TEX_PX = 16;       // texture px per cell of the town's ground
const COOP_SCENE_TOWN_BELOW = 0.6;       // px: the town's ground under the level's floor (no flicker where they meet)
const COOP_SCENE_TRAIL_BOLD = 0.18;      // the selected hero's trail dot, fraction of a cell
const COOP_SCENE_TRAIL = 0.1;            // the other heroes' trail dot
const COOP_SCENE_RING = 2.7;             // the selection ring's diameter, body radii
const COOP_SCENE_RING_THICK = 0.1;       // its thickness, share of the diameter
const COOP_SCENE_CELL_RING = 0.9;        // the tutorial step's ring on a cell: its diameter, cells (rules, section 27)
const COOP_SCENE_VAN_RING_H = 0.12;      // cells: that ring in the van — over the bed and its low sides (prop_van: 0.02, 0.075)
const COOP_SCENE_LEAN = 0.35;            // rad: a stunned body rocks back this far
const COOP_SCENE_RISE = 0.35;            // share of a tick a fallen body takes to get up
const COOP_SCENE_TURN = 0.25;            // share of a tick a body takes to turn into a new way
const COOP_SCENE_WAIT_FACE = 135;        // degrees (CoopModel.ANGLE): a waiting hero faces the screen's bottom left — the camera looks north (Ivan 24.10)
const COOP_SCENE_LIE_TURN = 0.35;        // a falling body faces the blow by the time it is this far down
const COOP_SCENE_ICON_W = 12;            // px: width of a carried loot icon (the modelling brief, section 8)
const COOP_SCENE_ICON_GAP = 1;           // px between the icons of a carried stack
const COOP_SCENE_POLICE_LEN = 2;         // cells: the police car's length (the stub prop_police_car)
const COOP_SCENE_POLICE_GAP = 1;         // cells between the stopped police car and the van; and between them in the drive in at the start (rules, section 35)
const COOP_SCENE_POLICE_SPEED = 2;       // cells a tick: the police car's drive in, till the building's corner (rules, section 14)
const COOP_SCENE_POLICE_FLASH = 2;       // flashes a second of each colour of its lights
const COOP_SCENE_VAN_OUT = 6;            // cells past the level's edge the van drives off to (on its exit side); its front starts that far out in the drive in, the police car is gone that far out
const COOP_SCENE_INTRO_S = 2;            // real seconds of the van's drive in at a level's start, behind the police car (rules, section 35)
const COOP_SCENE_SENSOR_BLINK = 1.5;     // flashes a second of an armed door sensor's lamp
const COOP_SCENE_WORK_TOP = 40;          // px over the floor: the timers' height until a door's file has loaded
const COOP_SCENE_ICON_LIFT = 8;          // px: the stack floats this far over socket_carry (seen at an angle, it sat on the cap)
const COOP_SCENE_BUMP = 0.12;            // share of a tick a bouncing flier stays squashed around the touch
const COOP_SCENE_FADE = 0.1;             // share of a tick what a crash cut off (a stride, a lunge, a slide, work) dies away in
const COOP_SCENE_RECOIL = 0.3;           // share of a tick a body on its feet takes to step back from the touch into its cell
const COOP_SCENE_WET_EDGE = 0.5;         // stepping onto (off) the wet floor, it is on it this far into the step
const COOP_SCENE_SLIDE_IN = 0.2;         // share of a tick a walk turns into a slide (and back) at the edge of the wet floor
const COOP_SCENE_DOOR_FLAT_OUT = 0.15;   // the open leaf off the wall line, cells: half the wall, half the jamb and leaf
const COOP_SCENE_WHEEL_TURN = 1.5;       // rad a tick: the vault wheel while its lock is worked
const COOP_SCENE_LEVER_DOWN = 2.4;       // rad: the panel's lever with the power off (down and forward)
const COOP_SCENE_BEAM_H = 12;            // px: the laser beam over the floor (the emitter's window, brief section 7)
const COOP_SCENE_CUSHION = 14;           // px: a jewel over the floor in its vitrine until the model tells
const COOP_SCENE_HOVER_OUTLINE_PX = 0.35;   // screen px: the outline of the object under the cursor and of the tutorial's blinking target — as thin as WORLD3D_TOON_OUTLINE_ACTOR_WIDTH (rules, section 26; Ivan 13.11)
const COOP_SCENE_SHARD_OUT = 0.16;       // m (model units): the shards of a broken cover lie this far out
const COOP_SCENE_STARS_UP = 0.15;        // × the body's height: the stars' ring over the top of a lying body
const COOP_SCENE_STARS_SPIN = 4;         // rad a tick: the stars circling
const COOP_SCENE_HEAD_AT = 0.8;          // × the body's height: the head's middle, where the stars hang over
const COOP_SCENE_TIE_HANDS = 0.5;        // share of a tick the hands of a body being tied or untied take to go up or down
const COOP_SCENE_FLY_UP = 0.5;           // share of a tick the arms of a knocked flier take to go up (down at the landing)
const COOP_SCENE_LANE_W = 0.06;          // a lane line of the street: its width, share of the cell
const COOP_SCENE_LANE_MIN = 2;           // px of the floor texture: the lane line no thinner
const COOP_SCENE_CONE_IN = 1;            // px of the floor texture: a seen cell is painted this far in from its edges
const COOP_SCENE_HINT_RIM_W = 3;         // px of the floor texture: the rim of a hint cell
const COOP_SCENE_HINT_RIM_IN = 2;        // px: the rim runs this far in from the cell's edge
const COOP_SCENE_ASK_RIM_W = 6;          // px of the floor texture: the rim of the advice cell of «?»
const COOP_SCENE_ASK_RIM_IN = 3;         // px: the rim runs this far in from the cell's edge
const COOP_SCENE_BEAM_T = 2;             // px: a laser beam's thickness and height
const COOP_SCENE_BAR_W = 24;             // px: a gold bar's width until its file has loaded (the brief)
const COOP_SCENE_BAR_H = 9;              // px: its height
const COOP_SCENE_ITEM_W = 11;            // px: another item's width until its file has loaded
const COOP_SCENE_ITEM_H = 11;            // px: its height
const COOP_SCENE_BEAN_H = 2.6;           // a bean (a hero before its model): its height, of the radius
const COOP_SCENE_BEAN_TESS = 16;         // its body's and cap's segments round
const COOP_SCENE_BEAN_SUBDIV = 2;        // its body's segments along
const COOP_SCENE_BEAN_EYE = 0.55;        // its eye's diameter, of the radius
const COOP_SCENE_BEAN_EYE_SEG = 8;       // the eye's segments
const COOP_SCENE_BEAN_EYE_OUT = 0.8;     // the eye this far out in front, of the radius
const COOP_SCENE_BEAN_EYE_UP = 0.68;     // the eyes and pupils this high, of the height
const COOP_SCENE_BEAN_EYE_SIDE = 0.38;   // the eyes and pupils this far apart to a side, of the radius
const COOP_SCENE_BEAN_PUPIL = 0.26;      // the pupil's diameter, of the radius
const COOP_SCENE_BEAN_PUPIL_SEG = 6;     // the pupil's segments
const COOP_SCENE_BEAN_PUPIL_OUT = 1.02;  // the pupil this far out in front, of the radius
const COOP_SCENE_BEAN_CAP_D = 1.7;       // the guard's cap: its diameter, of the radius
const COOP_SCENE_BEAN_CAP_UP = 0.1;      // the cap sits this far over the head, of the radius
const COOP_SCENE_BEAN_LIFT = 0.38;       // lying, the bean is up off the floor by this share of its height
const COOP_SCENE_CARRY_UP = 8;           // px: with no socket_carry the carried loot floats this far over the head
const COOP_SCENE_RING_TESS = 32;         // a ring's segments round
const COOP_SCENE_TOWN_VIEW_H = 1200;     // CSS px: the height of the screen the town covers (the PC window 1920 × 1080)
const COOP_SCENE_TOWN_VIEW_ASPECT = 2;   // the width / height of that screen (full screen up to 2:1)
const COOP_SCENE_NIGHT_WINDOW = 0xffc870; // night: the tint of the lit ('_lit') window panes
const COOP_SCENE_NIGHT_LAMP = 0xfff1c4;  // night: the tint of the street lamps' glass
const COOP_SCENE_NIGHT_PANE_DAY = 0x3a3d45; // day: the tint of those window panes
const COOP_SCENE_NIGHT_LAMP_DAY = 0xc9ccd1; // day: the tint of the lamps' glass
const COOP_SCENE_NIGHT_POOL_CELLS = 2.2; // cells: the radius of the pool of light under a street lamp
const COOP_SCENE_NIGHT_SHOP = 0xffdca0;  // night: the colour of the shop's light
const COOP_SCENE_NIGHT_SHOP_INTENSITY = 0.9; // night: the shop's light strength
const COOP_SCENE_NIGHT_SHOP_HIGH = 3;    // cells: the shop's light this high over the floor
const COOP_SCENE_NIGHT_SHOP_RANGE = 0.9; // the shop's light reaches this share of the building's diagonal
const COOP_SCENE_NIGHT_ROOM_GLOW = 0.6;  // night: the lit rooms' floor glows at this share of its paint
const COOP_SCENE_NIGHT_WALL_GLOW = 0.85; // night: the walls' inner faces (wall_panel) glow at this share of their picture while the light is on (Ivan 17.11)
const COOP_SCENE_HEX_LOCKED = 0xc0392b;  // a locked door, its tint
const COOP_SCENE_HEX_VAULT = 0x6d4fa3;   // a vault door
const COOP_SCENE_HEX_ELECTRO = 0x2f7fd6; // an electronic lock
const COOP_SCENE_HEX_OPENED = 0x55a84f;  // an opened lock
const COOP_SCENE_HEX_LAMP_ON = 0x3ddc84; // the power panel's lamp with the power on
const COOP_SCENE_HEX_LAMP_OFF = 0xe0503c; // and with the power off
const COOP_SCENE_HEX_CAM_ON = 0xff2a2a;  // a camera's light while it watches
const COOP_SCENE_HEX_CAM_OFF = 0x3a3d45; // and while it is off
const COOP_SCENE_HEX_SCREEN_ON = 0x9fe3ff; // a screen switched on
const COOP_SCENE_HEX_SCREEN_OFF = 0x3a3d45; // a screen switched off
const COOP_SCENE_HEX_SENSOR_ON = 0xff3b30; // an armed door sensor's lamp
const COOP_SCENE_HEX_POLICE_RED = 0xff2a2a; // the police car's red light
const COOP_SCENE_HEX_POLICE_BLUE = 0x2f7bff; // the police car's blue light
const COOP_SCENE_HEX_SCREEN_GLOW = 0x2f6f8f; // a screen's glow
const COOP_SCENE_HEX_LASER = 0xff2a2a;   // the laser beam
const COOP_SCENE_HEX_GUARD = 0x22406e;   // the guard's uniform (and his trail on the plan)
const COOP_SCENE_HEX_CAP = 0x182c4d;     // the guard's cap
const COOP_SCENE_HEX_EYE = 0xffffff;     // the white of a bean's eye
const COOP_SCENE_HEX_PUPIL = 0x111111;   // a bean's pupil
const COOP_SCENE_FLOOR_ROOM = 0xd9cfbf;  // the floor of a zone of floor 'room'
const COOP_SCENE_FLOOR_ALLEY = 0x7d838a; // the floor of a zone of floor 'alley'
const COOP_SCENE_FLOOR_STREET = 0x8d949b; // the floor of a zone of floor 'street'
const COOP_SCENE_FLOOR_UTILITY = 0xc9c1ae; // the floor of a zone of floor 'utility'
const COOP_SCENE_FLOOR_GUARDS = 0xb9c6d6; // the floor of a zone of floor 'guards'
const COOP_SCENE_FLOOR_OFFICE = 0xd8c7a8; // the floor of a zone of floor 'office'
const COOP_SCENE_FLOOR_VAULT = 0xbfb6a0; // the floor of a zone of floor 'vault'
const COOP_SCENE_FLOOR_CORRIDOR = 0xddd5c4; // the floor of a zone of floor 'corridor'
const COOP_SCENE_FLOOR_HALL = 0xefe3cf;  // the floor of a zone of floor 'hall'
const COOP_SCENE_FLOOR_LOADING = 0xc4c0b6; // the floor of a zone of floor 'loading'
const COOP_SCENE_VOID = 0x2b2d31;        // the floor texture outside the zones
const COOP_SCENE_CHECKER = 0x000000;     // the floor's checker
const COOP_SCENE_CHECKER_ALPHA = 0.05;   // its opacity, 0..1
const COOP_SCENE_DARK = 0x080c1e;        // a dark (unlit) room over its floor
const COOP_SCENE_DARK_ALPHA = 0.55;      // its opacity, 0..1
const COOP_SCENE_VAN_FLOOR = 0x3b5f8a;   // the van's cells on the floor
const COOP_SCENE_TOWN_ROAD = 0x5b6068;   // the town's road
const COOP_SCENE_TOWN_WALK = 0xaaa59b;   // the town's sidewalk
const COOP_SCENE_TOWN_YARD = 0x8f897e;   // the town's yards
const COOP_SCENE_TOWN_SEAM = 0x000000;   // the seams of the paving
const COOP_SCENE_TOWN_SEAM_ALPHA = 0.12; // its opacity, 0..1
const COOP_SCENE_TOWN_LANE = 0xe9e2c6;   // the road's lane lines
const COOP_SCENE_CONE = 0xff3b30;        // a camera's sweep on the floor
const COOP_SCENE_CONE_ALPHA = 0.45;      // its opacity, 0..1
const COOP_SCENE_HINT = 0xffc428;        // the cell of a hint
const COOP_SCENE_HINT_ALPHA = 0.6;       // its opacity, 0..1
const COOP_SCENE_HINT_RIM = 0xffe27a;    // the hint cell's rim
const COOP_SCENE_ASK = 0xffffff;         // the cell of the advice of «?» (rules, section 24)
const COOP_SCENE_ASK_ALPHA = 0.5;        // its opacity, 0..1
const COOP_SCENE_ASK_RIM = 0xff9f1a;     // the advice cell's rim
const COOP_SCENE_NIGHT_POOL = 0xffcd78;  // night: the pool of light under a street lamp
const COOP_SCENE_NIGHT_POOL_ALPHA = 0.55; // its opacity, 0..1

// --- CO-OP BEANS (CoopRig.js): the heroes' and guards' placeholder walk and work moves; lengths × the body's height. ---
const COOP_RIG_STRIDE = 0.2;             // a foot goes this far forward and back
const COOP_RIG_LIFT = 0.12;              // a swinging foot is lifted this high at most
const COOP_RIG_SWING = 0.16;             // hands swing forward and back
const COOP_RIG_BOB = 0.035;              // the body bobs on every step
const COOP_RIG_WALK_LEAN = 0.12;         // rad: leaning forward on the run
const COOP_RIG_WADDLE = 0.07;            // rad: rocking from side to side on the run
const COOP_RIG_BUMP_SQUASH = 0.25;       // a flier squashes along its height bumping into a body it bounces off
const COOP_RIG_REACH = 0.12;             // hands picking a lock are this far in front of the body
const COOP_RIG_JIGGLE = 0.03;            // hands fiddle at a lock this much
const COOP_RIG_JIGGLE_RATE = 6;          // fiddles a tick
const COOP_RIG_WORK_LEAN = 0.18;         // rad: leaning into picking a lock
const COOP_RIG_WAIT_SWAY = 0.3;          // rad (17°): a waiting body turns to and fro this far each way
const COOP_RIG_WAIT_ROCK = 0.05;         // rad: and rocks from side to side
const COOP_RIG_WAIT_PERIOD = 3;          // ticks: one turn there and back
const COOP_RIG_SLIDE_LEAN = 0.3;         // rad: leaning back on the wet floor
const COOP_RIG_WOBBLE = 0.15;            // rad: wobbling on the wet floor
const COOP_RIG_LUNGE = 0.3;              // hands shoot forward into a hit
const COOP_RIG_BREATH = 0.015;           // the body breathes standing still
const COOP_RIG_HAT_BELLY = 0.4;          // the fallen hat lies on the belly this high up the body
const COOP_RIG_HAT_ASIDE = 1.6;          // × r: a knocked-out body's hat on the floor, this far from his axis (beside him)
const COOP_RIG_HAT_HEAD = 0.75;          // × h: and this far up his length — by the head
const COOP_RIG_HAT_SINK = 0.9;           // × r: its base over the axis (the belly is a bit narrower than the widest part)
const COOP_RIG_HAT_POP = 0.2;            // the hat jumps off the head when the body is knocked flying
const COOP_RIG_FOOT_TILT = 0.5;          // rad: soles up when sliding and flying
const COOP_RIG_FOOT_TOE = 0.2;           // × tilt: the tipped foot rises by this much of the body height
const COOP_RIG_CUFF_UP = 0.4;            // a tied body's hands are this high in the model, over the belly (× h; as HAT_BELLY)
const COOP_RIG_CUFF_OUT = 0.04;          // and this far in front of it (× h): resting on the belly (Ivan 29.10: up they read as the head of a standing body — the camera looks north from above)
const COOP_RIG_CUFF_GAP = 0.25;          // × the hand's rest x: they are this far from the middle, side by side
const COOP_RIG_BEAN_H = 0.35;            // cells: the height of a body with no bounding box (the bean) the moves scale by
const COOP_RIG_BEAN_R = 0.14;            // cells: its radius
const COOP_RIG_HAND_OUT = 0.03;          // cells: a hand at rest with no node stands so far out of the body
const COOP_RIG_HAND_UP = 0.45;           // its height, of the body's
const COOP_RIG_SLIDE_ARMS_WIDE = 1.25;   // the wet floor: the hands this many times as far out as at rest
const COOP_RIG_SLIDE_ARMS_UP = 0.4;      // the wet floor: the hands up by this share of the height
const COOP_RIG_FLY_ARMS_WIDE = 1.2;      // knocked flying: the hands this many times as far out as at rest
const COOP_RIG_FLY_ARMS_UP = 0.35;       // knocked flying: the hands up by this share of the height
const COOP_RIG_FLY_ARMS_BACK = 0.12;     // knocked flying: the hands back by this share of the height
const COOP_RIG_STUN_DROP = 0.08;         // stunned: the hands hang lower by this share of the height
const COOP_RIG_LIE_HANDS = 0.1;          // lying: the hands apart by this share of the height (a starfish)
const COOP_RIG_LIE_FEET = 0.06;          // lying: the feet apart by this share of the height
const COOP_RIG_FEET_AHEAD = 0.12;        // sliding and flying: the feet ahead by this share of the height
const COOP_RIG_FLY_FEET_UP = 0.06;       // flying: the feet up by this share of the height
const COOP_RIG_HAT_POP_RATE = 1.4;       // the hat's pop is over at 1 / this of the flight
const COOP_RIG_HAT_POP_TILT = 0.6;       // rad per height the popped hat tips back
const COOP_RIG_EYES_X_STUN = 0.3;        // the eyes turn to crosses past this much of the stun
const COOP_RIG_EYES_X_LIE = 0.6;         // the eyes turn to crosses past this much of lying down

// --- CO-OP TOWN (CoopCity.js): the streets and houses round a level. ---
const COOP_CITY_BAND = 4;                // cells: the band of houses between the grid and the first cross or back street
const COOP_CITY_BLOCK = 8;               // cells: a block of houses between two parallel streets further out
const COOP_CITY_HOUSE_MIN = 2;           // cells: the side of a house, at least (less where the block runs out)
const COOP_CITY_HOUSE_MAX = 4;           // cells: and at most
const COOP_CITY_WINDOW_LIT = 0.3;        // the share of the windows lit at night
const COOP_CITY_LAMP_FIRST = 2;          // cells past the grid's edge: the first street lamp
const COOP_CITY_LAMP_STEP = 5;           // cells between two street lamps along a sidewalk
const COOP_CITY_LAMP_OUT = 0.35;         // cells: a lamp stands off the cell's middle toward the road (by the curb)
const COOP_CITY_STOREY = 0.875;          // cells: a storey's height (0.42 m of the stubs, design/level-models STOREY)
const COOP_CITY_NEAR = 1;                // cells: a house so near the level (or south of the street) is low
const COOP_CITY_FLOORS_NEAR = 1;         // the least floors of a house near the level or south of the street
const COOP_CITY_FLOORS_FAR = 2;          // the least floors of any other house
const COOP_CITY_FLOORS_MORE = 2;         // a house gets 0 … this − 1 floors more at random

// --- CO-OP PROPS (CoopProps.js). ---
const COOP_PROPS_KEYPAD_OUT = 0.15;      // cells: the keypad sits this far past the gate's opening
const COOP_PROPS_SIGN_AT = 0.3;          // cells: the wet floor sign stands this far into the puddle's north-west cell

// --- CO-OP LAB (CoopLab.js): the mechanics lab's debug panel. ---
const COOP_LAB_WRAP = 46;                // characters per line of «what to watch» (labWhat)
const COOP_LAB_COLS = 3;                 // station buttons per row
const COOP_LAB_ROW = 25;                 // layout px between knob rows
const COOP_LAB_ST_GAP_X = 6;             // layout px between the station buttons in a row
const COOP_LAB_ST_GAP_Y = 4;             // layout px between the rows of station buttons

// --- CO-OP STAND (CoopStand.js): the acceptance stand of the walls' picture (Ivan 18.11), debug panel. ---
const COOP_STAND_MIN_PX = 256;           // px: the picture's shorter side at least this (close up a wall face is ~100 px on screen)
const COOP_STAND_MAX_PX = 2048;          // px: the longer side at most this (memory and the file's weight)
const COOP_STAND_ASPECT_TOL = 0.1;       // share: the picture's width / height may differ this much from the face's (cell / wall height)
const COOP_STAND_SEAM_RATIO = 3;         // the left and the right edge differ at most this many times the picture's own grain (columns side by side)
const COOP_STAND_SEAM_MIN = 4;           // L*: an edge difference up to this is no seam whatever the grain
const COOP_STAND_NIGHT_DL = 10;          // L*: the picture may be this much darker on average than the walls' picture now (at night it glows by it)
const COOP_STAND_SAMPLE = 512;           // px: the checks read every n-th pixel so that the longer side counts at most this many
const COOP_STAND_CLOSE_ZOOM = 2.5;       // «Вплотную»: × the level's camera zoom (CAMERA_ZOOM_MAX still caps it)
const COOP_STAND_RETRY_MS = 500;         // ms: the stand asks again for the walls' own picture while the walls load

// --- CO-OP PLAN SHEET (CoopPlanMap.js): the still scheme of a level in the plan window, px of the sheet. ---
const COOP_PLAN_CELL = 40;               // px of the sheet per cell (Ivan 10.11: «сделать больше»; was 32)
const COOP_PLAN_SCALE_CELLS = 5;         // the cells of the stamp's scale bar («5 шагов»)
const COOP_PLAN_PAD = 24;                // px around the level
const COOP_PLAN_LEGEND_W = 280;          // px of the legend column on the right
const COOP_PLAN_NOTE_PAD = 150;          // px around the level with the notes: they may stand outside it
const COOP_PLAN_NOTE_FONT = 18;          // px, the hand font (Ivan 09.11: «текст плана можно сделать крупнее»; was 15)
const COOP_PLAN_STEP_FONT = 18;          // px, a step of the tutorial in the bottom left corner (rules, section 27; was 14)
const COOP_PLAN_LEGEND_FONT = 18;        // px, a row of the legend on the sticker (was 15)
const COOP_PLAN_STEPS_X = 44;            // px, the left edge of the tutorial's steps: clear of the sheet's frame and its tape
const COOP_PLAN_STEPS_GAP = 40;          // px between the tutorial's steps and the map on their right
const COOP_PLAN_STEPS_BOTTOM = 44;       // px from the sheet's bottom edge to the steps' last line: clear of the frame and its tape
const COOP_PLAN_SHEET_ASPECT = 1036 / 616; // the sheet's width to height: the window's image mapImg (UILayout.js, 1036 × 616) shows it whole, so its blocks stand in the window's corners (Ivan 10.11); a formula — not in the editor
const COOP_PLAN_SHEET_EDGE = 30;         // px, the least margin of the map with its notes to the sheet's edge
const COOP_PLAN_ROUTE_DOT = 0.18;        // of a cell, the tutorial's route dot on the sheet: the selected hero's trail on the floor (CoopScene.TRAIL_BOLD)
const COOP_PLAN_ROUTE_MIN_LEG = 2;       // moves, the shortest leg of the tutorial's route with an arrow
const COOP_PLAN_NOTE_RIGHT = 300;        // px more on the right of the map the notes may take (the legend moves past them)
const COOP_PLAN_PRICE_FONT = 14;         // px, a loot's price on the sheet at most (less when it is too wide for its cell)
const COOP_PLAN_GUARD_FONT = 14;         // px, a guard's name over him on the sheet
const COOP_PLAN_ROOM_FONT = 11;          // px, a room's name in its corner
const COOP_PLAN_HEAD_FONT = 16;          // px, the headings «steps» and «dangers» (bold, spaced)
const COOP_PLAN_ROUTE_FONT = 13;         // px, the number of the tutorial's step on its route badge
const COOP_PLAN_STICKER_FONT = 28;       // px, the sticker's title
const COOP_PLAN_BIG_FONT = 21;           // px, the sticker's big lines: the total and the stars' heading
const COOP_PLAN_STAR_FONT = 19;          // px, the stars on the sticker
const COOP_PLAN_STAMP_FONT = 15;         // px, the stamp's title and its values
const COOP_PLAN_STAMP_KEY_FONT = 13;     // px, the stamp's keys and its scale bar's label
const COOP_PLAN_ADV_MISSING = 0.6;       // em: the width of a char the font's advances lack
const COOP_PLAN_ADV_EMOJI = 1.1;         // em: the width of an emoji in a note
const COOP_PLAN_HALO_W = 3;              // px: the paper outline under letters over lines
const COOP_PLAN_RING_M_FROM = 22;        // px: a marker ring of a larger radius is the middle one, else the small one
const COOP_PLAN_SHEET_MIN_H = 520;       // px: the sheet no lower
const COOP_PLAN_STEPS_ROOM = 120;        // px: the sheet keeps this over the tutorial's steps
const COOP_PLAN_STEPS_HEAD_Y = 16;       // px: the steps' heading below the column's top
const COOP_PLAN_STEPS_HEAD_GAP = 21;     // px: from the heading to the first step, over the step's font
const COOP_PLAN_STEP_GAP = 6;            // px between the lines of the steps
const COOP_PLAN_STEPS_KEEP = 8;          // px: the notes keep this far off the steps
const COOP_PLAN_WALL_T = 0.2;            // a wall's band, of a cell
const COOP_PLAN_WALL_INK = 1.5;          // px: the ink outline round a wall's band
const COOP_PLAN_THIN_OP = 0.45;          // the thin line of the street's or yard's edge: its opacity
const COOP_PLAN_LASER_OP = 0.85;         // the marker's zigzag over a laser: its opacity
const COOP_PLAN_EMITTER_OUT = 0.3;       // a laser's emitter out past its end cell's middle, of a cell
const COOP_PLAN_LOCK_OUT = 12;           // px: a door's lock and sensor stand off its middle along the wall
const COOP_PLAN_DOOR_SIGN = 1.25;        // a door's lock and sensor signs, of a cell
const COOP_PLAN_DOOR_RING = 11;          // px: the marker ring round a lock or a sensor
const COOP_PLAN_KEYPAD_SIGN = 1.2;       // a gate's keypad sign, of a cell
const COOP_PLAN_KEYPAD_RING = 13;        // px: its ring
const COOP_PLAN_CAM_SWEEP_STEP = 5;      // degrees between the looks a camera's sweep is drawn by
const COOP_PLAN_SIGHT_OP = 0.8;          // the hatch of what cameras and guards see: its opacity
const COOP_PLAN_CAMERA_SIGN = 1.15;      // a camera's sign, of a cell
const COOP_PLAN_PANEL_SIGN = 1.15;       // a panel's sign, of a cell
const COOP_PLAN_PANEL_RING_OUT = 2;      // px: a panel's ring past half a cell
const COOP_PLAN_VAN_IN = 6;              // px: the van's sign keeps this far in its parking
const COOP_PLAN_VAN_RIM_IN = 2;          // px: the parking's dashed rim in from its cells
const COOP_PLAN_VAN_RIM_R = 4;           // px: its corners' radius
const COOP_PLAN_VAN_RIM_W = 1.5;         // px: its line
const COOP_PLAN_VAN_DASH = 6;            // px: its dash
const COOP_PLAN_VAN_GAP = 4;             // px: the gap between its dashes
const COOP_PLAN_ROUTE_DOT_KEEP = 3;      // px: the step pills keep off a route dot by this round its middle
const COOP_PLAN_ROUTE_ARROW = 0.7;       // a route's arrow, of a cell (the pills keep off it)
const COOP_PLAN_PILL_H = 16;             // px: a step pill's height
const COOP_PLAN_PILL_PAD = 8;            // px: its width past its label
const COOP_PLAN_PILL_GAP = 3;            // px: a pill off the ring of its target
const COOP_PLAN_PILL_DOOR_R = 13;        // px: a door as a pill's target, its radius
const COOP_PLAN_PILL_CELL_R = 2;         // px: a cell as a pill's target, its radius
const COOP_PLAN_PILL_TEXT_DOWN = 4.5;    // px: a pill's number below its middle (the baseline)
const COOP_PLAN_GEM_SIGN = 0.8;          // the gem over a valuable item, of a cell
const COOP_PLAN_GEM_UP = 3;              // px: the gem over the cell's middle
const COOP_PLAN_PRICE_W = 1.9;           // a price no wider, cells (the font shrinks)
const COOP_PLAN_PRICE_DOWN = 13;         // px: the price's baseline below the cell's middle
const COOP_PLAN_PRICE_BOTTOM = 15;       // px: the price's box down to this below the middle
const COOP_PLAN_LOOT_RING = 0.62;        // the ring round a valuable item, of a cell
const COOP_PLAN_PATROL_W = 2;            // px: a guard's round, its line
const COOP_PLAN_PATROL_DASH = 7;         // px: its dash
const COOP_PLAN_PATROL_GAP = 5;          // px: its gap
const COOP_PLAN_PATROL_OP = 0.85;        // its opacity
const COOP_PLAN_PATROL_ARROW_FROM = 2;   // the round's first arrow on this leg
const COOP_PLAN_PATROL_ARROW_EVERY = 4;  // an arrow on every this-th leg of the round
const COOP_PLAN_PATROL_ARROW = 0.7;      // the round's arrow, of a cell
const COOP_PLAN_POST_LINE = 0.9;         // a posted guard's look: the line, of a cell
const COOP_PLAN_POST_LINE_W = 2.2;       // px: its width
const COOP_PLAN_POST_ARROW = 0.9;        // its arrow, of a cell
const COOP_PLAN_GUARD_SIGN = 1.15;       // a guard's sign, of a cell
const COOP_PLAN_GUARD_NAME_UP = 4;       // px: his name over the top of his cell
const COOP_PLAN_ROOM_SPACING = 0.6;      // px: a room name's letter spacing
const COOP_PLAN_ROOM_NAME_OP = 0.75;     // its opacity
const COOP_PLAN_ROOM_NAME_PAD = 10;      // px: the cells a name takes reach this past it
const COOP_PLAN_ROOM_NAME_X = 6;         // px: a name right of its cell's left edge
const COOP_PLAN_ROOM_NAME_Y = 15;        // px: its baseline below the cell's top edge
const COOP_PLAN_ROOM_BOX_IN = 4;         // px: the box the pills keep off a name: its left and top in from the cell
const COOP_PLAN_ROOM_BOX_R = 8;          // px: its right past the name's width
const COOP_PLAN_ROOM_BOX_B = 17;         // px: its bottom below the cell's top
const COOP_PLAN_BOX_PAD = 16;            // px: the map's box past the level (the doors' swing)
const COOP_PLAN_BOX_TOP = 24;            // px: its top over the level (the guards' names)
const COOP_PLAN_NOTE_EDGE = 2;           // px: the notes keep this far in from the sheet's edge
const COOP_PLAN_STICKER_MARGIN = 34;     // px: the sticker off the map and the sheet's right edge
const COOP_PLAN_STICKER_IN = 14;         // px: the sticker's edge left of its rows
const COOP_PLAN_LEGEND_TOP = 56;         // px: the sticker's top (the close button over it)
const COOP_PLAN_LEGEND_HEAD_Y = 30;      // px: the sticker's title below its top
const COOP_PLAN_LEGEND_HEAD_GAP = 38;    // px: from the title to the first row
const COOP_PLAN_LEG_ICON_X = 13;         // px: a legend row's sign right of the rows' edge
const COOP_PLAN_LEG_GEM = 30;            // px: the gem's sign in the legend
const COOP_PLAN_LEG_ICON = 36;           // px: another sign in the legend
const COOP_PLAN_LEG_RING = 14;           // px: a legend sign's ring
const COOP_PLAN_LEG_TEXT_X = 36;         // px: a legend row's text right of the rows' edge
const COOP_PLAN_LEG_ROW = 36;            // px: a legend row
const COOP_PLAN_LEG_AFTER = 14;          // px after the legend's rows
const COOP_PLAN_LEG_PRICES_GAP = 23;     // px: the total to the prices
const COOP_PLAN_LEG_STARS_GAP = 32;      // px: to the stars' heading
const COOP_PLAN_LEG_STAR_ROW = 24;       // px: a stars' row
const COOP_PLAN_STAR_STROKE = 0.6;       // px: the stars' ink outline
const COOP_PLAN_LEG_STAR_TEXT_X = 54;    // px: a stars' row text right of the stars
const COOP_PLAN_LEG_DANGERS_GAP = 44;    // px: to the dangers' heading
const COOP_PLAN_LEG_DANGERS_HEAD = 26;   // px: the heading to the first danger
const COOP_PLAN_LEG_DANGER_DOWN = 7;     // px: a danger's sign below its first line
const COOP_PLAN_LEG_DANGER_ICON = 34;    // px: a danger's sign
const COOP_PLAN_LEG_DANGER_LINE = 20;    // px: a danger's second line
const COOP_PLAN_LEG_DANGER_ROW = 50;     // px: a danger's row
const COOP_PLAN_STICKER_W_CUT = 20;      // px: the sticker at least LEGEND_W less this
const COOP_PLAN_STICKER_PAD = 30;        // px: the sticker past its widest row
const COOP_PLAN_STICKER_BOTTOM = 8;      // px: the sticker's bottom over its last row's
const COOP_PLAN_SHADOW_X = 4;            // px: the sticker's shadow right
const COOP_PLAN_SHADOW_Y = 5;            // px: its shadow down
const COOP_PLAN_SHADOW_OP = 0.16;        // its shadow's opacity
const COOP_PLAN_STICKER_TAPE_X = 18;     // px: the sticker's tape right of its edge
const COOP_PLAN_STICKER_TAPE_Y = 2;      // px: below its top
const COOP_PLAN_STICKER_TAPE = 46;       // px of the sign's 64: the tape
const COOP_PLAN_STICKER_TAPE_ROT = 32;   // degrees: the tape turned left
const COOP_PLAN_STAMP_COL = 94;          // px: the stamp's values right of its edge
const COOP_PLAN_STAMP_KEY_W = 86;        // px: the line between its keys and values
const COOP_PLAN_STAMP_TEXT_X = 8;        // px: its keys right of its edge
const COOP_PLAN_STAMP_SCALE_GAP = 8;     // px: the scale bar to its label
const COOP_PLAN_STAMP_PAD = 10;          // px: the stamp past its widest value
const COOP_PLAN_STAMP_ROW = 24;          // px: a row of the stamp
const COOP_PLAN_STAMP_GAP = 22;          // px: the stamp below the sticker
const COOP_PLAN_STAMP_BOTTOM = 30;       // px: the stamp over the sheet's bottom
const COOP_PLAN_STAMP_LINE = 1.4;        // px: its lines
const COOP_PLAN_SCALE_UP = 2;            // px: the scale bar over its row's middle
const COOP_PLAN_TAPE_X = 26;             // px: a corner's tape in from the side
const COOP_PLAN_TAPE_Y = 22;             // px: in from the top or bottom
const COOP_PLAN_TAPE_SIZE = 60;          // px of the sign's 64: the corner's tape
const COOP_PLAN_TAPE_ROT = 38;           // degrees: the corner's tape turned
const COOP_PLAN_FRAME_OUT = 8;           // px: the frame's outer line in from the edge
const COOP_PLAN_FRAME_IN = 12;           // px: its inner line
const COOP_PLAN_FRAME_OUT_W = 1.6;       // px: the outer line's width
const COOP_PLAN_FRAME_IN_W = 0.6;        // px: the inner line's width
const COOP_PLAN_NOTE_W_PAD = 10;         // px: a note past its widest line
const COOP_PLAN_NOTE_H_PAD = 6;          // px: past its lines
const COOP_PLAN_NOTE_TEXT_X = 4;         // px: its lines in from its left
const COOP_PLAN_NOTE_TEXT_Y = 3;         // px: its first line down from its top
const COOP_PLAN_NOTE_BASELINE = 0.8;     // a line's baseline, of the font
const COOP_PLAN_NOTE_DIRS = 16;          // the directions round an object a note may stand in
const COOP_PLAN_NOTE_RINGS = [0.8, 1.4, 2.2, 3.2, 4.4, 6, 8]; // cells: the distances from an object a note may stand at — a list, not in the editor
const COOP_PLAN_NOTE_MARGIN = 12;        // px: the margin spots past the level
const COOP_PLAN_NOTE_MARGIN_SPOTS = 6;   // spots each side of an object's line in the margin
const COOP_PLAN_NOTE_MARGIN_DY = 20;     // px between the margin spots on the left and right
const COOP_PLAN_NOTE_MARGIN_DX = 32;     // px between them on the top and bottom
const COOP_PLAN_NOTE_GAP = 8;            // px: the notes keep apart, not to read as one
const COOP_PLAN_NOTE_COST_NOTE = 1000;   // a note's place: the cost of a px² over another note
const COOP_PLAN_NOTE_COST_CELL = 20;     // of a px² over an object's cell
const COOP_PLAN_NOTE_COST_LEVEL = 20;    // of a px² over the level
const COOP_PLAN_NOTE_COST_LEADER = 3;    // of a px of its leader
const COOP_PLAN_NOTE_COST_CROSS = 400;   // of its leader over a cell, a note or a leader, or a leader under it
const COOP_PLAN_LEADER_STEPS = 12;       // points a leader is tested over boxes by
const COOP_PLAN_LEADER_MIN = 0.8;        // a leader drawn when longer, cells
const COOP_PLAN_LEADER_TIP = 0.55;       // its tip off the object's middle, cells
const COOP_PLAN_LEADER_BEND = 0.1;       // its bend, of its length
const COOP_PLAN_LEADER_W = 1.6;          // px: its line
const COOP_PLAN_LEADER_ARROW = 22;       // px of the sign's 64: its arrow
const COOP_PLAN_HEAD_SPACING = 1.2;      // px: the bold headings' letter spacing
const COOP_PLAN_INK = 0x1b2a3b;          // the blueprint's ink
const COOP_PLAN_PAPER = 0xd4d8fd;        // the sheet's paper
const COOP_PLAN_STICKER = 0xe0dcfa;      // the legend's sticker
const COOP_PLAN_MARK_LOOT = 0xffc21a;    // the marker of loot
const COOP_PLAN_MARK_THREAT = 0xff3b30;  // the marker of threats (cameras, guards)
const COOP_PLAN_MARK_EXIT = 0x14938d;    // the marker of the van
const COOP_PLAN_MARK_WATER = 0x3c8db7;   // the marker of water
const COOP_PLAN_ROOM = 0xffffff;         // the wash of a room over the paper
const COOP_PLAN_ROOM_ALPHA = 0.3;        // its opacity, 0..1
const COOP_PLAN_ROUTE_TEXT = 0xffffff;   // the number on a tutorial step's badge
const COOP_PLAN_TAPE = 0xffffff;         // the tape on the corners of the sheet and the sticker
const COOP_PLAN_TAPE_OP = 0.55;          // its opacity, 0..1

// --- CAMERA (CameraControl.js): target on the map, azimuth, pitch and zoom. Zoom is
// screen px per world px at the look-at point; distance is derived from it. Flight
// (WASD, Q/E) lifts the look-at point off the ground. ---
const CAMERA_FOV_DEG = 52;              // vertical field of view
const CAMERA_AZIMUTH_DEG = -90;         // where the camera looks on the map: −90 — north up, 0 — east up
const CAMERA_PITCH_DEG = 66;            // pitch toward the ground: 90 — straight from above, less — more perspective
const CAMERA_ZOOM = 1;                  // starting zoom: PC and tablets
const CAMERA_ZOOM_MOBILE = 0.7;         // starting zoom: phones (longer screen side < 1024)
const CAMERA_ZOOM_MIN = 0.25;           // wheel and pinch won't zoom out further (the largest level needs ~0.3 to fit)
const CAMERA_ZOOM_MAX = 3;              // won't zoom in closer
const CAMERA_ZOOM_WHEEL_STEP = 0.12;    // fraction of zoom per one wheel notch
const CAMERA_ZOOM_LERP = 0.18;          // zoom smoothing: fraction of the remainder per frame
const CAMERA_FOLLOW_LERP = 0.05;        // following an object (follow): fraction of the remainder per frame
const CAMERA_FLY_SPEED = 900;           // flight on WASD, arrows and Q/E: screen px/s (over the world — divided by zoom)
const CAMERA_EDGE_PX = 16;             // the cursor this near the screen's edge flies the game's camera as WASD (0 — off)
const CAMERA_LIMITS = 0;                // game camera limits: 0 — free flight, 1 — pitch within CAMERA_ORBIT_PITCH_*, target inside the location, flight ceiling; the ground edge stays out of the frame
const CAMERA_LIFT_MAX = 600;            // px, with limits: how high above the ground flight lifts the look-at point (higher — the ground edge gets into the frame)
const CAMERA_ORBIT = 0;                 // camera rotation by the player (RMB: look-around, orbit while following an object): 0 — orientation fixed, 1 — allowed
const CAMERA_ZOOM_INPUT = 0;            // zoom by the player (wheel, pinch, flight up and down): 0 — off, the player only pans (the Overcooked camera), 1 — on
const CAMERA_ORBIT_DEG_PER_PX = 0.3;    // degrees of rotation per screen px of drag
const CAMERA_ORBIT_PITCH_MIN_DEG = 35;  // with limits: won't go lower toward the ground (the limit also rises on its own — ground edge stays out of the frame)
const CAMERA_ORBIT_PITCH_MAX_DEG = 88;  // with limits: higher — almost straight from above

// --- RENDER (World3D.js): light, shadows, sky, materials, toon and ink edges. Read by
// World3D.cfg(); the editor applies edits to the live scene. ---
// One sun for the whole world. Azimuth — WHERE the shadow falls on the map (0 — right, 90 — down).
const WORLD3D_SUN_AZIMUTH_DEG = 32;
const WORLD3D_SUN_ELEVATION_DEG = 41;   // sun elevation above the horizon
const WORLD3D_SUN_INTENSITY = 0.8;      // sun strength (with the sky it sums to ~1.0 on flat ground — texture colors unchanged)
const WORLD3D_SUN_COLOR = 0xffedc7;     // sun color
const WORLD3D_SKYLIGHT_INTENSITY = 0.45; // diffuse sky light (hemispheric light source)
const WORLD3D_SKYLIGHT_COLOR = 0xb1d8f7; // sky light color (faces looking up)
const WORLD3D_GROUNDLIGHT_COLOR = 0xc2c7ad; // fill light from below (reflection off the ground)
const WORLD3D_SKY_COLOR = 0x8fc3e0;     // sky and fog color
const WORLD3D_FOG_DENSITY = 0.00032;    // exponential fog toward the horizon (0 — off)
// Shadows: one color for all (painted by the toon plugin, Babylon only provides sun visibility)
const WORLD3D_SHADOW_COLOR = 0x0f3a4d;  // shadow color
const WORLD3D_SHADOW_STRENGTH = 0.52;    // shadow strength 0..1: a surface in shadow is multiplied by a blend of white and the shadow color
const WORLD3D_SHADOW_SOFT = 2;          // edge: 0 — hard (for toon), 1..3 — PCF low/medium/high (mobile — no higher than 1)
const WORLD3D_SHADOW_MAP = 1024;        // shadow map size (mobile — half as large); takes effect with a new scene
const WORLD3D_SHADOW_RADIUS = 840;      // px: LIMIT of the shadow ortho frustum half-size; the frustum itself shrinks to the objects in the frame
const WORLD3D_SHADOW_BIAS = 0.001;     // depth bias against shadow acne (shadow stripes on lit faces)
const WORLD3D_SHADOW_NORMAL_BIAS = 0.8; // bias along the normal against shadow acne (stripes and sawtooth on faces at an acute angle to the sun), in shadow map texels on top of the edge smoothing radius (the engine adds it)
// Materials by group (specular highlight — fraction 0..1, size — exponent: larger — smaller highlight)
const WORLD3D_GROUND_SPECULAR = 0;      // ground specular highlight (0 — matte)
const WORLD3D_GROUND_SPEC_POWER = 1;    // ground specular highlight size
const WORLD3D_OUTER_TINT = 1;           // ground brightness BEYOND the location edge (less than 1 — the location boundary is visible)
const WORLD3D_PROP_SPECULAR = 0.05;     // environment specular highlight (group 'prop')
const WORLD3D_PROP_SPEC_POWER = 7;     // environment specular highlight size
const WORLD3D_ACTOR_SPECULAR = 0;       // main objects specular highlight (group 'actor'); with toon — toon glint brightness
const WORLD3D_ACTOR_SPEC_POWER = 23;    // main objects specular highlight size
// Toon shader (ArcToonPlugin): light from all sources (sun + sky, with shadow) is quantized into bands
const WORLD3D_TOON = 1;                 // 1 — toon shading with the silhouette outline and the edge lines, 0 — regular smooth shading without them
const WORLD3D_TOON_BANDS = 4;           // number of light bands (2..6)
const WORLD3D_TOON_SOFT = 0.02;         // band boundary softness (0 — sharp, 0.5 — almost smooth)
const WORLD3D_TOON_LOW = 0.48;          // brightness of the darkest band (fraction of full)
const WORLD3D_TOON_GROUND = 1;          // 1 — bands on the ground too, 0 — ground is shaded smoothly
const WORLD3D_TOON_SPEC = 0.25;            // toon glint highlight strength (0 — no highlight)
const WORLD3D_TOON_SPEC_SIZE = 0.075;    // highlight threshold (smaller — larger spot)
const WORLD3D_TOON_RIM = 0.28;           // bright rim light along the objects' silhouette edge (0 — none)
const WORLD3D_TOON_RIM_WIDTH = 0.24;    // rim light width
// Ink edges (EdgesRenderer): edges creased more sharply than the threshold — on every object of
// the scene, a skinned character too (its lines follow the bones). Only when WORLD3D_TOON = 1
const WORLD3D_TOON_INK = 2;             // 0 — none, 1 — main objects, 2 — environment too (only when WORLD3D_TOON = 1)
const WORLD3D_TOON_INK_WIDTH = 20;      // line thickness (≈ world px × 100; thinner as the camera moves away)
const WORLD3D_TOON_INK_COLOR = 0x171717; // ink color: ink edges and silhouette outline
const WORLD3D_TOON_INK_ANGLE = 40;      // °: an edge is drawn if the faces are creased more sharply
// Outer silhouette outline: post-effect (HighlightLayer, isStroke), thickness — in screen px.
// The drawn line is ~2–3× the value: the stroke takes every pixel the 7-tap blur reaches (±3 × width)
const WORLD3D_TOON_OUTLINE = 2;         // 0 — none, 1 — main objects, 2 — environment too (only when WORLD3D_TOON = 1)
const WORLD3D_TOON_OUTLINE_ACTOR_WIDTH = 0.35;   // screen px: main objects outline
const WORLD3D_TOON_OUTLINE_PROP_WIDTH = 0.35;  // screen px: environment outline (there is a lot of it in the frame — thinner)
