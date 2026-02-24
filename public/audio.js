(function () {
  const AUDIO_KEY = 'arenaAudioEnabled';

  class AudioManager {
    constructor() {
      this.enabled = localStorage.getItem(AUDIO_KEY) !== 'false';
      this.unlocked = false;
      this.sounds = {
        click: this.createAudio('/audio/click.mp3', 0.45),
        hit: this.createAudio('/audio/hit.mp3', 0.55),
        coin: this.createAudio('/audio/coin.mp3', 0.55),
        crowd: this.createAudio('/audio/crowd-loop.mp3', 0.2, true)
      };
      this.bindUnlock();
    }

    createAudio(src, volume, loop = false) {
      const audio = new Audio(src);
      audio.volume = volume;
      audio.loop = loop;
      audio.preload = 'auto';
      audio.addEventListener('error', () => {
        audio.__missing = true;
      });
      return audio;
    }

    bindUnlock() {
      const unlock = () => {
        this.unlocked = true;
        if (this.enabled) this.playCrowd();
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('pointerdown', unlock, { once: true });
      window.addEventListener('keydown', unlock, { once: true });
    }

    setEnabled(next) {
      this.enabled = !!next;
      localStorage.setItem(AUDIO_KEY, String(this.enabled));
      if (!this.enabled) {
        this.stopCrowd();
      } else if (this.unlocked) {
        this.playCrowd();
      }
    }

    play(name) {
      if (!this.enabled || !this.unlocked) return;
      const sound = this.sounds[name];
      if (!sound || sound.__missing) return;
      try {
        sound.currentTime = 0;
        sound.play().catch(() => {});
      } catch (_error) {}
    }

    playCrowd() {
      const crowd = this.sounds.crowd;
      if (!crowd || crowd.__missing) return;
      crowd.play().catch(() => {});
    }

    stopCrowd() {
      const crowd = this.sounds.crowd;
      if (!crowd) return;
      crowd.pause();
      crowd.currentTime = 0;
    }
  }

  window.AudioManager = new AudioManager();
})();
