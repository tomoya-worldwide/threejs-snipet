uniform sampler2D texVelocity;
varying vec2 vUv;

vec3 hsv2rgb(vec3 c){
  vec3 rgb = clamp( abs(mod(c.x*6.0+vec3(0,4,2),6.0)-3.0)-1.0, 0.0, 1.0 );
  return c.z * mix(vec3(1.0), rgb, c.y);
}

void main() {
  vec2 v = texture2D(texVelocity, vUv).xy;
  float speed = length(v);
  float angle = atan(v.y, v.x) / 6.283 + 0.5; // 0-1
  vec3 col = hsv2rgb(vec3(angle, 1.0, clamp(speed*30.0, 0.0, 1.0)));
  gl_FragColor = vec4(col, 1.0);
}