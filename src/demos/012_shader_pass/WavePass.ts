import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import quadVert  from './wavePass.vert?raw';
import waveFrag  from './wavePass.frag?raw';

export class WavePass extends Pass {
  uniforms: { [key: string]: THREE.IUniform };
  material: THREE.ShaderMaterial;
  fsQuad : FullScreenQuad;

  constructor() {
    super();
    this.uniforms = {
      uTime      : { value: 0 },
      uAmplitude : { value: 0.15 },
      uFreq      : { value: 3.0 },
      tDiffuse   : { value: null }   // 入力テクスチャ
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: quadVert,
      fragmentShader: waveFrag
    });
    this.fsQuad = new FullScreenQuad(this.material);
  }

  render(renderer: THREE.WebGLRenderer, write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget) {
    this.uniforms.tDiffuse.value = read.texture;
    renderer.setRenderTarget(write);
    this.fsQuad.render(renderer);
  }
}