// Block type definitions and a procedurally-generated texture atlas.
// Each block has per-face texture tiles so e.g. grass can have a green top,
// brown-ish sides, and a dirt bottom.

export const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  WOOD: 4,
  LEAVES: 5,
  WATER: 6,
  LAVA: 7,
  OBSIDIAN: 8,
};

// Opaque blocks fully hide the faces behind them. Air and water do not.
export function isOpaque(type) {
  return type !== BLOCK.AIR && type !== BLOCK.WATER;
}

// Fluids the player can move through (non-solid).
export function isFluid(type) {
  return type === BLOCK.WATER || type === BLOCK.LAVA;
}

// Ordered list used by the hotbar (index 0 -> key "1").
export const PLACEABLE = [BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE, BLOCK.WOOD, BLOCK.LEAVES, BLOCK.OBSIDIAN];

export const BLOCK_NAMES = {
  [BLOCK.GRASS]: "grass",
  [BLOCK.DIRT]: "dirt",
  [BLOCK.STONE]: "stone",
  [BLOCK.WOOD]: "wood",
  [BLOCK.LEAVES]: "leaves",
  [BLOCK.WATER]: "water",
  [BLOCK.LAVA]: "lava",
  [BLOCK.OBSIDIAN]: "obsidian",
};

// Tile indices into the atlas (assigned as tiles are registered below).
const tiles = [];
function tile(drawFn) {
  const i = tiles.length;
  tiles.push(drawFn);
  return i;
}

// --- Tile painters (16x16 each) ---
function fill(ctx, x, y, c) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); }
function noise(ctx, base, variants, seedShift) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      // Deterministic pseudo-noise so textures are stable build-to-build.
      const n = Math.abs(Math.sin((x * 12.9898 + y * 78.233 + seedShift) * 43758.5453));
      const c = n < 0.2 ? variants[0] : n < 0.5 ? base : n < 0.8 ? variants[1] : variants[2];
      fill(ctx, x, y, c);
    }
  }
}

const T_GRASS_TOP = tile((ctx) => noise(ctx, "#5fb04a", ["#4e9a3d", "#6cc257", "#57a845"], 1));
const T_DIRT = tile((ctx) => noise(ctx, "#8a5a33", ["#7a4e2b", "#9a6a40", "#83532f"], 2));
const T_GRASS_SIDE = tile((ctx) => {
  // dirt base
  noise(ctx, "#8a5a33", ["#7a4e2b", "#9a6a40", "#83532f"], 2);
  // green grass overhang on top rows
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 16; x++) {
      const n = Math.abs(Math.sin((x * 91.7 + y * 13.3) * 4753.1));
      if (y < 3 || n < 0.6) fill(ctx, x, y, n < 0.5 ? "#4e9a3d" : "#5fb04a");
    }
});
const T_STONE = tile((ctx) => noise(ctx, "#888888", ["#777777", "#999999", "#808080"], 3));
const T_WOOD_SIDE = tile((ctx) => {
  noise(ctx, "#6b4a2b", ["#5c3f25", "#7a5634", "#654328"], 4);
  // vertical bark streaks
  for (let x = 2; x < 16; x += 5)
    for (let y = 0; y < 16; y++) fill(ctx, x, y, "#503820");
});
const T_WOOD_TOP = tile((ctx) => {
  noise(ctx, "#8a6238", ["#7a5630", "#9a6e40", "#835c34"], 5);
  // rings
  ctx.strokeStyle = "#6b4a2b"; ctx.lineWidth = 1;
  for (const r of [3, 6]) { ctx.beginPath(); ctx.arc(8, 8, r, 0, Math.PI * 2); ctx.stroke(); }
});
const T_LEAVES = tile((ctx) => noise(ctx, "#3f7d2e", ["#356b27", "#4a8f37", "#2f5f22"], 6));
const T_WATER = tile((ctx) => noise(ctx, "#2f6fd0", ["#2a64bd", "#3a7ce0", "#2d69c8"], 7));
const T_LAVA = tile((ctx) => noise(ctx, "#e25822", ["#c33a10", "#ff8c1a", "#ffb733"], 8));
const T_OBSIDIAN = tile((ctx) => noise(ctx, "#15101f", ["#0d0a16", "#241a33", "#1a1226"], 9));

// faces order: [px, nx, py, ny, pz, nz] -> +X,-X,+Y(top),-Y(bottom),+Z,-Z
export const BLOCK_TILES = {
  [BLOCK.GRASS]: [T_GRASS_SIDE, T_GRASS_SIDE, T_GRASS_TOP, T_DIRT, T_GRASS_SIDE, T_GRASS_SIDE],
  [BLOCK.DIRT]:  [T_DIRT, T_DIRT, T_DIRT, T_DIRT, T_DIRT, T_DIRT],
  [BLOCK.STONE]: [T_STONE, T_STONE, T_STONE, T_STONE, T_STONE, T_STONE],
  [BLOCK.WOOD]:  [T_WOOD_SIDE, T_WOOD_SIDE, T_WOOD_TOP, T_WOOD_TOP, T_WOOD_SIDE, T_WOOD_SIDE],
  [BLOCK.LEAVES]:[T_LEAVES, T_LEAVES, T_LEAVES, T_LEAVES, T_LEAVES, T_LEAVES],
  [BLOCK.WATER]: [T_WATER, T_WATER, T_WATER, T_WATER, T_WATER, T_WATER],
  [BLOCK.LAVA]:  [T_LAVA, T_LAVA, T_LAVA, T_LAVA, T_LAVA, T_LAVA],
  [BLOCK.OBSIDIAN]: [T_OBSIDIAN, T_OBSIDIAN, T_OBSIDIAN, T_OBSIDIAN, T_OBSIDIAN, T_OBSIDIAN],
};

export const TILE_COUNT = tiles.length;

// Build a single horizontal atlas canvas (TILE_COUNT tiles wide, 16px each).
export function buildAtlasCanvas() {
  const TS = 16;
  const canvas = document.createElement("canvas");
  canvas.width = TS * TILE_COUNT;
  canvas.height = TS;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  for (let i = 0; i < tiles.length; i++) {
    ctx.save();
    ctx.translate(i * TS, 0);
    // Each painter draws in 16x16 unit space; scale up to TS.
    ctx.scale(TS / 16, TS / 16);
    tiles[i](ctx);
    ctx.restore();
  }
  return canvas;
}

// Produce a small pixel-art icon (data URL) for a block, using its side tile.
// Used by the hotbar UI.
export function blockIconDataURL(blockType, size = 48) {
  const atlas = buildAtlasCanvas();
  const TS = 16;
  const tileIndex = BLOCK_TILES[blockType][0]; // side face
  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const ctx = out.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(atlas, tileIndex * TS, 0, TS, TS, 0, 0, size, size);
  return out.toDataURL();
}

// UV rect for a given tile index within the atlas.
export function tileUV(tileIndex) {
  const u0 = tileIndex / TILE_COUNT;
  const u1 = (tileIndex + 1) / TILE_COUNT;
  return [u0, u1];
}
