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
  PORTAL: 9,
  NETHERRACK: 10,
  GLOWSTONE: 11,
  PLANKS: 12,
  CRAFTING_TABLE: 13,
  TORCH: 14,
  STICK: 15, // an item, not a placeable block
};

// Items that cannot be placed as blocks in the world.
const NON_PLACEABLE = new Set([BLOCK.AIR, BLOCK.WATER, BLOCK.LAVA, BLOCK.PORTAL, BLOCK.STICK]);
export function isPlaceableBlock(type) {
  return !NON_PLACEABLE.has(type);
}

// Opaque blocks fully hide the faces behind them. Air, water and portal don't.
export function isOpaque(type) {
  return type !== BLOCK.AIR && type !== BLOCK.WATER && type !== BLOCK.PORTAL;
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
  [BLOCK.PORTAL]: "portal",
  [BLOCK.NETHERRACK]: "netherrack",
  [BLOCK.GLOWSTONE]: "glowstone",
  [BLOCK.PLANKS]: "planks",
  [BLOCK.CRAFTING_TABLE]: "crafting table",
  [BLOCK.TORCH]: "torch",
  [BLOCK.STICK]: "stick",
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
const T_PORTAL = tile((ctx) => noise(ctx, "#a13bd6", ["#7d22b0", "#c45cf0", "#8e2bc2"], 10));
const T_NETHERRACK = tile((ctx) => noise(ctx, "#6e1f1f", ["#5a1717", "#822828", "#641b1b"], 11));
const T_GLOWSTONE = tile((ctx) => noise(ctx, "#e8b53a", ["#caa028", "#ffd76b", "#d8a82f"], 12));
const T_PLANKS = tile((ctx) => {
  noise(ctx, "#b88a4e", ["#a87c42", "#c89a5c", "#b08246"], 13);
  ctx.strokeStyle = "#8a6638"; ctx.lineWidth = 1;
  for (const y of [4, 8, 12]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(16, y); ctx.stroke(); }
});
const T_CRAFT = tile((ctx) => {
  noise(ctx, "#b88a4e", ["#a87c42", "#c89a5c", "#b08246"], 13);
  ctx.strokeStyle = "#5a3f22"; ctx.lineWidth = 1;
  for (const v of [5, 10]) {
    ctx.beginPath(); ctx.moveTo(v, 0); ctx.lineTo(v, 16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, v); ctx.lineTo(16, v); ctx.stroke();
  }
});
const T_TORCH = tile((ctx) => {
  noise(ctx, "#6b4a2b", ["#5c3f25", "#7a5634", "#654328"], 4);
  // glowing tip
  ctx.fillStyle = "#ffd76b";
  for (let x = 6; x <= 9; x++) for (let y = 1; y <= 4; y++) fill(ctx, x, y, "#ffd76b");
});
const T_STICK = tile((ctx) => {
  noise(ctx, "#3a2a18", ["#332518", "#43301c", "#392a18"], 14);
  ctx.fillStyle = "#7a5634";
  for (let y = 1; y < 15; y++) { fill(ctx, 7, y, "#7a5634"); fill(ctx, 8, y, "#8a6238"); }
});

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
  [BLOCK.PORTAL]: [T_PORTAL, T_PORTAL, T_PORTAL, T_PORTAL, T_PORTAL, T_PORTAL],
  [BLOCK.NETHERRACK]: [T_NETHERRACK, T_NETHERRACK, T_NETHERRACK, T_NETHERRACK, T_NETHERRACK, T_NETHERRACK],
  [BLOCK.GLOWSTONE]: [T_GLOWSTONE, T_GLOWSTONE, T_GLOWSTONE, T_GLOWSTONE, T_GLOWSTONE, T_GLOWSTONE],
  [BLOCK.PLANKS]: [T_PLANKS, T_PLANKS, T_PLANKS, T_PLANKS, T_PLANKS, T_PLANKS],
  [BLOCK.CRAFTING_TABLE]: [T_CRAFT, T_CRAFT, T_CRAFT, T_CRAFT, T_CRAFT, T_CRAFT],
  [BLOCK.TORCH]: [T_TORCH, T_TORCH, T_TORCH, T_TORCH, T_TORCH, T_TORCH],
  [BLOCK.STICK]: [T_STICK, T_STICK, T_STICK, T_STICK, T_STICK, T_STICK],
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
