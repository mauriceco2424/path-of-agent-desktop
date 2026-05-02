/**
 * Slot to ItemClass Mapping Utility
 *
 * Maps equipment slot names (used in improvements) to item class names
 * (used in mod pool and crafting endpoints).
 *
 * Item class names follow the RePoE/PoB convention with Title Case.
 */

/**
 * Maps equipment slot names to item class names for crafting.
 * Keys are normalized slot names (lowercase), values are RePoE item class names.
 */
export const SLOT_TO_ITEM_CLASS: Record<string, string> = {
  // Armor slots
  helmet: 'Helmets',
  helm: 'Helmets',
  body: 'Body Armours',
  'body-armour': 'Body Armours',
  'body armour': 'Body Armours',
  chest: 'Body Armours',
  gloves: 'Gloves',
  boots: 'Boots',
  belt: 'Belts',

  // Accessories
  amulet: 'Amulets',
  ring: 'Rings',
  ring1: 'Rings',
  ring2: 'Rings',

  // Weapons - LIMITATION: Defaults all weapons to One Hand Swords.
  // This is incorrect for many builds (e.g., bows, staves, wands, two-handed weapons).
  // Callers should ideally determine the actual weapon type from the item's baseName
  // and use a more specific mapping. Consider returning null to force explicit type
  // specification, but keeping One Hand Swords for backwards compatibility.
  // TODO: Consider accepting weapon base type as parameter or returning null
  weapon: 'One Hand Swords',
  mainhand: 'One Hand Swords',
  'weapon 1': 'One Hand Swords',

  // Off-hand
  offhand: 'Shields',
  shield: 'Shields',
  'weapon 2': 'Shields',
  quiver: 'Quivers',

  // Flasks
  flask: 'Flasks',
  flask1: 'Flasks',
  flask2: 'Flasks',
  flask3: 'Flasks',
  flask4: 'Flasks',
  flask5: 'Flasks',

  // Tinctures (3.24+ Necropolis league)
  tincture: 'Tinctures',
  tincture1: 'Tinctures',
  tincture2: 'Tinctures',

  // Jewels
  jewel: 'Jewels',
  'abyss jewel': 'Abyss Jewels',
  'cluster jewel': 'Cluster Jewels',
};

/**
 * Get the item class for a given slot name.
 *
 * @param slot - The slot name (e.g., "helmet", "body-armour", "ring1")
 * @returns The item class name for crafting (e.g., "Helmets", "Body Armours", "Rings")
 */
export function getItemClassFromSlot(slot: string | undefined): string {
  if (!slot) {
    return 'Boots'; // Default fallback
  }

  const normalized = slot.toLowerCase().trim();
  return SLOT_TO_ITEM_CLASS[normalized] || 'Boots';
}

/**
 * Determine if a slot can be crafted (has a known item class mapping).
 *
 * @param slot - The slot name
 * @returns True if the slot has a known item class
 */
export function isSlotCraftable(slot: string | undefined): boolean {
  if (!slot) return false;
  const normalized = slot.toLowerCase().trim();
  return normalized in SLOT_TO_ITEM_CLASS;
}

export default SLOT_TO_ITEM_CLASS;
