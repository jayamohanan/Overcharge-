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
        BOTTOM_PADDING: 70,
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

    AD: {
        DURATION: 15,  // Duration of mock ad in seconds (countdown timer)
        OVERLAY_COLOR: "#000000",
        OVERLAY_ALPHA: 1.0,  // Fully opaque - blocks game view completely
        TIMER_TEXT_SIZE: '120px',
        TIMER_TEXT_COLOR: '#FFFFFF',
    },

    GADGET_LOAD: {
        DELAY_BEFORE_CHARGING: 0,  // Delay in ms after all gadget popup animations complete before charging starts
    },

    MERGE_GRID: {
        PADDING_FROM_BUTTON_TOP: 50,
    },

    BATTERY_UNLOCK_DISPLAY: {
        DISPLAY_CROWN_PANEL: true,
        SHOW_CROWN_ICON: true,
        SHOW_BATTERY_ICON: false,
        CROWN_ICON_SIZE: 32,
        BATTERY_ICON_SIZE: 32,
        TEXT_SIZE: '24px',
        // TEXT_COLOR: '#FFD700',
        TEXT_COLOR: '#000000',
        // TEXT_STROKE_COLOR: '#8B4513',
        TEXT_STROKE_COLOR: '#000000',
        TEXT_STROKE_THICKNESS: 0,
        CROWN_BATTERY_SPACING: 10,
        BATTERY_TEXT_SPACING: 5,
        VERTICAL_OFFSET: 20,
        PADDING_FROM_LEFT: 10,
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
        REWARD_COIN_SIZE: 40,          // Match coin icon size for better visibility
        TOP_SPEED_DURATION: 600,
        SPEED_VARIATION: 0.15,
        STAGGER_DELAY: 50,
        INITIAL_STACK_OFFSET: 0,
        DELAY_BEFORE_FLY: 100,        // ms to wait after gadget disappears before coins fly
        EASE: 'Power2',
    },

    LEVEL_COMPLETION: {
        BUFFER_TIME: 500,              // ms buffer after all coins collected before next level loads
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
        SLOT_PADDING_FROM_LEFT: 40,    // padding from stripe left edge to slot left edge (px)
        SLOT_SIZE: 130,                // slot square size (px)
        SLOT_RADIUS: 15,               // corner radius (px)
        SLOT_ABOVE_STRIPE: 14,         // gap (px) between slot bottom and stripe top
        CHARGE_RATE_GAP: 10,           // gap (px) between charge-rate label bottom and slot top
        CHARGE_RATE_BOLT_SIZE: 18,     // bolt icon display size (px)

        // ── Wire connection (socket) ──────────────────────────────────────────
        SOCKET_GAP_FROM_SLOT: 25,      // gap (px) from slot right edge to socket centre
        SOCKET_SIZE: 40,               // socket sprite display size (px)
        PLUG_SIZE: 28,                 // plug sprite display size (px)
        WIRE_SAG_PERCENT: 130,         // wire length as % of straight-line distance (>100 = sag)
        WIRE_RIGID_LENGTH: 6,          // px of vertical rigid segment at plug/socket end before sag
        WIRE_THICKNESS: 5,             // wire line thickness (px)
        WIRE_COLOR: 0x46464a,          // wire color

        // ── Debug rect (max gadget area) ──────────────────────────────────────
        DEBUG_RECT_PADDING_FROM_SLOT: 110, // padding from slot right edge to debug rect left edge (px)
        DEBUG_RECT_PADDING_FROM_STRIPE: 14, // padding from stripe top to debug rect bottom (px)
        DEBUG_RECT_WIDTH: 170,         // max width for gadget display area (px)
        DEBUG_RECT_ASPECT_RATIO: 3/2,  // width:height ratio — height = WIDTH / RATIO (3:2 = 170×113)
        DEBUG_RECT_SHOW: false,        // show semi-transparent rect for max gadget area
        DEBUG_RECT_COLOR: 0xFF00FF,    // debug rect color (magenta)
        DEBUG_RECT_ALPHA: 0.1,         // debug rect transparency (0-1)

        // ── Tooth-cleaning display (toothbrush level only) ────────────────────
        // Shown to the right of the gadget; tooth_after wipes over tooth_before
        // left→right as the gadget charges 0 → capacity.
        TOOTH_GADGET_NAME: 'brush',    // which gadget name triggers the tooth display
        TOOTH_AREA_WIDTH: 200,         // max width for tooth display area (px)
        TOOTH_AREA_ASPECT_RATIO: 2.5,  // width:height ratio — height = WIDTH / RATIO
        TOOTH_PADDING_FROM_GADGET: 30, // gap from gadget right edge to tooth left edge (px)
        TOOTH_Y_OFFSET: 0,             // vertical nudge for tooth area centre (px)

        // ── Music notes (bluetooth speaker level only) ────────────────────────
        // Notes drift up-right from the speaker; both size and emission rate
        // scale with charge progress (small/few → big/many).
        SPEAKER_GADGET_NAME: 'bluetooth_speaker',
        SPEAKER_NOTE_INTERVAL: 300,    // ms between emission ticks
        SPEAKER_NOTE_BASE_SIZE: 16,    // px note size at full charge (before platform scale)
        SPEAKER_NOTE_MIN_RATE: 0.4,    // avg notes per tick at 0% charge
        SPEAKER_NOTE_MAX_RATE: 3.0,    // avg notes per tick at 100% charge

        // ── Capacity text (above gadget) ───────────────────────────────────────
        CAPACITY_TEXT_GAP: 8,          // gap (px) between capacity text bottom and gadget top
        CAPACITY_TEXT_SIZE: '20px',    // font size for capacity remaining text

        // ── Analog meter ──────────────────────────────────────────────────────
        SHOW_ANALOG_METER: false,       // toggle analog meter display on/off
        METER_PADDING_FROM_GADGET: 40,  // padding from gadget display right edge to meter arc (px)
        METER_Y_OFFSET: 0,             // meter pivot Y offset from gadget bottom (positive = down)
        METER_X: null,                 // override meter pivot X position (null = auto-calculate from gadget)
        METER_Y: null,                 // override meter pivot Y position (null = auto-calculate from gadget)
        METER_RADIUS: 62,              // arc radius (px) - drawn at full size, then scaled
        METER_SCALE: 0.7,              // scale of entire meter (1.0 = normal size, 0.5 = half size)
        METER_EXPLOSION_ANGLE: 170,    // needle angle (0-180) at full charge
        METER_RED_ZONE_ANGLE: 150,     // needle angle where red zone begins
        METER_OSCILLATION_OVERSHOOT: 12, // degrees of overshoot per tick

        // ── Operating-capacity mark ────────────────────────────────────────────
        // Progress (0-1) at which a gadget reaches its FULL operating capacity.
        // Per-gadget charge effects (glow, spin, ...) ramp to MAX by this point and
        // hold steady afterwards. The remaining range (mark → 1.0) is the "overload"
        // zone where the gadget struggles/vibrates before exploding.
        // Matches the meter's red-zone start (150/170 ≈ 0.882).
        OPERATING_CAPACITY_MARK: 150 / 170,

        // ── Smoke effect ──────────────────────────────────────────────────────
        SMOKE_START_PROGRESS: 0.80,    // 0-1 charge fraction at which smoke begins
        SMOKE_FREQUENCY_START_MS: 600,  // ms between puffs when smoke first appears (sparse)
        SMOKE_FREQUENCY_MAX_MS: 50,     // ms between puffs at peak / just after explosion (dense, faster)
        SMOKE_FREQUENCY_IDLE_MS: 450,   // ms between puffs after post-explosion burst (low idle)
        SMOKE_MAX_AFTER_EXPLOSION_MS: 5000, // ms to sustain max smoke after burnout (longer)
        SMOKE_LIFESPAN_MS: 1200,       // ms each puff lasts
        SMOKE_RADIUS_MIN: 3,           // min puff radius (px)
        SMOKE_RADIUS_MAX: 8,           // max puff radius (px)
        SMOKE_SPREAD_X: 20,            // horizontal spawn spread around gadget centre (px)
        SMOKE_DRIFT_Y: 55,             // how far upward each puff drifts (px)
        SMOKE_COLOR: 0x999999,         // puff color

        // ── Explosion ────────────────────────────────────────────────────────
        EXPLODE_SHAKE_DURATION: 350,   // ms of camera shake on gadget burnout
        EXPLODE_SHAKE_INTENSITY: 0.001, // shake magnitude (0–1 scale) - gentle shake at explosion
        USE_CODE_EXPLOSION: false,       // toggle code-based explosion (rings and radial lines)
        USE_SPRITE_EXPLOSION: true,    // toggle sprite-based explosion (animated frames)
        SPRITE_EXPLOSION_SCALE: 2.0,    // scale of sprite explosion animation
        SPRITE_EXPLOSION_DURATION: 400, // ms duration of sprite explosion animation
        BURNEDOUT_DISPLAY_DURATION: 500, // ms to show burned out sprite before fading/removing it (0 = keep forever)
        BURNEDOUT_FADE_DURATION: 500,  // ms for burned out sprite fade-out animation
        // ── Charging effects ──────────────────────────────────────────────────
        BATTERY_PULSE_SCALE: 0.6,     // scale multiplier when battery pulses during charging (1.04 = 4% larger)
        BATTERY_PULSE_DURATION: 80,   // ms for battery pulse animation
        
        CHARGE_PARTICLE_SIZE: 2,       // radius of energy particle traveling through wire (px)
        CHARGE_PARTICLE_SPEED: 450,    // ms for particle to travel from plug to gadget
        
        CHARGE_FLASH_INITIAL_SIZE: 16, // initial size of bolt flash at gadget (px)
        CHARGE_FLASH_FINAL_SIZE: 32,   // final size of bolt flash before fade (px)
        CHARGE_FLASH_DURATION: 250,    // ms for flash scale-up and fade animation
        
        // Energy beam effects
        ENERGY_BEAM_ENABLED: true,     // toggle energy beam effect along wire
        ENERGY_BEAM_THICKNESS: 8,      // thickness of energy beam along wire (px)
        ENERGY_BEAM_COLOR: 0xFFFF00,   // color of energy beam
        ENERGY_BEAM_ALPHA: 0.6,        // opacity of energy beam
        ENERGY_BEAM_DURATION: 300,     // ms for beam to appear and fade
        
        // Advanced Arcing Wire Effect (Lightning-style)
        USE_ARCING_WIRE: true,         // toggle advanced arcing wire effect (overrides simple beam)
        ARCING_WIRE_ROUGHNESS: 1.2,    // roughness of lightning arc (0.5-2.0 for spiky effect)
        ARCING_WIRE_SEGMENTS: 15,      // number of path segments (lower = more jagged)
        ARCING_WIRE_DISPLACEMENT_SCALE: 0.8, // how far arcs drift from wire (0.3-1.5)
        ARCING_WIRE_JITTER_PASSES: 2,  // number of displacement passes (1-3, more = spikier)
        ARCING_WIRE_RANDOM_OFFSET: 8,  // random perpendicular offset per segment (px)
        ARCING_WIRE_GLOW_THICKNESS: 6, // thick glow layer (px)
        ARCING_WIRE_MEDIUM_THICKNESS: 3, // medium bright layer (px)
        ARCING_WIRE_CORE_THICKNESS: 1, // thin white core (px)
        ARCING_WIRE_GLOW_COLOR: 0x00CCFF, // cyan/blue glow color
        ARCING_WIRE_BRIGHT_COLOR: 0x00EEFF, // bright blue color
        ARCING_WIRE_CORE_COLOR: 0xFFFFFF, // white core color
        ARCING_WIRE_PULSE_SPEED: 2.5,  // speed multiplier for animation (not used for travel, affects flicker rate)
        ARCING_WIRE_PULSE_DURATION: 200, // total duration of arc effect (ms) - how long arc stays visible
        
        GADGET_ENERGY_GLOW_ENABLED: false, // toggle energy glow around gadget during pulse
        GADGET_ENERGY_GLOW_SIZE: 20,   // size of glow halo around gadget (px)
        GADGET_ENERGY_GLOW_COLOR: 0xFFFF00, // color of energy glow
        GADGET_ENERGY_GLOW_ALPHA: 0.5, // opacity of energy glow
        GADGET_ENERGY_GLOW_DURATION: 300, // ms for glow to appear and fade
        
        // Advanced Gadget Aura Effect
        USE_GADGET_AURA: true,         // toggle advanced gadget aura effect (overrides simple glow)
        GADGET_AURA_LAYERS: 3,         // number of concentric glow layers
        GADGET_AURA_BASE_SIZE: 180,     // base size of innermost aura layer (px)
        GADGET_AURA_COLOR: 0x00DDFF,   // aura color
        GADGET_AURA_PULSE_SPEED: 2.0,  // breathing speed (cycles per second)
        GADGET_AURA_SPARK_COUNT: 8,    // number of spark particles per pulse
        GADGET_AURA_SPARK_DURATION_MIN: 100,  // min duration (ms) for sparks to reach gadget center
        GADGET_AURA_SPARK_DURATION_MAX: 400, // max duration (ms) for sparks to reach gadget center
        
        // Gadget visual feedback on charge
        GADGET_FLASH_ON_CHARGE_ENABLED: false, // toggle alpha flash effect when gadget receives charge
        //Gadget tension color change
        GADGET_TENSION_COLOR_CHANGE_ENABLED: false, // toggle color change effect based on tension level
        GADGET_SPRITE_SWITCH_ON_TENSION_ENABLED: false, // toggle switching to alternate "tense" sprite when tension is high
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

// async function initBatteryImagePaths() {
//     if (typeof BATTERY_TYPES === 'undefined' || !BATTERY_TYPES) {
//         console.error('BATTERY_TYPES not found! Make sure batteryChargeData.js is loaded first.');
//         return;
//     }
    
//     // Get all battery levels from the new system
//     const highestLevel = getHighestBatteryLevel();
    
//     for (let level = 1; level <= highestLevel; level++) {
//         const batteryData = getBatteryData(level);
//         if (!batteryData) continue;
        
//         const path = `graphics/battery/${batteryData.fileName}`;
//         const ok = await checkFileExists(path);
        
//         if (ok) {
//             BATTERY_IMAGE_PATHS[level] = path;
//         } else {
//             console.warn(`Battery image not found: ${path} for level ${level} (${batteryData.displayName})`);
//         }
//     }
//     console.log(`Loaded ${Object.keys(BATTERY_IMAGE_PATHS).length} battery sprites`);
// }
async function initBatteryImagePaths() {
    if (typeof BATTERY_TYPES === 'undefined' || !BATTERY_TYPES) {
        console.error('BATTERY_TYPES not found! Make sure batteryChargeData.js is loaded first.');
        return;
    }
    
    // Build paths directly from BATTERY_TYPES - no network probing needed
    const highestLevel = getHighestBatteryLevel();
    
    for (let level = 1; level <= highestLevel; level++) {
        const batteryData = getBatteryData(level);
        if (!batteryData) continue;
        BATTERY_IMAGE_PATHS[level] = `graphics/battery/${batteryData.fileName}`;
    }
    
    console.log(`Registered ${Object.keys(BATTERY_IMAGE_PATHS).length} battery sprites`);
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
//   • Debug rect (max gadget area):    170 × 113 px  (PLATFORM.DEBUG_RECT_WIDTH × WIDTH/ASPECT_RATIO, 3:2)
//   • Tooth area (toothbrush level):   200 × 80 px   (PLATFORM.TOOTH_AREA_WIDTH × WIDTH/ASPECT_RATIO, 2.5:1)
//   • Gadget sprite (within debug):    auto-sized    (aspect ratio preserved, centered horizontally, touching bottom)
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
