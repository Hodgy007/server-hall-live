// Thermal camera: a false-colour infrared view of the hall. Every solid surface takes the colour of the air
// where it stands: cold aisles and rack fronts at their inlet temperature, rack rears and hot aisles at their
// exhaust, warming towards the ceiling plenum. Server faces show each server's own inlet and exhaust.
// Glass, perforated doors, labels and the light columns drop out so the racks behind them show.
import { THREE, scene, cutPlane, RACK_D, RACK_W, TILE, ROOM, STOPS, LST } from './core.js';
import { HALL } from './data.js';
import { racks, allServers } from './racks.js';

// Air temperature over the floor plan, one cell about every 0.19 m: red = °C, green = how much of it is cold aisle
const cellsAlong = (len, max) => Math.max(16, Math.min(max, Math.round(len / 0.19)));
const FX = cellsAlong(2 * ROOM.x, 160), FZ = cellsAlong(2 * ROOM.z, 220);
const field = new THREE.DataTexture(new Uint16Array(FX * FZ * 4), FX, FZ, THREE.RGBAFormat, THREE.HalfFloatType);
field.minFilter = field.magFilter = THREE.LinearFilter;
// Per-server surface temperature, two texels per server (front at the inlet side, rear at the exhaust), packed in rows
// of up to 2048 servers so a big hall stays inside any GPU's texture size
const NS = Math.max(1, allServers.length), SW = Math.min(NS, 2048), SH = Math.ceil(NS / SW) * 2;
const svTemp = new THREE.DataTexture(new Float32Array(SW * SH * 4), SW, SH, THREE.RGBAFormat, THREE.FloatType);

// What each cell of the floor plan sees, worked out once: inside a rack, the air going through it (front to rear); out
// in the room, a blend of the rack faces nearby (inlets in front of them, exhausts behind), fading to room air with
// distance. Vented tiles are cold aisle: supply air comes up cold through them.
const tileAt = (x, z) => { const c = Math.floor((x + ROOM.x) / TILE), r = Math.floor((z + ROOM.z) / TILE), g = HALL.grid.cells; return g[r] && g[r][c]; };
const plan = [];
for (let iz = 0; iz < FZ; iz++) for (let ix = 0; ix < FX; ix++) {
  const x = -ROOM.x + (ix + 0.5) / FX * 2 * ROOM.x, z = -ROOM.z + (iz + 0.5) / FZ * 2 * ROOM.z;
  const inside = racks.find(r => Math.abs(x - r.x) <= RACK_W / 2 && Math.abs(z - r.z) <= RACK_D / 2);
  if (inside) { plan.push({ inside, t: (RACK_D / 2 - inside.face * (z - inside.z)) / RACK_D, cold: 0 }); continue; }
  let wSum = 0, near = Infinity; const seen = [];
  for (const r of racks) {
    const front = r.face * (z - r.z) > 0, fz = r.z + (front ? 1 : -1) * r.face * RACK_D / 2;
    const d2 = (x - r.x) ** 2 + (z - fz) ** 2;
    if (d2 > 9) continue;
    near = Math.min(near, Math.sqrt(d2));
    const w = 1 / (d2 + 0.25); wSum += w; seen.push({ r, ex: !front, w });
  }
  seen.forEach(e => { e.w /= wSum; });
  plan.push({ seen, cold: tileAt(x, z) === 'P' ? 1 : 0, roomK: seen.length ? Math.min(1, near / 2.5) : 1 });
}

const IR = STOPS.ir;
const U = {
  field: { value: field }, svTemp: { value: svTemp }, fieldBox: { value: new THREE.Vector4(-ROOM.x, -ROOM.z, 2 * ROOM.x, 2 * ROOM.z) },
  plenumT: { value: 32 }, supplyT: { value: 18 }, svW: { value: SW },
  irV: { value: IR.map(([v]) => v) }, irC: { value: LST.ir.map(([, c]) => c) }
};
const vertexShader = `
  #include <common>
  #include <clipping_planes_pars_vertex>
  uniform highp sampler2D svTemp;
  uniform float svRow, svW;
  attribute float svIdx;
  varying vec3 vPos, vN;
  varying float vSvT;
  void main() {
    vec4 p = vec4( position, 1.0 );
    vec3 n = normal;
    #ifdef USE_INSTANCING
      p = instanceMatrix * p; n = mat3( instanceMatrix ) * n;
    #endif
    vec4 wp = modelMatrix * p;
    vPos = wp.xyz; vN = normalize( mat3( modelMatrix ) * n );
    int col = int( mod( svIdx, svW ) ), row = int( svIdx / svW ) * 2 + int( svRow );
    vSvT = svRow >= 0.0 ? texelFetch( svTemp, ivec2( col, row ), 0 ).r : -100.0;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <clipping_planes_vertex>
  }`;
const fragmentShader = `
  #include <common>
  #include <clipping_planes_pars_fragment>
  uniform sampler2D field;
  uniform vec4 fieldBox;
  uniform float plenumT, supplyT, irV[ ${IR.length} ];
  uniform vec3 irC[ ${IR.length} ];
  varying vec3 vPos, vN;
  varying float vSvT;
  vec3 ironbow( float t ) {
    vec3 c = irC[ 0 ];
    for ( int i = 1; i < ${IR.length}; i++ ) c = mix( c, irC[ i ], clamp( ( t - irV[ i - 1 ] ) / ( irV[ i ] - irV[ i - 1 ] ), 0.0, 1.0 ) );
    return c;
  }
  void main() {
    #include <clipping_planes_fragment>
    vec4 f = texture( field, ( vPos.xz - fieldBox.xy ) / fieldBox.zw );
    // supply air comes up cold through the cold-aisle floor; warm air pools under the ceiling
    float t = mix( supplyT, f.r, mix( 1.0, smoothstep( 0.0, 0.9, vPos.y ), f.g ) );
    t = mix( t, plenumT, smoothstep( 2.3, 3.6, vPos.y ) );
    if ( vSvT > -50.0 ) t = vSvT;
    // surfaces turned towards the camera read a little brighter, so shapes stay legible
    float facing = abs( dot( normalize( vN ), normalize( cameraPosition - vPos ) ) );
    gl_FragColor = vec4( ironbow( t ) * ( 0.72 + 0.28 * facing ), 1.0 );
  }`;
const mats = new Map();
function irMat(clip, svRow) {
  const key = clip + '|' + svRow;
  if (!mats.has(key)) {
    mats.set(key, new THREE.ShaderMaterial({
      uniforms: { ...U, svRow: { value: svRow } }, vertexShader, fragmentShader,
      clipping: clip, clippingPlanes: clip ? [cutPlane] : null, fog: false
    }));
  }
  return mats.get(key);
}

export const thermal = { on: false };
const saved = new Map();
// Swap every solid surface to the thermal material (or hide it), or put everything back
export function setThermal(on) {
  if (on === thermal.on) return;
  thermal.on = on;
  if (!on) {
    for (const [o, s] of saved) { o.material = s.material; o.visible = s.visible; }
    saved.clear();
    return;
  }
  scene.traverse(o => {
    if (!o.isMesh || o.userData.srv) return;   // the pulled-out server keeps its own look
    const m0 = Array.isArray(o.material) ? o.material[0] : o.material;
    saved.set(o, { material: o.material, visible: o.visible });
    if (m0.transparent || o.userData.irHide) { o.visible = false; return; }
    o.material = irMat(!m0.userData.noClip, o.userData.face === 'front' ? 0 : o.userData.face === 'rear' ? 1 : -1);
  });
  acc = Infinity;
}

const half = THREE.DataUtils.toHalfFloat;
let acc = 0;
// Refresh the temperatures a few times a second while the camera is on
export function updateThermal(dt) {
  if (!thermal.on || (acc += dt) < 0.25) return;
  acc = 0;
  if (!racks.length) return;
  let sumIn = 0, sumEx = 0, minIn = Infinity;
  for (const r of racks) { sumIn += r.inlet; sumEx += r.exhaust; minIn = Math.min(minIn, r.inlet); }
  const room = sumIn / racks.length + 2;
  U.plenumT.value = sumEx / racks.length - 2; U.supplyT.value = minIn - 1.5;

  const d = field.image.data;
  plan.forEach((c, i) => {
    let t;
    if (c.inside) t = c.inside.inlet * (1 - c.t) + c.inside.exhaust * c.t;
    else { t = 0; for (const e of c.seen) t += e.w * (e.ex ? e.r.exhaust : e.r.inlet); t += (room - t) * c.roomK; }
    d[i * 4] = half(t); d[i * 4 + 1] = half(c.cold);
  });
  field.needsUpdate = true;

  const s = svTemp.image.data;
  for (const sv of allServers) {
    const at = row => ((Math.floor(sv.idx / SW) * 2 + row) * SW + sv.idx % SW) * 4;
    s[at(0)] = sv.r.inlet + 1.5 + sv.load * 3;               // front bezel, a little above the inlet air
    s[at(1)] = sv.r.inlet + 4 + sv.power * 0.018;            // exhaust: ~9 °C over inlet idle, ~20 °C flat out
  }
  svTemp.needsUpdate = true;
}
