// Neon grid — synthwave-style perspective floor grid, coloured by the active theme:
// sky = background, grid lines = border, floor glow = elevated panels, horizon pulse = hover.
float luminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;

  vec3 sky = iTheme.bgBase.rgb;
  vec3 lines = iTheme.border.rgb;

  // Light themes: glow on a bright sky washes out, so the grid darkens instead,
  // using the secondary text colour that themes already keep readable on their background
  float light = smoothstep(0.35, 0.6, luminance(sky));
  lines = mix(lines, iTheme.textSecondary.rgb, light);

  // Perspective: horizon at 60% height, floor below it
  float horizon = 0.6;
  vec3 col;

  if (uv.y < horizon) {
    float depth = (horizon - uv.y) / horizon;          // 0 at horizon, 1 at bottom
    float pz = 1.0 / max(depth, 0.05);                  // perspective divide
    vec2 gp = vec2((uv.x - 0.5) * pz * 4.0, pz + iTime * 2.0); // grid position, scrolling

    vec2 grid = abs(fract(gp) - 0.5);
    float line = smoothstep(0.48, 0.5, max(grid.x, grid.y));
    float fade = exp(-depth * 4.0);                     // fade near horizon

    col = mix(sky, iTheme.bgElevated.rgb, (1.0 - depth) * 0.5); // floor base glow
    col = mix(col, lines, line * fade * 0.7);
  } else {
    // Sky: subtle vertical gradient + slow pulse near the horizon
    float height = (uv.y - horizon) / (1.0 - horizon);
    col = mix(sky, iTheme.bgPanel.rgb, height);
    float pulse = 0.5 + 0.5 * sin(iTime * 0.8);
    col = mix(col, iTheme.bgHover.rgb, pulse * (1.0 - height) * 0.5);
  }

  fragColor = vec4(col, 1.0);
}
