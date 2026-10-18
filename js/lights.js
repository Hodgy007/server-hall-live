// Ceiling lighting. The panel fixtures never move or dim, so the light they put on every surface is worked out
// once at start-up into a grid through the hall that lit materials look up, instead of evaluating 21 area lights
// for every pixel of every frame. In the cold aisle you are looking at, shadow-casting spot lights take over most
// of that aisle's fixtures so racks and overhead services throw real shadows. Also faint shafts of light in the
// haze under the cold-aisle fixtures.
import { THREE, scene, renderer, controls, lc, LOW_POWER, COLD, HACS, ROOM, cutPlane } from './core.js';

// Cold-aisle fixtures run down the middle of the aisle; over a hot aisle they sit between the chimneys
const FX_X = [-2.6, 0, 2.6], FX_XH = [-1.28, 1.28], FX_W = 1.6, FX_D = 0.16, FX_Y = ROOM.h - 0.03, FX_COL = 0xdcecff;
// Panel luminance in nits: cold aisles are lit for work, hot aisles sit above the containment roof and run dimmer
const AISLES = COLD.map((z, k) => ({ z, k, xs: FX_X, lum: 40 })).concat(HACS.map(H => ({ z: H.zc, xs: FX_XH, lum: 20 })));
const m4 = new THREE.Matrix4();

// Fixture panels, bright enough to bloom
{
  const fx = new THREE.InstancedMesh(new THREE.BoxGeometry(FX_W, 0.04, FX_D), new THREE.MeshBasicMaterial({ color: lc('#d8ecff').multiplyScalar(2.2) }), AISLES.reduce((n, a) => n + a.xs.length, 0));
  let n = 0;
  AISLES.forEach(a => a.xs.forEach(x => { m4.makeTranslation(x, FX_Y, a.z); fx.setMatrixAt(n++, m4); }));
  scene.add(fx);
}

// ---------- Baked fixture light ----------
// Grid points every ~0.37 m hold, for six directions (±x, ±y, ±z), the diffuse light arriving from the fixtures
// (luminance × form factor). A surface blends the three directions its normal leans towards (an "ambient cube").
const NX = 33, NY = 12, NZ = 57, N = NX * NY * NZ;
const GMIN = new THREE.Vector3(-ROOM.x, 0, -ROOM.z), GSTEP = new THREE.Vector3(2 * ROOM.x / (NX - 1), ROOM.h / (NY - 1), 2 * ROOM.z / (NZ - 1));
const DIRS = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [-1, 0, 0], [0, -1, 0], [0, 0, -1]];
const LY = FX_Y - 0.021;   // emitting face of the panels
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// Form factor of a fixture seen from a point with normal n: the panel is clipped to the hemisphere above the
// surface, then Lambert's polygon formula sums its edges
function formFactor(v, n) {
  const poly = [];
  for (let i = 0; i < 4; i++) {
    const a = v[i], b = v[(i + 1) % 4], da = dot(n, a), db = dot(n, b);
    if (da >= 0) poly.push(a);
    if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); poly.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); }
  }
  if (poly.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], la = Math.hypot(...a), lb = Math.hypot(...b);
    const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], len = Math.hypot(...c);
    if (len < 1e-12) continue;
    sum += Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (la * lb)))) * dot(n, c) / len;
  }
  return Math.abs(sum) / (2 * Math.PI);
}
// Light from a set of fixtures at every grid point, six floats per point. Beyond 3 m a panel is small enough
// to treat as a point source.
function bake(fixtures) {
  const out = new Float32Array(N * 6), A = FX_W * FX_D;
  for (let iz = 0, i = 0; iz < NZ; iz++) for (let iy = 0; iy < NY; iy++) for (let ix = 0; ix < NX; ix++, i++) {
    const px = GMIN.x + ix * GSTEP.x, py = Math.min(GMIN.y + iy * GSTEP.y, LY - 0.05), pz = GMIN.z + iz * GSTEP.z;
    for (const f of fixtures) {
      const dx = f.x - px, dy = LY - py, dz = f.z - pz, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > 9) {
        const d = Math.sqrt(d2), k = f.lum * A * (dy / d) / (Math.PI * d2);
        DIRS.forEach((n, j) => { const c = (n[0] * dx + n[1] * dy + n[2] * dz) / d; if (c > 0) out[i * 6 + j] += k * c; });
      } else {
        const v = [[dx - FX_W / 2, dy, dz - FX_D / 2], [dx + FX_W / 2, dy, dz - FX_D / 2], [dx + FX_W / 2, dy, dz + FX_D / 2], [dx - FX_W / 2, dy, dz + FX_D / 2]];
        DIRS.forEach((n, j) => { out[i * 6 + j] += f.lum * formFactor(v, n); });
      }
    }
  }
  return out;
}
// Six floats per point → two half-float RGBA volumes: (+x, +y, +z) and (−x, −y, −z)
function halves(f6) {
  const pos = new Uint16Array(N * 4), neg = new Uint16Array(N * 4), h = THREE.DataUtils.toHalfFloat;
  for (let i = 0; i < N; i++) for (let c = 0; c < 3; c++) { pos[i * 4 + c] = h(f6[i * 6 + c]); neg[i * 4 + c] = h(f6[i * 6 + 3 + c]); }
  return { pos, neg };
}
function volume(data) {
  const t = new THREE.Data3DTexture(data, NX, NY, NZ);
  t.format = THREE.RGBAFormat; t.type = THREE.HalfFloatType; t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}
const fixturesOf = a => a.xs.map(x => ({ x, z: a.z, lum: a.lum }));
// Each cold aisle on its own (the shadow spots take over part of it), and the whole hall
const perAisle = AISLES.filter(a => a.k !== undefined).map(a => bake(fixturesOf(a)));
const total = bake(AISLES.filter(a => a.k === undefined).flatMap(fixturesOf));
perAisle.forEach(f => { for (let i = 0; i < total.length; i++) total[i] += f[i]; });
const curHalves = perAisle.map(halves), totHalves = halves(total);
const BAKE = {
  bakePos: { value: volume(totHalves.pos) }, bakeNeg: { value: volume(totHalves.neg) },
  bakeCurPos: { value: volume(curHalves[0].pos.slice()) }, bakeCurNeg: { value: volume(curHalves[0].neg.slice()) },
  bakeShare: { value: 0 }, bakeColor: { value: new THREE.Color(FX_COL) },
  bakeMin: { value: GMIN }, bakeStep: { value: GSTEP }, bakeN: { value: new THREE.Vector3(NX, NY, NZ) }
};
// Give a lit (MeshStandardMaterial) material the baked fixture light. Called once for every material in the scene.
export function bakedLighting(m) {
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey();
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    Object.assign(sh.uniforms, BAKE);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBakePos;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 bakeP = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          bakeP = instanceMatrix * bakeP;
        #endif
        vBakePos = ( modelMatrix * bakeP ).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vBakePos;
        uniform highp sampler3D bakePos, bakeNeg, bakeCurPos, bakeCurNeg;
        uniform float bakeShare;
        uniform vec3 bakeColor, bakeMin, bakeStep, bakeN;`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        {
          vec3 nW = inverseTransformDirection( normal, viewMatrix ), n2 = nW * nW, up = step( 0.0, nW );
          vec3 uvw = ( ( vBakePos - bakeMin ) / bakeStep + 0.5 ) / bakeN;
          float lit = dot( n2, mix( texture( bakeNeg, uvw ).rgb, texture( bakePos, uvw ).rgb, up ) )
            - bakeShare * dot( n2, mix( texture( bakeCurNeg, uvw ).rgb, texture( bakeCurPos, uvw ).rgb, up ) );
          reflectedLight.directDiffuse += bakeColor * max( lit, 0.0 ) * material.diffuseColor;
        }`);
  };
  m.customProgramCacheKey = () => 'baked|' + prevKey;
}

// ---------- Shadows in the viewed aisle ----------
// The baked light has no shadows, so in the cold aisle nearest the camera's target a spot light under each fixture
// takes over most of that fixture's output and casts it. Changing aisle fades the spots out, moves them, fades them back.
const SHARE = 0.75, FADE = 0.35;
const spots = FX_X.map(() => {
  const s = new THREE.SpotLight(FX_COL, 0, 0, 1.0, 0.9, 2);
  s.castShadow = true;
  s.shadow.mapSize.setScalar(LOW_POWER ? 512 : 1024);
  s.shadow.bias = -0.0005; s.shadow.normalBias = 0.02;
  s.shadow.camera.near = 0.4; s.shadow.camera.far = 7;
  scene.add(s, s.target);
  return s;
});
const SH = { aisle: null, s: 0, cut: NaN };
function moveSpots(a) {
  spots.forEach((s, i) => {
    const x = a.xs[i];
    s.position.set(x, FX_Y - 0.05, a.z); s.target.position.set(x, 0, a.z); s.target.updateMatrixWorld();
  });
  // the baked light to subtract where the spots take over
  const h = curHalves[a.k];
  BAKE.bakeCurPos.value.image.data.set(h.pos); BAKE.bakeCurPos.value.needsUpdate = true;
  BAKE.bakeCurNeg.value.image.data.set(h.neg); BAKE.bakeCurNeg.value.needsUpdate = true;
  renderer.shadowMap.needsUpdate = true;
}

// ---------- Light shafts in the haze ----------
// A widening open box under each cold-aisle fixture, brightest at the top and at glancing angles, added on top of the scene
const shaftGeo = (() => {
  const top = [FX_W / 2, FX_D / 2], bot = [FX_W / 2 + 0.55, FX_D / 2 + 0.75], y0 = FX_Y - 0.03, y1 = 0.25;
  const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]], pos = [], uv = [];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = c[i], [bx, bz] = c[(i + 1) % 4];
    const T = k => [k[0] * top[0], y0, k[1] * top[1]], B = k => [k[0] * bot[0], y1, k[1] * bot[1]];
    pos.push(...T([ax, az]), ...B([ax, az]), ...B([bx, bz]), ...T([ax, az]), ...B([bx, bz]), ...T([bx, bz]));
    uv.push(0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
})();
const shaftMat = new THREE.ShaderMaterial({
  uniforms: { color: { value: lc('#cfe4ff') }, strength: { value: 0.06 } },
  vertexShader: `
    #include <common>
    #include <clipping_planes_pars_vertex>
    varying float vH; varying vec3 vN; varying vec3 vV; varying float vD;
    void main() {
      vH = uv.y;
      vec4 mvPosition = vec4(position, 1.0);
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
      #endif
      mvPosition = modelViewMatrix * mvPosition;
      vN = normalize(normalMatrix * normal); vV = normalize(-mvPosition.xyz); vD = length(mvPosition.xyz);
      gl_Position = projectionMatrix * mvPosition;
      #include <clipping_planes_vertex>
    }`,
  fragmentShader: `
    #include <common>
    #include <clipping_planes_pars_fragment>
    uniform vec3 color; uniform float strength;
    varying float vH; varying vec3 vN; varying vec3 vV; varying float vD;
    void main() {
      #include <clipping_planes_fragment>
      // Clamp before pow: with multisampling a GPU can evaluate just outside a triangle, where vH dips below 0,
      // and pow of a negative is NaN, which the bloom pass smears into a black block across the screen
      float edge = pow(clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 1.5);
      // haze is only visible over distance: a shaft fades out as the camera walks into it
      gl_FragColor = vec4(color * strength * pow(clamp(vH, 0.0, 1.0), 1.8) * edge * smoothstep(1.5, 5.0, vD), 1.0);
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, clipping: true
});
{
  const shafts = new THREE.InstancedMesh(shaftGeo, shaftMat, COLD.length * FX_X.length);
  COLD.forEach((z, i) => FX_X.forEach((x, k) => { m4.makeTranslation(x, 0, z); shafts.setMatrixAt(i * FX_X.length + k, m4); }));
  shafts.renderOrder = 3; scene.add(shafts);
}

export function updateLights(dt) {
  const tz = controls.target.z;
  // Only cold aisles: a hot aisle is under its containment roof, and rack view always looks along a cold aisle
  let near = AISLES[0];
  for (const a of AISLES) if (a.k !== undefined && Math.abs(a.z - tz) < Math.abs(near.z - tz)) near = a;
  if (SH.aisle !== near) {
    SH.s = SH.aisle ? Math.max(0, SH.s - dt / FADE) : 0;
    if (SH.s === 0) { SH.aisle = near; moveSpots(near); }
  } else SH.s = Math.min(1, SH.s + dt / FADE);
  const a = SH.aisle;
  // A spot's intensity (candela) matching the panel straight below it is luminance × area
  spots.forEach(s => { s.intensity = SHARE * SH.s * a.lum * FX_W * FX_D; });
  BAKE.bakeShare.value = SHARE * SH.s;
  // The rack-view cut-away also clips shadow casters, so the maps follow it
  if (cutPlane.constant !== SH.cut) { SH.cut = cutPlane.constant; renderer.shadowMap.needsUpdate = true; }
}
