// Tiny deterministic value-noise (no deps) for procedural terrain.
// Pure functions — safe to import and unit-test under Node.

function hash2(x, y, seed) {
  // Integer hash -> [0,1)
  let h = x * 374761393 + y * 668265263 + seed * 2246822519;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return (h >>> 0) / 4294967296;
}

// Deterministic per-cell random in [0,1) — handy for sparse decoration (trees).
export function cellRandom(x, y, seed = 0) {
  return hash2(x | 0, y | 0, seed);
}

function hash3(x, y, z, seed) {
  let h = x * 374761393 + y * 668265263 + z * 2147483647 + seed * 2246822519;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return (h >>> 0) / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t); // smoothstep
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Value noise at continuous (x, y), grid period 1.
export function valueNoise(x, y, seed = 0) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = smooth(x - x0), fy = smooth(y - y0);
  const v00 = hash2(x0, y0, seed);
  const v10 = hash2(x0 + 1, y0, seed);
  const v01 = hash2(x0, y0 + 1, seed);
  const v11 = hash2(x0 + 1, y0 + 1, seed);
  return lerp(lerp(v00, v10, fx), lerp(v01, v11, fx), fy);
}

// 3D value noise at continuous (x,y,z) -> [0,1).
export function valueNoise3(x, y, z, seed = 0) {
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
  const fx = smooth(x - x0), fy = smooth(y - y0), fz = smooth(z - z0);
  const c = (dx, dy, dz) => hash3(x0 + dx, y0 + dy, z0 + dz, seed);
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), fx);
  const x10 = lerp(c(0, 1, 0), c(1, 1, 0), fx);
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), fx);
  const x11 = lerp(c(0, 1, 1), c(1, 1, 1), fx);
  return lerp(lerp(x00, x10, fy), lerp(x01, x11, fy), fz);
}

// Multi-octave 3D noise -> [0,1].
export function fbm3(x, y, z, { seed = 0, octaves = 3, freq = 0.07, lacunarity = 2, gain = 0.5 } = {}) {
  let amp = 1, f = freq, sum = 0, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise3(x * f, y * f, z * f, seed + o * 9277);
    norm += amp;
    amp *= gain;
    f *= lacunarity;
  }
  return sum / norm;
}

// True if the voxel at (x,y,z) should be carved into a cave/air pocket.
export function isCave(x, y, z, { seed = 0, threshold = 0.74 } = {}) {
  return fbm3(x, y, z, { seed: seed + 555, freq: 0.075, octaves: 3 }) > threshold;
}

// Fractal Brownian motion: sum of octaves -> [0,1].
export function fbm(x, y, { seed = 0, octaves = 4, freq = 0.01, lacunarity = 2, gain = 0.5 } = {}) {
  let amp = 1, f = freq, sum = 0, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(x * f, y * f, seed + o * 1013);
    norm += amp;
    amp *= gain;
    f *= lacunarity;
  }
  return sum / norm;
}

// Surface height (integer) at world (x, z) for given config.
export function terrainHeight(x, z, { seed = 0, minH = 4, maxH = 28 } = {}) {
  const n = fbm(x, z, { seed, octaves: 4, freq: 0.018, lacunarity: 2.1, gain: 0.5 });
  return Math.floor(minH + n * (maxH - minH));
}
