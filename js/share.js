/* Jogatina Família — imagem das equipes para compartilhar no WhatsApp */
(function (global) {
  'use strict';

  const W = 1080, H = 1350;
  const C = {
    bg: '#0b0a10', panel: '#15121d', text: '#f4effc', muted: '#9b93ae',
    fire: '#ff6a2b', fireSoft: 'rgba(255,106,43,.14)', ice: '#29b6f6', iceSoft: 'rgba(41,182,246,.14)', gold: '#ffd166',
  };
  const PIXEL = '"Press Start 2P", monospace';
  const BODY = '"Chakra Petch", system-ui, sans-serif';

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  function avatar(g, name, team, x, y, scale) {
    const px = global.Sprites.build(name, { team, hold: 'none' }).filter((p) => p[1] <= 10);
    g.save();
    g.translate(x, y);
    g.scale(scale, scale);
    global.Sprites.draw(g, px, 1, 2, false);
    g.restore();
  }

  function fit(g, text, maxW, size, weight, family) {
    let s = size;
    do { g.font = `${weight} ${s}px ${family}`; s -= 2; } while (g.measureText(text).width > maxW && s > 18);
    return text;
  }

  function panel(g, y, team, name, players) {
    const isA = team === 'A';
    const col = isA ? C.fire : C.ice;
    const x = 60, w = W - 120, h = 410;
    roundRect(g, x, y, w, h, 36);
    g.fillStyle = C.panel; g.fill();
    g.fillStyle = isA ? C.fireSoft : C.iceSoft; g.fill();
    g.lineWidth = 4; g.strokeStyle = col; g.stroke();
    // faixa de cor
    g.fillStyle = col; g.fillRect(x + 44, y + 48, 14, 56);
    g.fillStyle = col;
    fit(g, name, w - 200, 56, 700, BODY);
    g.textBaseline = 'middle';
    g.fillText(name, x + 80, y + 78);
    g.font = `700 30px ${BODY}`; g.fillStyle = C.muted; g.textAlign = 'right';
    g.fillText(`${players.length}/4`, x + w - 44, y + 78);
    g.textAlign = 'left';
    // jogadores em grade 2 × 2
    players.forEach((p, i) => {
      const cx = x + 44 + (i % 2) * ((w - 88) / 2);
      const cy = y + 150 + Math.floor(i / 2) * 120;
      roundRect(g, cx, cy, (w - 88) / 2 - 16, 100, 22);
      g.fillStyle = 'rgba(255,255,255,.06)'; g.fill();
      avatar(g, p, team, cx + 12, cy + 8, 6);
      g.fillStyle = C.text;
      fit(g, p, (w - 88) / 2 - 150, 44, 700, BODY);
      g.fillText(p, cx + 112, cy + 52);
    });
  }

  async function render({ nameA, nameB, A, B, bench, date, site }) {
    try {
      await Promise.all([
        document.fonts.load(`40px ${PIXEL}`),
        document.fonts.load(`700 40px ${BODY}`),
      ]);
    } catch (e) { /* usa fontes do sistema */ }

    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;

    // fundo
    g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
    const glowA = g.createRadialGradient(150, 0, 0, 150, 0, 700);
    glowA.addColorStop(0, 'rgba(255,106,43,.22)'); glowA.addColorStop(1, 'rgba(255,106,43,0)');
    g.fillStyle = glowA; g.fillRect(0, 0, W, H);
    const glowB = g.createRadialGradient(W, H, 0, W, H, 800);
    glowB.addColorStop(0, 'rgba(41,182,246,.18)'); glowB.addColorStop(1, 'rgba(41,182,246,0)');
    g.fillStyle = glowB; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 4) { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, y, W, 1); }

    // cabeçalho
    g.textBaseline = 'middle';
    g.font = `30px ${PIXEL}`;
    g.fillStyle = C.text; g.fillText('Jogatina', 60, 86);
    const wJ = g.measureText('Jogatina ').width;
    g.fillStyle = C.fire; g.fillText('Família', 60 + wJ, 86);
    g.font = `700 64px ${BODY}`; g.fillStyle = C.text;
    g.fillText('Equipes do próximo combate', 60, 170);
    g.font = `500 32px ${BODY}`; g.fillStyle = C.muted;
    g.fillText(date, 60, 224);

    panel(g, 270, 'A', nameA, A);

    g.font = `56px ${PIXEL}`; g.textAlign = 'center';
    g.fillStyle = '#e8453c'; g.fillText('VS', W / 2 + 5, 742 + 5);
    g.fillStyle = '#29b6f6'; g.fillText('VS', W / 2 - 5, 742 - 5);
    g.fillStyle = '#fff8e1'; g.fillText('VS', W / 2, 742);
    g.textAlign = 'left';

    panel(g, 800, 'B', nameB, B);

    g.font = `600 32px ${BODY}`; g.fillStyle = C.muted;
    if (bench.length) g.fillText(`No banco: ${bench.join(', ')}`, 60, 1260);
    if (site) { g.textAlign = 'right'; g.fillStyle = C.gold; g.fillText(site, W - 60, 1305); g.textAlign = 'left'; }

    return new Promise((resolve) => cv.toBlob(resolve, 'image/png'));
  }

  global.ShareCard = { render };
})(window);
