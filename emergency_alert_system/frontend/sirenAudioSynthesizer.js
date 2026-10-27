/**
 * sirenAudioSynthesizer.js
 * Dual-Tone Acoustic Emergency Warning Siren Web Audio Synthesizer
 * Emulates standard civil defense & outdoor omnidirectional alert siren horns.
 */

class EmergencySirenSynthesizer {
  constructor() {
    this.audioCtx = null;
    this.oscillator = null;
    this.gainNode = null;
    this.intervalId = null;
    this.isPlaying = false;
  }

  initContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  start() {
    if (this.isPlaying) return;
    this.initContext();
    if (!this.audioCtx) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(650, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(0.18, this.audioCtx.currentTime);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      let step = 0;
      this.intervalId = setInterval(() => {
        if (!this.audioCtx || osc.playbackState === 3) return;
        const now = this.audioCtx.currentTime;
        // Dual-tone wail frequency sweep: 600Hz <-> 960Hz
        const freq = step % 2 === 0 ? 960 : 600;
        osc.frequency.exponentialRampToValueAtTime(freq, now + 0.45);
        step++;
      }, 550);

      osc.start();
      this.oscillator = osc;
      this.gainNode = gain;
      this.isPlaying = true;
    } catch (e) {
      console.warn('Could not start emergency siren synthesizer:', e);
    }
  }

  stop() {
    if (!this.isPlaying) return;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.oscillator) {
      try {
        this.oscillator.stop();
        this.oscillator.disconnect();
      } catch (e) {}
      this.oscillator = null;
    }
    this.isPlaying = false;
  }

  toggle() {
    if (this.isPlaying) {
      this.stop();
      return false;
    } else {
      this.start();
      return true;
    }
  }
}

export const sirenSynthesizer = new EmergencySirenSynthesizer();
export default sirenSynthesizer;
