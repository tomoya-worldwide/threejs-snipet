precision highp float;

uniform sampler2D texVelocity;
varying vec2 vUv;

void main() {
  vec2 v = texture2D(texVelocity, vUv).xy;
  float speed = length(v);

  // speed を 0.0 - 1.0 の範囲にスケール (スケール値は調整が必要)
  float normalizedSpeed = clamp(speed * 10.0, 0.0, 1.0);

  // 速度を明度として使用 (0.0 が黒、1.0 が白)
  vec3 color = vec3(normalizedSpeed);

  gl_FragColor = vec4(color, 1.0);
}