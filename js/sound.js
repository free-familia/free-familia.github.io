/* Free Família — efeitos sonoros 8-bit (Web Audio, sem arquivos) */
(function (global) {
  'use strict';

  const KEY = 'free-familia:mute';
  let muted = false;
  try { muted = localStorage.getItem(KEY) === '1'; } catch (e) { /* sem armazenamento */ }

  let ctx = null;
  function ac() {
    if (!ctx) {
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // uma nota de onda quadrada/triangular com envelope curto
  function note(freq, start, dur, opts = {}) {
    const a = ac();
    if (!a) return;
    const t0 = a.currentTime + start;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = opts.type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slide) osc.frequency.exponentialRampToValueAtTime(opts.slide, t0 + dur);
    const vol = (opts.vol || 0.12);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  const N = { C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880, B5: 987.77, C6: 1046.5, E6: 1318.5, G6: 1568, C4: 261.63, G4: 392 };

  const SOUNDS = {
    click() { note(1200, 0, 0.04, { vol: 0.05 }); },
    tick(i = 0) { note(500 + (i % 6) * 90, 0, 0.05, { vol: 0.06 }); },
    reveal() {
      [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => note(f, i * 0.07, 0.12));
      note(N.C4, 0, 0.32, { type: 'triangle', vol: 0.15 });
    },
    win() {
      const seq = [[N.G5, 0, 0.1], [N.G5, 0.11, 0.1], [N.G5, 0.22, 0.1], [N.E5, 0.33, 0.3],
        [N.F5, 0.66, 0.1], [N.F5, 0.77, 0.1], [N.F5, 0.88, 0.1], [N.D5, 0.99, 0.3],
        [N.G5, 1.35, 0.12], [N.C6, 1.48, 0.5]];
      seq.forEach(([f, s, d]) => note(f, s, d));
      [N.C4, N.G4, N.C4].forEach((f, i) => note(f, 1.35 + i * 0.16, 0.2, { type: 'triangle', vol: 0.14 }));
    },
    badge() {
      note(N.E6, 0, 0.09, { vol: 0.08 });
      note(N.G6, 0.09, 0.09, { vol: 0.08 });
      note(N.C6 * 2, 0.18, 0.25, { vol: 0.08, type: 'triangle' });
    },
    error() { note(180, 0, 0.18, { slide: 110, vol: 0.08 }); },
    rematch() {
      note(220, 0, 0.12, { slide: 440 });
      note(N.A5, 0.14, 0.1);
      note(N.A5, 0.26, 0.2);
    },
  };

  global.Sfx = {
    play(name, arg) {
      if (muted || !SOUNDS[name]) return;
      try { SOUNDS[name](arg); } catch (e) { /* áudio indisponível */ }
    },
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch (e) { /* ignore */ }
      if (!muted) SOUNDS.click();
      return muted;
    },
  };
})(window);
