/**
 * Garden Warfare: Reborn — Combat Orchestrator
 *
 * REVISED: Passes weapon projectile color and size to ProjectileManager.fire().
 * All other logic unchanged.
 */

/* global GW */
GW.CombatManager = class CombatManager {
  constructor(scene, projectileManager, resourceManager, playerState) {
    this.scene             = scene;
    this.projectileManager = projectileManager;
    this.resourceManager   = resourceManager;
    this.playerState       = playerState;

    this.characters  = [];
    this.enemies     = [];

    this.onEnemyKilled      = null;
    this.onCharacterKilled  = null;
    this.onEnemyReachedHome = null;
  }

  addCharacter(character) { this.characters.push(character); }
  addEnemy(enemy)         { this.enemies.push(enemy); }

  update(delta) {
    this._updateCharacters(delta);
    this._updateEnemies(delta);
    this._updateProjectiles(delta);
    this._pruneDeadEntities();
  }

  _updateCharacters(delta) {
    for (const ch of this.characters) {
      if (!ch.alive) continue;
      const result = ch.update(delta, this.enemies);
      if (result && result.shoot && result.target) {
        this.projectileManager.fire(
          ch.x + 32,
          ch.y - 8,
          result.target,
          ch.damage,
          ch.projColor,
          ch.projSize
        );
        this._pulseAttacker(ch);
      }
    }
  }

  _updateEnemies(delta) {
    for (const en of this.enemies) {
      if (!en.alive) continue;

      if (en.reachedHome()) {
        en.alive = false;
        if (this.onEnemyReachedHome) this.onEnemyReachedHome(en);
        if (en.container) en.destroy();
        continue;
      }

      const result = en.update(delta, this.characters);
      if (result && result.attack && result.target) {
        result.target.takeDamage(en.damage);
        this._showAttackLine(en, result.target);
      }
    }
  }

  _updateProjectiles(delta) {
    this.projectileManager.update(delta);
  }

  _pruneDeadEntities() {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const en = this.enemies[i];
      if (!en.alive) {
        if (en.hp <= 0) {
          this.resourceManager.earn(en.reward);
          this.playerState.addScore(en.reward * 5);
          this.playerState.recordKill();
          if (this.onEnemyKilled) this.onEnemyKilled(en);
        }
        if (en.container) en.destroy();
        this.enemies.splice(i, 1);
      }
    }

    for (let i = this.characters.length - 1; i >= 0; i--) {
      const ch = this.characters[i];
      if (!ch.alive) {
        if (this.onCharacterKilled) this.onCharacterKilled(ch);
        if (ch.container) ch.destroy();
        this.characters.splice(i, 1);
      }
    }
  }

  _pulseAttacker(ch) {
    if (!ch.container) return;
    this.scene.tweens.add({
      targets:  ch.container,
      scaleX:   1.16,
      scaleY:   1.16,
      duration: 75,
      yoyo:     true,
      ease:     'Power2',
    });
  }

  _showAttackLine(enemy, character) {
    if (!enemy.container || !character.container) return;
    const line = this.scene.add.graphics().setDepth(18);
    line.lineStyle(1.5, 0xef4444, 0.6);
    line.beginPath();
    line.moveTo(enemy.x, enemy.y);
    line.lineTo(character.x, character.y);
    line.strokePath();
    this.scene.time.delayedCall(100, () => line.destroy());
  }

  destroyAll() {
    this.characters.forEach(ch => { if (ch.container) ch.destroy(); });
    this.enemies.forEach(en    => { if (en.container) en.destroy(); });
    this.projectileManager.destroyAll();
    this.characters = [];
    this.enemies    = [];
  }

  get activeEnemyCount()     { return this.enemies.filter(e => e.alive).length; }
  get activeCharacterCount() { return this.characters.filter(c => c.alive).length; }
};
