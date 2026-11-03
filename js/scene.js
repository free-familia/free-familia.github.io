/* Free Família — cabeçalho animado em pixel art (canvas 320 × 144) */
(function () {
  'use strict';

  const cvs = document.getElementById('scene');
  const overlay = document.getElementById('stageOverlay');
  if (!cvs || !window.Sprites) return;

  const S = window.Sprites;
  const ctx = cvs.getContext('2d');
  const W = 320, H = 144, FEET = 121;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- utilidades ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(20261103);
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const ease = (v) => v * v * (3 - 2 * v);

  function mix(a, b, k) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = [16, 8, 0].map((s) => {
      const x = (pa >> s) & 255, y = (pb >> s) & 255;
      return Math.round(x + (y - x) * k);
    });
    return 'rgb(' + ch.join(',') + ')';
  }

  function line(g, x0, y0, x1, y1) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      g.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  function layer() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    return c;
  }

  // ---------- cenário estático ----------
  const SIL = '#1b0c26';

  function crate(g, x, y, w, h) {
    g.fillStyle = '#3a2a16'; g.fillRect(x, y, w, h);
    g.fillStyle = '#7a5a30'; g.fillRect(x + 1, y + 1, w - 2, h - 2);
    g.fillStyle = '#a07a42';
    line(g, x + 1, y + 1, x + w - 2, y + h - 2);
    line(g, x + w - 2, y + 1, x + 1, y + h - 2);
    g.fillStyle = '#3a2a16'; g.fillRect(x, y + Math.floor(h / 2), w, 1);
  }

  function palm(g, x0, h, lean) {
    g.fillStyle = SIL;
    let tx = x0, ty = 118;
    for (let i = 0; i < h; i++) {
      tx = Math.round(x0 + lean * Math.pow(i / h, 2) * 7);
      ty = 118 - i;
      g.fillRect(tx, ty, 2, 1);
    }
    const angles = [Math.PI * 1.05, Math.PI * 0.88, -0.12, 0.25, Math.PI * 1.32, Math.PI * 1.72];
    angles.forEach((a) => {
      for (let k = 0; k < 14; k++) {
        const fx = Math.round(tx + 1 + Math.cos(a) * k);
        const fy = Math.round(ty + Math.sin(a) * k + (k * k) / 26);
        g.fillRect(fx, fy, 1, 1);
        if (k > 2 && k < 10) g.fillRect(fx, fy + 1, 1, 1);
      }
    });
  }

  function buildBackground() {
    const L = layer(), g = L.getContext('2d');

    // céu em faixas com dithering
    const bands = ['#0e0820', '#140b2b', '#1c0f37', '#281242', '#3a1649', '#521a4d',
      '#6e1f4e', '#8f274c', '#b33447', '#d64a3f', '#f06a3a', '#ff8c45'];
    bands.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, i * 10, W, 10); });
    for (let i = 1; i < bands.length; i++) {
      const y = i * 10;
      g.fillStyle = bands[i];
      for (let x = i % 2; x < W; x += 2) g.fillRect(x, y - 1, 1, 1);
      g.fillStyle = bands[i - 1];
      for (let x = (i + 1) % 2; x < W; x += 2) g.fillRect(x, y, 1, 1);
    }

    // estrelas
    for (let i = 0; i < 60; i++) {
      g.fillStyle = rnd() > 0.7 ? '#ffffff' : 'rgba(255,255,255,.5)';
      g.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * 50), 1, 1);
    }

    // sol retrô com halo
    const cx = 160, cy = 80;
    for (let r = 40; r > 26; r -= 4) {
      g.fillStyle = 'rgba(255,150,80,.06)';
      for (let y = -r; y <= r; y++) {
        const hw = Math.floor(Math.sqrt(r * r - y * y));
        g.fillRect(cx - hw, cy + y, hw * 2, 1);
      }
    }
    const r = 24;
    for (let y = -r; y <= r; y++) {
      if (y > 2) {
        const gap = Math.min(3, 1 + Math.floor((y - 2) / 7));
        if ((y - 2) % 5 < gap) continue;
      }
      const hw = Math.floor(Math.sqrt(r * r - y * y));
      g.fillStyle = mix('#ffe9a0', '#ff5a4a', (y + r) / (2 * r));
      g.fillRect(cx - hw, cy + y, hw * 2, 1);
    }

    // montanhas distantes
    for (let x = 0; x < W; x++) {
      const y = Math.round(97 + 6 * Math.sin(x * 0.035 + 0.5) + 3 * Math.sin(x * 0.09 + 2) + 1.5 * Math.sin(x * 0.21));
      g.fillStyle = '#4a1d4e'; g.fillRect(x, y, 1, H - y);
      g.fillStyle = '#6a2c5f'; g.fillRect(x, y, 1, 1);
    }
    // colinas
    for (let x = 0; x < W; x++) {
      const y = Math.round(108 + 4 * Math.sin(x * 0.045 + 1) + 2 * Math.sin(x * 0.15 + 3));
      g.fillStyle = '#2a1236'; g.fillRect(x, y, 1, H - y);
      g.fillStyle = '#3a1a45'; g.fillRect(x, y, 1, 1);
    }

    // torre de vigia (esquerda)
    g.fillStyle = SIL;
    line(g, 12, 118, 15, 58); line(g, 13, 118, 16, 58);
    line(g, 28, 118, 25, 58); line(g, 27, 118, 24, 58);
    line(g, 13, 110, 26, 92); line(g, 27, 110, 14, 92);
    line(g, 15, 90, 25, 72); line(g, 25, 90, 15, 72);
    g.fillRect(9, 55, 22, 4);
    g.fillRect(9, 48, 1, 7); g.fillRect(30, 48, 1, 7); g.fillRect(9, 48, 22, 1);
    for (let i = 0; i < 7; i++) {
      const w = Math.round(6 + i * 3.4);
      g.fillRect(20 - Math.floor(w / 2), 41 + i, w, 1);
    }

    // prédio em ruínas (direita)
    const bx = 278, bw = 40, by = 78;
    for (let x = bx; x < bx + bw; x += 4) {
      const top = by + Math.floor(rnd() * 8);
      g.fillStyle = SIL; g.fillRect(x, top, 4, 118 - top);
    }
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const lit = rnd();
        g.fillStyle = lit > 0.72 ? '#ff9d4a' : lit > 0.45 ? '#3a1a45' : '#100717';
        g.fillRect(bx + 4 + col * 9, by + 11 + row * 9, 4, 5);
      }
    }

    // coqueiros
    palm(g, 98, 36, 1);
    palm(g, 226, 32, -1);

    // chão
    g.fillStyle = '#6b4428'; g.fillRect(0, 118, W, H - 118);
    g.fillStyle = '#553420'; g.fillRect(0, 134, W, H - 134);
    for (let i = 0; i < 280; i++) {
      g.fillStyle = rnd() > 0.5 ? '#7d5233' : '#5a381f';
      g.fillRect(Math.floor(rnd() * W), 120 + Math.floor(rnd() * 24), rnd() > 0.8 ? 2 : 1, 1);
    }
    g.fillStyle = '#3d6b34'; g.fillRect(0, 117, W, 2);
    g.fillStyle = '#57913f';
    for (let x = 0; x < W; x++) {
      if (rnd() > 0.6) g.fillRect(x, 116, 1, 1);
      if (rnd() > 0.93) g.fillRect(x, 115, 1, 1);
    }

    crate(g, 3, 107, 12, 12);
    return L;
  }

  function buildBarricade() {
    const L = layer(), g = L.getContext('2d');
    const bag = (x, y) => {
      g.fillStyle = '#6d5530';
      g.fillRect(x + 1, y, 6, 1); g.fillRect(x, y + 1, 8, 4); g.fillRect(x + 1, y + 5, 6, 1);
      g.fillStyle = '#b89a62'; g.fillRect(x + 1, y + 1, 6, 4);
      g.fillStyle = '#d6bd85'; g.fillRect(x + 2, y + 1, 4, 1);
      g.fillStyle = '#9a7e4c'; g.fillRect(x + 1, y + 4, 6, 1);
    };
    [144, 152, 160, 168].forEach((x) => bag(x, 115));
    [148, 156, 164].forEach((x) => bag(x, 110));
    return L;
  }

  const BG = buildBackground();
  const FG = buildBarricade();

  // ---------- elenco ----------
  const cast = [
    { name: 'Iago', x: 26, team: 'A', dir: 1 },
    { name: 'Aline', x: 54, team: 'A', dir: 1, couple: 'L' },
    { name: 'Miguel', x: 80, team: 'A', dir: 1, couple: 'R' },
    { name: 'Railander', x: 116, team: 'A', dir: 1, shooter: true },
    { name: 'Benjamin', x: 190, team: 'B', dir: -1, shooter: true },
    { name: 'Talisson', x: 218, team: 'B', dir: -1, quote: 'Romanos 6.23', hold: 'book', tail: 50 },
    { name: 'Alesson', x: 246, team: 'B', dir: -1 },
    { name: 'Isaías', x: 274, team: 'B', dir: -1, quote: 'Tá cheio de propaganda aqui!', hold: 'phone', tail: 80 },
  ];
  cast.forEach((c, i) => {
    c.phase = i * 0.83;
    c.next = 1 + i * 0.4;
    c.burst = 3;
    c.flashUntil = 0;
  });

  // falas: horários dentro de um ciclo de 12 s
  const BUBBLE_CYCLE = 12;
  const bubbleTimes = { Talisson: [0.4, 5.6], 'Isaías': [6.2, 11.6] };

  // ---------- camada HTML (nomes e balões) ----------
  const bubbles = [];
  let isaacTag = null;
  if (overlay) {
    isaacTag = document.createElement('span');
    isaacTag.className = 'tag tag-b tag-isaac';
    isaacTag.textContent = 'Isaac';
    overlay.appendChild(isaacTag);
    cast.forEach((c, i) => {
      const tag = document.createElement('span');
      tag.className = 'tag tag-' + c.team.toLowerCase() + (i % 2 ? ' tag-alt' : '');
      tag.style.left = (c.x / W) * 100 + '%';
      tag.textContent = c.name;
      overlay.appendChild(tag);

      if (c.quote) {
        const b = document.createElement('div');
        b.className = 'bubble';
        b.style.left = (c.x / W) * 100 + '%';
        b.style.setProperty('--tail', c.tail + '%');
        b.dataset.who = c.name;
        b.setAttribute('aria-hidden', 'true');
        const typed = document.createElement('span');
        const rest = document.createElement('span');
        rest.className = 'bubble-rest';
        rest.textContent = c.quote;
        b.append(typed, rest);
        overlay.appendChild(b);
        bubbles.push({ c, el: b, typed, rest, on: false, shown: -1, times: bubbleTimes[c.name] });
      }
    });
  }

  function updateBubbles(t) {
    const bt = t % BUBBLE_CYCLE;
    bubbles.forEach((b) => {
      const on = reduce || (bt >= b.times[0] && bt < b.times[1]);
      b.c.speaking = on;
      if (on !== b.on) { b.on = on; b.el.classList.toggle('is-on', on); b.shown = -1; }
      if (on) {
        const n = reduce ? b.c.quote.length : Math.min(b.c.quote.length, Math.floor((bt - b.times[0]) * 24));
        if (n !== b.shown) {
          b.shown = n;
          b.typed.textContent = b.c.quote.slice(0, n);
          b.rest.textContent = b.c.quote.slice(n);
        }
      }
    });
  }

  // ---------- entidades dinâmicas ----------
  const tracers = [], sparks = [], hearts = [], smoke = [], ads = [];
  const embers = Array.from({ length: 26 }, () => ({
    x: rand(0, W), y: rand(40, H), vy: rand(-14, -5), ph: rand(0, 6), life: rand(0, 1),
  }));
  const clouds = [
    { x: 20, y: 22, w: 30, v: 2.2 }, { x: 120, y: 34, w: 22, v: 1.6 },
    { x: 210, y: 16, w: 36, v: 2.8 }, { x: 290, y: 40, w: 18, v: 1.2 },
  ];
  const twinkles = Array.from({ length: 8 }, () => ({ x: Math.floor(rand(0, W)), y: Math.floor(rand(2, 46)), ph: rand(0, 6) }));

  let lastSmoke = 0, lastHeart = 0, lastAd = 0, glanceHeartCycle = -1;

  // ---------- casal Aline & Miguel ----------
  const LOVE_CYCLE = 12;
  function love(t) {
    const lt = t % LOVE_CYCLE;
    const glance = lt >= 2 && lt < 2.8;
    const facing = lt >= 6 && lt < 10.4;
    let lean = 0;
    if (lt >= 6.4 && lt < 7.4) lean = ease((lt - 6.4) / 1);
    else if (lt >= 7.4 && lt < 9.4) lean = 1;
    else if (lt >= 9.4 && lt < 10.2) lean = 1 - ease((lt - 9.4) / 0.8);
    const together = lt >= 7.2 && lt < 9.6;
    return { lt, glance, facing, lean, together, cycle: Math.floor(t / LOVE_CYCLE) };
  }

  // ---------- desenho dos elementos ----------
  const DOME = ['....XXXXXXXX....', '..XXXXXXXXXXXX..', '.XXXXXXXXXXXXXX.', 'XXXXXXXXXXXXXXXX'];
  const HEART_S = ['XX.XX', 'XXXXX', '.XXX.', '..X..'];
  const HEART_B = ['.XXX.XXX.', 'XXXXXXXXX', 'XXXXXXXXX', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..', '...XXX...', '....X....'];
  const PLANE = ['KK..............', 'KKK....KKK......', '.KKKKKKKKKKKKKK.', '..KKKKKKKKKKKKKK', '.......KKK......'];
  const GLYPH_A = ['.X.', 'X.X', 'XXX', 'X.X'];
  const GLYPH_D = ['XX.', 'X.X', 'X.X', 'XX.'];

  function bitmap(rows, x, y, col, scale = 1) {
    ctx.fillStyle = col;
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        if (row[i] !== '.') ctx.fillRect(x + i * scale, y + j * scale, scale, scale);
      }
    });
  }

  function drawHeart(x, y, big, alpha) {
    ctx.globalAlpha = alpha;
    const rows = big ? HEART_B : HEART_S;
    bitmap(rows, x - 1, y, '#7a0f2e');
    bitmap(rows, x + 1, y, '#7a0f2e');
    bitmap(rows, x, y - 1, '#7a0f2e');
    bitmap(rows, x, y + 1, '#7a0f2e');
    bitmap(rows, x, y, '#ff3d6e');
    ctx.fillStyle = '#ffc2d4';
    ctx.fillRect(x + 1, y + 1, 1, 1);
    if (big) ctx.fillRect(x + 2, y + 1, 1, 1);
    ctx.globalAlpha = 1;
  }

  function drawCloud(c) {
    ctx.fillStyle = 'rgba(80,40,100,.5)';
    const x = Math.round(c.x), y = c.y, w = c.w;
    ctx.fillRect(x, y + 2, w, 3);
    ctx.fillRect(x + 3, y, w - 8, 2);
    ctx.fillRect(x + Math.round(w * 0.3), y - 2, Math.round(w * 0.35), 2);
  }

  function drawAirdrop(t) {
    const pt = t % 16;
    // avião
    const px = Math.round(-30 + pt * 62);
    if (px < W + 20) {
      bitmap(PLANE, px, 12, SIL);
      if (Math.floor(t * 3) % 2) { ctx.fillStyle = '#ff3d3d'; ctx.fillRect(px, 12, 1, 1); }
      ctx.fillStyle = '#ffe27a'; ctx.fillRect(px + 15, 15, 1, 1);
    }
    const release = 3.06;
    if (pt < release) return { landed: false };
    let top = 18 + (pt - release) * 22;
    const landed = top >= 104;
    if (landed) top = 104;
    let alpha = 1;
    if (pt > 13) alpha = Math.max(0, 1 - (pt - 13));
    if (alpha <= 0) return { landed: false };
    const sway = landed ? 0 : Math.round(Math.sin(t * 2.2) * 1.5);
    const cx = 160 + sway, x = cx - 6, y = Math.round(top);
    ctx.globalAlpha = alpha;
    if (!landed) {
      const dx = cx - 8, dy = y - 15;
      DOME.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
          if (row[i] === '.') continue;
          ctx.fillStyle = Math.floor(i / 4) % 2 ? '#f5f1e8' : '#e8453c';
          ctx.fillRect(dx + i, dy + j, 1, 1);
        }
      });
      ctx.fillStyle = 'rgba(245,241,232,.7)';
      line(ctx, dx, dy + 3, x, y); line(ctx, dx + 15, dy + 3, x + 11, y);
      line(ctx, dx + 6, dy + 3, x + 4, y); line(ctx, dx + 9, dy + 3, x + 7, y);
    }
    ctx.fillStyle = '#14213f'; ctx.fillRect(x, y, 12, 10);
    ctx.fillStyle = '#2f5fb8'; ctx.fillRect(x + 1, y + 1, 10, 8);
    ctx.fillStyle = '#4f86e0'; ctx.fillRect(x + 1, y + 1, 10, 2);
    ctx.fillStyle = '#ffd166'; ctx.fillRect(x + 3, y + 1, 1, 8); ctx.fillRect(x + 8, y + 1, 1, 8);
    if (Math.floor(t * 4) % 2) { ctx.fillStyle = '#ff3d3d'; ctx.fillRect(x + 5, y - 1, 2, 1); }
    ctx.globalAlpha = 1;
    return { landed, x: cx, alpha };
  }

  function drawAd(a) {
    const x = Math.round(a.x), y = Math.round(a.y);
    ctx.fillStyle = '#1a1020'; ctx.fillRect(x - 1, y - 1, 11, 9);
    ctx.fillStyle = '#fff8e1'; ctx.fillRect(x, y, 9, 7);
    ctx.fillStyle = '#3a7bff'; ctx.fillRect(x, y, 9, 1);
    ctx.fillStyle = '#ff3d3d'; ctx.fillRect(x + 8, y, 1, 1);
    bitmap(GLYPH_A, x + 1, y + 2, '#e8453c');
    bitmap(GLYPH_D, x + 5, y + 2, '#e8453c');
  }

  // ---------- atualização ----------
  function update(t, dt) {
    const L = love(t);

    // tiros dos atiradores da linha de frente (acertam a barricada)
    cast.forEach((c) => {
      if (!c.shooter || reduce) return;
      if (t >= c.next) {
        const left = c.x - 6;
        const mx = c.dir > 0 ? left + 13 : left - 2;
        tracers.push({ x: mx, y: FEET - 17 + 10, vx: 280 * c.dir, target: c.dir > 0 ? 144 : 176 });
        c.flashUntil = t + 0.06;
        c.burst--;
        if (c.burst > 0) c.next = t + 0.13;
        else { c.burst = 2 + Math.floor(Math.random() * 3); c.next = t + rand(1.4, 3.4); }
      }
    });

    for (let i = tracers.length - 1; i >= 0; i--) {
      const p = tracers[i];
      p.x += p.vx * dt;
      if ((p.vx > 0 && p.x >= p.target) || (p.vx < 0 && p.x <= p.target)) {
        for (let k = 0; k < 4; k++) {
          sparks.push({ x: p.target, y: p.y + rand(-1, 1), vx: -Math.sign(p.vx) * rand(10, 40), vy: rand(-40, -5), life: 0.3 });
        }
        tracers.splice(i, 1);
      }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 160 * dt;
      if (s.life <= 0) sparks.splice(i, 1);
    }

    // corações do casal
    const aline = cast[1], miguel = cast[2];
    const mid = (aline.x + miguel.x) / 2;
    if (L.together && t - lastHeart > 0.18) {
      lastHeart = t;
      hearts.push({ x: mid + rand(-6, 6), y: 98, vx: rand(-5, 5), vy: rand(-16, -9), life: 1.6, max: 1.6 });
    }
    if (L.glance && L.lt > 2.4 && glanceHeartCycle !== L.cycle) {
      glanceHeartCycle = L.cycle;
      hearts.push({ x: aline.x + 2, y: 98, vx: 3, vy: -12, life: 1.4, max: 1.4 });
    }
    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i];
      h.life -= dt; h.x += h.vx * dt + Math.sin((h.life + i) * 6) * 0.15; h.y += h.vy * dt;
      if (h.life <= 0) hearts.splice(i, 1);
    }

    // fumaça do airdrop
    const pt = t % 16;
    if (pt > 7 && pt < 12.5 && t - lastSmoke > 0.1) {
      lastSmoke = t;
      smoke.push({ x: 160 + rand(-2, 2), y: 102, vx: rand(2, 7), vy: rand(-16, -9), life: 2.6, max: 2.6 });
    }
    for (let i = smoke.length - 1; i >= 0; i--) {
      const s = smoke[i];
      s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.life <= 0) smoke.splice(i, 1);
    }

    // anúncios pipocando em volta do Isaías
    const isaias = cast[7];
    if (isaias.speaking && t - lastAd > 0.5) {
      lastAd = t;
      ads.push({ x: rand(252, 280), y: rand(86, 102), life: 1.1 });
    }
    for (let i = ads.length - 1; i >= 0; i--) {
      ads[i].life -= dt;
      if (ads[i].life <= 0) ads.splice(i, 1);
    }

    updateBike(t, dt);

    // brasas
    embers.forEach((e) => {
      e.y += e.vy * dt; e.x += Math.sin(t + e.ph) * 4 * dt; e.life += dt * 0.3;
      if (e.y < 30 || e.x < 0 || e.x > W) { e.y = rand(110, H); e.x = rand(0, W); e.life = 0; }
    });

    clouds.forEach((c) => { c.x += c.v * dt; if (c.x > W + 10) c.x = -c.w - 10; });
  }

  // ---------- Isaac chegando de moto (dando grau) ----------
  const BIKE_W = 32, BIKE_H = 30, PIVOT_X = 23, PIVOT_Y = 29; // pivô = contato da roda traseira
  const PARK = 284;            // x (esquerda do sprite) onde ele estaciona
  const BIKE_CYCLE = 16;
  const bikeCv = document.createElement('canvas');
  bikeCv.width = BIKE_W; bikeCv.height = BIKE_H;
  const bg2 = bikeCv.getContext('2d');
  const dust = [];
  let lastDust = 0, lastPuff = 0;
  const easeOut = (v) => 1 - Math.pow(1 - v, 3);

  function wheel(g, cx, cy, spin) {
    for (let y = -5; y <= 5; y++) {
      for (let x = -5; x <= 5; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (d <= 4.6 && d >= 3.2) { g.fillStyle = '#15151c'; g.fillRect(cx + x, cy + y, 1, 1); }
        else if (d < 3.2 && d >= 2.2) { g.fillStyle = '#4a4f5e'; g.fillRect(cx + x, cy + y, 1, 1); }
      }
    }
    g.fillStyle = '#d6dae4';
    for (let k = 0; k < 2; k++) {
      const a = spin + k * Math.PI;
      g.fillRect(cx + Math.round(Math.cos(a) * 2), cy + Math.round(Math.sin(a) * 2), 1, 1);
      g.fillRect(cx + Math.round(Math.cos(a) * 1), cy + Math.round(Math.sin(a) * 1), 1, 1);
    }
    g.fillRect(cx, cy, 1, 1);
  }

  // desenha moto + Isaac virados para a esquerda no canvas auxiliar
  function paintBike(spin, blink, revving) {
    const g = bg2;
    g.clearRect(0, 0, BIKE_W, BIKE_H);
    const RED = '#e8453c', RED2 = '#ff7a6b', DARK = '#15151c', CHROME = '#c8ccd8';
    // escapamento
    g.fillStyle = CHROME; line(g, 17, 24, 27, 22); line(g, 17, 25, 27, 23);
    g.fillStyle = revving ? '#ff8a3d' : '#7a7f8e'; g.fillRect(28, 22, 1, 2);
    // balança traseira e motor
    g.fillStyle = '#3a3f4f'; line(g, 23, 25, 16, 23);
    g.fillRect(12, 19, 7, 5);
    g.fillStyle = '#5b6070'; g.fillRect(13, 20, 5, 1);
    // tanque / carenagem
    g.fillStyle = DARK; g.fillRect(8, 15, 14, 5);
    g.fillStyle = RED; g.fillRect(9, 16, 12, 3);
    g.fillStyle = RED2; g.fillRect(10, 16, 6, 1);
    g.fillStyle = '#ffd166'; g.fillRect(13, 18, 4, 1);
    // banco e paralamas
    g.fillStyle = DARK; g.fillRect(17, 14, 7, 2);
    g.fillStyle = RED; g.fillRect(21, 18, 6, 1); g.fillRect(3, 19, 5, 1);
    // garfo, guidão e farol
    g.fillStyle = CHROME; line(g, 6, 25, 9, 13); line(g, 7, 25, 10, 13);
    g.fillStyle = DARK; g.fillRect(8, 12, 4, 1);
    g.fillStyle = '#ffe27a'; g.fillRect(4, 15, 2, 2);
    // rodas
    wheel(g, 6, 25, -spin);
    wheel(g, 23, 25, -spin);

    // Isaac (cabeça e tronco do sprite, virado para a esquerda)
    const px = S.build('Isaac', { team: 'B', hold: 'none', blink });
    const top = 4, left = 13;
    for (let i = 0; i < px.length; i++) {
      const p = px[i];
      if (p[1] > 12) continue;
      g.fillStyle = p[2];
      g.fillRect(left + (11 - p[0]), top + p[1], 1, 1);
    }
    // braço até o guidão, perna até a pedaleira
    const T = S.TEAMS.B, skin = S.CHARS.Isaac.skin;
    g.fillStyle = '#1a1020'; g.fillRect(10, 15, 6, 1);
    g.fillStyle = T.T; g.fillRect(12, 14, 4, 1);
    g.fillStyle = skin; g.fillRect(10, 13, 2, 2);
    g.fillStyle = T.P; g.fillRect(17, 16, 4, 2); g.fillRect(16, 18, 3, 4);
    g.fillStyle = '#2a1d14'; g.fillRect(14, 22, 4, 1);
  }

  function bikeState(t) {
    const it = (t + 14.6) % BIKE_CYCLE; // primeira chegada logo após abrir a página
    let x = W + 40, angle = 0, faceRight = false, moving = false, bounce = 0, revving = false, visible = true;
    if (it < 1.2) visible = false;
    else if (it < 3.4) { // chega empinando
      const k = (it - 1.2) / 2.2;
      x = W + 36 + (PARK - W - 36) * easeOut(k);
      angle = 0.42 + Math.sin(it * 9) * 0.04;
      moving = true; revving = true;
    } else if (it < 3.75) { // roda da frente desce
      const k = (it - 3.4) / 0.35;
      x = PARK; angle = 0.42 * (1 - easeOut(k));
      if (k > 0.8) bounce = 1;
    } else if (it < 7.4) { x = PARK; }
    else if (it < 9.4) { // grau parado, acelerando
      const k = (it - 7.4) / 2;
      x = PARK; revving = true;
      angle = k < 0.25 ? 0.5 * easeOut(k / 0.25) : k < 0.8 ? 0.5 + Math.sin(it * 10) * 0.05 : 0.5 * (1 - easeOut((k - 0.8) / 0.2));
    } else if (it < 13) { x = PARK; }
    else if (it < 13.3) { x = PARK; faceRight = true; }
    else if (it < 15.2) { // sai empinando
      const k = (it - 13.3) / 1.9;
      x = PARK + (W + 40 - PARK) * (k * k);
      angle = 0.45 + Math.sin(it * 9) * 0.04;
      faceRight = true; moving = true; revving = true;
    } else visible = false;
    return { x: Math.round(x), angle, faceRight, moving, bounce, revving, visible, it };
  }

  function updateBike(t, dt) {
    const b = bikeState(t);
    if (b.visible && !reduce) {
      const rearX = b.faceRight ? b.x + (BIKE_W - PIVOT_X) : b.x + PIVOT_X;
      if ((b.moving || b.angle > 0.2) && t - lastDust > 0.04) {
        lastDust = t;
        const back = b.faceRight ? -1 : 1;
        dust.push({ x: rearX + back * 2, y: FEET - 1, vx: back * rand(10, 40), vy: rand(-22, -6), life: 0.7, max: 0.7, c: rand(0, 1) > 0.5 ? '#a07a52' : '#c49a6c' });
      }
      if (b.revving && t - lastPuff > 0.09) {
        lastPuff = t;
        const ex = b.faceRight ? b.x + (BIKE_W - 29) : b.x + 29;
        dust.push({ x: ex, y: FEET - 8 - b.angle * 10, vx: (b.faceRight ? -1 : 1) * rand(8, 20), vy: rand(-10, -3), life: 0.9, max: 0.9, c: '#9a93ae', puff: true });
      }
    }
    for (let i = dust.length - 1; i >= 0; i--) {
      const d = dust[i];
      d.life -= dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += (d.puff ? -4 : 50) * dt;
      if (d.life <= 0) dust.splice(i, 1);
    }
  }

  function drawBike(t) {
    const b = bikeState(t);
    dust.forEach((d) => {
      const k = 1 - d.life / d.max;
      const size = d.puff ? 1 + Math.round(k * 3) : 1;
      ctx.globalAlpha = Math.max(0, 0.8 * (1 - k));
      ctx.fillStyle = d.c;
      ctx.fillRect(Math.round(d.x), Math.round(d.y), size, size);
    });
    ctx.globalAlpha = 1;
    if (isaacTag) {
      const cx = b.x + (b.faceRight ? BIKE_W - 18 : 18);
      isaacTag.style.left = (cx / W) * 100 + '%';
      isaacTag.classList.toggle('is-hidden', !b.visible || b.x > W - 14);
    }
    if (!b.visible) return;
    const spin = b.moving || b.revving ? t * 22 : 0;
    const idleShake = !b.moving && b.angle === 0 && Math.floor(t * 12) % 2 ? 1 : 0;
    paintBike(spin, (t % 3.7) < 0.12, b.revving);
    // sombra
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(b.x + 3, FEET, 26, 1);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    const px = b.faceRight ? b.x + (BIKE_W - PIVOT_X) : b.x + PIVOT_X;
    ctx.translate(px, FEET + 1 + b.bounce - idleShake);
    if (b.faceRight) ctx.scale(-1, 1);
    ctx.rotate(b.angle);
    ctx.drawImage(bikeCv, -PIVOT_X, -PIVOT_Y);
    ctx.restore();
  }

  // ---------- render ----------
  function render(t) {
    const L = love(t);
    ctx.drawImage(BG, 0, 0);

    twinkles.forEach((s) => {
      const a = (Math.sin(t * 2 + s.ph) + 1) / 2;
      if (a > 0.6) { ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')'; ctx.fillRect(s.x, s.y, 1, 1); }
    });

    clouds.forEach(drawCloud);
    drawAirdrop(t);

    smoke.forEach((s) => {
      const k = 1 - s.life / s.max;
      const size = 1 + Math.round(k * 4);
      ctx.fillStyle = 'rgba(255,122,89,' + (0.55 * (1 - k)).toFixed(2) + ')';
      ctx.fillRect(Math.round(s.x - size / 2), Math.round(s.y - size / 2), size, size);
    });

    ctx.drawImage(FG, 0, 0);

    ctx.fillStyle = '#ffe27a';
    tracers.forEach((p) => {
      ctx.fillRect(Math.round(p.vx > 0 ? p.x - 6 : p.x), Math.round(p.y), 6, 1);
    });

    // personagens
    cast.forEach((c) => {
      let x = c.x, dir = c.dir, hold = 'gun', isLove = false;
      if (c.couple) {
        const offset = Math.round(L.lean * 7);
        x += c.couple === 'L' ? offset : -offset;
        if (c.couple === 'R' && (L.facing || L.glance)) dir = -1;
        if (L.facing) hold = 'none';
        isLove = L.together;
      }
      if (c.hold && c.speaking) hold = c.hold;
      const bob = Math.sin(t * 2.6 + c.phase) > 0.2 ? 0 : 1;
      const blink = (t + c.phase * 1.7) % 4.2 < 0.12;
      const flash = t < c.flashUntil;
      const recoil = flash ? -dir : 0;
      const screen = Math.floor(t * 6) % 2 ? '#7fe3ff' : '#ffe27a';
      const pixels = S.build(c.name, { team: c.team, hold, blink, love: isLove, flash, screen });

      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(x - 5, FEET, 10, 1);
      S.draw(ctx, pixels, x - 6 + recoil, FEET - 17 + bob, dir < 0);
    });

    drawBike(t);

    sparks.forEach((s) => {
      ctx.fillStyle = s.life > 0.15 ? '#fff6c2' : '#ff8a3d';
      ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
    });

    hearts.forEach((h) => drawHeart(Math.round(h.x), Math.round(h.y), false, Math.min(1, h.life / (h.max * 0.4))));

    // coração grande do casal
    if (L.together) {
      const mid = Math.round((cast[1].x + cast[2].x) / 2);
      const k = L.lt - 7.2;
      const beat = Math.floor(L.lt * 3) % 2;
      const y = 84 - Math.round(ease(clamp01(k / 0.4)) * 4) - beat;
      const alpha = clamp01((9.6 - L.lt) / 0.4);
      if (k < 0.15) drawHeart(mid - 2, y + 4, false, 1);
      else drawHeart(mid - 4, y, true, alpha);
    }

    ads.forEach(drawAd);

    embers.forEach((e) => {
      const a = Math.max(0, 1 - e.life);
      ctx.fillStyle = 'rgba(255,' + (140 + Math.round(e.ph * 15)) + ',70,' + (a * 0.9).toFixed(2) + ')';
      ctx.fillRect(Math.round(e.x), Math.round(e.y), 1, 1);
    });
  }

  // ---------- loop ----------
  let raf = 0, last = 0, t = 0, visible = true;
  function frame(now) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    t += dt;
    updateBubbles(t);
    update(t, dt);
    render(t);
    raf = requestAnimationFrame(frame);
  }
  function start() { if (!raf && !reduce && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  if (reduce) {
    t = 8; // momento do casal juntinho
    updateBubbles(t);
    render(t);
    document.getElementById('stage')?.classList.add('is-static');
  } else {
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
        visible ? start() : stop();
      }).observe(cvs);
    }
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    start();
  }
})();
