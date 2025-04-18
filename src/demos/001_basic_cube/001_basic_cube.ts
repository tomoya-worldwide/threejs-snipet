import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Day 1‑2 demo: シンプルな回転キューブ
 */
export default function runBasicCube(): void {
  // === Scene ===
  const scene = new THREE.Scene();

  // === Camera ===
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 1.5, 3);

  // === Renderer ===
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);

  // === Cube ===
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshNormalMaterial();
  const cube = new THREE.Mesh(geometry, material);
  scene.add(cube);

  // === Controls ===
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // === Resize ===
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // === Loop ===
  const tick = () => {
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.015;

    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };
  tick();
}