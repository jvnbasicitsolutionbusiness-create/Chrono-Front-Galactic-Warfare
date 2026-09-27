/**
 * Garden Warfare: Reborn — Plasma Energy Manager
 *
 * REVISED SYSTEM:
 *  - No continuous auto-regen. Energy comes from:
 *    1. Collecting plasma orbs that spawn on the battlefield (primary source)
 *    2. Kill rewards when an alien enemy is defeated
 *    3. A very slow base generator tick (background trickle)
 *
 *  - PlasmaOrb: individual collectible objects on the game board.
 *  - ResourceManager: owns orb spawning, the slow base tick, and balance.
 *
 *  The orb system is modular — future levels can tune spawn rate,
 *  orb value, and lifetime via config.
 */

/* global GW */

// ─── Plasma Orb ───────────────────────────────────────────────────────────────
GW.PlasmaOrb = class PlasmaOrb {
  /**
   * @param {Phaser.Scene} scene
   * @param {number}       x
   * @param {number}       y
   * @param {number}       value   - energy granted on collect
   * @param {number}       lifetime - ms before orb fades away
   * @param {Function}     onCollect - callback(value) fired when player clicks orb
   */
  constructor(scene, x, y, value, lifetime, onCollect) {
    this.scene     = scene;
    this.x         = x;
    this.y         = y;
    this.value     = value;
    this.lifetime  = lifetime;
    this.onCollect = onCollect;
    this.active    = true;

    this._build();
    this._startLifetimeTimer();
  }

  _build() {
    // Outer glow ring
    this.gfxOuter = this.scene.add.graphics();
    this.gfxOuter.setDepth(8);
    this.gfxOuter.fillStyle(0xa78bfa, 0.2);
    this.gfxOuter.fillCircle(0, 0, 18);
    this.gfxOuter.x = this.x;
    this.gfxOuter.y = this.y;

    // Core orb
    this.gfxCore = this.scene.add.graphics();
    this.gfxCore.setDepth(9);
    this.gfxCore.fillStyle(0x7c3aed, 1);
    this.gfxCore.fillCircle(0, 0, 10);
    this.gfxCore.fillStyle(0xc4b5fd, 0.9);
    this.gfxCore.fillCircle(-3, -3, 4);  // highlight
    this.gfxCore.x = this.x;
    this.gfxCore.y = this.y;

    // Value label
    this.label = this.scene.add.text(this.x, this.y - 16, `+${this.value}`, {
      fontFamily: 'Exo 2, sans-serif',
      fontSize:   '9px',
      fontStyle:  'bold',
      color:      '#c4b5fd',
    }).setOrigin(0.5, 1).setDepth(9);

    // Idle float animation
    this.scene.tweens.add({
      targets:  [this.gfxOuter, this.gfxCore, this.label],
      y:        `-=6`,
      duration: 900,
      ease:     'Sine.easeInOut',
      yoyo:     true,
      repeat:   -1,
    });

    // Pulse outer ring
    this.scene.tweens.add({
      targets:  this.gfxOuter,
      alpha:    0.5,
      scaleX:   1.3,
      scaleY:   1.3,
      duration: 800,
      ease:     'Sine.easeInOut',
      yoyo:     true,
      repeat:   -1,
    });

    // Hit area — interactive zone
    this.hitZone = this.scene.add.circle(this.x, this.y, 20, 0x000000, 0)
      .setDepth(9)
      .setInteractive({ useHandCursor: true });

    this.hitZone.on('pointerdown', () => this._collect());
    this.hitZone.on('pointerover', () => { this.gfxCore.setAlpha(0.75); });
    this.hitZone.on('pointerout',  () => { this.gfxCore.setAlpha(1); });
  }

  _startLifetimeTimer() {
    // Fade out warning at 30% remaining lifetime
    const warnAt = this.lifetime * 0.7;
    this._warnTimer = this.scene.time.delayedCall(warnAt, () => {
      if (!this.active) return;
      // Blink to warn
      this.scene.tweens.add({
        targets:  [this.gfxOuter, this.gfxCore, this.label],
        alpha:    0.3,
        duration: 300,
        yoyo:     true,
        repeat:   4,
      });
    });

    // Auto-destroy when lifetime expires
    this._expireTimer = this.scene.time.delayedCall(this.lifetime, () => {
      if (this.active) this._expire();
    });
  }

  _collect() {
    if (!this.active) return;
    this.active = false;

    // Cancel timers
    if (this._warnTimer)  this._warnTimer.remove(false);
    if (this._expireTimer) this._expireTimer.remove(false);

    // Collect pop animation
    this.scene.tweens.add({
      targets:  [this.gfxOuter, this.gfxCore, this.label],
      y:        `-=30`,
      alpha:    0,
      scaleX:   1.5,
      scaleY:   1.5,
      duration: 280,
      ease:     'Power2',
      onComplete: () => this._destroyObjects(),
    });

    if (this.onCollect) this.onCollect(this.value);
  }

  _expire() {
    this.active = false;
    if (this._warnTimer)  this._warnTimer.remove(false);
    this.scene.tweens.add({
      targets:  [this.gfxOuter, this.gfxCore, this.label],
      alpha:    0,
      duration: 400,
      ease:     'Power1',
      onComplete: () => this._destroyObjects(),
    });
  }

  _destroyObjects() {
    [this.gfxOuter, this.gfxCore, this.label, this.hitZone].forEach((obj) => {
      if (obj) { obj.destroy(); }
    });
    this.gfxOuter = null;
    this.gfxCore  = null;
    this.label    = null;
    this.hitZone  = null;
  }

  destroy() {
    this.active = false;
    if (this._warnTimer)  this._warnTimer.remove(false);
    if (this._expireTimer) this._expireTimer.remove(false);
    this._destroyObjects();
  }
};

// ─── Resource Manager ─────────────────────────────────────────────────────────
GW.ResourceManager = class ResourceManager {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene      = scene;
    this.energy     = GW.RESOURCES.STARTING_ENERGY;
    this.maxEnergy  = GW.RESOURCES.MAX_ENERGY;
    this._onChange  = null;
    this._orbTimer  = null;
    this._genTimer  = null;
    this.orbs       = [];    // live PlasmaOrb[]

    // Board boundaries for safe orb placement
    this._boardLeft   = GW.BOARD.PLACEMENT_START_X + GW.BOARD.CELL_WIDTH * 2;
    this._boardRight  = GW.BOARD.ENEMY_SPAWN_X - 80;
    this._boardTop    = GW.BOARD.TOP_OFFSET + 10;
    this._boardBottom = GW.BOARD.TOP_OFFSET + GW.BOARD.LANES * GW.BOARD.LANE_HEIGHT - 10;
  }

  onChange(fn) {
    this._onChange = fn;
  }

  /** Start orb spawning + base generator. Call after scene is ready. */
  startRegen() {
    // Random orb spawn: 10–15s between each orb (not fixed interval)
    this._scheduleNextOrb();

    this._genTimer = this.scene.time.addEvent({
      delay:         GW.RESOURCES.BASE_GEN_INTERVAL,
      callback:      () => this.earn(GW.RESOURCES.BASE_GEN_AMOUNT),
      callbackScope: this,
      loop:          true,
    });
  }

  _scheduleNextOrb() {
    const min   = GW.RESOURCES.ORB_SPAWN_INTERVAL_MIN || 10000;
    const max   = GW.RESOURCES.ORB_SPAWN_INTERVAL_MAX || 15000;
    const delay = min + Math.floor(Math.random() * (max - min + 1));
    this._orbTimer = this.scene.time.delayedCall(delay, () => {
      this._spawnOrb();
      this._scheduleNextOrb(); // chain — schedules the next one
    });
  }

  stopRegen() {
    if (this._orbTimer) { this._orbTimer.remove(false); this._orbTimer = null; }
    if (this._genTimer) { this._genTimer.remove(false); this._genTimer = null; }
    // Destroy any remaining orbs
    this.orbs.forEach((o) => o.destroy());
    this.orbs = [];
  }

  _spawnOrb() {
    // Pick a random position on the board (any lane, not too close to home or spawn edge)
    const lane = Phaser.Math.Between(1, GW.BOARD.LANES);
    const laneY = GW.BOARD.TOP_OFFSET + (lane - 0.5) * GW.BOARD.LANE_HEIGHT;
    // Spawn in the mid-board area (defender zone to just past midpoint)
    const x = Phaser.Math.Between(
      GW.BOARD.PLACEMENT_START_X + 40,
      GW.BOARD.PLACEMENT_START_X + GW.BOARD.CELLS_PER_LANE * GW.BOARD.CELL_WIDTH - 40
    );

    const orb = new GW.PlasmaOrb(
      this.scene,
      x,
      laneY,
      GW.RESOURCES.ORB_VALUE,
      GW.RESOURCES.ORB_LIFETIME,
      (value) => {
        this.earn(value);
        // Remove from orbs array
        const idx = this.orbs.indexOf(orb);
        if (idx !== -1) this.orbs.splice(idx, 1);
      }
    );

    this.orbs.push(orb);

    // Prune orbs that have self-destructed
    this.orbs = this.orbs.filter((o) => o.active);
  }

  /** Called by P.E. Generator unit when it generates plasma.
   *  Spawns a collectible orb at the unit's position.
   *  Player must click it — energy is NOT added automatically. */
  spawnGeneratorOrb(x, y) {
    const R   = GW.RESOURCES;
    const min = R.REGEN_UNIT_INTERVAL_MIN || 8000;
    const max = R.REGEN_UNIT_INTERVAL_MAX || 10000;
    // (interval is managed by Character.genInterval — no timer needed here)
    const orb = new GW.PlasmaOrb(
      this.scene,
      x,
      y - 30,   // spawn slightly above the unit
      R.REGEN_UNIT_AMOUNT,
      R.ORB_LIFETIME,
      (value) => {
        this.earn(value);
        const idx = this.orbs.indexOf(orb);
        if (idx !== -1) this.orbs.splice(idx, 1);
      }
    );
    this.orbs.push(orb);
    this.orbs = this.orbs.filter(o => o.active);
  }

  canAfford(cost)  { return this.energy >= cost; }

  spend(amount) {
    if (!this.canAfford(amount)) return false;
    this.energy = Math.max(0, this.energy - amount);
    this._notify();
    return true;
  }

  earn(amount) {
    this.energy = Math.min(this.maxEnergy, this.energy + amount);
    this._notify();
  }

  _notify() {
    if (this._onChange) this._onChange(this.energy);
  }
};
