// Glass over every panel but the timeline: the street behind each pane is frosted, more so
// toward its corners, bent by a curved rim and a fisheye lens, beaded with rain, flared by bright
// lights and framed by ceramic frit in the splitter colour. The dashboard sits under the
// timeline, and everywhere else the street shows as it is. Floating panels are layered in the
// order iPanels lists them, so the one in front wins where they overlap and casts its shadow on
// whatever is behind it.
// iChannel0: the street, iChannel1: lightly blurred, iChannel2: heavily blurred, iChannel3: the dash

// iPanelInfo kinds, see shaderPacks.cjs
const int KIND_TIMELINE = 2;
const int KIND_TIMELINE_LABELS = 3;

// Lengths in CSS pixels
const float CORNER_RADIUS = 0.0;
const float BEVEL = 40.0;            // how far in from the edge the glass curves down
const float THICKNESS = 26.0;        // how tall the curved rim is, which sets how far it bends the street
// How fisheye the pane is: 0 is flat, higher squeezes more of the street in toward the middle
const float FISHEYE = 0.35;
// How strong the lens flare is: 0 turns it off. Bright parts of the street behind a pane bounce
// back as ghosts mirrored through its middle, a ring, and a glare around them
const float LENS_FLARE = 0.6;
const float FLARE_THRESHOLD = 0.45;  // how bright the street must be to flare
const int FLARE_GHOSTS = 4;
const float FLARE_DISPERSAL = 0.38;  // spacing of the ghosts toward the middle of the pane
const float FLARE_HALO = 0.6;        // ring radius, as a fraction of the pane's half size
const float FLARE_HALO_DISPERSION = 0.05;
const float DROP_SCALE = 450.0;      // CSS pixels per unit of the raindrop pattern
const float DROP_REFRACTION = 3.0;   // how far a drop bends the view through it, in units of DROP_SCALE pixels
// Ceramic frit printed around the pane's edge: a solid band, then dots shrinking inward
const float FRIT_SIZE = 1.2;         // scales the band, the dots and their spacing together
const float FRIT_SOLID = 5.0 * FRIT_SIZE;
const float FRIT_DOTS = 24.0 * FRIT_SIZE;  // how far in the dots reach past the solid band
const float FRIT_PITCH = 4.5 * FRIT_SIZE;  // dot spacing
const float FRIT_BLEED = 3.0;        // how far the solid band reaches past the pane's edge
const float SHADOW_OFFSET = 6.0;
const float SHADOW_BLUR = 16.0;
const float SHADOW_LIGHTNESS = 0.6;
const float IOR = 0.72;
const float DISPERSION = 0.03;
const float CONTRAST = 1.12;
const float LIGHTNESS = 0.025;
const float LIGHT_HEIGHT = 0.3;
const float RIM = 0.3;
const float RIM_POWER = 4.0;
const float RIM_SHARP = 0.5;
const float RIM_SHARP_POWER = 40.0;
const float EDGE = 0.12;

float linearstep(float e0, float e1, float x) {
  return clamp((x - e0) / (e1 - e0), 0.0, 1.0);
}

// Smoothstep that also takes its edges in reverse order
float ss(float e0, float e1, float x) {
  float t = clamp((x - e0) / (e1 - e0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

float roundRect(vec2 p, vec2 halfSize, float radius) {
  vec2 q = abs(p) - halfSize + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

float panelSdf(vec2 p, vec4 rect) {
  vec2 halfSize = rect.zw * 0.5;
  return roundRect(p - rect.xy - halfSize, halfSize, CORNER_RADIUS * iPixelRatio);
}

// Height of the rim at distance x in from the edge: rises like the side of a drop to h by l
float droplet(float x, float h, float l) {
  float t = h / l;
  float v = t * x * (2.0 * h - t * x);
  return x < l ? sqrt(-smin(-v, 0.0, 8.0)) : h;
}

float hash1(float t) {
  return fract(sin(t * 12345.564) * 7658.76);
}

vec3 hash3(float p) {
  vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.11369, 0.13787));
  p3 += dot(p3, p3.yzx + 19.19);
  return fract(vec3((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y, (p3.y + p3.z) * p3.x));
}

// Rises by b, then falls slowly back to 0 by 1
float saw(float b, float t) {
  return ss(0.0, b, t) * ss(1.0, b, t);
}

// Raindrops on the pane, after Martijn Steinrucken's "Heartfelt". In each column a drop clings,
// then lets go and slides down, wiggling and leaving a trail of beads behind it.
// Returns the drop coverage and how much its trail has wiped the glass
vec2 slidingDrops(vec2 uvIn, float t) {
  vec2 a = vec2(6.0, 1.0);
  vec2 grid = a * 2.0;
  vec2 uv = uvIn;
  uv.y += t * 0.75;
  uv.y += hash1(floor(uv.x * grid.x));
  vec2 id = floor(uv * grid);
  vec3 n = hash3(id.x * 35.2 + id.y * 2376.1);
  vec2 st = fract(uv * grid) - vec2(0.5, 0.0);

  float wiggleY = uvIn.y * 20.0;
  float x = n.x - 0.5;
  x += sin(wiggleY + sin(wiggleY)) * (0.5 - abs(x)) * (n.z - 0.5);
  x *= 0.7;
  float y = (saw(0.85, fract(t + n.z)) - 0.5) * 0.9 + 0.5;

  float mainDrop = ss(0.4, 0.0, length((st - vec2(x, y)) * a.yx));
  float r = sqrt(ss(1.0, y, st.y));
  float across = abs(st.x - x);
  float trailFront = ss(-0.02, 0.02, st.y - y);
  float trail = ss(0.23 * r, 0.15 * r * r, across) * trailFront * r * r;
  float beadY = fract(uvIn.y * 10.0) + (st.y - 0.5);
  float beads = ss(0.3, 0.0, length(st - vec2(x, beadY)));
  return vec2(mainDrop + beads * r * trailFront, trail);
}

// Fresh drops landing on the glass and slowly evaporating
float landingDrops(vec2 uvIn, float t) {
  vec2 uv = uvIn * 40.0;
  vec2 id = floor(uv);
  vec2 st = fract(uv) - 0.5;
  vec3 n = hash3(id.x * 107.45 + id.y * 3543.654);
  float d = length(st - (n.xy - 0.5) * 0.7);
  return ss(0.3, 0.0, d) * fract(n.z * 10.0) * saw(0.025, fract(t + n.z));
}

vec2 rain(vec2 uv, float t) {
  float landing = landingDrops(uv, t);
  vec2 near = slidingDrops(uv, t);
  vec2 far = slidingDrops(uv * 1.85, t);
  return vec2(ss(0.3, 1.0, landing + near.x + far.x), max(near.y, far.y));
}

// What shows through the glass at p: frosted, blurring more toward the corners, and clear
// where a drop or its trail has wiped it
vec3 behind(vec2 p, float vignette, float clarity) {
  vec2 uv = p / iResolution.xy;
  vec3 sharp = textureLod(iChannel0, uv, 0.0).rgb;
  vec3 soft = textureLod(iChannel1, uv, 0.0).rgb;
  vec3 heavy = textureLod(iChannel2, uv, 0.0).rgb;
  return mix(mix(soft, heavy, vignette), sharp, clarity);
}

// The part of the (blurred) street at p bright enough to flare
vec3 flareSource(vec2 p) {
  vec3 c = textureLod(iChannel2, p / iResolution.xy, 0.0).rgb;
  return max(c - FLARE_THRESHOLD, vec3(0.0));
}

// Pseudo lens flare, after John Chapman, in the pane's own coordinates: local runs -1..1 across it
vec3 flare(vec2 p, vec2 centre, vec2 halfSize, vec2 local) {
  vec3 tints[4] = vec3[4](vec3(1.0, 0.55, 0.25), vec3(0.35, 0.8, 1.0), vec3(0.85, 0.4, 1.0), vec3(0.5, 1.0, 0.6));
  vec3 col = vec3(0.0);
  for (int i = 0; i < FLARE_GHOSTS; i++) {
    vec2 ghost = -local * (1.0 - FLARE_DISPERSAL * float(i));
    float weight = pow(max(1.0 - length(ghost) / 1.4142, 0.0), 5.0);
    col += flareSource(centre + ghost * halfSize) * tints[i % 4] * weight;
  }

  vec2 toward = dot(local, local) > 1e-8 ? normalize(local) : vec2(0.0, 1.0);
  for (int c = 0; c < 3; c++) {
    vec2 halo = -local + toward * FLARE_HALO * (1.0 + float(c - 1) * FLARE_HALO_DISPERSION);
    float weight = pow(max(1.0 - length(halo) / 1.4142, 0.0), 5.0);
    col[c] += flareSource(centre + halo * halfSize)[c] * weight * 0.6;
  }
  return (col + flareSource(p) * 0.35) * LENS_FLARE;
}

// How much of p the frit covers. Dots sit on a staggered grid and are sized by how far their
// centre is from the edge, so each one stays round
float frit(vec2 p, vec4 rect, float px) {
  float solid = linearstep(-0.5 * px, 0.5 * px, FRIT_SOLID * px + panelSdf(p, rect));
  float pitch = FRIT_PITCH * px;
  vec2 q = (p - rect.xy) / pitch;
  float row = floor(q.y);
  float stagger = 0.5 * (row - 2.0 * floor(row * 0.5));
  vec2 cell = vec2(floor(q.x + stagger) - stagger + 0.5, row + 0.5);
  vec2 centre = rect.xy + cell * pitch;
  float fade = (-panelSdf(centre, rect) - FRIT_SOLID * px) / (FRIT_DOTS * px);
  float radius = mix(0.62, 0.0, clamp(fade, 0.0, 1.0)) * pitch;
  float spot = linearstep(0.5 * px, -0.5 * px, length(p - centre) - radius);
  return max(solid, spot * step(fade, 1.0));
}

bool isGlass(int i) {
  int kind = iPanelInfo[i].x;
  return kind != KIND_TIMELINE && kind != KIND_TIMELINE_LABELS;
}

bool isFloating(int i) {
  return i >= 0 && iPanelInfo[i].y != 0;
}

// Shade over the layer at index `layer` (-1 for the street) from the panes in front of it,
// falling away from the light. Docked panes all shadow one another, as they sit side by side
float shadowOn(vec2 p, int layer, vec3 ldir, float px) {
  float shadow = 1.0;
  float shadowBlur = SHADOW_BLUR * px;
  vec2 offset = normalize(ldir.xy) * SHADOW_OFFSET * px;
  for (int j = 0; j < iPanelCount; j++) {
    if (!isGlass(j) || iPanels[j].z < 1.0) continue;
    if (j < layer && (isFloating(j) || isFloating(layer))) continue;
    float s = abs(panelSdf(p + offset, iPanels[j])) - 0.33 * shadowBlur;
    shadow *= mix(SHADOW_LIGHTNESS, 1.0, linearstep(-shadowBlur, shadowBlur, s));
  }
  return shadow;
}

// The pane at its fullest: the street seen through the glass at p, with its frit printed on
vec3 pane(vec2 p, vec4 rect, float sdf, float px, float shadow, vec3 ldir) {
  vec3 fritColor = iTheme.splitter.rgb;
  float bevel = BEVEL * px;
  float thickness = THICKNESS * px;
  float h = droplet(-sdf, thickness, bevel);
  float dhdx = droplet(-panelSdf(p + vec2(1.0, 0.0), rect), thickness, bevel) - h;
  float dhdy = droplet(-panelSdf(p + vec2(0.0, 1.0), rect), thickness, bevel) - h;
  vec3 ndir = normalize(vec3(-dhdx, -dhdy, 1.0));

  vec2 halfSize = rect.zw * 0.5;
  vec2 centre = rect.xy + halfSize;
  vec2 fromCentre = p - centre;
  vec2 local = fromCentre / halfSize;
  float vignette = smoothstep(0.3, 1.0, dot(local, local) * 0.5);
  float reach = length(fromCentre) / length(halfSize);
  vec2 lens = fromCentre * (pow(max(reach, 1e-4), FISHEYE) - 1.0);

  // Drops on the outside of the pane; their slope, by finite differences, bends the view like a lens
  float dropUnit = DROP_SCALE * px;
  vec2 dropUv = p / dropUnit;
  float t = iTime * 0.2;
  vec2 drops = rain(dropUv, t);
  float e = 1.0 / dropUnit;
  vec2 slope = vec2(rain(dropUv + vec2(e, 0.0), t).x - drops.x, rain(dropUv + vec2(0.0, e), t).x - drops.x);
  vec2 dropBend = slope * DROP_REFRACTION * dropUnit;
  float clarity = max(ss(0.1, 0.2, drops.x), drops.y * 0.7);

  // The rim works as a lens too: each channel bends a little differently
  vec3 col = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    vec3 odir = refract(vec3(0.0, 0.0, -1.0), ndir, IOR + float(i) * DISPERSION);
    vec2 rimBend = -clamp(odir.xy / odir.z, vec2(-4.0), vec2(4.0)) * thickness;
    float spread = 1.0 + float(i - 1) * DISPERSION;
    col[i] = behind(p + (rimBend + lens + dropBend) * spread, vignette, clarity)[i];
  }
  // Drops gather a little light along their lower edge
  col += vec3(0.08) * ss(0.0, 20.0, slope.y * dropUnit) * ss(0.05, 0.3, drops.x);
  col *= shadow;
  col = pow(max(col, vec3(0.0)), vec3(CONTRAST)) + LIGHTNESS;
  float rim = abs(dot(ndir, ldir));
  col += RIM * pow(rim, RIM_POWER) + RIM_SHARP * pow(rim, RIM_SHARP_POWER);
  if (LENS_FLARE > 0.0) {
    col += flare(p, centre, halfSize, local);
  }

  // The frit is printed on the glass, so the rim's sheen still catches on its dots; the solid band
  // stays flat so the pane's border reads as one clean edge
  float sheen = RIM_SHARP * 0.4 * pow(rim, RIM_SHARP_POWER) * linearstep(FRIT_SOLID * px, (FRIT_SOLID + 2.0) * px, -sdf);
  return mix(col, fritColor + sheen, frit(p, rect, px));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = fragCoord;
  float px = max(iPixelRatio, 1e-3);
  vec3 street = textureLod(iChannel0, p / iResolution.xy, 0.0).rgb;
  vec4 dash = textureLod(iChannel3, p / iResolution.xy, 0.0);
  vec3 base = mix(street, dash.rgb, dash.a);
  vec3 ldir = normalize(vec3(-0.6, 0.8, LIGHT_HEIGHT));

  // Everything behind the front-most panel that fully covers p is hidden
  int first = -1;
  for (int i = 0; i < iPanelCount; i++) {
    if (iPanelInfo[i].x == KIND_TIMELINE_LABELS || iPanels[i].z < 1.0) continue;
    if (panelSdf(p, iPanels[i]) <= -0.75 * px) first = i;
  }

  vec3 col;
  if (first >= 0 && isGlass(first)) {
    vec4 rect = iPanels[first];
    col = pane(p, rect, panelSdf(p, rect), px, shadowOn(p, first, ldir, px), ldir);
  } else {
    col = base * shadowOn(p, first, ldir, px);
  }

  // Then the panels in front, where their edges reach p. The solid frit runs a little past each
  // pane, over the seam with whatever borders it
  vec3 fritColor = iTheme.splitter.rgb;
  for (int i = first + 1; i < iPanelCount; i++) {
    if (iPanelInfo[i].x == KIND_TIMELINE_LABELS || iPanels[i].z < 1.0) continue;
    vec4 rect = iPanels[i];
    float sdf = panelSdf(p, rect);
    if (sdf > (FRIT_BLEED + 1.0) * px) continue;
    float mask = linearstep(0.75 * px, -0.75 * px, sdf);
    if (!isGlass(i)) {
      col = mix(col, base * shadowOn(p, i, ldir, px), mask);
      continue;
    }
    float edge = EDGE * linearstep(px, -px, abs(sdf) - px);
    float bleed = linearstep(0.5 * px, -0.5 * px, sdf - FRIT_BLEED * px);
    col = mix(col + edge, fritColor, bleed);
    if (mask > 0.0) col = mix(col, pane(p, rect, sdf, px, shadowOn(p, i, ldir, px), ldir), mask);
  }

  fragColor = vec4(col, 1.0);
}
