# VoxelCraft Roadmap

Tech stack: **Three.js + Vite** (browser-based, zero-install to run).

## ✅ Phase 0 — Playable base (done)
- [x] Project scaffold (Vite + Three.js)
- [x] 3D voxel world with face-culled meshing
- [x] First-person camera (pointer lock)
- [x] Player movement + gravity + collision
- [x] Flat terrain (grass / dirt / stone)
- [x] Break & place blocks
- [x] Grass, dirt, stone, wood block types
- [x] Run instructions in README

## 🔜 Phase 1 — A living world
- [x] Chunk system (split world into chunks)
- [x] Procedural terrain (heightmap noise)
- [x] Trees
- [x] Caves
- [ ] Chunk loading/unloading around the player

## 🔮 Phase 2 — Gameplay
- [x] Hotbar UI (visual block selection)
- [ ] Inventory
- [ ] Simple crafting
- [ ] Block-break particles / feedback
- [ ] Mobs

## 🌅 Phase 3 — Atmosphere & systems
- [x] Day/night cycle
- [x] Water
- [x] Lava
- [ ] Sound effects
- [ ] Save/load world (localStorage)
- [ ] Main menu

## 🔥 Phase 4 — The Nether (done)
- [x] Obsidian (placeable + natural deposits)
- [x] Nether portal frame detection + ignition
- [x] Nether dimension (netherrack, lava seas, glowstone)
- [x] Portal travel between dimensions
- [ ] Return-portal linking by coordinates (currently one arrival portal/dim)
- [ ] Nether mobs, soul sand, fortresses (future)

## ⚙️ Cross-cutting
- [ ] Performance: per-chunk meshing, frustum culling, greedy meshing
- [ ] Ambient occlusion on voxel faces
- [ ] Mobile/touch controls (stretch)

## Notes on decisions
- Chose Three.js over Godot/Unity/Bevy/Ursina for fastest local run and
  build verification (browser, no engine GUI, no compile step).
- Phase 0 uses a single-mesh world rebuilt on every edit. This is simple and
  fine for a small world but must become per-chunk meshing in Phase 1 before
  procedural/larger worlds, or edits will stutter.
