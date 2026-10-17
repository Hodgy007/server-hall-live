// Post-processing: a soft bloom on anything brighter than 1.0 in HDR (LEDs, light fixtures, glowing ports).
import { THREE, renderer, scene, camera } from './core.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Multisampled HDR target keeps the edges antialiased now that the scene renders off-screen
const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, target);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.4, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());

export function resizePost(w, h) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
export function render() { composer.render(); }
