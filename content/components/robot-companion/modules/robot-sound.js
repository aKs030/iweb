import { createLogger } from '/content/utils/shared-utilities.js';
const log = createLogger('RobotSound');

export class RobotSound {
  constructor(robot) {
    this.robot = robot;
    this.ctx = null;
    this.enabled = true; // Can be toggled
  }

  initAudio() {
    if (!this.enabled) return;

    // Lazy create audio context only on user interaction or when allowed
    if (!this.ctx) {
      const AudioContext =
        typeof globalThis !== 'undefined'
          ? globalThis.AudioContext || globalThis.webkitAudioContext
          : undefined;
      if (AudioContext) {
        try {
          this.ctx = new AudioContext();
        } catch (err) {
          // Some browsers may block creation until a user gesture; set up a one-time resume on gesture
          this._setupGestureResume();
          log.warn('RobotSound: AudioContext creation blocked', err);
          return;
        }
      }
    }

    // If context exists but suspended, try to resume; if not allowed, wire up gesture resume
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {
          this._setupGestureResume();
        });
      }
    }
  }

  playTone(freq, type, duration, vol = 0.05) {
    if (!this.enabled) return;
    this.initAudio();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    try {
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    } catch (e) {
      // If setting fails because context not ready, abort
      log.warn('Cannot set frequency, audio context not ready', e);
      return;
    }

    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    try {
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        this.ctx.currentTime + duration,
      );
    } catch (err) {
      log.warn('RobotSound: gain ramp failed', err);
    }

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    try {
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      log.warn(
        'Oscillator start failed (likely due to autoplay restrictions)',
        e,
      );
    }
  }

  playBeep() {
    this.playTone(880, 'sine', 0.1);
  }

  playChirp() {
    if (!this.enabled) return;
    this.initAudio();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    // Quick sweep
    osc.frequency.setValueAtTime(1000, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      2000,
      this.ctx.currentTime + 0.1,
    );

    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playMessage() {
    // Two tones
    this.playTone(600, 'sine', 0.1);
    setTimeout(() => this.playTone(800, 'sine', 0.1), 100);
  }

  playError() {
    this.playTone(150, 'sawtooth', 0.3, 0.04);
  }

  _setupGestureResume() {
    if (this._gestureBound) return;
    this._gestureBound = true;
    const resume = async () => {
      try {
        if (!this.ctx) {
          const AudioContext =
            typeof globalThis !== 'undefined'
              ? globalThis.AudioContext || globalThis.webkitAudioContext
              : undefined;
          if (AudioContext) this.ctx = new AudioContext();
        }
        if (this.ctx && this.ctx.state === 'suspended') await this.ctx.resume();
      } catch (err) {
        log.warn('RobotSound: resume gesture handler failed', err);
      } finally {
        document.body.removeEventListener('pointerdown', resume);
        document.body.removeEventListener('keydown', resume);
        this._gestureBound = false;
      }
    };
    document.body.addEventListener('pointerdown', resume, { once: true });
    document.body.addEventListener('keydown', resume, { once: true });
  }
}
