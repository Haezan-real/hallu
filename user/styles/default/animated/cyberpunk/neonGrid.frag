// Neon vintage — an outrun night drive: a striped sun sinking behind wireframe mountains and a
// city skyline, a neon grid either side of a highway lined with street lamps, traffic in both
// lanes, and planes blinking across a starry sky.
// Theme colours: neon = border, accents = border-mid, night sky = background, haze = elevated panels.

const float HORIZON = 0.6;       // horizon height, as a fraction of the window height; high so the road shows above the timeline
const float FOCAL = 0.9;
const float CAM_HEIGHT = 1.0;
const float SPEED = 7.0;         // driving speed, world units per second
const float FOG = 0.03;

const float ROAD_HALF = 3.5;
const float LANE_X = 1.8;
const float SIDEWALK = 1.4;
const float GRID = 2.5;

const float LAMP_X = 4.3;
const float LAMP_HEIGHT = 3.4;
const float LAMP_REACH = 1.2;    // arm length toward the road
const float LAMP_SPACING = 12.0;
const int LAMPS = 8;

const int CARS = 6;
const float CAR_CYCLE = 110.0;

const vec3 SUN_TOP = vec3(1.0, 0.85, 0.3);
const vec3 SODIUM = vec3(1.0, 0.55, 0.25);
const vec3 HEADLIGHT = vec3(1.0, 0.95, 0.85);
const vec3 TAILLIGHT = vec3(1.0, 0.1, 0.25);

float hash11(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
float hash21(vec2 v) { return fract(sin(dot(v, vec2(127.1, 311.7))) * 43758.5453); }

float noise1(float x) {
  float i = floor(x);
  float f = fract(x);
  return mix(hash11(i), hash11(i + 1.0), f * f * (3.0 - 2.0 * f));
}

// Bright core with a short halo; r is the core radius in screen units
float glow(vec2 d, float r) {
  float q = dot(d, d) / (r * r);
  return exp(-q) + 0.12 / (1.0 + q);
}

// 1 inside the box, 0 outside, with an antialiased edge
float box(vec2 p, vec2 lo, vec2 hi, float aa) {
  vec2 d = max(lo - p, p - hi);
  return 1.0 - smoothstep(-aa, aa, max(d.x, d.y));
}

float segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

// A line of half-width hw at distance d, filtered over fw (the pixel footprint in the same units)
// so it thins out instead of shimmering toward the horizon
float lineMask(float d, float hw, float fw) {
  return (1.0 - smoothstep(hw - fw, hw + fw, d)) * clamp(2.0 * hw / fw, 0.0, 1.0);
}

// World point (x sideways, y up, z ahead of the camera) to screen, with the horizon at y = 0
vec2 project(float x, float y, float z) {
  return vec2(x, y - CAM_HEIGHT) * (FOCAL / z);
}

float mountains(float x) {
  float h = noise1(x * 2.5 + 3.0) * 0.6 + noise1(x * 6.0 + 9.0) * 0.28 + noise1(x * 15.0) * 0.12;
  return h * mix(0.025, 0.11, smoothstep(0.05, 0.75, abs(x)));
}

// Height of the skyline building under x (0 in the gaps), kept low in the middle so the sun shows
float building(float x, float density, float seed, out float id) {
  float cx = x * density;
  id = floor(cx) + seed;
  float width = 0.55 + 0.4 * hash11(id * 3.1);
  if (abs(fract(cx) - 0.5) > width * 0.5) return 0.0;
  float h = 0.015 + 0.09 * pow(hash11(id * 1.7), 2.0);
  return h * smoothstep(0.12, 0.5, abs(x));
}

vec3 windows(vec2 p, float id, float t) {
  vec2 w = p * vec2(150.0, 180.0);
  vec2 cell = floor(w);
  vec2 f = fract(w);
  float pane = step(0.3, f.x) * step(f.x, 0.75) * step(0.3, f.y) * step(f.y, 0.75);
  float h = hash21(cell + id * 13.0);
  float on = step(0.68, h);
  // Now and then someone switches a light on or off
  on = abs(on - step(0.985, hash21(cell + floor(t * 0.25 + h * 9.0))));
  vec3 tint = mix(vec3(1.0, 0.75, 0.4), iTheme.borderMid.rgb, step(0.85, hash21(cell + 0.5)));
  return tint * pane * on;
}

// Lamps alternate between sodium orange and the theme's neon
vec3 lampColor(float n) {
  return mix(SODIUM, iTheme.border.rgb, step(1.0, mod(n, 2.0)));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float px = 1.0 / iResolution.y;
  vec2 p = vec2((fragCoord.x - 0.5 * iResolution.x) * px, fragCoord.y * px - HORIZON);
  float t = iTime;
  float camZ = t * SPEED;

  vec3 neon = iTheme.border.rgb;
  vec3 accent = iTheme.borderMid.rgb;
  vec3 night = iTheme.bgBase.rgb;
  vec3 dusk = iTheme.bgElevated.rgb;
  vec3 haze = mix(dusk, neon, 0.3);

  // Floor coordinates, computed everywhere so their derivatives stay smooth
  float z = FOCAL * CAM_HEIGHT / max(-p.y, px);
  float x = p.x * z / FOCAL;
  float wz = z + camZ;
  vec2 g = vec2(x, wz) / GRID;
  vec2 fwGrid = fwidth(g);
  float fwX = fwidth(x);

  vec3 col;
  if (p.y > 0.0) {
    col = mix(haze, night, smoothstep(0.0, 0.35, p.y));

    // Stars, twinkling, fading out into the glow above the horizon
    vec2 sc = p * 70.0;
    vec2 cell = floor(sc);
    float sh = hash21(cell);
    if (sh > 0.97) {
      vec2 sp = cell + 0.5 + (vec2(hash21(cell + 7.1), hash21(cell + 3.7)) - 0.5) * 0.7;
      float twinkle = 0.55 + 0.45 * sin(t * (1.5 + sh * 3.0) + sh * 40.0);
      col += vec3(0.85, 0.85, 1.0) * exp(-dot(sc - sp, sc - sp) * 18.0) * twinkle * smoothstep(0.08, 0.25, p.y);
    }

    // Planes: red and green wingtip lights with a double white strobe
    for (int i = 0; i < 2; i++) {
      float fi = float(i);
      float period = 38.0 + 17.0 * fi;
      float k = fract((t + fi * 21.0) / period);
      float dir = i == 0 ? 1.0 : -1.0;
      vec2 pc = vec2(dir * mix(-1.3, 1.3, k), 0.27 + 0.06 * fi + 0.02 * k);
      float strobe = fract(t * 0.9 + fi * 0.4);
      strobe = step(strobe, 0.05) + step(abs(strobe - 0.14), 0.025);
      col += vec3(1.0, 0.15, 0.2) * glow(p - pc + vec2(0.008, 0.0), 0.0022) * 0.8;
      col += vec3(0.2, 1.0, 0.4) * glow(p - pc - vec2(0.008, 0.0), 0.0022) * 0.8;
      col += vec3(1.0) * glow(p - pc, 0.003) * strobe;
    }

    // Sun: a gradient disk whose lower half breaks into bands that widen and drift down
    vec2 sunC = vec2(0.0, 0.12);
    float sunR = 0.18;
    float sd = length(p - sunC);
    float sy = (p.y - sunC.y) / sunR;
    col += mix(neon, SUN_TOP, 0.35) * exp(-max(sd - sunR, 0.0) * 9.0) * 0.45;
    float bands = fract(sy * 7.0 + t * 0.35);
    float cutHalf = clamp((0.2 - sy) * 0.21, 0.0, 0.35);
    float bandAA = 7.0 * px / sunR;
    float cut = (1.0 - smoothstep(cutHalf - bandAA, cutHalf + bandAA, abs(bands - 0.5))) * smoothstep(0.0, 2.0 * bandAA, cutHalf);
    float disk = smoothstep(sunR + px, sunR - px, sd);
    col = mix(col, mix(neon, SUN_TOP, smoothstep(-0.8, 0.7, sy)), disk * (1.0 - cut));

    // Wireframe mountains in front of the sun
    float mh = mountains(p.x);
    if (p.y < mh) {
      col = mix(night, dusk, 0.6);
      float contour = abs(fract(p.y * 60.0 + 0.5) - 0.5) / 60.0;
      col += accent * lineMask(contour, 0.4 * px, px) * 0.15;
      col += accent * exp(-(mh - p.y) / (2.0 * px)) * 0.8;
    } else {
      col += accent * exp(-(p.y - mh) / (3.0 * px)) * 0.25;
    }

    // City skyline: a hazy back row, then a darker front row with antenna beacons
    float backId;
    float backH = building(p.x, 9.0, 100.0, backId) * 1.4;
    if (p.y < backH) {
      col = mix(night, dusk, 0.45);
      col += windows(p, backId, t) * 0.45 * step(p.y, backH - 0.006);
      col += neon * exp(-(backH - p.y) / (1.5 * px)) * 0.35;
    }
    float frontId;
    float frontH = building(p.x, 15.0, 0.0, frontId);
    if (p.y < frontH) {
      col = mix(night, dusk, 0.15);
      col += windows(p, frontId, t) * step(p.y, frontH - 0.005);
      col += neon * exp(-(frontH - p.y) / (1.5 * px)) * 0.6;
    }
    if (frontH > 0.07 && hash11(frontId * 5.3) > 0.5) {
      vec2 mast = vec2((frontId + 0.5) / 15.0, frontH);
      col = mix(col, night, lineMask(abs(p.x - mast.x), 0.5 * px, px) * step(mast.y, p.y) * step(p.y, mast.y + 0.012));
      float blink = step(0.5, fract(t * 0.7 + hash11(frontId)));
      col += vec3(1.0, 0.15, 0.15) * glow(p - mast - vec2(0.0, 0.012), 0.002) * blink;
    }
  } else {
    float ax = abs(x);
    col = night;
    // The sun's reflection on the wet ground
    col += mix(neon, SUN_TOP, 0.3) * exp(-abs(p.x) * 4.0) * exp(p.y * 14.0) * 0.35;

    if (ax < ROAD_HALF) {
      col = mix(col, dusk * 0.6, 0.5);
      float dash = step(fract(wz / 6.0), 0.45);
      col = mix(col, vec3(1.0, 0.85, 0.5), lineMask(ax, 0.07, fwX) * dash);
      col = mix(col, accent, lineMask(abs(ax - (ROAD_HALF - 0.2)), 0.06, fwX));
    } else if (ax < ROAD_HALF + SIDEWALK) {
      col = mix(col, dusk, 0.35);
    } else {
      // Neon grid, its glow fading where the lines get denser than the pixels
      vec2 gd = abs(fract(g + 0.5) - 0.5);
      float line = max(lineMask(gd.x, 0.03, fwGrid.x), lineMask(gd.y, 0.03, fwGrid.y));
      float sharp = 1.0 - smoothstep(0.15, 0.5, max(fwGrid.x, fwGrid.y));
      float halo = exp(-min(gd.x / fwGrid.x, gd.y / fwGrid.y) * 0.35) * 0.3 * sharp;
      col += neon * (line + halo);
    }
    col += neon * lineMask(abs(ax - (ROAD_HALF + SIDEWALK)), 0.05, fwX);

    // Pools of light under the nearest lamps
    float n = floor(wz / LAMP_SPACING + 0.5);
    for (float s = -1.0; s <= 1.0; s += 2.0) {
      vec2 d = vec2(x - s * (LAMP_X - LAMP_REACH), wz - n * LAMP_SPACING);
      col += lampColor(n) * exp(-dot(d, d) / 8.0) * 0.45;
    }

    col = mix(haze, col, exp(-z * FOG));
  }

  // Haze along the horizon
  col += mix(neon, SUN_TOP, 0.3) * exp(-abs(p.y) * 60.0) * 0.35;

  // Street lamps, far to near so closer ones cover farther ones
  float lampBase = floor(camZ / LAMP_SPACING);
  for (int k = LAMPS; k >= 1; k--) {
    float n = lampBase + float(k);
    float lz = n * LAMP_SPACING - camZ;
    if (lz < 0.5) continue;
    float fog = exp(-lz * FOG);
    float sc = FOCAL / lz;
    for (float s = -1.0; s <= 1.0; s += 2.0) {
      vec2 foot = project(s * LAMP_X, 0.0, lz);
      vec2 top = project(s * LAMP_X, LAMP_HEIGHT, lz);
      vec2 head = project(s * (LAMP_X - LAMP_REACH), LAMP_HEIGHT - 0.05, lz);
      float w = max(0.06 * sc, 0.5 * px);
      float pole = 1.0 - smoothstep(w, w + px, min(segment(p, foot, top), segment(p, top, head)));
      col = mix(col, mix(haze, night * 0.5, fog), pole);
      col += lampColor(n) * glow(p - head, min(0.07 * sc, 0.01)) * mix(0.2, 1.0, fog);
    }
  }

  // Traffic: even cars overtake us in the right lane, odd cars come the other way
  for (int i = 0; i < CARS; i++) {
    float fi = float(i);
    bool oncoming = i % 2 == 1;
    float rel = oncoming ? SPEED + 9.0 + 4.0 * hash11(fi + 4.0) : 4.0 + 5.0 * hash11(fi + 9.0);
    float u = mod(hash11(fi * 7.3) * CAR_CYCLE + t * rel, CAR_CYCLE);
    float cz = oncoming ? 85.0 - u : u - 12.0;
    // Cars fade in and out a few lengths away, so they never pop up right next to the camera
    if (cz < 3.0) continue;
    float lane = oncoming ? -LANE_X : LANE_X;
    float fade = smoothstep(3.0, 7.0, cz);
    float clear = exp(-cz * FOG);
    float fog = clear * fade;
    float sc = FOCAL / cz;
    vec2 base = project(lane, 0.0, cz);

    float shape = max(box(p, base + vec2(-0.95, 0.15) * sc, base + vec2(0.95, 0.6) * sc, px),
                      box(p, base + vec2(-0.65, 0.6) * sc, base + vec2(0.65, 0.95) * sc, px));
    col = mix(col, mix(haze, night * 0.6, fog), shape * fade);
    // Window catching the neon, a stripe along the body and a lit roof edge
    float glass = box(p, base + vec2(-0.55, 0.64) * sc, base + vec2(0.55, 0.88) * sc, px);
    col += mix(accent, neon, smoothstep(0.64, 0.88, (p.y - base.y) / sc)) * glass * fog * 0.25;
    col += neon * box(p, base + vec2(-0.95, 0.24) * sc, base + vec2(0.95, 0.27) * sc, px) * fog * 0.5;
    col += neon * box(p, base + vec2(-0.65, 0.92) * sc, base + vec2(0.65, 0.95) * sc, px) * fog;

    vec3 lights = oncoming ? HEADLIGHT : TAILLIGHT;
    for (float s = -1.0; s <= 1.0; s += 2.0) {
      col += lights * glow(p - (base + vec2(s * 0.7, 0.42) * sc), 0.1 * sc) * mix(0.25, 1.0, clear) * fade;
    }
    if (!oncoming) col += TAILLIGHT * box(p, base + vec2(-0.7, 0.39) * sc, base + vec2(0.7, 0.45) * sc, px) * fog * 0.8;

    // Headlight beams ahead of oncoming cars, a red glow behind the others
    if (p.y < 0.0) {
      float across = (x - lane) / 0.9;
      float along = oncoming ? smoothstep(cz - 9.0, cz, z) * step(z, cz) : exp(-abs(z - cz + 1.0));
      col += lights * exp(-across * across) * along * fog * (oncoming ? 0.35 : 0.2);
    }
  }

  vec2 uv = fragCoord / iResolution.xy;
  col *= 1.0 - 0.45 * pow(length(uv - 0.5) * 1.2, 2.0);
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
