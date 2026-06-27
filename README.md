# VoxelCraft

A Minecraft-inspired voxel game built from scratch with **Three.js** + **Vite**. Runs entirely in the browser — no engine install required.

![status](https://img.shields.io/badge/status-playable_prototype-brightgreen)

## Features (current)

- 3D voxel world split into chunks, rendered with face-culled meshes
- **Procedural terrain** from fractal (fBm) value noise
- First-person camera with pointer-lock mouse look
- WASD movement, jumping, gravity, and AABB voxel collision
- Break blocks (left click) and place blocks (right click) — only the edited
  chunk re-meshes
- Block selection: grass, dirt, stone, wood
- Procedurally generated textures (no external assets)

## Requirements

- [Node.js](https://nodejs.org/) 18+ (developed on Node 24)

## Run locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default http://localhost:5173).

### Build for production

```bash
npm run build      # outputs to dist/
npm run preview    # serve the production build
```

### Tests

```bash
npm test     # pure-logic unit tests (noise/terrain), runs under Node
npm run smoke # boots the built game in headless Chromium and checks it renders
```

## Controls

| Input | Action |
| --- | --- |
| Click | Lock mouse / start playing |
| W A S D | Move |
| Mouse | Look |
| Space | Jump |
| Left click | Break block |
| Right click | Place block |
| 1 – 4 | Select block (grass / dirt / stone / wood) |
| Esc | Release mouse |

## Project structure

```
voxelcraft/
├── index.html      # canvas, crosshair, HUD, start overlay
├── src/
│   ├── main.js     # renderer, scene, raycasting, game loop
│   ├── world.js    # voxel storage + face-culled mesher
│   ├── player.js   # first-person controller + physics/collision
│   └── blocks.js   # block types + procedural texture atlas
├── ROADMAP.md      # planned features
├── DEVLOG.md       # development history
└── TODO.md         # active task list
```

## License

MIT
