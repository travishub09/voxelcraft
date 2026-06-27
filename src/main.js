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

// --- World ---
const world = new World();
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
window.__VOXELCRAFT__ = {
  ready: false,
  get state() {
    return {
      chunkCount: world.chunks.size,
      treeCount: world.treeCount,
      caveCount: world.caveCount,
      waterCount: world.waterCount,
      lavaCount: world.lavaCount,
      obsidianCount: world.obsidianCount,
      worldSize: [world.sx, world.sy, world.sz],
      sampleHeights: [
        world.heightAt(8, 8),
        world.heightAt(40, 40),
        world.heightAt(80, 12),
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
  dayNight.update(dt);
  clockEl.textContent = "🕐 " + dayNight.clock;
  renderer.render(scene, camera);
  window.__VOXELCRAFT__.ready = true;
}
animate();
