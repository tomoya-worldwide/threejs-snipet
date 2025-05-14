precision highp float;

uniform float uDelta;
uniform float dissipation;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec2 vel = texture2D(tVelocity, uv).xy;
  vec2 prevUV = uv - vel * uDelta; // 逆流サンプル

  vec2 advected = texture2D(tVelocity, prevUV).xy;
  gl_FragColor = vec4(advected * dissipation, 0.0, 1.0);
}