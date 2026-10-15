// Neon vintage, ray marched: a rainy night drive down a four-lane boulevard toward a striped
// sun. The lamps, buildings and traffic are real 3D geometry found by sphere tracing; the wet
// asphalt reflects them with a second march, lamps cast soft ray-marched shadows, ambient
// occlusion grounds the cars, and a short volumetric march lights up the cones under the lamps.
// Buildings come in five styles with their own window grids; every window looks into a room
// (interior mapping) and mirrors the street with a third march, and the ground floors are
// shops with neon lettering, awnings and blade signs.
// Cars come from traffic.comp through the storage buffer, rain from rain.vert in iChannel0.
// Theme colours: neon = border, accents = border-mid, sky = background, haze = elevated panels.

const float DRIVE_SPEED = 12.0;   // keep in sync with traffic.comp and rain.vert
const float FOCAL = 1.25;
const int CAR_COUNT = 16;

const float ROAD_HALF = 7.0;
const float LAMP_SPACING = 25.0;
const float LAMP_X = 8.6;
const float LAMP_H = 7.4;
const float LAMP_REACH = 2.6;
const float BLOCK = 22.0;
const float BUILD_X = 13.0;
const float MAX_HEIGHT = 70.0;

const float GROUND_H = 4.6;       // the shop floor
const float FRONT_REACH = 1.6;    // awnings, balconies and blade signs stick out this far over the sidewalk
const float ROOF_REACH = 7.0;     // tanks, plant and antennas on the roofs
const float TIER_RECESS = 3.0;    // how far a setback tower steps back from its podium
const float TIER_LENGTH = 0.72;
const float SIGN_Y = 7.8;
const float SIGN_HALF = 2.4;
const float ROOM_DEPTH = 4.0;
const float SHOP_DEPTH = 6.0;

const int MARCH_STEPS = 160;
const int REFLECT_STEPS = 56;
const int GLASS_STEPS = 40;
const float GLASS_FAR = 150.0;
const int SHADOW_STEPS = 24;
const int FOG_STEPS = 14;
const float FAR = 420.0;
const float FOG_DENSITY = 0.0065;

const float MAT_BUILDING = 1.0;
const float MAT_POLE = 2.0;
const float MAT_LAMP = 3.0;
const float MAT_TRIM = 4.0;       // floor ledges, balconies, glass fins
const float MAT_AWNING = 5.0;
const float MAT_SIGN = 6.0;
const float MAT_ROOFTOP = 7.0;
const float MAT_CAR = 10.0;       // plus the car's index

const int STYLE_CONCRETE = 0;     // punched windows and floor ledges
const int STYLE_SETBACK = 1;      // a tower stepped back above a podium
const int STYLE_GLASS = 2;        // curtain wall with vertical fins
const int STYLE_RESIDENTIAL = 3;  // painted render and balconies
const int STYLE_BRICK = 4;

const vec3 SUN_TOP = vec3(1.0, 0.62, 0.08);
const vec3 SODIUM = vec3(1.0, 0.5, 0.2);
const vec3 HEADLIGHT = vec3(1.0, 0.92, 0.8);
const vec3 TAILLIGHT = vec3(1.0, 0.05, 0.12);

struct Car { vec4 body; vec4 look; };   // see traffic.comp
HALLU_STORAGE Traffic { Car cars[]; };

// The left lanes drive toward us; a stopped car has no speed to tell by
float facing(vec4 body) { return body.x < 0.0 ? -1.0 : 1.0; }

vec3 neon;
vec3 accent;
vec3 night;
vec3 haze;
float pixelAngle;

// ─── Camera (keep in sync with rain.vert) ────────────────────────────────────

vec3 cameraPosition(float t) {
  return vec3(1.75 + 0.22 * sin(t * 0.21), 2.6 + 0.035 * sin(t * 1.9), t * DRIVE_SPEED);
}

mat3 cameraBasis(float t) {
  vec3 forward = normalize(vec3(-0.035 + 0.012 * sin(t * 0.21 + 1.0), -0.075, 1.0));
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
  return mat3(right, cross(forward, right), forward);
}

// ─── Noise ───────────────────────────────────────────────────────────────────

uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

float hash(ivec2 c) {
  return float(pcg(uint(c.x) * 1597334677u ^ pcg(uint(c.y) + 2654435769u))) * (1.0 / 4294967296.0);
}

float noise(vec2 p) {
  ivec2 i = ivec2(floor(p));
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + ivec2(1, 0)), u.x), mix(hash(i + ivec2(0, 1)), hash(i + ivec2(1, 1)), u.x), u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p = p * 2.03 + 17.1;
    amplitude *= 0.5;
  }
  return value;
}

vec3 linearColor(vec3 c) { return pow(c, vec3(2.2)); }

vec3 neonPalette(float h) {
  int i = int(h * 6.0);
  if (i == 0) return neon;
  if (i == 1) return accent;
  if (i == 2) return vec3(0.05, 0.75, 1.0);
  if (i == 3) return vec3(1.0, 0.08, 0.45);
  if (i == 4) return vec3(1.0, 0.7, 0.08);
  return vec3(0.15, 1.0, 0.3);
}

// ─── Signed distances ────────────────────────────────────────────────────────

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdRoundBox(vec3 p, vec3 b, float r) { return sdBox(p, b - r) - r; }

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a;
  vec3 ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)) - r;
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// ─── Buildings ───────────────────────────────────────────────────────────────

int sideSalt(float side) { return side > 0.0 ? 0 : 32; }

// A building per block on each side: near facade x, depth, height (0 for an empty lot), half length
vec4 building(float side, float block) {
  int b = int(block);
  int s = sideSalt(side);
  if (hash(ivec2(b, s)) < 0.625) return vec4(0.0);
  return vec4(
    BUILD_X + 2.5 * hash(ivec2(b, s + 2)),
    9.0 + 10.0 * hash(ivec2(b, s + 3)),
    12.0 + 50.0 * pow(hash(ivec2(b, s + 1)), 1.6),
    6.5 + 3.5 * hash(ivec2(b, s + 4)));
}

// Style, window pattern (0 punched, 1 ribbon, 2 tall slots, 3 paired, 4 curtain wall),
// bay width and floor height
vec4 buildingStyle(float side, float block, float height) {
  int b = int(block);
  int s = sideSalt(side);
  int style = int(hash(ivec2(b, s + 5)) * 5.0);
  if (style == STYLE_SETBACK && height < 26.0) style = STYLE_CONCRETE;
  int pattern = int(hash(ivec2(b, s + 6)) * 4.0);
  if (style == STYLE_GLASS) pattern = 4;
  return vec4(float(style), float(pattern), 1.5 + 1.1 * hash(ivec2(b, s + 7)), 3.0 + 0.8 * hash(ivec2(b, s + 8)));
}

// Awning (0 or 1), which end carries a blade sign (-1, 1, or 0 for none), rooftop kit (0 to 3)
// and a colour seed
vec4 buildingExtras(float side, float block) {
  int b = int(block);
  int s = sideSalt(side);
  float blade = hash(ivec2(b, s + 10));
  return vec4(
    step(0.45, hash(ivec2(b, s + 9))),
    blade < 0.3 ? 0.0 : (blade < 0.65 ? -1.0 : 1.0),
    floor(hash(ivec2(b, s + 11)) * 4.0),
    hash(ivec2(b, s + 12)));
}

float tierHeight(float height) { return max(14.0, floor(height * 0.55)); }

// The full building in its own frame: q = (depth in from the street facade, height, along the street)
vec2 buildingDetail(vec3 q, vec4 b, vec4 st, vec4 ex) {
  float depth = b.y;
  float h = b.z;
  float hl = b.w;
  int style = int(st.x);
  float bw = st.z;
  float fh = st.w;
  float f = q.x;
  float y = q.y;
  float z = q.z;
  float topLength = hl;
  float roofX = depth * 0.5;
  float d;
  if (style == STYLE_SETBACK) {
    float h1 = tierHeight(h);
    float upperDepth = depth - TIER_RECESS;
    d = min(
      sdBox(q - vec3(depth * 0.5, h1 * 0.5, 0.0), vec3(depth * 0.5, h1 * 0.5, hl)),
      sdBox(q - vec3(TIER_RECESS + upperDepth * 0.5, (h1 + h) * 0.5, 0.0), vec3(upperDepth * 0.5, (h - h1) * 0.5, hl * TIER_LENGTH)));
    topLength = hl * TIER_LENGTH;
    roofX = TIER_RECESS + upperDepth * 0.5;
  } else {
    d = sdBox(q - vec3(depth * 0.5, h * 0.5, 0.0), vec3(depth * 0.5, h * 0.5, hl));
  }
  vec2 res = vec2(d, MAT_BUILDING);
  float floors = floor((h - GROUND_H) / fh);
  float yy = y - GROUND_H;

  float trim = 1e3;
  if (style == STYLE_CONCRETE) {
    float k = clamp(floor(yy / fh + 0.5), 0.0, floors - 1.0);
    trim = sdBox(vec3(f + 0.12, yy - k * fh, z), vec3(0.12, 0.08, hl));
  } else if (style == STYLE_GLASS) {
    float n = floor(hl / bw);
    float zz = z - clamp(floor(z / bw + 0.5), -n, n) * bw;
    trim = sdBox(vec3(f + 0.22, y - (h + GROUND_H) * 0.5, zz), vec3(0.22, (h - GROUND_H) * 0.5, 0.06));
  } else if (style == STYLE_RESIDENTIAL && floors > 2.0) {
    float period = 2.0 * bw;
    float n = floor((hl - bw * 0.8) / period);
    if (n >= 0.0) {
      float zz = z - clamp(floor(z / period + 0.5), -n, n) * period;
      float k = clamp(floor(yy / fh), 1.0, floors - 2.0);
      // The balcony below and above, so rays between floors can't skip either
      for (int i = 0; i < 2; i++) {
        float level = (k + float(i)) * fh;
        trim = min(trim, sdBox(vec3(f + 0.55, yy - level - 0.06, zz), vec3(0.55, 0.06, bw * 0.8)));
        trim = min(trim, sdBox(vec3(f + 1.04, yy - level - 0.6, zz), vec3(0.04, 0.48, bw * 0.8)));
      }
    }
  }
  if (trim < res.x) res = vec2(trim, MAT_TRIM);

  if (ex.x > 0.5) {
    // Sloping down toward the street, so not quite a distance field; scale the steps down
    float awning = sdBox(vec3(f + 0.8, y - 3.3 - (f + 0.8) * 0.3, z), vec3(0.8, 0.04, hl - 0.4)) * 0.9;
    if (awning < res.x) res = vec2(awning, MAT_AWNING);
  }
  if (ex.y != 0.0) {
    float blade = sdBox(vec3(f + 0.75, y - SIGN_Y, z - ex.y * (hl - 1.3)), vec3(0.75, SIGN_HALF, 0.1));
    if (blade < res.x) res = vec2(blade, MAT_SIGN);
  }
  if (ex.z > 0.5) {
    float kit;
    if (ex.z < 1.5) {
      kit = sdBox(q - vec3(roofX + 1.0, h + 1.0, topLength * 0.3), vec3(1.4, 1.0, 1.2));
    } else if (ex.z < 2.5) {
      kit = max(length(vec2(f - roofX, z + topLength * 0.3)) - 1.2, abs(y - h - 1.8) - 1.8);
    } else {
      kit = min(
        sdBox(q - vec3(roofX + 1.0, h + 0.8, -topLength * 0.2), vec3(1.0, 0.8, 1.0)),
        sdCapsule(q, vec3(roofX - 1.0, h, 0.0), vec3(roofX - 1.0, h + 6.5, 0.0), 0.12));
    }
    if (kit < res.x) res = vec2(kit, MAT_ROOFTOP);
  }
  return res;
}

vec2 buildingDistance(vec3 p, float ax, float side, float block) {
  vec4 b = building(side, block);
  if (b.z == 0.0) return vec2(1e3, MAT_BUILDING);
  vec3 q = vec3(ax - b.x, p.y, p.z - (block + 0.5) * BLOCK);
  // Only work out the details once the ray is near the building
  float bound = sdBox(
    q - vec3((b.y - FRONT_REACH) * 0.5, (b.z + ROOF_REACH) * 0.5, 0.0),
    vec3((b.y + FRONT_REACH) * 0.5, (b.z + ROOF_REACH) * 0.5, b.w));
  if (bound > 0.6) return vec2(bound, MAT_BUILDING);
  return buildingDetail(q, b, buildingStyle(side, block, b.z), buildingExtras(side, block));
}

vec2 mapBuildings(vec3 p) {
  float ax = abs(p.x);
  float street = BUILD_X - FRONT_REACH;
  if (ax < street - 0.5) return vec2(street - ax, MAT_BUILDING);
  float side = sign(p.x);
  float block = floor(p.z / BLOCK);
  vec2 res = buildingDistance(p, ax, side, block);
  vec2 previous = buildingDistance(p, ax, side, block - 1.0);
  vec2 next = buildingDistance(p, ax, side, block + 1.0);
  if (previous.x < res.x) res = previous;
  if (next.x < res.x) res = next;
  // Buildings two or more blocks away are at least this far, so empty lots don't slow rays down
  res.x = min(res.x, BLOCK * 1.5 - abs(p.z - (block + 0.5) * BLOCK));
  res.x = max(res.x, p.y - MAX_HEIGHT);
  return res;
}

// ─── Street furniture and traffic ────────────────────────────────────────────

vec2 mapLamps(vec3 p) {
  float lz = p.z - floor(p.z / LAMP_SPACING + 0.5) * LAMP_SPACING;
  vec3 q = vec3(abs(p.x) - LAMP_X, p.y, lz);
  // The box around the nearest lamp lets rays down the road skip the gaps between lamps
  float bound = sdBox(q - vec3(-LAMP_REACH * 0.5 + 0.1, LAMP_H * 0.5 + 0.2, 0.0), vec3(LAMP_REACH * 0.5 + 0.6, LAMP_H * 0.5 + 0.4, 0.5));
  if (bound > 0.5) return vec2(bound, MAT_POLE);
  float pole = sdCapsule(q, vec3(0.0), vec3(0.0, LAMP_H, 0.0), 0.13);
  pole = min(pole, sdCapsule(q, vec3(0.0, LAMP_H, 0.0), vec3(-LAMP_REACH, LAMP_H + 0.25, 0.0), 0.07));
  pole = min(pole, sdCapsule(q, vec3(0.0), vec3(0.0, 0.5, 0.0), 0.22));
  float head = sdRoundBox(q - vec3(-LAMP_REACH, LAMP_H + 0.15, 0.0), vec3(0.6, 0.14, 0.3), 0.06);
  return pole < head ? vec2(pole, MAT_POLE) : vec2(head, MAT_LAMP);
}

const float WHEEL_RADIUS = 0.33;

// A car in its own frame: +z forward, y up from the road
float carShape(vec3 q, float len) {
  float body = sdRoundBox(q - vec3(0.0, 0.6, 0.0), vec3(0.92, 0.3, len), 0.18);
  float cabin = sdRoundBox(q - vec3(0.0, 1.1, -0.15 * len), vec3(0.78 - 0.12 * max(q.y - 0.9, 0.0), 0.26, len * 0.5), 0.22);
  vec3 w = vec3(abs(q.x) - 0.8, q.y - WHEEL_RADIUS, abs(q.z) - 0.62 * len);
  float wheels = max(length(w.yz) - WHEEL_RADIUS, abs(w.x) - 0.14);
  return min(smin(body, cabin, 0.12), wheels);
}

float wheelMask(vec3 q, float len) {
  return step(length(vec2(q.y - WHEEL_RADIUS, abs(q.z) - 0.62 * len)), WHEEL_RADIUS + 0.02) * step(0.62, abs(q.x));
}

vec2 mapCars(vec3 p) {
  float bound = max(abs(p.x) - ROAD_HALF, p.y - 1.8);
  if (bound > 0.5) return vec2(bound, 0.0);
  vec2 res = vec2(1e3, 0.0);
  for (int i = 0; i < CAR_COUNT; i++) {
    vec4 body = cars[i].body;
    float len = 2.2 * cars[i].look.y;
    vec3 q = p - vec3(body.x, 0.0, body.y);
    float far = max(abs(q.z) - len - 0.2, abs(q.x) - 1.2);
    if (far > 0.4) {
      res.x = min(res.x, far);
      continue;
    }
    q.z *= facing(body);
    float d = carShape(q, len);
    if (d < res.x) res = vec2(d, MAT_CAR + float(i));
  }
  return res;
}

vec2 map(vec3 p) {
  vec2 res = mapBuildings(p);
  vec2 lamps = mapLamps(p);
  if (lamps.x < res.x) res = lamps;
  vec2 traffic = mapCars(p);
  if (traffic.x < res.x) res = traffic;
  return res;
}

// Returns (distance, material), with material 0 when nothing is hit before tMax
vec2 march(vec3 ro, vec3 rd, float tMax, int steps) {
  float t = 0.05;
  vec2 h = vec2(1e3, 0.0);
  for (int i = 0; i < steps; i++) {
    vec3 p = ro + rd * t;
    // Rays climbing above every rooftop never come back down
    if (p.y > MAX_HEIGHT && rd.y >= 0.0) return vec2(tMax, 0.0);
    h = map(p);
    if (h.x < 0.0015 * t) return vec2(t, h.y);
    t += h.x;
    if (t > tMax) return vec2(tMax, 0.0);
  }
  // Out of steps, which happens grazing along a facade: count it as a hit rather than a hole
  return h.x < 0.003 * t ? vec2(t, h.y) : vec2(tMax, 0.0);
}

vec3 normalAt(vec3 p) {
  const vec2 k = vec2(1.0, -1.0) * 0.0015;
  return normalize(k.xyy * map(p + k.xyy).x + k.yyx * map(p + k.yyx).x + k.yxy * map(p + k.yxy).x + k.xxx * map(p + k.xxx).x);
}

float softShadow(vec3 ro, vec3 rd, float tMax) {
  float res = 1.0;
  float t = 0.08;
  for (int i = 0; i < SHADOW_STEPS; i++) {
    float h = map(ro + rd * t).x;
    res = min(res, 8.0 * h / t);
    t += clamp(h, 0.08, 1.2);
    if (res < 0.02 || t > tMax) break;
  }
  return clamp(res, 0.0, 1.0);
}

float ambientOcclusion(vec3 p, vec3 n) {
  float occlusion = 0.0;
  float weight = 1.0;
  for (int i = 1; i <= 4; i++) {
    float h = 0.18 * float(i);
    occlusion += weight * (h - map(p + n * h).x);
    weight *= 0.6;
  }
  return clamp(1.0 - occlusion * 1.4, 0.0, 1.0);
}

// ─── Lights ──────────────────────────────────────────────────────────────────

vec3 lampColor(float id) {
  return mod(id, 2.0) < 1.0 ? SODIUM : neon;
}

vec3 lampPosition(float id, float side) {
  return vec3(side * (LAMP_X - LAMP_REACH), LAMP_H - 0.05, id * LAMP_SPACING);
}

// The three nearest lamps on each side; the closest pair casts soft shadows on primary hits
vec3 lampLight(vec3 pos, vec3 n, vec3 v, float shininess, float specular, bool shadows) {
  vec3 total = vec3(0.0);
  float nearest = floor(pos.z / LAMP_SPACING + 0.5);
  for (int k = -1; k <= 1; k++) {
    float id = nearest + float(k);
    for (float side = -1.0; side <= 1.0; side += 2.0) {
      vec3 l = lampPosition(id, side) - pos;
      float d2 = dot(l, l);
      l *= inversesqrt(d2);
      float cone = smoothstep(0.15, 0.75, l.y);
      float diffuse = max(dot(n, l), 0.0);
      float spec = pow(max(dot(n, normalize(l + v)), 0.0), shininess) * specular;
      float shadow = shadows && k == 0 && cone * diffuse > 0.0 ? softShadow(pos + n * 0.05, l, sqrt(d2) - 0.9) : 1.0;
      total += lampColor(id) * 55.0 / (d2 + 6.0) * cone * (diffuse + spec) * shadow;
    }
  }
  return total;
}

// Headlights throw a cone ahead of each car; tail and brake lights glow red behind it
vec3 carLight(vec3 pos, vec3 n) {
  vec3 total = vec3(0.0);
  for (int i = 0; i < CAR_COUNT; i++) {
    vec4 body = cars[i].body;
    float dir = facing(body);
    float len = 2.2 * cars[i].look.y;
    vec3 front = vec3(body.x, 0.65, body.y + dir * len);
    vec3 l = front - pos;
    float d2 = dot(l, l);
    if (d2 > 2500.0) continue;
    l *= inversesqrt(d2);
    float beam = smoothstep(0.8, 0.97, -l.z * dir);
    total += HEADLIGHT * 70.0 * beam / (d2 + 3.0) * max(dot(n, l), 0.0);
    vec3 back = vec3(body.x, 0.7, body.y - dir * len) - pos;
    total += TAILLIGHT * (1.0 + 4.0 * body.w) * 2.0 / (dot(back, back) + 1.5) * max(dot(n, normalize(back)), 0.0);
  }
  return total;
}

// ─── Sky ─────────────────────────────────────────────────────────────────────

const vec3 SUN_DIR = normalize(vec3(0.0, 0.12, 1.0));   // x = 0: dead on the street's vanishing point

// The sky without anything in it: the gradient, the glow around the sun and along the horizon.
// Fog fades everything toward this, so distant buildings melt into the sky behind them
vec3 skyBase(vec3 rd) {
  float el = rd.y;
  vec3 col = mix(haze, night, smoothstep(-0.02, 0.3, el));
  float sd = length(rd - SUN_DIR) / 0.16;
  col += mix(neon, SUN_TOP, 0.35) * exp(-max(sd - 1.0, 0.0) * 3.0) * 0.5;
  col += mix(neon, SUN_TOP, 0.3) * exp(-abs(el) * 40.0) * 0.25;
  return col;
}

float fogAmount(float dist) {
  // Fully fogged by FAR, so nothing pops in where the march gives up
  return max(1.0 - exp(-dist * FOG_DENSITY), smoothstep(FAR * 0.55, FAR, dist));
}

vec3 sky(vec3 rd) {
  float el = rd.y;
  float az = atan(rd.x, rd.z);
  vec3 base = skyBase(rd);
  vec3 col = base;

  // Stars
  vec2 sc = vec2(az * 140.0, el * 140.0);
  ivec2 cell = ivec2(floor(sc));
  float sh = hash(cell);
  if (sh > 0.975 && el > 0.05) {
    vec2 sp = vec2(cell) + 0.5 + (vec2(hash(cell + 7), hash(cell + 13)) - 0.5) * 0.6;
    float twinkle = 0.6 + 0.4 * sin(iTime * (1.5 + 3.0 * sh) + sh * 60.0);
    col += vec3(0.8, 0.8, 1.0) * exp(-dot(sc - sp, sc - sp) * 12.0) * twinkle * smoothstep(0.05, 0.25, el) * 0.6;
  }

  // The sun, sinking at the end of the boulevard, its lower half cut into drifting bands
  vec3 sunRight = normalize(cross(vec3(0.0, 1.0, 0.0), SUN_DIR));
  vec3 sunUp = cross(SUN_DIR, sunRight);
  vec2 s = vec2(dot(rd, sunRight), dot(rd, sunUp)) / 0.16;
  float sd = length(s);
  vec3 sunCol = mix(neon, SUN_TOP, smoothstep(-0.8, 0.7, s.y)) * 1.2;
  float bands = fract(s.y * 7.0 + iTime * 0.35);
  float cutHalf = clamp((0.55 - s.y) * 0.2, 0.0, 0.35);
  float cut = (1.0 - smoothstep(cutHalf - 0.02, cutHalf + 0.02, abs(bands - 0.5))) * step(0.01, cutHalf);
  col = mix(col, sunCol, smoothstep(1.0, 0.985, sd) * (1.0 - cut) * step(0.0, dot(rd, SUN_DIR)));

  // Below the horizon is ground past FAR, which the fog has already swallowed
  if (el < 0.0) return base;

  // Wireframe mountains, and distant towers with scattered lit windows. Both lie beyond FAR, so
  // they sit deeper in the haze than anything the march finds
  float ridge = 0.012 + 0.06 * fbm(vec2(az * 3.0, 1.7)) * smoothstep(0.0, 0.6, abs(az) + 0.15);
  if (el < ridge) {
    vec3 mountain = mix(night, haze, 0.35) * 0.8;
    mountain += accent * (1.0 - smoothstep(0.0, 0.0025, abs(fract(el * 120.0 + 0.5) - 0.5) / 120.0)) * 0.12;
    mountain += accent * exp(-(ridge - el) * 600.0) * 0.8;
    col = mix(mountain, base, 0.75);
  } else {
    col += accent * exp(-(el - ridge) * 400.0) * 0.08;
  }

  float towerCell = floor(az * 60.0);
  float towerH = 0.008 + 0.05 * pow(hash(ivec2(int(towerCell), 99)), 2.5);
  if (el < towerH && hash(ivec2(int(towerCell), 98)) > 0.35) {
    vec3 tower = night * 0.8;
    ivec2 win = ivec2(floor(vec2(az * 900.0, el * 700.0)));
    tower += vec3(1.0, 0.7, 0.4) * step(0.82, hash(win)) * step(0.4, fract(az * 900.0)) * 0.5;
    tower += neon * exp(-(towerH - el) * 2500.0) * 0.6;
    col = mix(tower, base, 0.8);
  }
  return col;
}

// ─── Glass and interiors ─────────────────────────────────────────────────────

// A cheap look at whatever a window mirrors: no normals, no lighting, just what it glows like
vec3 shadeDistant(vec3 p, float mat) {
  if (mat >= MAT_CAR || mat == MAT_POLE || mat == MAT_ROOFTOP || mat == MAT_TRIM) return vec3(0.02);
  if (mat == MAT_LAMP) return lampColor(floor(p.z / LAMP_SPACING + 0.5)) * 8.0;
  float side = p.x < 0.0 ? -1.0 : 1.0;
  float block = floor(p.z / BLOCK);
  int bk = int(block);
  int salt = sideSalt(side);
  vec3 signColor = neonPalette(hash(ivec2(bk, salt + 13)));
  if (mat == MAT_SIGN) return signColor * 1.5;
  if (mat == MAT_AWNING) return signColor * 0.05;
  if (p.y < GROUND_H) return p.y > 3.35 ? signColor * 0.8 : vec3(0.45, 0.4, 0.35) * 0.35;
  vec4 b = building(side, block);
  vec4 st = buildingStyle(side, block, b.z);
  float lz = p.z - (block + 0.5) * BLOCK;
  float bayW = 2.0 * b.w / max(1.0, floor(2.0 * b.w / st.z));
  vec2 cell = vec2((lz + b.w) / bayW, (p.y - GROUND_H) / st.w);
  vec2 f = fract(cell);
  float window = step(0.2, f.x) * step(f.x, 0.8) * step(0.3, f.y) * step(f.y, 0.85);
  float lit = step(hash(ivec2(floor(cell)) + ivec2(bk * 7, salt)), 0.45);
  return vec3(0.015, 0.014, 0.016) + vec3(1.0, 0.7, 0.4) * window * lit * 0.5;
}

// What a window or shop front mirrors: a third march, out across the street
vec3 glassReflection(vec3 ro, vec3 rr, float travelled) {
  float tGround = rr.y < 0.0 ? -ro.y / rr.y : 1e9;
  vec2 h = march(ro, rr, min(GLASS_FAR, tGround), GLASS_STEPS);
  vec3 col;
  if (h.y > 0.0) col = shadeDistant(ro + rr * h.x, h.y);
  else if (tGround < GLASS_FAR) col = vec3(0.012, 0.011, 0.016);
  else return sky(rr);
  return mix(col, skyBase(rr), fogAmount(travelled + min(h.x, tGround)));
}

// Where a ray entering a box room at o (across, up, 0) along d (across, up, in) meets the far
// side, and which surface that is: 0 back wall, 1 side wall, 2 floor, 3 ceiling
vec4 roomHit(vec3 o, vec3 d, vec3 size) {
  float tx = d.x > 1e-4 ? (size.x - o.x) / d.x : (d.x < -1e-4 ? -o.x / d.x : 1e9);
  float ty = d.y > 1e-4 ? (size.y - o.y) / d.y : (d.y < -1e-4 ? -o.y / d.y : 1e9);
  float tz = size.z / max(d.z, 1e-4);
  float t = min(tx, min(ty, tz));
  float surface = t == tz ? 0.0 : (t == tx ? 1.0 : (d.y > 0.0 ? 3.0 : 2.0));
  return vec4(o + d * t, surface);
}

// Blocky neon lettering: each character is a random 3x5 bitmap with square strokes. Characters
// too small to resolve fade to their average brightness instead of sparkling
float glyph(vec2 uv, int id, float blur) {
  vec2 g = (uv - vec2(0.15, 0.1)) / vec2(0.7, 0.8) * vec2(3.0, 5.0);
  float average = 0.3 * step(0.0, min(g.x, g.y)) * step(g.x, 3.0) * step(g.y, 5.0);
  if (g.x < 0.0 || g.y < 0.0 || g.x >= 3.0 || g.y >= 5.0) return 0.0;
  ivec2 px = ivec2(floor(g));
  float on = step(0.45, hash(ivec2(id * 15 + px.x + px.y * 3, 4242)));
  vec2 f = abs(fract(g) - 0.5);
  float stroke = on * (1.0 - smoothstep(0.42 - blur, 0.42 + blur, max(f.x, f.y)));
  return mix(stroke, average, clamp(blur * 2.0 - 0.3, 0.0, 1.0));
}

// The room behind a window, one bay wide and one floor high: painted walls, floorboards, a
// ceiling lamp, maybe a flickering TV, a bookshelf or a picture, furniture, and a plant on the
// sill. ab is where the view enters across and up the bay, d the view ray in the same frame
vec3 roomInterior(vec2 ab, vec3 d, vec2 size, float sill, ivec2 id, float occupancy, float lod, out vec3 roomLight) {
  float h0 = hash(id);
  float h1 = hash(id + ivec2(11, 3));
  float h2 = hash(id + ivec2(5, 19));
  float h3 = hash(id + ivec2(23, 7));
  float h4 = hash(id + ivec2(13, 29));
  // Now and then somebody switches a light on or off
  float epoch = floor(iTime / 23.0 + h1 * 7.0);
  bool on = (h0 < occupancy) != (hash(id + ivec2(int(epoch) * 13, 91)) > 0.94);
  vec3 lamp = h1 < 0.5 ? vec3(1.0, 0.6, 0.3) : (h1 < 0.8 ? vec3(1.0, 0.82, 0.65) : (h1 < 0.93 ? vec3(0.65, 0.8, 1.0) : neonPalette(h2)));
  bool hasTv = h2 < 0.35;
  vec3 tv = mix(vec3(0.2, 0.4, 1.0), vec3(0.85, 0.85, 1.0), hash(id + ivec2(int(iTime * 3.0), 7)))
    * (0.6 + 0.4 * hash(id + ivec2(int(iTime * 8.0), 3)));
  roomLight = (on ? lamp * 0.8 : vec3(0.0)) + (hasTv ? tv * 0.12 : vec3(0.0)) + vec3(0.003, 0.003, 0.006);
  vec3 average = roomLight * 0.3 + (hasTv ? tv * 0.05 : vec3(0.0));
  if (lod >= 1.0) return average;

  vec3 o = vec3(ab, 0.0);
  vec4 hit = roomHit(o, d, vec3(size, ROOM_DEPTH));
  vec3 p = hit.xyz;
  vec3 wall = mix(vec3(0.45), 0.5 + 0.5 * cos(6.2832 * (h3 + vec3(0.0, 0.12, 0.25))), 0.4) * 0.5;
  vec3 albedo = wall;
  vec3 emit = vec3(0.0);
  if (hit.w == 0.0) {
    vec2 tvBox = abs(p.xy - vec2(size.x * (0.3 + 0.4 * h0), 1.1)) - vec2(min(0.55, size.x * 0.3), 0.33);
    float tvEdge = max(tvBox.x, tvBox.y);
    if (hasTv && tvEdge < 0.0) {
      albedo = vec3(0.01);
      emit = tv * 2.0;
    } else if (hasTv && tvEdge < 0.04) {
      albedo = vec3(0.01);
    } else if (!hasTv && h0 > 0.55) {
      // A bookshelf: rows of coloured spines on dark boards
      if (p.y > 0.2 && p.y < 2.1 && abs(p.x - size.x * 0.5) < size.x * 0.3) {
        ivec2 spine = ivec2(floor(vec2(p.x / 0.09, p.y / 0.38)));
        albedo = (0.4 + 0.6 * vec3(hash(spine + id), hash(spine + id + 3), hash(spine + id + 9))) * 0.35;
        albedo *= step(0.12, fract(p.y / 0.38));
      }
    } else if (h0 > 0.3) {
      vec2 frame = abs(p.xy - vec2(size.x * 0.5, 1.6)) - vec2(0.35, 0.25);
      if (max(frame.x, frame.y) < 0.0) albedo = (0.5 + 0.5 * cos(6.2832 * (h2 + vec3(0.0, 0.33, 0.67)))) * 0.4;
    }
  } else if (hit.w == 1.0) {
    albedo = wall * 0.85;
  } else if (hit.w == 2.0) {
    albedo = vec3(0.2, 0.12, 0.07) * (0.8 + 0.2 * step(0.5, fract(p.z * 3.0)));
  } else {
    albedo = wall * 1.1;
    vec2 fromLamp = p.xz - vec2(size.x * 0.5, ROOM_DEPTH * 0.45);
    if (on) emit = lamp * 2.5 * exp(-dot(fromLamp, fromLamp) * 6.0);
  }
  // Light falls off toward the back of the room
  vec3 col = albedo * roomLight * (1.2 - 0.5 * p.z / ROOM_DEPTH) + emit;

  // A sofa or desk across the middle of the room
  const float FURNITURE_Z = 2.3;
  if (h3 > 0.35 && FURNITURE_Z < p.z) {
    vec2 f = ab + d.xy * (FURNITURE_Z / d.z);
    if (f.y < 0.85 && abs(f.x - size.x * 0.5) < size.x * 0.35) {
      col = (0.5 + 0.5 * cos(6.2832 * (h3 + vec3(0.5, 0.6, 0.7)))) * 0.15 * roomLight * (0.6 + 0.6 * step(0.7, f.y));
    }
  }

  // A pot plant on the sill, silhouetted against the room
  const float PLANT_Z = 0.35;
  if (h4 < 0.4) {
    vec2 q = ab + d.xy * (PLANT_Z / d.z) - vec2(size.x * (0.25 + 0.5 * h3), sill);
    float pot = step(0.0, q.y) * step(q.y, 0.3) * step(abs(q.x), 0.09 + 0.05 * q.y / 0.3);
    float leaves = 0.0;
    for (int i = 0; i < 5; i++) {
      vec2 c = vec2((hash(id + ivec2(i, 40)) - 0.5) * 0.36, 0.42 + 0.4 * hash(id + ivec2(i, 41)));
      float r = 0.1 + 0.08 * hash(id + ivec2(i, 42));
      leaves = max(leaves, step(length((q - c) * vec2(1.0, 0.75)), r));
    }
    if (pot > 0.0) col = vec3(0.4, 0.15, 0.06) * (roomLight * 0.25 + 0.003);
    else if (leaves > 0.0) col = vec3(0.04, 0.16, 0.05) * (roomLight * 0.3 + 0.003);
  }
  return mix(col, average, lod);
}

// A shop or bar behind the storefront: shelves of goods (or bottles), tiled floor,
// fluorescent tubes (or warm pendants), and a counter
vec3 shopInterior(vec2 ab, vec3 d, vec2 size, ivec2 id, bool bar, float lod, out vec3 roomLight) {
  vec3 lamp = bar ? vec3(1.0, 0.35, 0.18) : vec3(0.8, 0.92, 1.0);
  roomLight = lamp * (bar ? 0.9 : 1.5);
  vec3 average = roomLight * 0.35;
  if (lod >= 1.0) return average;

  vec4 hit = roomHit(vec3(ab, 0.0), d, vec3(size, SHOP_DEPTH));
  vec3 p = hit.xyz;
  vec3 albedo = bar ? vec3(0.25, 0.06, 0.05) : vec3(0.5);
  vec3 emit = vec3(0.0);
  if (hit.w < 1.5) {
    float u = hit.w == 0.0 ? p.x : p.z;
    vec2 s = vec2(u / 0.16, p.y / (bar ? 0.35 : 0.42));
    ivec2 c = ivec2(floor(s));
    if (p.y > 0.3 && p.y < 2.3) {
      vec3 goods = 0.5 + 0.5 * cos(6.2832 * (hash(c + id) + vec3(0.0, 0.33, 0.67)));
      float item = step(0.15, fract(s.y)) * step(0.15, fract(s.x)) * step(0.3, hash(c + id + 5));
      albedo = mix(albedo * 0.4, goods * (bar ? 0.6 : 0.8), item);
      if (bar) emit += goods * item * 0.4;
    }
  } else if (hit.w == 2.0) {
    vec2 tile = floor(p.xz / 0.5);
    albedo = vec3(0.35) * (0.6 + 0.4 * mod(tile.x + tile.y, 2.0));
  } else {
    albedo = vec3(0.3);
    if (bar) emit = lamp * 3.0 * step(length(fract(p.xz / 1.2) - 0.5), 0.1);
    else emit = lamp * 3.0 * (1.0 - smoothstep(0.03, 0.06, abs(fract(p.x / 1.4) - 0.5) * 1.4));
  }
  vec3 col = albedo * roomLight * (1.1 - 0.5 * p.z / SHOP_DEPTH) + emit;

  const float COUNTER_Z = 2.0;
  if (COUNTER_Z < p.z) {
    vec2 c = ab + d.xy * (COUNTER_Z / d.z);
    if (c.y < 1.05 && c.x > size.x * 0.15 && c.x < size.x * 0.7) {
      col = (bar ? vec3(0.15, 0.06, 0.03) : vec3(0.2)) * roomLight * (c.y > 0.97 ? 1.0 : 0.4);
    }
  }
  return mix(col, average, lod);
}

// ─── Materials ───────────────────────────────────────────────────────────────

vec3 wallColor(int style, float seed) {
  if (style == STYLE_CONCRETE) return vec3(0.11, 0.105, 0.1);
  if (style == STYLE_SETBACK) return vec3(0.06, 0.058, 0.064);
  if (style == STYLE_GLASS) return vec3(0.03, 0.038, 0.05);
  if (style == STYLE_RESIDENTIAL) return mix(vec3(0.3), 0.5 + 0.5 * cos(6.2832 * (seed + vec3(0.0, 0.15, 0.3))), 0.4) * 0.35;
  return vec3(0.13, 0.05, 0.035);
}

float fresnelOf(vec3 n, vec3 v) {
  return 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
}

vec3 shadeBuilding(vec3 pos, vec3 n, vec3 rd, float mat, float dist, bool primary) {
  vec3 v = -rd;
  vec3 ambient = mix(haze, night, 0.5) * 0.25;
  float side = pos.x < 0.0 ? -1.0 : 1.0;
  float block = floor(pos.z / BLOCK);
  vec4 b = building(side, block);
  vec4 st = buildingStyle(side, block, b.z);
  vec4 ex = buildingExtras(side, block);
  int style = int(st.x);
  int bk = int(block);
  int salt = sideSalt(side);
  int bid = bk * 2 + (side > 0.0 ? 1 : 0);
  float f = abs(pos.x) - b.x;
  float lz = pos.z - (block + 0.5) * BLOCK;
  float y = pos.y;
  // How much facade one pixel covers, for antialiasing and level of detail
  float fw = dist * pixelAngle / max(abs(dot(n, v)), 0.25);
  vec3 signColor = neonPalette(hash(ivec2(bk, salt + 13)));

  if (mat == MAT_SIGN) {
    vec2 s = vec2(f + 0.75, y - SIGN_Y);
    float flicker = step(0.03, hash(ivec2(int(iTime * 12.0), bid)));
    if (abs(n.z) > 0.5) {
      // A column of characters inside a neon frame
      float edge = min(0.75 - abs(s.x), SIGN_HALF - abs(s.y));
      float tube = 1.0 - smoothstep(0.025, 0.025 + fw, abs(edge - 0.1));
      vec2 cell = vec2(s.x + 0.5, (s.y + SIGN_HALF - 0.25) / 0.85);
      float letters = 0.0;
      if (cell.x > 0.0 && cell.x < 1.0 && cell.y > 0.0 && cell.y < 5.0) {
        letters = glyph(fract(cell), bid * 7 + int(cell.y), fw / 0.23);
      }
      return vec3(0.012, 0.01, 0.015) + signColor * ((letters + tube) * 3.0 * flicker + 0.12);
    }
    return vec3(0.02) * (ambient + lampLight(pos, n, v, 20.0, 0.5, false)) + signColor * 0.25;
  }

  if (mat == MAT_AWNING) {
    vec3 cloth = mix(neonPalette(hash(ivec2(bk, salt + 14))) * 0.25, vec3(0.25), step(0.5, fract(lz / 0.7)) * 0.8);
    // The underside glows with the shop window below it
    if (n.y < -0.3) return cloth * vec3(1.0, 0.8, 0.6) * 0.6;
    return cloth * (ambient + lampLight(pos, n, v, 10.0, 0.3, false));
  }

  if (mat == MAT_ROOFTOP) {
    vec3 col = vec3(0.035, 0.035, 0.04) * (0.7 + 0.5 * noise(vec2(lz, y) * 6.0));
    col *= 0.8 + 0.2 * step(0.5, fract((abs(n.x) > 0.5 ? lz : pos.x) * 2.5));
    col *= ambient + lampLight(pos, n, v, 30.0, 0.5, false);
    // Aircraft warning light on top of the antenna
    if (y > b.z + 6.0) col += vec3(1.0, 0.05, 0.02) * 6.0 * step(0.0, sin(iTime * 3.0 + float(bid)));
    return col;
  }

  if (mat == MAT_TRIM) {
    bool metal = style == STYLE_GLASS;
    vec3 albedo = (metal ? vec3(0.04, 0.045, 0.055) : vec3(0.16, 0.15, 0.14)) * (0.75 + 0.5 * noise(vec2(lz + pos.x, y) * 8.0));
    return albedo * (ambient + lampLight(pos, n, v, metal ? 60.0 : 10.0, metal ? 1.0 : 0.1, false));
  }

  // Roofs: dark gravel
  if (n.y > 0.5) {
    vec3 gravel = vec3(0.04, 0.038, 0.04) * (0.6 + 0.6 * noise(pos.xz * 5.0));
    return gravel * (ambient + lampLight(pos, n, v, 8.0, 0.05, false));
  }

  // The face being shaded: which way is into the building, which way is across the facade,
  // and how wide the facade is (a setback tower's upper faces are smaller)
  float h1 = tierHeight(b.z);
  bool upper = style == STYLE_SETBACK && y >= h1 - 0.01;
  float topH = style == STYLE_SETBACK && !upper ? h1 : b.z;
  bool xFace = abs(n.x) > abs(n.z);
  bool streetFace = xFace && n.x * side < 0.0;
  vec3 into = xFace ? vec3(-sign(n.x), 0.0, 0.0) : vec3(0.0, 0.0, -sign(n.z));
  vec3 across = xFace ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
  float fCentre = upper ? TIER_RECESS + (b.y - TIER_RECESS) * 0.5 : b.y * 0.5;
  float u = xFace ? lz : side * (f - fCentre);
  float faceWidth = xFace ? 2.0 * b.w * (upper ? TIER_LENGTH : 1.0) : (upper ? b.y - TIER_RECESS : b.y);
  vec2 uv = vec2(u, y);
  vec3 viewIn = vec3(dot(rd, across), rd.y, dot(rd, into));

  // Concrete, render or brick: grain, speckle, blotches and rain grime running down the wall
  vec3 base = wallColor(style, ex.w);
  float detail = 1.0 - smoothstep(0.01, 0.05, fw);
  float grain = noise(uv * 9.0);
  vec3 albedo = base * (0.72 + 0.35 * grain + 0.3 * (hash(ivec2(floor(uv * 45.0))) - 0.5) * detail);
  albedo *= 0.75 + 0.5 * fbm(uv * 0.35 + ex.w * 20.0);
  albedo *= 1.0 - 0.35 * smoothstep(0.55, 0.85, noise(vec2(u * 3.0, y * 0.07 + ex.w * 9.0)));
  if (style == STYLE_BRICK) {
    float course = floor(y / 0.1);
    float mortar = max(
      1.0 - smoothstep(0.0, 0.12 + fw / 0.1, fract(y / 0.1)),
      1.0 - smoothstep(0.0, 0.05 + fw / 0.25, fract(u / 0.25 + 0.5 * mod(course, 2.0))));
    albedo = mix(albedo, vec3(0.09, 0.085, 0.08), mortar * 0.7 * (1.0 - smoothstep(0.02, 0.06, fw)));
  }
  vec2 bump = vec2(noise(uv * 9.0 + vec2(0.06, 0.0)), noise(uv * 9.0 + vec2(0.0, 0.06))) - grain;
  vec3 bumped = normalize(n + (across * bump.x + vec3(0.0, bump.y, 0.0)) * 2.0 * detail);
  vec3 wallLight = ambient + lampLight(pos, bumped, v, 12.0, 0.08, false);

  // Parapet, with neon along some rooflines
  if (y > topH - 1.0) {
    vec3 wall = albedo * wallLight;
    if (y > topH - 0.3 && ex.w > 0.45) wall += neonPalette(fract(ex.w * 7.0)) * 2.5;
    return wall;
  }

  vec3 frameColor = vec3(0.02, 0.02, 0.025) * wallLight * 3.0;

  // Ground floor: shops behind the street facade, plain wall elsewhere
  if (y < GROUND_H) {
    if (!streetFace) return albedo * wallLight * 0.8;
    float units = max(1.0, floor(2.0 * b.w / 5.5 + 0.5));
    float uw = 2.0 * b.w / units;
    float unit = clamp(floor((lz + b.w) / uw), 0.0, units - 1.0);
    float su = lz + b.w - unit * uw;
    int unitId = bid * 17 + int(unit);
    float kind = hash(ivec2(unitId, 61));
    vec3 bannerColor = neonPalette(hash(ivec2(unitId, 62)));
    if (min(su, uw - su) < 0.35 || y < 0.3 || y > 4.3) return albedo * wallLight;

    if (y > 3.35) {
      // The banner: a dark fascia with a line of neon characters, a few of them on the blink
      float chars = max(1.0, floor((uw - 1.4) / 0.55));
      float x = (su - (uw - chars * 0.55) * 0.5) / 0.55;
      float letters = 0.0;
      if (x > 0.0 && x < chars) {
        int ci = int(floor(x));
        float broken = step(0.92, hash(ivec2(unitId, ci))) * step(0.5, hash(ivec2(unitId * 3 + ci, int(iTime * 6.0))));
        letters = glyph(vec2(fract(x), (y - 3.35) / 0.95), unitId * 13 + ci, fw / 0.13) * (1.0 - broken);
      }
      return frameColor + bannerColor * (letters * 3.5 + 0.1) * step(0.12, kind);
    }
    if (y > 3.1) return frameColor;

    if (kind > 0.78) {
      // Closed: a corrugated rolling shutter with tags sprayed on it
      float rib = mix(0.5, 0.5 + 0.5 * sin(y * 6.2832 / 0.09), 1.0 - smoothstep(0.01, 0.04, fw));
      vec3 steel = vec3(0.1, 0.11, 0.12) * (0.7 + 0.5 * rib) * (0.8 + 0.4 * noise(vec2(su, y) * 3.0));
      float tag = smoothstep(0.55, 0.6, fbm(vec2(su * 0.8, y * 1.2) + float(unitId)));
      steel = mix(steel, neonPalette(hash(ivec2(unitId, 63))) * 0.3, tag);
      return steel * wallLight;
    }

    // Open: storefront glass with the shop behind it and a door at one end
    float doorX = uw - 1.55;
    float frame = 1.0 - smoothstep(0.03, 0.03 + fw, min(abs(su - doorX), min(abs(y - 0.3), abs(y - 3.1))));
    if (su > doorX && abs(y - 2.4) < 0.04) frame = 1.0;
    vec3 roomLight;
    vec3 inside = shopInterior(vec2(su - 0.35, y - 0.3), viewIn, vec2(uw - 0.7, 2.8), ivec2(unitId, 64), kind > 0.55, smoothstep(0.05, 0.2, fw), roomLight);
    float fresnel = fresnelOf(n, v);
    vec3 rr = reflect(rd, n);
    vec3 mirrored = primary && fw < 0.15 ? glassReflection(pos + n * 0.03, rr, dist) : skyBase(rr);
    vec3 glass = inside * 0.9 * (1.0 - fresnel) + mirrored * fresnel;
    if (hash(ivec2(unitId, 65)) > 0.6) {
      float outline = min(min(su - 0.35, uw - 0.35 - su), min(y - 0.3, 3.1 - y));
      glass += bannerColor * 2.5 * (1.0 - smoothstep(0.025, 0.025 + fw, abs(outline - 0.08)));
    }
    return mix(glass, frameColor, frame);
  }

  // Upper floors: a grid of bays and floors, each building with its own window shape
  float bays = max(1.0, floor(faceWidth / st.z));
  float bayW = faceWidth / bays;
  float uu = u + faceWidth * 0.5;
  float bay = clamp(floor(uu / bayW), 0.0, bays - 1.0);
  float a = uu - bay * bayW;
  float fh = st.w;
  float yy = y - GROUND_H;
  float fl = floor(yy / fh);
  float bb = yy - fl * fh;
  int pattern = int(st.y);
  float vary = hash(ivec2(bk, salt + 15));
  vec4 r;   // the window's left, right, bottom and top within the bay
  if (pattern == 0) r = vec4(bayW * (0.2 + 0.1 * vary), bayW * (0.8 - 0.1 * vary), fh * 0.3, fh * (0.82 + 0.06 * vary));
  else if (pattern == 1) r = vec4(0.0, bayW, fh * 0.35, fh * 0.8);
  else if (pattern == 2) r = vec4(bayW * 0.34, bayW * 0.66, fh * 0.08, fh * 0.92);
  else if (pattern == 3) r = a < bayW * 0.5 ? vec4(bayW * 0.08, bayW * 0.45, fh * 0.3, fh * 0.85) : vec4(bayW * 0.55, bayW * 0.92, fh * 0.3, fh * 0.85);
  else r = vec4(0.0, bayW, 0.0, fh * 0.8);

  // Sills, the grime streaking down from them, and the floor slabs
  float underWindow = step(r.x - 0.06, a) * step(a, r.y + 0.06);
  albedo *= 1.0 - 0.3 * underWindow * step(bb, r.z - 0.1) * exp(-(r.z - bb) * 1.2);
  albedo = mix(albedo, base * 1.8, underWindow * step(r.z - 0.1, bb) * step(bb, r.z) * step(0.5, r.z));
  if (pattern != 4) albedo *= 1.0 - 0.3 * (1.0 - smoothstep(0.05, 0.05 + fw, min(bb, fh - bb)));
  vec3 wall = albedo * wallLight;

  float edge = min(min(a - r.x, r.y - a), min(bb - r.z, r.w - bb));
  float inWindow = smoothstep(-fw, fw, edge);
  if (inWindow <= 0.0) return wall;

  // Frames, a mullion down wide windows, a transom across some
  float frame = 1.0 - smoothstep(0.05, 0.05 + fw, edge);
  float width = r.y - r.x;
  if (width > 1.3) frame = max(frame, 1.0 - smoothstep(0.03, 0.03 + fw, abs(fract((a - r.x) / width * 2.0 + 0.5) - 0.5) * width * 0.5));
  if ((pattern == 0 || pattern == 2) && vary > 0.5) frame = max(frame, 1.0 - smoothstep(0.03, 0.03 + fw, abs(bb - r.z - (r.w - r.z) * 0.72)));

  ivec2 roomId = ivec2(int(bay) + (xFace ? (streetFace ? 0 : 1) : (n.z > 0.0 ? 2 : 3)) * 61 + bid * 7, int(fl) + bid * 13);
  float occupancy = 0.25 + 0.5 * hash(ivec2(bk, salt + 16));
  vec3 roomLight;
  vec3 inside = roomInterior(vec2(a, bb), viewIn, vec2(bayW, fh), r.z, roomId, occupancy, smoothstep(0.05, 0.2, fw), roomLight);

  // Blinds or curtains just behind the glass, glowing with the room light
  float drapes = hash(roomId + ivec2(77, 1));
  if (drapes < 0.3) {
    float level = r.z + (r.w - r.z) * (0.2 + 2.0 * drapes);
    if (bb > level) {
      float slat = mix(0.75, smoothstep(0.15, 0.3, fract(bb / 0.07)), 1.0 - smoothstep(0.02, 0.05, fw));
      inside = vec3(0.5, 0.46, 0.4) * (roomLight * 0.45 + 0.004) * slat;
    }
  } else if (drapes < 0.45 && min(a - r.x, r.y - a) < width * 0.2) {
    vec3 cloth = 0.5 + 0.5 * cos(6.2832 * (drapes * 9.0 + vec3(0.0, 0.33, 0.67)));
    inside = cloth * 0.3 * (roomLight * 0.5 + 0.004) * (0.75 + 0.25 * sin(a * 40.0));
  }

  // Reflective glass: curtain walls are tinted and mirror much more of the street
  float fresnel = fresnelOf(n, v);
  float tint = 0.85;
  if (style == STYLE_GLASS) {
    fresnel = mix(0.3, 1.0, fresnel);
    tint = 0.35;
  }
  vec3 rr = reflect(rd, n);
  // Far or edge-on windows cover so much facade per pixel that they only see the blurred sky;
  // mirroring the sun disc there leaves bright slivers floating at the end of the street
  vec3 mirrored = primary && fw < 0.15 ? glassReflection(pos + n * 0.03, rr, dist) : skyBase(rr);
  vec3 glass = inside * tint * (1.0 - fresnel) + mirrored * fresnel + lampLight(pos, n, v, 400.0, 3.0, false) * 0.05;
  return mix(wall, mix(glass, frameColor, frame), inWindow);
}

vec3 shadeObject(vec3 pos, vec3 n, vec3 rd, float mat, float dist, bool primary) {
  vec3 v = -rd;
  vec3 ambient = mix(haze, night, 0.5) * 0.25;

  if (mat >= MAT_CAR) {
    int i = int(mat - MAT_CAR + 0.5);
    vec4 body = cars[i].body;
    float dir = facing(body);
    float len = 2.2 * cars[i].look.y;
    vec3 q = pos - vec3(body.x, 0.0, body.y);
    q.z *= dir;
    float hue = cars[i].look.x;
    vec3 paint = 0.5 + 0.5 * cos(6.2832 * (hue + vec3(0.0, 0.33, 0.67)));
    vec3 albedo = paint * paint * 0.25;
    float glass = step(0.96, q.y) * step(q.y, 1.26);
    albedo = mix(albedo, vec3(0.01), glass);
    float tyre = wheelMask(q, len);
    albedo = mix(albedo, vec3(0.008), tyre);
    glass *= 1.0 - tyre;
    float fresnel = fresnelOf(n, v);
    vec3 col = albedo * (ambient + lampLight(pos, n, v, 60.0, 0.6, false));
    col += sky(reflect(rd, n)) * fresnel * mix(0.6, 1.0, glass) * (1.0 - tyre);
    // Headlights on the nose, a full-width light bar on the tail
    float lightBand = step(0.5, q.y) * step(q.y, 0.78);
    float headlights = step(len - 0.15, q.z) * lightBand * step(0.4, abs(q.x)) * step(abs(q.x), 0.85);
    float taillights = step(q.z, -len + 0.15) * step(0.58, q.y) * step(q.y, 0.72) * step(abs(q.x), 0.88);
    col += HEADLIGHT * headlights * 6.0;
    col += TAILLIGHT * taillights * (2.0 + 6.0 * body.w);
    return col;
  }

  if (mat == MAT_LAMP) {
    vec3 light = lampColor(floor(pos.z / LAMP_SPACING + 0.5));
    return mix(vec3(0.02), light * 12.0, smoothstep(-0.3, -0.8, n.y));
  }

  if (mat == MAT_POLE) {
    vec3 albedo = vec3(0.04, 0.04, 0.05);
    return albedo * (ambient + lampLight(pos, n, v, 30.0, 1.0, false)) + sky(reflect(rd, n)) * 0.04;
  }

  return shadeBuilding(pos, n, rd, mat, dist, primary);
}

// Asphalt, concrete sidewalks and the neon grid, all wet; returns the lit colour and writes the
// surface normal and how strongly it reflects
vec3 shadeGround(vec3 pos, vec3 rd, float dist, out vec3 n, out float reflectivity) {
  vec2 g = pos.xz;
  float ax = abs(pos.x);
  float side = pos.x < 0.0 ? -1.0 : 1.0;
  float block = floor(pos.z / BLOCK);
  vec4 b = building(side, block);
  // The sidewalk runs up to the shop fronts; empty lots show the neon grid
  float walkOuter = b.z > 0.0 ? b.x : BUILD_X;
  float detail = exp(-dist * 0.04);
  float fwX = dist / (iResolution.y * FOCAL);
  float fwZ = fwX / max(-rd.y, 0.02);
  float grain = mix(0.5, noise(g * 24.0), detail);
  float speckle = mix(0.5, hash(ivec2(floor(g * 60.0))), detail * detail);
  float puddle = smoothstep(0.5, 0.62, fbm(g * vec2(0.22, 0.12) + 7.0));
  vec3 albedo;
  vec3 emissive = vec3(0.0);
  float wet;

  if (ax < ROAD_HALF) {
    // Asphalt: aggregate grain, darker oil streaks down the middle of each lane, cracks and patches
    float patches = fbm(g * 0.3);
    albedo = vec3(0.05, 0.05, 0.055) * (0.65 + 0.5 * grain + 0.25 * speckle) * (0.75 + 0.5 * patches);
    float laneMiddle = 1.0 - smoothstep(0.0, 0.45, abs(fract(pos.x / 3.5) - 0.5));
    albedo *= 1.0 - 0.45 * laneMiddle * smoothstep(0.4, 0.7, fbm(g * vec2(1.2, 0.15)));
    float crack = 1.0 - smoothstep(0.0, 0.012 + fwX, abs(fbm(g * 0.55 + 3.0) - 0.5));
    albedo *= 1.0 - 0.6 * crack * detail;

    float wear = smoothstep(0.25, 0.55, fbm(g * 2.0 + 11.0));
    float yellow = 1.0 - smoothstep(0.06, 0.06 + fwX, abs(ax - 0.18));
    float dashes = (1.0 - smoothstep(0.08, 0.08 + fwX, abs(ax - 3.5))) * step(fract(pos.z / 12.0), 0.25);
    float edge = 1.0 - smoothstep(0.1, 0.1 + fwX, abs(ax - 6.7));
    albedo = mix(albedo, vec3(0.6, 0.42, 0.06), yellow * wear);
    albedo = mix(albedo, vec3(0.55), max(dashes, edge) * wear);
    emissive += accent * edge * 0.35;
    wet = mix(0.35, 1.0, puddle);
  } else if (ax < walkOuter) {
    // Concrete slabs with dark seams, cement grain and stains; a pale curb along the road
    vec2 slab = vec2(ax - ROAD_HALF, pos.z) / 1.5;
    vec2 seam = abs(fract(slab) - 0.5) * 1.5;
    float seams = 1.0 - smoothstep(0.7, 0.72, max(seam.x, seam.y));
    albedo = vec3(0.12, 0.115, 0.11) * (0.7 + 0.4 * grain + 0.3 * speckle) * (0.75 + 0.4 * fbm(g * 0.7 + 5.0));
    albedo *= mix(1.0, 0.45, (1.0 - seams) * detail);
    albedo = mix(albedo, vec3(0.2, 0.19, 0.18) * (0.8 + 0.3 * grain), 1.0 - step(ROAD_HALF + 0.3, ax));
    wet = mix(0.25, 0.8, puddle * 0.6);
  } else {
    // The vintage neon grid on dark ground between the buildings
    albedo = vec3(0.012, 0.01, 0.018) * (0.8 + 0.4 * grain);
    vec2 cells = abs(fract(g / 4.0 + 0.5) - 0.5) * 4.0;
    float lines = max(1.0 - smoothstep(0.05, 0.05 + fwX, cells.x), 1.0 - smoothstep(0.05, 0.05 + fwZ, cells.y));
    lines *= clamp(0.1 / fwZ, 0.0, 1.0);
    emissive += neon * lines * 1.6;
    wet = 0.5;
  }

  // Grain and rain ripples bend the surface normal; puddles stay almost mirror flat
  vec2 bump = (vec2(noise(g * 18.0), noise(g * 18.0 + 31.0)) - 0.5) * 0.18 * (1.0 - puddle * 0.8) * detail;
  vec2 rippleCell = floor(g * 1.3);
  vec2 rippleLocal = fract(g * 1.3) - 0.5 - (vec2(hash(ivec2(rippleCell)), hash(ivec2(rippleCell) + 9)) - 0.5) * 0.5;
  float phase = fract(iTime * 1.4 + hash(ivec2(rippleCell) + 3));
  float r = length(rippleLocal);
  float ring = sin((r - phase * 0.5) * 60.0) * smoothstep(0.12, 0.0, abs(r - phase * 0.5)) * (1.0 - phase);
  bump += rippleLocal / max(r, 1e-3) * ring * 0.12 * puddle * detail;
  n = normalize(vec3(bump.x, 1.0, bump.y));

  vec3 v = -rd;
  float occlusion = ambientOcclusion(pos, vec3(0.0, 1.0, 0.0));
  vec3 light = mix(haze, night, 0.5) * 0.12 * occlusion;
  light += lampLight(pos, n, v, mix(20.0, 300.0, wet), wet * 2.0, true);
  light += carLight(pos, n) * occlusion;
  // Shop windows and signs spill light across the sidewalk
  if (b.z > 0.0) {
    float lz = pos.z - (block + 0.5) * BLOCK;
    vec3 spill = vec3(0.9, 0.75, 0.6) * 0.5 + neonPalette(hash(ivec2(int(block), sideSalt(side) + 13))) * 0.4;
    light += spill * exp(-max(b.x - ax, 0.0) * 0.45) * smoothstep(b.w + 1.0, b.w - 1.0, abs(lz)) * 0.8;
  }
  reflectivity = wet;
  return albedo * light + emissive;
}

// ─── Atmosphere ──────────────────────────────────────────────────────────────

// Glowing halos around every lamp ahead, faded by fog and clipped by whatever the ray hit
vec3 lampHalos(vec3 ro, vec3 rd, float dist) {
  vec3 total = vec3(0.0);
  float first = floor(ro.z / LAMP_SPACING);
  for (int k = 0; k < 14; k++) {
    float id = first + float(k);
    for (float side = -1.0; side <= 1.0; side += 2.0) {
      vec3 l = lampPosition(id, side);
      float t = clamp(dot(l - ro, rd), 0.0, dist);
      vec3 d = ro + rd * t - l;
      total += lampColor(id) * exp(-t * FOG_DENSITY * 2.0) * 0.12 / (dot(d, d) + 0.05);
    }
  }
  return total;
}

// Short volumetric march through the rain haze, picking up the light cones under nearby lamps
vec3 lightShafts(vec3 ro, vec3 rd, float dist, float jitter) {
  float range = min(dist, 70.0);
  float stepLength = range / float(FOG_STEPS);
  vec3 total = vec3(0.0);
  for (int i = 0; i < FOG_STEPS; i++) {
    vec3 p = ro + rd * (float(i) + jitter) * stepLength;
    float nearest = floor(p.z / LAMP_SPACING + 0.5);
    for (float side = -1.0; side <= 1.0; side += 2.0) {
      vec3 l = lampPosition(nearest, side) - p;
      float d2 = dot(l, l);
      float cone = smoothstep(0.55, 0.9, l.y * inversesqrt(d2));
      total += lampColor(nearest) * cone * 3.0 / (d2 + 3.0);
    }
  }
  return total * stepLength * 0.02;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  neon = linearColor(iTheme.border.rgb);
  accent = linearColor(iTheme.borderMid.rgb);
  night = linearColor(iTheme.bgBase.rgb);
  haze = linearColor(mix(iTheme.bgElevated.rgb, iTheme.border.rgb, 0.25));
  pixelAngle = 1.0 / (iResolution.y * FOCAL);

  float t = iTime;
  vec3 ro = cameraPosition(t);
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec3 rd = normalize(cameraBasis(t) * vec3(p, FOCAL));

  float tGround = rd.y < 0.0 ? -ro.y / rd.y : FAR;
  vec2 hit = march(ro, rd, min(tGround, FAR), MARCH_STEPS);
  float dist = hit.x;
  vec3 col;

  if (hit.y > 0.0) {
    vec3 pos = ro + rd * dist;
    col = shadeObject(pos, normalAt(pos), rd, hit.y, dist, true);
  } else if (tGround < FAR) {
    dist = tGround;
    vec3 pos = ro + rd * dist;
    vec3 n;
    float wet;
    col = shadeGround(pos, rd, dist, n, wet);
    // The wet street mirrors the city: a second march along the reflected ray
    vec3 rr = reflect(rd, n);
    float amount = fresnelOf(n, -rd) * wet;
    if (amount > 0.01) {
      vec3 ro2 = pos + n * 0.02;
      vec2 mirror = march(ro2, rr, max(FAR - dist, 1.0), REFLECT_STEPS);
      vec3 reflected;
      if (mirror.y > 0.0) {
        vec3 rp = ro2 + rr * mirror.x;
        reflected = shadeObject(rp, normalAt(rp), rr, mirror.y, dist + mirror.x, false);
        reflected = mix(reflected, skyBase(rr), fogAmount(dist + mirror.x));
      } else {
        reflected = sky(rr);
      }
      col += reflected * amount;
    }
  } else {
    dist = FAR;
    col = sky(rd);
  }

  // Fog (the sky has its own horizon haze), lamp halos and light cones in the rain
  if (dist < FAR) col = mix(col, skyBase(rd), fogAmount(dist));
  col += lampHalos(ro, rd, dist);
  float jitter = hash(ivec2(fragCoord) + ivec2(iFrame * 7, iFrame * 13));
  col += lightShafts(ro, rd, dist, jitter);

  // Rain drawn by the geometry pass (stored bottom row first, like fragCoord)
  col += texelFetch(iChannel0, ivec2(fragCoord), 0).rgb;

  // Filmic tone map, back to display colours, a vignette and a little film grain
  col = 1.0 - exp(-col * 1.4);
  col = pow(col, vec3(1.0 / 2.2));
  vec2 uv = fragCoord / iResolution.xy;
  col *= 1.0 - 0.4 * pow(length(uv - 0.5) * 1.25, 2.5);
  col += (jitter - 0.5) * 0.015;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
