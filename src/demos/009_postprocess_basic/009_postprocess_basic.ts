import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass }from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass }     from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/examples/jsm/shaders/RGBShiftShader.js';

import { GUI } from 'lil-gui';

export default async function init(): Promise<void> {
  /* ---------- Basic three.js setup ---------- */
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(2, 1, 3);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  document.body.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  /* ---------- Environment (HDR) ---------- */
  const envTex = await new RGBELoader().loadAsync(
    new URL('../008_gltf_loader/assets/royal_esplanade_1k.hdr', import.meta.url).href
  );
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromEquirectangular(envTex).texture;
  scene.environment = envMap;
  scene.background  = envMap;
  envTex.dispose();
  pmrem.dispose();

  /* ---------- GLB model (DamagedHelmet) ---------- */
  const gltf = await new GLTFLoader().loadAsync(
    new URL('../008_gltf_loader/assets/DamagedHelmet.glb', import.meta.url).href
  );
  scene.add(gltf.scene);

  /* ---------- Post‑processing chain ---------- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.4, 0.2);
  composer.addPass(bloom);

  const rgbPass = new ShaderPass(RGBShiftShader);
  rgbPass.uniforms['amount'].value = 0.0015;
  composer.addPass(rgbPass);

  /* ---------- GUI ---------- */
  const gui = new GUI();
  gui.add(bloom, 'strength', 0, 3, 0.01).name('Bloom Strength');
  gui.add(bloom, 'radius',   0, 1, 0.01).name('Bloom Radius');
  gui.add(rgbPass.uniforms['amount'], 'value', 0, 0.005, 0.0001).name('RGB Shift');

  /* ---------- Resize ---------- */
  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
  });

  /* ---------- Loop ---------- */
  (function tick(): void {
    controls.update();
    composer.render();
    requestAnimationFrame(tick);
  })();
}