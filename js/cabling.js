// Structured cabling at the rear of every cabinet: blue patch leads from each server's iDRAC port and its two NIC
// ports, dressed to the right into a strapped bundle up the side of the cabinet and fanned out at the top to the OOB
// switch (U39) and the two ToR switches (U42 takes NIC 1, U41 NIC 2), each lead to the port numbered after its server.
// Power cords keep to the left. Geometry is in a cabinet's rear frame: x to the right seen from behind, y up, z out
// from the rear face. A server's own leads (port to bundle) are a separate piece, so they leave with it when it is pulled out.
// Each piece comes in two levels of detail: fine for close up, and a coarse one (three-sided, no plugs) for the hall view.
import { THREE, lc, U, uY, LOW_POWER, SERVERS } from './core.js';
import { REAR_PORTS, SW_PORT } from './textures.js';

const V3 = THREE.Vector3, R = 0.0028;
// Sides of a cable, and segments in a bend (a tight one at a plug, a wider one into or out of the bundle)
const DETAIL = { fine: { rad: LOW_POWER ? 4 : 5, tight: 3, wide: LOW_POWER ? 3 : 5, plugs: true }, coarse: { rad: 3, tight: 1, wide: 2, plugs: false } };
const FACE_Z = 0.013, BOOT_Z = 0.039;   // a mounted device's face; where a plug's boot ends and the cable begins
const PX = px => (px / 512 - 0.5) * 0.52;
const plateH = h => h * U - (h === 2 ? 0.0016 : 0.0012);
// The bundle: six columns (iDRAC leads, NIC 2, NIC 1, two of each) by six layers (a pair of servers each), so every
// group peels off at its switch without crossing the ones still going up
const BX = 0.236, BZ = 0.024, BP = 0.0062;
const slot = (s, k) => [BX + ([0, 2, 1][k] * 2 + (s & 1)) * BP, BZ + (s >> 1) * BP];
// Each lead drops out of its port and runs right at its own depth (the iDRAC lead, furthest left, outermost)
const RUN_Z = [0.058, 0.052, 0.046], JX = 0.19, DROP = 0.006, RISE = 0.028;
// Port y in a device's face, from grid pixels
const portY = (py, h) => (0.5 - py / (h === 2 ? 86 : 44)) * plateH(h);

const UP = new V3(0, 1, 0), RIGHT = new V3(1, 0, 0), LEFT = new V3(-1, 0, 0), OUT = new V3(0, 0, 1), IN = new V3(0, 0, -1);
// Smooth bend from a heading in one direction to b heading in another
function bend(a, ta, b, tb, n) {
  const L = a.distanceTo(b) * 0.5;
  return new THREE.CubicBezierCurve3(a, a.clone().addScaledVector(ta, L), b.clone().addScaledVector(tb, -L), b).getPoints(n);
}

// Sheaths vary a little from box to box; boots are moulded a shade darker
const JACKET = lc('#1f63c6'), BOOT = lc('#1a4ea3'), METAL = lc('#a3acb4'), CLEAR = lc('#c3cdd5'), STRAP = lc('#111316');
const tint = (s, k) => JACKET.clone().multiplyScalar(0.88 + ((s * 7 + k * 3) % 5) * 0.06);

class Buf {
  p = []; n = []; c = []; i = [];
  constructor(d) { this.d = d; }
  // A cable along pts, its rings kept square to the path by parallel transport
  tube(pts, col) {
    const n = pts.length, base = this.p.length / 3, T = new V3(), N = new V3(), B = new V3(), RAD = this.d.rad;
    for (let i = 0; i < n; i++) {
      T.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
      if (i === 0) N.set(...(Math.abs(T.y) > 0.9 ? [1, 0, 0] : [0, 1, 0]));
      N.addScaledVector(T, -N.dot(T)).normalize(); B.crossVectors(T, N);
      for (let k = 0; k < RAD; k++) {
        const a = k / RAD * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        const nx = N.x * ca + B.x * sa, ny = N.y * ca + B.y * sa, nz = N.z * ca + B.z * sa;
        this.p.push(pts[i].x + nx * R, pts[i].y + ny * R, pts[i].z + nz * R); this.n.push(nx, ny, nz); this.c.push(col.r, col.g, col.b);
      }
    }
    for (let i = 0; i < n - 1; i++) for (let k = 0; k < RAD; k++) {
      const a = base + i * RAD + k, b = base + i * RAD + (k + 1) % RAD;
      this.i.push(a, b, a + RAD, b, b + RAD, a + RAD);
    }
  }
  // open: leave out the back face, which sits in a port or against the part behind
  box(x, y, z, sx, sy, sz, col, open) {
    const h = [sx / 2, sy / 2, sz / 2], o = [x, y, z];
    for (let a = 0; a < 3; a++) for (const sg of [-1, 1]) {
      if (open && a === 2 && sg < 0) continue;
      const b = (a + 1) % 3, d = (a + 2) % 3, base = this.p.length / 3;
      for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const q = [0, 0, 0], nn = [0, 0, 0]; q[a] = sg * h[a]; q[b] = u * h[b]; q[d] = v * h[d]; nn[a] = sg;
        this.p.push(o[0] + q[0], o[1] + q[1], o[2] + q[2]); this.n.push(...nn); this.c.push(col.r, col.g, col.b);
      }
      this.i.push(...(sg > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]).map(v => base + v));
    }
  }
  // A plug in the port at (x, y): an RJ45 with a clear body, or an SFP28 direct-attach end with its pull tab
  plug(x, y, rj45, col) {
    if (!this.d.plugs) return;
    if (rj45) { this.box(x, y, FACE_Z + 0.002, 0.0115, 0.0082, 0.012, CLEAR, true); this.box(x, y, (FACE_Z + 0.008 + BOOT_Z) / 2, 0.0125, 0.0105, BOOT_Z - FACE_Z - 0.008, BOOT, true); }
    else {
      this.box(x, y, 0.018, 0.0135, 0.0085, 0.018, METAL, true); this.box(x, y, (0.027 + BOOT_Z) / 2, 0.0105, 0.0078, BOOT_Z - 0.027, BOOT, true);
      this.box(x, y + 0.0036, 0.038, 0.006, 0.0014, 0.022, col);
    }
  }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i); g.computeBoundingSphere();
    return g;
  }
}

export const cableMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.05 });

// Server s's three leads in a cabinet of h-U servers, y from the server's centre: plug, a drop out of the port, the run
// right and the turn up into the bundle. Built from the bundle end, so its rings meet the trunk's exactly.
export function leadGeo(h, s, detail) {
  const d = DETAIL[detail], B = new Buf(d);
  REAR_PORTS[h].forEach(([px, py], k) => {
    const x = PX(px), y = portY(py, h), col = tint(s, k), [sx, sz] = slot(s, k), ry = y - DROP;
    B.plug(x, y, k === 0, col);
    const a = bend(new V3(sx, ry + RISE, sz), UP.clone().negate(), new V3(JX, ry, RUN_Z[k]), LEFT, d.wide);
    B.tube([...a, ...bend(new V3(x + 0.016, ry, RUN_Z[k]), LEFT, new V3(x, y, BOOT_Z), IN, d.tight)], col);
  });
  return B.geo();
}

// Everything that stays in the cabinet, y from the floor: the bundle from each lead's entry up to its switch, the
// fan-out along the switch to its port and plug, and velcro straps round the bundle
export function trunkGeo(h, detail) {
  const d = DETAIL[detail], B = new Buf(d), entry = [];
  for (let s = 0; s < SERVERS; s++) {
    const ys = uY(1 + s * h, h);
    REAR_PORTS[h].forEach(([, py], k) => {
      const [sx, sz] = slot(s, k), sy = ys + portY(py, h) - DROP + RISE, col = tint(s, k);
      const [qx, qy] = SW_PORT(s + 1), tx = PX(qx), ty = uY([39, 42, 41][k], 1) + portY(qy, 1);
      // ports further left are reached at greater depth, so no run passes in front of a plug further along
      const zr = 0.045 + (5 - (s >> 1)) * BP;
      B.tube([new V3(sx, sy, sz), ...bend(new V3(sx, ty - 0.04, sz), UP, new V3(sx - 0.03, ty, zr), LEFT, d.wide),
        ...bend(new V3(tx + 0.022, ty, zr), LEFT, new V3(tx, ty, BOOT_Z), IN, d.tight)], col);
      B.plug(tx, ty, k === 0, col);
      entry[s >> 1] = Math.max(entry[s >> 1] || 0, sy);
    });
  }
  // A strap above each layer as it joins (no closer than 15 cm), then every 20 cm up to where the iDRAC leads peel off
  const top = uY(39, 1) - 0.07, w = 6 * BP + 0.004;
  let last = -1;
  const strap = (y, L) => { const z0 = BZ - R - 0.0012, z1 = BZ + L * BP + R + 0.0012; B.box(BX + 2.5 * BP, y, (z0 + z1) / 2, w, 0.012, z1 - z0, STRAP); last = y; };
  entry.forEach((y, L) => { if (y + 0.03 - last >= 0.15 || L === entry.length - 1) strap(y + 0.03, L); });
  for (let y = last + 0.2; y < top; y += 0.2) strap(y, entry.length - 1);
  return B.geo();
}
