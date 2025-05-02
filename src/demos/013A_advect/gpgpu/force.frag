uniform vec2  uMouse;      // 0-1
uniform float uForceSize;  // 半径
uniform float uForcePower; // 強さ
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec2 v  = texture2D(tVelocity, uv).xy;

  float d = distance(uv, uMouse);
  float influence = uForcePower * exp(-pow(d / uForceSize, 2.0));

  vec2 dir = normalize(uv - uMouse);
  v += dir.yx * vec2(-1.0, 1.0) * influence; // 回転を作る

  gl_FragColor = vec4(v, 0.0, 1.0);
}