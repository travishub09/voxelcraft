// Persist a world to localStorage. We don't store every voxel — the world
// regenerates deterministically from its seed, so we only save the seed plus
// the player's runtime edits, inventory, position, and time of day.
const KEY = "voxelcraft_save_v1";

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function saveGame(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
  catch { return false; }
}

export function loadGame() {
  try {
    const s = localStorage.getItem(KEY);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
