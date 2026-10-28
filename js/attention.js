// Needs attention: a header chip counting every rack and server in warning or critical state, and a list of them,
// worst first and grouped by rack. Clicking a rack flies to it; clicking a server pulls it out.
import { $, esc } from './core.js';
import { racks } from './racks.js';
import { SHORT } from './faults.js';

const CLS = ['ok', 'warn', 'crit'];
const pct = v => Math.round(v * 100) + '%';
const byNum = (a, b) => a.localeCompare(b, undefined, { numeric: true });

// What is wrong with a rack itself (its servers are listed under it)
function rackWhy(r) {
  const w = [];
  if (r.tLvl) w.push(`inlet ${r.inlet.toFixed(1)} °C`);
  if (r.cpuLvl) w.push(`CPU ${pct(r.load)}`);
  r.torDown.forEach((d, k) => { if (d) w.push(`ToR ${'AB'[k]} down`); });
  return w;
}
function serverWhy(sv) {
  const w = [];
  if (sv.cLvl) w.push(`CPU ${pct(sv.load)}`);
  if (sv.tLvl) w.push(`CPU temp ${Math.round(sv.temp)} °C`);
  for (const f of sv.faults) w.push(SHORT[f.kind](f.k));
  return w;
}

function collect() {
  const groups = [];
  for (const r of racks) {
    const own = Math.max(r.tLvl, r.cpuLvl, r.faultLvl);
    const svs = r.servers.filter(sv => sv.status).sort((a, b) => b.status - a.status || b.u - a.u);
    if (!own && !svs.length) continue;
    groups.push({ r, own, lvl: Math.max(own, ...svs.map(sv => sv.status)), svs });
  }
  return groups.sort((a, b) => b.lvl - a.lvl || b.svs.length - a.svs.length || byNum(a.r.id, b.r.id));
}

export function initAttention({ openServer, focusRack }) {
  const btn = $('attnBtn'), box = $('attnList'), phone = matchMedia('(max-width: 720px)');
  let sig = '', whys = [], targets = new Map();

  const toggle = open => { box.hidden = !open; btn.setAttribute('aria-expanded', String(open)); };
  btn.addEventListener('click', () => toggle(box.hidden));
  box.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const t = targets.get(b.dataset.k); if (!t) return;
    if (t.servers) focusRack(t); else openServer(t);
    if (phone.matches) toggle(false);   // on a phone the list would hide what it just flew to
  });

  return function updateAttention() {
    const groups = collect();
    const n = groups.reduce((s, g) => s + (g.own ? 1 : 0) + g.svs.length, 0), worst = Math.max(0, ...groups.map(g => g.lvl));
    btn.textContent = n ? `${n} need${n === 1 ? 's' : ''} attention` : 'All OK';
    btn.className = 'chip ' + CLS[worst];
    btn.disabled = !n;
    if (!n) { toggle(false); sig = ''; return; }

    // Rebuild only when what is listed changes; otherwise just refresh the figures, so focus and hover survive
    const next = groups.map(g => g.r.id + g.own + ':' + g.svs.map(sv => sv.host + sv.status).join(',')).join('|');
    const rows = groups.flatMap(g => [rackWhy(g.r).join(' · ') || `${g.svs.length} server${g.svs.length === 1 ? '' : 's'}`, ...g.svs.map(sv => serverWhy(sv).join(' · '))]);
    if (next === sig) { rows.forEach((t, i) => { whys[i].textContent = t; }); return; }

    const focused = box.contains(document.activeElement) ? document.activeElement.dataset.k : null;
    sig = next; targets = new Map(); let i = 0;
    const item = (k, t, lvl, name) => { targets.set(k, t); return `<button type="button" data-k="${esc(k)}"><span class="dot ${CLS[lvl]}"></span><b>${esc(name)}</b><span class="why">${esc(rows[i++])}</span></button>`; };
    box.innerHTML = '<ul>' + groups.map(g =>
      `<li>${item('r:' + g.r.id, g.r, g.own || g.lvl, g.r.id)}` +
      (g.svs.length ? '<ul>' + g.svs.map(sv => `<li>${item('s:' + sv.host, sv, sv.status, sv.host)}</li>`).join('') + '</ul>' : '') + '</li>'
    ).join('') + '</ul>';
    whys = [...box.querySelectorAll('.why')];
    if (focused) box.querySelector(`[data-k="${CSS.escape(focused)}"]`)?.focus();
  };
}
