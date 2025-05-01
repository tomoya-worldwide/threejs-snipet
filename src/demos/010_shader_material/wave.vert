uniform float uTime;
uniform float uAmplitude;
uniform float uWaveFreq;

varying vec2 vUv;

void main() {
  vUv = uv;
  vec3 pos = position;

  // 頂点を波形で上下させる
  pos.z += sin(pos.x * uWaveFreq + uTime) * uAmplitude;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}