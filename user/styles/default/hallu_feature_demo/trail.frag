// Buffer pass with feedback: last frame's trail (iChannel1, this pass itself) fades
// while the live cells from the compute pass (iChannel0) light it back up.
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 cell = floor(fragCoord / 4.0) + 0.5;
  float alive = texture(iChannel0, cell / iChannelResolution[0].xy).r;
  vec3 previous = texture(iChannel1, fragCoord / iResolution.xy).rgb;
  vec3 tint = 0.5 + 0.5 * cos(iTime * 0.3 + vec3(0.0, 2.1, 4.2));
  fragColor = vec4(max(previous * 0.96, alive * tint), 1.0);
}
