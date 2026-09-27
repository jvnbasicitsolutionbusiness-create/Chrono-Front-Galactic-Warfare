/**
 * Garden Warfare: Reborn — Projectile System
 *
 * REVISED: Projectile color/size driven by character weapon definition.
 * ProjectileManager.fire() now accepts optional color and size params.
 */

/* global GW */

GW.Projectile = class Projectile {
  /**
   * @param {Phaser.Scene} scene
   * @param {number}  x
   * @param {number}  y
   * @param {GW.Enemy} target
   * @param {number}  damage
   * @param {number}  speed
   * @param {number}  color    - hex color for the projectile
   * @param {number}  size     - radius of core circle
   */
  constructor(scene, x, y, target, damage, speed, color, size) {
    this.scene   = scene;
    this.x       = x;
    this.y       = y;
    this.target  = target;
    this.damage  = damage;
    this.speed   = speed || GW.COMBAT.PROJECTILE_SPEED;
    this.color   = color || 0xfde68a;
    this.size    = size  || 5;
    this.active  = true;

    this._build();
  }

  _build() {
    this.gfx = this.scene.add.graphics().setDepth(20);
    this._draw();
  }

  _draw() {
    this.gfx.clear();
    // Outer glow
    this.gfx.fillStyle(this.color, 0.25);
    this.gfx.fillCircle(0, 0, this.size + 5);
    // Core
    this.gfx.fillStyle(this.color, 1);
    this.gfx.fillCircle(0, 0, this.size);
    // Highlight
    this.gfx.fillStyle(0xffffff, 0.55);
    this.gfx.fillCircle(-Math.floor(this.size * 0.4), -Math.floor(this.size * 0.4), Math.max(1.5, this.size * 0.4));
    this.gfx.x = this.x;
    this.gfx.y = this.y;
  }

  update(delta) {
    if (!this.active) return true;

    if (!this.target || !this.target.alive) {
      this.destroy();
      return true;
    }

    const tx = this.target.x;
    const ty = this.target.y;
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const step = (this.speed * delta) / 1000;

    if (dist <= step + this.size + 4) {
      // Hit!
      this.target.takeDamage(this.damage);
      this._spawnHitEffect(tx, ty);
      this.destroy();
      return true;
    }

    this.x += (dx / dist) * step;
    this.y += (dy / dist) * step;
    this.gfx.x = this.x;
    this.gfx.y = this.y;

    if (this.x > GW.DISPLAY.BASE_WIDTH + 60 || this.x < -60) {
      this.destroy();
      return true;
    }
    return false;
  }

  _spawnHitEffect(x, y) {
    const fx = this.scene.add.graphics().setDepth(25);
    fx.fillStyle(this.color, 0.8);
    fx.fillCircle(0, 0, this.size + 8);
    fx.x = x; fx.y = y;
    this.scene.tweens.add({
      targets:  fx,
      alpha:    0,
      scaleX:   2.5,
      scaleY:   2.5,
      duration: 200,
      ease:     'Power2',
      onComplete: () => fx.destroy(),
    });
  }

  destroy() {
    this.active = false;
    if (this.gfx) { this.gfx.destroy(); this.gfx = null; }
  }
};

GW.ProjectileManager = class ProjectileManager {
  constructor(scene) {
    this.scene       = scene;
    this.projectiles = [];
  }

  /**
   * Fire a projectile.
   * @param {number}   x
   * @param {number}   y
   * @param {GW.Enemy} target
   * @param {number}   damage
   * @param {number}   [color]  - hex color (from weapon def)
   * @param {number}   [size]   - radius (from weapon def)
   */
  fire(x, y, target, damage, color, size) {
    const p = new GW.Projectile(
      this.scene, x, y, target, damage,
      GW.COMBAT.PROJECTILE_SPEED, color, size
    );
    this.projectiles.push(p);
    return p;
  }

  update(delta) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (this.projectiles[i].update(delta)) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  destroyAll() {
    this.projectiles.forEach(p => p.destroy());
    this.projectiles = [];
  }
};
