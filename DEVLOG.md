# DevLog

Reverse-chronological log of development iterations.

## 2026-06-27 — Procedural terrain + headless smoke test
**Goal:** real rolling terrain, and a way to verify the *running* game (not
just the build) automatically.

Implemented:
- `world.js`: `generateChunk()` now uses `terrainHeight()` (fBm) per column —
  stone interior, 3 dirt layers, grass cap. Seeded (default 1337).
- `main.js`: player spawns just above the real surface at world center; exposes
  `window.__VOXELCRAFT__` debug hook (chunk count, draw calls, triangles,
  sample heights, player Y).
- `scripts/smoke.mjs` + `npm run smoke`: builds, serves `vite preview`, boots
  the game in **headless Chromium (puppeteer)**, and asserts: no runtime/console
  errors, canvas renders, chunks built, triangles > 0, terrain varies, player
  positioned. Needed `--enable-unsafe-swiftshader --use-angle=swiftshader` for
  software WebGL in headless.

Results: 36 chunks, ~26.9k triangles, 18 draw calls, terrain heights vary.
Smoke + unit tests both green.

Decisions:
- Smoke test is the verification backbone going forward — every rendering change
  can now be checked headlessly, catching WebGL/Three runtime errors the build
  can't.

## 2026-06-27 — Chunk system + test harness
**Goal:** replace the single-mesh world so edits and (upcoming) procedural
terrain don't rebuild one giant mesh.

Implemented:
- `chunk.js`: `Chunk` (16×16×32 voxel array) + `buildChunkGeometry()` mesher
  that queries `world.get()` for neighbors so cross-chunk borders cull correctly.
- `world.js`: rewritten as a chunk manager (Map of chunks + a `THREE.Group`).
  `setBlock()` re-meshes only the edited chunk (and a border neighbor if the
  edit is on a chunk edge). Default world is 6×6 chunks (96×96).
- `noise.js`: pure deterministic value-noise + fBm + `terrainHeight()` (ready
  for procedural terrain next; isolated so it's Node-testable).
- `test/logic.test.mjs` + `npm test`: verifies noise range/determinism/
  continuity and terrain bounds/variation. **Real automated verification** that
  doesn't need a browser. 5/5 passing.

Decisions:
- Kept flat terrain this iteration to isolate the refactor; procedural terrain
  is the next commit (uses the already-tested `noise.js`).

Verification: `npm test` 5/5 pass, `npm run build` succeeds.

## 2026-06-27 — v0.1.0: Playable base
**Goal:** smallest playable voxel prototype.

Implemented:
- Vite + Three.js scaffold.
- `blocks.js`: block enum (air/grass/dirt/stone/wood) + a procedurally
  painted 16px texture atlas (per-face tiles; grass has green top, dirt
  sides/bottom; wood has bark sides and ringed top).
- `world.js`: `World` stores voxels in a `Uint8Array`; `buildMesh()` emits
  only exposed faces into a single `BufferGeometry` (face culling). Flat
  terrain: stone base → dirt → grass top.
- `player.js`: pointer-lock first-person controller; WASD + jump; gravity;
  axis-separated AABB voxel collision; fall-out respawn.
- `main.js`: renderer/scene/lighting; Amanatides–Woo voxel raycast for
  targeting; left-click break, right-click place (won't place inside player);
  number keys 1–4 select block; start overlay + crosshair + HUD.

Decisions:
- Single-mesh world rebuilt on each edit — simple, acceptable for a 48×16×48
  world. Flagged in ROADMAP to convert to per-chunk meshing in Phase 1.
- Procedural textures (canvas) to avoid shipping image assets.

Verification: `npm run build` succeeds (see commit). Manual play in browser.

Next: procedural terrain via heightmap noise — but first refactor to a chunk
system so larger/edited worlds don't rebuild a giant mesh each time.
