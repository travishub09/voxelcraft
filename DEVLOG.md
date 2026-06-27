# DevLog

Reverse-chronological log of development iterations.

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
