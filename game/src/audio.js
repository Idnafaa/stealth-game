// Every sound is cooked in the browser: soft footfalls, a pebble's clatter,
// the orchid's chime, the watchman's shout. No audio files, nothing fetched.
// The context wakes on the first key or click, as browsers require.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let ambienceStarted = false;
  let noiseBuffer = null;

  function ensure() {
    if (context !== null) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;
    context = new Ctor();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(context.destination);
    const length = context.sampleRate;
    noiseBuffer = context.createBuffer(1, length, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return true;
  }

  function tone(freqFrom, freqTo, seconds, type, volume, delay) {
    if (!ensure()) return;
    const start = context.currentTime + (delay || 0);
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), start + seconds);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + seconds + 0.02);
  }

  function noise(seconds, volume, filterFreq, delay) {
    if (!ensure()) return;
    const start = context.currentTime + (delay || 0);
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start, Math.random() * 0.5);
    source.stop(start + seconds + 0.02);
  }

  return {
    unlock() {
      if (ensure() && !ambienceStarted) {
        ambienceStarted = true;
        // A barely-there night pad: two detuned sines through a low filter.
        const gain = context.createGain();
        gain.gain.value = 0.035;
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        for (const freq of [110, 164.8]) {
          const osc = context.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = freq;
          osc.connect(filter);
          osc.start();
        }
        filter.connect(gain);
        gain.connect(master);
      }
    },
    setMuted(next) {
      muted = next;
      if (master) master.gain.value = muted ? 0 : 0.55;
      return muted;
    },
    isMuted() {
      return muted;
    },
    step(sneaking) {
      noise(0.07, sneaking ? 0.03 : 0.09, sneaking ? 500 : 900, 0);
    },
    guardStep(distance) {
      const volume = Math.max(0, 1 - distance / 540) * 0.16;
      if (volume > 0.008) noise(0.09, volume, 650, 0);
    },
    throwPebble() {
      tone(700, 240, 0.18, 'sine', 0.06, 0);
    },
    pebbleLand() {
      noise(0.08, 0.14, 2600, 0);
      tone(1900, 1200, 0.07, 'triangle', 0.05, 0.01);
      noise(0.06, 0.08, 2200, 0.09);
    },
    pickup() {
      tone(880, 880, 0.14, 'sine', 0.12, 0);
      tone(1318, 1318, 0.2, 'sine', 0.1, 0.1);
      tone(1760, 1760, 0.26, 'sine', 0.07, 0.2);
    },
    suspicious() {
      tone(520, 660, 0.12, 'triangle', 0.08, 0);
    },
    alert() {
      tone(392, 392, 0.12, 'square', 0.09, 0);
      tone(392, 392, 0.12, 'square', 0.09, 0.16);
      tone(587, 587, 0.22, 'square', 0.1, 0.32);
    },
    caught() {
      tone(220, 55, 0.5, 'sawtooth', 0.16, 0);
      noise(0.3, 0.12, 500, 0);
    },
    locked() {
      tone(180, 140, 0.14, 'triangle', 0.09, 0);
    },
    door() {
      tone(330, 392, 0.16, 'sine', 0.1, 0);
      tone(523, 659, 0.24, 'sine', 0.1, 0.14);
    },
    clear() {
      tone(523, 523, 0.16, 'sine', 0.11, 0);
      tone(659, 659, 0.16, 'sine', 0.11, 0.14);
      tone(784, 784, 0.3, 'sine', 0.11, 0.28);
    },
    ui() {
      tone(660, 660, 0.07, 'sine', 0.07, 0);
    },
  };
}
