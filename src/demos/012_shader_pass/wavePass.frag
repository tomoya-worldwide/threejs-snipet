uniform sampler2D tDiffuse;
uniform float uAmplitude;
uniform float uFreq;
uniform float uTime;
varying vec2 vUv;

void main() {
  float angle = sin(vUv.y * uFreq + uTime) * uAmplitude;
  vec2  uv2   = vUv + vec2(angle, 0.0);
  gl_FragColor = texture2D(tDiffuse, uv2);
}