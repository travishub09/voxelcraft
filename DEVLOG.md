# DevLog

Reverse-chronological log of development iterations.

## 2026-06-27 — 🔥 The Nether dimension (milestone)
**Goal:** stepping through a lit portal transports the player to a generated
Nether — the natural finish line for the water→lava→obsidian→portal arc.

Implemented:
- `blocks.js`: `NETHERRACK` + `GLOWSTONE` blocks/tiles.
- `chunk.js`: 5th mesher layer (glowstone, emissive).
- `world.js`: `mode: "overworld" | "nether"`; `generateNetherChunk()` — solid
  netherrack floor, lava seas in valleys, a netherrack ceiling slab, carved
  caverns, and glowstone clusters under the roof; glowstone emissive material.
- `main.js`: dimension manager — `overworld` + lazily-built `nether` World;
  `travel()` swaps the active world's group, builds an arrival portal +
  standing platform on the far side, repositions the player, and sets the
  dimension atmosphere (Nether = dark-red fog, dim red light; Overworld = the
  day/night cycle). Portal entry is **edge-triggered** (rising edge of standing
  in a portal block) with a cooldown, so you don't bounce back and forth.
  `createPortal()` builds a full frame+platform and lights it; `enterNether()`
  debug hook for the smoke test.
- Smoke asserts: travel switches to the Nether, netherrack generated, and no
  errors during the dimension switch.

Results: 8/8 unit, 17/17 smoke. Nether reached headlessly with ~116k
netherrack, 558 glowstone, ~4.9k lava — no errors. **Goal met: a Nether was
reached naturally through the build-up of fluids, obsidian, and portals.**

## 2026-06-27 — Nether portal (frame detection + ignition)
**Goal:** build an obsidian frame and light it into a portal.

Implemented:
- `blocks.js`: `PORTAL` block + purple tile; non-opaque, non-solid.
- `chunk.js`: 4th mesher layer (portal), drawn like water (exposed faces only).
- `world.js`: translucent glowing portal material; `lightPortal()` +
  `_tryLightPlane()` — flood-fills the interior air in either vertical plane,
  validates it's a full rectangle (2–4 × 3–5) bounded by obsidian, and fills it
  with portal blocks. `portalCount`.
- `main.js`: press **F** while aiming at a frame to ignite; `buildTestPortal()`
  debug helper builds + lights a frame for the smoke test.
- Smoke asserts an obsidian frame ignites into a ≥6-block portal.

Results: 8/8 unit, 14/14 smoke. Frame → 6-block portal confirmed headlessly.

Next: stepping into the portal transports the player to a generated Nether
dimension — the finish line.

## 2026-06-27 — Obsidian
**Goal:** the block a Nether portal is built from (ingredient #3).

Implemented:
- `blocks.js`: `OBSIDIAN` block + dark tile; added to `PLACEABLE` (hotbar now 6
  slots) so players can build portal frames.
- `world.js`: natural obsidian deposits in stone just above the lava layer
  (deterministic ~7% in a 3-block band); `obsidianCount`.
- Smoke asserts 6 hotbar slots + obsidian generated.

Results: 8/8 unit, 13/13 smoke. 1819 obsidian deposits.

Next: detect an obsidian portal frame and light it → Nether portal blocks.

## 2026-06-27 — Lava
**Goal:** molten lava pooling deep underground (Nether ingredient #2).

Implemented:
- `blocks.js`: `LAVA` block + orange tile; `isFluid()` (water/lava).
- `chunk.js`: mesher now emits a third **lava** geometry layer (opaque culling
  rules, separate material for glow).
- `world.js`: emissive lava material; generic `_updateLayerMesh()` handles both
  water and lava mesh lifecycles; `generateChunk()` fills deep cave air
  (y ≤ lavaLevel 4) with lava; `isSolid()` now also excludes lava.
- Smoke asserts lava pooled.

Results: 8/8 unit, 12/12 smoke. 1087 lava voxels, glowing underground.

## 2026-06-27 — Water (transparency-aware mesher)
**Goal:** oceans/lakes with see-through water. Also lays the groundwork (split
opaque/transparent meshing) for lava and portals on the road to the Nether.

Implemented:
- `blocks.js`: `WATER` block + blue tile + `isOpaque()` (air & water are
  non-opaque).
- `chunk.js`: `buildChunkGeometries()` now returns **two** geometries — opaque
  and water. Opaque faces draw against any non-opaque neighbor; water faces draw
  only against air (its surface).
- `world.js`: separate transparent water material (opacity 0.72, depthWrite
  off); per-chunk water mesh created/updated/removed alongside the opaque mesh;
  `generateChunk()` floods air ≤ sea level (10) with water; `isSolid()` (water
  isn't solid). Lowered terrain baseline so valleys flood.
- `player.js` / `main.js`: collision + raycast use `isSolid()`, so you wade
  through water and can't target it.
- Smoke asserts water generated.

Results: 8/8 unit, 11/11 smoke. 485 water voxels in the default world.

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
