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
    try {
      // no modo compartilhado as partidas vivem no banco online; aqui fica só a preferência local
      const data = shared ? { ...state, matches: [] } : state;
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) { /* armazenamento indisponível */ }
  }
  function validMatch(m) {
    return m && typeof m.id === 'string' && !isNaN(Date.parse(m.date)) &&
      m.teams && m.teams.A && m.teams.B &&
      Array.isArray(m.teams.A.players) && Array.isArray(m.teams.B.players) &&
      (m.winner === 'A' || m.winner === 'B');
  }

  let state = load();

  // ---------- sincronização online (artifact db) ----------
  let db = null;          // namespace do banco compartilhado, quando disponível
  let shared = false;     // true quando as partidas vêm do banco online
  let readOnly = false;   // visitante sem permissão de escrita
  let syncState = 'local'; // local | loading | live | stale | error

  function setSync(s) {
    syncState = s;
    const el = $('syncStatus');
    if (!el) return;
    const map = {
      local: ['Salvo só neste aparelho', 'is-local'],
      loading: ['Conectando ao placar online…', 'is-loading'],
      live: [readOnly ? 'Ao vivo · somente leitura' : 'Ao vivo · todos veem', 'is-live'],
      stale: ['Placar online demorando a responder', 'is-stale'],
      error: ['Placar online indisponível', 'is-stale'],
    };
    const [txt, cls] = map[s];
    el.className = 'sync ' + cls;
    el.querySelector('span').textContent = txt;
    const note = $('footerNote');
    if (note) note.textContent = shared
      ? 'Os combates ficam salvos online: todo mundo que abre esta página vê o mesmo histórico e ranking.'
      : 'Os dados ficam salvos neste navegador.';
  }

  async function writeMatch(m) {
    if (!shared) return;
    await db.collection('matches').doc(m.id).set(JSON.parse(JSON.stringify(m)));
  }
  async function deleteMatchRemote(id) {
    if (!shared) return;
    await db.collection('matches').doc(id).delete();
  }
  function writeFailed(e) {
    if (e && e.code === 'permission-denied') {
      readOnly = true;
      applyReadOnly();
      toast('Só a conta autorizada pode registrar. Entre com ela para salvar o placar.', { tone: 'warn' });
    } else if (e && e.code === 'invalid_argument') {
      readOnly = true;
      applyReadOnly();
      toast('Você só pode visualizar este placar. Peça acesso de colaborador ao dono da página.', { tone: 'warn' });
    } else if (e && e.code === 'quota_exceeded') {
      toast('O placar online está cheio. Apague combates antigos para registrar novos.', { tone: 'warn' });
    } else {
      toast('Não consegui salvar online. Confira a conexão e tente de novo.', { tone: 'warn' });
    }
  }
  function applyReadOnly() {
    document.body.classList.toggle('is-readonly', readOnly);
    updateHint();
    setSync(syncState);
  }

  // ---- conexão: 1) banco do Claude (link do claude.ai) 2) Firebase (GitHub Pages) ----
  let localMatches = [];
  let migrated = false, liveOnce = false;
  let fbAuth = null, fbUser = null, fbAdmins = [];

  async function connectShared() {
    localMatches = state.matches.slice();
    if (await connectClaude()) return;
    await connectFirebase();
  }

  async function connectClaude() {
    const c = window.claude;
    if (!c || typeof c.use !== 'function') return false;
    let ns = null;
    try { ns = await c.use('db'); } catch (e) { ns = null; }
    if (!ns) return false;
    db = ns;
    try {
      const user = await c.use('user');
      if (user && typeof user.can === 'function') {
        const can = await user.can('data.write');
        if (can === false) readOnly = true;
      }
    } catch (e) { /* sem informação: tenta escrever e trata a recusa */ }
    startSync();
    return true;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src; el.onload = resolve; el.onerror = reject;
      document.head.appendChild(el);
    });
  }

  async function connectFirebase() {
    const cfg = window.FREE_FAMILIA_FIREBASE;
    if (!cfg || !cfg.config || !cfg.config.projectId) return false;
    setSync('loading');
    try {
      const v = '10.12.2';
      await loadScript(`https://www.gstatic.com/firebasejs/${v}/firebase-app-compat.js`);
      await Promise.all([
        loadScript(`https://www.gstatic.com/firebasejs/${v}/firebase-firestore-compat.js`),
        loadScript(`https://www.gstatic.com/firebasejs/${v}/firebase-auth-compat.js`),
      ]);
    } catch (e) {
      setSync('error');
      return false;
    }
    const fb = window.firebase;
    fb.initializeApp(cfg.config);
    db = fb.firestore();
    fbAuth = fb.auth();
    fbAdmins = (cfg.admins || []).map((x) => String(x).toLowerCase());
    readOnly = true;
    const btn = $('btnAuth');
    btn.hidden = false;
    $('loginRow').hidden = false;
    $('btnLoginHome').addEventListener('click', () => btn.click());
    btn.addEventListener('click', async () => {
      try {
        if (fbUser) await fbAuth.signOut();
        else await fbAuth.signInWithPopup(new fb.auth.GoogleAuthProvider());
      } catch (e) {
        if (e && e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
          toast('Não consegui entrar com o Google. Tente de novo.', { tone: 'warn' });
        }
      }
    });
    fbAuth.onAuthStateChanged((u) => {
      fbUser = u;
      const email = (u && u.email ? u.email : '').toLowerCase();
      const allowed = !!u && (!fbAdmins.length || fbAdmins.includes(email));
      readOnly = !allowed;
      btn.textContent = u ? 'Sair' : 'Entrar para registrar';
      $('btnLoginHome').querySelector('span').textContent = u ? 'Sair' : 'Entrar';
      $('btnLoginHome').classList.toggle('is-in', !!u);
      const welcome = WELCOME[email];
      $('loginWho').textContent = u
        ? (allowed ? (welcome ? welcome.text : `Conectado como ${u.email}. Você pode registrar partidas.`) : `Conectado como ${u.email}, só para ver o placar.`)
        : 'Entre com a conta autorizada para registrar partidas.';
      $('loginWho').classList.toggle('is-welcome', !!(u && allowed && welcome));
      btn.title = u ? `Conectado como ${u.email}` : 'Entrar com Google para registrar partidas';
      if (u && !allowed) toast(`${u.email} pode ver o placar, mas não registrar.`, { tone: 'warn' });
      applyReadOnly();
      tryMigrate();
      if (u && allowed && welcome) maybeTour(email, welcome);
    });
    startSync();
    return true;
  }

  // ---------- boas-vindas e tour na primeira entrada ----------
  const WELCOME = {
    'carvalhoaline098b@gmail.com': { name: 'Aline Carvalho', text: 'Olá oficial Aline Carvalho, bem-vinda à guerra.' },
    'alessonmiranda@gmail.com': { name: 'Alesson Miranda', text: 'Olá oficial Alesson Miranda, bem-vindo à guerra.' },
  };
  function maybeTour(email, welcome) {
    const key = 'free-familia:tour:' + email;
    try { if (localStorage.getItem(key)) return; } catch (e) { return; }
    const done = () => { try { localStorage.setItem(key, String(Date.now())); } catch (e) { /* ignore */ } };
    setTimeout(() => startTour(welcome, done), 700);
  }
  function startTour(welcome, done) {
    if (!window.Tour || window.Tour.active) return;
    if (location.hash && location.hash !== '#inicio') location.hash = 'inicio';
    if (!$('manualPanel').hidden) setManual(false, false);
    Sfx.play('badge');
    window.Tour.start([
      { title: welcome.text, text: 'Antes da primeira batalha, um reconhecimento rápido do terreno. São só alguns passos.' },
      { target: '#btnDraw', title: 'Sortear equipes', text: 'Sorteia as equipes na sorte. Antes, a página pergunta se alguém vai ficar de fora.' },
      { target: '#btnBalanced', title: 'Sorteio equilibrado', text: 'Monta equipes de força parecida usando o aproveitamento de cada um no ranking.' },
      { target: '#btnRematch', title: 'Revanche', text: 'Repete as equipes da última partida. Se alguém não puder jogar, dá para escolher quem entra no lugar.' },
      { target: '#btnManual', title: 'Montar manualmente', text: 'Abre a lista de jogadores para você marcar quem joga e escalar cada um na Equipe Fogo ou na Equipe Gelo.' },
      { target: '#btnClear', title: 'Limpar', text: 'Desfaz as equipes montadas para começar de novo.' },
      { target: '#btnLoginHome', title: 'Sua conta', text: 'Você está conectada para registrar partidas. Aqui também dá para sair da conta.'.replace('conectada', welcome.name.startsWith('Aline') ? 'conectada' : 'conectado') },
      { target: '#btnMenu', title: 'Menu', text: 'No menu ficam Registrar placar, Ranking de vitórias, Conquistas e Histórico de combates.' },
      { target: '#btnSound', title: 'Som', text: 'Liga ou desliga os sons 8-bit do sorteio, da vitória e das conquistas.' },
      { title: 'Depois do sorteio', text: 'Aparecem os botões Compartilhar equipes, para mandar a imagem no grupo do WhatsApp, e Registrar placar, para salvar o resultado e somar pontos no ranking.', finish: 'Bora pra guerra!' },
    ], done);
  }

  function tryMigrate() {
    if (migrated || !liveOnce || readOnly) return;
    migrated = true;
    // leva para o placar online as partidas que estavam só neste aparelho
    const ids = new Set(state.matches.map((m) => m.id));
    const pending = localMatches.filter((m) => !ids.has(m.id));
    save();
    if (!pending.length) return;
    (async () => {
      try {
        for (const m of pending) await writeMatch(m);
        toast(`${pending.length} combate(s) deste aparelho enviados para o placar online.`);
      } catch (e) { writeFailed(e); }
    })();
  }

  function startSync() {
    shared = true;
    setSync('loading');
    applyReadOnly();
    const timer = setTimeout(() => { if (syncState === 'loading') setSync('stale'); }, 10000);
    db.collection('matches').onSnapshot((snap) => {
      state.matches = snap.docs.map((d) => d.data()).filter(validMatch).map((m) => JSON.parse(JSON.stringify(m)));
      renderData();
      if (!snap.metadata.fromCache) {
        clearTimeout(timer);
        liveOnce = true;
        setSync('live');
        save();
        tryMigrate();
      }
    }, () => {
      clearTimeout(timer);
      setSync('error');
    });
  }
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
    renderResult();
    if (document.activeElement !== $('nameA')) $('nameA').value = state.teamNames.A;
    if (document.activeElement !== $('nameB')) $('nameB').value = state.teamNames.B;
  }

  function move(p, to) {
    if (to !== 'bench' && teamPlayers(to).length >= MAX_TEAM) {
      Sfx.play('error');
      toast(`A ${teamName(to)} já está completa — máximo de ${MAX_TEAM} no Free Fire.`, { tone: 'warn' });
      return;
    }
    state.assign[p] = to;
    save();
    Sfx.play('click');
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

  // ---------- sorteio equilibrado ----------
  function strengthOf() {
    const map = new Map(computeRanking().map((r) => [r.name, r]));
    // aproveitamento suavizado: quem jogou pouco fica perto de 50%
    return (p) => { const r = map.get(p); return r ? (r.wins + 1) / (r.games + 2) : 0.5; };
  }
  function balancedSplit(pool) {
    const str = strengthOf();
    const avg = (arr) => arr.reduce((a, p) => a + str(p), 0) / (arr.length || 1);
    const tries = [];
    for (let k = 0; k < 600; k++) {
      const split = splitTeams(pool);
      const A = pool.filter((p) => split[p] === 'A'), B = pool.filter((p) => split[p] === 'B');
      tries.push({ split, diff: Math.abs(avg(A) - avg(B)), a: avg(A), b: avg(B) });
    }
    tries.sort((x, y) => x.diff - y.diff);
    const best = tries[0].diff;
    const near = tries.filter((t) => t.diff <= best + 0.015).slice(0, 12);
    return near[Math.floor(Math.random() * near.length)];
  }

  // ---------- revanche ----------
  function lastMatch() {
    return state.matches.reduce((acc, m) => (!acc || Date.parse(m.date) > Date.parse(acc.date) ? m : acc), null);
  }
  let rmMatch = null;
  function openRematch() {
    if (drawing) return;
    const m = lastMatch();
    if (!m) { Sfx.play('error'); toast('Ainda não há partida registrada para repetir.', { tone: 'warn' }); return; }
    rmMatch = m;
    const inMatch = new Set([...m.teams.A.players, ...m.teams.B.players]);
    const others = PLAYERS.filter((p) => !inMatch.has(p));
    $('rematchInfo').textContent = others.length
      ? `Mesmas equipes do último combate (${m.teams.A.score}×${m.teams.B.score}). Se alguém não puder jogar, escolha quem entra no lugar.`
      : `Mesmas equipes do último combate (${m.teams.A.score}×${m.teams.B.score}).`;
    $('rematchError').textContent = '';
    $('rematchTeams').innerHTML = ['A', 'B'].map((t) => `
      <div class="rm-team rm-${t.toLowerCase()}">
        <p class="rteam-name">${esc(m.teams[t].name)}</p>
        ${m.teams[t].players.map((p, i) => `
          <div class="rm-row">
            <img class="avatar" src="${avatar(p, t)}" alt="" width="28" height="26">
            <span class="pchip-name">${esc(p)}</span>
            <label class="sr-only" for="rm-${t}-${i}">Substituir ${esc(p)}</label>
            <select id="rm-${t}-${i}" data-orig="${esc(p)}" data-team="${t}" ${others.length ? '' : 'disabled'}>
              <option value="">Joga</option>
              ${others.map((o) => `<option value="${esc(o)}">Sai, entra ${esc(o)}</option>`).join('')}
            </select>
          </div>`).join('')}
      </div>`).join('');
    $('rematchDialog').showModal();
    Sfx.play('click');
  }

  function confirmRematch() {
    const m = rmMatch;
    if (!m) return;
    const sels = Array.from($('rematchTeams').querySelectorAll('select'));
    const chosen = sels.map((x) => x.value).filter(Boolean);
    if (new Set(chosen).size !== chosen.length) {
      Sfx.play('error');
      $('rematchError').textContent = 'A mesma pessoa foi escolhida para entrar duas vezes. Escolha substitutos diferentes.';
      return;
    }
    PLAYERS.forEach((p) => { state.assign[p] = 'bench'; });
    const subs = [];
    sels.forEach((x) => {
      const orig = x.dataset.orig, team = x.dataset.team;
      const who = x.value || orig;
      if (x.value) { subs.push(`${x.value} no lugar de ${orig}`); if (PLAYERS.includes(orig)) state.present[orig] = false; }
      if (PLAYERS.includes(who)) { state.present[who] = true; state.assign[who] = team; }
    });
    state.teamNames.A = m.teams.A.name;
    state.teamNames.B = m.teams.B.name;
    save();
    $('rematchDialog').close();
    renderPresence();
    renderAllTeams();
    $('equipes').classList.add('is-revealed');
    setTimeout(() => $('equipes').classList.remove('is-revealed'), 700);
    Sfx.play('rematch');
    toast(subs.length ? `Revanche com ${listJoin(subs)}.` : 'Revanche! Mesmas equipes do último combate.');
  }

  // ---------- janela "alguém vai ficar de fora?" antes do sorteio ----------
  let drawMode = 'random', drawSel = new Set();
  function openDraw(mode) {
    if (drawing) return;
    drawMode = mode;
    drawSel = new Set(PLAYERS.filter((p) => state.present[p]));
    if (drawSel.size < 2) drawSel = new Set(PLAYERS);
    $('drawConfirm').textContent = mode === 'balanced' ? 'Fazer sorteio equilibrado' : 'Sortear equipes';
    renderDrawPick();
    $('drawDialog').showModal();
    Sfx.play('click');
  }
  function renderDrawPick() {
    $('drawPick').innerHTML = PLAYERS.map((p) => `
      <button type="button" class="presence-chip" data-name="${esc(p)}" aria-pressed="${drawSel.has(p)}">
        <img class="avatar" src="${avatar(p, 'N')}" alt="" width="28" height="26">
        <span>${esc(p)}</span>
        <span class="check" aria-hidden="true"></span>
      </button>`).join('');
    const n = drawSel.size;
    const a = Math.min(MAX_TEAM, Math.ceil(n / 2)), b = Math.min(MAX_TEAM, Math.floor(n / 2));
    const left = PLAYERS.filter((p) => !drawSel.has(p));
    $('drawCount').textContent = n < 2
      ? 'Marque pelo menos 2 jogadores.'
      : `${n} jogadores: ${a} × ${b}` + (n - a - b > 0 ? `, ${n - a - b} no banco` : '') +
        (left.length ? `. Fora: ${listJoin(left)}.` : '. Ninguém fica de fora.');
    $('drawConfirm').disabled = n < 2;
  }
  function confirmDraw() {
    if (drawSel.size < 2) return;
    PLAYERS.forEach((p) => {
      state.present[p] = drawSel.has(p);
      if (!drawSel.has(p)) state.assign[p] = 'bench';
    });
    save();
    $('drawDialog').close();
    renderPresence();
    drawTeams(drawMode);
  }

  // ---------- montagem manual ----------
  function setManual(open, scroll = true) {
    $('manualPanel').hidden = !open;
    $('btnManual').setAttribute('aria-expanded', String(open));
    $('btnManual').querySelector('span').textContent = open ? 'Fechar montagem' : 'Montar manualmente';
    renderResult();
    if (scroll) (open ? $('manualPanel') : $('teamResult')).scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  // ---------- resultado (Equipe Fogo × Equipe Gelo) ----------
  function renderResult() {
    const el = $('teamResult');
    if (!el) return;
    const A = teamPlayers('A'), B = teamPlayers('B'), bench = teamPlayers('bench');
    const manualOpen = !$('manualPanel').hidden;
    el.hidden = manualOpen;
    $('builderNext').hidden = !(A.length && B.length);
    if (!A.length && !B.length) {
      el.innerHTML = '';
      el.hidden = true;
      return;
    }
    const side = (t, arr) => `
      <div class="rteam rteam-${t.toLowerCase()}">
        <p class="rteam-name"><span>${esc(teamName(t))}</span><small>${arr.length}/${MAX_TEAM}</small></p>
        <ul>${arr.map((p) => `<li class="pchip"><img class="avatar" src="${avatar(p, t)}" alt="" width="28" height="26"><span class="pchip-name">${esc(p)}</span></li>`).join('') || '<li class="slot-empty">Sem jogadores</li>'}</ul>
      </div>`;
    el.innerHTML = `<div class="result-grid">${side('A', A)}<div class="result-vs" aria-hidden="true">VS</div>${side('B', B)}</div>` +
      (bench.length ? `<p class="result-bench">No banco: ${esc(listJoin(bench))}</p>` : '');
  }


  let drawing = false;
  function drawTeams(mode) {
    if (drawing) return;
    const balanced = mode === 'balanced';
    const pool = PLAYERS.filter((p) => state.present[p]);
    if (pool.length < 2) {
      Sfx.play('error');
      toast('Marque pelo menos 2 jogadores presentes para sortear.', { tone: 'warn' });
      return;
    }
    drawing = true;
    const btn = $('btnDraw');
    btn.disabled = true; $('btnBalanced').disabled = true; $('btnRematch').disabled = true; $('btnManual').disabled = true;
    btn.querySelector('span').textContent = 'Sorteando…';
    $('equipes').classList.add('is-drawing');
    const pick = balanced ? balancedSplit(pool) : null;
    const final = balanced ? pick.split : splitTeams(pool);
    const steps = reduce ? 0 : 9;
    let i = 0;
    const tick = () => {
      if (i < steps) {
        preview = { ...state.assign, ...splitTeams(pool) };
        renderBuilder();
        Sfx.play('tick', i);
        i++;
        setTimeout(tick, 70 + i * 12);
        return;
      }
      preview = null;
      Object.assign(state.assign, final);
      save();
      renderAllTeams();
      $('equipes').classList.remove('is-drawing');
      $('equipes').classList.add('is-revealed');
      setTimeout(() => $('equipes').classList.remove('is-revealed'), 700);
      btn.disabled = false; $('btnBalanced').disabled = false; $('btnRematch').disabled = !state.matches.length; $('btnManual').disabled = false;
      btn.querySelector('span').textContent = 'Sortear de novo';
      drawing = false;
      Sfx.play('reveal');
      const reserve = pool.filter((p) => final[p] === 'bench');
      const bench = reserve.length ? ` No banco: ${listJoin(reserve)}.` : '';
      if (balanced) {
        toast(`Equipes equilibradas! Força: ${teamName('A')} ${Math.round(pick.a * 100)}% × ${Math.round(pick.b * 100)}% ${teamName('B')}.${bench}`);
      } else {
        toast(reserve.length ? `Equipes sorteadas!${bench}` : 'Equipes sorteadas! Bom jogo. 🎮');
      }
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
    if (readOnly) {
      if (fbAuth) hint.innerHTML = 'Para salvar partidas, <button type="button" class="link-btn" data-login>entre com a conta autorizada</button>.';
      else hint.textContent = 'Você está vendo o placar em modo leitura.';
      btn.disabled = true;
      return;
    }
    if (!A.length || !B.length) {
      hint.innerHTML = 'Monte as duas equipes no <a href="#inicio">Início</a> para registrar.';
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
    if (readOnly) { toast('Você só pode visualizar este placar.', { tone: 'warn' }); return; }
    if (sa === sb) {
      toast('Empate não pontua. Confira o placar final.', { tone: 'warn' });
      $('scoreA').focus();
      return;
    }
    const dateStr = $('matchDate').value;
    const date = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(date)) { toast('Data inválida.', { tone: 'warn' }); return; }

    const winner = sa > sb ? 'A' : 'B';
    const badgesBefore = computeBadges();
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
    writeMatch(match).catch((err) => {
      state.matches = state.matches.filter((m) => m.id !== match.id);
      renderData();
      writeFailed(err);
    });
    $('scoreA').value = 0;
    $('scoreB').value = 0;
    dateTouched = false;
    $('matchDate').value = nowLocal();
    renderData();
    renderScore();
    flashRow(winner === 'A' ? A : B);
    confetti(winner === 'A' ? ['#ff6a2b', '#ffb547', '#ffd166', '#fff'] : ['#29b6f6', '#8ae6ff', '#ffd166', '#fff']);
    Sfx.play('win');
    announceBadges(badgesBefore, computeBadges());
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

  // ---------- conquistas ----------
  const BADGES = [
    { id: 'estreia', icon: '⭐', name: 'Estreia Vitoriosa', desc: 'Venceu o primeiro combate.' },
    { id: 'chamas', icon: '🔥', name: 'Em Chamas', desc: '3 vitórias seguidas.' },
    { id: 'imparavel', icon: '⚡', name: 'Imparável', desc: '5 vitórias seguidas.' },
    { id: 'atropelo', icon: '💥', name: 'Atropelo', desc: 'Venceu com 5 ou mais de diferença (tipo 6×1).' },
    { id: 'casal', icon: '💞', name: 'Casal Imbatível', desc: 'Aline e Miguel venceram juntos na mesma equipe.' },
    { id: 'pregador', icon: '📖', name: 'Pregador', desc: 'Talisson venceu um combate. Romanos 6.23!' },
    { id: 'grau', icon: '🏍️', name: 'Grau Perfeito', desc: 'Isaac venceu um combate chegando de moto.' },
    { id: 'adblock', icon: '🚫', name: 'Bloqueador de Anúncios', desc: 'Isaías venceu apesar de tanta propaganda.' },
    { id: 'veterano', icon: '🎖️', name: 'Veterano', desc: 'Jogou 10 combates.' },
    { id: 'lenda', icon: '👑', name: 'Lenda da Família', desc: 'Chegou a 10 vitórias.' },
  ];
  const BADGE_BY_ID = Object.fromEntries(BADGES.map((b) => [b.id, b]));

  /** Map jogador -> Set de ids desbloqueados, calculado do histórico. */
  function computeBadges() {
    const out = new Map();
    const give = (p, id) => { if (!out.has(p)) out.set(p, new Set()); out.get(p).add(id); };
    const st = new Map();
    const ordered = state.matches.slice().sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    ordered.forEach((m) => {
      const w = m.winner, l = w === 'A' ? 'B' : 'A';
      const winners = m.teams[w].players;
      const margin = m.teams[w].score - m.teams[l].score;
      ['A', 'B'].forEach((t) => m.teams[t].players.forEach((p) => {
        const s = st.get(p) || { wins: 0, games: 0, streak: 0 };
        s.games++;
        if (t === w) { s.wins++; s.streak++; } else s.streak = 0;
        st.set(p, s);
        if (s.games >= 10) give(p, 'veterano');
        if (t !== w) return;
        give(p, 'estreia');
        if (s.streak >= 3) give(p, 'chamas');
        if (s.streak >= 5) give(p, 'imparavel');
        if (s.wins >= 10) give(p, 'lenda');
        if (margin >= 5) give(p, 'atropelo');
      }));
      if (winners.includes('Aline') && winners.includes('Miguel')) { give('Aline', 'casal'); give('Miguel', 'casal'); }
      if (winners.includes('Talisson')) give('Talisson', 'pregador');
      if (winners.includes('Isaac')) give('Isaac', 'grau');
      if (winners.includes('Isaías')) give('Isaías', 'adblock');
    });
    return out;
  }

  function announceBadges(before, after) {
    const fresh = [];
    after.forEach((ids, p) => ids.forEach((id) => {
      if (!(before.get(p) && before.get(p).has(id))) fresh.push({ p, b: BADGE_BY_ID[id] });
    }));
    if (!fresh.length) return;
    const byBadge = new Map();
    fresh.forEach(({ p, b }) => { if (!byBadge.has(b.id)) byBadge.set(b.id, { b, people: [] }); byBadge.get(b.id).people.push(p); });
    setTimeout(() => {
      Sfx.play('badge');
      byBadge.forEach(({ b, people }) => toast(`${b.icon} Nova conquista: ${b.name} — ${listJoin(people)}!`));
    }, 900);
  }

  function renderBadges(badges) {
    const holders = new Map(BADGES.map((b) => [b.id, []]));
    badges.forEach((ids, p) => ids.forEach((id) => holders.get(id) && holders.get(id).push(p)));
    let unlocked = 0;
    $('badgeList').innerHTML = BADGES.map((b) => {
      const who = holders.get(b.id).sort((x, y) => x.localeCompare(y, 'pt-BR'));
      if (who.length) unlocked++;
      return `
        <li class="badge-card${who.length ? ' is-on' : ''}">
          <span class="badge-icon" aria-hidden="true">${b.icon}</span>
          <div class="badge-info">
            <p class="badge-name">${esc(b.name)}</p>
            <p class="badge-desc">${esc(b.desc)}</p>
            <p class="badge-who">${who.length
              ? who.map((p) => `<span class="mchip"><img class="avatar" src="${avatar(p, 'N')}" alt="" width="20" height="19">${esc(p)}</span>`).join('')
              : '<span class="muted">Bloqueada</span>'}</p>
          </div>
        </li>`;
    }).join('');
    $('badgeCount').textContent = `${unlocked}/${BADGES.length}`;
  }

  function renderRanking(rows) {
    const badges = computeBadges();
    renderBadges(badges);
    const max = Math.max(1, ...rows.map((r) => r.wins));
    $('rankingList').innerHTML = rows.map((r) => {
      const medal = r.wins > 0 && r.pos <= 3 ? ` is-top is-top-${r.pos}` : '';
      const streak = r.streak >= 2 ? `<span class="streak" title="Vitórias seguidas">${ICON.flame}${r.streak} seguidas</span>` : '';
      return `
        <li class="rank-row${medal}" data-name="${esc(r.name)}">
          <span class="rank-pos">${r.pos === 1 && r.wins > 0 ? ICON.crown : r.pos + 'º'}</span>
          <img class="avatar avatar-lg" src="${avatar(r.name, 'N')}" alt="" width="36" height="33">
          <div class="rank-info">
            <p class="rank-name">${esc(r.name)} ${streak}${badgeIcons(badges.get(r.name))}</p>
            <p class="rank-sub">${r.games} ${r.games === 1 ? 'partida' : 'partidas'}${r.games ? ' · ' + Math.round(r.rate * 100) + '% de aproveitamento' : ''}</p>
            <div class="rank-bar" aria-hidden="true"><span style="width:${(r.wins / max) * 100}%"></span></div>
          </div>
          <div class="rank-wins"><b>${r.wins}</b><span>${r.wins === 1 ? 'vitória' : 'vitórias'}</span></div>
        </li>`;
    }).join('');
  }

  function badgeIcons(set) {
    if (!set || !set.size) return '';
    return `<span class="rank-badges">${BADGES.filter((b) => set.has(b.id)).map((b) => `<span title="${esc(b.name)}: ${esc(b.desc)}" aria-label="${esc(b.name)}">${b.icon}</span>`).join('')}</span>`;
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
    if (readOnly) return;
    const [removed] = state.matches.splice(idx, 1);
    save();
    renderData();
    deleteMatchRemote(id).catch((err) => { state.matches.push(removed); renderData(); writeFailed(err); });
    toast('Combate apagado.', {
      action: {
        label: 'Desfazer',
        fn: () => {
          state.matches.push(removed); save(); renderData();
          writeMatch(removed).catch(writeFailed);
        },
      },
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
    if (!drawing) $('btnRematch').disabled = !state.matches.length;
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
        if (shared) {
          if (readOnly) throw new Error('readonly');
          (async () => { try { for (const m of fresh) await writeMatch(m); } catch (err) { writeFailed(err); } })();
        }
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

    $('btnDraw').addEventListener('click', () => openDraw('random'));
    $('btnBalanced').addEventListener('click', () => openDraw('balanced'));
    $('btnRematch').addEventListener('click', openRematch);
    $('btnManual').addEventListener('click', () => setManual($('manualPanel').hidden));
    $('btnManualDone').addEventListener('click', () => setManual(false));
    $('drawPick').addEventListener('click', (e) => {
      const b = e.target.closest('.presence-chip');
      if (!b) return;
      const p = b.dataset.name;
      if (drawSel.has(p)) drawSel.delete(p); else drawSel.add(p);
      Sfx.play('click');
      renderDrawPick();
    });
    $('drawConfirm').addEventListener('click', confirmDraw);
    $('rematchConfirm').addEventListener('click', confirmRematch);
    document.querySelectorAll('dialog').forEach((d) => {
      d.addEventListener('click', (e) => {
        if (e.target === d || e.target.closest('[data-close]')) d.close();
      });
    });
    const snd = $('btnSound');
    const paintSound = () => {
      const on = !Sfx.muted;
      snd.setAttribute('aria-pressed', on);
      snd.setAttribute('aria-label', on ? 'Som ligado' : 'Som desligado');
      snd.title = on ? 'Som ligado — clique para silenciar' : 'Som desligado — clique para ligar';
    };
    snd.addEventListener('click', () => { Sfx.toggle(); paintSound(); });
    paintSound();
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
        Sfx.play('click');
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
    $('registerHint').addEventListener('click', (e) => { if (e.target.closest('[data-login]')) $('btnAuth').click(); });
    $('historyFilter').addEventListener('change', renderHistory);
    $('historyList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-delete]');
      if (b) removeMatch(b.dataset.delete);
    });


    window.addEventListener('storage', (e) => {
      if (e.key === KEY) {
        const keep = state.matches;
        state = load();
        if (shared) state.matches = keep;
        renderPresence(); renderAllTeams(); renderData();
      }
    });
  }

  // ---------- compartilhar equipes (imagem para o WhatsApp) ----------
  let shareBlob = null, shareText = '', shareUrl = null;
  async function openShare() {
    const A = teamPlayers('A'), B = teamPlayers('B');
    if (!A.length || !B.length) {
      Sfx.play('error');
      toast('Monte ou sorteie as duas equipes antes de compartilhar.', { tone: 'warn' });
      return;
    }
    const bench = teamPlayers('bench');
    const date = cap(new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date()));
    const site = /^https?:/.test(location.protocol) ? location.host : '';
    const btn = $('btnShare');
    btn.disabled = true;
    try {
      shareBlob = await window.ShareCard.render({ nameA: teamName('A'), nameB: teamName('B'), A, B, bench, date, site });
    } finally { btn.disabled = false; }
    if (!shareBlob) { toast('Não consegui gerar a imagem. Tente de novo.', { tone: 'warn' }); return; }
    shareText = `⚔️ Jogatina Família — equipes do próximo combate\n` +
      `🔥 ${teamName('A')}: ${A.join(', ')}\n` +
      `❄️ ${teamName('B')}: ${B.join(', ')}` +
      (bench.length ? `\n🪑 Banco: ${bench.join(', ')}` : '') +
      (site ? `\n${location.origin}${location.pathname}` : '');
    if (shareUrl) URL.revokeObjectURL(shareUrl);
    shareUrl = URL.createObjectURL(shareBlob);
    $('sharePreview').src = shareUrl;
    const file = new File([shareBlob], 'equipes.png', { type: 'image/png' });
    const canFiles = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    $('shareHelp').textContent = canFiles
      ? 'Toque em "Enviar no WhatsApp" e escolha o WhatsApp e o grupo.'
      : 'Neste aparelho, baixe a imagem e anexe no grupo. O botão verde abre o WhatsApp com a lista em texto.';
    $('shareDialog').showModal();
    Sfx.play('click');
  }
  async function sendShare() {
    if (!shareBlob) return;
    const file = new File([shareBlob], 'equipes.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: shareText });
        $('shareDialog').close();
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    window.open('https://wa.me/?text=' + encodeURIComponent(shareText), '_blank', 'noopener');
  }
  function downloadShare() {
    if (!shareUrl) return;
    const a = document.createElement('a');
    a.href = shareUrl;
    a.download = `equipes-${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    toast('Imagem salva. É só anexar no grupo do WhatsApp.');
  }
  function bindShare() {
    $('btnShare').addEventListener('click', openShare);
    $('shareSend').addEventListener('click', sendShare);
    $('shareDownload').addEventListener('click', downloadShare);
    $('shareClose').addEventListener('click', () => $('shareDialog').close());
    $('shareDialog').addEventListener('click', (e) => { if (e.target === $('shareDialog')) $('shareDialog').close(); });
  }

  // ---------- páginas e menu lateral ----------
  const ROUTES = ['inicio', 'placar', 'ranking', 'conquistas', 'historico'];
  function openMenu() {
    document.body.classList.add('menu-open');
    $('btnMenu').setAttribute('aria-expanded', 'true');
    const cur = document.querySelector('.drawer-link[aria-current="page"]') || document.querySelector('.drawer-link');
    setTimeout(() => cur && cur.focus(), 50);
  }
  function closeMenu(focusBtn) {
    if (!document.body.classList.contains('menu-open')) return;
    document.body.classList.remove('menu-open');
    $('btnMenu').setAttribute('aria-expanded', 'false');
    if (focusBtn) $('btnMenu').focus();
  }
  function route() {
    const h = location.hash.slice(1);
    const r = ROUTES.includes(h) ? h : 'inicio';
    document.querySelectorAll('[data-view]').forEach((el) => { el.hidden = el.dataset.view !== r; });
    document.querySelectorAll('[data-route]').forEach((a) => {
      if (a.dataset.route === r) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.body.dataset.route = r;
    closeMenu(false);
    window.scrollTo(0, 0);
  }
  function bindMenu() {
    $('btnMenu').addEventListener('click', () => (document.body.classList.contains('menu-open') ? closeMenu(true) : openMenu()));
    $('btnMenuClose').addEventListener('click', () => closeMenu(true));
    $('drawerBackdrop').addEventListener('click', () => closeMenu(true));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(true); });
    document.querySelectorAll('.drawer-link').forEach((a) => a.addEventListener('click', () => {
      if (a.getAttribute('href') === location.hash || (!location.hash && a.dataset.route === 'inicio')) route();
    }));
    window.addEventListener('hashchange', route);
    route();
  }

  // ---------- init ----------
  $('matchDate').value = nowLocal();
  renderPresence();
  renderAllTeams();
  renderData();
  bind();
  bindMenu();
  bindShare();
  setSync('local');
  connectShared();
  setInterval(() => renderStats(computeRanking()), 60000);
})();
