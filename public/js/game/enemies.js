/**
 * Chrono-Front: Galactic War — Alien Enemy System
 *
 * SPRITE SYSTEM UPGRADE:
 *  - Enemies now use GW.SpriteRegistry + GW.SpriteAnimator (same as characters)
 *  - vex_drone  → full pixel-art common alien (purple, 3 pink eyes, cranial ridges)
 *  - vex_flag_bearer → full pixel-art pink horde-leader (ears, red flag, gold pole)
 *  - Equipment (cap/helmet/shield) drawn on a separate graphics layer on top
 *  - Walk / attack / hurt / die animation states driven by SpriteAnimator
 *  - Legacy _drawBody() replaced — SpriteRegistry is the single source of truth
 */

/* global GW */

GW.Enemy = class Enemy {
  constructor(scene, def, lane, x, y) {
    this.scene    = scene;
    this.def      = def;
    this.id       = def.id;
    this.name     = def.name;
    this.lane     = lane;
    this.x        = x;
    this.y        = y;

    // Base HP — always 100 for common alien
    this.maxHp    = def.hp;   // 100
    this.hp       = def.hp;

    this.speed    = def.speed;           // 28 px/s
    this.damage   = def.damage;          // 10
    this.attackCooldown = def.attackCooldown;
    this.reward   = def.reward;

    // Equipment system (cap/helmet/shield)
    this.equipment     = null;  // current equipment def
    this.equipHp       = 0;     // equipment durability remaining
    this.equipMaxHp    = 0;
    this.equipBroken   = false;
    this.shieldActive  = false; // true if shield-type equipment

    this.alive        = true;
    this.blocked      = false;
    this.attackTarget = null;
    this.attackTimer  = def.attackCooldown;

    // SpriteAnimator (replaces manual walk-frame timer)
    this.animator     = null;
    this._animState   = 'walk';   // current animation state label

    this.container = null;
    this.graphics  = null;
    this.equipGfx  = null;  // separate graphics for equipment (cap/helmet/shield)
    this.hpBar     = null;
    this.hpBarBg   = null;

    this._build();
  }

  // ── Equipment ────────────────────────────────────────────
  applyEquipment(equipDef) {
    if (!equipDef || equipDef.id === 'bare') return;
    this.equipment  = equipDef;
    this.equipHp    = equipDef.extraHp;
    this.equipMaxHp = equipDef.extraHp;
    this.shieldActive = !!equipDef.shieldType;
    if (equipDef.speedMult && equipDef.speedMult !== 1.0) {
      this.speed = Math.round(this.def.speed * equipDef.speedMult);
    }
    // Equipment is drawn on the equipGfx layer — redraw it
    if (this.equipGfx) this._drawEquipment(this.equipGfx);
    // If using legacy path, also redraw body
    if (!this.animator && this.graphics) this._drawBody(this.graphics, 0);
  }

  // ── Visual ────────────────────────────────────────────────
  _build() {
    this.container = this.scene.add.container(this.x, this.y);
    this.container.setDepth(15);

    // ── Main enemy graphics — driven by SpriteRegistry ───
    const g = this.scene.add.graphics();
    this.graphics = g;
    this.container.add(g);

    // Use SpriteRegistry draw function if registered, otherwise fall back
    if (window.GW && GW.SpriteRegistry) {
      const drawFn = GW.SpriteRegistry.getEnemyDraw(this.id);
      if (drawFn) {
        this.animator = new GW.SpriteAnimator(this.scene, g, drawFn, this.def);
        this.animator.play('walk');   // enemies start walking in immediately
      } else {
        this._drawBody(g, 0);
      }
    } else {
      this._drawBody(g, 0);
    }

    // Equipment graphics (drawn on top of body)
    const eg = this.scene.add.graphics();
    this.equipGfx = eg;
    this.container.add(eg);
    if (this.equipment && !this.equipBroken) {
      this._drawEquipment(eg);
    }

    // HP bar background
    this.hpBarBg = this.scene.add.graphics();
    this.hpBarBg.fillStyle(0x1a0a2e, 0.85);
    this.hpBarBg.fillRect(-22, -58, 44, 6);
    this.container.add(this.hpBarBg);

    // HP bar fill
    this.hpBar = this.scene.add.graphics();
    this.container.add(this.hpBar);
    this._updateHpBar();
  }

  /**
   * Legacy fallback draw — only used if SpriteRegistry has no entry for this enemy id.
   * The SpriteRegistry draw functions (sprites.js) are the primary rendering path.
   */
  _drawBody(g, frame) {
    g.clear();
    const c  = this.def.color       || 0x4c3b7a;
    const ac = this.def.accentColor || 0x7c6ab5;
    const ec = this.def.eyeColor    || 0xe879f9;
    const bob = Math.sin((frame || 0) * 0.8) * 2.5;

    g.fillStyle(0x000000, 0.22); g.fillEllipse(0, 35, 44, 10);

    const lk = ((frame || 0) < 4) ? 2 : -2;
    const rk = ((frame || 0) < 4) ? -2 : 2;
    g.fillStyle(c, 0.95);
    g.fillRect(-10, 12 + bob, 8, 14 + lk); g.fillRect(-12, 24 + bob + lk, 10, 12);
    g.fillStyle(ac, 0.8); g.fillRoundedRect(-14, 34 + bob, 12, 5, 2);
    g.fillStyle(c, 0.95);
    g.fillRect(2, 12 + bob, 8, 14 + rk); g.fillRect(2, 24 + bob + rk, 10, 12);
    g.fillStyle(ac, 0.8); g.fillRoundedRect(2, 34 + bob, 12, 5, 2);

    g.fillStyle(c, 1); g.fillEllipse(0, 2 + bob, 34, 28);
    g.fillStyle(c, 0.9);
    g.fillRect(-22, 0 + bob, 14, 7); g.fillCircle(-22, 3 + bob, 4);
    g.fillRect(8, 0 + bob, 14, 7);   g.fillCircle(22, 3 + bob, 4);
    g.fillStyle(c, 0.9); g.fillEllipse(0, -8 + bob, 18, 14);
    g.fillStyle(c, 1); g.fillRoundedRect(-17, -30 + bob, 34, 24, 6);
    g.fillStyle(ac, 0.85);
    for (let i = -8; i <= 8; i += 4) g.fillTriangle(i, -30 + bob, i - 3, -38 + bob, i + 3, -38 + bob);
    g.fillStyle(ec, 1);
    g.fillCircle(-8, -20 + bob, 5); g.fillCircle(0, -22 + bob, 3.5); g.fillCircle(8, -20 + bob, 5);
    g.lineStyle(1.5, ec, 0.4);
    g.strokeCircle(-8, -20 + bob, 7); g.strokeCircle(8, -20 + bob, 7);
    g.fillStyle(0x0a0015, 0.9); g.fillRect(-7, -10 + bob, 14, 3);
    g.fillStyle(ec, 0.3); g.fillCircle(0, 4 + bob, 9);
    g.fillStyle(ec, 0.8); g.fillCircle(0, 4 + bob, 5);
  }

  _drawEquipment(g) {
    g.clear();
    if (!this.equipment || this.equipBroken) return;
    const eq = this.equipment;

    // Equipment Y offset matches body bob — use frame 0 position
    const bob = 0;

    if (eq.id === 'cap') {
      // Stolen cap — blue cap on head
      g.fillStyle(eq.equipColor, 0.9);
      g.fillRoundedRect(-18, -36 + bob, 36, 10, 4);
      g.fillStyle(eq.equipColor, 0.7);
      g.fillRect(-22, -30 + bob, 44, 4);
      // Cap logo
      g.fillStyle(0xfbbf24, 0.8);
      g.fillRect(-4, -34 + bob, 8, 6);

    } else if (eq.id === 'helmet') {
      // Metal helmet — grey military helmet
      g.fillStyle(eq.equipColor, 0.95);
      g.fillRoundedRect(-19, -38 + bob, 38, 14, 6);
      // Helmet rim
      g.fillStyle(0x4b5563, 0.85);
      g.fillRect(-22, -26 + bob, 44, 5);
      // Helmet markings
      g.lineStyle(1, 0x9ca3af, 0.6);
      g.lineBetween(-6, -36 + bob, -6, -26 + bob);
      g.lineBetween(6, -36 + bob, 6, -26 + bob);

    } else if (eq.id === 'shield') {
      // Stolen shield — renders IN FRONT (higher x, left side of alien)
      g.fillStyle(eq.equipColor, 0.85);
      // Shield shape (tall rectangle with rounded top)
      g.fillRoundedRect(-32, -28 + bob, 18, 40, 4);
      // Shield border
      g.lineStyle(2, 0x7dd3fc, 0.8);
      g.strokeRoundedRect(-32, -28 + bob, 18, 40, 4);
      // Shield emblem
      g.fillStyle(0x7dd3fc, 0.5);
      g.fillCircle(-23, -8 + bob, 6);
      // Damage cracks based on remaining HP
      if (this.equipHp < this.equipMaxHp * 0.5) {
        g.lineStyle(1, 0xfbbf24, 0.6);
        g.lineBetween(-30, -24 + bob, -24, -10 + bob);
        g.lineBetween(-26, -14 + bob, -20, -4 + bob);
      }
    }
  }

  _updateHpBar() {
    this.hpBar.clear();

    // If shield is active, show shield HP in blue, body HP in purple
    if (this.shieldActive && !this.equipBroken && this.equipHp > 0) {
      // Shield bar (blue, extends further)
      const shieldRatio = Math.max(0, this.equipHp / this.equipMaxHp);
      this.hpBar.fillStyle(0x3b82f6, 1);
      this.hpBar.fillRect(-22, -54, 44 * shieldRatio, 6);
      // Small body HP indicator below
      const bodyRatio = Math.max(0, this.hp / this.maxHp);
      this.hpBar.fillStyle(0xa78bfa, 0.7);
      this.hpBar.fillRect(-22, -47, 44 * bodyRatio, 3);
    } else {
      // Normal HP bar
      const totalHp  = this.maxHp + (this.equipBroken ? 0 : this.equipHp);
      const totalMax = this.maxHp + (this.equipment ? this.equipment.extraHp : 0);
      const ratio    = Math.max(0, (this.hp + (this.equipBroken ? 0 : this.equipHp)) / Math.max(1, totalMax));
      const col      = ratio > 0.5 ? 0xa78bfa : ratio > 0.25 ? 0xfbbf24 : 0xef4444;
      this.hpBar.fillStyle(col, 1);
      this.hpBar.fillRect(-22, -54, 44 * ratio, 6);
    }
  }

  // ── Game Logic ────────────────────────────────────────────
  update(delta, characters) {
    if (!this.alive) return null;

    const blocker = this._findBlocker(characters);

    if (blocker) {
      this.blocked      = true;
      this.attackTarget = blocker;
      this.attackTimer -= delta;

      // Switch to attack animation while blocked
      if (this.animator && this._animState !== 'attack') {
        this._animState = 'attack';
        this.animator.play('attack', 8);
      }

      if (this.attackTimer <= 0) {
        this.attackTimer = this.attackCooldown;
        return { attack: true, target: blocker };
      }
    } else {
      this.blocked      = false;
      this.attackTarget = null;
      this.attackTimer  = Math.max(0, this.attackTimer - delta);

      // Switch to walk animation while moving
      if (this.animator && this._animState !== 'walk') {
        this._animState = 'walk';
        this.animator.play('walk', 7);
      }
      // Legacy fallback: manual walk frame redraw
      if (!this.animator && this.graphics) {
        this._walkTimer = (this._walkTimer || 0) + delta;
        if (this._walkTimer >= 1000 / 8) {
          this._walkTimer -= 1000 / 8;
          this._walkFrame = ((this._walkFrame || 0) + 1) % 8;
          this._drawBody(this.graphics, this._walkFrame);
        }
      }

      const moveAmt = (this.speed * delta) / 1000;
      this.x -= moveAmt;
      this.container.x = this.x;
    }

    return null;
  }

  _findBlocker(characters) {
    const THRESHOLD = 52;
    let blocker = null;
    let closestDist = Infinity;
    for (const ch of characters) {
      if (!ch.alive) continue;
      if (ch.lane !== this.lane) continue;
      const dist = this.x - ch.x;
      if (dist >= 0 && dist <= THRESHOLD && dist < closestDist) {
        closestDist = dist;
        blocker = ch;
      }
    }
    return blocker;
  }

  takeDamage(amount) {
    if (!this.alive) return;

    // Damage hits shield first
    if (this.shieldActive && !this.equipBroken && this.equipHp > 0) {
      this.equipHp -= amount;
      if (this.equipHp <= 0) {
        this.equipHp   = 0;
        this.equipBroken = true;
        this.shieldActive = false;
        this._breakEquipment();
      }
    } else if (this.equipment && !this.equipBroken && this.equipHp > 0) {
      // Cap/helmet — damage goes to equip first
      this.equipHp -= amount;
      if (this.equipHp <= 0) {
        this.equipHp = 0;
        this.equipBroken = true;
        this._breakEquipment();
      }
    } else {
      // Direct body damage
      this.hp -= amount;
    }

    this._updateHpBar();
    this._flashDamage();
    if (this.hp <= 0) this.die();
  }

  _breakEquipment() {
    // Apply speed change if equipment specifies speedAfterBreak
    if (this.equipment && this.equipment.speedAfterBreak) {
      this.speed = Math.round(this.def.speed * this.equipment.speedAfterBreak);
    }
    // Visual break effect
    if (this.equipGfx) this.equipGfx.clear();

    // Small particle burst at head position
    const burst = this.scene.add.graphics().setDepth(25);
    const color = this.equipment ? (this.equipment.equipColor || 0x9ca3af) : 0x9ca3af;
    burst.fillStyle(color, 0.9);
    burst.fillRect(-4, -32, 8, 6);
    this.scene.tweens.add({
      targets: burst,
      x: burst.x + (Math.random() - 0.5) * 30,
      y: burst.y - 20,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 400,
      ease: 'Power2',
      onComplete: () => burst.destroy(),
    });

    // Redraw without equipment (animator continues; equipment layer is cleared above)
    if (!this.animator && this.graphics) this._drawBody(this.graphics, 0);
    this._updateHpBar();
  }

  _flashDamage() {
    // Trigger hurt animation state
    if (this.animator) {
      if (this._animState !== 'hurt') {
        this._animState = 'hurt';
        this.animator.play('hurt', 10);
        // Return to walk/attack after 180ms
        this.scene.time.delayedCall(180, () => {
          if (this.animator && this.alive) {
            this._animState = this.blocked ? 'attack' : 'walk';
            this.animator.play(this._animState, this.blocked ? 8 : 7);
          }
        });
      }
    } else {
      // Legacy flash
      this.container.setAlpha(0.3);
      this.scene.time.delayedCall(GW.COMBAT.DAMAGE_FLASH_MS, () => {
        if (this.container && this.alive) this.container.setAlpha(1);
      });
    }
  }

  die() {
    this.alive        = false;
    this.attackTarget = null;
    this._tryDropCurrency();

    // Play death animation then fade out
    if (this.animator) {
      this._animState = 'die';
      this.animator.play('die', 6);
    }

    this.scene.tweens.add({
      targets:  this.container,
      alpha:    0,
      y:        this.container.y - 18,
      scaleX:   0.5,
      scaleY:   0.5,
      duration: 380,
      delay:    80,
      ease:     'Power2',
      onComplete: () => this.destroy(),
    });
  }

  _tryDropCurrency() {
    if (!GW.CURRENCY || !this.scene) return;
    // Randomize drop chance within 10%–25%
    const dropChance = GW.CURRENCY.DROP_CHANCE_MIN +
      Math.random() * (GW.CURRENCY.DROP_CHANCE_MAX - GW.CURRENCY.DROP_CHANCE_MIN);
    if (Math.random() > dropChance) return;

    // Pick currency type by weight
    const weights = GW.CURRENCY.TYPE_WEIGHTS;
    const types   = Object.keys(weights);
    const total   = types.reduce((s, k) => s + weights[k], 0);
    let r = Math.random() * total;
    let pickedId = types[types.length - 1];
    for (const k of types) {
      r -= weights[k];
      if (r <= 0) { pickedId = k; break; }
    }
    const typeDef = GW.CURRENCY.TYPES[pickedId];
    if (!typeDef) return;

    // Spawn the currency drop at this alien's position
    if (this.scene.currencyManager) {
      this.scene.currencyManager.spawnDrop(this.x, this.y, typeDef);
    }
  }

  destroy() {
    if (this.animator) { this.animator.destroy(); this.animator = null; }
    if (this.container) {
      this.container.destroy(true);
      this.container = null;
    }
  }

  reachedHome() {
    return this.x <= GW.BOARD.HOME_X;
  }
};

// ─── Enemy Factory ────────────────────────────────────────────────────────────
GW.EnemyFactory = class EnemyFactory {
  static create(scene, defId, lane) {
    const def = GW.ENEMIES[defId];
    if (!def) {
      console.warn('[EnemyFactory] Unknown enemy:', defId);
      return null;
    }
    // Y = lane center (feet will touch ground via drawing offset)
    const y = GW.BOARD.TOP_OFFSET + (lane - 0.5) * GW.BOARD.LANE_HEIGHT;
    const x = GW.BOARD.ENEMY_SPAWN_X;
    return new GW.Enemy(scene, def, lane, x, y);
  }
};
