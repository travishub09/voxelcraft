import * as THREE from "three";
import { BLOCK, BLOCK_TILES, tileUV, TILE_COUNT } from "./blocks.js";

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 32;

// Face definitions: dir to neighbor, 4 CCW corners, normal.
// Order matches BLOCK_TILES: +X,-X,+Y,-Y,+Z,-Z
const FACES = [
  { dir: [1, 0, 0], corners: [[1, 1, 1], [1, 0, 1], [1, 0, 0], [1, 1, 0]], normal: [1, 0, 0] },
  { dir: [-1, 0, 0], corners: [[0, 1, 0], [0, 0, 0], [0, 0, 1], [0, 1, 1]], normal: [-1, 0, 0] },
  { dir: [0, 1, 0], corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], normal: [0, 1, 0] },
  { dir: [0, -1, 0], corners: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]], normal: [0, -1, 0] },
  { dir: [0, 0, 1], corners: [[0, 1, 1], [0, 0, 1], [1, 0, 1], [1, 1, 1]], normal: [0, 0, 1] },
  { dir: [0, 0, -1], corners: [[1, 1, 0], [1, 0, 0], [0, 0, 0], [0, 1, 0]], normal: [0, 0, -1] },
];

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.data = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
    this.mesh = null;
    this.dirty = true;
  }

  static idx(x, y, z) {
    return x + CHUNK_SIZE * (y + WORLD_HEIGHT * z);
  }

  // local coords
  getLocal(x, y, z) {
    if (x < 0 || z < 0 || y < 0 || x >= CHUNK_SIZE || z >= CHUNK_SIZE || y >= WORLD_HEIGHT)
      return BLOCK.AIR;
    return this.data[Chunk.idx(x, y, z)];
  }

  setLocal(x, y, z, type) {
    if (x < 0 || z < 0 || y < 0 || x >= CHUNK_SIZE || z >= CHUNK_SIZE || y >= WORLD_HEIGHT)
      return;
    this.data[Chunk.idx(x, y, z)] = type;
    this.dirty = true;
  }
}

// Build geometry for a chunk. `world` is used for cross-chunk neighbor lookups
// so faces on chunk borders are culled correctly. Geometry is local to the
// chunk origin (mesh is positioned at cx*CHUNK_SIZE, 0, cz*CHUNK_SIZE).
export function buildChunkGeometry(world, chunk) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  let vert = 0;

  const ox = chunk.cx * CHUNK_SIZE;
  const oz = chunk.cz * CHUNK_SIZE;

  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const type = chunk.getLocal(x, y, z);
        if (type === BLOCK.AIR) continue;
        const faceTiles = BLOCK_TILES[type];

        for (let f = 0; f < FACES.length; f++) {
          const { dir, corners, normal } = FACES[f];
          // Neighbor in world space (handles chunk borders).
          if (world.get(ox + x + dir[0], y + dir[1], oz + z + dir[2]) !== BLOCK.AIR) continue;

          const [u0, u1] = tileUV(faceTiles[f]);
          const eps = 0.5 / (16 * TILE_COUNT);
          const uu0 = u0 + eps, uu1 = u1 - eps;
          const faceUV = [[uu0, 1], [uu0, 0], [uu1, 0], [uu1, 1]];

          for (let c = 0; c < 4; c++) {
            positions.push(x + corners[c][0], y + corners[c][1], z + corners[c][2]);
            normals.push(normal[0], normal[1], normal[2]);
            uvs.push(faceUV[c][0], faceUV[c][1]);
          }
          indices.push(vert, vert + 1, vert + 2, vert, vert + 2, vert + 3);
          vert += 4;
        }
      }
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeBoundingSphere();
  return geom;
}
