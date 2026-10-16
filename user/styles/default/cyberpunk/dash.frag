// The car's dashboard, under the timeline wherever it is docked: dark soft-touch plastic washed
// by the passing street lights, a neon trim strip along its top edge, the street's reflection
// where it meets the windshield, and down the timeline's right edge an LED tachometer with a
// speed readout, in a column the size of the track labels mirrored across. It stays dark and
// calm so clips are easy to see and drag.
// Writes alpha 1 over the timeline and 0 everywhere else; glass.frag hides it behind panels in front.
// iChannel0: the street, heavily blurred

// iPanelInfo kinds, see shaderPacks.cjs
const int KIND_TIMELINE = 2;
const int KIND_TIMELINE_LABELS = 3;

// Lengths in CSS pixels
const float TRIM_WIDTH = 1.5;        // the neon strip along the dash's top edge
const float TRIM_GLOW = 14.0;        // how far its glow reaches down
const float HORIZON_GLOW = 55.0;     // the soft synthwave haze under the trim
const float REFLECTION = 0.15;       // the street reflected where the dash meets the windshield
const float REFLECTION_REACH = 0.65; // how far down it fades out, as a fraction of the dash's height
const float SPILL = 0.07;            // how bright the passing street lights wash over the dash
const float SPILL_SPEED = 0.18;      // lights passing per second, per side of the street
const float GRAIN = 0.01;
const float VIGNETTE = 0.5;

const float GAUGE_BRIGHTNESS = 0.55; // kept low, clips can pass over it
const int GAUGE_SEGMENTS = 30;
const float GAUGE_WIDTH = 6.0;
const float GAUGE_INSET = 7.0;       // from the column's sides
const float GAUGE_TOP = 40.0;        // kept clear at the column's top, beside the ruler
const float GAUGE_BOTTOM = 34.0;     // kept for the speed readout
const float DIGIT_HEIGHT = 13.0;
const float SHIFT_TIME = 3.4;        // seconds the engine revs through each gear

// Seven-segment digits 0-9, bits a (top) to g (middle) going clockwise from the top
const int DIGIT_MASKS[10] = int[10](63, 6, 91, 79, 102, 109, 125, 7, 127, 111);

float linearstep(float e0, float e1, float x) {
  return clamp((x - e0) / (e1 - e0), 0.0, 1.0);
}

float hash11(float n) {
  return fract(sin(n * 127.1) * 43758.5453);
}

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float boxSdf(vec2 p, vec2 halfSize) {
  vec2 q = abs(p) - halfSize;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

float capsule(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

// Engine speed 0..1: climbs through each gear, then drops back as the next one engages
float rpm(float t) {
  float gear = floor(t / SHIFT_TIME);
  float f = fract(t / SHIFT_TIME);
  float redline = 0.78 + 0.14 * hash11(gear);
  return mix(0.38, redline, 1.0 - exp(-2.6 * f)) + 0.012 * sin(t * 37.0) * sin(t * 23.0);
}

vec3 gaugeColor(float t) {
  vec3 c = mix(iTheme.borderMid.rgb, iTheme.border.rgb, smoothstep(0.45, 0.8, t));
  return mix(c, vec3(1.0, 0.12, 0.25), smoothstep(0.85, 0.92, t));
}

// LED bar up the column's right side, with a tick scale down its left side
vec3 tachometer(vec2 p, vec4 column, float px) {
  p.x = 2.0 * column.x + column.z - p.x;
  float bottom = column.y + GAUGE_BOTTOM * px;
  float top = column.y + column.w - GAUGE_TOP * px;
  if (top - bottom < 40.0 * px) return vec3(0.0);
  float pitch = (top - bottom) / float(GAUGE_SEGMENTS);
  float halfWidth = GAUGE_WIDTH * px * 0.5;
  float x = column.x + GAUGE_INSET * px + halfWidth;
  float level = rpm(iTime);

  vec3 light = vec3(0.0);
  float under = floor((p.y - bottom) / pitch);
  for (int k = -1; k <= 1; k++) {
    float i = under + float(k);
    if (i < 0.0 || i > float(GAUGE_SEGMENTS - 1)) continue;
    float t = (i + 0.5) / float(GAUGE_SEGMENTS);
    float d = boxSdf(p - vec2(x, bottom + (i + 0.5) * pitch), vec2(halfWidth, pitch * 0.32));
    float lit = step(t, level);
    float body = linearstep(0.6 * px, -0.6 * px, d);
    float glow = exp(-max(d, 0.0) / (5.0 * px)) * 0.25;
    light += gaugeColor(t) * (body * mix(0.07, 1.0, lit) + glow * lit);
  }

  float tickIndex = floor((p.y - bottom) / pitch + 0.5);
  if (tickIndex >= 0.0 && tickIndex <= float(GAUGE_SEGMENTS)) {
    float tickLength = (mod(tickIndex, 5.0) < 0.5 ? 6.0 : 3.0) * px;
    float fromEdge = column.x + column.z - GAUGE_INSET * px - p.x;
    float dy = abs(p.y - (bottom + tickIndex * pitch));
    float tick = (1.0 - linearstep(0.4 * px, 0.9 * px, dy)) * step(0.0, fromEdge) * step(fromEdge, tickLength);
    light += iTheme.textMuted.rgb * tick * 0.6;
  }
  return light * GAUGE_BRIGHTNESS;
}

// Distance to the digit's lit segments and to all of them, in a w x h cell with y up
vec2 sevenSegment(vec2 q, vec2 size, int mask, float thickness) {
  q.x -= q.y * 0.18;
  float w = size.x;
  float h = size.y;
  float g = thickness * 0.9;
  float r = thickness * 0.5;
  float s[7];
  s[0] = capsule(q, vec2(g, h), vec2(w - g, h), r);
  s[1] = capsule(q, vec2(w, h - g), vec2(w, h * 0.5 + g), r);
  s[2] = capsule(q, vec2(w, h * 0.5 - g), vec2(w, g), r);
  s[3] = capsule(q, vec2(g, 0.0), vec2(w - g, 0.0), r);
  s[4] = capsule(q, vec2(0.0, h * 0.5 - g), vec2(0.0, g), r);
  s[5] = capsule(q, vec2(0.0, h - g), vec2(0.0, h * 0.5 + g), r);
  s[6] = capsule(q, vec2(g, h * 0.5), vec2(w - g, h * 0.5), r);
  float lit = 1e9;
  float every = 1e9;
  for (int i = 0; i < 7; i++) {
    every = min(every, s[i]);
    if (((mask >> i) & 1) == 1) lit = min(lit, s[i]);
  }
  return vec2(lit, every);
}

// Speed in three seven-segment digits under the tachometer
vec3 speedReadout(vec2 p, vec4 column, float px) {
  float h = DIGIT_HEIGHT * px;
  float w = h * 0.5;
  float gap = h * 0.32;
  float total = 3.0 * w + 2.0 * gap;
  vec2 q = p - vec2(column.x + (column.z - total) * 0.5, column.y + (GAUGE_BOTTOM * px - h) * 0.5);
  float margin = 5.0 * px;
  if (q.x < -margin || q.x > total + margin || q.y < -margin || q.y > h + margin) return vec3(0.0);

  int speed = int(88.0 + 18.0 * sin(iTime * 0.11) + 7.0 * sin(iTime * 0.37));
  float cell = clamp(floor(q.x / (w + gap)), 0.0, 2.0);
  int place = 2 - int(cell);
  int digit = (speed / (place == 2 ? 100 : place == 1 ? 10 : 1)) % 10;
  int mask = place == 2 && speed < 100 ? 0 : DIGIT_MASKS[digit];
  vec2 d = sevenSegment(q - vec2(cell * (w + gap), 0.0), vec2(w, h), mask, 1.6 * px);

  float on = linearstep(0.6 * px, -0.6 * px, d.x);
  float off = linearstep(0.6 * px, -0.6 * px, d.y);
  float glow = exp(-max(d.x, 0.0) / (4.0 * px)) * 0.3;
  return iTheme.borderMid.rgb * (on + glow + off * 0.06) * GAUGE_BRIGHTNESS;
}

// The first panel of this kind that is shown, or all zeros
vec4 findPanel(int kind) {
  for (int i = 0; i < iPanelCount; i++) {
    if (iPanelInfo[i].x == kind && iPanels[i].z >= 1.0) return iPanels[i];
  }
  return vec4(0.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = fragCoord;
  vec4 dash = findPanel(KIND_TIMELINE);
  if (dash.z < 1.0 || p.x < dash.x || p.x > dash.x + dash.z || p.y < dash.y || p.y > dash.y + dash.w) {
    fragColor = vec4(0.0);
    return;
  }
  float px = max(iPixelRatio, 1e-3);
  vec2 uv = (p - dash.xy) / dash.zw;
  float fromTop = dash.y + dash.w - p.y;
  vec3 pink = iTheme.border.rgb;
  vec3 cyan = iTheme.borderMid.rgb;

  // Soft-touch plastic, a touch lighter toward the windshield, with a synthwave haze under the trim
  vec3 col = mix(iTheme.bgBase.rgb, iTheme.bgPanel.rgb, uv.y * 0.9);
  col += pink * 0.05 * exp(-fromTop / (HORIZON_GLOW * px));

  // Street lights on either side sweep down the dash as the car passes under them
  for (int i = 0; i < 2; i++) {
    float side = i == 0 ? -1.0 : 1.0;
    float t = iTime * SPILL_SPEED + float(i) * 0.47;
    float f = fract(t);
    float strength = 0.5 + 0.5 * hash11(floor(t) * 17.3 + float(i) * 5.1);
    float along = 1.0 - uv.y + side * (uv.x - 0.5) * 0.3;
    float band = exp(-pow((along - mix(-0.5, 1.5, f)) / 0.4, 2.0)) * sin(3.14159 * f);
    float towardSide = mix(0.35, 1.0, i == 0 ? 1.0 - uv.x : uv.x);
    col += (i == 0 ? pink : cyan) * band * strength * towardSide * SPILL;
  }

  // The street above, mirrored in the dash's top where it meets the windshield
  vec2 mirrored = vec2(p.x, dash.y + dash.w + fromTop * 1.2);
  float reflectionFade = 1.0 - smoothstep(0.0, REFLECTION_REACH * dash.w, fromTop);
  col += textureLod(iChannel0, mirrored / iResolution.xy, 0.0).rgb * REFLECTION * reflectionFade * reflectionFade;

  // Darker toward the sides and down into the footwell
  col *= mix(1.0 - VIGNETTE * 0.6, 1.0, pow(clamp(uv.x * (1.0 - uv.x) * 4.0, 0.0, 1.0), 0.25));
  col *= mix(0.7, 1.0, smoothstep(0.0, 0.35, uv.y));
  col += (hash21(floor(p)) - 0.5) * GRAIN;

  // Neon trim along the top edge, drifting between pink and cyan
  vec3 trimColor = mix(pink, cyan, 0.5 + 0.5 * sin(uv.x * 6.2832 - iTime * 0.3));
  float trim = linearstep((TRIM_WIDTH + 0.5) * px, (TRIM_WIDTH - 0.5) * px, fromTop);
  col = mix(col, trimColor, trim * 0.85) + trimColor * exp(-fromTop / (TRIM_GLOW * px)) * 0.12;

  vec4 labels = findPanel(KIND_TIMELINE_LABELS);
  if (labels.z >= 1.0) {
    vec4 column = vec4(2.0 * dash.x + dash.z - labels.x - labels.z, labels.yzw);
    col += tachometer(p, column, px) + speedReadout(p, column, px);
  }
  fragColor = vec4(col, 1.0);
}
