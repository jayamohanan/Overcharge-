/**
 * GADGET DATA FILE
 * 
 * This file contains all gadget-related data for the game.
 * 
 * CAPACITY VALUES BY LEVEL:
 * - GADGET_CAPACITY_BY_LEVEL: Dictionary mapping level numbers to [HP1, HP2, HP3] arrays
 * - Edit this to change capacity values for any level
 * - Each level has 3 HP values for different difficulty tiers
 * - Currently supports 64 levels
 * 
 * GADGET SPRITES:
 * - GADGET_SPRITES: Array of gadget sprite definitions
 * - Each entry has: name, normal_sprite, burnedout_sprite, connection_height, connection_left_padding
 * - Reorder sprites freely without affecting capacity values
 * - Add more sprites by appending to the array
 * 
 * IMPORTANT: Capacity values are SEPARATE from gadget appearance
 * - Capacity values are always determined by the level, not by which sprite is shown
 * - The game cycles through available sprites as levels progress
 * 
 * All sprite files should be placed in: graphics/gadgets/
 */

// ============================================================
// CAPACITY VALUES BY LEVEL (from CSV data)
// ============================================================
var GADGET_CAPACITY_BY_LEVEL = {
    1: [25, 50, 100],
    2: [150, 250, 500],
    3: [750, 1250, 2000],
    4: [2500, 3750, 5000],
    5: [5000, 6000, 10000],
    6: [2500, 2500, 2500],
    7: [7500, 15000, 25000],
    8: [25000, 40000, 50000],
    9: [150000, 150000, 150000],
    10: [150000, 200000, 250000],
    11: [500000, 750000, 1000000],
    12: [1500000, 2000000, 2500000],
    13: [1800000, 1900000, 1900000],
    14: [3500000, 4000000, 4300000],
    15: [9000000, 9300000, 9600000],
    16: [19000000, 19500000, 20000000],
    17: [40000000, 45000000, 50000000],
    18: [50000000, 75000000, 100000000],
    19: [100000000, 150000000, 200000000],
    20: [200000000, 250000000, 300000000],
    21: [400000000, 500000000, 550000000],
    22: [550000000, 600000000, 690000000],
    23: [700000000, 800000000, 900000000],
    24: [1200000000, 1200000000, 1200000000],
    25: [1300000000, 1300000000, 1200000000],
    26: [1100000000, 1200000000, 1300000000],
    27: [1300000000, 1400000000, 1500000000],
    28: [1500000000, 1700000000, 1800000000],
    29: [50000000, 75000000, 100000000],
    30: [2000000000, 2200000000, 2300000000],
    31: [2200000000, 2400000000, 2600000000],
    32: [2500000000, 2600000000, 2800000000],
    33: [2900000000, 3000000000, 3200000000],
    34: [3000000000, 3300000000, 3500000000],
    35: [3500000000, 3800000000, 4000000000],
    36: [4300000000, 4600000000, 4900000000],
    37: [5000000000, 5300000000, 5600000000],
    38: [5600000000, 6100000000, 6500000000],
    39: [6000000000, 6500000000, 5700000000],
    40: [7000000000, 7500000000, 8000000000],
    41: [8000000000, 9000000000, 10000000000],
    42: [20000000000, 25000000000, 30000000000],
    43: [30000000000, 40000000000, 50000000000],
    44: [50000000000, 60000000000, 70000000000],
    45: [70000000000, 80000000000, 90000000000],
    46: [90000000000, 95000000000, 100000000000],
    47: [120000000000, 130000000000, 140000000000],
    48: [140000000000, 160000000000, 180000000000],
    49: [200000000000, 225000000000, 250000000000],
    50: [250000000000, 300000000000, 350000000000],
    51: [400000000000, 450000000000, 500000000000],
    52: [500000000000, 600000000000, 750000000000],
    53: [750000000000, 900000000000, 1000000000000],
    54: [1000000000000, 1250000000000, 1500000000000],
    55: [1500000000000, 1750000000000, 2000000000000],
    56: [2000000000000, 2250000000000, 2500000000000],
    57: [2500000000000, 2750000000000, 3000000000000],
    58: [3000000000000, 3500000000000, 4000000000000],
    59: [4000000000000, 4500000000000, 5000000000000],
    60: [5000000000000, 5500000000000, 6000000000000],
    61: [6000000000000, 7000000000000, 7500000000000],
    62: [7000000000000, 7500000000000, 8000000000000],
    63: [250000000000, 375000000000, 500000000000],
    64: [8000000000000, 9000000000000, 10000000000000]
};
var GADGET_REWARD = {
    1:[],
}

// ============================================================
// GADGET SPRITE DEFINITIONS
// ============================================================
var GADGET_SPRITES = [
    {
        "name": "ac",
        "normal_sprite": "ac.png",
        "burnedout_sprite": "ac_burnedout.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5
    },
    {
        "name": "radio",
        "normal_sprite": "radio.png",
        "burnedout_sprite": "radio_burnedout.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5
    },
    {
        "name": "phone",
        "normal_sprite": "phone.png",
        "burnedout_sprite": "phone_burnedout.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5
    },
    {
        "name": "laptop",
        "normal_sprite": "laptop.png",
        "burnedout_sprite": "laptop_burnedout.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5
    },
    {
        "name": "aircooler",
        "normal_sprite": "air_cooler.png",
        "burnedout_sprite": "air_cooler_burnedout.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5
    },
    {
        "name": "bluetooth_speaker",
        "normal_sprite": "bluetooth_speaker.png",
        "burnedout_sprite": "bluetooth_speaker_burnedout.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5
    },
    {
        "name": "brush",
        "normal_sprite": "brush.png",
        "burnedout_sprite": "brush_burnedout.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5
    },
    {
        "name": "bulb",
        "normal_sprite": "bulb.png",
        "burnedout_sprite": "bulb_burnedout.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5
    },
    {
        "name": "car",
        "normal_sprite": "car.png",
        "burnedout_sprite": "car_burnedout.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5
    },
    {
        "name": "cooktop",
        "normal_sprite": "cooktop.png",
        "burnedout_sprite": "cooktop_burnedout.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5
    },
    {
        "name": "desktop",
        "normal_sprite": "desktop.png",
        "burnedout_sprite": "desktop_burnedout.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5
    },
    {
        "name": "fridge",
        "normal_sprite": "fridge.png",
        "burnedout_sprite": "fridge_burnedout.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5
    },
    {
        "name": "geyser",
        "normal_sprite": "geyser.png",
        "burnedout_sprite": "geyser_burnedout.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5
    },
    {
        "name": "mixi",
        "normal_sprite": "mixi.png",
        "burnedout_sprite": "mixi_burnedout.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5
    },
    {
        "name": "washing_machine",
        "normal_sprite": "washing_machine.png",
        "burnedout_sprite": "washing_machine_burnedout.png",
        "connection_height": 0.3,
        "connection_left_padding": 0.5
    }
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get gadget capacity values for a specific level
 * @param {number} level - The level number (1-64)
 * @returns {Array<number>|null} Array of [HP1, HP2, HP3] or null if not found
 */
function getGadgetCapacity(level) {
    return GADGET_CAPACITY_BY_LEVEL[level] || null;
}

/**
 * Get the highest level with defined capacity values
 * @returns {number} The highest level number
 */
function getHighestGadgetLevel() {
    const levels = Object.keys(GADGET_CAPACITY_BY_LEVEL).map(Number);
    return Math.max(...levels);
}

/**
 * Get a gadget sprite definition by index
 * @param {number} index - The gadget index (0-based)
 * @returns {Object|null} Gadget sprite object or null if not found
 */
function getGadgetSprite(index) {
    return GADGET_SPRITES[index] || null;
}

/**
 * Get gadget sprite for a level (cycles through available sprites)
 * @param {number} level - The level number
 * @returns {Object|null} Gadget sprite object
 */
function getGadgetSpriteForLevel(level) {
    if (GADGET_SPRITES.length === 0) return null;
    const index = (level - 1) % GADGET_SPRITES.length;
    return GADGET_SPRITES[index];
}

/**
 * Get complete gadget data for a level (sprite + capacity)
 * @param {number} level - The level number
 * @returns {Object} Object with sprite data and capacity array
 */
function getGadgetData(level) {
    const sprite = getGadgetSpriteForLevel(level);
    const capacity = getGadgetCapacity(level);
    
    return {
        ...sprite,
        capacity: capacity,
        level: level
    };
}
