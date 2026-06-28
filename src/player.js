import * as THREE from "three";

// First-person controller: pointer-lock mouse look + WASD/jump with
// simple AABB voxel collision and gravity.
export class Player {
  constructor(camera, world, domElement) {
    this.camera = camera;
    this.world = world;
    this.dom = domElement;

    // Player AABB half-extents (a ~0.6 wide, 1.8 tall capsule-ish box).
    this.halfWidth = 0.3;
    this.height = 1.8;
    this.eyeOffset = 1.62; // eye height from feet

    // Spawn above the terrain near the middle.
    this.position = new THREE.Vector3(world.sx / 2, world.sy, world.sz / 2);
    this.velocity = new THREE.Vector3();
    this.onGround = false;

    this.yaw = 0;
    this.pitch = 0;

    // Survival stats.
    this.maxHealth = 20;
    this.health = 20;
    this.regenTimer = 0;
    this.hurtFlash = 0;       // seconds of red flash remaining (for UI)
    this.fallPeakY = this.position.y;

    this.keys = {};
    this.locked = false;

    this.speed = 5.0;       // m/s walking
    this.jumpSpeed = 8.0;
    this.gravity = -25.0;

    this._initInput();
  }

  _initInput() {
    document.addEventListener("keydown", (e) => { this.keys[e.code] = true; });
    document.addEventListener("keyup", (e) => { this.keys[e.code] = false; });

    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === this.dom;
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      const sens = 0.0022;
      this.yaw -= e.movementX * sens;
      this.pitch -= e.movementY * sens;
      const lim = Math.PI / 2 - 0.01;
      this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
    });
  }

  requestLock() {
    this.dom.requestPointerLock();
  }

  damage(amount) {
    if (amount <= 0 || this.health <= 0) return;
    this.health = Math.max(0, this.health - amount);
    this.regenTimer = 0;
    this.hurtFlash = 0.3;
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  get dead() {
    return this.health <= 0;
  }

  // Direction the camera is looking (unit vector).
  getForward() {
    const dir = new THREE.Vector3(0, 0, -1);
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, "YXZ");
    dir.applyEuler(euler);
    return dir;
  }

  // Does the player AABB at the given center collide with any solid voxel?
  // Water is not solid, so the player can wade/sink into it.
  _collides(px, py, pz) {
    const hw = this.halfWidth;
    const minX = Math.floor(px - hw), maxX = Math.floor(px + hw);
    const minY = Math.floor(py), maxY = Math.floor(py + this.height);
    const minZ = Math.floor(pz - hw), maxZ = Math.floor(pz + hw);
    for (let x = minX; x <= maxX; x++)
      for (let y = minY; y <= maxY; y++)
        for (let z = minZ; z <= maxZ; z++)
          if (this.world.isSolid(x, y, z)) return true;
    return false;
  }

  update(dt) {
    // --- Horizontal input relative to yaw ---
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const move = new THREE.Vector3();
    if (this.keys["KeyW"]) move.add(forward);
    if (this.keys["KeyS"]) move.sub(forward);
    if (this.keys["KeyD"]) move.add(right);
    if (this.keys["KeyA"]) move.sub(right);
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(this.speed);

    this.velocity.x = move.x;
    this.velocity.z = move.z;

    if (this.keys["Space"] && this.onGround) {
      this.velocity.y = this.jumpSpeed;
      this.onGround = false;
    }

    this.velocity.y += this.gravity * dt;

    // --- Move axis-by-axis with collision resolution ---
    const p = this.position;
    const wasOnGround = this.onGround;

    p.x += this.velocity.x * dt;
    if (this._collides(p.x, p.y, p.z)) { p.x -= this.velocity.x * dt; this.velocity.x = 0; }

    p.z += this.velocity.z * dt;
    if (this._collides(p.x, p.y, p.z)) { p.z -= this.velocity.z * dt; this.velocity.z = 0; }

    p.y += this.velocity.y * dt;
    if (this._collides(p.x, p.y, p.z)) {
      const goingDown = this.velocity.y < 0;
      p.y -= this.velocity.y * dt;
      if (goingDown) this.onGround = true;
      this.velocity.y = 0;
    } else {
      this.onGround = false;
    }

    // --- Fall damage ---
    if (this.onGround) {
      if (!wasOnGround) {
        const fall = this.fallPeakY - p.y;
        if (fall > 4) this.damage(Math.floor(fall - 3));
      }
      this.fallPeakY = p.y;
    } else {
      this.fallPeakY = Math.max(this.fallPeakY, p.y);
    }

    // --- Health regen + hurt flash timers ---
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    if (this.health > 0 && this.health < this.maxHealth) {
      this.regenTimer += dt;
      if (this.regenTimer >= 3) { this.heal(1); this.regenTimer = 0; }
    }

    // Respawn if we somehow fall out of the world.
    if (p.y < -20) {
      p.set(this.world.sx / 2, this.world.sy, this.world.sz / 2);
      this.velocity.set(0, 0, 0);
      this.fallPeakY = p.y;
    }

    // --- Sync camera ---
    this.camera.position.set(p.x, p.y + this.eyeOffset, p.z);
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, "YXZ"));
  }
}
