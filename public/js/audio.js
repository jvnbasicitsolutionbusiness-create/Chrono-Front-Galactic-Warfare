/* Original soundtrack playback and synthesized sound effects for Galactic Warfare. */
(function () {
  'use strict';

  const STORAGE_KEY = 'gw_audio_enabled';
  const MUSIC_ROOT = 'public/assets/audio/music/';
  const SFX_ROOT = 'public/assets/audio/sfx/';
  const TRACKS = {
    loading: 'loading-screen.wav',
    auth: 'authentication.wav',
    menu: 'main-menu.wav',
  };
  const ENVIRONMENT_TRACKS = {
    daytime: 'battle-daytime.wav',
    nighttime: 'battle-nighttime.wav',
    foggy: 'battle-foggy.wav',
    rainy_stormy: 'battle-storm.wav',
    radioactive: 'battle-radioactive.wav',
  };

  let audioUnlocked = false;
  let musicVolume = 0.6;
  let sfxVolume = 0.8;
  const activeSounds = new Set();
  const musicPlayer = new Audio();
  musicPlayer.loop = true;
  musicPlayer.preload = 'auto';
  let currentScene = 'loading';
  let currentEnvironment = 'daytime';
  let enabled = readEnabled();

  function readEnabled() {
    try { return localStorage.getItem(STORAGE_KEY) !== 'false'; } catch (_) { return true; }
  }

  function getVolumes() {
    const progression = window.GW && window.GW.progression;
    const music = progression && progression.getSetting
      ? progression.getSetting('musicVolume') : 0.6;
    const sfx = progression && progression.getSetting
      ? progression.getSetting('sfxVolume') : 0.8;
    return { music: Number(music), sfx: Number(sfx) };
  }

  function updateVolumes(musicValue, sfxValue) {
    const defaults = getVolumes();
    const music = musicValue === undefined ? defaults.music : Number(musicValue);
    const sfx = sfxValue === undefined ? defaults.sfx : Number(sfxValue);
    musicVolume = Math.max(0, Math.min(1, music));
    sfxVolume = Math.max(0, Math.min(1, sfx));
    musicPlayer.volume = enabled ? musicVolume : 0;
    activeSounds.forEach(sound => { sound.volume = enabled ? sfxVolume : 0; });
  }

  function selectedTrack() {
    const file = currentScene === 'battle'
      ? ENVIRONMENT_TRACKS[currentEnvironment] || ENVIRONMENT_TRACKS.daytime
      : TRACKS[currentScene] || TRACKS.menu;
    return MUSIC_ROOT + file;
  }

  function startMusic() {
    if (!audioUnlocked || !enabled) return;
    musicPlayer.play().catch(() => {});
  }

  function unlock() {
    audioUnlocked = true;
    updateVolumes();
    startMusic();
    document.querySelectorAll('[data-audio-toggle]').forEach(button => {
      button.textContent = enabled ? 'MUTE SOUND' : 'ENABLE SOUND';
      button.setAttribute('aria-pressed', String(enabled));
    });
  }

  function setScene(scene, environment) {
    if (!TRACKS[scene] && scene !== 'battle') return;
    currentScene = scene;
    if (environment && ENVIRONMENT_TRACKS[environment]) currentEnvironment = environment;
    const track = selectedTrack();
    if (musicPlayer.getAttribute('src') !== track) {
      musicPlayer.pause();
      musicPlayer.currentTime = 0;
      musicPlayer.src = track;
      musicPlayer.load();
    }
    startMusic();
  }

  function play(effect) {
    if (!audioUnlocked || !enabled || !effect) return;
    const sound = new Audio(SFX_ROOT + effect + '.wav');
    sound.volume = sfxVolume;
    activeSounds.add(sound);
    sound.addEventListener('ended', () => activeSounds.delete(sound), { once: true });
    sound.play().catch(() => activeSounds.delete(sound));
  }

  function playButton(button) {
    if (!button || button.matches('[data-audio-toggle]')) return;
    let cue = button.dataset.audioCue;
    if (!cue && button.classList.contains('phase-tab')) cue = 'phase-' + button.dataset.phase;
    if (!cue && button.classList.contains('extras-tab-btn')) cue = 'extras-' + button.dataset.extab;
    if (!cue) cue = button.id || 'unassigned';
    const normalizedCue = cue.toLowerCase();
    play(normalizedCue === 'briefingstart' || normalizedCue === 'briefingdismiss'
      ? 'battle-deploy'
      : 'ui-' + normalizedCue);
  }

  function toggle() {
    if (!audioUnlocked) {
      enabled = true;
      unlock();
    } else {
      enabled = !enabled;
      unlock();
      updateVolumes();
    }
    try { localStorage.setItem(STORAGE_KEY, String(enabled)); } catch (_) {}
    if (!enabled) musicPlayer.pause();
    else startMusic();
    if (!enabled) {
      activeSounds.forEach(sound => { sound.pause(); sound.currentTime = 0; });
      activeSounds.clear();
    }
    document.querySelectorAll('[data-audio-toggle]').forEach(button => {
      button.textContent = enabled ? 'MUTE SOUND' : 'ENABLE SOUND';
      button.setAttribute('aria-pressed', String(enabled));
    });
    return enabled;
  }

  document.addEventListener('pointerdown', event => {
    const audioButton = event.target.closest('[data-audio-toggle]');
    if (audioButton) {
      event.preventDefault();
      toggle();
      return;
    }
    unlock();
    const button = event.target.closest('button');
    if (button) playButton(button);
  }, true);
  document.addEventListener('keydown', unlock, { once: true, capture: true });

  window.GWAudio = { setScene, play, unlock, setVolumes: updateVolumes, toggle };
  document.querySelectorAll('[data-audio-toggle]').forEach(button => {
    button.textContent = 'ENABLE SOUND';
    button.setAttribute('aria-pressed', 'false');
  });
})();