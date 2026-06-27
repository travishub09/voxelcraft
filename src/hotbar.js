import { PLACEABLE, BLOCK_NAMES, blockIconDataURL } from "./blocks.js";

// Minecraft-style hotbar: a row of slots, one per placeable block, with the
// selected slot highlighted. Selection via number keys, mouse wheel, or click.
export class Hotbar {
  constructor(containerEl) {
    this.container = containerEl;
    this.index = 0;
    this.slots = [];
    this._build();
    this._initInput();
  }

  _build() {
    this.container.innerHTML = "";
    PLACEABLE.forEach((type, i) => {
      const slot = document.createElement("div");
      slot.className = "hotbar-slot";

      const img = document.createElement("img");
      img.src = blockIconDataURL(type);
      img.alt = BLOCK_NAMES[type];
      img.draggable = false;
      slot.appendChild(img);

      const num = document.createElement("span");
      num.className = "hotbar-num";
      num.textContent = String(i + 1);
      slot.appendChild(num);

      const name = document.createElement("span");
      name.className = "hotbar-name";
      name.textContent = BLOCK_NAMES[type];
      slot.appendChild(name);

      slot.addEventListener("click", () => this.select(i));
      this.container.appendChild(slot);
      this.slots.push(slot);
    });
    this._refresh();
  }

  _initInput() {
    window.addEventListener("keydown", (e) => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= PLACEABLE.length) this.select(n - 1);
    });
    window.addEventListener("wheel", (e) => {
      const dir = Math.sign(e.deltaY);
      this.select((this.index + dir + PLACEABLE.length) % PLACEABLE.length);
    }, { passive: true });
  }

  select(i) {
    this.index = i;
    this._refresh();
  }

  _refresh() {
    this.slots.forEach((s, i) => s.classList.toggle("selected", i === this.index));
  }

  get selectedBlock() {
    return PLACEABLE[this.index];
  }
}
