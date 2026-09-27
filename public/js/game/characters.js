/**
 * Garden Warfare: Reborn — Human Defender System
 *
 * BATTLEFIELD REVISION:
 *  - Uses GW.CARDS (aliased via GW.CHARACTERS for compat)
 *  - P.E. Regen: genInterval from GW.RESOURCES.REGEN_UNIT_INTERVAL (10s)
 *  - Fire-Lance Gunner: first combat unit (10 dmg, 2800ms, 280 range)
 *  - Integrates SpriteRegistry animated drawing
 *  - Supports all card roles
 */

/* global GW */

GW.Character = class Character {
  constructor(scene, def, lane, cellIndex, x, y) {
    this.scene     = scene;
    this.def       = def;
    this.id        = def.id;
    this.name      = def.name;
    this.lane      = lane;
    this.cellIndex = cellIndex;
    this.x         = x;
    this.y         = y;
    this.role      = def.role || 'offense';

    this.maxHp = def.hp;
    this.hp    = def.hp;
    this.alive = true;
    this.target = null;

    // Combat stats from weapon def OR card def
    const isEnergyUnit = def.isSupport || def.role === 'energy';

    if (isEnergyUnit) {
      this.damage      = 0;
      this.attackSpeed = 0;
      this.range       = 0;
      this.projColor   = 0;
      this.projSize    = 0;
      this.isSupport   = true;
      // Use config value (10000ms = 10s per spec)
      this.genInterval = def.genInterval || GW.RESOURCES.REGEN_UNIT_INTERVAL;
      this.genAmount   = def.genAmount   || GW.RESOURCES.REGEN_UNIT_AMOUNT;
      this.genTimer    = this.genInterval;  // start at full interval — no instant generation
    } else {
      const wpn = (def.weapon && GW.WEAPONS) ? GW.WEAPONS[def.weapon] : null;
      this.damage      = (wpn && wpn.damage)           || def.damage      || 10;
      this.attackSpeed = (wpn && wpn.attackSpeed)      || def.attackSpeed || 2800;
      this.range       = (wpn && wpn.range)            || def.range       || 280;
      this.projColor   = (wpn && wpn.projectileColor)  || 0xff6b00;
      this.projSize    = (wpn && wpn.projectileSize)   || 5;
      this.isSupport   = false;
    }

    this.attackTimer = 0;
    this.container   = null;
    this.graphics    = null;
    this.animator    = null;
    this.onGenerateEnergy = null;

    this._build();
  }

  _build() {
    this.container = this.scene.add.container(this.x, this.y).setDepth(10);

    const g = this.scene.add.graphics();
    this.graphics = g;
    this.container.add(g);

    // Use SpriteRegistry if available
    if (window.GW && GW.SpriteRegistry) {
      const drawFn = this.isSupport
        ? GW.SpriteRegistry.getCharDraw(this.id)
        : GW.SpriteRegistry.getCharDraw(this.id);
      if (drawFn) {
        this.animator = new GW.SpriteAnimator(this.scene, g, drawFn, this.def);
        this.animator.play('idle');
      } else {
        this._drawFallback(g);
      }
    } else {
      this._drawFallback(g);
    }

    // HP bar bg
    const hpBg = this.scene.add.graphics();
    hpBg.fillStyle(0x1a1a1a, 0.85);
    hpBg.fillRect(-20, -52, 40, 5);
    this.container.add(hpBg);

    this.hpBar = this.scene.add.graphics();
    this.container.add(this.hpBar);
    this._updateHpBar();

    // Name label
    this.label = this.scene.add.text(0, -62, this.name, {
      fontFamily: '"Exo 2", monospace',
      fontSize:   '7px',
      color:      GW.UI_COLORS ? GW.UI_COLORS.TEXT_DIM : '#7a9e6a',
      align:      'center',
    }).setOrigin(0.5, 0);
    this.container.add(this.label);
  }

  _drawFallback(g) {
    g.clear();
    const c = this.def.color || 0x4d7c0f;
    if (this.isSupport) {
      // Generator device
      g.fillStyle(c, 0.9); g.fillRoundedRect(-7, -18, 14, 32, 3);
      g.fillStyle(this.def.accentColor || 0xfef3c7, 0.8); g.fillCircle(0, -22, 8);
      g.fillStyle(0xa78bfa, 0.7); g.fillCircle(0, -22, 5);
    } else if (this.def.isSuicideUnit) {
      // Bomber — soldier holding a large bomb (almost as big as the head)
      // Body
      g.fillStyle(c, 1); g.fillRoundedRect(-12, -12, 24, 22, 3);
      // Skin / face
      g.fillStyle(this.def.skinColor || 0xd4956a, 1); g.fillRoundedRect(-8, -24, 16, 14, 4);
      // Helmet
      g.fillStyle(this.def.helmetColor || 0x450a0a, 1); g.fillRoundedRect(-9, -28, 18, 10, 4);
      // Bomb body — large dark sphere held out in front
      g.fillStyle(0x1f2937, 1); g.fillCircle(14, -10, 9);
      // Bomb sheen
      g.fillStyle(0x4b5563, 0.6); g.fillCircle(11, -14, 3.5);
      // Fuse line
      g.lineStyle(1.5, 0x78350f, 1);
      g.beginPath(); g.moveTo(14, -19); g.lineTo(17, -26); g.strokePath();
      // Spark at fuse tip
      g.fillStyle(0xfbbf24, 1); g.fillCircle(17, -27, 2.5);
      g.fillStyle(0xef4444, 0.8); g.fillCircle(17, -27, 1.5);
    } else {
      // Soldier — generic soldier with gun
      g.fillStyle(this.def.skinColor || 0xd4956a, 1); g.fillRoundedRect(-8, -24, 16, 14, 4);
      g.fillStyle(this.def.helmetColor || 0x3d2008, 1); g.fillRoundedRect(-9, -28, 18, 10, 4);
      g.fillStyle(0x374151, 1); g.fillRect(10, -8, 14, 4);
    }
  }

  _updateHpBar() {
    if (!this.hpBar) return;
    this.hpBar.clear();
    const ratio = Math.max(0, this.hp / this.maxHp);
    const col   = ratio > 0.5 ? 0x4ade80 : ratio > 0.25 ? 0xfbbf24 : 0xef4444;
    this.hpBar.fillStyle(col, 1);
    this.hpBar.fillRect(-20, -52, 40 * ratio, 5);
  }

  update(delta, enemies) {
    if (!this.alive) return null;

    if (this.isSupport) {
      // Randomize genTimer on each tick: 8–10s (using config min/max if available)
      const genMin = (GW.RESOURCES && GW.RESOURCES.REGEN_UNIT_INTERVAL_MIN) || 8000;
      const genMax = (GW.RESOURCES && GW.RESOURCES.REGEN_UNIT_INTERVAL_MAX) || 10000;
      this.genTimer -= delta;
      if (this.genTimer <= 0) {
        // Next tick is randomized within 8–10s
        this.genTimer = genMin + Math.floor(Math.random() * (genMax - genMin + 1));
        if (this.onGenerateEnergy) this.onGenerateEnergy(this.genAmount, this.x, this.y);
        if (this.animator) {
          this.animator.play('attack', 8);
          this.scene.time.delayedCall(400, () => {
            if (this.animator && this.alive) this.animator.play('idle');
          });
        }

        // ── Generation pulse animation ──────────────────────────────────
        // Inner golden flash — bright core burst centred on the crystal
        const flash = this.scene.add.graphics().setDepth(14);
        flash.fillStyle(0xfef3c7, 0.95);
        flash.fillCircle(this.x, this.y - 18, 10);
        this.scene.tweens.add({
          targets: flash, scaleX: 2.6, scaleY: 2.6, alpha: 0,
          duration: 320, ease: 'Power3',
          onComplete: () => flash.destroy(),
        });

        // First ring — gold, expands fast
        const ring1 = this.scene.add.graphics().setDepth(13);
        ring1.lineStyle(2.5, 0xfbbf24, 0.9);
        ring1.strokeCircle(this.x, this.y - 18, 8);
        this.scene.tweens.add({
          targets: ring1, scaleX: 3.2, scaleY: 3.2, alpha: 0,
          duration: 500, ease: 'Power2',
          onComplete: () => ring1.destroy(),
        });

        // Second ring — amber, delayed slightly, expands wider
        const ring2 = this.scene.add.graphics().setDepth(13);
        ring2.lineStyle(1.5, 0xf59e0b, 0.6);
        ring2.strokeCircle(this.x, this.y - 18, 8);
        this.scene.tweens.add({
          targets: ring2, scaleX: 4.8, scaleY: 4.8, alpha: 0,
          duration: 700, delay: 80, ease: 'Sine.easeOut',
          onComplete: () => ring2.destroy(),
        });

        // Container scale-breathe — unit "pulses" outward then snaps back
        if (this.container) {
          this.scene.tweens.add({
            targets: this.container, scaleX: 1.18, scaleY: 1.18,
            duration: 160, ease: 'Power2', yoyo: true,
          });
        }
      }
      return null;
    }

    // Combat unit
    this.target = this._findTarget(enemies);

    if (!this.target) {
      if (this.animator && this.animator.state === 'attack') {
        this.animator.play('idle');
      }
      return null;
    }

    this.attackTimer -= delta;
    if (this.attackTimer <= 0) {
      this.attackTimer = this.attackSpeed;
      if (this.animator) {
        this.animator.play('attack', 8);
        this.scene.time.delayedCall(this.attackSpeed * 0.55, () => {
          if (this.animator && this.alive) this.animator.play('idle');
        });
      }
      return { shoot: true, target: this.target };
    }
    return null;
  }

  _findTarget(enemies) {
    let closest = null;
    let closestDist = Infinity;
    for (const en of enemies) {
      if (!en.alive) continue;
      if (en.lane !== this.lane) continue;
      const dist = en.x - this.x;
      // Enemy must be to the right (approaching) and within range
      if (dist > 0 && dist <= this.range && dist < closestDist) {
        closestDist = dist;
        closest = en;
      }
    }
    return closest;
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.hp -= amount;
    this._updateHpBar();
    if (this.animator) {
      this.animator.play('hurt', 10);
      this.scene.time.delayedCall(150, () => {
        if (this.animator && this.alive) this.animator.play('idle');
      });
    } else {
      // Simple flash
      if (this.graphics) {
        this.graphics.setAlpha(0.3);
        this.scene.time.delayedCall(120, () => {
          if (this.graphics && this.alive) this.graphics.setAlpha(1);
        });
      }
    }
    if (this.hp <= 0) this.die();
  }

  die() {
    this.alive  = false;
    this.target = null;
    if (this.animator) this.animator.play('die', 8);
    this.scene.tweens.add({
      targets:  this.container,
      alpha:    0,
      scaleX:   0.3,
      scaleY:   0.3,
      duration: 380,
      ease:     'Power2',
      onComplete: () => this.destroy(),
    });
  }

  destroy() {
    if (this.animator) { this.animator.destroy(); this.animator = null; }
    if (this.container) { this.container.destroy(true); this.container = null; }
  }
};

GW.CharacterFactory = class CharacterFactory {
  static create(scene, defId, lane, cellIndex, x, y) {
    // Resolve from GW.CARDS first (primary), GW.CHARACTERS is aliased to GW.CARDS
    const def = (GW.CARDS && GW.CARDS[defId]) ||
                (GW.CHARACTERS && GW.CHARACTERS[defId]);
    if (!def) throw new Error('Unknown card/character: ' + defId);
    return new GW.Character(scene, def, lane, cellIndex, x, y);
  }
};
