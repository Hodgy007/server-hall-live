// Hardware faults. A server can lose a PSU, an NVMe drive or a fan and keep running degraded;
// a rack can lose one of its two top-of-rack switches, leaving every server's bond on one link.
import { racks } from './racks.js';
import { pushAlert } from './alerts.js';

export const FAULTS = [];
racks.forEach(r => { r.torDown = [false, false]; r.servers.forEach(sv => { sv.faults = []; }); });

const KINDS = ['psu', 'disk', 'fan', 'tor'];
const pick = a => a[(Math.random() * a.length) | 0];

// What a fault means, in words, for panels and alerts
export function describe(f) {
  const id = f.r.id.toLowerCase();
  switch (f.kind) {
    case 'psu': return `PSU ${f.k + 1} failed · running on PSU ${2 - f.k}`;
    case 'disk': return `NVMe drive ${f.k + 1} failed · RAID degraded, rebuilding onto the hot spare`;
    case 'fan': return `Fan ${f.k + 1} failed · the other five spin faster`;
    case 'tor': return `tor-${id}-${'ab'[f.k]} down · ${f.r.servers.length} servers on one link`;
  }
}

export function inject(kind = pick(KINDS), r = pick(racks)) {
  let f;
  if (kind === 'tor') {
    const k = r.torDown[0] ? 1 : r.torDown[1] ? 0 : (Math.random() * 2) | 0;
    if (r.torDown[k]) return null;
    r.torDown[k] = true; f = { kind, r, k };
  } else {
    const sv = pick(r.servers), n = kind === 'disk' ? 8 : kind === 'fan' ? 6 : 2;
    const k = (Math.random() * n) | 0;
    if (sv.faults.some(x => x.kind === kind && x.k === k)) return null;
    f = { kind, r, sv, k };
    sv.faults.push(f);
  }
  FAULTS.push(f);
  pushAlert('warn', `${f.sv ? f.sv.host : r.id}: ${describe(f)}`);
  return f;
}

export function clearAll() {
  if (!FAULTS.length) return;
  for (const f of FAULTS) { if (f.sv) f.sv.faults.length = 0; else f.r.torDown[f.k] = false; }
  pushAlert('ok', `${FAULTS.length} hardware fault${FAULTS.length > 1 ? 's' : ''} repaired`);
  FAULTS.length = 0;
}

export const rackFaults = r => FAULTS.filter(f => f.r === r);
export const hasFault = (sv, kind, k) => sv.faults.some(f => f.kind === kind && (k === undefined || f.k === k));
