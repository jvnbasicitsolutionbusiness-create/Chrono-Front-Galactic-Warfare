/**
 * Chrono-Front: Galactic War — Central Game Configuration
 *
 * PART 1 REVISION:
 *  - Exact 52-card military system (2 starting + 49 adventure + 1 boss = 52)
 *  - 5 canonical environments: Daytime / Nighttime / Foggy / Rainy-Stormy / Radioactive
 *  - Creator Bitos event flags (levels 5/15/25/35/45)
 *  - Every-10th digital briefing flags (10/20/30/40/50 — NO Creator Bitos)
 *  - 50-level reward schedule (each level 2-49 = 1 card; level 50 boss = 1 final card)
 *  - Wave timeline system config
 *  - Flag Alien definition
 *  - Menu lock system config
 *  - Google Sheets URL via server for progression sync
 *  - Database: Google Sheets (Apps Script web-app)
 */

/* global GW */
window.GW = window.GW || {};

// ─── Canvas / Display ─────────────────────────────────────────────────────────
GW.DISPLAY = {
  BASE_WIDTH:   960,
  BASE_HEIGHT:  600,   // taller canvas for proper sky proportions
  MIN_WIDTH:    320,
  MIN_HEIGHT:   320,
  BACKGROUND_COLOR: '#0a1a08',   // Dark military green — visible fallback if scene fails
  PIXEL_ART:    true,
};

// ─── Game Board Layout ─────────────────────────────────────────────────────────
GW.BOARD = {
  LANES:             5,
  LANE_HEIGHT:       72,
  TOP_OFFSET:        160,  // ample sky — background fills 0 to 160px
  LEFT_MARGIN:       10,
  RIGHT_MARGIN:      10,
  CELL_WIDTH:        80,
  CELLS_PER_LANE:    9,    // 9 cells — fenceX = 100 + 9×80 + 8 = 828; alien zone = 828→960 (132px)
  HOME_X:            68,      // home base line
  ENEMY_SPAWN_X:     962,     // aliens enter right at screen edge (visible immediately)
  PLACEMENT_START_X: 100,     // first defender column, clear of building (HOME_X=68, bx ends at ~68)
  SENTINEL_X:        76,      // sentinel just RIGHT of home wall — visible in first board column
  // Timeline area at very bottom
  TIMELINE_Y:        522,
  TIMELINE_HEIGHT:   55,
  // Card tray: top-left, below sky
  TRAY_Y:            0,
  TRAY_HEIGHT:       60,
  TRAY_CARD_W:       64,
  TRAY_CARD_H:       52,
  TRAY_CARD_PAD:     5,
  TRAY_START_X:      124,     // after plasma collector box (box occupies 8→116)
  MAX_LOADOUT:       6,
};

// ─── Wave Timeline ─────────────────────────────────────────────────────────────
GW.WAVE_TIMELINE = {
  BAR_Y:        570,    // bottom of 600px canvas
  BAR_HEIGHT:   10,
  MARKER_SIZE:  14,
  COLORS: {
    bar:         0x1a2d0a,
    progress:    0x4ade80,
    waveMarker:  0xfbbf24,
    finalWave:   0xef4444,
    flagAlien:   0xe879f9,
  },
};

// ─── Plasma Energy System ─────────────────────────────────────────────────────
GW.RESOURCES = {
  STARTING_ENERGY:       50,    // 50 plasma at start — enough for 1 generator but nothing more
  MAX_ENERGY:            9999,  // PVZ-style cap — mythical cards cost 1500–3000
  ORB_SPAWN_INTERVAL:    15000, // base interval; actual randomized 15000ms fixed
  ORB_SPAWN_INTERVAL_MIN:15000, // 15s minimum between random plasma orbs
  ORB_SPAWN_INTERVAL_MAX:15000, // 15s maximum — fixed 15s spawn cadence
  ORB_SPAWN_COUNT:       1,
  ORB_VALUE:             25,
  ORB_LIFETIME:          18000,
  KILL_REWARD_BASE:      10,    // alien kill gives 10 plasma
  BASE_GEN_INTERVAL:     120000,// very slow background trickle
  BASE_GEN_AMOUNT:       5,
  REGEN_UNIT_INTERVAL:   11000, // P.E. Generator: randomized 10000–12000ms (nerfed)
  REGEN_UNIT_INTERVAL_MIN: 10000,
  REGEN_UNIT_INTERVAL_MAX: 12000,
  REGEN_UNIT_AMOUNT:     25,
};

// ─── Galactic Currency System ─────────────────────────────────────────────────
GW.CURRENCY = {
  // Drop chances (fraction) when alien is killed
  DROP_CHANCE_MIN:    0.10,   // 10% minimum drop chance
  DROP_CHANCE_MAX:    0.25,   // 25% maximum drop chance
  // Currency types with their values
  TYPES: {
    silver_coin: { id: 'silver_coin',  name: 'Silver Galactic Coin', value: 1,  color: 0xc0c0c0, glowColor: 0xe8e8ff },
    gold_coin:   { id: 'gold_coin',    name: 'Gold Galactic Coin',   value: 3,  color: 0xffd700, glowColor: 0xffed4a },
    cash_note:   { id: 'cash_note',    name: 'Galactic Cash Note',   value: 10, color: 0x4ade80, glowColor: 0x86efac },
  },
  // Type weights: silver most common, cash_note rare
  TYPE_WEIGHTS: { silver_coin: 6, gold_coin: 3, cash_note: 1 },
  LIFETIME:       14000,   // ms before uncollected currency fades
  FLOAT_DURATION:  800,    // ms for collection float animation
};

// ─── Wave System ──────────────────────────────────────────────────────────────
GW.WAVES = {
  BETWEEN_WAVE_DELAY:  9000,    // 8-10s pause between pre-wave and assault wave
  SPAWN_DELAY:         17500,   // 15-20s between individual pre-wave aliens
  INITIAL_DELAY:       20000,   // 20s before first alien appears (player prep time)
  PRESSURE_DELAY:      17500,
};

// ─── Combat ───────────────────────────────────────────────────────────────────
GW.COMBAT = {
  PROJECTILE_SPEED:  380,
  DAMAGE_FLASH_MS:   120,
};

// ─── Defense Sentinel ─────────────────────────────────────────────────────────
GW.SENTINEL = {
  TRIGGER_X:      60,     // px — alien must reach this x to trigger
  DAMAGE:         9999,   // one-shots all non-boss aliens
  TRAVEL_SPEED:   480,    // px/s — sentinel travels through lane
  ANIMATION_MS:   1200,   // activation + travel animation
  RECHARGE_MS:    0,      // 0 = single use per level
  AVAILABLE:      true,
  FRIENDLY_FIRE:  false,  // NEVER damages military units
};

// ─── Camera Reconnaissance ────────────────────────────────────────────────────
GW.CAMERA_RECON = {
  ENABLED:     false,  // Disabled: camera fadeIn used instead,   // Disabled: black overlay was causing black screen bug
  DURATION:    3500,   // total recon duration (ms)
  ALIEN_SIDE_HOLD: 1200,   // time spent showing alien side
  PAN_DURATION: 1000,      // pan from alien side to player base
  BASE_HOLD:   600,        // time showing player base before unlock
};

// ─── Alien Equipment Variants ────────────────────────────────────────────────
GW.ALIEN_EQUIPMENT = {
  // ── 10 equipment tiers matching the spec table ────────────────────────────
  // Each entry: baseHp=100 (the alien body HP), extraHp=shield/armor HP on top,
  // speedMult=speed multiplier relative to base 28px/s.
  // breakAnim: visual played when equipment is destroyed.
  // speedAfterBreak: if set, speed multiplier changes when equipment breaks.

  bare: {
    id: 'bare', name: 'Common Alien', tier: 1,
    baseHp: 100, extraHp: 0, totalHp: 100,
    speedMult: 1.0,
    equipColor: null, equipName: null,
  },
  cap: {
    id: 'cap', name: 'Cap Alien', tier: 2,
    baseHp: 100, extraHp: 20, totalHp: 120,
    speedMult: 1.0,
    equipColor: 0x1d4ed8, equipName: 'Stolen Cap',
    breakAnim: 'cap_fall',
  },
  iron_mask: {
    id: 'iron_mask', name: 'Iron Mask Alien', tier: 3,
    baseHp: 100, extraHp: 50, totalHp: 150,
    speedMult: 1.0, speedAfterBreak: 1.5,   // 1.5× speed when mask breaks (not 2×)
    equipColor: 0x78716c, equipName: 'Iron Mask',
    breakAnim: 'mask_crack',
  },
  steel_helmet: {
    id: 'steel_helmet', name: 'Steel Helmet Alien', tier: 4,
    baseHp: 100, extraHp: 75, totalHp: 175,
    speedMult: 1.0,
    equipColor: 0x6b7280, equipName: 'Steel Helmet',
    breakAnim: 'helmet_break',
  },
  armored_vest: {
    id: 'armored_vest', name: 'Armored Vest Alien', tier: 5,
    baseHp: 100, extraHp: 100, totalHp: 200,
    speedMult: 0.85,
    equipColor: 0x374151, equipName: 'Metal Vest',
    breakAnim: 'vest_shatter',
  },
  shield: {
    id: 'shield', name: 'Shield Alien', tier: 5,
    baseHp: 100, extraHp: 100, totalHp: 200,
    speedMult: 0.8,
    equipColor: 0x0369a1, equipName: 'Energy Shield',
    breakAnim: 'shield_break',
    shieldType: true,    // shield is separate from body — blocks projectiles
  },
  heavy_helmet: {
    id: 'heavy_helmet', name: 'Heavy Helmet Alien', tier: 6,
    baseHp: 100, extraHp: 125, totalHp: 225,
    speedMult: 0.8,
    equipColor: 0x1e3a5f, equipName: 'Reinforced Helmet',
    breakAnim: 'heavy_helmet_break',
  },
  full_armor: {
    id: 'full_armor', name: 'Full Armor Alien', tier: 7,
    baseHp: 100, extraHp: 150, totalHp: 250,
    speedMult: 0.75,
    equipColor: 0x1f2937, equipName: 'Full Armor',
    breakAnim: 'armor_collapse',
  },
  riot_shield: {
    id: 'riot_shield', name: 'Riot Shield Alien', tier: 8,
    baseHp: 100, extraHp: 175, totalHp: 275,
    speedMult: 0.7,
    equipColor: 0x0c1445, equipName: 'Heavy Shield + Helmet',
    breakAnim: 'riot_break',
    shieldType: true,
  },
  tactical_armor: {
    id: 'tactical_armor', name: 'Tactical Armor Alien', tier: 9,
    baseHp: 100, extraHp: 200, totalHp: 300,
    speedMult: 0.8,
    equipColor: 0x292524, equipName: 'Combat Armor',
    breakAnim: 'tactical_shatter',
  },
};

// ─── Battlefield Loadout ──────────────────────────────────────────────────────
GW.LOADOUT = {
  MAX_CARDS:     6,       // Maximum cards in one battlefield session
  DEFAULT_CARDS: ['plasma_energy_generator', 'fire_lance_gunner'],
};

// ─── Pause System ─────────────────────────────────────────────────────────────
GW.PAUSE = {
  KEY:           'P',     // Keyboard shortcut to pause
  MENU_OPTIONS: ['RESUME', 'RESTART', 'MUSIC', 'SFX', 'SETTINGS', 'RETURN TO MAP', 'QUIT'],
};

// ─── Menu Lock System ─────────────────────────────────────────────────────────
// Defines which modes are available from the start.
// Other modes unlock through Adventure progression.
GW.MENU_LOCKS = {
  adventure:         { unlocked: true,  unlockReq: null },
  survival:          { unlocked: false, unlockReq: { completeLevels: 10 } },
  minigames:         { unlocked: false, unlockReq: { completeLevels: 5 }  },
  puzzle:            { unlocked: false, unlockReq: { completeLevels: 15 } },
  characters_profile:{ unlocked: false, unlockReq: { completeLevels: 1 }  },
  extras:            { unlocked: false, unlockReq: { completeLevels: 20 } },
  settings:          { unlocked: true,  unlockReq: null },
  credits:           { unlocked: true,  unlockReq: null },
};

// ─── Creator Bitos System ─────────────────────────────────────────────────────
GW.CREATOR_BITOS = {
  // Levels where Creator Bitos actually APPEARS (rare)
  appearsOnLevels:    [5, 15, 25, 35, 45],

  // Levels with digital briefing ONLY (no Creator Bitos portrait)
  digitalBriefingLevels: [10, 20, 30, 40, 50],

  name:    'Creator Bitos',
  title:   'The Game Creator',
  color:   0xd4a843,
  accentColor: 0xfbbf24,

  // Level 5 dialogue lines
  level5Dialogue: [
    '...WAIT.',
    'You think this is a normal alien invasion?',
    'Let me show you something.',
    'The Vex aren\'t just here to destroy.',
    'They are TESTING you.',
    'Your Gunner is good. But you\'ll need more.',
    'One Plasma Generator. That\'s all you started with.',
    'Use it wisely.',
    '...This is just the beginning.',
  ],

  // Digital briefing template (10/20/30/40/50 - no portrait)
  briefingTemplate: {
    prefix:    'TACTICAL SYSTEM INITIALIZING...',
    separator: '──────────────────────────────',
    suffix:    'MISSION: SURVIVE THE INVASION.',
  },
};

// ─── Weapon Definitions ───────────────────────────────────────────────────────
GW.WEAPONS = {
  // Era: early (historical gunpowder)
  fire_lance: {
    id: 'fire_lance', name: 'Fire Lance', era: 'early',
    damage: 10, attackSpeed: 2800, range: 680,
    projectileColor: 0xff6b00, projectileSize: 5, projectileType: 'fire',
    description: '10th-century Chinese fire-lance. Long range. 10 damage per shot.',
  },
  hand_cannon: {
    id: 'hand_cannon', name: 'Hand Cannon', era: 'early',
    damage: 40, attackSpeed: 2200, range: 320,
    projectileColor: 0xd97706, projectileSize: 6, projectileType: 'cannonball',
    description: 'Early-era hand-held cannon. Slow reload, powerful at range.',
  },
  musket: {
    id: 'musket', name: 'Musket', era: 'early',
    damage: 35, attackSpeed: 2000, range: 350,
    projectileColor: 0xfbbf24, projectileSize: 5, projectileType: 'bullet',
    description: 'Muzzle-loaded musket. Reliable early ranged weapon.',
  },
  arquebus: {
    id: 'arquebus', name: 'Arquebus', era: 'early',
    damage: 30, attackSpeed: 2400, range: 300,
    projectileColor: 0xfde68a, projectileSize: 5, projectileType: 'bullet',
    description: 'Early matchlock firearm.',
  },
  // Era: industrial
  rifle: {
    id: 'rifle', name: 'Rifle', era: 'industrial',
    damage: 45, attackSpeed: 1600, range: 380,
    projectileColor: 0xfde68a, projectileSize: 5, projectileType: 'bullet',
    description: 'Accurate bolt-action rifle.',
  },
  sniper_rifle: {
    id: 'sniper_rifle', name: 'Sniper Rifle', era: 'industrial',
    damage: 120, attackSpeed: 4000, range: 520,
    projectileColor: 0xfef3c7, projectileSize: 4, projectileType: 'sniper',
    description: 'Very high damage, very slow fire rate. Long range.',
  },
  mortar: {
    id: 'mortar', name: 'Mortar', era: 'industrial',
    damage: 75, attackSpeed: 4500, range: 450,
    projectileColor: 0x9ca3af, projectileSize: 10, projectileType: 'explosive',
    splash: 80, description: 'Lobbed mortar shell. Large area damage.',
  },
  // Era: modern
  service_pistol: {
    id: 'service_pistol', name: 'Service Pistol', era: 'modern',
    damage: 25, attackSpeed: 1400, range: 300,
    projectileColor: 0xfef3c7, projectileSize: 4, projectileType: 'bullet',
    description: 'Standard sidearm. Rapid fire.',
  },
  machine_gun: {
    id: 'machine_gun', name: 'Machine Gun', era: 'modern',
    damage: 20, attackSpeed: 600, range: 340,
    projectileColor: 0xfde68a, projectileSize: 4, projectileType: 'burst',
    description: 'High rate of fire. Effective against groups.',
  },
  grenade_launcher: {
    id: 'grenade_launcher', name: 'Grenade Launcher', era: 'modern',
    damage: 80, attackSpeed: 3000, range: 400,
    projectileColor: 0x65a30d, projectileSize: 8, projectileType: 'explosive',
    splash: 60, description: 'Lobbed grenades. Splash damage.',
  },
  rocket_launcher: {
    id: 'rocket_launcher', name: 'Rocket Launcher', era: 'modern',
    damage: 140, attackSpeed: 5000, range: 480,
    projectileColor: 0xef4444, projectileSize: 9, projectileType: 'rocket',
    splash: 100, description: 'High damage rocket. Large explosion.',
  },
  // Era: advanced
  plasma_rifle: {
    id: 'plasma_rifle', name: 'Plasma Rifle', era: 'advanced',
    damage: 60, attackSpeed: 1200, range: 420,
    projectileColor: 0xa78bfa, projectileSize: 7, projectileType: 'plasma',
    description: 'Plasma weapon. Effective against armored targets.',
  },
  // Era: futuristic
  laser_weapon: {
    id: 'laser_weapon', name: 'Laser Carbine', era: 'futuristic',
    damage: 90, attackSpeed: 1000, range: 480,
    projectileColor: 0x67e8f9, projectileSize: 3, projectileType: 'laser',
    piercing: true, description: 'High-energy laser. Pierces light targets.',
  },
  plasma_cannon: {
    id: 'plasma_cannon', name: 'Plasma Cannon', era: 'futuristic_22c',
    damage: 200, attackSpeed: 2500, range: 560,
    projectileColor: 0xe879f9, projectileSize: 14, projectileType: 'plasma_cannon',
    splash: 120, description: '22nd-century plasma cannon. The ultimate weapon.',
  },
};

// ─── Military Card Definitions ────────────────────────────────────────────────
// EXACT COUNT VALIDATION:
//   Starting cards (unlockLevel = 0 or 'start'): 2
//   Adventure rewards (unlockLevel 2-49): 49
//   Boss reward (unlockLevel 50, isBossReward): 1
//   TOTAL: 52
//
// NOTE: plasma_energy_generator and fire_lance_gunner are the 2 starting cards.

GW.CARDS = {

  // ═══ STARTING CARDS (2) ════════════════════════════════════
  plasma_energy_generator: {
    id: 'plasma_energy_generator', name: 'Plasma Generator',
    era: 'early', role: 'energy', cardSlot: 'start_1',
    hp: 100, weapon: null, damage: 0, attackSpeed: 0, range: 0,
    cost: 50, unlockLevel: 'start', isBossReward: false,
    rarity: 'common',
    deployCooldown: 7500,
    color: 0xf59e0b, accentColor: 0xfef3c7,
    isSupport: true, genInterval: 11000, genAmount: 25,
    description: 'Common Plasma Energy Generator. Generates 25 Plasma every 10–12 seconds.',
    environment: 'all',
    strengthsText: 'Essential resource production.',
    weaknessesText: 'Cannot defend itself. Aliens will attack it.',
  },
  fire_lance_gunner: {
    id: 'fire_lance_gunner', name: 'Fire-Lance Gunner',
    era: 'early_10c', role: 'offense', cardSlot: 'start_2',
    hp: 80, weapon: 'fire_lance', damage: 10, attackSpeed: 2800, range: 680,
    cost: 100, unlockLevel: 'start', isBossReward: false,
    rarity: 'common',
    deployCooldown: 7500,
    color: 0x7c3d0a, accentColor: 0xff6b00,
    helmetColor: 0x3d1a00, skinColor: 0xd4956a,
    isSupport: false,
    description: '10th-century Chinese fire-lance soldier. 10 damage per shot. Costs 100 Plasma.',
    environment: 'daytime',
    strengthsText: 'Low cost. Long range. First ranged attacker.',
    weaknessesText: 'Only 10 damage per shot. ~10 shots to kill 100 HP alien.',
  },

  // ═══ LEVEL 1 REWARD ════════════════════════════════════════
  bomber: {
    id: 'bomber', name: 'Bomber',
    era: 'early', role: 'offense', cardSlot: 'adv_1b',
    hp: 60, weapon: null, damage: 80, attackSpeed: 0, range: 80,
    cost: 120, unlockLevel: 1, isBossReward: false,
    rarity: 'common',
    deployCooldown: 50000,  // 50s cooldown — single-use suicide bomber
    color: 0x7f1d1d, accentColor: 0xfca5a5,
    helmetColor: 0x450a0a, skinColor: 0xd4956a,
    isSupport: false,
    isSuicideUnit: true,    // explodes on contact, destroys self
    description: 'Runs into alien lines and self-destructs. 80 AoE damage. 50s cooldown.',
    environment: 'daytime',
    strengthsText: 'High burst AoE. Clears clustered aliens.',
    weaknessesText: 'Destroys itself on use. Long cooldown.',
  },

  // Level 2 reward
  hand_cannon_soldier: {
    id: 'hand_cannon_soldier', name: 'Hand-Cannon Soldier',
    era: 'early_15c', role: 'offense', cardSlot: 'adv_2',
    hp: 150, weapon: 'hand_cannon', damage: 40, attackSpeed: 2200, range: 320,
    cost: 100, unlockLevel: 2, isBossReward: false,
    color: 0x5c3d1e, accentColor: 0xd97706,
    helmetColor: 0x3d2008, skinColor: 0xd4956a,
    isSupport: false,
    description: '15th-century hand-cannon soldier. Slow reload, powerful shot.',
    environment: 'daytime',
  },

  // Level 3 reward
  arquebus_soldier: {
    id: 'arquebus_soldier', name: 'Arquebus Soldier',
    era: 'early_16c', role: 'offense', cardSlot: 'adv_3',
    hp: 130, weapon: 'arquebus', damage: 30, attackSpeed: 2400, range: 300,
    cost: 100, unlockLevel: 3, isBossReward: false,
    color: 0x6b4c1e, accentColor: 0xd97706,
    helmetColor: 0x3d2a0a, skinColor: 0xd4956a,
    isSupport: false,
    description: 'Early matchlock soldier. Steady fire rate.',
    environment: 'daytime',
  },

  // Level 4 reward
  pikeman: {
    id: 'pikeman', name: 'Pikeman',
    era: 'early_15c', role: 'defense', cardSlot: 'adv_4',
    hp: 220, weapon: null, damage: 15, attackSpeed: 1200, range: 60,
    cost: 75, unlockLevel: 4, isBossReward: false,
    color: 0x4a3728, accentColor: 0x7c5c2a,
    isSupport: false,
    description: 'Armed with a long pike. Blocks and attacks at close range.',
    environment: 'daytime',
  },

  // Level 5 reward (Creator Bitos event level)
  drummer_boy: {
    id: 'drummer_boy', name: 'Drummer',
    era: 'early', role: 'support', cardSlot: 'adv_5',
    hp: 80, weapon: null, damage: 0, attackSpeed: 0, range: 0,
    cost: 75, unlockLevel: 5, isBossReward: false,
    color: 0x7c5c2a, accentColor: 0xd97706,
    isSupport: true,
    description: 'Increases nearby soldiers\' attack speed. Classic support unit.',
    environment: 'daytime',
    specialAbility: 'speed_boost',
  },

  // Level 6 reward
  field_cannon: {
    id: 'field_cannon', name: 'Field Cannon',
    era: 'early_18c', role: 'artillery', cardSlot: 'adv_6',
    hp: 180, weapon: 'mortar', damage: 75, attackSpeed: 4500, range: 450,
    cost: 175, unlockLevel: 6, isBossReward: false,
    color: 0x374151, accentColor: 0x9ca3af,
    isSupport: false,
    description: 'Field artillery. High splash damage. Slow reload.',
    environment: 'daytime',
  },

  // Level 7 reward
  supply_officer: {
    id: 'supply_officer', name: 'Supply Officer',
    era: 'early', role: 'energy', cardSlot: 'adv_7',
    hp: 90, weapon: null, damage: 0, attackSpeed: 0, range: 0,
    cost: 75, unlockLevel: 7, isBossReward: false,
    color: 0x92400e, accentColor: 0xfbbf24,
    isSupport: true, genInterval: 14000, genAmount: 30,
    description: 'Faster plasma generation than basic generator.',
    environment: 'daytime',
    specialAbility: 'generate_plasma',
  },

  // Level 8 reward
  sharpshooter: {
    id: 'sharpshooter', name: 'Sharpshooter',
    era: 'industrial', role: 'offense', cardSlot: 'adv_8',
    hp: 120, weapon: 'rifle', damage: 45, attackSpeed: 1600, range: 420,
    cost: 125, unlockLevel: 8, isBossReward: false,
    color: 0x3d4a2a, accentColor: 0x65a30d,
    helmetColor: 0x1e2d0e, skinColor: 0xc8956a,
    isSupport: false,
    description: 'Bolt-action rifle. Accurate at range.',
    environment: 'daytime',
  },

  // Level 9 reward
  field_medic_early: {
    id: 'field_medic_early', name: 'Field Surgeon',
    era: 'industrial', role: 'medic', cardSlot: 'adv_9',
    hp: 100, weapon: null, damage: 0, attackSpeed: 0, range: 0,
    cost: 100, unlockLevel: 9, isBossReward: false,
    color: 0xdcfce7, accentColor: 0xffffff,
    isSupport: true,
    description: 'Heals nearby units. Basic medical support.',
    environment: 'daytime',
    specialAbility: 'heal_nearby',
  },

  // Level 10 reward (digital briefing milestone)
  machine_gunner: {
    id: 'machine_gunner', name: 'Machine Gunner',
    era: 'modern', role: 'offense', cardSlot: 'adv_10',
    hp: 200, weapon: 'machine_gun', damage: 20, attackSpeed: 600, range: 320,
    cost: 200, unlockLevel: 10, isBossReward: false,
    color: 0x374151, accentColor: 0x9ca3af,
    helmetColor: 0x1f2937, skinColor: 0xc8956a,
    isSupport: false,
    description: 'Rapid-fire machine gun. High sustained DPS.',
    environment: 'daytime',
  },

  // Level 11 reward
  night_rifleman: {
    id: 'night_rifleman', name: 'Night Rifleman',
    era: 'industrial', role: 'offense', cardSlot: 'adv_11',
    hp: 140, weapon: 'rifle', damage: 50, attackSpeed: 1800, range: 380,
    cost: 125, unlockLevel: 11, isBossReward: false,
    color: 0x1e2d3d, accentColor: 0x4b6cb7,
    helmetColor: 0x111827, skinColor: 0xc8956a,
    isSupport: false,
    description: 'Trained for night operations. Better accuracy in low light.',
    environment: 'nighttime',
  },

  // Level 12 reward
  scout: {
    id: 'scout', name: 'Scout',
    era: 'industrial', role: 'recon', cardSlot: 'adv_12',
    hp: 90, weapon: 'service_pistol', damage: 25, attackSpeed: 1200, range: 280,
    cost: 75, unlockLevel: 12, isBossReward: false,
    color: 0x2d3a2a, accentColor: 0x6b9e6b,
    isSupport: false,
    description: 'Fast detection. Reveals hidden alien threats.',
    environment: 'nighttime',
    specialAbility: 'detect',
  },

  // Level 13 reward
  flare_operator: {
    id: 'flare_operator', name: 'Flare Operator',
    era: 'industrial', role: 'support', cardSlot: 'adv_13',
    hp: 80, weapon: null, damage: 0, attackSpeed: 0, range: 0,
    cost: 75, unlockLevel: 13, isBossReward: false,
    color: 0xfbbf24, accentColor: 0xfef08a,
    isSupport: true,
    description: 'Launches flares. Illuminates night lanes. Reveals stealth aliens.',
    environment: 'nighttime',
    specialAbility: 'illuminate',
  },

  // Level 14 reward
  trench_soldier: {
    id: 'trench_soldier', name: 'Trench Soldier',
    era: 'industrial', role: 'defense', cardSlot: 'adv_14',
    hp: 280, weapon: 'musket', damage: 35, attackSpeed: 2000, range: 240,
    cost: 150, unlockLevel: 14, isBossReward: false,
    color: 0x4a3728, accentColor: 0x9c7a4a,
    isSupport: false,
    description: 'Digs in and holds position. High HP. Short range.',
    environment: 'nighttime',
  },

  // Level 15 reward (Creator Bitos event level)
  searchlight_operator: {
    id: 'searchlight_operator', name: 'Searchlight Op.',
    era: 'industrial', role: 'support', cardSlot: 'adv_15',
    hp: 80, weapon: null, damage: 0, attackSpeed: 0, range: 0,
    cost: 100, unlockLevel: 15, isBossReward: false,
    color: 0xfef08a, accentColor: 0xfbbf24,
    isSupport: true,
    description: 'Sweeping searchlight. Dramatically extends detection range.',
    environment: 'nighttime',
    specialAbility: 'searchlight',
  },

  // Level 16 reward
  radio_operator: {
    id: 'radio_operator', name: 'Radio Operator',
    era: 'modern', role: 'support', cardSlot: 'adv_16',
    hp: 85, weapon: null, damage: 0, attackSpeed: 0, range: 0,
    cost: 100, unlockLevel: 16, isBossReward: false,
    color: 0x374151, accentColor: 0x93c5fd,
    isSupport: true,
    description: 'Calls in air support. Special airstrike ability on cooldown.',
    environment: 'nighttime',
    specialAbility: 'airstrike',
  },

  // Level 17 reward
  armored_soldier: {
    id: 'armored_soldier', name: 'Armored Soldier',
    era: 'modern', role: 'defense', cardSlot: 'adv_17',
    hp: 350, weapon: 'service_pistol', damage: 20, attackSpeed: 1600, range: 240,
    cost: 175, unlockLevel: 17, isBossReward: false,
    color: 0x374151, accentColor: 0x6b7280,
    isSupport: false,
    description: 'Heavy armor. Absorbs damage for nearby allies.',
    environment: 'nighttime',
  },

  // Level 18 reward
  night_medic: {
    id: 'night_medic', name: 'Night Medic',
    era: 'modern', role: 'medic', cardSlot: 'adv_18',
    hp: 110, weapon: null, damage: 0, attackSpeed: 0, range: 0,
    cost: 125, unlockLevel: 18, isBossReward: false,
    color: 0x1d4ed8, accentColor: 0x93c5fd,
    isSupport: true,
    description: 'Enhanced field medic. Faster healing rate.',
    environment: 'nighttime',
    specialAbility: 'heal_nearby',
  },

  // Level 19 reward
  sniper: {
    id: 'sniper', name: 'Sniper',
    era: 'industrial', role: 'offense', cardSlot: 'adv_19',
    hp: 100, weapon: 'sniper_rifle', damage: 120, attackSpeed: 4000, range: 520,
    cost: 175, unlockLevel: 19, isBossReward: false,
    color: 0x2d3a1a, accentColor: 0x65a30d,
    helmetColor: 0x1a2d0a, skinColor: 0xc8956a,
    isSupport: false,
    description: 'Extreme range. Very high damage per shot. Slow reload.',
    environment: 'nighttime',
  },

  // Level 20 reward (digital briefing milestone)
  recon_unit: {
    id: 'recon_unit', name: 'Recon Unit',
    era: 'modern', role: 'recon', cardSlot: 'adv_20',
    hp: 90, weapon: 'service_pistol', damage: 20, attackSpeed: 1000, range: 350,
    cost: 100, unlockLevel: 20, isBossReward: false,
    color: 0x2d3a2a, accentColor: 0x86efac,
    isSupport: false,
    description: 'Advanced detection unit. Reveals fog/stealth threats.',
    environment: 'foggy',
    specialAbility: 'detect',
  },

  // Level 21 reward
  gas_mask_soldier: {
    id: 'gas_mask_soldier', name: 'Gas-Mask Soldier',
    era: 'industrial', role: 'offense', cardSlot: 'adv_21',
    hp: 160, weapon: 'rifle', damage: 40, attackSpeed: 1800, range: 360,
    cost: 125, unlockLevel: 21, isBossReward: false,
    color: 0x4a5a2a, accentColor: 0x9ca3af,
    isSupport: false,
    description: 'Equipped for fog and gas conditions. Immune to visibility penalties.',
    environment: 'foggy',
  },

  // Level 22 reward
  mortar_team: {
    id: 'mortar_team', name: 'Mortar Team',
    era: 'industrial', role: 'artillery', cardSlot: 'adv_22',
    hp: 150, weapon: 'mortar', damage: 85, attackSpeed: 4500, range: 480,
    cost: 175, unlockLevel: 22, isBossReward: false,
    color: 0x374151, accentColor: 0x6b7280,
    isSupport: false,
    description: 'Lobbed mortar shells. Large area of effect.',
    environment: 'foggy',
  },

  // Level 23 reward
  field_mechanic: {
    id: 'field_mechanic', name: 'Field Mechanic',
    era: 'modern', role: 'engineer', cardSlot: 'adv_23',
    hp: 110, weapon: null, damage: 0, attackSpeed: 0, range: 0,
    cost: 125, unlockLevel: 23, isBossReward: false,
    color: 0xfbbf24, accentColor: 0xf59e0b,
    isSupport: true,
    description: 'Repairs damaged units. Extends their effectiveness.',
    environment: 'foggy',
    specialAbility: 'repair',
  },

  // Level 24 reward
  heavy_rifleman: {
    id: 'heavy_rifleman', name: 'Heavy Rifleman',
    era: 'modern', role: 'offense', cardSlot: 'adv_24',
    hp: 190, weapon: 'rifle', damage: 55, attackSpeed: 1600, range: 380,
    cost: 150, unlockLevel: 24, isBossReward: false,
    color: 0x374151, accentColor: 0x9ca3af,
    isSupport: false,
    description: 'Heavier armor. Standard rifle. All-purpose soldier.',
    environment: 'foggy',
  },

  // Level 25 reward (Creator Bitos event level)
  forward_observer: {
    id: 'forward_observer', name: 'Forward Observer',
    era: 'modern', role: 'recon', cardSlot: 'adv_25',
    hp: 95, weapon: null, damage: 0, attackSpeed: 0, range: 0,
    cost: 100, unlockLevel: 25, isBossReward: false,
    color: 0x2d4a2a, accentColor: 0x86efac,
    isSupport: true,
    description: 'Calls in heavy artillery strikes. Requires setup time.',
    environment: 'foggy',
    specialAbility: 'artillery_call',
  },

  // Level 26 reward
  modern_rifleman: {
    id: 'modern_rifleman', name: 'Modern Rifleman',
    era: 'modern', role: 'offense', cardSlot: 'adv_26',
    hp: 170, weapon: 'machine_gun', damage: 25, attackSpeed: 800, range: 320,
    cost: 175, unlockLevel: 26, isBossReward: false,
    color: 0x2d3a4a, accentColor: 0x4b6cb7,
    isSupport: false,
    description: 'Modern assault rifle. Balanced fire rate and damage.',
    environment: 'rainy_stormy',
  },

  // Level 27 reward
  shield_operator: {
    id: 'shield_operator', name: 'Shield Operator',
    era: 'modern', role: 'defense', cardSlot: 'adv_27',
    hp: 250, weapon: null, damage: 0, attackSpeed: 0, range: 0,
    cost: 175, unlockLevel: 27, isBossReward: false,
    color: 0x1d4ed8, accentColor: 0x93c5fd,
    isSupport: true,
    description: 'Deploys energy shield. Protects adjacent units from projectiles.',
    environment: 'rainy_stormy',
    specialAbility: 'energy_shield',
  },

  // Level 28 reward
  combat_medic: {
    id: 'combat_medic', name: 'Combat Medic',
    era: 'modern', role: 'medic', cardSlot: 'adv_28',
    hp: 130, weapon: 'service_pistol', damage: 15, attackSpeed: 1600, range: 200,
    cost: 150, unlockLevel: 28, isBossReward: false,
    color: 0xdcfce7, accentColor: 0xffffff,
    isSupport: true,
    description: 'Can fight and heal. Versatile support/offense hybrid.',
    environment: 'rainy_stormy',
    specialAbility: 'heal_nearby',
  },

  // Level 29 reward
  drone_operator: {
    id: 'drone_operator', name: 'Drone Operator',
    era: 'modern', role: 'aerial', cardSlot: 'adv_29',
    hp: 100, weapon: null, damage: 40, attackSpeed: 2000, range: 500,
    cost: 200, unlockLevel: 29, isBossReward: false,
    color: 0x374151, accentColor: 0x93c5fd,
    isSupport: false,
    description: 'Deploys armed drone. Attacks from above. Bypasses ground defenses.',
    environment: 'rainy_stormy',
    specialAbility: 'deploy_drone',
  },

  // Level 30 reward (digital briefing milestone)
  rocket_specialist: {
    id: 'rocket_specialist', name: 'Rocket Specialist',
    era: 'modern', role: 'heavy', cardSlot: 'adv_30',
    hp: 175, weapon: 'rocket_launcher', damage: 140, attackSpeed: 5000, range: 480,
    cost: 225, unlockLevel: 30, isBossReward: false,
    color: 0x374151, accentColor: 0xef4444,
    isSupport: false,
    description: 'Rocket launcher. Massive explosion. Destroys armored aliens.',
    environment: 'rainy_stormy',
  },

  // Level 31 reward
  mobile_generator: {
    id: 'mobile_generator', name: 'Mobile Generator',
    era: 'modern', role: 'energy', cardSlot: 'adv_31',
    hp: 140, weapon: null, damage: 0, attackSpeed: 0, range: 0,
    cost: 100, unlockLevel: 31, isBossReward: false,
    color: 0xfbbf24, accentColor: 0xf59e0b,
    isSupport: true, genInterval: 10000, genAmount: 30,
    description: 'Faster plasma generation. Better than basic generator.',
    environment: 'rainy_stormy',
    specialAbility: 'generate_plasma',
  },

  // Level 32 reward
  plasma_tech_engineer: {
    id: 'plasma_tech_engineer', name: 'Plasma Tech',
    era: 'advanced', role: 'engineer', cardSlot: 'adv_32',
    hp: 120, weapon: null, damage: 0, attackSpeed: 0, range: 0,
    cost: 150, unlockLevel: 32, isBossReward: false,
    color: 0x7c3aed, accentColor: 0xc4b5fd,
    isSupport: true,
    description: 'Plasma technology specialist. Boosts energy generation.',
    environment: 'rainy_stormy',
    specialAbility: 'boost_regen',
  },

  // Level 33 reward
  grenadier: {
    id: 'grenadier', name: 'Grenadier',
    era: 'modern', role: 'offense', cardSlot: 'adv_33',
    hp: 170, weapon: 'grenade_launcher', damage: 80, attackSpeed: 3000, range: 380,
    cost: 175, unlockLevel: 33, isBossReward: false,
    color: 0x4d6b2a, accentColor: 0x84cc16,
    isSupport: false,
    description: 'Grenade launcher. Splash damage effective against groups.',
    environment: 'rainy_stormy',
  },

  // Level 34 reward
  hazmat_trooper: {
    id: 'hazmat_trooper', name: 'Hazmat Trooper',
    era: 'advanced', role: 'offense', cardSlot: 'adv_34',
    hp: 160, weapon: 'plasma_rifle', damage: 55, attackSpeed: 1400, range: 360,
    cost: 200, unlockLevel: 34, isBossReward: false,
    color: 0xfde68a, accentColor: 0xfbbf24,
    helmetColor: 0xca8a04, skinColor: 0xfbbf24,
    isSupport: false,
    description: 'Radiation-resistant trooper. Effective in radioactive environments.',
    environment: 'radioactive',
  },

  // Level 35 reward (Creator Bitos event level)
  radiation_specialist: {
    id: 'radiation_specialist', name: 'Rad. Specialist',
    era: 'advanced', role: 'support', cardSlot: 'adv_35',
    hp: 100, weapon: null, damage: 0, attackSpeed: 0, range: 0,
    cost: 125, unlockLevel: 35, isBossReward: false,
    color: 0x65a30d, accentColor: 0xd9f99d,
    isSupport: true,
    description: 'Neutralizes radioactive hazards. Protects nearby units from rad damage.',
    environment: 'radioactive',
    specialAbility: 'neutralize_radiation',
  },

  // Level 36 reward
  plasma_soldier: {
    id: 'plasma_soldier', name: 'Plasma Trooper',
    era: 'advanced', role: 'offense', cardSlot: 'adv_36',
    hp: 180, weapon: 'plasma_rifle', damage: 60, attackSpeed: 1200, range: 420,
    cost: 225, unlockLevel: 36, isBossReward: false,
    color: 0x7c3aed, accentColor: 0xc4b5fd,
    helmetColor: 0x4c1d95, skinColor: 0xfbbf24,
    isSupport: false,
    description: 'Plasma rifle specialist. Effective against armored aliens.',
    environment: 'radioactive',
  },

  // Level 37 reward
  energy_shield_generator: {
    id: 'energy_shield_generator', name: 'Shield Generator',
    era: 'advanced', role: 'defense', cardSlot: 'adv_37',
    hp: 160, weapon: null, damage: 0, attackSpeed: 0, range: 0,
    cost: 200, unlockLevel: 37, isBossReward: false,
    color: 0x1d4ed8, accentColor: 0x67e8f9,
    isSupport: true,
    description: 'Deploys large energy shield protecting an entire lane section.',
    environment: 'radioactive',
    specialAbility: 'large_shield',
  },

  // Level 38 reward
  combat_drone: {
    id: 'combat_drone', name: 'Combat Drone',
    era: 'futuristic', role: 'aerial', cardSlot: 'adv_38',
    hp: 80, weapon: 'laser_weapon', damage: 70, attackSpeed: 900, range: 460,
    cost: 250, unlockLevel: 38, isBossReward: false,
    color: 0x0891b2, accentColor: 0x67e8f9,
    isSupport: false,
    description: 'Autonomous laser drone. Rapid-fire aerial attacker.',
    environment: 'radioactive',
  },

  // Level 39 reward
  autonomous_robot: {
    id: 'autonomous_robot', name: 'Auto Robot',
    era: 'futuristic', role: 'offense', cardSlot: 'adv_39',
    hp: 220, weapon: 'machine_gun', damage: 30, attackSpeed: 700, range: 340,
    cost: 250, unlockLevel: 39, isBossReward: false,
    color: 0x374151, accentColor: 0x67e8f9,
    isSupport: false,
    description: 'Self-operating combat robot. No morale issues.',
    environment: 'radioactive',
  },

  // Level 40 reward (digital briefing milestone)
  plasma_mech: {
    id: 'plasma_mech', name: 'Plasma Mech',
    era: 'futuristic', role: 'heavy', cardSlot: 'adv_40',
    hp: 400, weapon: 'plasma_rifle', damage: 90, attackSpeed: 1400, range: 380,
    cost: 300, unlockLevel: 40, isBossReward: false,
    color: 0x7c3aed, accentColor: 0xe879f9,
    isSupport: false,
    description: 'Plasma-powered combat mech. Heavy armor and firepower.',
    environment: 'radioactive',
  },

  // Level 41 reward
  laser_specialist: {
    id: 'laser_specialist', name: 'Laser Specialist',
    era: 'futuristic', role: 'offense', cardSlot: 'adv_41',
    hp: 160, weapon: 'laser_weapon', damage: 90, attackSpeed: 1000, range: 480,
    cost: 275, unlockLevel: 41, isBossReward: false,
    color: 0x0891b2, accentColor: 0x67e8f9,
    helmetColor: 0x0e7490, skinColor: 0xfbbf24,
    isSupport: false,
    description: 'Laser carbine. Piercing shots. Futuristic precision.',
    environment: 'radioactive',
  },

  // Level 42 reward
  energy_specialist: {
    id: 'energy_specialist', name: 'Energy Specialist',
    era: 'advanced', role: 'energy', cardSlot: 'adv_42',
    hp: 110, weapon: null, damage: 0, attackSpeed: 0, range: 0,
    cost: 175, unlockLevel: 42, isBossReward: false,
    color: 0xfef08a, accentColor: 0xfbbf24,
    isSupport: true, genInterval: 8000, genAmount: 35,
    description: 'Expert energy management. Fastest plasma generation unit.',
    environment: 'radioactive',
    specialAbility: 'boost_regen',
  },

  // Level 43 reward
  heavy_plasma_trooper: {
    id: 'heavy_plasma_trooper', name: 'Heavy Plasma',
    era: 'futuristic', role: 'heavy', cardSlot: 'adv_43',
    hp: 260, weapon: 'plasma_rifle', damage: 80, attackSpeed: 1100, range: 440,
    cost: 325, unlockLevel: 43, isBossReward: false,
    color: 0x4c1d95, accentColor: 0xe879f9,
    isSupport: false,
    description: 'Heavy armor + plasma rifle. Extremely resilient.',
    environment: 'radioactive',
  },

  // Level 44 reward
  support_specialist: {
    id: 'support_specialist', name: 'Support Spec.',
    era: 'futuristic', role: 'support', cardSlot: 'adv_44',
    hp: 120, weapon: null, damage: 0, attackSpeed: 0, range: 0,
    cost: 175, unlockLevel: 44, isBossReward: false,
    color: 0x0891b2, accentColor: 0x67e8f9,
    isSupport: true,
    description: 'Advanced tactical support. Multi-role buffs for entire lane.',
    environment: 'radioactive',
    specialAbility: 'multi_buff',
  },

  // Level 45 reward (Creator Bitos event level)
  experimental_soldier: {
    id: 'experimental_soldier', name: 'Experimental',
    era: 'futuristic', role: 'offense', cardSlot: 'adv_45',
    hp: 200, weapon: 'laser_weapon', damage: 110, attackSpeed: 1200, range: 500,
    cost: 350, unlockLevel: 45, isBossReward: false,
    color: 0x0f172a, accentColor: 0x818cf8,
    isSupport: false,
    description: 'Experimental weapons technology. Highly effective against all classes.',
    environment: 'radioactive',
  },

  // Level 46 reward
  advanced_combatant: {
    id: 'advanced_combatant', name: 'Advanced Fighter',
    era: 'futuristic', role: 'offense', cardSlot: 'adv_46',
    hp: 230, weapon: 'plasma_rifle', damage: 100, attackSpeed: 1100, range: 460,
    cost: 325, unlockLevel: 46, isBossReward: false,
    color: 0x1e1b4b, accentColor: 0x818cf8,
    isSupport: false,
    description: 'Elite advanced combatant. Full combat specialization.',
    environment: 'radioactive',
  },

  // Level 47 reward
  repair_technician: {
    id: 'repair_technician', name: 'Repair Tech',
    era: 'futuristic', role: 'engineer', cardSlot: 'adv_47',
    hp: 130, weapon: null, damage: 0, attackSpeed: 0, range: 0,
    cost: 175, unlockLevel: 47, isBossReward: false,
    color: 0xfbbf24, accentColor: 0xf59e0b,
    isSupport: true,
    description: 'Rapid field repair. Instantly restores significant HP to any unit.',
    environment: 'radioactive',
    specialAbility: 'rapid_repair',
  },

  // Level 48 reward
  ammo_specialist: {
    id: 'ammo_specialist', name: 'Ammo Specialist',
    era: 'futuristic', role: 'support', cardSlot: 'adv_48',
    hp: 105, weapon: null, damage: 0, attackSpeed: 0, range: 0,
    cost: 150, unlockLevel: 48, isBossReward: false,
    color: 0x92400e, accentColor: 0xfbbf24,
    isSupport: true,
    description: 'Resupplies ammunition. Boosts attack speed of adjacent units.',
    environment: 'radioactive',
    specialAbility: 'ammo_boost',
  },

  // Level 49 reward
  plasma_shield_unit: {
    id: 'plasma_shield_unit', name: 'Plasma Shield',
    era: 'futuristic', role: 'defense', cardSlot: 'adv_49',
    hp: 300, weapon: null, damage: 0, attackSpeed: 0, range: 0,
    cost: 250, unlockLevel: 49, isBossReward: false,
    color: 0x7c3aed, accentColor: 0xe879f9,
    isSupport: true,
    description: 'Deploys massive plasma barrier. Absorbs alien attacks for the entire team.',
    environment: 'radioactive',
    specialAbility: 'plasma_barrier',
  },

  // ═══ FINAL BOSS REWARD — Level 50 (1) ═══════════════════════
  plasma_cannon_warrior: {
    id: 'plasma_cannon_warrior', name: 'Plasma Cannon',
    era: 'futuristic_22c', role: 'heavy', cardSlot: 'boss_50',
    hp: 200, weapon: 'plasma_cannon', damage: 200, attackSpeed: 2500, range: 560,
    cost: 400, unlockLevel: 50, isBossReward: true,
    color: 0x1a0050, accentColor: 0xe879f9,
    helmetColor: 0x4c1d95, skinColor: 0xfbbf24,
    isSupport: false,
    description: '22nd-century plasma cannon soldier. The ultimate military card. Unlocked by defeating the Vex Overlord.',
    environment: 'all',
    specialAbility: 'plasma_cannon_barrage',
    claimText: 'FINAL MILITARY TECHNOLOGY DETECTED',
    claimPrompt: 'CLICK TO REVEAL',
  },
};

// ─── CARD COUNT VALIDATION ────────────────────────────────────────────────────
(function validateCardCount() {
  const all = Object.values(GW.CARDS);
  const starting  = all.filter(c => c.unlockLevel === 'start').length;
  const adventure = all.filter(c => typeof c.unlockLevel === 'number' && !c.isBossReward).length;
  const boss      = all.filter(c => c.isBossReward).length;
  const total     = all.length;
  if (total !== 52 || starting !== 2 || adventure !== 49 || boss !== 1) {
    console.error('[GW] CARD COUNT VALIDATION FAILED:', { total, starting, adventure, boss });
  } else {
    console.log('[GW] Card count validated: 2 starting + 49 adventure + 1 boss = 52 total.');
  }
})();

// ─── Alias: GW.CHARACTERS points to GW.CARDS for game system compatibility ───
// The game engine uses GW.CHARACTERS; cards extend this.
Object.defineProperty(GW, 'CHARACTERS', {
  get() { return GW.CARDS; },
  configurable: true,
});

// ─── Alien Enemy Definitions ──────────────────────────────────────────────────
GW.ENEMIES = {
  // LEVEL 1: Common Alien (flag variant also defined)
  vex_drone: {
    id: 'vex_drone', name: 'Vex Drone', class: 'basic', tier: 1,
    hp: 100, speed: 12, damage: 10, attackCooldown: 2200, reward: 10,
    color: 0x7c3aed, accentColor: 0xc4b5fd, eyeColor: 0x00ff88,
    description: 'Common alien. Slow walking speed. 100 HP baseline.',
    specialAbility: null, introducedLevel: 1,
    equipment: 'bare',   // default equipment variant
  },
  // FLAG variant — appears in Wave 1 of Level 1-1 (2x speed)
  vex_flag_bearer: {
    id: 'vex_flag_bearer', name: 'Flag Bearer', class: 'fast', tier: 1,
    hp: 100, speed: 18, damage: 10, attackCooldown: 2200, reward: 30,
    color: 0xe879f9, accentColor: 0xfbbf24, eyeColor: 0xfbbf24,
    description: 'Carries invasion flag. 1.5× baseline speed. Leads the horde charge.',
    specialAbility: 'flag_rush', introducedLevel: 1, isFlag: true,
  },
  vex_runner: {
    id: 'vex_runner', name: 'Vex Runner', class: 'fast', tier: 2,
    hp: 40, speed: 30, damage: 8, attackCooldown: 1800, reward: 25,
    color: 0xf59e0b, accentColor: 0xfef3c7, eyeColor: 0xff6b00,
    description: 'Fast alien. Low health, rapid movement.',
    specialAbility: 'sprint', introducedLevel: 4,
  },
  vex_bruiser: {
    id: 'vex_bruiser', name: 'Vex Bruiser', class: 'armored', tier: 3,
    hp: 280, speed: 18, damage: 20, attackCooldown: 2000, reward: 50,
    color: 0x374151, accentColor: 0x6b7280, eyeColor: 0xff4444,
    description: 'Heavily armored. Slow but very durable.',
    specialAbility: 'armor', introducedLevel: 7,
  },
  vex_leaper: {
    id: 'vex_leaper', name: 'Vex Leaper', class: 'jumping', tier: 3,
    hp: 70, speed: 36, damage: 12, attackCooldown: 2000, reward: 40,
    color: 0x16a34a, accentColor: 0x86efac, eyeColor: 0x00ffcc,
    description: 'Can leap over one defender.',
    specialAbility: 'leap', introducedLevel: 9,
  },
  vex_sniper: {
    id: 'vex_sniper', name: 'Vex Sniper', class: 'ranged', tier: 4,
    hp: 60, speed: 14, damage: 25, attackCooldown: 3000, reward: 60,
    color: 0x1e293b, accentColor: 0x94a3b8, eyeColor: 0x00ccff,
    description: 'Fires at defenders from long range.',
    specialAbility: 'long_range_attack', introducedLevel: 12,
  },
  vex_warden: {
    id: 'vex_warden', name: 'Vex Warden', class: 'shield', tier: 4,
    hp: 120, speed: 24, damage: 15, attackCooldown: 2200, reward: 70,
    color: 0x0369a1, accentColor: 0x7dd3fc, eyeColor: 0x00ffff,
    description: 'Shields block incoming projectiles.',
    specialAbility: 'shield', introducedLevel: 15,
  },
  vex_stalker: {
    id: 'vex_stalker', name: 'Vex Stalker', class: 'stealth', tier: 5,
    hp: 90, speed: 20, damage: 18, attackCooldown: 1800, reward: 80,
    color: 0x1c1917, accentColor: 0x57534e, eyeColor: 0xff00aa,
    description: 'Becomes semi-transparent.',
    specialAbility: 'stealth', introducedLevel: 18,
  },
  vex_healer: {
    id: 'vex_healer', name: 'Vex Healer', class: 'support', tier: 4,
    hp: 70, speed: 14, damage: 8, attackCooldown: 3000, reward: 65,
    color: 0x15803d, accentColor: 0x86efac, eyeColor: 0x00ff66,
    description: 'Heals nearby alien units.',
    specialAbility: 'heal_nearby', introducedLevel: 20,
  },
  vex_colossus: {
    id: 'vex_colossus', name: 'Vex Colossus', class: 'brute', tier: 5,
    hp: 600, speed: 12, damage: 35, attackCooldown: 1600, reward: 150,
    color: 0x7f1d1d, accentColor: 0xef4444, eyeColor: 0xff0000,
    description: 'Massive alien brute. Enormous health pool.',
    specialAbility: 'stomp', introducedLevel: 25,
  },
  vex_elite: {
    id: 'vex_elite', name: 'Vex Elite', class: 'elite', tier: 5,
    hp: 200, speed: 34, damage: 28, attackCooldown: 1500, reward: 120,
    color: 0x581c87, accentColor: 0xe879f9, eyeColor: 0xff00ff,
    description: 'Elite commander unit. Fast and dangerous.',
    specialAbility: 'elite_charge', introducedLevel: 35,
  },
  vex_overlord: {
    id:            'vex_overlord',
    name:          'Vex Overlord',
    class:         'boss',
    tier:          6,
    hp:            100000,
    speed:         6,
    damage:        50,
    attackCooldown:1200,
    reward:        500,
    color:         0x0f172a,
    accentColor:   0x818cf8,
    eyeColor:      0x6366f1,
    description:   'Final alien boss. Multiple phases. Summons reinforcements. 100,000+ HP.',
    specialAbility: 'boss_phase',
    introducedLevel: 50,
    isBoss:        true,
    phases:        [
      { hpThreshold: 0.75, name: 'Phase 1', speedBonus: 0 },
      { hpThreshold: 0.50, name: 'Phase 2', speedBonus: 2 },
      { hpThreshold: 0.25, name: 'Phase 3', speedBonus: 4, summons: true },
    ],
  },
};
// ─── Extended Alien Variety ────────────────────────────────────────────────────
// Architecture for future alien classes. Speed values are multiples of the
// 12px/s baseline (vex_drone). Not all may be implemented in combat yet —
// this registers them so wave generator and future scenes can reference them.
GW.ENEMY_CATEGORIES = {

  // ── UNCOMMON (faster than common, introduced in mid-game) ─────────────────
  vex_agile: {
    id: 'vex_agile', name: 'Vex Agile', class: 'uncommon', tier: 2,
    hp: 60, speed: 24, damage: 8, attackCooldown: 1800, reward: 20,
    color: 0x34d399, accentColor: 0x6ee7b7, eyeColor: 0x00ffcc,
    description: 'Quick, lightweight alien. 2× baseline speed. Low HP.',
    specialAbility: null, introducedLevel: 5,
  },
  vex_raider: {
    id: 'vex_raider', name: 'Vex Raider', class: 'uncommon', tier: 2,
    hp: 80, speed: 28, damage: 12, attackCooldown: 1600, reward: 30,
    color: 0xf97316, accentColor: 0xfed7aa, eyeColor: 0xff6b00,
    description: 'Aggressive uncommon. 2.3× speed, moderate HP.',
    specialAbility: 'charge', introducedLevel: 6,
  },

  // ── ADVANCED MOBILE (vehicle/hover-based) ────────────────────────────────
  vex_tiny_ship: {
    id: 'vex_tiny_ship', name: 'Floating Tiny Ship', class: 'aerial', tier: 4,
    hp: 80, speed: 24, damage: 12, attackCooldown: 2000, reward: 55,
    color: 0x818cf8, accentColor: 0xc7d2fe, eyeColor: 0x6366f1,
    description: 'Flies over ground-level obstacles. 2× speed. Medium HP.',
    specialAbility: 'hover', introducedLevel: 22,
    isAerial: true,
  },
  vex_hover_bike: {
    id: 'vex_hover_bike', name: 'Hover Bike Alien', class: 'vehicle', tier: 4,
    hp: 90, speed: 30, damage: 15, attackCooldown: 1800, reward: 65,
    color: 0x6366f1, accentColor: 0xa5b4fc, eyeColor: 0x818cf8,
    description: 'Mounted on hover bike. 2.5× speed. Bypasses ground traps.',
    specialAbility: 'hover_speed', introducedLevel: 24,
    isVehicle: true,
  },
  vex_vehicle_rider: {
    id: 'vex_vehicle_rider', name: 'Vehicle Rider', class: 'vehicle', tier: 5,
    hp: 200, speed: 30, damage: 22, attackCooldown: 1600, reward: 80,
    color: 0x475569, accentColor: 0x94a3b8, eyeColor: 0x60a5fa,
    description: 'Heavy alien vehicle. 2.5× speed, high HP.',
    specialAbility: 'ram', introducedLevel: 28,
    isVehicle: true,
  },
  vex_jetpack: {
    id: 'vex_jetpack', name: 'Jetpack Alien', class: 'aerial', tier: 5,
    hp: 70, speed: 36, damage: 18, attackCooldown: 1800, reward: 90,
    color: 0xef4444, accentColor: 0xfca5a5, eyeColor: 0xff0000,
    description: 'Jetpack propulsion. 3× speed, can jump over one defender.',
    specialAbility: 'jetpack_leap', introducedLevel: 30,
    isAerial: true,
  },
  vex_hover_alien: {
    id: 'vex_hover_alien', name: 'Hover Alien', class: 'aerial', tier: 4,
    hp: 110, speed: 22, damage: 14, attackCooldown: 2000, reward: 60,
    color: 0x7c3aed, accentColor: 0xc4b5fd, eyeColor: 0xe879f9,
    description: 'Levitates above ground. Immune to lane hazards. 1.8× speed.',
    specialAbility: 'hover', introducedLevel: 20,
    isAerial: true,
  },

  // ── SPECIAL / ABILITY-BASED ───────────────────────────────────────────────
  vex_burrower: {
    id: 'vex_burrower', name: 'Burrower Alien', class: 'special', tier: 5,
    hp: 120, speed: 16, damage: 20, attackCooldown: 2400, reward: 95,
    color: 0x92400e, accentColor: 0xd97706, eyeColor: 0xff6b00,
    description: 'Digs underground to bypass defenders. Slow on surface.',
    specialAbility: 'burrow', introducedLevel: 26,
  },
  vex_teleporter: {
    id: 'vex_teleporter', name: 'Teleporter Alien', class: 'special', tier: 5,
    hp: 80, speed: 14, damage: 16, attackCooldown: 2000, reward: 100,
    color: 0x7c3aed, accentColor: 0xa78bfa, eyeColor: 0xffffff,
    description: 'Teleports forward periodically. Unpredictable movement.',
    specialAbility: 'teleport', introducedLevel: 32,
  },
  vex_phantom: {
    id: 'vex_phantom', name: 'Phantom Alien', class: 'special', tier: 5,
    hp: 75, speed: 18, damage: 14, attackCooldown: 2000, reward: 100,
    color: 0x1e1b4b, accentColor: 0x818cf8, eyeColor: 0xa5b4fc,
    description: 'Cloaked alien. Invisible until very close to defenders.',
    specialAbility: 'cloak', introducedLevel: 34,
  },
  vex_medic: {
    id: 'vex_medic', name: 'Medic Alien', class: 'support', tier: 4,
    hp: 80, speed: 12, damage: 8, attackCooldown: 3000, reward: 70,
    color: 0x16a34a, accentColor: 0x86efac, eyeColor: 0x00ff66,
    description: 'Heals nearby alien units. Priority target.',
    specialAbility: 'heal_allies', introducedLevel: 20,
  },
  vex_emp: {
    id: 'vex_emp', name: 'EMP Alien', class: 'special', tier: 5,
    hp: 90, speed: 16, damage: 10, attackCooldown: 4000, reward: 85,
    color: 0xfbbf24, accentColor: 0xfde68a, eyeColor: 0xffff00,
    description: 'Emits EMP pulse that disables nearby defenders temporarily.',
    specialAbility: 'emp_pulse', introducedLevel: 36,
  },
  vex_saboteur: {
    id: 'vex_saboteur', name: 'Saboteur Alien', class: 'special', tier: 5,
    hp: 100, speed: 20, damage: 18, attackCooldown: 2200, reward: 110,
    color: 0x374151, accentColor: 0x9ca3af, eyeColor: 0xff4444,
    description: 'Targets and destroys energy generators specifically.',
    specialAbility: 'sabotage', introducedLevel: 38,
  },
  vex_engineer: {
    id: 'vex_engineer', name: 'Engineer Alien', class: 'support', tier: 4,
    hp: 85, speed: 14, damage: 10, attackCooldown: 2800, reward: 75,
    color: 0xd97706, accentColor: 0xfbbf24, eyeColor: 0xff9500,
    description: 'Builds alien barricades and turrets. Tactical support.',
    specialAbility: 'build_barricade', introducedLevel: 28,
  },
};

// Merge ENEMY_CATEGORIES into GW.ENEMIES for backwards compat
// (Future: EnemyFactory can resolve from both maps)
Object.assign(GW.ENEMIES, GW.ENEMY_CATEGORIES);


// ─── Environment Definitions ──────────────────────────────────────────────────
// SPEC §9: Exact 5 environments with exact level ranges
GW.ENVIRONMENTS = {
  daytime: {
    id: 'daytime', name: 'Daytime', levelRange: [1, 10],
    skyColors: [0x87ceeb, 0xbae6fd],
    groundColor: 0x3d6b1a, laneEven: 0x2d5a1b, laneOdd: 0x26501a,
    grassColor: 0x16a34a, soilColor: 0x7c4a1a,
    ambientLight: 1.0, fogEnabled: false, waterEnabled: false,
    description: 'Clear daytime garden. Historical warfare era.',
    menuAnimType: 'clouds_wind',
    // Keep backward compat alias
    alias: 'day',
  },
  nighttime: {
    id: 'nighttime', name: 'Nighttime', levelRange: [11, 20],
    skyColors: [0x060d1a, 0x0a1a2a],
    groundColor: 0x1a2d0a, laneEven: 0x0d2010, laneOdd: 0x0a1a0d,
    grassColor: 0x0d4a1a, soilColor: 0x3d2008,
    ambientLight: 0.4, fogEnabled: false, waterEnabled: false,
    description: 'Night operations. Specialized military tech required.',
    menuAnimType: 'stars_lights',
    alias: 'night',
  },
  foggy: {
    id: 'foggy', name: 'Foggy', levelRange: [21, 30],
    skyColors: [0x9ca3af, 0xd1d5db],
    groundColor: 0x3d4a2a, laneEven: 0x2d3a1a, laneOdd: 0x263318,
    grassColor: 0x365314, soilColor: 0x4a3a28,
    ambientLight: 0.6, fogEnabled: true, fogDensity: 0.6, visibilityRange: 240,
    description: 'Dense fog. Reconnaissance and trench warfare.',
    menuAnimType: 'fog_layers',
    alias: 'fog',
  },
  rainy_stormy: {
    id: 'rainy_stormy', name: 'Rainy / Stormy', levelRange: [31, 40],
    skyColors: [0x1e3a5f, 0x0f2040],
    groundColor: 0x2d3a1a, laneEven: 0x2d3a4a, laneOdd: 0x263344,
    grassColor: 0x365314, soilColor: 0x3d4a2a,
    ambientLight: 0.7, fogEnabled: false, rainEnabled: true, lightningEnabled: true,
    description: 'Storm conditions. Modern military technology.',
    menuAnimType: 'rain_lightning',
    alias: 'rooftop',
  },
  radioactive: {
    id: 'radioactive', name: 'Radioactive', levelRange: [41, 50],
    skyColors: [0x1a2d0a, 0x0d1a00],
    groundColor: 0x2d4a0a, laneEven: 0x1a3d0a, laneOdd: 0x163308,
    grassColor: 0x65a30d, soilColor: 0x3a4d0a,
    ambientLight: 0.75, fogEnabled: false, radioactive: true,
    description: 'Contaminated zone. Futuristic military technology.',
    menuAnimType: 'radiation_pulse',
    alias: 'radioactive',
  },
  // Extra environments (for mini-games/puzzle/survival)
  winter:    { id: 'winter',    name: 'Winter',    laneEven: 0xdbeafe, laneOdd: 0xbfdbfe, alias: 'winter' },
  spring:    { id: 'spring',    name: 'Spring',    laneEven: 0xfce7f3, laneOdd: 0xfbcfe8, alias: 'spring' },
  summer:    { id: 'summer',    name: 'Summer',    laneEven: 0xfef9c3, laneOdd: 0xfef08a, alias: 'summer' },
  spaceship: { id: 'spaceship', name: 'Spaceship', laneEven: 0x140a24, laneOdd: 0x10081e, alias: 'spaceship' },
};

// ─── Level Definitions ────────────────────────────────────────────────────────
(function _buildLevels() {
  const L = {};

  // Helper: get environment id for level
  function envForLevel(id) {
    if (id <= 10)  return 'daytime';
    if (id <= 20)  return 'nighttime';
    if (id <= 30)  return 'foggy';
    if (id <= 40)  return 'rainy_stormy';
    return 'radioactive';
  }

  // Level 1 — Fully implemented with proper wave structure (spec §38)
  L[1] = {
    id: 1, name: 'First Light', environment: envForLevel(1),
    unlocked: true, completed: false, difficulty: 'easy',
    startingEnergy: 0,
    availableDefenders: ['plasma_energy_generator', 'fire_lance_gunner'],
    availableEnemies:   ['vex_drone', 'vex_flag_bearer'],
    sentinelAvailable:  true,
    reward: { cardId: 'bomber' },  // Level 1 reward: Bomber (common — unlocked by clearing First Light)
    unlockRequirement: null,
    victoryCondition: 'survive_waves',
    defeatCondition:  'enemy_reaches_home',
    creatorBitosEvent:       false,
    digitalBriefingEvent:    false,
    briefing: 'Alien scouts have breached the perimeter. Deploy your Plasma Generator first. Keep your Fire-Lance Gunner ready.',
    waves: [
      // ── Phase 1: 30 individual scouts ──────────────────────────────────────
      // halfHpChain:true — WaveManager will spawn the NEXT scout only when the
      // PREVIOUS one reaches half HP, rather than using fixed delay offsets.
      // Lanes are randomised (not staircase) so aliens appear unpredictably.
      { id: 'scouts', label: 'SCOUTS', halfHpChain: true, enemies: [
        { type: 'vex_drone', lane: 3, delay: 0 },
        { type: 'vex_drone', lane: 1, delay: 0 },
        { type: 'vex_drone', lane: 5, delay: 0 },
        { type: 'vex_drone', lane: 2, delay: 0 },
        { type: 'vex_drone', lane: 4, delay: 0 },
        { type: 'vex_drone', lane: 1, delay: 0 },
        { type: 'vex_drone', lane: 3, delay: 0 },
        { type: 'vex_drone', lane: 5, delay: 0 },
        { type: 'vex_drone', lane: 2, delay: 0 },
        { type: 'vex_drone', lane: 4, delay: 0 },
        { type: 'vex_drone', lane: 3, delay: 0 },
        { type: 'vex_drone', lane: 1, delay: 0 },
        { type: 'vex_drone', lane: 4, delay: 0 },
        { type: 'vex_drone', lane: 2, delay: 0 },
        { type: 'vex_drone', lane: 5, delay: 0 },
        { type: 'vex_drone', lane: 1, delay: 0 },
        { type: 'vex_drone', lane: 3, delay: 0 },
        { type: 'vex_drone', lane: 2, delay: 0 },
        { type: 'vex_drone', lane: 4, delay: 0 },
        { type: 'vex_drone', lane: 5, delay: 0 },
        { type: 'vex_drone', lane: 2, delay: 0 },
        { type: 'vex_drone', lane: 4, delay: 0 },
        { type: 'vex_drone', lane: 1, delay: 0 },
        { type: 'vex_drone', lane: 5, delay: 0 },
        { type: 'vex_drone', lane: 3, delay: 0 },
        { type: 'vex_drone', lane: 2, delay: 0 },
        { type: 'vex_drone', lane: 1, delay: 0 },
        { type: 'vex_drone', lane: 4, delay: 0 },
        { type: 'vex_drone', lane: 5, delay: 0 },
        { type: 'vex_drone', lane: 3, delay: 0 },
      ]},
      // ── Phase 2: The Horde ─────────────────────────────────────────────────
      // hordeDelay:4000 — WaveManager waits 4s after the flag bearer warning
      // before spawning the 20 drones so the player has time to react.
      // Drones are spread across random lanes so they form a visible line,
      // not a staircase. Flag Bearer (1.5× speed) leads from lane 3.
      { id: 'horde', label: 'THE HORDE', isMajorWave: true, isFinalWave: true, hordeDelay: 4000, enemies: [
        { type: 'vex_flag_bearer', lane: 3, delay: 0 },   // leads — 1.5× speed, pinkish
        { type: 'vex_drone', lane: 1, delay: 0 },
        { type: 'vex_drone', lane: 2, delay: 0 },
        { type: 'vex_drone', lane: 4, delay: 0 },
        { type: 'vex_drone', lane: 5, delay: 0 },
        { type: 'vex_drone', lane: 3, delay: 0 },
        { type: 'vex_drone', lane: 1, delay: 0 },
        { type: 'vex_drone', lane: 2, delay: 0 },
        { type: 'vex_drone', lane: 5, delay: 0 },
        { type: 'vex_drone', lane: 4, delay: 0 },
        { type: 'vex_drone', lane: 3, delay: 0 },
        { type: 'vex_drone', lane: 1, delay: 0 },
        { type: 'vex_drone', lane: 2, delay: 0 },
        { type: 'vex_drone', lane: 5, delay: 0 },
        { type: 'vex_drone', lane: 4, delay: 0 },
        { type: 'vex_drone', lane: 3, delay: 0 },
        { type: 'vex_drone', lane: 1, delay: 0 },
        { type: 'vex_drone', lane: 2, delay: 0 },
        { type: 'vex_drone', lane: 5, delay: 0 },
        { type: 'vex_drone', lane: 4, delay: 0 },
        { type: 'vex_drone', lane: 3, delay: 0 },
      ]},
    ],
  };

  // Levels 2-50: stubs with reward schedule
  const levelData = [
    // Daytime (2-10)
    { id:2,  name:'Morning Patrol',      env:'daytime',     diff:'easy',   cardId:'hand_cannon_soldier' },
    { id:3,  name:'Garden Perimeter',    env:'daytime',     diff:'easy',   cardId:'arquebus_soldier' },
    { id:4,  name:'Fast Approach',       env:'daytime',     diff:'easy',   cardId:'pikeman' },
    { id:5,  name:'Backyard Rush',       env:'daytime',     diff:'medium', cardId:'drummer_boy',        creatorBitos:true },
    { id:6,  name:'The Fence Line',      env:'daytime',     diff:'medium', cardId:'field_cannon' },
    { id:7,  name:'Armored Vanguard',    env:'daytime',     diff:'medium', cardId:'supply_officer' },
    { id:8,  name:'Greenhouse Stand',    env:'daytime',     diff:'medium', cardId:'sharpshooter' },
    { id:9,  name:'Leaper Assault',      env:'daytime',     diff:'hard',   cardId:'field_medic_early' },
    { id:10, name:'Day Garden Finale',   env:'daytime',     diff:'hard',   cardId:'machine_gunner',     digitalBriefing:true },
    // Nighttime (11-20)
    { id:11, name:'Darkness Falls',      env:'nighttime',   diff:'medium', cardId:'night_rifleman' },
    { id:12, name:'Shadow Scouts',       env:'nighttime',   diff:'medium', cardId:'scout' },
    { id:13, name:'Night Patrol',        env:'nighttime',   diff:'medium', cardId:'flare_operator' },
    { id:14, name:'Ambush at Dusk',      env:'nighttime',   diff:'hard',   cardId:'trench_soldier' },
    { id:15, name:'Shield Wall Night',   env:'nighttime',   diff:'hard',   cardId:'searchlight_operator', creatorBitos:true },
    { id:16, name:'Midnight Siege',      env:'nighttime',   diff:'hard',   cardId:'radio_operator' },
    { id:17, name:'Signal Disruption',   env:'nighttime',   diff:'hard',   cardId:'armored_soldier' },
    { id:18, name:'Night Stalkers',      env:'nighttime',   diff:'hard',   cardId:'night_medic' },
    { id:19, name:'Infiltration',        env:'nighttime',   diff:'expert', cardId:'sniper' },
    { id:20, name:'Night Finale',        env:'nighttime',   diff:'expert', cardId:'recon_unit',          digitalBriefing:true },
    // Foggy (21-30)
    { id:21, name:'Rising Waters',       env:'foggy',       diff:'medium', cardId:'gas_mask_soldier' },
    { id:22, name:'Submerged Path',      env:'foggy',       diff:'medium', cardId:'mortar_team' },
    { id:23, name:'Aquatic Assault',     env:'foggy',       diff:'hard',   cardId:'field_mechanic' },
    { id:24, name:'Bog Defense',         env:'foggy',       diff:'hard',   cardId:'heavy_rifleman' },
    { id:25, name:'Colossus Emergence',  env:'foggy',       diff:'hard',   cardId:'forward_observer',    creatorBitos:true },
    { id:26, name:'Flood Surge',         env:'foggy',       diff:'hard',   cardId:'modern_rifleman' },
    { id:27, name:'Waterlogged',         env:'foggy',       diff:'expert', cardId:'shield_operator' },
    { id:28, name:'Delta Breach',        env:'foggy',       diff:'expert', cardId:'combat_medic' },
    { id:29, name:'Tide of Aliens',      env:'foggy',       diff:'expert', cardId:'drone_operator' },
    { id:30, name:'Foggy Finale',        env:'foggy',       diff:'expert', cardId:'rocket_specialist',   digitalBriefing:true },
    // Rainy-Stormy (31-40)
    { id:31, name:'Storm Warning',       env:'rainy_stormy',diff:'hard',   cardId:'mobile_generator' },
    { id:32, name:'Lightning Assault',   env:'rainy_stormy',diff:'hard',   cardId:'plasma_tech_engineer' },
    { id:33, name:'Thunder Line',        env:'rainy_stormy',diff:'expert', cardId:'grenadier' },
    { id:34, name:'Tempest Defense',     env:'rainy_stormy',diff:'expert', cardId:'hazmat_trooper' },
    { id:35, name:'Eye of the Storm',    env:'rainy_stormy',diff:'expert', cardId:'radiation_specialist', creatorBitos:true },
    { id:36, name:'Storm Surge',         env:'rainy_stormy',diff:'expert', cardId:'plasma_soldier' },
    { id:37, name:'Hurricane Breach',    env:'rainy_stormy',diff:'expert', cardId:'energy_shield_generator' },
    { id:38, name:'Cyclone Defense',     env:'rainy_stormy',diff:'expert', cardId:'combat_drone' },
    { id:39, name:'Typhoon Protocol',    env:'rainy_stormy',diff:'expert', cardId:'autonomous_robot' },
    { id:40, name:'Storm Finale',        env:'rainy_stormy',diff:'expert', cardId:'plasma_mech',          digitalBriefing:true },
    // Radioactive (41-50)
    { id:41, name:'Contaminated Garden', env:'radioactive', diff:'expert', cardId:'laser_specialist' },
    { id:42, name:'Mutant Swarm',        env:'radioactive', diff:'expert', cardId:'energy_specialist' },
    { id:43, name:'Toxic Advance',       env:'radioactive', diff:'expert', cardId:'heavy_plasma_trooper' },
    { id:44, name:'Irradiated Zone',     env:'radioactive', diff:'expert', cardId:'support_specialist' },
    { id:45, name:'Mutation Protocol',   env:'radioactive', diff:'expert', cardId:'experimental_soldier',  creatorBitos:true },
    { id:46, name:'Aboard the Vessel',   env:'radioactive', diff:'expert', cardId:'advanced_combatant' },
    { id:47, name:'Bio-Dome Breach',     env:'radioactive', diff:'expert', cardId:'repair_technician' },
    { id:48, name:'Command Sector',      env:'radioactive', diff:'expert', cardId:'ammo_specialist' },
    { id:49, name:'Overlord Approach',   env:'radioactive', diff:'expert', cardId:'plasma_shield_unit' },
    { id:50, name:'FINAL MISSION',       env:'radioactive', diff:'expert', cardId:'plasma_cannon_warrior', isBossLevel:true, digitalBriefing:true },
  ];

  levelData.forEach(d => {
    L[d.id] = {
      id: d.id,
      name: d.name,
      environment: d.env,
      unlocked: false,
      completed: false,
      difficulty: d.diff,
      startingEnergy: 0,
      availableDefenders: ['plasma_energy_generator', 'fire_lance_gunner'],
      availableEnemies:   ['vex_drone'],
      sentinelAvailable:  true,
      reward: { cardId: d.cardId },
      unlockRequirement: { level: d.id - 1, completed: true },
      victoryCondition:  'survive_waves',
      defeatCondition:   'enemy_reaches_home',
      creatorBitosEvent:    !!d.creatorBitos,
      digitalBriefingEvent: !!d.digitalBriefing,
      isBossLevel:          !!d.isBossLevel,
      briefing: `Level ${d.id}: ${d.name}`,
      waves: [],
    };
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  PROCEDURAL WAVE GENERATOR
  //  Generates wave[] data for levels 2-50, survival, endless, puzzle,
  //  mini-games.
  //
  //  TIMING RULES (from spec):
  //  ─ Pre-wave / scout phase:  12–20s between individual alien spawns
  //  ─ Assault wave:            15–30 aliens total, each 4–6s apart
  //    (so never simultaneous — still staggered, feels like a surge)
  //  ─ Between waves:           GW.WAVES.BETWEEN_WAVE_DELAY (12s)
  //
  //  ALIEN TYPE PROGRESSION by level tier:
  //  ─ Easy     (L2–10):  bare, cap
  //  ─ Medium   (L11–20): bare, cap, iron_mask, steel_helmet
  //  ─ Hard     (L21–30): steel_helmet, armored_vest, shield
  //  ─ Expert   (L31–40): heavy_helmet, full_armor, riot_shield
  //  ─ Extreme  (L41–50): riot_shield, tactical_armor + specials
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Returns an equipment tier pool for a given level id.
   * Pool is an array of equipment ids with their spawn weights.
   */
  function equipPoolForLevel(levelId) {
    if (levelId <= 5)  return [['bare',4],['cap',1]];
    if (levelId <= 10) return [['bare',3],['cap',2]];
    if (levelId <= 13) return [['bare',2],['cap',2],['iron_mask',1]];
    if (levelId <= 16) return [['bare',1],['cap',2],['iron_mask',2],['steel_helmet',1]];
    if (levelId <= 20) return [['cap',1],['iron_mask',2],['steel_helmet',2],['armored_vest',1]];
    if (levelId <= 24) return [['iron_mask',2],['steel_helmet',2],['armored_vest',2],['shield',1]];
    if (levelId <= 28) return [['steel_helmet',1],['armored_vest',2],['shield',2],['heavy_helmet',1]];
    if (levelId <= 32) return [['armored_vest',1],['shield',2],['heavy_helmet',2],['full_armor',1]];
    if (levelId <= 36) return [['shield',1],['heavy_helmet',2],['full_armor',2],['riot_shield',1]];
    if (levelId <= 40) return [['heavy_helmet',1],['full_armor',2],['riot_shield',2],['tactical_armor',1]];
    if (levelId <= 44) return [['full_armor',1],['riot_shield',2],['tactical_armor',3]];
    if (levelId <= 48) return [['riot_shield',2],['tactical_armor',4]];
    return [['tactical_armor',1]]; // L49-50 — pure tactical
  }

  /** Pick a random equipment id from a weighted pool. Uses a simple seeded index. */
  function pickEquip(pool, seed) {
    const total = pool.reduce((s, e) => s + e[1], 0);
    let r = ((seed * 1013904223 + 1664525) % 2147483648) / 2147483648 * total;
    for (var pi = 0; pi < pool.length; pi++) {
      r -= pool[pi][1];
      if (r <= 0) return pool[pi][0];
    }
    return pool[pool.length-1][0];
  }

  /**
   * Pick a pseudo-random lane from 1-5 using a simple hash.
   *
   * BUG FIX: The original LCG used multiplier 1664525 which is evenly
   * divisible by 5, so (seed * 1664525) % 5 === 0 for every seed — meaning
   * every alien spawned in the same lane (lane 4).
   *
   * Fix: use a multiplier that is NOT a multiple of 5, combined with a
   * bit-mixing step to ensure good distribution across all lanes.
   */
  function pickLane(seed) {
    // Mix the seed with a multiplier coprime to 5 and a large prime addend
    var h = Math.imul(seed + 1, 2654435761);  // Knuth multiplicative hash (coprime to 2^32)
    h = h ^ (h >>> 16);
    return (Math.abs(h) % 5) + 1;
  }

  /**
   * Scout delay: cumulative ms from wave start.
   * Each scout gets a 12–20s individual gap from the previous.
   * Uses deterministic pseudo-random (seed-based) so values are consistent.
   */
  function scoutDelays(count, seed) {
    const delays = [];
    let acc = 0;
    for (let i = 0; i < count; i++) {
      delays.push(acc);
      // Gap: 12000 + 0-8000 pseudo-random
      const r = ((seed + i * 7919) * 1664525 + 1013904223) % 2147483648;
      const gap = 12000 + (r % 8001); // [12000, 20000]
      acc += gap;
    }
    return delays;
  }

  /**
   * Assault wave delays: 15-30 aliens, each 4-6s apart from the previous.
   * Returns array of cumulative ms delays from wave start.
   */
  function assaultDelays(count, seed) {
    const delays = [];
    let acc = 0;
    for (let i = 0; i < count; i++) {
      delays.push(acc);
      const r = ((seed + i * 6271) * 22695477 + 1) % 2147483648;
      const gap = 4000 + (r % 2001); // [4000, 6000]
      acc += gap;
    }
    return delays;
  }

  /**
   * Build waves array for a level.
   * @param {number} levelId   — for pool selection
   * @param {number} difficulty — 0=easy 1=medium 2=hard 3=expert 4=extreme
   * @param {boolean} isBoss
   */
  function buildLevelWaves(levelId, difficulty, isBoss) {
    const pool = equipPoolForLevel(levelId);
    const seed = levelId * 31337;

    // Scout count scales with difficulty: 6-8 easy, 8-10 medium, 10-12 hard+
    const scoutCounts = [6, 8, 9, 10, 12];
    const scoutCount = scoutCounts[Math.min(difficulty, 4)];

    // Base assault size per difficulty tier — scales up within each tier by level.
    // Within a 10-level tier, the first level gets the BASE, the last gets BASE+tier_growth.
    // This ensures L2 (easy tier start) has ~5-6 in final wave, while L10 (easy tier end)
    // has ~15, and the scale keeps climbing through all 5 environments.
    const assaultBases  = [5,  8, 12, 18, 24];   // first level of each tier
    const assaultMaxes  = [15, 18, 22, 26, 30];   // last level of each tier (unchanged max)
    const diff          = Math.min(difficulty, 4);
    // Position within this difficulty tier (0.0 = first level, 1.0 = last level)
    // Difficulty tiers roughly: easy 2-4, medium 5-9, hard 10-19, expert 20-39, extreme 40-50
    // Use levelId to interpolate within the tier.
    const tierRanges = [[2,4],[5,9],[10,19],[20,39],[40,50]];
    const [tierMin, tierMax] = tierRanges[diff] || [1, 50];
    const tierPct = Math.max(0, Math.min(1, (levelId - tierMin) / Math.max(1, tierMax - tierMin)));
    const assaultSize = Math.round(assaultBases[diff] + tierPct * (assaultMaxes[diff] - assaultBases[diff]));

    // Number of full assault waves: 1 easy, 2 medium, 3+ hard
    const waveCounts = [1, 2, 3, 3, 4];
    const numWaves = waveCounts[diff];

    const waves = [];

    // ── Pre-wave scouts ──────────────────────────────────────────────────────
    const preDelays = scoutDelays(scoutCount, seed);
    const preEnemies = preDelays.map(function(delay, i) {
      return {
        type:      'vex_drone',
        lane:      pickLane(seed + i),
        delay:     delay,
        equipment: pickEquip(pool, seed + i * 1000),
      };
    });
    waves.push({ id: 'pre_wave', label: 'ADVANCE SCOUTS', enemies: preEnemies });

    // ── Assault waves ────────────────────────────────────────────────────────
    for (let w = 0; w < numWaves; w++) {
      const isFinal  = w === numWaves - 1;
      const waveSeed = seed + (w + 1) * 99991;
      const waveSize = isFinal && difficulty >= 2 ? assaultSize + 5 : assaultSize;
      const delays   = assaultDelays(waveSize, waveSeed);

      // Pick enemy type — last 2-3 slots get flag bearers on final/penultimate waves
      const enemies = delays.map(function(delay, i) {
        const isFlag = (isFinal || w === numWaves - 2) && i >= waveSize - 2;
        return {
          type:      isFlag ? 'vex_flag_bearer' : 'vex_drone',
          lane:      pickLane(waveSeed + i),
          delay:     delay,
          equipment: isFlag ? 'bare' : pickEquip(pool, waveSeed + i * 777),
        };
      });

      waves.push({
        id:          isFinal ? 'wave_final' : 'wave_' + (w + 1),
        label:       isFinal ? 'FINAL WAVE' : (w === 0 ? 'FIRST WAVE' : 'WAVE ' + (w + 1)),
        isMajorWave: true,
        isFinalWave: isFinal,
        enemies:     enemies,
      });

      // Between waves: add a pressure scout phase (except after final)
      if (!isFinal) {
        const pressSeed   = seed + (w + 1) * 55557;
        const pressCount  = Math.max(3, scoutCount - 2);
        const pressDelays = scoutDelays(pressCount, pressSeed);
        const pressEnemies = pressDelays.map(function(delay, i) {
          return {
            type:      'vex_drone',
            lane:      pickLane(pressSeed + i),
            delay:     delay,
            equipment: pickEquip(pool, pressSeed + i * 1337),
          };
        });
        waves.push({ id: 'pressure_' + (w + 1), label: 'PRESSURE', enemies: pressEnemies });
      }
    }

    // ── Boss wave (level 50 only) ────────────────────────────────────────────
    if (isBoss) {
      const bossDelays = assaultDelays(10, seed + 888888);
      waves.push({
        id: 'wave_boss', label: 'OVERLORD APPROACHES', isMajorWave: true, isBossWave: true,
        enemies: bossDelays.map(function(delay, i) {
          return {
            type:      i === 9 ? 'vex_overlord' : 'vex_elite',
            lane:      pickLane(seed + 888888 + i),
            delay:     delay,
            equipment: 'tactical_armor',
          };
        }),
      });
    }

    return waves;
  }

  // ── Difficulty mapping ────────────────────────────────────────────────────
  const diffMap = { easy: 0, medium: 1, hard: 2, expert: 3, extreme: 4 };

  // ── Assign waves to ALL levels 2-50 ──────────────────────────────────────
  for (let id = 2; id <= 50; id++) {
    if (!L[id]) continue;
    const diff = diffMap[L[id].difficulty] || 0;
    L[id].waves = buildLevelWaves(id, diff, !!L[id].isBossLevel);
    // Update available enemies pool based on level tier
    if (id >= 41) L[id].availableEnemies = ['vex_drone','vex_elite','vex_colossus','vex_overlord'];
    else if (id >= 31) L[id].availableEnemies = ['vex_drone','vex_bruiser','vex_elite'];
    else if (id >= 21) L[id].availableEnemies = ['vex_drone','vex_bruiser','vex_leaper','vex_warden'];
    else if (id >= 11) L[id].availableEnemies = ['vex_drone','vex_runner','vex_leaper','vex_sniper'];
    else               L[id].availableEnemies = ['vex_drone','vex_runner'];
  }

  // ── Survival mode wave sets ───────────────────────────────────────────────
  // Survival modes use the same generator but at expert difficulty
  // and cycle indefinitely (handled by WaveManager when waves[] repeats).
  GW.SURVIVAL_WAVE_SETS = {};
  if (typeof GW.SURVIVAL_MODES !== 'undefined') {
    const survivalDiffByEnv = {
      daytime: 1, nighttime: 2, foggy: 2, rainy_stormy: 3, radioactive: 3,
    };
    GW.SURVIVAL_MODES.forEach(function(mode, idx) {
      const diff = survivalDiffByEnv[mode.env] || 2;
      // Use a high fake levelId (100+) so pool gives hard alien types
      GW.SURVIVAL_WAVE_SETS[mode.id] = buildLevelWaves(30 + idx * 5, diff, false);
    });
  }

  // ── Mini-game wave sets ────────────────────────────────────────────────────
  GW.MINIGAME_WAVE_SETS = {};
  if (typeof GW.MINIGAMES !== 'undefined') {
    GW.MINIGAMES.forEach(function(mg, idx) {
      // Mini-games: medium difficulty, shorter waves
      GW.MINIGAME_WAVE_SETS[mg.id] = buildLevelWaves(10 + idx * 2, 1, false);
    });
  }

  // ── Puzzle wave sets ───────────────────────────────────────────────────────
  GW.PUZZLE_WAVE_SETS = {};
  if (typeof GW.PUZZLES !== 'undefined') {
    GW.PUZZLES.forEach(function(pz, idx) {
      // Puzzles: fixed small wave, easy-medium
      GW.PUZZLE_WAVE_SETS[pz.id] = buildLevelWaves(5 + idx, Math.min(1, idx % 2), false);
    });
  }

  // ── Endless mode base wave set ─────────────────────────────────────────────
  // Endless starts at medium and scales; base template for wave 1
  GW.ENDLESS_BASE_WAVES = buildLevelWaves(15, 1, false);

  GW.LEVELS = L;
})();

// ─── Mini-Games / Puzzle / Survival / Endless ─────────────────────────────────
GW.MINIGAMES = [
  { id:'rapid_defense',  name:'Rapid Defense',     icon:'⚡', unlocked:false, description:'Survive waves with limited placement time.' },
  { id:'target_range',   name:'Alien Target Range', icon:'🎯', unlocked:false, description:'Shoot alien targets. Time challenge.' },
  { id:'energy_rush',    name:'Energy Rush',        icon:'🔋', unlocked:false, description:'Collect as much Plasma as possible in 60s.' },
  { id:'lane_switch',    name:'Lane Switch',        icon:'↔️', unlocked:false, description:'Aliens switch lanes. Adapt your defense.' },
  { id:'last_stand',     name:'Last Stand',         icon:'🛡', unlocked:false, description:'Hold with limited defenders. 10 waves.' },
  { id:'escort',         name:'Escort Mission',     icon:'🚶', unlocked:false, description:'Protect a moving supply convoy.' },
  { id:'resource_rush',  name:'Resource Challenge', icon:'💎', unlocked:false, description:'No orbs. Kill rewards only.' },
  { id:'precision',      name:'Precision Shooting', icon:'🎖', unlocked:false, description:'Only precision shots count.' },
  { id:'relay',          name:'Defense Relay',      icon:'📡', unlocked:false, description:'3 boards back-to-back.' },
  { id:'alien_hunt',     name:'Alien Hunt',         icon:'👾', unlocked:false, description:'Special aliens scatter across lanes.' },
  { id:'minimal',        name:'Minimal Defense',    icon:'⚗', unlocked:false, description:'Only 2 defenders. Placement is everything.' },
  { id:'speed_run',      name:'Speed Run',          icon:'⏱', unlocked:false, description:'Clear all waves as fast as possible.' },
  { id:'tank_mode',      name:'Tank Mode',          icon:'🛡', unlocked:false, description:'Enemies have 10x health.' },
  { id:'fog_mini',       name:'Fog Assault',        icon:'🌫', unlocked:false, description:'Dense fog. React to hints.' },
  { id:'blitz',          name:'Blitz',              icon:'💥', unlocked:false, description:'Aliens from both sides.' },
  { id:'sniper_only',    name:'Sniper Only',        icon:'🔭', unlocked:false, description:'Long-range only.' },
  { id:'no_regen',       name:'Iron Budget',        icon:'💰', unlocked:false, description:'No generators. Starting plasma only.' },
  { id:'survival_mini',  name:'Quick Survival',     icon:'🌊', unlocked:false, description:'5-minute unlimited waves.' },
  { id:'boss_rush',      name:'Boss Preview',       icon:'👹', unlocked:false, description:'Mini-boss variants in sequence.' },
  { id:'free_play',      name:'Free Play',          icon:'🎮', unlocked:true,  description:'Level 1 with no restrictions.' },
];

GW.PUZZLES = [
  { id:'p01', name:'First Puzzle',      icon:'🧩', unlocked:false, description:'Place 3 defenders to stop all aliens.' },
  { id:'p02', name:'Energy Puzzle',     icon:'⚡', unlocked:false, description:'No generators. Use 75 Plasma to win.' },
  { id:'p03', name:'Single Lane',       icon:'➡️', unlocked:false, description:'All aliens in Lane 3. Stop with 2 units.' },
  { id:'p04', name:'Timing Challenge',  icon:'⏰', unlocked:false, description:'Placement locked after 5 seconds.' },
  { id:'p05', name:'Shield Breaker',    icon:'🛡', unlocked:false, description:'Shield aliens only. Find the counter.' },
  { id:'p06', name:'Leaper Logic',      icon:'🦘', unlocked:false, description:'Leapers bypass front row.' },
  { id:'p07', name:'Fog Logic',         icon:'🌫', unlocked:false, description:'Limited visibility.' },
  { id:'p08', name:'Five Lane Perfect', icon:'5️⃣', unlocked:false, description:'Cover all 5 lanes on a budget.' },
  { id:'p09', name:'No Combat',         icon:'🚫', unlocked:false, description:'Support only. Use the Sentinel.' },
  { id:'p10', name:'Low HP Puzzle',     icon:'❤️', unlocked:false, description:'Defenders start at 10 HP.' },
  { id:'p11', name:'Lane Swap',         icon:'🔀', unlocked:false, description:'Aliens switch lanes each wave.' },
  { id:'p12', name:'Speed Puzzle',      icon:'💨', unlocked:false, description:'Fast aliens only.' },
  { id:'p13', name:'Dense Formation',   icon:'👾', unlocked:false, description:'Massive groups. Need splash damage.' },
  { id:'p14', name:'Minimal Budget',    icon:'💎', unlocked:false, description:'100 Plasma total. No generators.' },
  { id:'p15', name:'Multi-Role',        icon:'🎭', unlocked:false, description:'Must use offense, support, medic.' },
  { id:'p16', name:'Boss Puzzle',       icon:'👹', unlocked:false, description:'One boss alien. Limited resources.' },
  { id:'p17', name:'Blind Shot',        icon:'👁',  unlocked:false, description:'No HP bars visible.' },
  { id:'p18', name:'The Final Puzzle',  icon:'🏆', unlocked:false, description:'All mechanics combined.' },
];

GW.SURVIVAL_MODES = [
  { id:'sv_daytime',   name:'Daytime',       icon:'☀️', unlocked:true,  env:'daytime',     description:'Survive in daylight. Classic invasion.' },
  { id:'sv_nighttime', name:'Nighttime',     icon:'🌙', unlocked:false, env:'nighttime',   description:'Night survival. Limited visibility.' },
  { id:'sv_foggy',     name:'Foggy',         icon:'🌫', unlocked:false, env:'foggy',       description:'Dense fog. Recon essential.' },
  { id:'sv_storm',     name:'Storm',         icon:'⛈', unlocked:false, env:'rainy_stormy',description:'Storm conditions. Brutal.' },
  { id:'sv_radio',     name:'Radioactive',   icon:'☢️', unlocked:false, env:'radioactive', description:'Contaminated zone. Mutated aliens.' },
  { id:'sv_winter',    name:'Winter',        icon:'❄️', unlocked:false, env:'winter',      description:'Winter mini-game environment.' },
  { id:'sv_spaceship', name:'Alien Vessel',  icon:'🚀', unlocked:false, env:'spaceship',   description:'Aboard the enemy ship.' },
  { id:'sv_heavy',     name:'Heavy Assault', icon:'⚔️', unlocked:false, env:'daytime',     description:'Armored and brute aliens only.' },
  { id:'sv_boss_rush', name:'Boss Rush',     icon:'👹', unlocked:false, env:'spaceship',   description:'Consecutive boss-class enemies.' },
  { id:'sv_last_stand',name:'Last Stand',    icon:'🛡', unlocked:false, env:'rainy_stormy',description:'All lanes assault simultaneously.' },
];

GW.ENDLESS = {
  id: 'endless', name: 'Endless Survival',
  description: 'Waves never stop. Difficulty scales. Score scales with wave.',
  highScore: { wave: 0, score: 0, time: 0, aliensDefeated: 0 },
  difficultyScale: {
    hpMultiplierPerWave: 0.06,
    speedMultiplierPerWave: 0.03,
    spawnDelayReduction: 0.02,
    specialAlienChanceBase: 0.1,
    bossChanceEvery: 15,
  },
};

// ─── Game Modes ───────────────────────────────────────────────────────────────
GW.GAME_MODES = {
  adventure:          { id:'adventure',          name:'Adventure',          unlocked:true },
  survival:           { id:'survival',           name:'Survival / Endless', unlocked:false },
  minigames:          { id:'minigames',           name:'Mini-Games',         unlocked:false },
  puzzle:             { id:'puzzle',             name:'Puzzle',             unlocked:false },
  characters_profile: { id:'characters_profile', name:'Characters Profile', unlocked:false },
  extras:             { id:'extras',             name:'Extras',             unlocked:false },
  settings:           { id:'settings',           name:'Settings',           unlocked:true },
  credits:            { id:'credits',            name:'Credits',            unlocked:true },
};

// ─── Progression Schema ───────────────────────────────────────────────────────
GW.PROGRESSION_SCHEMA = {
  version:          2,
  playerName:       '',
  isNewPlayer:      true,
  currentLevel:     1,
  completedLevels:  [],
  claimedCards:     ['plasma_energy_generator', 'fire_lance_gunner'],
  discoveredEnemies:['vex_drone'],
  unlockedModes:    ['adventure', 'settings', 'credits'],
  unlockedEnvs:     ['daytime'],
  achievements:     [],
  bestSurvivalScores: {},
  bestEndlessWave:  0,
  bestEndlessScore: 0,
  settings: { sfxVolume: 0.8, musicVolume: 0.6, showTips: true, pixelArt: true },
};

// ─── Asset Registry ───────────────────────────────────────────────────────────
// ─── Asset Paths (deployment-safe web paths) ─────────────────────────────────
// All paths are root-relative (/assets/...) and work identically
// on localhost AND on any production server.
// Filenames are lowercase to match Linux/production filesystem case-sensitivity.
GW.ASSETS = {
  // ── Sprite paths ─────────────────────────────────────────────────────────
  // Currently null — game uses procedural Phaser graphics.
  // When real sprite sheets arrive, replace null with the path string.
  // Example: plasma_energy_generator: "/assets/sprites/characters/player/plasma_energy_generator.svg"
  SPRITES: {
    plasma_energy_generator: "/assets/sprites/characters/player/plasma_energy_generator.svg",
    fire_lance_gunner:       "/assets/sprites/characters/player/fire_lance_gunner.svg",
    vex_drone:               "/assets/sprites/enemies/basic/vex_drone.svg",
    vex_flag_bearer:         "/assets/sprites/enemies/basic/vex_flag_bearer.svg",
    sentinel:                null,  // sentinel uses procedural graphics
    creator_bitos:           null,  // Creator Bitos uses procedural graphics
  },

  // ── Audio paths ───────────────────────────────────────────────────────────
  // Paths to audio assets. OGG primary (open, compact), MP3 fallback.
  // null = file not yet available; the audio manager skips null entries.
  // Five battle themes — one per environment (daytime/nighttime/foggy/storm/radioactive).
  AUDIO: {
    // ── Music ──────────────────────────────────────────────
    menuMusic:         '/assets/audio/music/menu-theme.ogg',
    loadingMusic:      '/assets/audio/music/loading-theme.ogg',
    battleDaytime:     '/assets/audio/music/battle-daytime.ogg',
    battleNighttime:   '/assets/audio/music/battle-nighttime.ogg',
    battleFoggy:       '/assets/audio/music/battle-foggy.ogg',
    battleStorm:       '/assets/audio/music/battle-storm.ogg',
    battleRadioactive: '/assets/audio/music/battle-radioactive.ogg',
    victoryMusic:      '/assets/audio/music/victory.ogg',
    defeatMusic:       '/assets/audio/music/defeat.ogg',
    briefingMusic:     '/assets/audio/music/briefing.ogg',

    // ── SFX ────────────────────────────────────────────────
    fireLanceShoot:    '/assets/audio/sfx/fire-lance-shoot.ogg',
    plasmaShoot:       '/assets/audio/sfx/plasma-shoot.ogg',
    bulletShoot:       '/assets/audio/sfx/bullet-shoot.ogg',
    enemyHit:          '/assets/audio/sfx/enemy-hit.ogg',
    enemyDeath:        '/assets/audio/sfx/enemy-death.ogg',
    defenderPlaced:    '/assets/audio/sfx/defender-placed.ogg',
    plasmaCollect:     '/assets/audio/sfx/plasma-collect.ogg',
    waveStart:         '/assets/audio/sfx/wave-start.ogg',
    sentinelActivate:  '/assets/audio/sfx/sentinel-activate.ogg',
    baseHit:           '/assets/audio/sfx/base-hit.ogg',
    hordeWarning:      '/assets/audio/sfx/horde-warning.ogg',
    explosion:         '/assets/audio/sfx/explosion.ogg',

    // ── UI ─────────────────────────────────────────────────
    btnClick:          '/assets/audio/ui/btn-click.ogg',
    btnHover:          '/assets/audio/ui/btn-hover.ogg',
    menuOpen:          '/assets/audio/ui/menu-open.ogg',
    menuClose:         '/assets/audio/ui/menu-close.ogg',
    cardSelect:        '/assets/audio/ui/card-select.ogg',
    levelUnlock:       '/assets/audio/ui/level-unlock.ogg',
    notification:      '/assets/audio/ui/notification.ogg',
    deploy:            '/assets/audio/ui/deploy.ogg',
  },

  // ── Background image paths ─────────────────────────────────────────────────
  // Battlefield backgrounds per environment — SVG format, 960x600.
  // The battlefield currently renders via Phaser procedural graphics,
  // so these serve as reference / fallback background layers.
  BACKGROUNDS: {
    daytime:      "/assets/backgrounds/battlefield/daytime.svg",
    nighttime:    "/assets/backgrounds/battlefield/nighttime.svg",
    foggy:        "/assets/backgrounds/battlefield/foggy.svg",
    rainy_stormy: "/assets/backgrounds/battlefield/rainy_stormy.svg",
    radioactive:  "/assets/backgrounds/battlefield/radioactive.svg",
    menu:         "/assets/backgrounds/menu/menu-bg.svg",
    briefing:     "/assets/backgrounds/briefing/briefing-bg.svg",
    victory:      "/assets/backgrounds/victory/victory-bg.svg",
    defeat:       "/assets/backgrounds/defeat/defeat-bg.svg",
  },

  // ── UI asset paths ─────────────────────────────────────────────────────────
  UI: {
    plasmaIcon:    "/assets/ui/hud/plasma-icon.svg",
    waveMarker:    "/assets/ui/hud/wave-marker.svg",
    alienHead:     "/assets/ui/indicators/alien-head.svg",
    menuIcon:      "/assets/ui/indicators/menu-icon.svg",
    pauseIcon:     "/assets/ui/indicators/pause-icon.svg",
    hudBar:        "/assets/ui/panels/hud-bar.svg",
    timelineBar:   "/assets/ui/panels/timeline-bar.svg",
    cardSlot:      "/assets/ui/panels/card-slot.svg",
  },

  // ── Effect paths ───────────────────────────────────────────────────────────
  EFFECTS: {
    hitSpark:      "/assets/sprites/effects/hit-spark.svg",
    deathBurst:    "/assets/sprites/effects/death-burst.svg",
    plasmaCollect: "/assets/sprites/effects/plasma-collect.svg",
    spawnRing:     "/assets/sprites/effects/spawn-ring.svg",
  },

  // ── Projectile paths ───────────────────────────────────────────────────────
  PROJECTILES: {
    fireLance: "/assets/sprites/projectiles/fire-lance-shot.svg",
    plasma:    "/assets/sprites/projectiles/plasma-shot.svg",
    bullet:    "/assets/sprites/projectiles/bullet.svg",
  },
};

// ─── Scene Keys ───────────────────────────────────────────────────────────────
GW.SCENES = {
  BOOT:     'BootScene',
  INTRO:    'IntroScene',
  MENU:     'MenuScene',
  MAP:      'MapScene',
  BRIEFING: 'BriefingScene',
  CARD_SEL: 'CardSelectionScene',
  GAME:     'GameScene',
  WIN:      'WinScene',
  LOSE:     'LoseScene',
};

// ─── UI Colors ────────────────────────────────────────────────────────────────
// CHRONO-FRONT: GALACTIC WAR — theme palette
// Primary: cosmic amber/gold + galactic teal. Deep space backgrounds.
GW.UI_COLORS = {
  TEXT_PRIMARY:    '#e8f0ff',   // near-white with blue tint
  TEXT_DIM:        '#6b85a0',   // muted blue-grey
  TEXT_ACCENT:     '#f59e0b',   // amber gold
  TEXT_DANGER:     '#ef4444',   // red (unchanged)
  TEXT_ALIEN:      '#c4b5fd',   // alien purple (unchanged)
  GREEN_BRIGHT:    '#22d3ee',   // galactic teal — replaces garden green
  GREEN_GRASS:     '#06b6d4',   // deeper teal
  GREEN_MILITARY:  '#1d4ed8',   // military blue
  GREEN_DARK:      '#1e3a5f',   // dark navy
  EARTH_BROWN:     '#7c4a1a',   // unchanged (terrain)
  SKY_BLUE:        '#bfdbfe',   // light cosmic blue
  PLASMA:          '#a78bfa',   // plasma purple (unchanged)
  PLASMA_BRIGHT:   '#c4b5fd',   // plasma bright (unchanged)
  GOLD:            '#f59e0b',   // amber gold — main accent
  PANEL_BG:        '#040c18',   // deep space panel
  HEALTH_FULL:     '#22d3ee',   // teal health bar
  HEALTH_LOW:      '#ef4444',   // red low health (unchanged)
  BITOS_GOLD:      '#f59e0b',   // amber
  DIGITAL_GREEN:   '#22d3ee',   // terminal teal
  TRAY_BG:         '#060d1a',   // dark space tray
  TRAY_BORDER:     'rgba(34,211,238,0.3)', // teal border
  TIMELINE_BG:     '#030810',   // deep space timeline
  TIMELINE_FILL:   '#22d3ee',   // teal fill
  WAVE_MARKER:     '#f59e0b',   // gold wave marker
  FINAL_MARKER:    '#ef4444',   // red final (unchanged)
  FLAG_MARKER:     '#e879f9',   // alien flag (unchanged)
  PLASMA_ICON:     '#a78bfa',   // plasma icon (unchanged)
  SENTINEL_COLOR:  '#22d3ee',   // teal sentinel
  SENTINEL_WARN:   '#f59e0b',   // gold warning
  PAUSE_OVERLAY:   'rgba(0,0,0,0.88)',
  MENU_BTN:        '#1e3a5f',   // navy menu
};

// Freeze immutable sections
Object.freeze(GW.DISPLAY);
Object.freeze(GW.BOARD);
Object.freeze(GW.RESOURCES);
Object.freeze(GW.WAVES);
Object.freeze(GW.COMBAT);
Object.freeze(GW.SENTINEL);
Object.freeze(GW.WAVE_TIMELINE);
Object.freeze(GW.SCENES);
Object.freeze(GW.UI_COLORS);
Object.freeze(GW.ENDLESS.difficultyScale);
