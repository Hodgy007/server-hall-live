// HUD: KPI strip, rack panel (Live and Inventory tabs), server panel, legend.
import { $, COL, STOPS, cssGrad, esc, RACK_KW } from './core.js';
import { W, G, UI, SV } from './state.js';
import { racks, iloUrl, DOMAIN, freeCount, highlight, unhighlight } from './racks.js';
import { fmtGB, fmtMem } from './site.js';
import { describe, rackFaults } from './faults.js';

const SHORT = { psu: k => `PSU ${k + 1} failed`, disk: k => `drive ${k + 1} failed`, fan: k => `fan ${k + 1} failed` };

// Set by main.js: open a server (pull it out)
export const hooks = { open: null };

// A server's rack units, e.g. U3–4, or U7 for a 1U server
const uSpan = sv => sv.h > 1 ? `U${sv.u}–${sv.u + sv.h - 1}` : `U${sv.u}`;
const fmtK = v => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : Math.round(v).toString();
const lvlClass = l => l === 2 ? 'is-crit' : l === 1 ? 'is-warn' : 'is-ok';
const statusText = ['OK', 'Warning', 'Critical'], statusClass = ['ok', 'warn', 'crit'];
const barColor = (v, w, c) => v > c ? COL.crit : v > w ? COL.warn : COL.ok;

function drawSpark(cv, data, o) {
  const w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h || data.length < 2) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  let lo = o.min, hi = o.max;
  if (lo == null || hi == null) { lo = Math.min(...data); hi = Math.max(...data); const pad = (hi - lo) * 0.2 || 1; lo -= pad; hi += pad; }
  const X = i => 2 + i / (data.length - 1) * (w - 7);
  const Y = v => h - 2 - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * (h - 5);
  g.strokeStyle = COL.line; g.lineWidth = 1; g.beginPath(); g.moveTo(0, h - 0.5); g.lineTo(w, h - 0.5); g.stroke();
  if (o.thr != null && o.thr >= lo && o.thr <= hi) {
    g.setLineDash([3, 3]); g.strokeStyle = COL.warn; g.globalAlpha = 0.6;
    g.beginPath(); g.moveTo(0, Math.round(Y(o.thr)) + 0.5); g.lineTo(w, Math.round(Y(o.thr)) + 0.5); g.stroke();
    g.setLineDash([]); g.globalAlpha = 1;
  }
  const trace = () => { g.beginPath(); data.forEach((v, i) => i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v))); };
  trace(); g.lineTo(X(data.length - 1), h); g.lineTo(X(0), h); g.closePath();
  g.fillStyle = o.color; g.globalAlpha = 0.14; g.fill(); g.globalAlpha = 1;
  trace(); g.strokeStyle = o.color; g.lineWidth = 1.4; g.lineJoin = 'round'; g.stroke();
  const lx = X(data.length - 1), ly = Y(data[data.length - 1]);
  g.fillStyle = o.color; g.beginPath(); g.arc(lx, ly, 2.5, 0, Math.PI * 2); g.fill();
}

// Server strip: one cell per server in the selected rack, bottom up; rebuilt when the rack changes
let elevRack = null, elevBtns = [];
function buildElev(r) {
  elevRack = r; $('rElev').textContent = '';
  $('rElev').style.gridTemplateColumns = `repeat(${Math.min(19, Math.max(1, r.servers.length))}, minmax(0, 1fr))`;
  elevBtns = r.servers.map(sv => {
    const b = document.createElement('button'); b.type = 'button';
    b.addEventListener('click', () => hooks.open(sv));
    $('rElev').append(b); return b;
  });
}
// The servers in a rack, in a few words: "12 servers · Dell PowerEdge R7725" or "9 servers · 3 models"
const rackSummary = r => {
  const models = [...new Set(r.servers.map(sv => sv.model))], n = r.servers.length;
  return n ? `${n} server${n > 1 ? 's' : ''} · ${models.length === 1 ? models[0] : models.length + ' models'}` : 'No servers recorded';
};

// ---------- The selected server's record ----------
// Built when a server is pulled out; only the memory in use and link state change after that
const row = (dt, html) => `<div><dt>${dt}</dt><dd>${html}</dd></div>`;
const sub = parts => parts.filter(Boolean).map(esc).join(' · ');
const diskLine = d => `${d.count > 1 ? d.count + '× ' : ''}${d.sizeGB ? fmtGB(d.sizeGB) + ' ' : ''}${esc(d.type || 'disk')}${d.model ? ' ' + esc(d.model) : ''}` +
  (d.raid ? ` <span>· ${esc(d.raid)}</span>` : '');
const sanLine = d => `${esc(d.name || d.type || 'volume')} <span>· ${sub([d.type !== d.name && d.type, d.array, d.protocol, d.sizeGB ? fmtGB(d.sizeGB) : '', d.lun !== undefined && d.lun !== '' ? 'LUN ' + d.lun : ''])}</span>`;
let specFor = null;
function renderSpecs(sv) {
  specFor = sv;
  const n = sv.rec, m = sv.spec, tag = n.family === 'dell' ? 'Service Tag' : 'Serial';
  const dpc = m.dimms / (m.channels * m.sockets), per = n.memory.gb / m.dimms;
  const local = n.localDisks.length ? n.localDisks.map(diskLine).join('<br>') + ` <span>· ${sv.driveTB.toFixed(1)} TB raw, ${Math.round(sv.diskUsed * 100)}% used</span>` : '<span>None recorded</span>';
  const nics = n.nics.length ? n.nics : [];
  $('sSpecs').innerHTML =
    row('Server', `${esc(sv.host)}.${esc(DOMAIN)} <span>· ${esc(sv.model)} · ${tag} ${esc(sv.serial)}${n.installed ? ' · in service ' + esc(n.installed) : ''}</span>`) +
    row('Location', `${esc(n.building || '—')} / ${esc(n.room || '—')} <span>· rack ${esc(n.rack)} · ${uSpan(sv)}${n.role ? ' · ' + esc(n.role) : ''}</span>`) +
    row('Processor', `${esc(sv.cpu)} <span>· ${esc(sv.cpuNote)}</span>`) +
    row('OS', `${esc(sv.os[0])}${sv.os[1] ? ` <span>· kernel ${esc(sv.os[1])}</span>` : ''}`) +
    row('Memory', `${fmtMem(n.memory.gb)} ${esc(n.memory.type)} <span>· ${m.dimms} × ${fmtMem(per)}${Number.isInteger(dpc) && dpc <= 2 ? `, ${dpc === 1 ? 'one DIMM' : 'two DIMMs'} on each of ${m.channels} channels per socket` : ''} · <b id="spMemUse"></b> in use</span>`) +
    row('Local disks', local) +
    row('Attached', n.attachedDisks.length ? n.attachedDisks.map(sanLine).join('<br>') : '<span>None</span>') +
    row('Network', n.ips.length ? n.ips.map(a => `${a.iface ? esc(a.iface) + ' ' : ''}${esc(a.address)} <span>· ${sub([a.vlan !== undefined && a.vlan !== '' ? 'VLAN ' + a.vlan : '', a.gateway && 'gateway ' + a.gateway])}</span>`).join('<br>') : '<span>No addresses recorded</span>') +
    nics.map((c, k) => row(`NIC ${k + 1}`, `${esc(c.name)}${c.switch || c.port ? ` → ${esc([c.switch, c.port].filter(Boolean).join(' '))}` : ''} <span>· ${sub([c.speed && (/\d$/.test(c.speed) ? c.speed + ' GbE' : c.speed), c.bond, c.mac])}</span><em class="bad" id="spLink${k}"></em>`)).join('') +
    row(`OOB (${esc(sv.oobName)})`, sv.ilo || n.oob.port ? `${esc(sv.ilo || 'address not recorded')} <span>· ${sub([[n.oob.switch, n.oob.port].filter(Boolean).join(' '), n.oob.mac])}</span>` : '<span>Not recorded</span>');
  const ilo = $('sIlo'); ilo.href = iloUrl(sv); ilo.hidden = !sv.ilo;
  ilo.textContent = `Open ${sv.oobName} console ↗`; ilo.setAttribute('aria-label', `Open the ${sv.oobName} console for ${sv.host} at ${sv.ilo}`);
}

export function updateHud() {
  const cpuL = G.cpu > 0.85 ? 2 : G.cpu > 0.7 ? 1 : 0;
  $('kCpu').textContent = Math.round(G.cpu * 100) + '%'; $('kCpu').className = 'v ' + lvlClass(cpuL);
  $('kNet').innerHTML = Math.round(G.net) + '<small>Gbps</small>';
  // uplinks: about 33 Gb/s per rack to the meet-me room; power: each rack's budget
  const upl = racks.length * 33.3;
  $('kNetSub').textContent = upl ? `${Math.round(G.net / upl * 100)}% of ${upl >= 1000 ? (upl / 1000).toFixed(1) + 'T' : Math.round(upl) + 'G'} hall uplinks` : 'no racks';
  $('kPow').innerHTML = Math.round(G.it) + '<small>kW</small>';
  $('kPowSub').textContent = `of ${(racks.length * RACK_KW).toLocaleString('en-US')} kW provisioned`;
  const inL = G.maxIn > 32 ? 2 : G.maxIn > 27 ? 1 : 0;
  $('kIn').innerHTML = G.maxInRack ? G.maxIn.toFixed(1) + '<small>°C</small>' : '—'; $('kIn').className = 'v ' + lvlClass(inL);
  $('kInSub').textContent = G.maxInRack ? 'at ' + G.maxInRack.id + ' · limit 27 °C' : '';

  if (SV.open && SV.sel) {
    const sv = SV.sel, tl = t => t > 95 ? 2 : t > 85 ? 1 : 0, m = sv.spec;
    if (specFor !== sv) renderSpecs(sv);
    $('sHost').textContent = sv.host;
    $('sMeta').textContent = `Rack ${sv.r.id} · ${uSpan(sv)} · ${sv.rec.role || sv.r.prof.role}`;
    $('spMemUse').textContent = fmtMem(SV.mem * sv.memGB);
    sv.rec.nics.forEach((c, k) => { const el = $('spLink' + k); if (el) el.textContent = k < 2 && sv.r.torDown[k] ? ' · link down' : ''; });
    const fl = $('sFaults'), all = sv.faults.concat(rackFaults(sv.r).filter(f => !f.sv));
    fl.hidden = !all.length; fl.innerHTML = all.map(f => `<li>${describe(f)}</li>`).join('');
    $('sStatus').textContent = statusText[SV.status]; $('sStatus').className = 'pill ' + statusClass[SV.status];
    $('sCoresL').textContent = `Per-core load, ${m.cores * m.sockets} cores`; $('sCoresR').textContent = m.sockets > 1 ? 'CPU0 · CPU1' : 'CPU0';
    $('sCpuV').textContent = Math.round(sv.load * 100) + '%'; $('sCpuV').className = lvlClass(SV.cLvl);
    $('sT0').textContent = SV.temp[0].toFixed(0) + ' °C'; $('sT0').className = lvlClass(tl(SV.temp[0]));
    // single-socket servers have no CPU1
    $('sT1').textContent = SV.temp.length > 1 ? SV.temp[1].toFixed(0) + ' °C' : '—'; $('sT1').className = SV.temp.length > 1 ? lvlClass(tl(SV.temp[1])) : '';
    $('sFan').textContent = (Math.round(SV.rpm / 100) * 100).toLocaleString('en-US') + ' rpm';
    $('sMem').textContent = Math.round(SV.mem * sv.memGB) + ' GB';
    $('sIops').textContent = fmtK(SV.iops);
    $('sNet').textContent = SV.netIn.toFixed(1) + ' / ' + SV.netOut.toFixed(1);
    $('sPow').textContent = Math.round(SV.power) + ' W';
    const st = $('sStress'), on = sv.stressLeft > 0;
    st.setAttribute('aria-pressed', String(on));
    st.textContent = on ? `Stop test · ${Math.ceil(sv.stressLeft)} s` : 'Run 20 s stress test';
    return;
  }

  const r = UI.selected; if (!r) return;
  if (elevRack !== r) buildElev(r);
  elevBtns.forEach((b, s) => {
    const sv = r.servers[s];
    b.style.background = cssGrad('load', sv.load);
    b.setAttribute('aria-label', `Inspect ${sv.host}, CPU ${Math.round(sv.load * 100)}%`);
    b.title = `${sv.host} · U${sv.u} · CPU ${Math.round(sv.load * 100)}%`;
  });
  $('rId').textContent = 'Rack ' + r.id;
  $('rRole').textContent = `${r.prof.role} · Row ${r.row.id}`;
  $('rStatus').textContent = statusText[r.status]; $('rStatus').className = 'pill ' + statusClass[r.status];
  const cpu = r.load * 100;
  $('rCpu').textContent = Math.round(cpu) + '%';
  $('rCpuBar').style.width = cpu.toFixed(1) + '%'; $('rCpuBar').style.background = barColor(cpu, 85, 95);
  const memTB = r.servers.reduce((t, sv) => t + sv.memGB, 0) / 1000;
  $('rMem').textContent = (r.mem * memTB).toFixed(1) + ' of ' + memTB.toFixed(1) + ' TB';
  $('rElevL').textContent = rackSummary(r);
  $('rMemBar').style.width = (r.mem * 100).toFixed(1) + '%'; $('rMemBar').style.background = barColor(r.mem * 100, 85, 95);
  $('rIn').textContent = r.inlet.toFixed(1) + ' °C'; $('rIn').className = lvlClass(r.tLvl);
  $('rEx').textContent = r.exhaust.toFixed(1) + ' °C';
  $('rPow').textContent = r.power.toFixed(1) + ` / ${RACK_KW} kW`;
  $('rNet').textContent = r.net.toFixed(1) + ' Gb/s';
  const nOk = r.servers.length - r.svWarn - r.svCrit;
  const nf = rackFaults(r).length;
  $('rRoll').innerHTML = `<span>Rolled up from <b>${r.servers.length}</b> servers</span><span><b>${nOk}</b> OK</span>` +
    (r.svWarn ? `<span class="w">${r.svWarn} warning</span>` : '') + (r.svCrit ? `<span class="c">${r.svCrit} critical</span>` : '') +
    (nf ? `<span class="w">${nf} hardware fault${nf > 1 ? 's' : ''}</span>` : '');
  if (!$('rInv').hidden) updateInv(r);
}

export function updateSparks() {
  drawSpark($('sCpu'), G.cpuHist, { color: COL.cold, min: 0, max: 100, thr: 85 });
  if (SV.open && SV.sel) { drawSpark($('sSpark'), SV.sel.hist, { color: COL.cold, min: 0, max: 100, thr: 85 }); return; }
  if (!UI.selected) return;
  drawSpark($('rSpark'), UI.selected.hist, { color: COL.cold, min: 0, max: 100, thr: 85 });
  drawSpark($('rSparkT'), UI.selected.ihist, { color: COL.cold, min: 17, max: 34, thr: 27 });
}

export function drawCores() {
  const cv = $('sCores'), w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  // one block per socket, cells laid out to suit the core count (32 to 120 per socket)
  const m = SV.sel.spec, per = m.cores, ns = m.sockets, gap = 10, bw = (w - gap * (ns - 1)) / ns;
  const cols = Math.ceil(Math.sqrt(per * bw / h)), rows = Math.ceil(per / cols), cw = bw / cols, ch = h / rows, pad = cw > 6 ? 1 : 0.5;
  for (let i = 0; i < per * ns; i++) {
    const k = (i / per) | 0, j = i % per;
    g.fillStyle = cssGrad('load', SV.cores[i]);
    g.fillRect(k * (bw + gap) + (j % cols) * cw + pad, ((j / cols) | 0) * ch + pad, cw - 2 * pad, ch - 2 * pad);
  }
}

export function renderLegend() {
  if (UI.thermal) {
    const s = STOPS.ir, lo = s[0][0], hi = s[s.length - 1][0], pct = v => ((v - lo) / (hi - lo) * 100).toFixed(1) + '%';
    $('lgBar').style.background = `linear-gradient(90deg, ${s.map(([v, c]) => `${c} ${pct(v)}`).join(', ')})`;
    $('lgTicks').innerHTML = [16, 26, 36, 46].map((v, i) => `<span style="left:${pct(v)}">${v}${i === 3 ? ' °C' : ''}</span>`).join('');
    return;
  }
  const s = STOPS[W.mode];
  const pctMode = W.mode !== 'heat', [lo, hi] = pctMode ? [0, 1] : [18, 33];
  const pct = v => ((v - lo) / (hi - lo) * 100).toFixed(1) + '%';
  $('lgBar').style.background = `linear-gradient(90deg, ${s.map(([v, c]) => `${c} ${pct(v)}`).join(', ')})`;
  const ticks = pctMode ? s.map(([v], i) => Math.round(v * 100) + '%' + (W.mode === 'power' && i === s.length - 1 ? ' of 12 kW' : '')) : s.map(([v], i) => v + (i === s.length - 1 ? ' °C' : ''));
  $('lgTicks').innerHTML = s.map(([v], i) => `<span style="left:${pct(v)}">${ticks[i]}</span>`).join('');
}

// ---------- Rack inventory (42U elevation, top down); hovering a row outlines that device in the rack ----------
let invRack = null, invRows = [];
function buildInv(r) {
  invRack = r; invRows = [];
  const tb = $('invBody'); tb.textContent = '';
  const add = (u, name, sub, cls, spot) => {
    const tr = document.createElement('tr'); if (cls) tr.className = cls;
    tr.innerHTML = `<td>${u}</td><td><div class="dev"><b></b><span></span><em class="flt"></em></div></td><td class="n"></td><td class="n"></td>`;
    tr.querySelector('b').textContent = name; tr.querySelector('span').textContent = sub;
    if (spot) {
      const on = () => { spot(); UI.hovered = r; }, off = () => { unhighlight(); UI.hovered = null; };
      tr.addEventListener('mouseenter', on); tr.addEventListener('mouseleave', off);
      tr.addEventListener('focus', on); tr.addEventListener('blur', off);
    }
    tb.append(tr); return tr;
  };
  const id = r.id.toLowerCase(), n = r.servers.length;
  ['a', 'b'].forEach((ab, k) => invRows.push({ kind: 'sw', k, tr: add('U' + (42 - k), `tor-${id}-${ab}`, `ToR switch · 48× 25G + 8× 100G
${n ? `Ethernet ports → ${n} servers' NIC ${k + 1}` : 'no servers cabled'}`, '', () => highlight(r, 42 - k, 1, -1)) }));
  add('U40', `pp-${id}`, 'Patch panel · 48-port LC fibre (rear)', '', () => highlight(r, 40, 1, -1));
  add('U39', `oob-${id}`, `OOB switch · 48× 1GbE (rear)
${n ? `→ ${n} servers' out-of-band ports` : 'no servers cabled'}`, '', () => highlight(r, 39, 1, -1));
  // U38 down to U1: each server where its top U is, runs of free U as one "Empty" row
  const at = new Map(r.servers.map(sv => [sv.u + sv.h - 1, sv]));
  for (let u = 38; u >= 1;) {
    const sv = at.get(u);
    if (sv) {
      const tr = add(uSpan(sv), sv.host, `${sv.model} · ${sv.drives}\n${sv.rec.family === 'dell' ? 'Service Tag' : 'Serial'} ${sv.serial} · in service ${sv.installed}`, 'sv', () => highlight(r, sv.u, sv.h, 1));
      tr.tabIndex = 0; tr.setAttribute('aria-label', `Pull out ${sv.host}`);
      tr.addEventListener('click', () => hooks.open(sv));
      tr.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hooks.open(sv); } });
      invRows.push({ kind: 'sv', sv, tr });
      u -= sv.h; continue;
    }
    let lo = u;
    while (lo > 1 && !at.get(lo - 1) && !r.servers.some(s => lo - 1 >= s.u && lo - 1 < s.u + s.h)) lo--;
    const top = u, cnt = top - lo + 1;
    add(cnt > 1 ? `U${lo}–${top}` : `U${top}`, 'Empty', `${cnt}U · blanking panel${cnt > 1 ? 's' : ''} fitted`, 'empty', () => highlight(r, lo, cnt, 1));
    u = lo - 1;
  }
  ['a', 'b'].forEach((ab, k) => invRows.push({ kind: 'pdu', tr: add('0U', `pdu-${id}-${ab}`, 'Vertical PDU · 3-phase · 22 kW (rear)', '', () => highlight(r, 1, 42, -1, (k ? 1 : -1) * 0.278, 0.04)) }));
  const tot = add('', 'Rack total', `${n} servers + 2 switches`, 'tot', () => highlight(r, 1, 42, 1));
  tot.querySelector('b').style.color = 'var(--cold)';
  invRows.push({ kind: 'tot', tr: tot });
  const cores = r.servers.reduce((t, sv) => t + sv.spec.cores * sv.spec.sockets, 0), ram = r.servers.reduce((t, sv) => t + sv.memGB, 0) / 1000;
  const disk = r.servers.reduce((t, sv) => t + sv.driveTB, 0), san = r.servers.reduce((t, sv) => t + sv.rec.attachedDisks.reduce((a, d) => a + (d.sizeGB || 0) * d.count, 0), 0) / 1000;
  $('invSum').innerHTML = `<b>${n}</b> servers · <b>${cores.toLocaleString('en-US')}</b> cores · <b>${ram.toFixed(1)} TB</b> RAM · <b>${disk.toFixed(0)} TB</b> local disk` + (san ? ` · <b>${san.toFixed(0)} TB</b> attached` : '') + '<br>' +
    `<b>2</b> ToR switches · <b>1</b> OOB switch · <b>2</b> PDUs · <b>1</b> patch panel · <b>${freeCount(r)}U</b> free of 42U`;
}
function updateInv(r) {
  if (invRack !== r) { unhighlight(); buildInv(r); }
  for (const row of invRows) {
    const c = row.tr.cells;
    if (row.kind === 'sv') {
      const sv = row.sv;
      c[2].innerHTML = `<span class="dot ${statusClass[sv.status]}"></span>${Math.round(sv.load * 100)}%`;
      c[3].textContent = Math.round(sv.power) + ' W';
      row.tr.querySelector('.flt').textContent = sv.faults.map(f => SHORT[f.kind](f.k)).join(' · ');
    } else if (row.kind === 'sw') {
      const down = r.torDown[row.k];
      c[2].innerHTML = down ? '<span class="dot crit"></span>DOWN' : (r.net / 2).toFixed(1) + ' Gb/s';
      c[3].textContent = down ? '—' : Math.round(r.swPower / 2 * 1000) + ' W';
      row.tr.querySelector('.flt').textContent = down ? 'link down · servers on tor-' + r.id.toLowerCase() + '-' + 'ab'[1 - row.k] + ' only' : '';
    } else if (row.kind === 'pdu') {
      c[2].textContent = Math.round(r.power / 2 / 22 * 100) + '%';
      c[3].textContent = (r.power / 2).toFixed(2) + ' kW';
    } else {
      c[2].innerHTML = `<span class="dot ${statusClass[r.status]}"></span>${Math.round(r.load * 100)}%`;
      c[3].textContent = r.power.toFixed(2) + ' kW';
    }
  }
}
function setRackTab(inv) {
  $('tabLive').setAttribute('aria-selected', String(!inv)); $('tabLive').tabIndex = inv ? -1 : 0;
  $('tabInv').setAttribute('aria-selected', String(inv)); $('tabInv').tabIndex = inv ? 0 : -1;
  $('rLive').hidden = inv; $('rInv').hidden = !inv;
  if (!inv) unhighlight();
  updateHud(); if (!inv) updateSparks();
}
$('tabLive').addEventListener('click', () => setRackTab(false));
$('tabInv').addEventListener('click', () => setRackTab(true));
$('tabLive').parentElement.addEventListener('keydown', e => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const inv = $('rInv').hidden; setRackTab(inv); (inv ? $('tabInv') : $('tabLive')).focus();
});
