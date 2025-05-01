precision highp float;

uniform vec3 uBaseColor;
uniform float uTime;

varying vec2 vUv;

void main() {
  // 時間で色相シフトする簡易 HSV→RGB
  float hue = mod(uTime * 0.1 + vUv.x, 1.0);
  vec3  col = mix(uBaseColor, vec3(hue, 1.0 - hue, 1.0), 0.5);

  gl_FragColor = vec4(col, 1.0);
}