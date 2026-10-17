// HUD: KPI strip, rack panel (Live and Inventory tabs), server panel, legend.
import { $, COL, STOPS, cssGrad, SERVERS } from './core.js';
import { W, G, UI, SV } from './state.js';
import { MODEL, DRIVE, DRIVE_TB, CPU, iloUrl, highlight, unhighlight } from './racks.js';

// Set by main.js: open a server (pull it out)
export const hooks = { open: null };

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

// Server strip (one cell per server, U1 → U24)
const elevBtns = Array.from({ length: SERVERS }, (_, s) => {
  const b = document.createElement('button'); b.type = 'button';
  b.addEventListener('click', () => hooks.open(UI.selected.servers[s]));
  $('rElev').append(b); return b;
});

export function updateHud() {
  $('kRps').textContent = fmtK(G.rps);
  const cpuL = G.cpu > 0.85 ? 2 : G.cpu > 0.7 ? 1 : 0;
  $('kCpu').textContent = Math.round(G.cpu * 100) + '%'; $('kCpu').className = 'v ' + lvlClass(cpuL);
  $('kNet').innerHTML = Math.round(G.net) + '<small>Gbps</small>';
  $('kNetSub').textContent = Math.round(G.net / 32) + '% of 3.2T hall uplinks';
  $('kPow').innerHTML = Math.round(G.it) + '<small>kW</small>';
  $('kPowSub').textContent = 'of 1,152 kW provisioned';
  $('kPue').textContent = G.pue.toFixed(2);
  $('kPue').className = 'v ' + lvlClass(G.pue > 1.5 ? 1 : 0);
  $('kPueSub').textContent = 'cooling draw ' + Math.round(G.cool) + ' kW';
  const inL = G.maxIn > 32 ? 2 : G.maxIn > 27 ? 1 : 0;
  $('kIn').innerHTML = G.maxIn.toFixed(1) + '<small>°C</small>'; $('kIn').className = 'v ' + lvlClass(inL);
  $('kInSub').textContent = 'at ' + G.maxInRack.id + ' · limit 27 °C';

  if (SV.open && SV.sel) {
    const sv = SV.sel, tl = t => t > 95 ? 2 : t > 85 ? 1 : 0;
    $('sHost').textContent = sv.host;
    $('sMeta').textContent = `Rack ${sv.r.id} · U${sv.u}–${sv.u + 1} · ${sv.r.row.role}`;
    const ri = sv.r.kind, cpu = CPU[ri], id = sv.r.id.toLowerCase(), tb = DRIVE_TB[ri];
    $('spHost').innerHTML = `${sv.host}.hall2.local <span>· ${MODEL[ri]} · SN ${sv.serial}</span>`;
    $('spCpu').innerHTML = `2× ${cpu.name} <span>· 32 cores each at ${cpu.ghz} GHz, 64 in total</span>`;
    $('spOs').innerHTML = `${sv.os[0]} <span>· Linux kernel ${sv.os[1]}</span>`;
    $('spRam').innerHTML = `512 GB DDR5-4800 <span>· 16 × 32 GB · ${Math.round(SV.mem * 512)} GB in use</span>`;
    $('spDisk').innerHTML = `${DRIVE[ri]} <span>· ${tb.toFixed(1)} TB raw · ${(tb * sv.diskUsed).toFixed(1)} TB used (${Math.round(sv.diskUsed * 100)}%)</span>`;
    $('spNet').innerHTML = `bond0 ${sv.ip}/24 <span>· VLAN ${sv.vlan} · gateway ${sv.gw} · LACP 802.3ad · MTU 9000</span>`;
    $('spNic1').innerHTML = `ens1f0 → tor-${id}-a ${sv.port} <span>· 25 GbE · ${sv.mac[0]}</span>`;
    $('spNic2').innerHTML = `ens1f1 → tor-${id}-b ${sv.port} <span>· 25 GbE · ${sv.mac[1]}</span>`;
    $('spIlo').innerHTML = `${sv.ilo} <span>· oob-${id} ${sv.oobPort} · 1 GbE · ${sv.iloMac}</span>`;
    const ilo = $('sIlo'); if (ilo.dataset.ip !== sv.ilo) { ilo.dataset.ip = sv.ilo; ilo.href = iloUrl(sv.ilo); ilo.setAttribute('aria-label', `Open the iLO console for ${sv.host} at ${sv.ilo}`); }
    $('sStatus').textContent = statusText[SV.status]; $('sStatus').className = 'pill ' + statusClass[SV.status];
    $('sCpuV').textContent = Math.round(sv.load * 100) + '%'; $('sCpuV').className = lvlClass(SV.cLvl);
    $('sT0').textContent = SV.temp[0].toFixed(0) + ' °C'; $('sT0').className = lvlClass(tl(SV.temp[0]));
    $('sT1').textContent = SV.temp[1].toFixed(0) + ' °C'; $('sT1').className = lvlClass(tl(SV.temp[1]));
    $('sFan').textContent = (Math.round(SV.rpm / 100) * 100).toLocaleString('en-US') + ' rpm';
    $('sMem').textContent = Math.round(SV.mem * 512) + ' GB';
    $('sIops').textContent = fmtK(SV.iops);
    $('sNet').textContent = SV.netIn.toFixed(1) + ' / ' + SV.netOut.toFixed(1);
    $('sPow').textContent = Math.round(SV.power) + ' W';
    const st = $('sStress'), on = sv.stressLeft > 0;
    st.setAttribute('aria-pressed', String(on));
    st.textContent = on ? `Stop test · ${Math.ceil(sv.stressLeft)} s` : 'Run 20 s stress test';
    return;
  }

  const r = UI.selected;
  elevBtns.forEach((b, s) => {
    const sv = r.servers[s];
    b.style.background = cssGrad('load', sv.load);
    b.setAttribute('aria-label', `Inspect ${sv.host}, CPU ${Math.round(sv.load * 100)}%`);
    b.title = `${sv.host} · U${sv.u} · CPU ${Math.round(sv.load * 100)}%`;
  });
  $('rId').textContent = 'Rack ' + r.id;
  $('rRole').textContent = `${r.row.role} · Row ${r.row.id}`;
  $('rStatus').textContent = statusText[r.status]; $('rStatus').className = 'pill ' + statusClass[r.status];
  const cpu = r.load * 100;
  $('rCpu').textContent = Math.round(cpu) + '%';
  $('rCpuBar').style.width = cpu.toFixed(1) + '%'; $('rCpuBar').style.background = barColor(cpu, 85, 95);
  $('rMem').textContent = (r.mem * SERVERS * 0.512).toFixed(1) + ' of ' + (SERVERS * 0.512).toFixed(1) + ' TB';
  $('rMemBar').style.width = (r.mem * 100).toFixed(1) + '%'; $('rMemBar').style.background = barColor(r.mem * 100, 85, 95);
  $('rIn').textContent = r.inlet.toFixed(1) + ' °C'; $('rIn').className = lvlClass(r.tLvl);
  $('rEx').textContent = r.exhaust.toFixed(1) + ' °C';
  $('rPow').textContent = r.power.toFixed(1) + ' kW';
  $('rNet').textContent = r.net.toFixed(1) + ' Gb/s';
  const nOk = SERVERS - r.svWarn - r.svCrit;
  $('rRoll').innerHTML = `<span>Rolled up from <b>${SERVERS}</b> servers</span><span><b>${nOk}</b> OK</span>` +
    (r.svWarn ? `<span class="w">${r.svWarn} warning</span>` : '') + (r.svCrit ? `<span class="c">${r.svCrit} critical</span>` : '');
  if (!$('rInv').hidden) updateInv(r);
}

export function updateSparks() {
  drawSpark($('sRps'), G.rpsHist, { color: COL.cold });
  drawSpark($('sCpu'), G.cpuHist, { color: COL.cold, min: 0, max: 100, thr: 85 });
  if (SV.open && SV.sel) { drawSpark($('sSpark'), SV.sel.hist, { color: COL.cold, min: 0, max: 100, thr: 85 }); return; }
  drawSpark($('rSpark'), UI.selected.hist, { color: COL.cold, min: 0, max: 100, thr: 85 });
  drawSpark($('rSparkT'), UI.selected.ihist, { color: COL.cold, min: 17, max: 34, thr: 27 });
}

export function drawCores() {
  const cv = $('sCores'), w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const gap = 10, cols = 8, bw = (w - gap) / 2, cw = bw / cols, ch = h / 4;
  for (let i = 0; i < 64; i++) {
    const k = i >> 5, j = i & 31;
    g.fillStyle = cssGrad('load', SV.cores[i]);
    g.fillRect(k * (bw + gap) + (j % cols) * cw + 1, ((j / cols) | 0) * ch + 1, cw - 2, ch - 2);
  }
}

export function renderLegend() {
  const s = STOPS[W.mode];
  const [lo, hi] = W.mode === 'load' ? [0, 1] : [18, 33];
  const pct = v => ((v - lo) / (hi - lo) * 100).toFixed(1) + '%';
  $('lgBar').style.background = `linear-gradient(90deg, ${s.map(([v, c]) => `${c} ${pct(v)}`).join(', ')})`;
  const ticks = W.mode === 'load' ? s.map(([v]) => Math.round(v * 100) + '%') : s.map(([v], i) => v + (i === s.length - 1 ? ' °C' : ''));
  $('lgTicks').innerHTML = s.map(([v], i) => `<span style="left:${pct(v)}">${ticks[i]}</span>`).join('');
}

// ---------- Rack inventory (42U elevation, top down); hovering a row outlines that device in the rack ----------
let invRack = null, invRows = [];
function buildInv(r) {
  invRack = r; invRows = [];
  const tb = $('invBody'); tb.textContent = '';
  const add = (u, name, sub, cls, spot) => {
    const tr = document.createElement('tr'); if (cls) tr.className = cls;
    tr.innerHTML = `<td>${u}</td><td><div class="dev"><b></b><span></span></div></td><td class="n"></td><td class="n"></td>`;
    tr.querySelector('b').textContent = name; tr.querySelector('span').textContent = sub;
    if (spot) {
      const on = () => { spot(); UI.hovered = r; }, off = () => { unhighlight(); UI.hovered = null; };
      tr.addEventListener('mouseenter', on); tr.addEventListener('mouseleave', off);
      tr.addEventListener('focus', on); tr.addEventListener('blur', off);
    }
    tb.append(tr); return tr;
  };
  const id = r.id.toLowerCase();
  ['a', 'b'].forEach((ab, k) => invRows.push({ kind: 'sw', tr: add('U' + (42 - k), `tor-${id}-${ab}`, `ToR switch · 48× 25G + 8× 100G
Ethernet1/1–${SERVERS} → servers' NIC ${k + 1}`, '', () => highlight(r, 42 - k, 1, -1)) }));
  add('U40', `pp-${id}`, 'Patch panel · 48-port LC fibre (rear)', '', () => highlight(r, 40, 1, -1));
  add('U39', `oob-${id}`, `OOB switch · 48× 1GbE (rear)
Gi1/0/1–${SERVERS} → servers' iLO`, '', () => highlight(r, 39, 1, -1));
  add('U25–38', 'Empty', '14U · blanking panels fitted', 'empty', () => highlight(r, 25, 14, 1));
  for (let s = SERVERS - 1; s >= 0; s--) {
    const sv = r.servers[s];
    const tr = add(`U${sv.u}–${sv.u + 1}`, sv.host, `${MODEL[r.kind]} · ${DRIVE[r.kind]}\nSN ${sv.serial} · in service ${sv.installed}`, 'sv', () => highlight(r, sv.u, 2, 1));
    tr.tabIndex = 0; tr.setAttribute('aria-label', `Pull out ${sv.host}`);
    tr.addEventListener('click', () => hooks.open(sv));
    tr.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hooks.open(sv); } });
    invRows.push({ kind: 'sv', sv, tr });
  }
  ['a', 'b'].forEach((ab, k) => invRows.push({ kind: 'pdu', tr: add('0U', `pdu-${id}-${ab}`, 'Vertical PDU · 3-phase · 22 kW (rear)', '', () => highlight(r, 1, 42, -1, (k ? 1 : -1) * 0.278, 0.04)) }));
  const tot = add('', 'Rack total', `${SERVERS} servers + 2 switches`, 'tot', () => highlight(r, 1, 42, 1));
  tot.querySelector('b').style.color = 'var(--cold)';
  invRows.push({ kind: 'tot', tr: tot });
  $('invSum').innerHTML = `<b>${SERVERS}</b> servers · <b>${SERVERS * 64}</b> cores · <b>${(SERVERS * 0.512).toFixed(1)} TB</b> RAM · <b>${(SERVERS * DRIVE_TB[r.kind]).toFixed(0)} TB</b> NVMe<br>` +
    `<b>2</b> ToR switches · <b>1</b> OOB switch · <b>2</b> PDUs · <b>1</b> patch panel · <b>14U</b> free of 42U`;
}
function updateInv(r) {
  if (invRack !== r) { unhighlight(); buildInv(r); }
  for (const row of invRows) {
    const c = row.tr.cells;
    if (row.kind === 'sv') {
      const sv = row.sv;
      c[2].innerHTML = `<span class="dot ${statusClass[sv.status]}"></span>${Math.round(sv.load * 100)}%`;
      c[3].textContent = Math.round(sv.power) + ' W';
    } else if (row.kind === 'sw') {
      c[2].textContent = (r.net / 2).toFixed(1) + ' Gb/s';
      c[3].textContent = Math.round(r.swPower / 2 * 1000) + ' W';
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
