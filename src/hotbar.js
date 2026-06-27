import { BLOCK_NAMES, blockIconDataURL } from "./blocks.js";
import { HOTBAR_SIZE } from "./inventory.js";

// Inventory-backed hotbar: renders the first 9 inventory slots with item icons
// and stack counts. Selection via number keys (1–9), mouse wheel, or click.
export class Hotbar {
  constructor(containerEl, inventory) {
    this.container = containerEl;
    this.inventory = inventory;
    this.index = 0;
    this.slots = [];
    this._iconCache = new Map();
    this._build();
    this._initInput();
    inventory.onChange = () => this.refresh();
  }

  _icon(type) {
    if (!this._iconCache.has(type)) this._iconCache.set(type, blockIconDataURL(type));
    return this._iconCache.get(type);
  }

  _build() {
    this.container.innerHTML = "";
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slot = document.createElement("div");
      slot.className = "hotbar-slot";

      const img = document.createElement("img");
      img.draggable = false;
      slot.appendChild(img);

      const count = document.createElement("span");
      count.className = "hotbar-count";
      slot.appendChild(count);

      const num = document.createElement("span");
      num.className = "hotbar-num";
      num.textContent = String(i + 1);
      slot.appendChild(num);

      const name = document.createElement("span");
      name.className = "hotbar-name";
      slot.appendChild(name);

      slot.addEventListener("click", () => this.select(i));
      this.container.appendChild(slot);
      this.slots.push({ el: slot, img, count, name });
    }
    this.refresh();
  }

  _initInput() {
    window.addEventListener("keydown", (e) => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= HOTBAR_SIZE) this.select(n - 1);
    });
    window.addEventListener("wheel", (e) => {
      const dir = Math.sign(e.deltaY);
      this.select((this.index + dir + HOTBAR_SIZE) % HOTBAR_SIZE);
    }, { passive: true });
  }

  select(i) {
    this.index = i;
    this.refresh();
  }

  refresh() {
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const item = this.inventory.slots[i];
      const ui = this.slots[i];
      ui.el.classList.toggle("selected", i === this.index);
      if (item) {
        ui.img.src = this._icon(item.type);
        ui.img.style.visibility = "visible";
        ui.count.textContent = item.count > 1 ? item.count : "";
        ui.name.textContent = BLOCK_NAMES[item.type] || "";
      } else {
        ui.img.removeAttribute("src");
        ui.img.style.visibility = "hidden";
        ui.count.textContent = "";
        ui.name.textContent = "";
      }
    }
  }

  // The block type in the selected slot, or null if empty.
  get selectedType() {
    const item = this.inventory.slots[this.index];
    return item ? item.type : null;
  }
}
