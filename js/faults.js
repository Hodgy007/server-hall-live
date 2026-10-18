// Hardware fault state read by the panels and the pulled-out server. A server can lose a PSU, an NVMe drive or
// a fan and keep running degraded; a rack can lose one of its two top-of-rack switches. Nothing in the page
// raises faults any more, so the lists stay empty unless something adds to FAULTS.
import { racks } from './racks.js';

export const FAULTS = [];
racks.forEach(r => { r.torDown = [false, false]; r.servers.forEach(sv => { sv.faults = []; }); });

// What a fault means, in words, for the panels
export function describe(f) {
  const id = f.r.id.toLowerCase();
  switch (f.kind) {
    case 'psu': return `PSU ${f.k + 1} failed · running on PSU ${2 - f.k}`;
    case 'disk': return `NVMe drive ${f.k + 1} failed · RAID degraded, rebuilding onto the hot spare`;
    case 'fan': return `Fan ${f.k + 1} failed · the other five spin faster`;
    case 'tor': return `tor-${id}-${'ab'[f.k]} down · ${f.r.servers.length} servers on one link`;
  }
}

export const rackFaults = r => FAULTS.filter(f => f.r === r);
export const hasFault = (sv, kind, k) => sv.faults.some(f => f.kind === kind && (k === undefined || f.k === k));
