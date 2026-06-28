// Procedural sound effects via the Web Audio API — no audio files needed.
// Sounds are short synthesized blips so the game has audible feedback.
export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  // Lazily create / resume the audio context (must follow a user gesture).
  resume() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.enabled = false; return null; }
      try { this.ctx = new AC(); } catch { this.enabled = false; return null; }
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  _tone(freq, dur, type = "sine", gain = 0.18, slideTo = null, delay = 0) {
    if (!this.enabled) return;
    const ctx = this.resume();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur);
  }

  _noise(dur, gain = 0.2, filterFreq = 1500) {
    if (!this.enabled) return;
    const ctx = this.resume();
    if (!ctx) return;
    const src = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, Math.max(1, ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    src.connect(filter).connect(g).connect(ctx.destination);
    src.start();
    src.stop(ctx.currentTime + dur);
  }

  break() { this._noise(0.18, 0.22, 1800); }
  place() { this._tone(170, 0.12, "square", 0.16, 110); }
  hurt() { this._tone(320, 0.25, "sawtooth", 0.22, 80); }
  step() { this._noise(0.05, 0.05, 600); }
  craft() { this._tone(520, 0.09, "square", 0.13); this._tone(700, 0.1, "square", 0.13, null, 0.09); }
  portal() { this._tone(110, 0.7, "sine", 0.16, 520); }

  toggle() { this.enabled = !this.enabled; return this.enabled; }
}
