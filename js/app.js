/* Free Família — lógica da arena (equipes, placar, ranking, histórico) */
(function () {
  'use strict';

  const PLAYERS = ['Miguel', 'Aline', 'Isaías', 'Talisson', 'Iago', 'Isaac', 'Alesson', 'Benjamin', 'Railander'];
  const MAX_TEAM = 4;
  const KEY = 'free-familia:v1';
  const $ = (id) => document.getElementById(id);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const avatar = (name, team) => window.Sprites ? window.Sprites.avatarURL(name, team) : '';

  // ---------- estado ----------
  function defaults() {
    return {
      v: 1,
      present: Object.fromEntries(PLAYERS.map((p) => [p, true])),
      assign: Object.fromEntries(PLAYERS.map((p) => [p, 'bench'])),
      teamNames: { A: 'Equipe Fogo', B: 'Equipe Gelo' },
      matches: [],
    };
  }
  function load() {
    const base = defaults();
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (!raw || typeof raw !== 'object') return base;
      return {
        v: 1,
        present: { ...base.present, ...(raw.present || {}) },
        assign: { ...base.assign, ...(raw.assign || {}) },
        teamNames: { ...base.teamNames, ...(raw.teamNames || {}) },
        matches: Array.isArray(raw.matches) ? raw.matches.filter(validMatch) : [],
      };
    } catch (e) {
      return base;
    }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* armazenamento indisponível */ }
  }
  function validMatch(m) {
    return m && typeof m.id === 'string' && !isNaN(Date.parse(m.date)) &&
      m.teams && m.teams.A && m.teams.B &&
      Array.isArray(m.teams.A.players) && Array.isArray(m.teams.B.players) &&
      (m.winner === 'A' || m.winner === 'B');
  }

  let state = load();
  let preview = null; // atribuição temporária durante a animação do sorteio

  const assignOf = (p) => (preview ? preview[p] : state.assign[p]);
  const teamPlayers = (team) => PLAYERS.filter((p) => state.present[p] && assignOf(p) === team);
  const teamName = (t) => (state.teamNames[t] || '').trim() || (t === 'A' ? 'Equipe Fogo' : 'Equipe Gelo');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const listJoin = (arr) => new Intl.ListFormat('pt-BR', { style: 'long', type: 'conjunction' }).format(arr);

  // ---------- ícones ----------
  const ICON = {
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',
    swap: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h12l-3-3M17 17H5l3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    out: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 5 5.5 5 11a5 5 0 0 1-10 0c0-2.5 1.2-4 2.5-5 0 2 1 3 2 3-1-3 0-6 .5-9z" fill="currentColor"/></svg>',
    crown: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" fill="currentColor"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  // ---------- montar equipes ----------
  function renderPresence() {
    $('presence').innerHTML = PLAYERS.map((p) => `
      <button type="button" class="presence-chip" data-name="${esc(p)}" aria-pressed="${state.present[p]}">
        <img class="avatar" src="${avatar(p, 'N')}" alt="" width="28" height="26">
        <span>${esc(p)}</span>
        <span class="check" aria-hidden="true"></span>
      </button>`).join('');
  }

  function chip(p, where) {
    const team = where === 'bench' ? 'N' : where;
    let actions;
    if (where === 'bench') {
      actions = `
        <button type="button" class="mini mini-a" data-move="A" data-name="${esc(p)}" aria-label="Escalar ${esc(p)} na ${esc(teamName('A'))}" title="${esc(teamName('A'))}">${ICON.plus}</button>
        <button type="button" class="mini mini-b" data-move="B" data-name="${esc(p)}" aria-label="Escalar ${esc(p)} na ${esc(teamName('B'))}" title="${esc(teamName('B'))}">${ICON.plus}</button>`;
    } else {
      const other = where === 'A' ? 'B' : 'A';
      actions = `
        <button type="button" class="mini" data-move="${other}" data-name="${esc(p)}" aria-label="Trocar ${esc(p)} para a ${esc(teamName(other))}" title="Trocar de equipe">${ICON.swap}</button>
        <button type="button" class="mini" data-move="bench" data-name="${esc(p)}" aria-label="Mandar ${esc(p)} para o banco" title="Mandar para o banco">${ICON.out}</button>`;
    }
    return `
      <li class="pchip" data-name="${esc(p)}">
        <img class="avatar" src="${avatar(p, team)}" alt="" width="28" height="26">
        <span class="pchip-name">${esc(p)}</span>
        <span class="pchip-actions">${actions}</span>
      </li>`;
  }

  function renderBuilder() {
    const A = teamPlayers('A'), B = teamPlayers('B'), bench = teamPlayers('bench');
    const empty = (msg) => `<li class="slot-empty">${msg}</li>`;
    $('listA').innerHTML = A.map((p) => chip(p, 'A')).join('') || empty('Ninguém escalado ainda');
    $('listB').innerHTML = B.map((p) => chip(p, 'B')).join('') || empty('Ninguém escalado ainda');
    $('listBench').innerHTML = bench.map((p) => chip(p, 'bench')).join('') ||
      empty(PLAYERS.some((p) => state.present[p]) ? 'Todo mundo escalado 💪' : 'Marque quem vai jogar');
    $('countA').textContent = `${A.length}/${MAX_TEAM}`;
    $('countB').textContent = `${B.length}/${MAX_TEAM}`;
    $('countBench').textContent = bench.length;
    $('countA').classList.toggle('is-full', A.length >= MAX_TEAM);
    $('countB').classList.toggle('is-full', B.length >= MAX_TEAM);
    if (document.activeElement !== $('nameA')) $('nameA').value = state.teamNames.A;
    if (document.activeElement !== $('nameB')) $('nameB').value = state.teamNames.B;
  }

  function move(p, to) {
    if (to !== 'bench' && teamPlayers(to).length >= MAX_TEAM) {
      toast(`A ${teamName(to)} já está completa — máximo de ${MAX_TEAM} no Free Fire.`, { tone: 'warn' });
      return;
    }
    state.assign[p] = to;
    save();
    renderAllTeams();
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function splitTeams(pool) {
    const s = shuffle(pool);
    let a = Math.min(MAX_TEAM, Math.ceil(s.length / 2));
    let b = Math.min(MAX_TEAM, Math.floor(s.length / 2));
    if (a !== b && Math.random() < 0.5) [a, b] = [b, a];
    const out = {};
    s.forEach((p, i) => { out[p] = i < a ? 'A' : i < a + b ? 'B' : 'bench'; });
    return out;
  }

  let drawing = false;
  function drawTeams() {
    if (drawing) return;
    const pool = PLAYERS.filter((p) => state.present[p]);
    if (pool.length < 2) {
      toast('Marque pelo menos 2 jogadores presentes para sortear.', { tone: 'warn' });
      return;
    }
    drawing = true;
    const btn = $('btnDraw');
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Sorteando…';
    $('builder').classList.add('is-drawing');
    const final = splitTeams(pool);
    const steps = reduce ? 0 : 9;
    let i = 0;
    const tick = () => {
      if (i < steps) {
        preview = { ...state.assign, ...splitTeams(pool) };
        renderBuilder();
        i++;
        setTimeout(tick, 70 + i * 12);
        return;
      }
      preview = null;
      Object.assign(state.assign, final);
      save();
      renderAllTeams();
      $('builder').classList.remove('is-drawing');
      $('builder').classList.add('is-revealed');
      setTimeout(() => $('builder').classList.remove('is-revealed'), 700);
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Sortear de novo';
      drawing = false;
      const reserve = pool.filter((p) => final[p] === 'bench');
      toast(reserve.length
        ? `Equipes sorteadas! No banco: ${listJoin(reserve)}.`
        : 'Equipes sorteadas! Bom jogo. 🎮');
    };
    tick();
  }

  // ---------- placar ----------
  let dateTouched = false;
  function nowLocal() {
    const d = new Date();
    d.setSeconds(0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function scoreVal(id) {
    const v = parseInt($(id).value, 10);
    return isNaN(v) ? 0 : Math.max(0, Math.min(99, v));
  }

  function renderScore() {
    const A = teamPlayers('A'), B = teamPlayers('B');
    $('scoreNameA').textContent = teamName('A');
    $('scoreNameB').textContent = teamName('B');
    const mem = (arr, team) => arr.length
      ? arr.map((p) => `<span class="mchip"><img class="avatar" src="${avatar(p, team)}" alt="" width="20" height="19">${esc(p)}</span>`).join('')
      : '<span class="muted">Sem jogadores</span>';
    $('scoreMembersA').innerHTML = mem(A, 'A');
    $('scoreMembersB').innerHTML = mem(B, 'B');
    updateHint();
  }

  function updateHint() {
    const A = teamPlayers('A'), B = teamPlayers('B');
    const sa = scoreVal('scoreA'), sb = scoreVal('scoreB');
    const hint = $('registerHint');
    const btn = $('btnRegister');
    const form = $('scoreForm');
    form.classList.toggle('lead-a', sa > sb);
    form.classList.toggle('lead-b', sb > sa);
    hint.className = 'hint';
    if (!A.length || !B.length) {
      hint.textContent = 'Monte as duas equipes no passo 1 para registrar.';
      btn.disabled = true;
      return;
    }
    btn.disabled = false;
    if (sa === sb) {
      hint.textContent = sa === 0 ? 'Informe o placar final do combate.' : 'Empate não pontua — precisa haver um vencedor.';
      hint.classList.add(sa === 0 ? 'is-muted' : 'is-warn');
      return;
    }
    const w = sa > sb ? 'A' : 'B';
    const winners = w === 'A' ? A : B;
    hint.innerHTML = `Vitória da <b class="t-${w.toLowerCase()}">${esc(teamName(w))}</b> → +1 ponto para ${esc(listJoin(winners))}.`;
    hint.classList.add('is-ok');
  }

  function register(e) {
    e.preventDefault();
    const A = teamPlayers('A'), B = teamPlayers('B');
    const sa = scoreVal('scoreA'), sb = scoreVal('scoreB');
    if (!A.length || !B.length) return;
    if (sa === sb) {
      toast('Empate não pontua. Confira o placar final.', { tone: 'warn' });
      $('scoreA').focus();
      return;
    }
    const dateStr = $('matchDate').value;
    const date = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(date)) { toast('Data inválida.', { tone: 'warn' }); return; }

    const winner = sa > sb ? 'A' : 'B';
    const match = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      date: date.toISOString(),
      teams: {
        A: { name: teamName('A'), players: A, score: sa },
        B: { name: teamName('B'), players: B, score: sb },
      },
      winner,
    };
    state.matches.push(match);
    save();
    $('scoreA').value = 0;
    $('scoreB').value = 0;
    dateTouched = false;
    $('matchDate').value = nowLocal();
    renderData();
    renderScore();
    flashRow(winner === 'A' ? A : B);
    confetti(winner === 'A' ? ['#ff6a2b', '#ffb547', '#ffd166', '#fff'] : ['#29b6f6', '#8ae6ff', '#ffd166', '#fff']);
    toast(`🏆 ${match.teams[winner].name} venceu ${Math.max(sa, sb)}×${Math.min(sa, sb)}! +1 para ${listJoin(match.teams[winner].players)}.`);
  }

  // ---------- ranking ----------
  function computeRanking() {
    const stats = new Map(PLAYERS.map((p) => [p, { name: p, wins: 0, games: 0, streak: 0 }]));
    const ordered = state.matches.slice().sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    ordered.forEach((m) => {
      ['A', 'B'].forEach((t) => {
        m.teams[t].players.forEach((p) => {
          if (!stats.has(p)) stats.set(p, { name: p, wins: 0, games: 0, streak: 0 });
          const s = stats.get(p);
          s.games++;
          if (m.winner === t) { s.wins++; s.streak++; } else s.streak = 0;
        });
      });
    });
    const rows = Array.from(stats.values()).map((s) => ({ ...s, rate: s.games ? s.wins / s.games : 0 }));
    rows.sort((a, b) => b.wins - a.wins || b.rate - a.rate || a.name.localeCompare(b.name, 'pt-BR'));
    let pos = 0, prev = null;
    rows.forEach((r, i) => {
      if (!prev || r.wins !== prev.wins || r.rate !== prev.rate) pos = i + 1;
      r.pos = pos;
      prev = r;
    });
    return rows;
  }

  function renderRanking(rows) {
    const max = Math.max(1, ...rows.map((r) => r.wins));
    $('rankingList').innerHTML = rows.map((r) => {
      const medal = r.wins > 0 && r.pos <= 3 ? ` is-top is-top-${r.pos}` : '';
      const streak = r.streak >= 2 ? `<span class="streak" title="Vitórias seguidas">${ICON.flame}${r.streak} seguidas</span>` : '';
      return `
        <li class="rank-row${medal}" data-name="${esc(r.name)}">
          <span class="rank-pos">${r.pos === 1 && r.wins > 0 ? ICON.crown : r.pos + 'º'}</span>
          <img class="avatar avatar-lg" src="${avatar(r.name, 'N')}" alt="" width="36" height="33">
          <div class="rank-info">
            <p class="rank-name">${esc(r.name)} ${streak}</p>
            <p class="rank-sub">${r.games} ${r.games === 1 ? 'partida' : 'partidas'}${r.games ? ' · ' + Math.round(r.rate * 100) + '% de aproveitamento' : ''}</p>
            <div class="rank-bar" aria-hidden="true"><span style="width:${(r.wins / max) * 100}%"></span></div>
          </div>
          <div class="rank-wins"><b>${r.wins}</b><span>${r.wins === 1 ? 'vitória' : 'vitórias'}</span></div>
        </li>`;
    }).join('');
  }

  function flashRow(names) {
    names.forEach((n) => {
      const el = document.querySelector(`.rank-row[data-name="${CSS.escape(n)}"]`);
      if (!el) return;
      el.classList.remove('is-bump');
      void el.offsetWidth;
      el.classList.add('is-bump');
    });
  }

  // ---------- histórico ----------
  const fmtDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  const fmtTime = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function renderFilter() {
    const sel = $('historyFilter');
    const cur = sel.value;
    const names = new Set(PLAYERS);
    state.matches.forEach((m) => ['A', 'B'].forEach((t) => m.teams[t].players.forEach((p) => names.add(p))));
    sel.innerHTML = '<option value="">Todos os jogadores</option>' +
      Array.from(names).map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
    sel.value = names.has(cur) ? cur : '';
  }

  function renderHistory() {
    const filter = $('historyFilter').value;
    const all = state.matches.slice().sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    const list = filter ? all.filter((m) => m.teams.A.players.includes(filter) || m.teams.B.players.includes(filter)) : all;
    $('historyCount').textContent = state.matches.length;

    if (!list.length) {
      $('historyList').innerHTML = `
        <li class="empty-state">
          <span class="empty-icon" aria-hidden="true">${ICON.trophy}</span>
          <p><b>${filter ? `${esc(filter)} ainda não tem combates registrados.` : 'Nenhum combate registrado ainda.'}</b></p>
          <p class="muted">${filter ? 'Tente outro jogador.' : 'Monte as equipes, joguem e registrem o primeiro placar.'}</p>
        </li>`;
      return;
    }

    let n = all.length;
    const numberOf = new Map(all.map((m) => [m.id, n--]));
    $('historyList').innerHTML = list.map((m) => {
      const d = new Date(m.date);
      const side = (t) => {
        const team = m.teams[t];
        const win = m.winner === t;
        return `
          <div class="side side-${t.toLowerCase()}${win ? ' is-winner' : ''}">
            <p class="side-name">${esc(team.name)}${win ? `<span class="badge">${ICON.trophy}Vitória</span>` : ''}</p>
            <ul class="side-members">
              ${team.players.map((p) => `<li class="${p === filter ? 'is-hl' : ''}"><img class="avatar" src="${avatar(p, t)}" alt="" width="20" height="19">${esc(p)}</li>`).join('')}
            </ul>
          </div>`;
      };
      return `
        <li class="match">
          <div class="match-head">
            <span class="match-no">#${numberOf.get(m.id)}</span>
            <time datetime="${esc(m.date)}">${cap(fmtDate.format(d))} · ${fmtTime.format(d)}</time>
            <button type="button" class="icon-btn" data-delete="${esc(m.id)}" aria-label="Apagar combate #${numberOf.get(m.id)}" title="Apagar">${ICON.trash}</button>
          </div>
          <div class="match-body">
            ${side('A')}
            <div class="match-score" aria-label="Placar ${m.teams.A.score} a ${m.teams.B.score}">
              <span class="${m.winner === 'A' ? 'w' : ''}">${m.teams.A.score}</span><i>×</i><span class="${m.winner === 'B' ? 'w' : ''}">${m.teams.B.score}</span>
            </div>
            ${side('B')}
          </div>
        </li>`;
    }).join('');
  }

  function removeMatch(id) {
    const idx = state.matches.findIndex((m) => m.id === id);
    if (idx < 0) return;
    const [removed] = state.matches.splice(idx, 1);
    save();
    renderData();
    toast('Combate apagado.', {
      action: { label: 'Desfazer', fn: () => { state.matches.push(removed); save(); renderData(); } },
    });
  }

  // ---------- stats do topo ----------
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
  function relative(date) {
    const diff = (date - Date.now()) / 1000;
    const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
    for (const [u, s] of units) if (Math.abs(diff) >= s) return rtf.format(Math.round(diff / s), u);
    return 'agora há pouco';
  }

  function renderStats(rows) {
    $('statMatches').textContent = state.matches.length;
    const top = rows.filter((r) => r.wins > 0 && r.pos === 1);
    $('statLeader').textContent = top.length
      ? (top.length > 2 ? `${top.length} empatados` : top.map((r) => r.name).join(' e ')) + ` · ${top[0].wins}`
      : '—';
    const last = state.matches.reduce((acc, m) => (!acc || Date.parse(m.date) > Date.parse(acc.date) ? m : acc), null);
    $('statLast').textContent = last ? relative(new Date(last.date)) : '—';
  }

  // ---------- render geral ----------
  function renderAllTeams() { renderBuilder(); renderScore(); }
  function renderData() {
    const rows = computeRanking();
    renderRanking(rows);
    renderFilter();
    renderHistory();
    renderStats(rows);
  }

  // ---------- toast ----------
  function toast(msg, opts = {}) {
    const region = $('toastRegion');
    const el = document.createElement('div');
    el.className = 'toast' + (opts.tone ? ' toast-' + opts.tone : '');
    el.innerHTML = `<span>${esc(msg)}</span>`;
    if (opts.action) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'toast-action';
      b.textContent = opts.action.label;
      b.addEventListener('click', () => { opts.action.fn(); close(); });
      el.appendChild(b);
    }
    region.appendChild(el);
    while (region.children.length > 3) region.firstElementChild.remove();
    requestAnimationFrame(() => el.classList.add('is-in'));
    let timer = setTimeout(close, opts.action ? 6000 : 3800);
    function close() {
      clearTimeout(timer);
      el.classList.remove('is-in');
      setTimeout(() => el.remove(), 250);
    }
  }

  // ---------- confete pixelado ----------
  function confetti(colors) {
    if (reduce) return;
    const cv = $('confetti');
    const ctx = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const btn = $('btnRegister').getBoundingClientRect();
    const ox = btn.left + btn.width / 2, oy = btn.top;
    const parts = Array.from({ length: 140 }, () => ({
      x: ox, y: oy,
      vx: (Math.random() - 0.5) * 900, vy: -Math.random() * 900 - 250,
      s: 4 + Math.floor(Math.random() * 3) * 2,
      c: colors[Math.floor(Math.random() * colors.length)],
      r: Math.random() * Math.PI,
    }));
    const t0 = performance.now();
    let last = t0;
    cv.classList.add('is-on');
    (function step(now) {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      parts.forEach((p) => {
        p.vy += 1600 * dt; p.vx *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 8;
        ctx.fillStyle = p.c;
        const w = Math.max(2, Math.abs(Math.cos(p.r)) * p.s);
        ctx.fillRect(Math.round(p.x), Math.round(p.y), Math.round(w), p.s);
      });
      if (now - t0 < 2200) requestAnimationFrame(step);
      else { ctx.clearRect(0, 0, innerWidth, innerHeight); cv.classList.remove('is-on'); }
    })(t0);
  }

  // ---------- backup ----------
  function exportData() {
    const blob = new Blob([JSON.stringify({ app: 'free-familia', exportedAt: new Date().toISOString(), ...state }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `free-familia-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Backup exportado.');
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const incoming = Array.isArray(data.matches) ? data.matches.filter(validMatch) : null;
        if (!incoming) throw new Error('formato');
        const ids = new Set(state.matches.map((m) => m.id));
        const fresh = incoming.filter((m) => !ids.has(m.id));
        state.matches.push(...fresh);
        if (data.teamNames) state.teamNames = { ...state.teamNames, ...data.teamNames };
        save();
        renderAllTeams();
        renderData();
        toast(fresh.length ? `${fresh.length} combate(s) importado(s).` : 'Nada novo nesse backup — tudo já estava aqui.');
      } catch (e) {
        toast('Não consegui ler esse arquivo de backup.', { tone: 'warn' });
      }
    };
    reader.readAsText(file);
  }

  // ---------- eventos ----------
  function bind() {
    $('presence').addEventListener('click', (e) => {
      const b = e.target.closest('.presence-chip');
      if (!b) return;
      const p = b.dataset.name;
      state.present[p] = !state.present[p];
      if (!state.present[p]) state.assign[p] = 'bench';
      b.setAttribute('aria-pressed', state.present[p]);
      save();
      renderAllTeams();
    });

    $('builder').addEventListener('click', (e) => {
      const b = e.target.closest('[data-move]');
      if (!b || drawing) return;
      move(b.dataset.name, b.dataset.move);
    });

    $('btnDraw').addEventListener('click', drawTeams);
    $('btnClear').addEventListener('click', () => {
      PLAYERS.forEach((p) => { state.assign[p] = 'bench'; });
      $('btnDraw').querySelector('span').textContent = 'Sortear equipes';
      save();
      renderAllTeams();
    });

    ['A', 'B'].forEach((t) => {
      const input = $('name' + t);
      input.addEventListener('input', () => {
        state.teamNames[t] = input.value;
        save();
        renderScore();
      });
      input.addEventListener('blur', () => {
        if (!input.value.trim()) { state.teamNames[t] = t === 'A' ? 'Equipe Fogo' : 'Equipe Gelo'; save(); }
        renderAllTeams();
      });
    });

    document.querySelectorAll('.step').forEach((b) => {
      b.addEventListener('click', () => {
        const input = $(b.dataset.target);
        input.value = Math.max(0, Math.min(99, scoreVal(b.dataset.target) + Number(b.dataset.step)));
        input.classList.remove('is-tick'); void input.offsetWidth; input.classList.add('is-tick');
        updateHint();
      });
    });
    ['scoreA', 'scoreB'].forEach((id) => {
      $(id).addEventListener('input', updateHint);
      $(id).addEventListener('focus', (e) => e.target.select());
      $(id).addEventListener('blur', (e) => { e.target.value = scoreVal(id); updateHint(); });
    });

    $('matchDate').addEventListener('input', () => { dateTouched = true; });
    setInterval(() => { if (!dateTouched) $('matchDate').value = nowLocal(); }, 30000);

    $('scoreForm').addEventListener('submit', register);
    $('historyFilter').addEventListener('change', renderHistory);
    $('historyList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-delete]');
      if (b) removeMatch(b.dataset.delete);
    });

    $('btnExport').addEventListener('click', exportData);
    $('fileImport').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) importData(f);
      e.target.value = '';
    });

    window.addEventListener('storage', (e) => {
      if (e.key === KEY) { state = load(); renderPresence(); renderAllTeams(); renderData(); }
    });
  }

  // ---------- init ----------
  $('matchDate').value = nowLocal();
  renderPresence();
  renderAllTeams();
  renderData();
  bind();
  setInterval(() => renderStats(computeRanking()), 60000);
})();
