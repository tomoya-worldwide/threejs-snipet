import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const geometry = new THREE.BoxGeometry();
const material =new THREE.MeshNormalMaterial();
const cube =new THREE.Mesh(geometry, material);
scene.add(cube);

camera.position.z = 3;
const controls = new OrbitControls(camera, renderer.domElement);

const loop = () => {
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.015;
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
};
loop();
