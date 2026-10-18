// Ceiling lighting: panel fixtures that light the hall as rectangular area lights, shadow-casting spots in
// the aisle you are looking at, and faint shafts of light in the haze under the cold-aisle fixtures.
import { THREE, scene, renderer, controls, lc, LOW_POWER, COLD, HACS, ROOM, cutPlane } from './core.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

RectAreaLightUniformsLib.init();
// Cold-aisle fixtures run down the middle of the aisle; over a hot aisle they sit between the chimneys
const FX_X = [-2.6, 0, 2.6], FX_XH = [-1.28, 1.28], FX_W = 1.6, FX_D = 0.16, FX_Y = ROOM.h - 0.03, FX_COL = 0xdcecff;
// Panel luminance in nits: cold aisles are lit for work, hot aisles sit above the containment roof and run dimmer
const AISLES = COLD.map(z => ({ z, xs: FX_X, lum: 40 })).concat(HACS.map(H => ({ z: H.zc, xs: FX_XH, lum: 20 })));
const m4 = new THREE.Matrix4();

// Fixture panels (bright enough to bloom), each with an area light of the same size facing down
{
  const fx = new THREE.InstancedMesh(new THREE.BoxGeometry(FX_W, 0.04, FX_D), new THREE.MeshBasicMaterial({ color: lc('#d8ecff').multiplyScalar(2.2) }), AISLES.reduce((n, a) => n + a.xs.length, 0));
  let n = 0;
  AISLES.forEach(a => {
    a.lights = a.xs.map(x => {
      m4.makeTranslation(x, FX_Y, a.z); fx.setMatrixAt(n++, m4);
      const l = new THREE.RectAreaLight(FX_COL, a.lum, FX_W, FX_D);
      l.position.set(x, FX_Y - 0.021, a.z); l.rotation.x = -Math.PI / 2; scene.add(l);
      return l;
    });
  });
  scene.add(fx);
}

// ---------- Shadows in the viewed aisle ----------
// Area lights cannot cast shadows, so in the cold aisle nearest the camera's target a spot light under each fixture
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
      float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.5);
      // haze is only visible over distance: a shaft fades out as the camera walks into it
      gl_FragColor = vec4(color * strength * pow(vH, 1.8) * edge * smoothstep(1.5, 5.0, vD), 1.0);
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
  for (const a of AISLES) if (a.xs === FX_X && Math.abs(a.z - tz) < Math.abs(near.z - tz)) near = a;
  if (SH.aisle !== near) {
    SH.s = SH.aisle ? Math.max(0, SH.s - dt / FADE) : 0;
    if (SH.s === 0) {
      if (SH.aisle) SH.aisle.lights.forEach(l => { l.intensity = SH.aisle.lum; });
      SH.aisle = near; moveSpots(near);
    }
  } else SH.s = Math.min(1, SH.s + dt / FADE);
  const a = SH.aisle;
  // A spot's intensity (candela) matching the panel straight below it is luminance × area
  spots.forEach(s => { s.intensity = SHARE * SH.s * a.lum * FX_W * FX_D; });
  a.lights.forEach(l => { l.intensity = a.lum * (1 - SHARE * SH.s); });
  // The rack-view cut-away also clips shadow casters, so the maps follow it
  if (cutPlane.constant !== SH.cut) { SH.cut = cutPlane.constant; renderer.shadowMap.needsUpdate = true; }
}
