import * as THREE from 'three';
import { GUI } from 'lil-gui';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';

// ====== Scene & Camera ======
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 1.5, 4);

// ====== Renderer ======
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// ====== Light ======
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(1, 2, 3);
scene.add(light);

// ====== Mesh ======
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0x6699ff, metalness: 0.3, roughness: 0.4 })
);
scene.add(cube);

// ====== Clone many cubes to increase GPU load ======
// GPUがつよつよすぎて測定不可の時はこれを実行
// for (let i = 0; i < 5000; i++) {
//   const m = cube.clone();
//   m.position.set(
//     Math.random() * 50 - 25,
//     Math.random() * 50 - 25,
//     Math.random() * 50 - 25
//   );
//   scene.add(m);
// }

// ====== OrbitControls ======
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// ====== Stats (FPS) ======
const stats = new Stats();
stats.dom.style.cssText = 'position:fixed;top:0;left:0;';
document.body.appendChild(stats.dom);
// stats.showPanel(1); // もしFPS表示するならコメントアウト

// ====== Parameters & GUI ======
const params = {
  fov: 75,
  pixelRatio: Math.min(window.devicePixelRatio, 2),
  autoRotate: false,
  enableDamping: true,
  maxPolarAngle: Math.PI
};

const gui = new GUI();

gui.add(params, 'fov', 45, 90, 1).onChange(() => {
  camera.fov = params.fov;
  camera.updateProjectionMatrix();
});

gui.add(params, 'pixelRatio', 1, 2, 0.25).onChange(() => {
  renderer.setPixelRatio(params.pixelRatio);
});

gui.add(params, 'autoRotate').onChange(() => {
  controls.autoRotate = params.autoRotate;
});

gui.add(params, 'enableDamping').onChange(() => {
  controls.enableDamping = params.enableDamping;
});

gui.add(params, 'maxPolarAngle', 0, Math.PI, 0.1).onChange(() => {
  controls.maxPolarAngle = params.maxPolarAngle;
});

// ====== Resize Handling ======
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ====== Animation Loop ======
function tick() {
  stats.begin();
  controls.update();
  renderer.render(scene, camera);
  stats.end();
  requestAnimationFrame(tick);
}
tick();