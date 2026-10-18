// Optional live telemetry. When data/hall.json names a feed ("telemetry": { "url", "intervalSeconds" }),
// it is polled and its figures replace the simulation for every server and rack it reports.
// Anything it leaves out, or stops reporting for three intervals, falls back to the simulation.
import { HALL } from './data.js';
import { byHost, byId, MEM_GB } from './racks.js';
import { pushAlert } from './alerts.js';

const T = HALL.telemetry || {}, EVERY = (T.intervalSeconds || 10) * 1000;
export const live = { enabled: !!T.url, servers: 0, at: 0, error: null };
export const fresh = o => !!o && performance.now() - o.at < EVERY * 3;
// Feeds often send numbers as strings; take those, and drop anything that is not a finite number
// (one NaN reaching the renderer turns the view black)
const num = v => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(+v) ? +v : null;
const pick = (v, keys) => Object.fromEntries(keys.map(k => [k, num(v && v[k])]));
const SV_KEYS = ['cpu', 'memGB', 'tempC', 'powerW', 'netGbps'], RACK_KEYS = ['inletC'];

async function poll() {
  try {
    const res = await fetch(T.url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json(), now = performance.now();
    let n = 0;
    for (const [host, v] of Object.entries(d.servers || {})) { const sv = byHost.get(host); if (sv) { sv.live = { ...pick(v, SV_KEYS), at: now }; n++; } }
    for (const [id, v] of Object.entries(d.racks || {})) { const r = byId[id]; if (r) r.live = { ...pick(v, RACK_KEYS), at: now }; }
    if (!live.at || live.error) pushAlert('info', `Live telemetry connected · ${n} server${n === 1 ? '' : 's'} reporting`);
    live.servers = n; live.at = now; live.error = null;
  } catch (e) {
    if (!live.error) pushAlert('warn', `Telemetry feed ${T.url} unreachable (${e.message}); showing simulated values`);
    live.error = e;
  }
}
if (live.enabled) { poll(); setInterval(poll, EVERY); }

// Apply a server's live figures over the simulated ones (cpu in %, memory in GB, CPU temperature in °C, power in W, network in Gb/s)
export function applyServer(sv) {
  const L = sv.live; if (!fresh(L)) return false;
  if (L.cpu != null) sv.load = Math.max(0, Math.min(1, L.cpu / 100));
  if (L.memGB != null) sv.mem = Math.max(0, Math.min(1, L.memGB / MEM_GB));
  if (L.tempC != null) sv.temp = L.tempC;
  if (L.powerW != null) sv.power = L.powerW;
  if (L.netGbps != null) sv.net = L.netGbps;
  return true;
}
export function applyRack(r) {
  const L = r.live; if (!fresh(L)) return;
  if (L.inletC != null) r.inlet = L.inletC;
}
