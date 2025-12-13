export class RobotSound {
  constructor(robot) {
    this.robot = robot
    this.ctx = null
    this.enabled = true // Can be toggled
  }

  initAudio() {
    if (!this.enabled) return
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (AudioContext) {
        this.ctx = new AudioContext()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
  }

  playTone(freq, type, duration, vol = 0.05) {
    if (!this.enabled) return
    this.initAudio()
    if (!this.ctx) return

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = type
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime)

    gain.gain.setValueAtTime(vol, this.ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration)

    osc.connect(gain)
    gain.connect(this.ctx.destination)

    osc.start()
    osc.stop(this.ctx.currentTime + duration)
  }

  playBeep() {
    this.playTone(880, 'sine', 0.1)
  }

  playChirp() {
    if (!this.enabled) return
    this.initAudio()
    if (!this.ctx) return

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.connect(gain)
    gain.connect(this.ctx.destination)

    // Quick sweep
    osc.frequency.setValueAtTime(1000, this.ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(2000, this.ctx.currentTime + 0.1)

    gain.gain.setValueAtTime(0.05, this.ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1)

    osc.start()
    osc.stop(this.ctx.currentTime + 0.1)
  }

  playMessage() {
    // Two tones
    this.playTone(600, 'sine', 0.1)
    setTimeout(() => this.playTone(800, 'sine', 0.1), 100)
  }

  playError() {
    this.playTone(150, 'sawtooth', 0.3, 0.04)
  }
}
