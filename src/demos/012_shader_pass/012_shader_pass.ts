import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass }from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { WavePass }       from './WavePass';
import { GUI }            from 'lil-gui';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ---------- three.js basic setup ----------
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
camera.position.set(4, 2, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const clock = new THREE.Clock();

// ---------- sample objects ----------
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x444444 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const torus = new THREE.Mesh(
  new THREE.TorusKnotGeometry(1, 0.3, 128, 32),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.1 })
);
torus.position.set(0, 1, 0);
scene.add(torus);

const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
scene.add(light);

// ---------- Post-processing chain ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const wave = new WavePass();
composer.addPass(wave);

// Bloom を Wave の後段に置くと、にじみも一緒に歪む
const bloom = new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight),
  0.8,   // strength
  0.4,   // radius
  0.2   // threshold
);
composer.addPass(bloom);

// ---------- GUI ----------
const gui = new GUI();
gui.add(wave.uniforms.uAmplitude, 'value', 0, 0.5, 0.01).name('Wave Amp');
gui.add(wave.uniforms.uFreq,      'value', 0.5, 10, 0.1).name('Wave Freq');
gui.add(bloom, 'strength', 0, 3, 0.1).name('Bloom');

// ---------- resize ----------
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

// ---------- loop ----------
function tick() {
  wave.uniforms.uTime.value = clock.getElapsedTime();
  controls.update();
  composer.render();
  requestAnimationFrame(tick);
}
tick();