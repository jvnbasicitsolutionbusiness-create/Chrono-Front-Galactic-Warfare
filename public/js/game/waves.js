/**
 * Garden Warfare: Reborn — Wave Manager
 *
 * Spawn modes:
 *  1. Normal (default)    — each enemy entry has a `delay` ms offset from wave start.
 *  2. halfHpChain:true    — next scout spawns when the previous one reaches ≤50% HP.
 *  3. hordeDelay:N        — flag bearer spawns immediately (triggers warning banner),
 *                           then ALL remaining enemies spawn together after N ms.
 */

/* global GW */

GW.WaveManager = class WaveManager {
  constructor(scene, combatManager, waves) {
    this.scene         = scene;
    this.combatManager = combatManager;
    this.waves         = waves || [];

    this.currentWaveIndex  = -1;
    this.totalWaves        = this.waves.length;
    this.state             = 'waiting';
    this.started           = false;

    this.initialTimer    = GW.WAVES.INITIAL_DELAY;   // 20s before first alien
    this.betweenTimer    = 0;
    this._spawnTimers    = [];
    this._spawnedCount   = 0;
    this._totalInWave    = 0;

    // Half-HP chain state
    this._chainIndex     = 0;        // next entry index to spawn in halfHpChain mode
    this._chainEnemy     = null;     // the live Enemy we are waiting on
    this._chainPollTimer = null;     // Phaser timer that polls HP

    this.progress = 0;

    this._totalSpawnedAllWaves   = 0;
    this._totalScheduledAllWaves = 0;

    // Callbacks
    this.onWaveStart    = null;
    this.onWaveClear    = null;
    this.onAllClear     = null;
    this.onCountdown    = null;
    this.onFlagAlien    = null;
    this.onAlienSpawned = null;
  }

  start() {
    this.started = true;
    this.state   = 'initial_wait';
    this._totalScheduledAllWaves = this.waves.reduce(
      (sum, w) => sum + (w.enemies ? w.enemies.length : 0), 0
    );
    this._totalSpawnedAllWaves = 0;
  }

  update(delta) {
    if (!this.started || this.state === 'done') return;

    if (this.state === 'initial_wait') {
      this.initialTimer -= delta;
      if (this.initialTimer <= 0) this._beginWave(0);
      return;
    }

    if (this.state === 'between') {
      this.betweenTimer -= delta;
      if (this.onCountdown) this.onCountdown(Math.max(0, Math.ceil(this.betweenTimer / 1000)));
      if (this.betweenTimer <= 0) this._beginWave(this.currentWaveIndex + 1);
      return;
    }

    if (this.state === 'clearing') {
      if (this.combatManager.activeEnemyCount === 0) this._waveClear();
      return;
    }
    // 'spawning' — managed by delayedCall timers or the HP-chain poll
  }

  // ── Begin a wave ──────────────────────────────────────────
  _beginWave(index) {
    if (index >= this.waves.length) {
      this.state = 'done';
      if (this.onAllClear) this.onAllClear();
      return;
    }

    this.currentWaveIndex = index;
    const waveDef = this.waves[index];
    this.state = 'spawning';

    this.progress = this.totalWaves > 1 ? index / (this.totalWaves - 1) : 0;
    if (this.onWaveStart) this.onWaveStart(index, waveDef);

    const enemies = waveDef.enemies || [];
    this._totalInWave  = enemies.length;
    this._spawnedCount = 0;

    this._cancelSpawnTimers();
    this._stopChainPoll();

    if (enemies.length === 0) {
      this.scene.time.delayedCall(500, () => {
        if (this.state === 'spawning') this.state = 'clearing';
      });
      return;
    }

    // ── Dispatch to the right spawn mode ──────────────────
    if (waveDef.halfHpChain) {
      this._beginHalfHpChain(enemies, waveDef);
    } else if (waveDef.hordeDelay) {
      this._beginHordeWave(enemies, waveDef);
    } else {
      this._beginNormalWave(enemies, waveDef);
    }
  }

  // ── MODE 1: Normal delay-based spawning ──────────────────
  _beginNormalWave(enemies, waveDef) {
    enemies.forEach(entry => {
      const timer = this.scene.time.delayedCall(entry.delay || 0, () => {
        this._spawnEnemy(entry, waveDef);
        this._spawnedCount++;
        if (this._spawnedCount >= this._totalInWave) {
          this.scene.time.delayedCall(500, () => {
            if (this.state === 'spawning') this.state = 'clearing';
          });
        }
      });
      this._spawnTimers.push(timer);
    });
  }

  // ── MODE 2: Half-HP chain (scouts) ───────────────────────
  // Spawn first entry immediately. After each spawn, wait until
  // that alien reaches ≤50% HP, then spawn the next one.
  _beginHalfHpChain(enemies, waveDef) {
    this._chainIndex = 0;
    this._chainEnemy = null;
    this._spawnNextInChain(enemies, waveDef);
  }

  _spawnNextInChain(enemies, waveDef) {
    if (this._chainIndex >= enemies.length) {
      // All spawned — wait for field to clear
      this.scene.time.delayedCall(500, () => {
        if (this.state === 'spawning') this.state = 'clearing';
      });
      return;
    }

    const entry = enemies[this._chainIndex];
    this._chainIndex++;

    // Spawn this scout
    const enemy = this._spawnEnemy(entry, waveDef);
    this._spawnedCount++;
    this._chainEnemy = enemy;

    // If more enemies remain, watch this one's HP
    if (this._chainIndex < enemies.length) {
      this._pollForHalfHp(enemies, waveDef);
    } else {
      // Last scout spawned — transition to clearing when field empties
      this.scene.time.delayedCall(500, () => {
        if (this.state === 'spawning') this.state = 'clearing';
      });
    }
  }

  _pollForHalfHp(enemies, waveDef) {
    // Poll every 200ms; fire next scout the moment current one ≤ 50% HP
    this._chainPollTimer = this.scene.time.addEvent({
      delay:    200,
      loop:     true,
      callback: () => {
        if (this.state !== 'spawning') {
          this._stopChainPoll();
          return;
        }
        const en = this._chainEnemy;
        // Trigger if: alien is dead (killed) OR hp ≤ 50%
        const halfHpReached = !en || !en.alive ||
          (en.hp !== undefined && en.maxHp && en.hp <= en.maxHp * 0.5);

        if (halfHpReached) {
          this._stopChainPoll();
          this._spawnNextInChain(enemies, waveDef);
        }
      },
    });
    this._spawnTimers.push(this._chainPollTimer);
  }

  _stopChainPoll() {
    if (this._chainPollTimer) {
      this._chainPollTimer.remove(false);
      this._chainPollTimer = null;
    }
    this._chainEnemy = null;
  }

  // ── MODE 3: Horde wave with delay ───────────────────────
  // 1. Flag bearer spawns immediately → triggers onFlagAlien / warning banner.
  // 2. After hordeDelay ms, all remaining drones spawn together.
  _beginHordeWave(enemies, waveDef) {
    const flagEntry  = enemies.find(e => e.type === 'vex_flag_bearer');
    const droneEntries = enemies.filter(e => e.type !== 'vex_flag_bearer');

    // Spawn flag bearer immediately
    if (flagEntry) {
      this._spawnEnemy(flagEntry, waveDef);
      this._spawnedCount++;
    }

    // Spawn drones after the configured delay (4000ms)
    const delay = waveDef.hordeDelay || 4000;
    const timer = this.scene.time.delayedCall(delay, () => {
      droneEntries.forEach(entry => {
        this._spawnEnemy(entry, waveDef);
        this._spawnedCount++;
      });
      // Transition to clearing shortly after last spawn
      this.scene.time.delayedCall(500, () => {
        if (this.state === 'spawning') this.state = 'clearing';
      });
    });
    this._spawnTimers.push(timer);
  }

  // ── Spawn a single enemy ─────────────────────────────────
  // Returns the Enemy instance so callers can track it.
  _spawnEnemy(entry, waveDef) {
    const enemy = GW.EnemyFactory.create(this.scene, entry.type, entry.lane);
    if (!enemy) return null;

    // Equipment
    if (entry.equipment && GW.ALIEN_EQUIPMENT) {
      const equipDef = GW.ALIEN_EQUIPMENT[entry.equipment];
      if (equipDef) enemy.applyEquipment(equipDef);
    }

    // Flag alien callback (fires warning banner in scenes.js)
    if (enemy.def && enemy.def.isFlag && this.onFlagAlien) {
      this.onFlagAlien(waveDef);
    }

    this.combatManager.addEnemy(enemy);

    this._totalSpawnedAllWaves++;
    if (this.onAlienSpawned) {
      this.onAlienSpawned(this._totalSpawnedAllWaves, this._totalScheduledAllWaves);
    }

    return enemy;
  }

  // ── Wave clear ───────────────────────────────────────────
  _waveClear() {
    const waveNum = this.currentWaveIndex + 1;
    if (this.onWaveClear) this.onWaveClear(waveNum);

    if (this.currentWaveIndex >= this.totalWaves - 1) {
      this.state = 'done';
      if (this.onAllClear) this.onAllClear();
      return;
    }

    this.betweenTimer = GW.WAVES.BETWEEN_WAVE_DELAY;
    this.state = 'between';
  }

  // ── Cleanup ──────────────────────────────────────────────
  _cancelSpawnTimers() {
    this._spawnTimers.forEach(t => { if (t && t.remove) t.remove(false); });
    this._spawnTimers = [];
  }

  get currentWaveNumber() { return this.currentWaveIndex + 1; }
  get isComplete()        { return this.state === 'done'; }
};
