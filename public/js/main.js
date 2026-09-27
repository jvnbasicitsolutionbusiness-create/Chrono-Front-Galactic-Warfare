/**
 * Garden Warfare: Reborn — Phaser Entry Point
 * Canvas: 960×600 (corrected sky proportions)
 */

/* global Phaser, GW */

(function () {
  'use strict';

  if (typeof Phaser === 'undefined') {
    console.error('[GW] Phaser failed to load.');
    const status = document.getElementById('loadStatus');
    if (status) status.textContent = 'ERROR: Phaser failed to load.';
    return;
  }

  if (typeof GW === 'undefined' || !GW.DISPLAY) {
    console.error('[GW] config.js not loaded before main.js.');
    return;
  }

  const config = {
    type: Phaser.AUTO,
    width:  GW.DISPLAY.BASE_WIDTH,   // 960
    height: GW.DISPLAY.BASE_HEIGHT,  // 600
    backgroundColor: GW.DISPLAY.BACKGROUND_COLOR,
    parent: 'game-container',
    scale: {
      mode:       Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width:      GW.DISPLAY.BASE_WIDTH,
      height:     GW.DISPLAY.BASE_HEIGHT,
      min: {
        width:  GW.DISPLAY.MIN_WIDTH,
        height: GW.DISPLAY.MIN_HEIGHT,
      },
    },
    physics: {
      default: 'arcade',
      arcade:  { gravity: { y: 0 }, debug: false },
    },
    input: {
      keyboard: true,
      mouse:    true,
      touch:    true,
      gamepad:  false,
    },
    render: {
      antialias:         true,
      pixelArt:          GW.DISPLAY.PIXEL_ART || false,
      roundPixels:       GW.DISPLAY.PIXEL_ART || false,
      transparent:       false,
      clearBeforeRender: true,
    },
    scene:               GW.SceneRegistry,
    disableContextMenu:  true,
  };

  try {
    const game = new Phaser.Game(config);

    if (window.location && window.location.hostname === 'localhost') {
      window.__GW_GAME__ = game;
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        game.scene.scenes.forEach(s => { if (s.scene.isActive()) s.scene.pause(); });
      } else {
        game.scene.scenes.forEach(s => { if (s.scene.isPaused()) s.scene.resume(); });
      }
    });

    console.log('[GW] Garden Warfare: Reborn — initialized 960×600');
  } catch (err) {
    console.error('[GW] Failed to initialize Phaser:', err);
    const status = document.getElementById('loadStatus');
    if (status) status.textContent = 'ERROR: ' + err.message;
  }
})();
