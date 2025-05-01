import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { GUI } from 'lil-gui';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export default function init(): void {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 7);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMappingExposure = 0.8;   
  document.body.appendChild(renderer.domElement);

  // ── PMREM ───────────────────────────────────────────────────
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  // ── OrbitControls ────────────────────────────────────────────
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 0, 0);

  // HDRI パス定義
  const HDR_LIST = {
      studio: '/src/demos/006_envmap_variations/hdr/studio.hdr',
      outdoor: '/src/demos/006_envmap_variations/hdr/outdoor.hdr',
      room: '/src/demos/006_envmap_variations/hdr/room.hdr',
  } as const;

  type HdrKey = keyof typeof HDR_LIST;
  let currentHdr: HdrKey = 'studio';

  // demo用の球体メッシュ
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x808080,
    metalness: 0.0,
    roughness: 0.3
  });

  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), mat);
  scene.add(sphere);

  // デバッグ用 – ブラウザから参照
  (window as any).mat = mat;
  
  // ── GUI ────────────────────────────────────────────────────
  const params = {
    hdr: currentHdr,
    envIntensity: 1.0,
    intensity: 5.0,
    metalness: mat.metalness,
    roughness: mat.roughness,
    color: '#808080'
  };

  mat.metalness = params.metalness;
  mat.roughness = params.roughness;
  mat.color.set(params.color);

  mat.envMapIntensity = params.intensity;

  const gui = new GUI();

  // Scene controls
  gui.add(params, 'hdr', Object.keys(HDR_LIST))
     .name('EnvMap')
     .onChange((v: HdrKey) => {
       currentHdr = v as HdrKey;
       loadHdr(currentHdr);
     });

  // Material control (envMapIntensity only)
  gui.add(params, 'intensity', 0, 10, 0.1)
     .name('Intensity')
     .onChange((v: number) => {
       mat.envMapIntensity = v;
       mat.needsUpdate = true;
     });

  gui.addColor(params, 'color')
     .name('Color')
     .onChange((v: string) => {
       mat.color.set(v);
     });

  gui.add(params, 'metalness', 0, 1, 0.01)
     .name('Metalness')
     .onChange((v: number) => {
       mat.metalness = v;
       mat.needsUpdate = true;
     });

  gui.add(params, 'roughness', 0, 1, 0.01)
     .name('Roughness')
     .onChange((v: number) => {
       mat.roughness = v;
       mat.needsUpdate = true;
     });

  // ── HDR 読み込み関数 ───────────────────────────────────────
  function loadHdr(key: HdrKey): void {
    new RGBELoader().load(HDR_LIST[key], (tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      const envMap = pmrem.fromEquirectangular(tex).texture;
      scene.environment = envMap;
      mat.envMap = envMap;  
      mat.needsUpdate = true;
      scene.background = tex;           
      tex.dispose();
    });
  }
  loadHdr(currentHdr);

  // ── リサイズ対応 ──────────────────────────────────────────
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ── アニメーションループ ──────────────────────────────────
  const clock = new THREE.Clock();
  function tick(): void {
    const t = clock.getElapsedTime();
    sphere.rotation.y = t * 0.4;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();
} // ← ここで init 関数を閉じる
