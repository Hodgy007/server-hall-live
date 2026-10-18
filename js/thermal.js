// Thermal camera: a false-colour infrared view of the hall. Every solid surface takes the colour of the air
// where it stands: cold aisles and rack fronts at their inlet temperature, rack rears and hot aisles at their
// exhaust, warming towards the ceiling plenum. Server faces show each server's own inlet and exhaust.
// Glass, perforated doors, labels and the light columns drop out so the racks behind them show.
import { THREE, scene, cutPlane, ROWS, COLS, PITCH, ROW_HALF, RACK_D, SERVERS, ROOM, STOPS, LST } from './core.js';
import { racks, plates, rears } from './racks.js';

// Air temperature over the floor plan, one cell every ~0.19 m: red = °C, green = how much of it is cold aisle
const FX = 64, FZ = 112;
const field = new THREE.DataTexture(new Uint16Array(FX * FZ * 4), FX, FZ, THREE.RGBAFormat, THREE.HalfFloatType);
field.minFilter = field.magFilter = THREE.LinearFilter;
// Per-server surface temperature: row 0 the front (inlet side), row 1 the rear (exhaust)
const NS = racks.length * SERVERS;
const svTemp = new THREE.DataTexture(new Float32Array(NS * 2 * 4), NS, 2, THREE.RGBAFormat, THREE.FloatType);

// What each strip of the floor plan is, front to back across the rows (fixed, so worked out once)
const HALF = RACK_D / 2;
const strips = Array.from({ length: FZ }, (_, iz) => {
  const z = -ROOM.z + (iz + 0.5) / FZ * 2 * ROOM.z, first = ROWS[0], last = ROWS[ROWS.length - 1];
  if (z < first.z - HALF) return { kind: 'end', i: 0, d: first.z - HALF - z };
  if (z > last.z + HALF) return { kind: 'end', i: ROWS.length - 1, d: z - last.z - HALF };
  for (let i = 0; i < ROWS.length; i++) {
    const R = ROWS[i];
    if (Math.abs(z - R.z) <= HALF) return { kind: 'rack', i, t: (R.face * (R.z - z) + HALF) / RACK_D };   // 0 front → 1 rear
    if (i < ROWS.length - 1 && z < ROWS[i + 1].z - HALF) return { kind: i % 2 ? 'hot' : 'cold', i };
  }
});

const IR = STOPS.ir;
const U = {
  field: { value: field }, svTemp: { value: svTemp }, fieldBox: { value: new THREE.Vector4(-ROOM.x, -ROOM.z, 2 * ROOM.x, 2 * ROOM.z) },
  plenumT: { value: 32 }, supplyT: { value: 18 },
  irV: { value: IR.map(([v]) => v) }, irC: { value: LST.ir.map(([, c]) => c) }
};
const vertexShader = `
  #include <common>
  #include <clipping_planes_pars_vertex>
  uniform highp sampler2D svTemp;
  uniform float svRow;
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
    vSvT = svRow >= 0.0 ? texelFetch( svTemp, ivec2( gl_InstanceID, int( svRow ) ), 0 ).r : -100.0;
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
    o.material = irMat(!m0.userData.noClip, o === plates ? 0 : o === rears ? 1 : -1);
  });
  acc = Infinity;
}

const half = THREE.DataUtils.toHalfFloat, rk = (i, c) => racks[i * COLS + c];
let acc = 0;
// Refresh the temperatures a few times a second while the camera is on
export function updateThermal(dt) {
  if (!thermal.on || (acc += dt) < 0.25) return;
  acc = 0;
  let sumIn = 0, sumEx = 0, minIn = Infinity;
  for (const r of racks) { sumIn += r.inlet; sumEx += r.exhaust; minIn = Math.min(minIn, r.inlet); }
  const room = sumIn / racks.length + 2;
  U.plenumT.value = sumEx / racks.length - 2; U.supplyT.value = minIn - 1.5;

  const d = field.image.data;
  for (let iz = 0; iz < FZ; iz++) {
    const S = strips[iz];
    for (let ix = 0; ix < FX; ix++) {
      const x = -ROOM.x + (ix + 0.5) / FX * 2 * ROOM.x;
      // between rack columns the temperature blends from one rack to the next; past the row ends it fades to room air
      const u = Math.max(0, Math.min(COLS - 1, x / PITCH + (COLS - 1) / 2)), c0 = Math.floor(u), c1 = Math.min(COLS - 1, c0 + 1), w = u - c0;
      const at = (i, key) => rk(i, c0)[key] * (1 - w) + rk(i, c1)[key] * w;
      let t, cold = 0;
      if (S.kind === 'rack') t = at(S.i, 'inlet') * (1 - S.t) + at(S.i, 'exhaust') * S.t;
      else if (S.kind === 'cold') { t = (at(S.i, 'inlet') + at(S.i + 1, 'inlet')) / 2; cold = 1; }
      else if (S.kind === 'hot') t = (at(S.i, 'exhaust') + at(S.i + 1, 'exhaust')) / 2;
      else t = at(S.i, 'exhaust') + (room - at(S.i, 'exhaust')) * Math.min(1, S.d / 2.5);
      const beyond = Math.max(0, Math.abs(x) - ROW_HALF), k = Math.min(1, beyond / 1.5);
      t += (room - t) * k; cold *= 1 - k;
      const o = (iz * FX + ix) * 4;
      d[o] = half(t); d[o + 1] = half(cold);
    }
  }
  field.needsUpdate = true;

  const s = svTemp.image.data;
  racks.forEach((r, ri) => r.servers.forEach((sv, k) => {
    const i = ri * SERVERS + k;
    s[i * 4] = r.inlet + 1.5 + sv.load * 3;                   // front bezel, a little above the inlet air
    s[(NS + i) * 4] = r.inlet + 4 + sv.power * 0.018;         // exhaust: ~9 °C over inlet idle, ~20 °C flat out
  }));
  svTemp.needsUpdate = true;
}
