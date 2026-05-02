/**
 * Shared flask constants used by EquipmentSlotItem and ItemTooltip.
 */

/**
 * Known flask base types in Path of Exile.
 * Used to extract flask type from raw item text.
 */
export const FLASK_BASE_TYPES = [
  // Life flasks
  'Small Life Flask', 'Medium Life Flask', 'Large Life Flask',
  'Greater Life Flask', 'Grand Life Flask', 'Giant Life Flask',
  'Colossal Life Flask', 'Sacred Life Flask', 'Hallowed Life Flask',
  'Sanctified Life Flask', 'Divine Life Flask', 'Eternal Life Flask',
  // Mana flasks
  'Small Mana Flask', 'Medium Mana Flask', 'Large Mana Flask',
  'Greater Mana Flask', 'Grand Mana Flask', 'Giant Mana Flask',
  'Colossal Mana Flask', 'Sacred Mana Flask', 'Hallowed Mana Flask',
  'Sanctified Mana Flask', 'Divine Mana Flask', 'Eternal Mana Flask',
  // Hybrid flasks
  'Small Hybrid Flask', 'Medium Hybrid Flask', 'Large Hybrid Flask',
  'Colossal Hybrid Flask', 'Sacred Hybrid Flask', 'Hallowed Hybrid Flask',
  // Utility flasks
  'Quicksilver Flask', 'Bismuth Flask', 'Stibnite Flask', 'Sulphur Flask',
  'Silver Flask', 'Basalt Flask', 'Granite Flask', 'Jade Flask',
  'Quartz Flask', 'Amethyst Flask', 'Ruby Flask', 'Sapphire Flask',
  'Topaz Flask', 'Aquamarine Flask', 'Diamond Flask', 'Gold Flask',
  'Corundum Flask', 'Iron Flask',
  // Tinctures (3.25+)
  'Ironwood Tincture', 'Prismatic Tincture', 'Rosethorn Tincture',
  'Ashbark Tincture', 'Borealwood Tincture', 'Fulgurite Tincture',
  'Blood Sap Tincture', 'Poisonberry Tincture', 'Sporebloom Tincture',
  'Oakbranch Tincture',
];

/**
 * Flask base effects - intrinsic effects for utility flasks.
 * These are NOT mods, they're part of the flask type definition.
 */
export const FLASK_BASE_EFFECTS: Record<string, string> = {
  'Jade Flask': '+3000 to Evasion Rating during Effect',
  'Granite Flask': '+1500 to Armour during Effect',
  'Quicksilver Flask': '40% increased Movement Speed during Effect',
  'Silver Flask': 'Onslaught during Effect',
  'Diamond Flask': 'Your Critical Strike Chance is Lucky during Effect',
  'Quartz Flask': 'Phasing during Effect, 10% chance to Dodge Attack and Spell Hits',
  'Amethyst Flask': '+35% to Chaos Resistance during Effect',
  'Ruby Flask': '+50% to Fire Resistance during Effect, 20% less Fire Damage taken',
  'Sapphire Flask': '+50% to Cold Resistance during Effect, 20% less Cold Damage taken',
  'Topaz Flask': '+50% to Lightning Resistance during Effect, 20% less Lightning Damage taken',
  'Aquamarine Flask': '+40% to Cold Resistance during Effect, Chill and Freeze Immunity',
  'Basalt Flask': '15% additional Physical Damage Reduction during Effect',
  'Stibnite Flask': 'Creates Smoke Cloud on Use, 100% increased Evasion Rating during Effect',
  'Sulphur Flask': 'Creates Consecrated Ground on Use, 40% increased Damage during Effect',
  'Bismuth Flask': '+35% to all Elemental Resistances during Effect',
  'Gold Flask': '20% increased Rarity of Items found during Effect',
  'Corundum Flask': '60% less Effect of Curses on you during Effect',
  'Iron Flask': 'Cannot be Stunned during Effect',
};
