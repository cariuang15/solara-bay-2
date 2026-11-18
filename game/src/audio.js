// Suara disintesis langsung dengan WebAudio: tidak ada berkas suara,
// tidak ada unduhan. Mesin mobil, sirene polisi, tembakan, pukulan, dan
// nada misi semuanya dibuat dari osilator dan derau.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let engineNodes = null;
  let sirenNodes = null;

  /** Konteks audio baru dibuat saat pemain pertama kali berinteraksi. */
  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  /** Derau putih pendek untuk tembakan dan ledakan. */
  function noiseBuffer(seconds) {
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** Satu denting nada: osilator yang naik lalu mereda. */
  function blip(freq, duration, type, volume, slideTo) {
    if (!ensure()) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  /** Semburan derau: tembakan, tabrakan, ledakan. */
  function burst(duration, volume, lowpass) {
    if (!ensure()) return;
    const now = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer(duration);
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
    source.stop(now + duration + 0.02);
  }

  return {
    unlock() {
      ensure();
    },
    isMuted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      if (muted) this.stopEngine();
      return muted;
    },
    click() {
      blip(660, 0.07, 'square', 0.12);
    },
    punch() {
      blip(140, 0.12, 'sine', 0.4, 60);
      burst(0.08, 0.15, 900);
    },
    shoot() {
      burst(0.14, 0.5, 3200);
      blip(900, 0.08, 'square', 0.1, 220);
    },
    crash() {
      burst(0.25, 0.45, 700);
      blip(90, 0.25, 'sine', 0.4, 40);
    },
    explosion() {
      burst(0.7, 0.7, 500);
      blip(70, 0.6, 'sine', 0.5, 30);
    },
    pickup() {
      blip(880, 0.09, 'sine', 0.25);
      setTimeout(() => blip(1318, 0.12, 'sine', 0.25), 70);
    },
    cash() {
      blip(1046, 0.1, 'triangle', 0.3);
      setTimeout(() => blip(1568, 0.16, 'triangle', 0.3), 80);
    },
    missionWin() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((freq, i) => setTimeout(() => blip(freq, 0.22, 'triangle', 0.3), i * 110));
    },
    missionFail() {
      blip(392, 0.25, 'sawtooth', 0.2, 196);
      setTimeout(() => blip(311, 0.35, 'sawtooth', 0.2, 155), 200);
    },
    busted() {
      blip(220, 0.4, 'square', 0.2, 110);
      setTimeout(() => blip(165, 0.5, 'square', 0.2, 82), 250);
    },
    /** Dengung mesin yang mengikuti kecepatan mobil; dipanggil tiap frame. */
    engine(speed01) {
      if (muted) return;
      if (!ensure()) return;
      if (!engineNodes) {
        const osc = context.createOscillator();
        const gain = context.createGain();
        const filter = context.createBiquadFilter();
        osc.type = 'sawtooth';
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        gain.gain.value = 0;
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        osc.start();
        engineNodes = { osc, gain };
      }
      const now = context.currentTime;
      engineNodes.osc.frequency.setTargetAtTime(55 + speed01 * 130, now, 0.08);
      engineNodes.gain.gain.setTargetAtTime(speed01 > 0.02 ? 0.05 + speed01 * 0.05 : 0, now, 0.1);
    },
    stopEngine() {
      if (!engineNodes) return;
      try {
        engineNodes.gain.gain.value = 0;
        engineNodes.osc.stop();
      } catch {
        // Sudah berhenti.
      }
      engineNodes = null;
    },
    /** Sirene dua nada polisi; menyala saat polisi mengejar. */
    siren(on) {
      if (!on) {
        if (sirenNodes) {
          try {
            sirenNodes.osc.stop();
          } catch {
            // Sudah berhenti.
          }
          sirenNodes = null;
        }
        return;
      }
      if (muted || !ensure() || sirenNodes) return;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 720;
      gain.gain.value = 0.045;
      const lfo = context.createOscillator();
      lfo.frequency.value = 1.6;
      const lfoGain = context.createGain();
      lfoGain.gain.value = 210;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      lfo.start();
      sirenNodes = { osc, lfo };
    },
  };
}
