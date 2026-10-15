// Neon vintage, ray marched: a rainy night drive down a four-lane boulevard toward a striped
// sun. The lamps, buildings and traffic are real 3D geometry found by sphere tracing; the wet
// asphalt reflects them with a second march, lamps cast soft ray-marched shadows, ambient
// occlusion grounds the cars, and a short volumetric march lights up the cones under the lamps.
// Cars come from traffic.comp through the storage buffer, rain from rain.vert in iChannel0.
// Theme colours: neon = border, accents = border-mid, sky = background, haze = elevated panels.

const float DRIVE_SPEED = 12.0;   // keep in sync with traffic.comp and rain.vert
const float FOCAL = 1.25;
const int CAR_COUNT = 16;

const float ROAD_HALF = 7.0;
const float WALK_OUTER = 10.0;
const float LAMP_SPACING = 25.0;
const float LAMP_X = 8.6;
const float LAMP_H = 7.4;
const float LAMP_REACH = 2.6;
const float BLOCK = 22.0;
const float BUILD_X = 13.0;
const float MAX_HEIGHT = 64.0;

const int MARCH_STEPS = 160;
const int REFLECT_STEPS = 56;
const int SHADOW_STEPS = 24;
const int FOG_STEPS = 14;
const float FAR = 420.0;
const float FOG_DENSITY = 0.0065;

const float MAT_BUILDING = 1.0;
const float MAT_POLE = 2.0;
const float MAT_LAMP = 3.0;
const float MAT_CAR = 10.0;   // plus the car's index

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

// â”€â”€â”€ Camera (keep in sync with rain.vert) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

vec3 cameraPosition(float t) {
  return vec3(1.75 + 0.22 * sin(t * 0.21), 2.6 + 0.035 * sin(t * 1.9), t * DRIVE_SPEED);
}

mat3 cameraBasis(float t) {
  vec3 forward = normalize(vec3(-0.035 + 0.012 * sin(t * 0.21 + 1.0), -0.075, 1.0));
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
  return mat3(right, cross(forward, right), forward);
}

// â”€â”€â”€ Noise â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Signed distances â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// A building per block on each side: near facade x, depth, height (0 for an empty lot), half length
vec4 building(float side, float block) {
  int b = int(block);
  int s = side > 0.0 ? 0 : 8;
  if (hash(ivec2(b, s)) < 0.625) return vec4(0.0);
  return vec4(
    BUILD_X + 2.5 * hash(ivec2(b, s + 2)),
    9.0 + 10.0 * hash(ivec2(b, s + 3)),
    12.0 + 50.0 * pow(hash(ivec2(b, s + 1)), 1.6),
    6.5 + 3.5 * hash(ivec2(b, s + 4)));
}

float buildingDistance(vec3 p, float ax, float side, float block) {
  vec4 b = building(side, block);
  if (b.z == 0.0) return 1e3;
  float lz = p.z - (block + 0.5) * BLOCK;
  return sdBox(vec3(ax - b.x - b.y * 0.5, p.y - b.z * 0.5, lz), vec3(b.y * 0.5, b.z * 0.5, b.w));
}

float mapBuildings(vec3 p) {
  float ax = abs(p.x);
  if (ax < BUILD_X - 1.0) return BUILD_X - ax;
  float side = sign(p.x);
  float block = floor(p.z / BLOCK);
  float d = min(buildingDistance(p, ax, side, block), min(buildingDistance(p, ax, side, block - 1.0), buildingDistance(p, ax, side, block + 1.0)));
  // Buildings two or more blocks away are at least this far, so empty lots don't slow rays down
  d = min(d, BLOCK * 1.5 - abs(p.z - (block + 0.5) * BLOCK));
  return max(d, p.y - MAX_HEIGHT);
}

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
  vec2 res = vec2(mapBuildings(p), MAT_BUILDING);
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

// â”€â”€â”€ Lights â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Sky â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

vec3 sky(vec3 rd) {
  float el = rd.y;
  float az = atan(rd.x, rd.z);
  vec3 col = mix(haze, night, smoothstep(-0.02, 0.3, el));

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
  vec3 sunDir = normalize(vec3(-0.06, 0.12, 1.0));
  vec3 sunRight = normalize(cross(vec3(0.0, 1.0, 0.0), sunDir));
  vec3 sunUp = cross(sunDir, sunRight);
  vec2 s = vec2(dot(rd, sunRight), dot(rd, sunUp)) / 0.16;
  float sd = length(s);
  vec3 sunCol = mix(neon, SUN_TOP, smoothstep(-0.8, 0.7, s.y)) * 1.2;
  col += mix(neon, SUN_TOP, 0.35) * exp(-max(sd - 1.0, 0.0) * 3.0) * 0.5 * step(0.0, dot(rd, sunDir));
  float bands = fract(s.y * 7.0 + iTime * 0.35);
  float cutHalf = clamp((0.55 - s.y) * 0.2, 0.0, 0.35);
  float cut = (1.0 - smoothstep(cutHalf - 0.02, cutHalf + 0.02, abs(bands - 0.5))) * step(0.01, cutHalf);
  col = mix(col, sunCol, smoothstep(1.0, 0.985, sd) * (1.0 - cut) * step(0.0, dot(rd, sunDir)));

  // Wireframe mountains on the horizon
  float ridge = 0.012 + 0.06 * fbm(vec2(az * 3.0, 1.7)) * smoothstep(0.0, 0.6, abs(az + 0.06) + 0.15);
  if (el < ridge) {
    col = mix(night, haze, 0.35) * 0.8;
    col += accent * (1.0 - smoothstep(0.0, 0.0025, abs(fract(el * 120.0 + 0.5) - 0.5) / 120.0)) * 0.12;
    col += accent * exp(-(ridge - el) * 600.0) * 0.8;
  } else {
    col += accent * exp(-(el - ridge) * 400.0) * 0.25;
  }

  // Distant towers beyond the street, with scattered lit windows
  float towerCell = floor(az * 60.0);
  float towerH = 0.008 + 0.05 * pow(hash(ivec2(int(towerCell), 99)), 2.5);
  if (el < towerH && el > -0.01 && hash(ivec2(int(towerCell), 98)) > 0.35) {
    col = night * 0.8;
    ivec2 win = ivec2(floor(vec2(az * 900.0, el * 700.0)));
    col += vec3(1.0, 0.7, 0.4) * step(0.82, hash(win)) * step(0.4, fract(az * 900.0)) * 0.5;
    col += neon * exp(-(towerH - el) * 2500.0) * 0.6;
  }

  col += mix(neon, SUN_TOP, 0.3) * exp(-abs(el) * 40.0) * 0.25;
  return col;
}

// â”€â”€â”€ Materials â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

vec3 shadeObject(vec3 pos, vec3 n, vec3 rd, float mat) {
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
    float fresnel = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
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

  // Buildings: dark facades with rows of lit windows, a neon sign over the street-level shops
  // and a neon trim along the roof
  float side = sign(pos.x);
  float block = floor(pos.z / BLOCK);
  vec4 b = building(side, block);
  int id = int(block) * 2 + (side > 0.0 ? 1 : 0);
  vec2 uv = abs(n.x) > 0.5 ? vec2(pos.z, pos.y) : vec2(pos.x, pos.y);
  vec3 albedo = vec3(0.03, 0.028, 0.035) * (0.7 + 0.6 * noise(uv * vec2(0.5, 3.0)));
  vec3 col = albedo * (ambient + lampLight(pos, n, v, 8.0, 0.2, false));
  if (n.y < 0.5) {
    vec2 grid = uv / vec2(1.6, 2.2);
    ivec2 w = ivec2(floor(grid));
    vec2 f = fract(grid);
    float pane = step(0.2, f.x) * step(f.x, 0.8) * step(0.25, f.y) * step(f.y, 0.8) * step(5.0, uv.y);
    float h = hash(w + ivec2(id * 131, id * 71));
    float lit = step(0.62, h);
    lit = abs(lit - step(0.992, hash(w + ivec2(int(floor(iTime * 0.2 + h * 9.0)), id))));
    vec3 window = mix(vec3(1.0, 0.65, 0.3), accent, step(0.8, hash(w + 5)));
    col += window * pane * lit * (0.35 + 0.6 * hash(w + 17));
    col += vec3(0.01, 0.01, 0.015) * pane * (1.0 - lit) + sky(reflect(rd, n)) * pane * 0.15;

    // Street-facing shop fronts and their sign
    float facingStreet = step(0.5, -n.x * side);
    float shop = facingStreet * step(uv.y, 3.2) * step(0.6, fract(uv.x / 4.0));
    col += mix(vec3(1.0, 0.6, 0.35), accent, hash(ivec2(id, 3))) * shop * 0.45;
    vec3 signColor = hash(ivec2(id, 4)) > 0.5 ? neon : accent;
    float flicker = step(0.04, fract(sin(iTime * 23.0 + float(id)) * 43758.5));
    col += signColor * facingStreet * step(3.6, uv.y) * step(uv.y, 4.1) * step(0.35, hash(ivec2(id, 5))) * flicker * 3.0;
    col += neon * step(b.z - 0.35, pos.y) * 2.5;
  }
  return col;
}

// Asphalt, concrete sidewalks and the neon grid, all wet; returns the lit colour and writes the
// surface normal and how strongly it reflects
vec3 shadeGround(vec3 pos, vec3 rd, float dist, out vec3 n, out float reflectivity) {
  vec2 g = pos.xz;
  float ax = abs(pos.x);
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
  } else if (ax < WALK_OUTER) {
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
  reflectivity = wet;
  return albedo * light + emissive;
}

// â”€â”€â”€ Atmosphere â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    col = shadeObject(pos, normalAt(pos), rd, hit.y);
  } else if (tGround < FAR) {
    dist = tGround;
    vec3 pos = ro + rd * dist;
    vec3 n;
    float wet;
    col = shadeGround(pos, rd, dist, n, wet);
    // The wet street mirrors the city: a second march along the reflected ray
    vec3 rr = reflect(rd, n);
    float fresnel = 0.04 + 0.96 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
    float amount = fresnel * wet;
    if (amount > 0.01) {
      vec3 ro2 = pos + n * 0.02;
      vec2 mirror = march(ro2, rr, FAR * 0.6, REFLECT_STEPS);
      vec3 reflected;
      if (mirror.y > 0.0) {
        vec3 rp = ro2 + rr * mirror.x;
        reflected = shadeObject(rp, normalAt(rp), rr, mirror.y);
        reflected = mix(reflected, haze * 0.5, 1.0 - exp(-mirror.x * FOG_DENSITY));
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
  if (dist < FAR) col = mix(col, haze * 0.5, 1.0 - exp(-dist * FOG_DENSITY));
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
