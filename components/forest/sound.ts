/** A small original procedural score: wind, distant birds and a soft pentatonic bed. */
export class ForestSound {
  private context: AudioContext | null = null;
  private volume: GainNode | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private enabled = false;
  private destroyed = false;

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!this.context && enabled) this.initialize();
    if (!this.context || !this.volume) return;
    if (enabled) void this.context.resume().catch(() => undefined);
    this.volume.gain.setTargetAtTime(enabled ? 0.33 : 0, this.context.currentTime, 0.7);
  }

  private initialize() {
    if (this.destroyed || typeof AudioContext === "undefined") return;
    const context = new AudioContext();
    this.context = context;
    const volume = context.createGain();
    this.volume = volume;
    volume.gain.value = 0;
    const compressor = context.createDynamicsCompressor();
    volume.connect(compressor);
    compressor.connect(context.destination);

    const buffer = context.createBuffer(2, context.sampleRate * 7, context.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        last = (last + (Math.random() * 2 - 1) * 0.024) / 1.024;
        data[i] = last * 2.6;
      }
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 780;
    const wind = context.createGain();
    wind.gain.value = 0.46;
    source.connect(filter).connect(wind).connect(volume);
    source.start();

    [130.8128, 195.9977, 261.6256, 329.6276].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index % 2 ? 3 : -3;
      const gain = context.createGain();
      gain.gain.value = index === 0 ? 0.045 : 0.018;
      const tremolo = context.createOscillator();
      tremolo.frequency.value = 0.07 + index * 0.022;
      const depth = context.createGain();
      depth.gain.value = 0.009;
      tremolo.connect(depth).connect(gain.gain);
      oscillator.connect(gain).connect(volume);
      oscillator.start();
      tremolo.start();
    });

    let beat = 0;
    const notes = [523.251, 659.255, 783.991, 987.767, 1174.659, 783.991, 659.255, 523.251];
    this.interval = setInterval(() => {
      if (!this.enabled || context.state !== "running") return;
      beat++;
      if (beat % 3 === 0) this.tone(notes[Math.floor(Math.random() * notes.length)], 3.8, 0.035, 0);
      if (Math.random() > 0.45) this.bird();
    }, 2300);
  }

  private tone(frequency: number, duration: number, intensity: number, delay: number) {
    if (!this.context || !this.volume) return;
    const context = this.context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const time = context.currentTime + delay;
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(intensity, time + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(gain).connect(this.volume);
    oscillator.start(time);
    oscillator.stop(time + duration);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }

  private bird() {
    if (!this.context || !this.volume) return;
    const context = this.context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const panner = context.createStereoPanner();
    panner.pan.value = Math.random() * 1.6 - 0.8;
    const time = context.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(1700 + Math.random() * 1100, time);
    oscillator.frequency.exponentialRampToValueAtTime(3400, time + 0.07);
    oscillator.frequency.exponentialRampToValueAtTime(2100, time + 0.17);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.025, time + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
    oscillator.connect(gain).connect(panner).connect(this.volume);
    oscillator.start();
    oscillator.stop(time + 0.23);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); panner.disconnect(); };
  }

  chest() {
    if (!this.enabled) return;
    [523.251, 659.255, 783.991, 1046.502, 1318.51].forEach((frequency, i) => this.tone(frequency, 2.5, 0.13, i * 0.13));
  }

  destroy() {
    this.destroyed = true;
    if (this.interval) clearInterval(this.interval);
    if (this.context) void this.context.close().catch(() => undefined);
    this.context = null;
  }
}
