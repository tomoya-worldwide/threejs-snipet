// 007_instanced_benchmark.ts
import * as THREE from 'three';
import { GUI } from 'lil-gui';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';

export default function init(): void {
  /* ── 基本セットアップ ─────────────────────────── */
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(6, 4, 10);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  /* ── GUI プレースホルダ ───────────────────────── */
  const gui = new GUI();
  const params = { mode: 'instanced' as 'instanced' | 'normal', count: 10000 };
  gui.add(params, 'mode', ['instanced', 'normal']).name('Draw Mode');
  gui.add(params, 'count', 1000, 50000, 1000).name('Instance #');

  /* ── InstancedMesh / 通常 Mesh 生成ロジック ──────────────── */
  let currentGroup: THREE.Object3D | null = null;

  function rebuild(): void {
    // 既存グループを取り除く
    if (currentGroup) {
      scene.remove(currentGroup);
    }

    const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const material = new THREE.MeshNormalMaterial();
    currentGroup = new THREE.Group();

    if (params.mode === 'instanced') {
      const inst = new THREE.InstancedMesh(geometry, material, params.count);
      const m4 = new THREE.Matrix4();

      for (let i = 0; i < params.count; i++) {
        m4.makeTranslation(
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20
        );
        inst.setMatrixAt(i, m4);
      }
      inst.instanceMatrix.needsUpdate = true; // 忘れるとGPUに行列が転送されない
      currentGroup.add(inst);
    } else {
      for (let i = 0; i < params.count; i++) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20
        );
        currentGroup.add(mesh);
      }
    }

    scene.add(currentGroup);
  }

  // GUI 変更時に再構築
  gui.onChange(rebuild);
  // 初期化
  rebuild();

  /* ── Stats 追加 ────────────────────────────────────────── */
  const stats = new Stats();
  stats.dom.style.cssText = 'position:fixed;top:0;left:0;';
  document.body.appendChild(stats.dom);

  /* ── ループ ─────────────────────────────────── */
  function tick(): void {
    stats.begin();
    controls.update();
    if (currentGroup) currentGroup.rotation.y += 0.002;
    renderer.render(scene, camera);
    stats.end();
    requestAnimationFrame(tick);
  }
  tick();

  /* ── リサイズ対応 ───────────────────────────── */
  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}