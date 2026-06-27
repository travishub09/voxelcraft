// Pure-logic tests runnable under Node (no browser/WebGL needed).
// Run: npm test
import assert from "node:assert";
import test from "node:test";
import { valueNoise, fbm, terrainHeight } from "../src/noise.js";

test("valueNoise is in [0,1) and deterministic", () => {
  for (let i = 0; i < 50; i++) {
    const x = i * 1.37, y = i * 0.91;
    const a = valueNoise(x, y, 42);
    const b = valueNoise(x, y, 42);
    assert.ok(a >= 0 && a < 1, `out of range: ${a}`);
    assert.strictEqual(a, b, "not deterministic");
  }
});

test("valueNoise is continuous (small step -> small change)", () => {
  const a = valueNoise(10.0, 10.0, 1);
  const b = valueNoise(10.001, 10.0, 1);
  assert.ok(Math.abs(a - b) < 0.05, `discontinuous: ${a} vs ${b}`);
});

test("fbm stays in [0,1]", () => {
  for (let i = 0; i < 100; i++) {
    const v = fbm(i * 3.1, i * 2.7, { seed: 7 });
    assert.ok(v >= 0 && v <= 1, `fbm out of range: ${v}`);
  }
});

test("terrainHeight respects min/max bounds", () => {
  const minH = 4, maxH = 28;
  for (let x = 0; x < 200; x++) {
    for (let z = 0; z < 5; z++) {
      const h = terrainHeight(x, z, { seed: 3, minH, maxH });
      assert.ok(Number.isInteger(h), `not integer: ${h}`);
      assert.ok(h >= minH && h <= maxH, `out of bounds: ${h}`);
    }
  }
});

test("terrainHeight varies across the map (not flat)", () => {
  const heights = new Set();
  for (let x = 0; x < 100; x++) heights.add(terrainHeight(x, 0, { seed: 5 }));
  assert.ok(heights.size > 5, `terrain too uniform: ${heights.size} distinct heights`);
});
