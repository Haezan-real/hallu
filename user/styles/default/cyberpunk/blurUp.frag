// Dual Kawase blur, coming back up: run at twice the size of iChannel0, spreading it out smoothly
const float SPREAD = 0.75;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 o = SPREAD / iChannelResolution[0].xy;
  vec4 sum = textureLod(iChannel0, uv + vec2(-2.0 * o.x, 0.0), 0.0)
    + textureLod(iChannel0, uv + vec2(2.0 * o.x, 0.0), 0.0)
    + textureLod(iChannel0, uv + vec2(0.0, -2.0 * o.y), 0.0)
    + textureLod(iChannel0, uv + vec2(0.0, 2.0 * o.y), 0.0);
  sum += (textureLod(iChannel0, uv + o, 0.0)
    + textureLod(iChannel0, uv - o, 0.0)
    + textureLod(iChannel0, uv + vec2(o.x, -o.y), 0.0)
    + textureLod(iChannel0, uv - vec2(o.x, -o.y), 0.0)) * 2.0;
  fragColor = sum / 12.0;
}
