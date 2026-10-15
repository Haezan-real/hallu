// Screen pass: the glow trail over a drifting noise haze, brighter while more cells are alive
HALLU_STORAGE Stats { uint population[2]; };

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec3 trail = texture(iChannel0, uv).rgb;

  vec2 hazeUv = uv * vec2(iResolution.x / iResolution.y, 1.0) * 0.08 + iTime * 0.004;
  float haze = texture(iChannel1, hazeUv).r;

  float cells = float(population[uint(iFrame) & 1u]);
  float capacity = max(1.0, floor(iResolution.x / 4.0) * floor(iResolution.y / 4.0));
  float energy = clamp(cells / capacity * 8.0, 0.0, 1.0);

  vec3 base = vec3(0.02, 0.0, 0.05) + vec3(0.04, 0.0, 0.08) * haze;
  fragColor = vec4(base + trail * (0.35 + 0.4 * energy), 1.0);
}
