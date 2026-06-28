import { BLOCK_NAMES, blockIconDataURL } from "./blocks.js";
import { RECIPES, canCraft, craft } from "./crafting.js";

// The inventory + crafting screen (toggled with E). Shows all inventory slots
// and a list of recipes you can click to craft.
export class InventoryUI {
  constructor(containerEl, inventory, onCraft = null) {
    this.container = containerEl;
    this.inventory = inventory;
    this.onCraft = onCraft;
    this.open = false;
    this._iconCache = new Map();
    this._build();
  }

  _icon(type) {
    if (!this._iconCache.has(type)) this._iconCache.set(type, blockIconDataURL(type));
    return this._iconCache.get(type);
  }

  _build() {
    this.container.innerHTML = `
      <div class="inv-panel">
        <h2>Inventory</h2>
        <div class="inv-grid"></div>
        <h2>Crafting</h2>
        <div class="craft-list"></div>
        <p class="inv-hint">Press E or Esc to close</p>
      </div>`;
    this.gridEl = this.container.querySelector(".inv-grid");
    this.craftEl = this.container.querySelector(".craft-list");
  }

  show() { this.open = true; this.container.classList.remove("hidden"); this.refresh(); }
  hide() { this.open = false; this.container.classList.add("hidden"); }
  toggle() { this.open ? this.hide() : this.show(); }

  refresh() {
    if (!this.open) return;

    // Inventory slots.
    this.gridEl.innerHTML = "";
    this.inventory.slots.forEach((item, i) => {
      const cell = document.createElement("div");
      cell.className = "inv-cell" + (i < 9 ? " hotbar-row" : "");
      if (item) {
        const img = document.createElement("img");
        img.src = this._icon(item.type);
        img.draggable = false;
        img.title = BLOCK_NAMES[item.type];
        cell.appendChild(img);
        if (item.count > 1) {
          const c = document.createElement("span");
          c.className = "inv-cell-count";
          c.textContent = item.count;
          cell.appendChild(c);
        }
      }
      this.gridEl.appendChild(cell);
    });

    // Recipes.
    this.craftEl.innerHTML = "";
    for (const recipe of RECIPES) {
      const able = canCraft(this.inventory, recipe);
      const row = document.createElement("div");
      row.className = "craft-row" + (able ? "" : " disabled");

      const out = document.createElement("img");
      out.src = this._icon(recipe.out.type);
      out.className = "craft-out";
      out.draggable = false;
      row.appendChild(out);

      const label = document.createElement("div");
      label.className = "craft-label";
      const ins = recipe.in.map((i) => `${i.count} ${BLOCK_NAMES[i.type]}`).join(" + ");
      label.innerHTML = `<b>${recipe.name}</b> ×${recipe.out.count}<br><small>${ins}</small>`;
      row.appendChild(label);

      const btn = document.createElement("button");
      btn.className = "craft-btn";
      btn.textContent = "Craft";
      btn.disabled = !able;
      btn.addEventListener("click", () => {
        if (craft(this.inventory, recipe)) {
          if (this.onCraft) this.onCraft();
          this.refresh();
        }
      });
      row.appendChild(btn);

      this.craftEl.appendChild(row);
    }
  }
}
