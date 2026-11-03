/* Free Família — pixel sprites (12 × 18 px, desenhados à mão em texto)
 * Legenda: K contorno · S pele · s pele sombra · H cabelo · T camisa · t camisa sombra
 *          P calça · B bota · M boca · E olho · C/c boné/gorro · R bandana
 * Para personalizar um jogador, edite o objeto CHARS (pele, cabelo, acessórios).
 */
(function (global) {
  'use strict';

  const OUT = '#1a1020';

  const BASE = [
    '............',
    '....KKKKK...',
    '...KSSSSSK..',
    '..KSSSSSSSK.',
    '..KSSSESSEK.',
    '..KSSSSSSSK.',
    '..KsSSSSMSK.',
    '...KsSSSSK..',
    '....KKSKK...',
    '...KTTTTTK..',
    '..KTTTTTTTK.',
    '..KTtTTTTTK.',
    '..KStTTTTK..',
    '...KTTTTTK..',
    '...KPPPPPK..',
    '...KPPKPPK..',
    '...KPPKPPK..',
    '..KBBBKBBBK.',
  ];

  const HAIR = {
    short: [
      '...KKKKKK...',
      '..KHHHHHHHK.',
      '..KHHHHHHHK.',
      '..KHHSSSHSK.',
      '..KHS.......',
      '..KH........',
    ],
    long: [
      '...KKKKKK...',
      '..KHHHHHHHK.',
      '.KHHHHHHHHK.',
      '.KHHHSSSSHK.',
      '.KHHS.......',
      '.KHH........',
      '.KHH........',
      '.KHHK.......',
      '.KHHK.......',
      '.KHHK.......',
      '..KK........',
    ],
    cap: [
      '...KKKKKK...',
      '..KCCCCCCCK.',
      '..KCCCCCCccK',
      '..KHH.......',
    ],
    spiky: [
      '..HKHKHKHK..',
      '..KHHHHHHHK.',
      '..KHHHHHHHK.',
      '..KHSHSSHSK.',
      '..KH........',
    ],
    afro: [
      '..KKKKKKK...',
      '.KHHHHHHHHK.',
      'KHHHHHHHHHHK',
      'KHHHSSSSHHK.',
      '.KHH........',
      '..KH........',
    ],
    beanie: [
      '...KKKKKK...',
      '..KCCCCCCCK.',
      '..KCCCCCCCK.',
      '..KcccccccK.',
      '..KH........',
    ],
  };

  const CHARS = {
    Miguel:    { style: 'short',  hair: '#2a1a12', skin: '#c98b5e', beard: true },
    Aline:     { style: 'long',   hair: '#6b3a1c', skin: '#e3ad80', bow: '#ff5fa2', blush: true },
    Railander: { style: 'short',  hair: '#17110d', skin: '#b97a4f', bandana: '#e23b3b' },
    Iago:      { style: 'cap',    hair: '#3a2416', skin: '#d79a6a', cap: '#e04848' },
    Alesson:   { style: 'short',  hair: '#1a1410', skin: '#c48a5c', shades: true },
    Benjamin:  { style: 'beanie', hair: '#4a2c18', skin: '#e3b088', cap: '#ffd166' },
    Talisson:  { style: 'short',  hair: '#24180f', skin: '#b07548' },
    'Isaías':  { style: 'spiky',  hair: '#2a1a12', skin: '#d29a6c' },
    Isaac:     { style: 'afro',   hair: '#1e140d', skin: '#a86b42' },
  };
  const DEFAULT = { style: 'short', hair: '#2a1a12', skin: '#c98b5e' };

  const TEAMS = {
    A: { T: '#ff6a2b', t: '#c2431a', P: '#3b3f2c' },
    B: { T: '#29b6f6', t: '#1679a8', P: '#25304a' },
    N: { T: '#7c8196', t: '#585c6e', P: '#34374a' },
  };

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const ch = [n >> 16, (n >> 8) & 255, n & 255].map((c) =>
      amt < 0 ? Math.round(c * (1 + amt)) : Math.round(c + (255 - c) * amt)
    );
    return '#' + ch.map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Monta a lista de pixels [x, y, cor] de um personagem virado para a direita.
   * o.team 'A' | 'B' | 'N' · o.hold 'gun' | 'none' | 'book' | 'phone'
   * o.blink · o.love (olhos de coração) · o.flash (disparo) · o.screen (cor da tela do celular)
   */
  function build(name, o = {}) {
    const c = CHARS[name] || DEFAULT;
    const team = TEAMS[o.team] || TEAMS.N;
    const capCol = c.cap || '#888888';
    const pal = {
      K: OUT, E: OUT, M: '#9c3f3a', B: '#2a1d14', G: '#26262e', g: '#60657a',
      S: c.skin, s: shade(c.skin, -0.2), H: c.hair, C: capCol, c: shade(capCol, -0.3),
      T: team.T, t: team.t, P: team.P, R: c.bandana || '#e23b3b',
    };
    const m = new Map();
    const set = (x, y, col) => m.set(x + ',' + y, [x, y, col]);
    const paint = (rows) =>
      rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const ch = row[x];
          if (ch !== '.') set(x, y, pal[ch]);
        }
      });

    paint(BASE);
    paint(HAIR[c.style] || HAIR.short);

    if (c.style === 'beanie') { set(5, -1, pal.C); set(6, -1, pal.C); }
    if (c.bandana) {
      for (let x = 2; x <= 9; x++) set(x, 3, pal.R);
      set(1, 3, pal.R); set(1, 4, pal.R); set(0, 5, pal.R);
    }
    if (c.beard) [5, 6, 7, 8].forEach((x) => set(x, 7, shade(c.hair, 0.1)));

    const eye = o.love ? '#ff3d6e' : o.blink ? pal.S : OUT;
    set(6, 4, eye); set(9, 4, eye);
    if (o.love) { set(6, 3, '#ff3d6e'); set(9, 3, '#ff3d6e'); }

    if (c.blush || o.love) { set(5, 6, '#ff8fa8'); set(9, 6, '#ff8fa8'); }

    if (c.shades) {
      set(4, 4, OUT); set(5, 4, '#6fd3ff'); set(6, 4, '#0d0d12');
      set(7, 4, OUT); set(8, 4, '#0d0d12'); set(9, 4, '#0d0d12');
    }

    if (c.bow) {
      const d = shade(c.bow, -0.35);
      set(1, -1, c.bow); set(3, -1, c.bow);
      set(1, 0, c.bow); set(2, 0, d); set(3, 0, c.bow);
      set(1, 1, c.bow);
    }

    const hold = o.hold || 'gun';
    if (hold === 'gun') {
      for (let x = 5; x <= 11; x++) set(x, 10, pal.G);
      set(12, 10, pal.g); set(7, 10, pal.g);
      [3, 4, 5, 6].forEach((x) => set(x, 11, pal.G));
      set(7, 11, pal.S); set(8, 11, pal.G); set(9, 11, pal.G);
      set(9, 12, pal.g); set(4, 12, pal.G);
      if (o.flash) {
        set(13, 10, '#fff6c2'); set(14, 10, '#ffd166'); set(15, 10, '#ff8a3d');
        set(13, 9, '#ffb547'); set(13, 11, '#ffb547');
      }
    } else if (hold === 'book') {
      for (let y = 5; y <= 9; y++) for (let x = 10; x <= 13; x++) set(x, y, '#3b2414');
      for (let y = 5; y <= 9; y++) set(13, y, '#f4e7c8');
      const gold = '#ffd166';
      set(11, 6, gold); set(11, 7, gold); set(11, 8, gold); set(10, 7, gold); set(12, 7, gold);
      set(10, 10, pal.S); set(11, 10, pal.S);
    } else if (hold === 'phone') {
      const scr = o.screen || '#7fe3ff';
      for (let y = 5; y <= 9; y++) for (let x = 10; x <= 11; x++) set(x, y, '#15151c');
      for (let y = 6; y <= 8; y++) { set(10, y, scr); set(11, y, scr); }
      set(10, 10, pal.S); set(11, 10, pal.S);
    }

    return Array.from(m.values());
  }

  /** Desenha os pixels; flip espelha para olhar à esquerda. */
  function draw(ctx, pixels, left, top, flip) {
    for (let i = 0; i < pixels.length; i++) {
      const p = pixels[i];
      ctx.fillStyle = p[2];
      ctx.fillRect(left + (flip ? 11 - p[0] : p[0]), top + p[1], 1, 1);
    }
  }

  const cache = new Map();
  /** Retrato (data URL) para chips, ranking e histórico. */
  function avatarURL(name, team = 'N') {
    const key = name + '|' + team;
    if (cache.has(key)) return cache.get(key);
    const cv = document.createElement('canvas');
    cv.width = 14; cv.height = 13;
    const ctx = cv.getContext('2d');
    // só cabeça e ombros: recorta as linhas -1..11
    draw(ctx, build(name, { team, hold: 'none' }), 1, 2, false);
    const url = cv.toDataURL();
    cache.set(key, url);
    return url;
  }

  global.Sprites = { build, draw, avatarURL, shade, CHARS, TEAMS };
})(window);
