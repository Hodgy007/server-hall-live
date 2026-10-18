// Post-processing: ambient occlusion in corners and gaps, then a soft bloom on anything brighter than 1.0 in HDR
// (LEDs, light fixtures, glowing ports).
import { THREE, renderer, scene, camera, cutPlane, LOW_POWER } from './core.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Multisampled HDR target keeps the edges antialiased now that the scene renders off-screen
const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, target);
composer.addPass(new RenderPass(scene, camera));

// Ambient occlusion darkens where racks meet the floor, the gaps between them, and under trays and busways.
// Glass, perforated doors, light columns and shadow decals are left out of its depth pass so it sees what is behind them.
// It runs at half resolution: the occlusion is soft and the denoise pass hides the difference.
class HallAO extends GTAOPass {
  setSize(w, h) { super.setSize(Math.ceil(w / 2), Math.ceil(h / 2)); }
  overrideVisibility() {
    super.overrideVisibility();
    this.scene.traverse(o => { if (o.isMesh && (Array.isArray(o.material) ? o.material[0] : o.material).transparent) o.visible = false; });
  }
}
if (!LOW_POWER) {
  const ao = new HallAO(scene, camera, 1, 1, undefined,
    { radius: 0.9, distanceExponent: 1, thickness: 3, scale: 2.6, samples: 12, distanceFallOff: 1, screenSpaceRadius: false },
    { lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
  ao.normalMaterial.clippingPlanes = [cutPlane];
  ao.blendIntensity = 1;
  composer.addPass(ao);
}
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.4, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());

export function resizePost(w, h) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
export function render() { composer.render(); }
