import * as THREE from 'three';
import { GUI } from 'lil-gui';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// 002_handwrite_cubeをコピーしてきて改修する形で実装

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 3;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(1, 2, 3);
scene.add(light);

const materials: Record<string, THREE.Material> = {
    Basic: new THREE.MeshBasicMaterial({ color: 0x6699ff }),
    Standard: new THREE.MeshStandardMaterial({ color: 0x6699ff, metalness: 0.3, roughness: 0.4 }),
    Physical: new THREE.MeshPhysicalMaterial({ color: 0x6699ff, metalness: 1, roughness: 0, clearcoat: 1 }),
};

const cube: THREE.Mesh<THREE.BoxGeometry, THREE.Material> = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materials.Basic);
scene.add(cube);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Resize handling
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

const gui = new GUI();
const mParams = { type: 'Basic' as keyof typeof materials };
gui.add(mParams, 'type', Object.keys(materials)).onChange(() => {
    cube.material = materials[mParams.type];
});

function tick() {
    controls.update();
    cube.rotation.y += 0.01;
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
}
tick();
