/**
 * Lesson 10 – ShaderMaterial basic demo
 * Wave‑distorted plane with color shift
 * URL: http://localhost:5173/?demo=010
 */

import * as THREE from 'three';
import { GUI } from 'lil-gui';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Vite: import GLSL sources as raw strings
// (make sure vite.config has ?raw enabled for .vert/.frag if needed)
import vertSrc from './wave.vert?raw';
import fragSrc from './wave.frag?raw';

export default function init(): void {
  /* ---------- basic three setup ---------- */
  const scene   = new THREE.Scene();
  const camera  = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 1.5, 4);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  /* ---------- shader uniforms ---------- */
  const uniforms = {
    uTime      : { value: 0.0 },
    uAmplitude : { value: 0.25 },
    uWaveFreq  : { value: 4.0 },
    uBaseColor : { value: new THREE.Color('#47b4ff') }
  };

  /* ---------- ShaderMaterial & mesh ---------- */
  const mat = new THREE.ShaderMaterial({
    vertexShader:   vertSrc,
    fragmentShader: fragSrc,
    uniforms,
    side: THREE.DoubleSide
  });

  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 4, 128, 128),
    mat
  );
  plane.rotation.x = -Math.PI / 2; // lay flat
  scene.add(plane);

  /* ---------- GUI ---------- */
  const gui = new GUI();
  gui.add(uniforms.uAmplitude, 'value', 0, 0.5, 0.01).name('Amplitude');
  gui.add(uniforms.uWaveFreq,  'value', 1, 10, 0.1).name('Frequency');
  gui.addColor(uniforms.uBaseColor, 'value').name('Base Color');

  /* ---------- resize ---------- */
  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  /* ---------- loop ---------- */
  const clock = new THREE.Clock();
  function tick(): void {
    uniforms.uTime.value = clock.getElapsedTime();
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();
}