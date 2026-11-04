/* Jogatina Família — tour guiado (destaque + balão com próximo/voltar/pular) */
(function (global) {
  'use strict';

  let steps = [], idx = 0, onEnd = null, els = null;

  function build() {
    const spot = document.createElement('div');
    spot.className = 'tour-spot';
    const tip = document.createElement('div');
    tip.className = 'tour-tip';
    tip.setAttribute('role', 'dialog');
    tip.setAttribute('aria-live', 'polite');
    tip.innerHTML = `
      <p class="tour-step"></p>
      <h3 class="tour-title"></h3>
      <p class="tour-text"></p>
      <div class="tour-actions">
        <button type="button" class="tour-skip">Pular tour</button>
        <span class="tour-spacer"></span>
        <button type="button" class="btn btn-ghost btn-sm tour-prev">Voltar</button>
        <button type="button" class="btn btn-primary btn-sm tour-next">Próximo</button>
      </div>`;
    document.body.append(spot, tip);
    tip.querySelector('.tour-skip').addEventListener('click', () => end());
    tip.querySelector('.tour-prev').addEventListener('click', () => go(idx - 1));
    tip.querySelector('.tour-next').addEventListener('click', () => (idx >= steps.length - 1 ? end() : go(idx + 1)));
    return { spot, tip };
  }

  function place() {
    if (!els) return;
    const s = steps[idx];
    const target = s.target ? document.querySelector(s.target) : null;
    const visible = target && target.getClientRects().length > 0;
    const { spot, tip } = els;
    const vw = window.innerWidth, vh = window.innerHeight;
    tip.style.maxWidth = Math.min(360, vw - 32) + 'px';
    if (!visible) {
      spot.classList.add('is-center');
      spot.style.cssText = '';
      tip.style.left = Math.max(16, (vw - tip.offsetWidth) / 2) + 'px';
      tip.style.top = Math.max(16, (vh - tip.offsetHeight) / 2) + 'px';
      tip.classList.remove('is-above');
      return;
    }
    spot.classList.remove('is-center');
    const r = target.getBoundingClientRect();
    const pad = 6;
    spot.style.left = r.left - pad + 'px';
    spot.style.top = r.top - pad + 'px';
    spot.style.width = r.width + pad * 2 + 'px';
    spot.style.height = r.height + pad * 2 + 'px';
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = r.left + r.width / 2 - tw / 2;
    left = Math.max(16, Math.min(left, vw - tw - 16));
    let top = r.bottom + 14;
    let above = false;
    if (top + th > vh - 16) { top = r.top - th - 14; above = true; }
    if (top < 16) { top = Math.max(16, vh - th - 16); }
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
    tip.classList.toggle('is-above', above);
  }

  function go(i) {
    if (i < 0 || i >= steps.length) return;
    idx = i;
    const s = steps[idx];
    const { tip } = els;
    tip.querySelector('.tour-step').textContent = `${idx + 1} de ${steps.length}`;
    tip.querySelector('.tour-title').textContent = s.title;
    tip.querySelector('.tour-text').textContent = s.text;
    tip.querySelector('.tour-prev').hidden = idx === 0;
    tip.querySelector('.tour-next').textContent = idx === steps.length - 1 ? (s.finish || 'Bora pra guerra!') : 'Próximo';
    if (s.before) s.before();
    const target = s.target ? document.querySelector(s.target) : null;
    if (target && target.getClientRects().length) {
      target.scrollIntoView({ block: 'center', behavior: 'auto' });
    }
    requestAnimationFrame(() => { place(); tip.querySelector('.tour-next').focus(); });
  }

  function onKey(e) {
    if (!els) return;
    if (e.key === 'Escape') end();
    else if (e.key === 'ArrowRight') go(idx + 1);
    else if (e.key === 'ArrowLeft') go(idx - 1);
  }

  function end() {
    if (!els) return;
    els.spot.remove(); els.tip.remove(); els = null;
    window.removeEventListener('resize', place);
    window.removeEventListener('scroll', place, true);
    document.removeEventListener('keydown', onKey);
    document.body.classList.remove('is-touring');
    const cb = onEnd; onEnd = null;
    if (cb) cb();
  }

  function start(list, done) {
    if (els || !list.length) return;
    steps = list; idx = 0; onEnd = done || null;
    els = build();
    document.body.classList.add('is-touring');
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('keydown', onKey);
    go(0);
  }

  global.Tour = { start, end, get active() { return !!els; } };
})(window);
