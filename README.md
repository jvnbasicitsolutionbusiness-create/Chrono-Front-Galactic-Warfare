# Garden Warfare: Reborn

A 2D lane-based tower defense strategy game built with Phaser 3, Node.js, and Express.
Defend your garden from waves of original enemies by placing plant defenders in 5 lanes.

## Technologies

- Frontend: HTML5, CSS3, JavaScript (ES6)
- Game Engine: Phaser 3 v3.80.1 (CDN)
- Server: Node.js + Express.js
- Security: Helmet, CORS, dotenv
- Database: Firebase Realtime DB (future phase)

## Installation

  npm install
  copy .env.example .env

## npm Commands

  npm start      Start production server
  npm run dev    Start with nodemon (auto-restart)

## Local Development

  npm run dev
  Open http://localhost:3000

  Main menu:  http://localhost:3000/
  Game:       http://localhost:3000/game.html
  Health API: http://localhost:3000/api/health

## Project Structure

  public/
    index.html          Main menu (HTML/CSS/JS)
    game.html           Phaser game container
    css/                main.css, menu.css, game.css
    js/
      config.js         All constants, character/enemy/level defs
      main.js           Phaser entry point
      menu.js           Menu button logic
      game/
        scenes.js       BootScene + GameScene
        characters.js   Character class + CharacterFactory
        enemies.js      Enemy class + EnemyFactory
        combat.js       CombatManager
        waves.js        WaveManager
        projectiles.js  Projectile system
        collision.js    Grid math helpers
        resources.js    Energy system
        ui.js           HUD and UI
        player.js       Player state
        levels.js       Level manager
        game.js         Scene registry
    assets/             sprites, backgrounds, ui, audio (future)
  server/
    server.js           Express server (static files + API)
    routes/             Future API routes
  database/             Future Firebase schema

## Prototype Features (Phase 1)

- Main menu: PLAY, CHARACTERS, PROFILE, EXTRAS, SETTINGS, CREDITS
- 5-lane game board with home wall and enemy spawn side
- Solar Sprout: original character, auto-attack, costs 50 energy
- Grove Crawler: moves left, attacks blockers, dies, gives reward
- Projectile combat: solar seed fires, travels, hits, deals damage
- 3-wave progression with banners and between-wave countdown
- Victory screen (LEVEL COMPLETE) with PLAY AGAIN and MAIN MENU
- Defeat screen (GAME OVER) with RETRY and MAIN MENU
- Energy regen, score tracking, responsive canvas (mobile compatible)
- 12 modular JS files, centralized config, all-original procedural art
- Security: Helmet, CORS, dotenv, server/client separation

## How to Play

1. Click PLAY on the main menu
2. Wait 3 seconds for Wave 1 to begin
3. Click the Solar Sprout card in the bottom tray (costs 50 energy)
4. Click any lane cell to place the defender
5. Solar Sprout auto-attacks enemies that enter its range
6. Survive all 3 waves to win
7. If any enemy reaches the home side (left), you lose

## Future Phases

  Phase 2: More characters, enemies, levels, original artwork
  Phase 3: User accounts, Gmail OTP authentication, profiles
  Phase 4: Firebase Realtime Database integration
  Phase 5: Achievements, settings, complete UI
  Phase 6: Deployment and MIT App Inventor WebViewer integration

## Notes

All game content is original. No assets from Plants vs. Zombies or any commercial game were used.
The prototype uses procedurally drawn Phaser Graphics as character placeholders.
Sprite sheets can be added by updating GW.ASSETS in config.js and loading in BootScene.preload().
This is Part 1 of a larger development process.
