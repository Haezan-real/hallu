// Rain streak: soft across its width, brightest just behind the drop's head
layout(location = 0) in vec3 vStreak;
layout(location = 1) in vec3 vColor;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float across = 1.0 - vStreak.y * vStreak.y;
  float along = smoothstep(0.0, 0.15, vStreak.x) * (1.0 - vStreak.x);
  fragColor = vec4(vColor * across * along * vStreak.z, 0.0);
}
