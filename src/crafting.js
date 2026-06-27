import { BLOCK } from "./blocks.js";

// Shapeless recipes: a list of {type,count} inputs -> one {type,count} output.
export const RECIPES = [
  { name: "Planks", out: { type: BLOCK.PLANKS, count: 4 }, in: [{ type: BLOCK.WOOD, count: 1 }] },
  { name: "Sticks", out: { type: BLOCK.STICK, count: 4 }, in: [{ type: BLOCK.PLANKS, count: 2 }] },
  { name: "Crafting Table", out: { type: BLOCK.CRAFTING_TABLE, count: 1 }, in: [{ type: BLOCK.PLANKS, count: 4 }] },
  { name: "Torch", out: { type: BLOCK.TORCH, count: 4 }, in: [{ type: BLOCK.STICK, count: 1 }, { type: BLOCK.GLOWSTONE, count: 1 }] },
];

export function canCraft(inventory, recipe) {
  return recipe.in.every((ing) => inventory.count(ing.type) >= ing.count);
}

// Attempt to craft: consumes inputs, adds output. Returns true on success.
export function craft(inventory, recipe) {
  if (!canCraft(inventory, recipe)) return false;
  for (const ing of recipe.in) inventory.removeType(ing.type, ing.count);
  inventory.add(recipe.out.type, recipe.out.count);
  return true;
}
