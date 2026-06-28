import * as THREE from "three";
import { BLOCK } from "./blocks.js";

// Shared geometry/material per mob kind (cheap; many mobs reuse them).
const KINDS = {
  pig: { color: 0xe89aa6, head: 0xe89aa6, hostile: false, speed: 1.4, health: 10, width: 0.7, height: 0.8 },
  zombie: { color: 0x4a7a3a, head: 0x3a5f2c, hostile: true, speed: 2.2, health: 14, width: 0.6, height: 1.7 },
};

function buildMesh(kind) {
  const k = KINDS[kind];
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: k.color });
  const headMat = new THREE.MeshLambertMaterial({ color: k.head });

  const bodyH = k.height * 0.62;
  const body = new THREE.Mesh(new THREE.BoxGeometry(k.width, bodyH, k.width * 0.8), bodyMat);
  body.position.y = bodyH / 2 + k.height * 0.18;
  g.add(body);

  const headSize = k.width * 0.7;
  const head = new THREE.Mesh(new THREE.BoxGeometry(headSize, headSize, headSize), headMat);
  head.position.set(0, k.height * 0.18 + bodyH + headSize * 0.2, k.width * 0.3);
  g.add(head);

  // Eyes (so you can tell which way it faces).
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  for (const dx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.04), eyeMat);
    eye.position.set(dx * headSize * 0.25, head.position.y + 0.03, k.width * 0.3 + headSize / 2);
    g.add(eye);
  }

  // Four legs.
  const legH = k.height * 0.18;
  const legMat = new THREE.MeshLambertMaterial({ color: k.head });
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, legH, 0.16), legMat);
    leg.position.set(dx * k.width * 0.28, legH / 2, dz * k.width * 0.25);
    g.add(leg);
  }
  return g;
}

export class Mob {
  constructor(world, kind, x, y, z) {
    const k = KINDS[kind];
    this.world = world;
    this.kind = kind;
    this.hostile = k.hostile;
    this.width = k.width;
    this.height = k.height;
    this.speed = k.speed;
    this.health = k.health;
    this.damage = k.hostile ? 3 : 0;

    this.position = new THREE.Vector3(x, y, z);
    this.velocity = new THREE.Vector3();
    this.onGround = false;
    this.yaw = Math.random() * Math.PI * 2;
    this.wanderTimer = 0;
    this.attackCooldown = 0;
    this.dead = false;

    this.mesh = buildMesh(kind);
    this.mesh.position.copy(this.position);
  }

  _collides(px, py, pz) {
    const hw = this.width / 2;
    const minX = Math.floor(px - hw), maxX = Math.floor(px + hw);
    const minY = Math.floor(py), maxY = Math.floor(py + this.height);
    const minZ = Math.floor(pz - hw), maxZ = Math.floor(pz + hw);
    for (let x = minX; x <= maxX; x++)
      for (let y = minY; y <= maxY; y++)
        for (let z = minZ; z <= maxZ; z++)
          if (this.world.isSolid(x, y, z)) return true;
    return false;
  }

  update(dt, targetPos) {
    if (this.attackCooldown > 0) this.attackCooldown -= dt;

    // --- Decide heading ---
    let dirX = 0, dirZ = 0;
    const toTarget = targetPos ? targetPos.clone().sub(this.position) : null;
    const dist = toTarget ? Math.hypot(toTarget.x, toTarget.z) : Infinity;

    if (this.hostile && dist < 16) {
      // Chase the player.
      this.yaw = Math.atan2(toTarget.x, toTarget.z);
      dirX = Math.sin(this.yaw); dirZ = Math.cos(this.yaw);
    } else {
      // Wander: pick a new heading every few seconds.
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 2 + Math.random() * 3;
        this.yaw = Math.random() * Math.PI * 2;
        this.moving = Math.random() > 0.3;
      }
      if (this.moving) { dirX = Math.sin(this.yaw); dirZ = Math.cos(this.yaw); }
    }

    this.velocity.x = dirX * this.speed;
    this.velocity.z = dirZ * this.speed;

    // Jump if walking into a wall while grounded.
    const ahead = this._collides(this.position.x + dirX * 0.4, this.position.y, this.position.z + dirZ * 0.4);
    if (ahead && this.onGround) this.velocity.y = 7;

    this.velocity.y += -25 * dt;

    // --- Axis-separated collision ---
    const p = this.position;
    p.x += this.velocity.x * dt;
    if (this._collides(p.x, p.y, p.z)) { p.x -= this.velocity.x * dt; this.velocity.x = 0; }
    p.z += this.velocity.z * dt;
    if (this._collides(p.x, p.y, p.z)) { p.z -= this.velocity.z * dt; this.velocity.z = 0; }
    p.y += this.velocity.y * dt;
    if (this._collides(p.x, p.y, p.z)) {
      const down = this.velocity.y < 0;
      p.y -= this.velocity.y * dt;
      if (down) this.onGround = true;
      this.velocity.y = 0;
    } else {
      this.onGround = false;
    }

    if (p.y < -20) this.dead = true; // fell out of world

    this.mesh.position.copy(p);
    this.mesh.rotation.y = this.yaw;
  }
}
