// Tile icon for the aquatic theme: light ripples and rising bubbles in the theme's own colors.
// iTheme holds this theme's colors even when another theme is active.

float ripples(vec2 p, float t) {
    float v = 0.0;
    for (int i = 0; i < 4; i++) {
        float fi = float(i);
        p += vec2(sin(p.y * 1.7 + t * 0.9 + fi), cos(p.x * 1.5 - t * 0.7 + fi * 1.3)) * 0.45;
        v += abs(sin(p.x + p.y));
    }
    return v / 4.0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y * 4.0;
    float t = iTime;

    vec3 col = mix(iTheme.bgBase.rgb, iTheme.bgElevated.rgb, uv.y);
    float light = pow(1.0 - ripples(p, t), 6.0);
    col += light * iTheme.playneedle.rgb * 0.9;

    float aspect = iResolution.x / iResolution.y;
    for (int i = 0; i < 6; i++) {
        float fi = float(i);
        float speed = 0.08 + 0.05 * fract(fi * 0.71);
        vec2 center = vec2(fract(fi * 0.37 + 0.1) + 0.03 * sin(t * 2.0 + fi), fract(t * speed + fi * 0.29));
        float r = 0.025 + 0.015 * fract(fi * 0.53);
        float d = length((uv - center) * vec2(aspect, 1.0));
        float ring = smoothstep(r - 0.016, r - 0.008, d) - smoothstep(r - 0.006, r, d);
        col += ring * iTheme.textPrimary.rgb * 0.6;
    }

    col += iTheme.highlightColor.rgb * pow(uv.y, 4.0) * 0.25;
    fragColor = vec4(col, 1.0);
}
