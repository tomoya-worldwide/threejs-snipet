precision highp float;

uniform sampler2D tVelocity;
uniform vec2 uMouse;      // 0-1
uniform float uForce;      // 力の強さ

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec2 v = texture2D(tVelocity, uv).xy;

  vec2 diff = uv - uMouse;
  float distSq = dot(diff, diff);
  float influence = uForce / (distSq + 0.0001); // マウスに近いほど強い力

  v += influence * diff * 10.0; // マウスから遠ざかる方向へ力を加える

  gl_FragColor = vec4(v, 0.0, 1.0);
}