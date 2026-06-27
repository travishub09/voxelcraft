import * as THREE from "three";
import { BLOCK, buildAtlasCanvas } from "./blocks.js";
import { Chunk, CHUNK_SIZE, WORLD_HEIGHT, buildChunkGeometries } from "./chunk.js";
import { terrainHeight, cellRandom, isCave } from "./noise.js";

// World = a grid of chunks. Voxels are addressed in global coordinates;
// the world routes reads/writes to the owning chunk and re-meshes only the
// chunks affected by an edit.
export class World {
  constructor({ chunksX = 6, chunksZ = 6, seed = 1337 } = {}) {
    this.chunksX = chunksX;
    this.chunksZ = chunksZ;
    this.seed = seed;
    this.sx = chunksX * CHUNK_SIZE;
    this.sy = WORLD_HEIGHT;
    this.sz = chunksZ * CHUNK_SIZE;

    this.seaLevel = 10;
    this.lavaLevel = 4;
    this.chunks = new Map(); // "cx,cz" -> Chunk
    this.group = new THREE.Group();
    const tex = this._buildAtlasTexture();
    this.material = new THREE.MeshLambertMaterial({ map: tex });
    this.waterMaterial = new THREE.MeshLambertMaterial({
      map: tex, transparent: true, opacity: 0.72, depthWrite: false,
    });
    // Lava glows (emissive) so it reads as molten even at night / underground.
    this.lavaMaterial = new THREE.MeshLambertMaterial({
      map: tex, emissive: 0xff7a18, emissiveMap: tex, emissiveIntensity: 0.9,
    });
    // Portal: translucent glowing purple.
    this.portalMaterial = new THREE.MeshLambertMaterial({
      map: tex, transparent: true, opacity: 0.7, depthWrite: false,
      emissive: 0xa13bd6, emissiveMap: tex, emissiveIntensity: 0.8,
    });

    this._createChunks();
  }

  _buildAtlasTexture() {
    const tex = new THREE.CanvasTexture(buildAtlasCanvas());
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  key(cx, cz) {
    return cx + "," + cz;
  }

  getChunk(cx, cz) {
    return this.chunks.get(this.key(cx, cz));
  }

  _createChunks() {
    for (let cz = 0; cz < this.chunksZ; cz++) {
      for (let cx = 0; cx < this.chunksX; cx++) {
        this.chunks.set(this.key(cx, cz), new Chunk(cx, cz));
      }
    }
    // Populate base terrain, decorate (trees) at world level so canopies can
    // cross chunk borders, then mesh everything.
    this.caveCount = 0;
    this.waterCount = 0;
    this.lavaCount = 0;
    this.obsidianCount = 0;
    for (const chunk of this.chunks.values()) this.generateChunk(chunk);
    this.decorateTrees();
    for (const chunk of this.chunks.values()) this.remeshChunk(chunk);
  }

  // Scatter trees on grass columns using a deterministic per-cell random.
  decorateTrees() {
    this.treeCount = 0;
    const margin = 2; // keep canopy inside world bounds
    for (let x = margin; x < this.sx - margin; x++) {
      for (let z = margin; z < this.sz - margin; z++) {
        if (cellRandom(x, z, this.seed ^ 0x5eed) > 0.015) continue; // ~1.5% of columns
        const h = this.heightAt(x, z);
        if (this.get(x, h, z) !== BLOCK.GRASS) continue;
        this.placeTree(x, h, z);
        this.treeCount++;
      }
    }
  }

  // Trunk + blobby leaf canopy. Uses global set() (routes across chunks).
  placeTree(x, groundY, z) {
    const trunkH = 4 + (cellRandom(x, z, this.seed) * 3 | 0); // 4..6
    const topY = groundY + trunkH;
    if (topY + 2 >= this.sy) return; // not enough headroom

    // Trunk: wood from just above the surface up to topY.
    for (let y = groundY + 1; y <= topY; y++) this.set(x, y, z, BLOCK.WOOD);

    // Canopy: two wide layers around the top, plus a small cap.
    const layers = [
      { dy: -1, r: 2 }, { dy: 0, r: 2 }, { dy: 1, r: 1 }, { dy: 2, r: 1 },
    ];
    for (const { dy, r } of layers) {
      const cy = topY + dy;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (dx === 0 && dz === 0 && dy <= 0) continue; // leave room for trunk
          // round off the corners of wide layers
          if (r === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          if (this.get(x + dx, cy, z + dz) === BLOCK.AIR) {
            this.set(x + dx, cy, z + dz, BLOCK.LEAVES);
          }
        }
      }
    }
  }

  inBounds(x, y, z) {
    return x >= 0 && y >= 0 && z >= 0 && x < this.sx && y < this.sy && z < this.sz;
  }

  // Solid = blocks the player. Air, fluids and portal don't.
  isSolid(x, y, z) {
    const t = this.get(x, y, z);
    return t !== BLOCK.AIR && t !== BLOCK.WATER && t !== BLOCK.LAVA && t !== BLOCK.PORTAL;
  }

  get(x, y, z) {
    if (!this.inBounds(x, y, z)) return BLOCK.AIR;
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return BLOCK.AIR;
    return chunk.getLocal(x - cx * CHUNK_SIZE, y, z - cz * CHUNK_SIZE);
  }

  // Low-level set without re-meshing (used during generation).
  set(x, y, z, type) {
    if (!this.inBounds(x, y, z)) return;
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (chunk) chunk.setLocal(x - cx * CHUNK_SIZE, y, z - cz * CHUNK_SIZE, type);
  }

  // Edit a block at runtime and re-mesh affected chunk(s).
  setBlock(x, y, z, type) {
    if (!this.inBounds(x, y, z)) return;
    this.set(x, y, z, type);
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    const lx = x - cx * CHUNK_SIZE, lz = z - cz * CHUNK_SIZE;

    const affected = new Set([this.key(cx, cz)]);
    // If on a border, the neighboring chunk's border faces change too.
    if (lx === 0) affected.add(this.key(cx - 1, cz));
    if (lx === CHUNK_SIZE - 1) affected.add(this.key(cx + 1, cz));
    if (lz === 0) affected.add(this.key(cx, cz - 1));
    if (lz === CHUNK_SIZE - 1) affected.add(this.key(cx, cz + 1));

    for (const k of affected) {
      const c = this.chunks.get(k);
      if (c) this.remeshChunk(c);
    }
  }

  // Attempt to ignite a Nether portal at an interior air cell. Tries both
  // vertical orientations (frame in the X-Y plane or the Z-Y plane). Returns
  // the number of portal blocks created (0 if there's no valid obsidian frame).
  lightPortal(x, y, z) {
    if (this.get(x, y, z) !== BLOCK.AIR) return 0;
    return this._tryLightPlane(x, y, z, "z") || this._tryLightPlane(x, y, z, "x");
  }

  _tryLightPlane(sx, sy, sz, across) {
    // Flood-fill the connected air region within the plane (the `across` axis
    // and Y vary; the third axis is fixed). Stop at any non-air boundary.
    const cells = [];
    const seen = new Set();
    const stack = [[sx, sy, sz]];
    const MAX = 30;
    const key = (a, b, c) => a + "," + b + "," + c;

    while (stack.length) {
      const [x, y, z] = stack.pop();
      const k = key(x, y, z);
      if (seen.has(k)) continue;
      seen.add(k);
      if (!this.inBounds(x, y, z) || this.get(x, y, z) !== BLOCK.AIR) continue; // boundary
      cells.push([x, y, z]);
      if (cells.length > MAX) return 0; // opening too large
      stack.push([x, y + 1, z], [x, y - 1, z]);
      if (across === "z") stack.push([x + 1, y, z], [x - 1, y, z]);
      else stack.push([x, y, z + 1], [x, y, z - 1]);
    }
    if (cells.length < 6) return 0; // need at least 2x3 interior

    // Bounding box across the two varying axes.
    let minY = Infinity, maxY = -Infinity, minA = Infinity, maxA = -Infinity;
    const aOf = ([x, , z]) => (across === "z" ? x : z);
    for (const c of cells) {
      minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]);
      const a = aOf(c); minA = Math.min(minA, a); maxA = Math.max(maxA, a);
    }
    const w = maxA - minA + 1, h = maxY - minY + 1;
    if (w < 2 || w > 4 || h < 3 || h > 5) return 0;
    if (cells.length !== w * h) return 0; // interior must be a full rectangle

    // Frame check: obsidian directly left/right of each row and above/below
    // each column (corners not required).
    const fixed = across === "z" ? sz : sx;
    const at = (a, y) => (across === "z" ? this.get(a, y, fixed) : this.get(fixed, y, a));
    for (let y = minY; y <= maxY; y++) {
      if (at(minA - 1, y) !== BLOCK.OBSIDIAN) return 0;
      if (at(maxA + 1, y) !== BLOCK.OBSIDIAN) return 0;
    }
    for (let a = minA; a <= maxA; a++) {
      if (at(a, minY - 1) !== BLOCK.OBSIDIAN) return 0;
      if (at(a, maxY + 1) !== BLOCK.OBSIDIAN) return 0;
    }

    // Valid frame — fill the interior with portal blocks.
    for (const [x, y, z] of cells) this.setBlock(x, y, z, BLOCK.PORTAL);
    this.portalCount = (this.portalCount || 0) + cells.length;
    return cells.length;
  }

  // Surface height at world (x, z). Baseline dips below sea level in valleys
  // so oceans/lakes form.
  heightAt(x, z) {
    return terrainHeight(x, z, { seed: this.seed, minH: 3, maxH: WORLD_HEIGHT - 8 });
  }

  // Procedural terrain for one chunk: stone interior, 3 dirt layers, grass cap.
  // Then carve caves into the subsurface with 3D noise.
  generateChunk(chunk) {
    const ox = chunk.cx * CHUNK_SIZE;
    const oz = chunk.cz * CHUNK_SIZE;
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = ox + x, wz = oz + z;
        const h = this.heightAt(wx, wz);
        for (let y = 0; y <= h; y++) {
          let t = BLOCK.STONE;
          if (y === h) t = BLOCK.GRASS;
          else if (y >= h - 3) t = BLOCK.DIRT;
          chunk.setLocal(x, y, z, t);
        }
        // Carve caves below the surface, keeping a 1-block floor and the
        // top 2 blocks (so the surface isn't riddled with holes).
        for (let y = 1; y <= h - 2; y++) {
          if (isCave(wx, y, wz, { seed: this.seed })) {
            chunk.setLocal(x, y, z, BLOCK.AIR);
            this.caveCount++;
          }
        }

        // Fill deep cave air with lava (molten pools at the bottom of caves).
        for (let y = 1; y <= this.lavaLevel; y++) {
          if (chunk.getLocal(x, y, z) === BLOCK.AIR) {
            chunk.setLocal(x, y, z, BLOCK.LAVA);
            this.lavaCount++;
          }
        }

        // Natural obsidian deposits in the stone just above the lava layer
        // (where molten rock has cooled). Gives players a source for portals.
        for (let y = this.lavaLevel + 1; y <= this.lavaLevel + 3; y++) {
          if (chunk.getLocal(x, y, z) !== BLOCK.STONE) continue;
          if (cellRandom(wx + y * 131, wz, this.seed ^ 0x0b51d) < 0.07) {
            chunk.setLocal(x, y, z, BLOCK.OBSIDIAN);
            this.obsidianCount++;
          }
        }

        // Flood air at/below sea level with water (oceans & lakes).
        for (let y = h + 1; y <= this.seaLevel; y++) {
          if (chunk.getLocal(x, y, z) === BLOCK.AIR) {
            chunk.setLocal(x, y, z, BLOCK.WATER);
            this.waterCount++;
          }
        }
      }
    }
  }

  remeshChunk(chunk) {
    const { opaque, water, lava, portal } = buildChunkGeometries(this, chunk);
    const px = chunk.cx * CHUNK_SIZE, pz = chunk.cz * CHUNK_SIZE;

    if (chunk.mesh) {
      chunk.mesh.geometry.dispose();
      chunk.mesh.geometry = opaque;
    } else {
      chunk.mesh = new THREE.Mesh(opaque, this.material);
      chunk.mesh.position.set(px, 0, pz);
      this.group.add(chunk.mesh);
    }

    this._updateLayerMesh(chunk, "waterMesh", water, this.waterMaterial, px, pz);
    this._updateLayerMesh(chunk, "lavaMesh", lava, this.lavaMaterial, px, pz);
    this._updateLayerMesh(chunk, "portalMesh", portal, this.portalMaterial, px, pz);
    chunk.dirty = false;
  }

  // Create/update/remove an optional secondary mesh layer (water or lava).
  _updateLayerMesh(chunk, prop, geom, material, px, pz) {
    if (geom) {
      if (chunk[prop]) {
        chunk[prop].geometry.dispose();
        chunk[prop].geometry = geom;
      } else {
        chunk[prop] = new THREE.Mesh(geom, material);
        chunk[prop].position.set(px, 0, pz);
        this.group.add(chunk[prop]);
      }
    } else if (chunk[prop]) {
      chunk[prop].geometry.dispose();
      this.group.remove(chunk[prop]);
      chunk[prop] = null;
    }
  }
}
