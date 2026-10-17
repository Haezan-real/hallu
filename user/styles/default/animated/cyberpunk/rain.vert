// Rain: every instance is one drop, drawn as a thin quad stretched along the drop's path during
// a short exposure as seen from the moving car, so streaks slant toward us as we drive.
// Drops are fixed in the world and wrap around the camera. Lamps tint the drops near them.
const float DRIVE_SPEED = 12.0;   // keep the camera in sync with drive.frag
const float FOCAL = 1.25;
const float FALL_SPEED = 24.0;
const vec3 WIND = vec3(1.8, 0.0, 0.0);
const vec3 RAIN_BOX = vec3(11.0, 16.0, 70.0);   // half width, height, depth ahead of the camera
const float EXPOSURE = 0.03;

const float LAMP_SPACING = 25.0;
const float LAMP_X = 8.6;
const float LAMP_H = 7.4;
const float LAMP_REACH = 2.6;

layout(location = 0) out vec3 vStreak;   // x: 0 at the drop's head to 1 at its tail, y: -1..1 across, z: strength
layout(location = 1) out vec3 vColor;

vec3 cameraPosition(float t) {
  return vec3(1.75 + 0.22 * sin(t * 0.21), 2.6 + 0.035 * sin(t * 1.9), t * DRIVE_SPEED);
}

mat3 cameraBasis(float t) {
  vec3 forward = normalize(vec3(-0.035 + 0.012 * sin(t * 0.21 + 1.0), -0.075, 1.0));
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
  return mat3(right, cross(forward, right), forward);
}

uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

float rand(uint seed, uint salt) {
  return float(pcg(seed * 1664525u + salt * 1013904223u)) / 4294967295.0;
}

vec3 linearColor(vec3 c) { return pow(c, vec3(2.2)); }

vec3 lampColor(float id) {
  return mod(id, 2.0) < 1.0 ? vec3(1.0, 0.5, 0.2) : linearColor(iTheme.border.rgb);
}

vec4 mainVertex(int vertexIndex, int instanceIndex) {
  float t = iTime;
  vec3 cam = cameraPosition(t);
  mat3 basis = cameraBasis(t);
  uint seed = uint(instanceIndex);

  float fall = FALL_SPEED * (0.85 + 0.3 * rand(seed, 4u));
  vec3 head = vec3(
    (rand(seed, 1u) * 2.0 - 1.0) * RAIN_BOX.x,
    mod(rand(seed, 2u) * RAIN_BOX.y - t * fall, RAIN_BOX.y),
    cam.z + 0.5 + mod(rand(seed, 3u) * RAIN_BOX.z - cam.z, RAIN_BOX.z));
  // Relative to the car the drop also moves toward us at the driving speed
  vec3 velocity = vec3(WIND.x, -fall, -DRIVE_SPEED);
  vec3 tail = head - velocity * EXPOSURE;

  vec3 a = (head - cam) * basis;
  vec3 b = (tail - cam) * basis;
  if (min(a.z, b.z) < 0.4) return vec4(0.0, 0.0, 2.0, 1.0);

  vec2 sa = a.xy * FOCAL / a.z;
  vec2 sb = b.xy * FOCAL / b.z;
  vec2 along = sb - sa;
  float len = length(along);
  along = len > 1e-6 ? along / len : vec2(0.0, 1.0);
  // At least a pixel wide; thinner drops fade instead of shimmering
  float px = 1.0 / iResolution.y;
  float width = 0.006 * FOCAL / a.z;
  float halfWidth = max(width, px) * 0.5;

  const vec2 corners[6] = vec2[6](vec2(0.0, -1.0), vec2(1.0, -1.0), vec2(1.0, 1.0), vec2(0.0, -1.0), vec2(1.0, 1.0), vec2(0.0, 1.0));
  vec2 corner = corners[vertexIndex];
  vec2 s = mix(sa, sb, corner.x) + vec2(-along.y, along.x) * corner.y * halfWidth;

  // Lit by the nearest lamps on both sides, and faintly by the city glow
  float lampId = floor(head.z / LAMP_SPACING + 0.5);
  vec3 light = linearColor(iTheme.borderMid.rgb) * 0.05 + vec3(0.03, 0.03, 0.05);
  for (float side = -1.0; side <= 1.0; side += 2.0) {
    vec3 lamp = vec3(side * (LAMP_X - LAMP_REACH), LAMP_H - 0.2, lampId * LAMP_SPACING);
    vec3 d = head - lamp;
    float cone = smoothstep(0.1, 0.7, -d.y * inversesqrt(dot(d, d) + 1e-4));
    light += lampColor(lampId) * 3.0 * cone / (dot(d, d) + 4.0);
  }
  float strength = min(width / px, 1.0) * exp(-a.z * 0.035) * smoothstep(0.4, 2.0, a.z);

  vStreak = vec3(corner, strength);
  vColor = light;
  return vec4(s.x * 2.0 * iResolution.y / iResolution.x, s.y * 2.0, 0.5, 1.0);
}
