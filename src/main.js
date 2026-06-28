import * as THREE from "three";
import { World } from "./world.js";
import { Player } from "./player.js";
import { Mob } from "./mob.js";
import { Hotbar } from "./hotbar.js";
import { Inventory } from "./inventory.js";
import { InventoryUI } from "./inventoryui.js";
import { DayNight } from "./daynight.js";
import { RECIPES, craft } from "./crafting.js";
import { hasSave, saveGame, loadGame } from "./save.js";
import { BLOCK, isPlaceableBlock } from "./blocks.js";

const canvas = document.getElementById("app");
const overlay = document.getElementById("overlay");
const clockEl = document.getElementById("clock");
const healthEl = document.getElementById("health");
const hurtEl = document.getElementById("hurt");

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

// --- Scene ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 40, 80);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// Mobs live in their own group so they're easy to clear between worlds.
const mobGroup = new THREE.Group();
scene.add(mobGroup);
let mobs = [];
let mobSpawnTimer = 0;
let lavaDamageTimer = 0;

// --- Lighting + day/night cycle ---
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(40, 80, 20);
scene.add(sun);
const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);
const dayNight = new DayNight(scene, sun, ambient);

// --- Game state (a world is created when "Generate World" is clicked) ---
let overworld = null;
let nether = null;            // built lazily on first portal travel
let world = null;             // the active dimension
let dimension = "overworld";
let player = null;
let spawnX = 0, spawnZ = 0;
let started = false;

// --- Inventory + hotbar (persist across worlds; reset on new game) ---
const inventory = new Inventory();
const hotbar = new Hotbar(document.getElementById("hotbar"), inventory);
const invUI = new InventoryUI(document.getElementById("inventory"), inventory);

// Create (or recreate) a world and drop the player into it. With { load: true }
// it restores the saved world (seed + edits + inventory + player + time).
function startGame({ seed = 1337, chunks = 6, load = false } = {}) {
  const save = load ? loadGame() : null;
  if (save) { seed = save.seed; chunks = save.chunks; }

  // Tear down any previous world.
  if (overworld) scene.remove(overworld.group);
  if (nether) scene.remove(nether.group);
  nether = null;
  dimension = "overworld";
  for (const k of Object.keys(portalReturn)) delete portalReturn[k];
  portalCooldown = 0;
  inPortalLastFrame = false;

  overworld = new World({ seed, chunksX: chunks, chunksZ: chunks });
  world = overworld;
  scene.add(world.group);

  spawnX = Math.floor(world.sx / 2);
  spawnZ = Math.floor(world.sz / 2);
  if (!player) player = new Player(camera, world, canvas);
  else player.world = world;

  if (save) {
    overworld.applyEdits(save.edits || []);
    player.position.set(save.player.x, save.player.y, save.player.z);
    player.health = save.player.health ?? player.maxHealth;
    inventory.setSlots(save.inventory);
    if (typeof save.time === "number") dayNight.t = save.time;
  } else {
    player.position.set(spawnX + 0.5, world.heightAt(spawnX, spawnZ) + 2, spawnZ + 0.5);
    player.health = player.maxHealth;
    inventory.clear();
    inventory.add(BLOCK.GRASS, 16);
    inventory.add(BLOCK.DIRT, 16);
    inventory.add(BLOCK.STONE, 16);
    inventory.add(BLOCK.WOOD, 16);
  }

  player.velocity.set(0, 0, 0);
  player.regenTimer = 0;
  player.fallPeakY = player.position.y;
  clearMobs();

  applyAtmosphere("overworld");
  started = true;
}

// Snapshot the overworld for saving (seed + runtime edits, not every voxel).
function buildSaveData() {
  const inOverworld = dimension === "overworld";
  const px = inOverworld ? player.position.x : spawnX + 0.5;
  const py = inOverworld ? player.position.y : overworld.heightAt(spawnX, spawnZ) + 2;
  const pz = inOverworld ? player.position.z : spawnZ + 0.5;
  return {
    seed: overworld.seed,
    chunks: overworld.chunksX,
    time: dayNight.t,
    player: { x: px, y: py, z: pz, health: player.health },
    inventory: inventory.slots,
    edits: [...overworld.edits],
  };
}

function doSave() {
  if (!started) return false;
  return saveGame(buildSaveData());
}

// --- Mobs ---
function clearMobs() {
  for (const m of mobs) mobGroup.remove(m.mesh);
  mobs = [];
}

// Find a standable Y at (x,z): the block above the highest solid column block.
function surfaceY(x, z) {
  for (let y = world.sy - 1; y >= 1; y--) {
    if (world.isSolid(x, y, z) && !world.isSolid(x, y + 1, z) && !world.isSolid(x, y + 2, z)) return y + 1;
  }
  return null;
}

function spawnMob(kind, x, z) {
  const y = surfaceY(x, z);
  if (y === null) return null;
  const mob = new Mob(world, kind, x + 0.5, y, z + 0.5);
  mobs.push(mob);
  mobGroup.add(mob.mesh);
  return mob;
}

// Spawn around the player at a random distance (overworld only).
function trySpawnNearPlayer() {
  if (mobs.length >= 8) return;
  const ang = Math.random() * Math.PI * 2;
  const r = 9 + Math.random() * 6;
  const x = Math.floor(player.position.x + Math.cos(ang) * r);
  const z = Math.floor(player.position.z + Math.sin(ang) * r);
  if (x < 1 || z < 1 || x >= world.sx - 1 || z >= world.sz - 1) return;
  // Hostiles at night, passive by day.
  const night = dayNight.t < 0.24 || dayNight.t > 0.76;
  spawnMob(night ? "zombie" : "pig", x, z);
}

function updateMobs(dt) {
  mobGroup.visible = dimension === "overworld";
  if (dimension !== "overworld") return;

  mobSpawnTimer -= dt;
  if (mobSpawnTimer <= 0) { mobSpawnTimer = 3; trySpawnNearPlayer(); }

  for (const mob of mobs) {
    mob.update(dt, player.position);
    // Hostile contact damage.
    if (mob.hostile && mob.attackCooldown <= 0) {
      const dx = mob.position.x - player.position.x;
      const dz = mob.position.z - player.position.z;
      const dy = mob.position.y - player.position.y;
      if (Math.hypot(dx, dz) < 0.9 && Math.abs(dy) < 2) {
        player.damage(mob.damage);
        mob.attackCooldown = 1.0;
      }
    }
  }
  // Remove dead/fallen mobs.
  mobs = mobs.filter((m) => {
    if (m.dead || m.position.distanceTo(player.position) > 60) { mobGroup.remove(m.mesh); return false; }
    return true;
  });
}

// Environment damage (lava) + death/respawn.
function updateSurvival(dt) {
  // Standing in lava hurts over time.
  const fx = Math.floor(player.position.x), fz = Math.floor(player.position.z);
  const fy = Math.floor(player.position.y + 0.1);
  const inLava = world.get(fx, fy, fz) === BLOCK.LAVA || world.get(fx, Math.floor(player.position.y + 1), fz) === BLOCK.LAVA;
  if (inLava) {
    lavaDamageTimer -= dt;
    if (lavaDamageTimer <= 0) { player.damage(2); lavaDamageTimer = 0.5; }
  } else {
    lavaDamageTimer = 0;
  }

  if (player.dead) respawn();
  updateHealthUI();
}

function respawn() {
  flash("💀 You died — respawning");
  if (dimension !== "overworld") returnToOverworld();
  player.position.set(spawnX + 0.5, world.heightAt(spawnX, spawnZ) + 2, spawnZ + 0.5);
  player.velocity.set(0, 0, 0);
  player.health = player.maxHealth;
  player.regenTimer = 0;
  player.fallPeakY = player.position.y;
  clearMobs();
}

function returnToOverworld() {
  scene.remove(world.group);
  world = overworld;
  scene.add(world.group);
  player.world = world;
  dimension = "overworld";
  applyAtmosphere("overworld");
}

function updateHealthUI() {
  if (!healthEl) return;
  const hp = player.health;
  let html = "";
  for (let i = 0; i < 10; i++) {
    const full = hp >= (i + 1) * 2;
    const half = !full && hp >= i * 2 + 1;
    html += `<span class="heart ${full ? "full" : half ? "half" : "empty"}">♥</span>`;
  }
  healthEl.innerHTML = html;
  if (hurtEl) hurtEl.style.opacity = Math.max(0, player.hurtFlash) * 1.5;
}

// --- Main menu wiring ---
const menuEl = document.getElementById("menu");
const seedInput = document.getElementById("seed-input");
document.getElementById("seed-random").addEventListener("click", () => {
  seedInput.value = String(Math.floor(Math.random() * 1e9));
});
document.getElementById("play-btn").addEventListener("click", () => {
  const seed = parseInt(seedInput.value, 10) || 1337;
  const chunks = parseInt(document.getElementById("size-select").value, 10) || 6;
  startGame({ seed, chunks });
  menuEl.classList.add("hidden");
  canvas.requestPointerLock();
});

// "Continue" loads the saved world (shown only if a save exists).
const continueBtn = document.getElementById("continue-btn");
if (hasSave()) continueBtn.classList.remove("hidden");
continueBtn.addEventListener("click", () => {
  startGame({ load: true });
  menuEl.classList.add("hidden");
  canvas.requestPointerLock();
});

// Auto-save periodically and when the tab is hidden / closed.
setInterval(doSave, 20000);
window.addEventListener("beforeunload", doSave);
document.addEventListener("visibilitychange", () => { if (document.hidden) doSave(); });

// Toggle the inventory/crafting screen with E (releases the mouse while open).
window.addEventListener("keydown", (e) => {
  if (!started) return;
  if (e.code === "KeyE") {
    invUI.toggle();
    if (invUI.open && player.locked) document.exitPointerLock();
  } else if (e.code === "Escape" && invUI.open) {
    invUI.hide();
  }
});

// What a broken block yields (most drop themselves).
function dropOf(type) {
  return type; // grass→grass, stone→stone, etc.
}

// Break the block at (x,y,z): clear it and collect the drop.
function breakBlock(x, y, z) {
  const type = world.get(x, y, z);
  if (type === BLOCK.AIR || !world.isSolid(x, y, z)) return false;
  world.setBlock(x, y, z, BLOCK.AIR);
  inventory.add(dropOf(type), 1);
  return true;
}

// Place the selected hotbar item at (x,y,z), consuming one from the stack.
function placeBlock(x, y, z) {
  const idx = hotbar.index;
  const item = inventory.slots[idx];
  if (!item || !isPlaceableBlock(item.type)) return false;
  if (playerOccupies(x, y, z)) return false;
  if (world.get(x, y, z) !== BLOCK.AIR) return false;
  world.setBlock(x, y, z, item.type);
  inventory.removeAt(idx, 1);
  return true;
}

// --- Voxel ray traversal (Amanatides & Woo) ---
// Returns { block: [x,y,z], place: [x,y,z] } or null.
function raycastVoxel(maxDist = 6) {
  const origin = camera.position.clone();
  const dir = player.getForward().normalize();

  let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
  const stepX = Math.sign(dir.x), stepY = Math.sign(dir.y), stepZ = Math.sign(dir.z);

  const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;

  const distToBoundary = (s, o, step) =>
    step > 0 ? (Math.floor(o) + 1 - o) : (o - Math.floor(o));
  let tMaxX = dir.x !== 0 ? distToBoundary(x, origin.x, stepX) * tDeltaX : Infinity;
  let tMaxY = dir.y !== 0 ? distToBoundary(y, origin.y, stepY) * tDeltaY : Infinity;
  let tMaxZ = dir.z !== 0 ? distToBoundary(z, origin.z, stepZ) * tDeltaZ : Infinity;

  let nx = 0, ny = 0, nz = 0; // normal of the face we entered through
  let t = 0;

  while (t <= maxDist) {
    if (world.isSolid(x, y, z)) {
      return { block: [x, y, z], place: [x + nx, y + ny, z + nz] };
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0;
    } else if (tMaxY < tMaxZ) {
      y += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0;
    } else {
      z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ;
    }
  }
  return null;
}

// --- Mouse interaction ---
overlay.addEventListener("click", () => { if (player) player.requestLock(); });

document.addEventListener("mousedown", (e) => {
  if (!started || !player.locked) return;
  const hit = raycastVoxel();
  if (!hit) return;

  if (e.button === 0) {
    breakBlock(hit.block[0], hit.block[1], hit.block[2]);
  } else if (e.button === 2) {
    placeBlock(hit.place[0], hit.place[1], hit.place[2]);
  }
});

document.addEventListener("contextmenu", (e) => e.preventDefault());

// Light a Nether portal: press F while looking at an obsidian frame's interior.
window.addEventListener("keydown", (e) => {
  if (!started || e.code !== "KeyF" || !player.locked) return;
  const hit = raycastVoxel();
  if (!hit) return;
  const n = world.lightPortal(hit.place[0], hit.place[1], hit.place[2]) ||
            world.lightPortal(hit.block[0], hit.block[1], hit.block[2]);
  if (n > 0) flash(`Portal lit (${n} blocks)`);
});

function flash(msg) {
  clockEl.textContent = "✨ " + msg;
}

// --- Dimensions: portal travel between the Overworld and the Nether ---
const portalReturn = {};   // dimension -> {x,y,z} arrival point
let portalCooldown = 0;
let inPortalLastFrame = false;

// Build a complete obsidian portal (frame + platform + lit interior) in `w`
// around base (bx,by,bz); the frame lies in the X-Y plane at z = bz.
function createPortal(w, bx, by, bz) {
  const ground = w.mode === "nether" ? BLOCK.NETHERRACK : BLOCK.STONE;
  // Clear a pocket and lay a standing platform (extends in +z so you can
  // stand in front of the portal after arriving).
  for (let dx = -1; dx <= 2; dx++)
    for (let dz = -1; dz <= 2; dz++) {
      w.setBlock(bx + dx, by - 2, bz + dz, ground);
      for (let dy = -1; dy <= 4; dy++) w.setBlock(bx + dx, by + dy, bz + dz, BLOCK.AIR);
    }
  // Obsidian frame.
  for (let y = by - 1; y <= by + 3; y++) {
    w.setBlock(bx - 1, y, bz, BLOCK.OBSIDIAN);
    w.setBlock(bx + 2, y, bz, BLOCK.OBSIDIAN);
  }
  for (let x = bx - 1; x <= bx + 2; x++) {
    w.setBlock(x, by - 1, bz, BLOCK.OBSIDIAN);
    w.setBlock(x, by + 3, bz, BLOCK.OBSIDIAN);
  }
  w.lightPortal(bx, by, bz);
  return { x: bx + 0.5, y: by, z: bz + 1.5 }; // stand on the platform in front
}

function applyAtmosphere(dim) {
  if (dim === "nether") {
    scene.background.set(0x2a0a0a);
    scene.fog.color.set(0x2a0a0a);
    scene.fog.near = 8; scene.fog.far = 50;
    sun.color.set(0xff7744); sun.intensity = 0.3;
    ambient.color.set(0xff8866); ambient.intensity = 0.55;
  } else {
    scene.fog.near = 40; scene.fog.far = 80;
    sun.color.set(0xffffff); ambient.color.set(0xffffff);
    // dayNight drives sky colour + intensities each frame.
  }
}

function isPlayerInPortal() {
  const p = player.position;
  const x = Math.floor(p.x), z = Math.floor(p.z);
  return world.get(x, Math.floor(p.y + 0.1), z) === BLOCK.PORTAL ||
         world.get(x, Math.floor(p.y + 1.0), z) === BLOCK.PORTAL;
}

// Transport the player to the other dimension, creating it / an arrival portal
// on first visit. Returns the destination dimension name.
function travel() {
  const target = dimension === "overworld" ? "nether" : "overworld";

  // Remember where to return to in the dimension we're leaving.
  if (!portalReturn[dimension]) {
    portalReturn[dimension] = {
      x: player.position.x, y: player.position.y, z: player.position.z,
    };
  }

  if (target === "nether" && !nether) nether = new World({ mode: "nether" });
  const targetWorld = target === "nether" ? nether : overworld;

  // Ensure an arrival portal exists on the far side.
  if (!portalReturn[target]) {
    const cx = Math.min(Math.max(Math.floor(player.position.x), 3), targetWorld.sx - 4);
    const cz = Math.min(Math.max(Math.floor(player.position.z), 2), targetWorld.sz - 3);
    const by = target === "nether" ? 11 : targetWorld.heightAt(cx, cz) + 1;
    portalReturn[target] = createPortal(targetWorld, cx, by, cz);
  }

  // Swap the active world.
  scene.remove(world.group);
  world = targetWorld;
  scene.add(world.group);
  player.world = world;
  dimension = target;

  const a = portalReturn[target];
  player.position.set(a.x, a.y, a.z);
  player.velocity.set(0, 0, 0);
  applyAtmosphere(target);
  portalCooldown = 1.0;
  inPortalLastFrame = true; // don't immediately re-trigger on arrival
  return target;
}

function playerOccupies(x, y, z) {
  const p = player.position;
  const hw = player.halfWidth;
  return (
    x >= Math.floor(p.x - hw) && x <= Math.floor(p.x + hw) &&
    z >= Math.floor(p.z - hw) && z <= Math.floor(p.z + hw) &&
    y >= Math.floor(p.y) && y <= Math.floor(p.y + player.height)
  );
}

// Show/hide the start overlay with pointer lock (but not while the inventory
// screen is open).
document.addEventListener("pointerlockchange", () => {
  const locked = player && player.locked;
  overlay.classList.toggle("hidden", !started || locked || invUI.open);
});

// --- Resize ---
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Debug hook (used by the headless smoke test) ---
// Build an obsidian frame in the air above spawn and light it. Used by the
// smoke test to verify portal creation deterministically.
function buildTestPortal() {
  const bx = spawnX, bz = spawnZ, by = world.sy - 8;
  // Frame: interior 2 wide (bx..bx+1) x 3 tall (by..by+2), plane z = bz.
  for (let y = by - 1; y <= by + 3; y++) {
    world.setBlock(bx - 1, y, bz, BLOCK.OBSIDIAN);
    world.setBlock(bx + 2, y, bz, BLOCK.OBSIDIAN);
  }
  for (let x = bx - 1; x <= bx + 2; x++) {
    world.setBlock(x, by - 1, bz, BLOCK.OBSIDIAN);
    world.setBlock(x, by + 3, bz, BLOCK.OBSIDIAN);
  }
  // Clear interior to air, then ignite.
  for (let x = bx; x <= bx + 1; x++)
    for (let y = by; y <= by + 2; y++) world.setBlock(x, y, bz, BLOCK.AIR);
  return world.lightPortal(bx, by, bz);
}

window.__VOXELCRAFT__ = {
  ready: false,
  buildTestPortal,
  // Start a default world without going through the menu (used by smoke test).
  startGame: (opts) => startGame(opts),
  started: () => started,
  // Break the topmost solid block of a column and report the new item total.
  testCollect() {
    const before = inventory.totalItems();
    const x = 4, z = 4;
    for (let y = world.sy - 1; y >= 0; y--) {
      if (world.isSolid(x, y, z)) { breakBlock(x, y, z); break; }
    }
    return { before, after: inventory.totalItems(), used: inventory.usedSlots() };
  },
  // Craft planks from a log (used by the smoke test).
  testCraft() {
    inventory.add(BLOCK.WOOD, 1);
    const recipe = RECIPES.find((r) => r.out.type === BLOCK.PLANKS);
    const before = inventory.count(BLOCK.PLANKS);
    const ok = craft(inventory, recipe);
    return { ok, before, after: inventory.count(BLOCK.PLANKS) };
  },
  // Open the inventory screen and report the number of recipe rows shown.
  inspectCrafting() {
    invUI.show();
    const n = document.querySelectorAll("#inventory .craft-row").length;
    invUI.hide();
    return n;
  },
  // Spawn a hostile mob on top of the player and confirm it deals damage.
  testMobDamage() {
    const before = player.health;
    const m = spawnMob("zombie", Math.floor(player.position.x), Math.floor(player.position.z));
    if (m) { m.position.copy(player.position); m.attackCooldown = 0; }
    for (let i = 0; i < 5; i++) updateMobs(0.1);
    return { spawned: !!m, before, after: player.health, mobs: mobs.length };
  },
  healthHearts() {
    return document.querySelectorAll("#health .heart").length;
  },
  // Place a block, save, reload, and confirm it persisted.
  testSaveLoad() {
    const x = spawnX + 3, z = spawnZ + 3, y = world.heightAt(x, z) + 1;
    world.setBlock(x, y, z, BLOCK.OBSIDIAN);
    const hp = player.health;
    const saved = doSave();
    startGame({ load: true });
    return { saved, restored: world.get(x, y, z) === BLOCK.OBSIDIAN, health: player.health, hpBefore: hp };
  },
  // Programmatically travel to the Nether (used by the smoke test).
  enterNether() {
    if (dimension !== "nether") travel();
    return {
      dimension,
      netherrack: world.netherrackCount || 0,
      glowstone: world.glowstoneCount || 0,
      lava: world.lavaCount || 0,
    };
  },
  get state() {
    return {
      dimension,
      mobCount: mobs.length,
      health: player ? player.health : 0,
      inventoryUsed: inventory.usedSlots(),
      inventoryTotal: inventory.totalItems(),
      chunkCount: world.chunks.size,
      treeCount: overworld.treeCount,
      caveCount: overworld.caveCount,
      waterCount: overworld.waterCount,
      lavaCount: overworld.lavaCount,
      obsidianCount: overworld.obsidianCount,
      portalCount: overworld.portalCount || 0,
      worldSize: [world.sx, world.sy, world.sz],
      sampleHeights: [
        overworld.heightAt(8, 8),
        overworld.heightAt(40, 40),
        overworld.heightAt(80, 12),
      ],
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      playerY: player.position.y,
      timeOfDay: dayNight.t,
    };
  },
};

// --- Game loop ---
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05); // clamp to avoid tunneling on lag

  // Before a world is started, or while the inventory screen is open, just
  // render the current scene (menu/overlay sit on top in the DOM).
  if (!started || invUI.open) {
    renderer.render(scene, camera);
    window.__VOXELCRAFT__.ready = true;
    return;
  }

  player.update(dt);

  // Portal travel: trigger on the rising edge of entering a portal block.
  if (portalCooldown > 0) portalCooldown -= dt;
  const nowInPortal = isPlayerInPortal();
  if (nowInPortal && !inPortalLastFrame && portalCooldown <= 0) {
    const dest = travel();
    flash(dest === "nether" ? "Entering the NETHER" : "Back to the Overworld");
  } else {
    inPortalLastFrame = nowInPortal;
  }

  updateMobs(dt);
  updateSurvival(dt);

  if (dimension === "overworld") {
    dayNight.update(dt);
    clockEl.textContent = "🕐 " + dayNight.clock;
  } else {
    clockEl.textContent = "🔥 NETHER";
  }

  renderer.render(scene, camera);
  window.__VOXELCRAFT__.ready = true;
}
animate();
