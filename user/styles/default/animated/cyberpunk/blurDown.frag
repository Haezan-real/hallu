// Dual Kawase blur, going down: run at half the size of iChannel0, each texel averaging a
// small cross of the input around it

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 o = 1.0 / iChannelResolution[0].xy;
  fragColor = (textureLod(iChannel0, uv, 0.0) * 4.0
    + textureLod(iChannel0, uv - o, 0.0)
    + textureLod(iChannel0, uv + o, 0.0)
    + textureLod(iChannel0, uv + vec2(o.x, -o.y), 0.0)
    + textureLod(iChannel0, uv - vec2(o.x, -o.y), 0.0)) / 8.0;
}
