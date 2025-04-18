import * as THREE from 'three';
import { GUI, Controller } from 'lil-gui';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 1.5, 3);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// ====== Mesh ======
const params = {
  geometry: 'Box',
  width: 1,
  height: 1,
  depth: 1,
  radius: 1,
  tube: 0.4,
  radialSegments: 16,
  tubularSegments: 60
};

let mesh: THREE.Mesh;

// ====== GUI ======
const gui = new GUI();
gui.add(params, 'geometry', ['Box', 'Sphere', 'Torus']).name('Type').onChange(createMesh);
gui.add(params, 'width', 0.5, 3, 0.1).onChange(createMesh).listen().hide();
gui.add(params, 'height', 0.5, 3, 0.1).onChange(createMesh).listen().hide();
gui.add(params, 'depth', 0.5, 3, 0.1).onChange(createMesh).listen().hide();
gui.add(params, 'radius', 0.5, 3, 0.1).onChange(createMesh).listen();
gui.add(params, 'tube', 0.1, 1, 0.05).onChange(createMesh).listen();
gui.add(params, 'radialSegments', 3, 32, 1).onChange(createMesh).listen();
gui.add(params, 'tubularSegments', 8, 100, 1).onChange(createMesh).listen();

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
createMesh(); 

// ====== Functions ======
function createMesh() {
  if (mesh) scene.remove(mesh);

  let geometry: THREE.BufferGeometry;

  switch (params.geometry) {
    case 'Sphere':
      geometry = new THREE.SphereGeometry(params.radius, params.radialSegments, params.radialSegments);
      toggleBoxControls(false);
      break;
    case 'Torus':
      geometry = new THREE.TorusGeometry(
        params.radius,
        params.tube,
        params.radialSegments,
        params.tubularSegments
      );
      toggleBoxControls(false);
      break;
    default:
      geometry = new THREE.BoxGeometry(params.width, params.height, params.depth);
      toggleBoxControls(true);
  }

  mesh = new THREE.Mesh(geometry, new THREE.MeshNormalMaterial());
  scene.add(mesh);
}

function toggleBoxControls(show: boolean) {
  const targets = new Set(['width', 'height', 'depth']);

  gui.controllersRecursive().forEach((c: Controller) => {
    if (targets.has((c as any)._name)) {
      show ? c.show() : c.hide();
    }
  });
}

// ====== Resize ======
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ====== Loop ======
function tick() {
  mesh.rotation.y += 0.01;
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();