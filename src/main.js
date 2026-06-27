import * as THREE from "three";
import { World } from "./world.js";
import { Player } from "./player.js";
import { Hotbar } from "./hotbar.js";
import { DayNight } from "./daynight.js";
import { BLOCK } from "./blocks.js";

const canvas = document.getElementById("app");
const overlay = document.getElementById("overlay");
const clockEl = document.getElementById("clock");

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

// --- Scene ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 40, 80);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// --- Lighting + day/night cycle ---
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(40, 80, 20);
scene.add(sun);
const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);
const dayNight = new DayNight(scene, sun, ambient);

// --- Worlds / dimensions ---
const overworld = new World();
let nether = null;            // built lazily on first portal travel
let world = overworld;        // the active dimension
let dimension = "overworld";
scene.add(world.group);

// --- Player ---
const player = new Player(camera, world, canvas);
// Spawn just above the terrain surface at world center.
const spawnX = Math.floor(world.sx / 2), spawnZ = Math.floor(world.sz / 2);
player.position.set(spawnX + 0.5, world.heightAt(spawnX, spawnZ) + 2, spawnZ + 0.5);

// --- Block selection (hotbar) ---
const hotbar = new Hotbar(document.getElementById("hotbar"));

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
overlay.addEventListener("click", () => player.requestLock());

document.addEventListener("mousedown", (e) => {
  if (!player.locked) return;
  const hit = raycastVoxel();
  if (!hit) return;

  if (e.button === 0) {
    // Break
    world.setBlock(hit.block[0], hit.block[1], hit.block[2], BLOCK.AIR);
  } else if (e.button === 2) {
    // Place (don't place inside the player)
    const [px, py, pz] = hit.place;
    if (!playerOccupies(px, py, pz)) {
      world.setBlock(px, py, pz, hotbar.selectedBlock);
    }
  }
});

document.addEventListener("contextmenu", (e) => e.preventDefault());

// Light a Nether portal: press F while looking at an obsidian frame's interior.
window.addEventListener("keydown", (e) => {
  if (e.code !== "KeyF" || !player.locked) return;
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

// Show/hide overlay with pointer lock.
document.addEventListener("pointerlockchange", () => {
  overlay.classList.toggle("hidden", player.locked);
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
