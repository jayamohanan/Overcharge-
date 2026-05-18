// Helper: convert CSS hex color string to Phaser hex number
function hexColor(cssColor) {
    if (typeof cssColor === 'string' && cssColor.startsWith('#')) {
        return parseInt(cssColor.substring(1), 16);
    }
    return cssColor;
}

var CONFIG = {
    FONT_FAMILY: 'Arial',
    TEXT_COLOR: '#1A237E',

    RESET_PROGRESS: false,
    BATTERY_START_LEVEL: 1,
    BATTERY_IMAGE_EXTENSIONS: ['svg', 'png', 'jpg', 'webp'],

    BACKGROUND: {
        GRADIENT_START_COLOR: "#79d288",
        GRADIENT_END_COLOR: "#79d288",
    },

    BUTTON: {
        SPAWN_WIDTH: 250,
        SPAWN_HEIGHT: 90,
        LEVELUP_WIDTH: 180,
        LEVELUP_HEIGHT: 70,
        LEVELUP_COLOR: "#FF6B9D",
        LEVELUP_BORDER_COLOR: "#E91E63",
        LEVELUP_BORDER_WIDTH: 4,
        BOTTOM_PADDING: 80,
        BUTTON_SPACING: 220,
        BATTERY_ICON_WIDTH: 64,
        BATTERY_ICON_HEIGHT: 64,
        BATTERY_ICON_X: -80,
        BATTERY_ICON_Y: 0,
        COIN_TEXT_SIZE: '32px',
        COIN_TEXT_X: 20,
        COIN_TEXT_Y: 0,
        COIN_ICON_WIDTH: 50,
        COIN_ICON_HEIGHT: 50,
        COIN_ICON_X: 80,
        COIN_ICON_Y: 0,
    },

    MERGE_GRID: {
        PADDING_FROM_BUTTON_TOP: 20,
    },

    BATTERY_UNLOCK_DISPLAY: {
        DISPLAY_CROWN_PANEL: true,
        SHOW_CROWN_ICON: true,
        SHOW_BATTERY_ICON: false,
        CROWN_ICON_SIZE: 32,
        BATTERY_ICON_SIZE: 32,
        TEXT_SIZE: '24px',
        TEXT_COLOR: '#FFD700',
        TEXT_STROKE_COLOR: '#8B4513',
        TEXT_STROKE_THICKNESS: 4,
        CROWN_BATTERY_SPACING: 8,
        BATTERY_TEXT_SPACING: 5,
        VERTICAL_OFFSET: 20,
        PADDING_FROM_LEFT: 30,
    },

    COIN_COUNTER: {
        ALIGN_WITH_GRID_ROW: 1,
        PADDING_FROM_SCREEN_RIGHT: 20,
        TEXT_SIZE: '48px',
        TEXT_COLOR: '#f7ca42',
        TEXT_STROKE_COLOR: '#7e5d11',
        TEXT_STROKE_THICKNESS: 6,
        COIN_ICON_WIDTH: 40,
        COIN_ICON_HEIGHT: 40,
        TEXT_ICON_SPACING: 10,
    },

    CELL: {
        SIZE: 130,
        GAP: 4,
        RADIUS: 15,
        EMPTY_BG_COLOR: "#c2d1e0",
        FILLED_BG_COLOR: "#eaf0f6",
        INSET_SHADOW_COLOR: "#364549",
        INSET_BORDER_WIDTH: 3.5,
        BATTERY_DISPLAY_SIZE: 64,
        BATTERY_SCALE: 1.0,
        BATTERY_Y_OFFSET: 5,
        LEVEL_TEXT_SIZE: '11px',
        LEVEL_TEXT_COLOR: '#000000',
        LEVEL_TEXT_Y_OFFSET: -40,
        DRAGGABLE_BG_COLOR: "#FFFFFF",
        DRAGGABLE_BG_ALPHA: 0,
        GRID_PANEL_PADDING: 40,
        GRID_PANEL_COLOR: "#ccd5d7",
        GRID_PANEL_RADIUS: 15,
        GRID_PANEL_BORDER_COLOR: "#364549",
        GRID_PANEL_BORDER_WIDTH: 3,
    },

    SPAWN_ANIMATION: {
        INITIAL_SCALE_X: 1.15,
        INITIAL_SCALE_Y: 0.85,
        STRETCH_SCALE_X: 0.9,
        STRETCH_SCALE_Y: 1.1,
        STRETCH_DURATION: 150,
        BOUNCE_SCALE_X: 1.05,
        BOUNCE_SCALE_Y: 0.975,
        BOUNCE_DURATION: 100,
        SETTLE_DURATION: 80,
    },

    POINTER: {
        SCALE: 1,
        FILL_COLOR: "#ffd251",
        STROKE_COLOR: "#6d5727",
        STROKE_WIDTH: 3,
        OFFSET_Y: 20,
        ANIMATION_MOVE_UP: 12,
        ANIMATION_SCALE_DOWN: 0.9,
        ANIMATION_DURATION: 200,
        ANIMATION_YOYO: true,
        ANIMATION_REPEAT: -1,
        TUTORIAL_START_DELAY: 500,
        TUTORIAL_FADE_DURATION: 500,
        TUTORIAL_MASK_COLOR: "#000000",
        TUTORIAL_MASK_OPACITY: 0.75,
    },

    MERGE_TUTORIAL: {
        POINTER_OFFSET_Y: 50,
        ANIMATION_DURATION: 1000,
        ANIMATION_REPEAT: -1,
        ANIMATION_EASE: 'Sine.easeInOut',
    },

    COIN_REWARD_ANIMATION: {
        COIN_COUNT: 6,
        REWARD_COIN_SIZE: 32,
        TOP_SPEED_DURATION: 600,
        SPEED_VARIATION: 0.15,
        STAGGER_DELAY: 50,
        INITIAL_STACK_OFFSET: 0,
        COIN_SPAWN_DELAY: 100,
        EASE: 'Power2',
    },

        // Platform stripes (top half) with battery slot on left, gadget on right
    PLATFORM: {
        Y_POSITIONS: [200, 390, 580],  // vertical centre Y of each platform stripe
        STRIPE_X: 20,                  // left edge of stripe (px)
        STRIPE_WIDTH: 680,             // full stripe width (px)
        STRIPE_HEIGHT: 18,             // stripe height (px)
        STRIPE_COLOR: "#1e3a4a",
        STRIPE_ALPHA: 0.9,

        // ── Battery slot ──────────────────────────────────────────────────────
        SLOT_X: 210,                   // horizontal centre of battery slot (px)
        SLOT_SIZE: 130,                // slot square size (px)
        SLOT_RADIUS: 15,               // corner radius (px)
        SLOT_ABOVE_STRIPE: 14,         // gap (px) between slot bottom and stripe top
        CHARGE_RATE_GAP: 10,           // gap (px) between charge-rate label bottom and slot top

        // ── Gadget sprite ──────────────────────────────────────────────────────
        GADGET_X: 490,                 // horizontal centre of gadget sprite (px)
        GADGET_SIZE: 115,              // display size — square (px)
        GADGET_ABOVE_STRIPE: 14,       // gap (px) between gadget bottom and stripe top
        CAPACITY_TEXT_GAP: 10,         // gap (px) between capacity label bottom and gadget top

        // ── Analog meter ──────────────────────────────────────────────────────
        METER_GAP: 8,                  // gap from gadget right edge to meter arc (px)
        METER_Y_OFFSET: 0,             // meter pivot Y offset from gadget bottom (positive = down)
        METER_RADIUS: 62,              // arc radius (px)
        METER_EXPLOSION_ANGLE: 170,    // needle angle (0-180) at full charge
        METER_RED_ZONE_ANGLE: 150,     // needle angle where red zone begins
        METER_OSCILLATION_OVERSHOOT: 12, // degrees of overshoot per tick

        // ── Smoke effect ──────────────────────────────────────────────────────
        SMOKE_START_PROGRESS: 0.80,    // 0-1 charge fraction at which smoke begins
        SMOKE_FREQUENCY_START_MS: 600,  // ms between puffs when smoke first appears (sparse)
        SMOKE_FREQUENCY_MAX_MS: 80,     // ms between puffs at peak / just after explosion (dense)
        SMOKE_FREQUENCY_IDLE_MS: 450,   // ms between puffs after post-explosion burst (low idle)
        SMOKE_MAX_AFTER_EXPLOSION_MS: 3000, // ms to sustain max smoke after burnout
        SMOKE_LIFESPAN_MS: 1200,       // ms each puff lasts
        SMOKE_RADIUS_MIN: 3,           // min puff radius (px)
        SMOKE_RADIUS_MAX: 8,           // max puff radius (px)
        SMOKE_SPREAD_X: 20,            // horizontal spawn spread around gadget centre (px)
        SMOKE_DRIFT_Y: 55,             // how far upward each puff drifts (px)
        SMOKE_COLOR: 0x999999,         // puff color

        // ── Wire connection ────────────────────────────────────────────────────
        SOCKET_GAP_RIGHT: 20,          // gap (px) from slot right edge to socket centre
        SOCKET_SIZE: 40,               // socket sprite display size (px)
        PLUG_SIZE: 28,                 // plug sprite display size (px)
        WIRE_SAG_PERCENT: 130,         // wire length as % of straight-line distance (>100 = sag)
        WIRE_RIGID_LENGTH: 6,         // px of vertical rigid segment at plug/socket end before sag
        WIRE_THICKNESS: 5,             // wire line thickness (px)
        WIRE_COLOR: 0x46464a,          // wire color

        // ── Explosion ────────────────────────────────────────────────────────
        EXPLODE_SHAKE_DURATION: 350,   // ms of camera shake on gadget burnout
        EXPLODE_SHAKE_INTENSITY: 0.018, // shake magnitude (0–1 scale)
    },
};

// -------------------------------------------------------------------
// Battery image helpers
// -------------------------------------------------------------------

var BATTERY_IMAGE_PATHS = {};

function checkFileExists(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload  = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
    });
}

async function initBatteryImagePaths() {
    if (typeof BATTERY_DATA === 'undefined' || !BATTERY_DATA) {
        console.error('BATTERY_DATA not found! Make sure batteryChargeData.js is loaded first.');
        return;
    }
    for (let i = 0; i < BATTERY_DATA.length; i++) {
        const info = BATTERY_DATA[i];
        const path = `graphics/battery/${info.fileName}`;
        const ok   = await checkFileExists(path);
        if (ok) BATTERY_IMAGE_PATHS[info.level] = path;
    }
    console.log(`Loaded ${Object.keys(BATTERY_IMAGE_PATHS).length} battery sprites`);
}

function loadBatteryImagesFromCache(scene) {
    for (const level in BATTERY_IMAGE_PATHS) {
        const path = BATTERY_IMAGE_PATHS[level];
        if (path) scene.load.image(`battery${level}`, path);
    }
}

function getBatteryIconLevel(level) {
    const highest = getHighestBatteryLevel();
    return Math.min(level, highest);
}

// ===================================================================
// SPRITE SIZE QUICK REFERENCE
// ===================================================================
// Grid & Batteries:
//   • Grid cell (empty/filled):        130 × 130 px  (CELL.SIZE)
//   • Battery sprite in grid cell:      64 × 64 px   (CELL.BATTERY_DISPLAY_SIZE)
//   • Battery level text offset:        -40 px Y     (CELL.LEVEL_TEXT_Y_OFFSET)
//
// Platform/Charger System:
//   • Charger slot (battery holder):   130 × 130 px  (PLATFORM.SLOT_SIZE) — same as grid cell
//   • Gadget sprite:                   115 × 115 px  (PLATFORM.GADGET_SIZE)
//   • Socket (on slot):                 40 × 40 px   (PLATFORM.SOCKET_SIZE)
//   • Plug (on wire):                   28 × 28 px   (PLATFORM.PLUG_SIZE)
//   • Platform stripe height:           18 px        (PLATFORM.STRIPE_HEIGHT)
//
// Meter (analog gauge):
//   • Meter radius:                     62 px        (PLATFORM.METER_RADIUS)
//   • Meter diameter (approx):         124 px        (2 × radius)
//
// UI Elements:
//   • Button battery icon:              64 × 64 px   (BUTTON.BATTERY_ICON_WIDTH/HEIGHT)
//   • Button coin icon:                 50 × 50 px   (BUTTON.COIN_ICON_WIDTH/HEIGHT)
//   • Coin counter icon:                40 × 40 px   (COIN_COUNTER.COIN_ICON_WIDTH/HEIGHT)
//   • Reward coin (animation):          32 × 32 px   (COIN_REWARD_ANIMATION.REWARD_COIN_SIZE)
//   • Crown icon (unlock display):      32 × 32 px   (BATTERY_UNLOCK_DISPLAY.CROWN_ICON_SIZE)
//   • Spawn button:                    250 × 90 px   (BUTTON.SPAWN_WIDTH/HEIGHT)
//   • Level-up button:                 180 × 70 px   (BUTTON.LEVELUP_WIDTH/HEIGHT)
// ===================================================================
