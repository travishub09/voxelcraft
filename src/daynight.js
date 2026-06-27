import * as THREE from "three";

// Drives a day/night cycle: moves the sun, fades sky/fog colour, and adjusts
// light intensity. One full cycle takes `dayLength` seconds.
export class DayNight {
  constructor(scene, sun, ambient, { dayLength = 120, start = 0.28 } = {}) {
    this.scene = scene;
    this.sun = sun;
    this.ambient = ambient;
    this.dayLength = dayLength;
    this.t = start; // 0..1 (0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset)

    this.radius = 120;

    // Palette
    this.daySky = new THREE.Color(0x87ceeb);
    this.nightSky = new THREE.Color(0x0a0a23);
    this.duskSky = new THREE.Color(0xffa860);
    this._color = new THREE.Color();

    this.update(0);
  }

  // Sun elevation factor: 1 at noon, 0 at horizon, negative at night.
  get _elevation() {
    return Math.sin((this.t - 0.25) * Math.PI * 2);
  }

  update(dt) {
    this.t = (this.t + dt / this.dayLength) % 1;

    const angle = (this.t - 0.25) * Math.PI * 2;
    const elev = Math.sin(angle);
    const horiz = Math.cos(angle);

    // Move the sun across the sky.
    this.sun.position.set(horiz * this.radius, elev * this.radius, this.radius * 0.35);

    // Daylight strength: 0 at/under horizon, ramps up with elevation.
    const day = Math.max(0, elev);
    this.sun.intensity = 0.15 + day * 1.5;
    this.ambient.intensity = 0.2 + day * 0.45;

    // Sky colour: night -> (dusk tint near horizon) -> day.
    // Dusk weight peaks when the sun is near the horizon.
    const dusk = Math.max(0, 1 - Math.abs(elev) * 4) * (this.t > 0.1 && this.t < 0.9 ? 1 : 0.3);
    this._color.copy(this.nightSky).lerp(this.daySky, Math.min(1, day * 2.2));
    this._color.lerp(this.duskSky, dusk * 0.5);

    this.scene.background.copy(this._color);
    if (this.scene.fog) this.scene.fog.color.copy(this._color);
  }

  // Human-friendly clock string (24h).
  get clock() {
    const mins = Math.floor(this.t * 24 * 60);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
}
