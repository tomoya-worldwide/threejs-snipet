import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'lil-gui';

// re-use wave shaders from Lesson 10
import vertSrc from '../010_shader_material/wave.vert?raw';
import fragSrc from '../010_shader_material/wave.frag?raw';
import foxAsset from './fox.glb?url';

export default async function init(): Promise<void> {
  /* --- basic three setup --- */
  const scene   = new THREE.Scene();
  const camera  = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(4, 2, 6);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  /* --- load GLB with animation --- */
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(foxAsset);

  scene.add(gltf.scene);

  // Scale and center the Fox so it is clearly visible
  gltf.scene.scale.set(0.02, 0.02, 0.02);      // sample model is huge (meters)
  gltf.scene.position.set(0, 0, 0);
  controls.target.set(0, 0.4, 0);              // look slightly above ground

  /* --- AnimationMixer --- */
  const mixer  = new THREE.AnimationMixer(gltf.scene);
  const clips  = gltf.animations;          // walk / trot / run
  const states = clips.map(c => mixer.clipAction(c));
  states.forEach(s => { s.enabled = false; s.setEffectiveWeight(1); });
  let active = states[0];
  active.enabled = true;
  active.play();

  // Basic lighting so the model is lit
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
  hemi.position.set(0, 5, 0);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(3, 5, 2);
  scene.add(dir);

  /* --- ground wave (ShaderMaterial) --- */
  const uniforms = {
    uTime      : { value: 0 },
    uAmplitude : { value: 0.15 },
    uWaveFreq  : { value: 3.0 },
    uBaseColor : { value: new THREE.Color('#3ba1ff') }
  };

  const groundMat = new THREE.ShaderMaterial({
    vertexShader: vertSrc,
    fragmentShader: fragSrc,
    uniforms,
    side: THREE.DoubleSide
  });

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20, 256, 256),
    groundMat
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  /* --- GUI --- */
  const gui = new GUI();
  const params = {
    clip: 0,
    speed: 1,
    amplitude: 0.15,
    frequency: 3
  };
  gui.add(params, 'clip', { survey:0, walk:1, run:2 })
     .name('Anim Clip')
     .onChange((v: number) => {
       active.stop();
       active = states[v];
       active.enabled = true;
       active.play();
     });
  gui.add(params, 'speed', -2, 2, 0.1)
     .name('Speed')
     .onChange((v: number) => states.forEach(s => s.timeScale = v));
  gui.add(params, 'amplitude', 0, 0.4, 0.01)
     .onChange((v: number) => uniforms.uAmplitude.value = v);
  gui.add(params, 'frequency', 1, 8, 0.1)
     .onChange((v: number) => uniforms.uWaveFreq.value = v);

  /* --- resize --- */
  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  /* --- loop --- */
  const clock = new THREE.Clock();
  function tick(): void {
    const delta = clock.getDelta();
    mixer.update(delta);                 
    uniforms.uTime.value = mixer.time;   // sync with shader

    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();
}