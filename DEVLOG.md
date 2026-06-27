# DevLog

Reverse-chronological log of development iterations.

## 2026-06-27 — Caves
**Goal:** carve underground caves into the terrain.

Implemented:
- `noise.js`: 3D value noise (`valueNoise3`), `fbm3`, and `isCave()` (carves
  where 3D fBm exceeds a threshold).
- `world.js`: `generateChunk()` carves subsurface voxels to AIR (keeps a 1-block
  floor and the top 2 blocks so the surface isn't full of holes). Tracks
  `caveCount`.
- Tests: 3D noise range/determinism + a carve-fraction sanity bound (>0, <50%).
- Smoke test asserts caves carved.

Fix: heavy cave gen blocked the first frame and made the day/night smoke check
flaky (sampled during a stall). Reworked that check to poll until the clock
advances instead of a single fixed sleep.

Results: 8/8 unit tests, 10/10 smoke checks. ~2.7k cave voxels, ~41.9k tris.

## 2026-06-27 — Day/night cycle
**Goal:** animate a day/night cycle with moving sun and shifting sky.

Implemented:
- `daynight.js`: `DayNight` advances time (120s/cycle), orbits the directional
  sun, ramps sun + ambient intensity with elevation, and lerps sky/fog colour
  night → dusk tint → day. Exposes a 24h `clock` string.
- `index.html`: on-screen clock readout (top-right).
- `main.js`: updates the cycle each frame; exposes `timeOfDay` to debug hook.
- Smoke test asserts time advances between two samples.

Results: smoke green; cycle confirmed advancing headlessly.

## 2026-06-27 — Visual hotbar
**Goal:** replace the text "Selected: x" label with a real hotbar UI.

Implemented:
- `blocks.js`: `LEAVES` added to `PLACEABLE` (now buildable); `blockIconDataURL()`
  renders a pixel-art icon by cropping the block's side tile from the atlas.
- `hotbar.js`: builds a row of slots (icon + number + name), highlights the
  selected one; selection via number keys (1–5), mouse wheel, or click.
- `index.html`: hotbar markup + Minecraft-ish CSS (raised selected slot, glow).
- `main.js`: uses `hotbar.selectedBlock` for placement.
- Smoke test asserts 5 hotbar slots render.

Results: smoke + unit tests green (~37.3k tris, 5 slots).

## 2026-06-27 — Trees
**Goal:** populate the surface with trees.

Implemented:
- `blocks.js`: new `LEAVES` block + green leaf texture tile.
- `noise.js`: `cellRandom()` deterministic per-cell random for sparse placement.
- `world.js`: `decorateTrees()` runs after base terrain at world level (so
  canopies cross chunk borders) — ~1.5% of grass columns get a tree;
  `placeTree()` builds a 4–6 high wood trunk + a rounded 4-layer leaf canopy.
- Smoke test asserts `treeCount > 0`.

Results: 119 trees, ~37.3k triangles. Smoke + unit tests green.

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
