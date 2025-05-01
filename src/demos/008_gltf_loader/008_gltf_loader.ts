import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'lil-gui';

export default async function init() {
  /* シーン・カメラ・レンダラ */
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 100);
  camera.position.set(2,1,3);
  const renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;  
  renderer.toneMapping = THREE.ACESFilmicToneMapping; 
  renderer.toneMappingExposure = 1;                   
  document.body.appendChild(renderer.domElement);

  /* 環境マップ (HDR + PMREM) */
  // use URL relative to this script so assets inside 008_gltf_loader/assets/ resolve correctly
  const hdr = await new RGBELoader().loadAsync(
    new URL('./assets/royal_esplanade_1k.hdr', import.meta.url).href
  );
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromEquirectangular(hdr).texture;
  scene.environment = envMap;
  scene.background  = envMap;

  /* モデル読み込み */
  // use URL relative to this script so assets inside 008_gltf_loader/assets/ resolve correctly
  const gltf = await new GLTFLoader().loadAsync(
    new URL('./assets/DamagedHelmet.glb', import.meta.url).href
  );
  const model = gltf.scene;
  scene.add(model);
  
  
  // ハイライト用に軽い Key Light を追加
  const keyLight = new THREE.DirectionalLight(0xffffff, 3);
  keyLight.position.set(3, 4, 2);
  scene.add(keyLight);

  /* GUI */
  const gui = new GUI();
  gui.add(model.rotation, 'y', -Math.PI, Math.PI).name('Rotate Y');
  gui.add(model.scale, 'x', 0.1, 3).name('Scale').onChange((v: number) => model.scale.setScalar(v));
  gui.add(renderer, 'toneMappingExposure', 0.1, 2).name('Exposure').listen();

  /* カメラ操作 */
  const ctl = new OrbitControls(camera, renderer.domElement);
  ctl.enableDamping = true;

  /* ループ */
  (function tick(){
    ctl.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  })();

  /* リサイズ */
  window.addEventListener('resize', () => {
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}