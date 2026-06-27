import * as THREE from "three";
import { BLOCK, BLOCK_TILES, buildAtlasCanvas, tileUV, TILE_COUNT } from "./blocks.js";

// Face definitions: direction vector, the 4 corner offsets (CCW), and normal.
// Order matches BLOCK_TILES face order: +X,-X,+Y,-Y,+Z,-Z
const FACES = [
  { dir: [1, 0, 0], corners: [[1, 1, 1], [1, 0, 1], [1, 0, 0], [1, 1, 0]], normal: [1, 0, 0] },   // +X
  { dir: [-1, 0, 0], corners: [[0, 1, 0], [0, 0, 0], [0, 0, 1], [0, 1, 1]], normal: [-1, 0, 0] },  // -X
  { dir: [0, 1, 0], corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], normal: [0, 1, 0] },    // +Y
  { dir: [0, -1, 0], corners: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]], normal: [0, -1, 0] },  // -Y
  { dir: [0, 0, 1], corners: [[0, 1, 1], [0, 0, 1], [1, 0, 1], [1, 1, 1]], normal: [0, 0, 1] },    // +Z
  { dir: [0, 0, -1], corners: [[1, 1, 0], [1, 0, 0], [0, 0, 0], [0, 1, 0]], normal: [0, 0, -1] },  // -Z
];

export class World {
  constructor(sizeX = 48, sizeY = 16, sizeZ = 48) {
    this.sx = sizeX;
    this.sy = sizeY;
    this.sz = sizeZ;
    this.data = new Uint8Array(sizeX * sizeY * sizeZ);

    this.mesh = null;
    this.material = this._buildMaterial();

    this.generateFlat();
  }

  _buildMaterial() {
    const tex = new THREE.CanvasTexture(buildAtlasCanvas());
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshLambertMaterial({ map: tex });
  }

  idx(x, y, z) {
    return x + this.sx * (y + this.sy * z);
  }

  inBounds(x, y, z) {
    return x >= 0 && y >= 0 && z >= 0 && x < this.sx && y < this.sy && z < this.sz;
  }

  get(x, y, z) {
    if (!this.inBounds(x, y, z)) return BLOCK.AIR;
    return this.data[this.idx(x, y, z)];
  }

  set(x, y, z, type) {
    if (!this.inBounds(x, y, z)) return;
    this.data[this.idx(x, y, z)] = type;
  }

  // Flat terrain: stone base, dirt, then a grass top layer.
  generateFlat() {
    const ground = 6; // grass top sits at y=6
    for (let x = 0; x < this.sx; x++) {
      for (let z = 0; z < this.sz; z++) {
        for (let y = 0; y <= ground; y++) {
          let t = BLOCK.STONE;
          if (y === ground) t = BLOCK.GRASS;
          else if (y >= ground - 2) t = BLOCK.DIRT;
          this.set(x, y, z, t);
        }
      }
    }
  }

  // Build (or rebuild) the chunk mesh with only exposed faces.
  buildMesh() {
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    let vert = 0;

    for (let x = 0; x < this.sx; x++) {
      for (let y = 0; y < this.sy; y++) {
        for (let z = 0; z < this.sz; z++) {
          const type = this.get(x, y, z);
          if (type === BLOCK.AIR) continue;
          const faceTiles = BLOCK_TILES[type];

          for (let f = 0; f < FACES.length; f++) {
            const { dir, corners, normal } = FACES[f];
            const nx = x + dir[0], ny = y + dir[1], nz = z + dir[2];
            if (this.get(nx, ny, nz) !== BLOCK.AIR) continue; // neighbor solid -> skip face

            const [u0, u1] = tileUV(faceTiles[f]);
            // Inset UVs slightly to avoid atlas bleeding between tiles.
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

    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.geometry = geom;
    } else {
      this.mesh = new THREE.Mesh(geom, this.material);
    }
    return this.mesh;
  }
}
