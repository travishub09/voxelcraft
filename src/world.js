import * as THREE from "three";
import { BLOCK, buildAtlasCanvas } from "./blocks.js";
import { Chunk, CHUNK_SIZE, WORLD_HEIGHT, buildChunkGeometry } from "./chunk.js";
import { terrainHeight } from "./noise.js";

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

    this.chunks = new Map(); // "cx,cz" -> Chunk
    this.group = new THREE.Group();
    this.material = this._buildMaterial();

    this._createChunks();
  }

  _buildMaterial() {
    const tex = new THREE.CanvasTexture(buildAtlasCanvas());
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshLambertMaterial({ map: tex });
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
    // Populate with terrain, then mesh.
    for (const chunk of this.chunks.values()) this.generateChunk(chunk);
    for (const chunk of this.chunks.values()) this.remeshChunk(chunk);
  }

  inBounds(x, y, z) {
    return x >= 0 && y >= 0 && z >= 0 && x < this.sx && y < this.sy && z < this.sz;
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

  // Surface height at world (x, z).
  heightAt(x, z) {
    return terrainHeight(x, z, { seed: this.seed, minH: 4, maxH: WORLD_HEIGHT - 4 });
  }

  // Procedural terrain for one chunk: stone interior, 3 dirt layers, grass cap.
  generateChunk(chunk) {
    const ox = chunk.cx * CHUNK_SIZE;
    const oz = chunk.cz * CHUNK_SIZE;
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const h = this.heightAt(ox + x, oz + z);
        for (let y = 0; y <= h; y++) {
          let t = BLOCK.STONE;
          if (y === h) t = BLOCK.GRASS;
          else if (y >= h - 3) t = BLOCK.DIRT;
          chunk.setLocal(x, y, z, t);
        }
      }
    }
  }

  remeshChunk(chunk) {
    const geom = buildChunkGeometry(this, chunk);
    if (chunk.mesh) {
      chunk.mesh.geometry.dispose();
      chunk.mesh.geometry = geom;
    } else {
      chunk.mesh = new THREE.Mesh(geom, this.material);
      chunk.mesh.position.set(chunk.cx * CHUNK_SIZE, 0, chunk.cz * CHUNK_SIZE);
      this.group.add(chunk.mesh);
    }
    chunk.dirty = false;
  }
}
