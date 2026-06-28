# VoxelCraft

A Minecraft-inspired voxel game built from scratch with **Three.js** + **Vite**. Runs entirely in the browser — no engine install required.

![status](https://img.shields.io/badge/status-playable_prototype-brightgreen)

## Features (current)

- 3D voxel world split into chunks, rendered with face-culled meshes
- **Procedural terrain** from fractal (fBm) value noise, with **caves** (3D noise)
- **Oceans/lakes** (transparent water) and **lava seas** (emissive)
- **Trees** scattered across the surface
- **Day/night cycle** — moving sun, shifting sky, on-screen clock
- **Nether dimension** — build an obsidian portal, light it, and travel to a
  generated Nether (netherrack, lava seas, glowing glowstone, red fog)
- **Main menu / world selector** — choose a seed and world size
- **Survival systems** — stacked inventory + block drops, a crafting screen
  (planks/sticks/crafting table/torch), a 20-HP heart bar, and damage from
  hostile mobs, lava, and falls (with respawn)
- **Mobs** — passive pigs that wander, hostile zombies that chase at night
- First-person camera with pointer-lock mouse look
- WASD movement, jumping, gravity, AABB voxel collision; wade through fluids
- Break blocks (left click) and place blocks (right click) — only the edited
  chunk re-meshes
- Visual hotbar: grass, dirt, stone, wood, leaves, obsidian
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
| 1 – 9 / scroll | Select hotbar slot |
| E | Open / close inventory + crafting |
| F | Light a Nether portal (aim at an obsidian frame) |
| Esc | Release mouse / close inventory |

Break blocks to collect them; placing consumes from the selected stack. Watch
your hearts — zombies spawn at night, and lava and long falls hurt.

### Building a Nether portal

1. Select **obsidian** (hotbar slot 6) and build a vertical rectangular frame —
   a 2×3 interior works (4 wide × 5 tall including the frame).
2. Aim at the interior and press **F** to light it.
3. Walk into the glowing purple portal to travel to the Nether. Walk back into
   the portal on the other side to return.

Obsidian also occurs naturally in deposits just above the lava layer deep
underground.

## Project structure

```
voxelcraft/
├── index.html      # canvas, crosshair, clock, hotbar, start overlay
├── src/
│   ├── main.js     # renderer, scene, raycasting, dimensions, game loop
│   ├── world.js    # chunk manager, terrain/nether gen, portal lighting
│   ├── chunk.js    # chunk storage + layered (opaque/water/lava/portal/glow) mesher
│   ├── player.js   # first-person controller + physics/collision
│   ├── blocks.js   # block types + procedural texture atlas + icons
│   ├── noise.js    # value noise / fBm (2D + 3D) for terrain & caves
│   ├── hotbar.js   # hotbar UI
│   └── daynight.js # day/night cycle
├── scripts/smoke.mjs # headless-Chromium smoke test
├── test/           # Node unit tests (noise/terrain/caves)
├── ROADMAP.md      # planned features
├── DEVLOG.md       # development history
└── TODO.md         # active task list
```

## License

MIT
