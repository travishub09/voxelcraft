// A simple stacked inventory: 36 slots, the first 9 of which are the hotbar.
// Breaking blocks adds items; placing/crafting removes them.
export const MAX_STACK = 64;
export const HOTBAR_SIZE = 9;
export const INV_SIZE = 36;

export class Inventory {
  constructor() {
    this.slots = new Array(INV_SIZE).fill(null); // each slot: { type, count } | null
    this.onChange = null;
  }

  _changed() { if (this.onChange) this.onChange(); }

  // Add `count` of a block type; returns the number that didn't fit.
  add(type, count = 1) {
    let remaining = count;
    // Top up existing stacks first.
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      const s = this.slots[i];
      if (s && s.type === type && s.count < MAX_STACK) {
        const can = Math.min(MAX_STACK - s.count, remaining);
        s.count += can; remaining -= can;
      }
    }
    // Then fill empty slots.
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      if (!this.slots[i]) {
        const can = Math.min(MAX_STACK, remaining);
        this.slots[i] = { type, count: can }; remaining -= can;
      }
    }
    this._changed();
    return remaining;
  }

  // Remove up to `count` from a specific slot; returns how many were removed.
  removeAt(index, count = 1) {
    const s = this.slots[index];
    if (!s) return 0;
    const removed = Math.min(s.count, count);
    s.count -= removed;
    if (s.count <= 0) this.slots[index] = null;
    this._changed();
    return removed;
  }

  // Total of a type across all slots.
  count(type) {
    let n = 0;
    for (const s of this.slots) if (s && s.type === type) n += s.count;
    return n;
  }

  // Remove `count` of a type from anywhere; returns how many were removed.
  removeType(type, count) {
    let need = count;
    for (let i = 0; i < this.slots.length && need > 0; i++) {
      const s = this.slots[i];
      if (s && s.type === type) {
        const r = Math.min(s.count, need);
        s.count -= r; need -= r;
        if (s.count <= 0) this.slots[i] = null;
      }
    }
    this._changed();
    return count - need;
  }

  totalItems() {
    let n = 0;
    for (const s of this.slots) if (s) n += s.count;
    return n;
  }

  usedSlots() {
    return this.slots.filter(Boolean).length;
  }

  clear() {
    this.slots.fill(null);
    this._changed();
  }
}
