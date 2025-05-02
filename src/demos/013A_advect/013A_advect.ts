import * as THREE from 'three';
import { GUI } from 'lil-gui';
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';

import quadVert   from './view.vert?raw';
import viewFrag   from './view.frag?raw';
import advectFrag from './gpgpu/advect.frag?raw';
import forceFrag  from './gpgpu/force.frag?raw';

const SIZE = 256;           // 解像度 256×256
const dtInit = 1 / 60;

export default function init(): void {

  /* renderer & camera ------------------------------------------------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(0x000000);
  document.body.appendChild(renderer.domElement);

  const scene   = new THREE.Scene();
  const camera  = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
  camera.position.z = 1;

  /* GPUComputationRenderer -------------------------------------------- */
  const gpu = new GPUComputationRenderer(SIZE, SIZE, renderer);

  // 速度フィールド初期値
  const texVel0 = gpu.createTexture();
  const v = texVel0.image.data as Float32Array;
  for (let i = 0; i < v.length; i += 4) {
    v[i] = v[i + 1] = 0;    // vx, vy
    v[i + 2] = v[i + 3] = 0;
  }

  /* variable: velocity ------------------------------------------------- */
  const velVar = gpu.addVariable('tVelocity', advectFrag, texVel0);
  gpu.setVariableDependencies(velVar, [velVar]);

  velVar.material.uniforms.uDelta   = { value: dtInit };
  velVar.material.uniforms.dissipation = { value: 0.995 };

  /* variable: force ---------------------------------------------------- */
  const forceVar = gpu.addVariable('tForce', forceFrag, texVel0);
  gpu.setVariableDependencies(forceVar, [velVar, forceVar]);

  forceVar.material.uniforms.uMouse      = { value: new THREE.Vector2(-10, -10) };
  forceVar.material.uniforms.uForceSize  = { value: 0.04 };
  forceVar.material.uniforms.uForcePower = { value: 1.0 };

  /* init check --------------------------------------------------------- */
  const err = gpu.init();
  if (err) { console.error(err); return; }

  /* full-screen quad to view result ----------------------------------- */
  const viewMat = new THREE.ShaderMaterial({
    uniforms: { texVelocity: { value: null } },
    vertexShader: quadVert,
    fragmentShader: viewFrag
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), viewMat));

  /* GUI ---------------------------------------------------------------- */
  const gui = new GUI();
  gui.add(velVar.material.uniforms.dissipation, 'value', 0.9, 1.0, 0.0005).name('Dissipation');
  gui.add(forceVar.material.uniforms.uForceSize,  'value', 0.01, 0.1, 0.005).name('Force Size');
  gui.add(forceVar.material.uniforms.uForcePower, 'value', 0.1, 5, 0.1).name('Force Power');

  /* mouse handling ----------------------------------------------------- */
  const mouse = new THREE.Vector2(-10, -10);
  function toUV(event: PointerEvent) {
    mouse.x =  event.clientX / innerWidth;
    mouse.y = 1 - event.clientY / innerHeight;
  }
  window.addEventListener('pointermove', toUV);

  /* loop --------------------------------------------------------------- */
  const clock = new THREE.Clock();
  (function tick() {
    const dt = clock.getDelta();
    velVar.material.uniforms.uDelta.value = dt;
    forceVar.material.uniforms.uMouse.value.copy(mouse);

    gpu.compute();
    viewMat.uniforms.texVelocity.value = gpu.getCurrentRenderTarget(velVar).texture;

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  })();
}