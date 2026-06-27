// Tiny deterministic value-noise (no deps) for procedural terrain.
// Pure functions — safe to import and unit-test under Node.

function hash2(x, y, seed) {
  // Integer hash -> [0,1)
  let h = x * 374761393 + y * 668265263 + seed * 2246822519;
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
