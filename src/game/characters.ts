export interface CharacterModifiers {
  heatMultiplier: number           // multiplied against heat generated (default 1.0)
  heatDecayMultiplier: number      // multiplied against heat decay per idle season
  cargoMultiplier: number          // multiplied against max cargo capacity
  movementBonus: number            // flat dice roll bonus (additive)
  movementMultiplier: number       // multiplied against movement roll
  productionMultiplier: number     // multiplied against seasonal output
  upgradeCostMultiplier: number    // multiplied against distillery upgrade cost
  takeoverCostMultiplier: number   // multiplied against hostile takeover price
  bribeBaseDuration: number        // seasons a long-term bribe lasts
  sellPriceMultiplier: number      // multiplied against sell price in any city
  coastalProductionMultiplier: number  // production multiplier for owned coastal cities
  medicinalPriceMultiplier: number // sell price for Medicinal Spirits (Pharmacist only)
}

const DEFAULT_MODIFIERS: CharacterModifiers = {
  heatMultiplier: 1.0,
  heatDecayMultiplier: 1.0,
  cargoMultiplier: 1.0,
  movementBonus: 0,
  movementMultiplier: 1.0,
  productionMultiplier: 1.0,
  upgradeCostMultiplier: 1.0,
  takeoverCostMultiplier: 1.0,
  bribeBaseDuration: 4,
  sellPriceMultiplier: 1.0,
  coastalProductionMultiplier: 1.0,
  medicinalPriceMultiplier: 1.0,
}

export interface CharacterClass {
  id: string
  name: string
  perk: string
  drawback: string
  modifiers: CharacterModifiers
}

export const CHARACTER_CLASSES: Record<string, CharacterClass> = {
  priest_nun: {
    id: 'priest_nun',
    name: 'The Priest / Nun',
    perk: '-25% Police Heat generation',
    drawback: '-20% Vehicle Cargo Capacity',
    modifiers: { ...DEFAULT_MODIFIERS, heatMultiplier: 0.75, heatDecayMultiplier: 2.0, cargoMultiplier: 0.8 }
  },
  hillbilly: {
    id: 'hillbilly',
    name: 'The Hillbilly',
    perk: '-20% Distillation Upgrade costs',
    drawback: '-10% Movement Roll',
    modifiers: { ...DEFAULT_MODIFIERS, upgradeCostMultiplier: 0.8, movementMultiplier: 0.9 }
  },
  gangster: {
    id: 'gangster',
    name: 'The Gangster',
    perk: 'Claim cities 25% cheaper',
    drawback: '+20% Police Heat generation',
    modifiers: { ...DEFAULT_MODIFIERS, takeoverCostMultiplier: 0.75, heatMultiplier: 1.2 }
  },
  vixen: {
    id: 'vixen',
    name: 'The Vixen',
    perk: 'Bribes last 6 seasons (vs 4)',
    drawback: '-10% Alcohol production volume',
    modifiers: { ...DEFAULT_MODIFIERS, bribeBaseDuration: 6, productionMultiplier: 0.9 }
  },
  pharmacist: {
    id: 'pharmacist',
    name: 'The Pharmacist',
    perk: 'Sell whiskey at +50% market value (medicinal prescription)',
    drawback: 'Hostile Takeover costs +25%',
    modifiers: { ...DEFAULT_MODIFIERS, takeoverCostMultiplier: 1.25, medicinalPriceMultiplier: 1.5 }
  },
  jazz_singer: {
    id: 'jazz_singer',
    name: 'The Jazz Singer',
    perk: 'Passive income each season in owned large/major cities',
    drawback: '+15% Police Heat generation',
    modifiers: { ...DEFAULT_MODIFIERS, heatMultiplier: 1.15 }
  },
  bootlegger: {
    id: 'bootlegger',
    name: 'The Bootlegger (Clyde)',
    perk: 'All dice rolls get a permanent +2 bonus',
    drawback: '+20% Police Heat generation',
    modifiers: { ...DEFAULT_MODIFIERS, movementBonus: 2, heatMultiplier: 1.2 }
  },
  socialite: {
    id: 'socialite',
    name: 'The Socialite (Eleanor)',
    perk: 'Sell alcohol in any city at +25% market value',
    drawback: '-20% Alcohol production from all stills',
    modifiers: { ...DEFAULT_MODIFIERS, sellPriceMultiplier: 1.25, productionMultiplier: 0.8 }
  },
  union_leader: {
    id: 'union_leader',
    name: 'The Union Leader (Big Mike)',
    perk: '+20% Alcohol production from all stills',
    drawback: 'Hostile Takeovers cost +20%',
    modifiers: { ...DEFAULT_MODIFIERS, productionMultiplier: 1.2, takeoverCostMultiplier: 1.2 }
  },
  rum_runner: {
    id: 'rum_runner',
    name: 'The Rum-Runner (Captain Morgan)',
    perk: 'Owned coastal cities produce double volume',
    drawback: '-15% Sell price everywhere (sells wholesale)',
    modifiers: { ...DEFAULT_MODIFIERS, coastalProductionMultiplier: 2.0, sellPriceMultiplier: 0.85 }
  },
  // ── NPC archetypes ─────────────────────────────────────────────────────────
  npc_merchant: {
    id: 'npc_merchant',
    name: 'The Merchant',
    perk: 'Sells all distillery stock every season',
    drawback: '',
    modifiers: { ...DEFAULT_MODIFIERS }
  },
  npc_expander: {
    id: 'npc_expander',
    name: 'The Expander',
    perk: 'Claims neutral cities aggressively',
    drawback: '',
    modifiers: { ...DEFAULT_MODIFIERS }
  },
  npc_industrialist: {
    id: 'npc_industrialist',
    name: 'The Industrialist',
    perk: '+10% production; upgrades stills as first priority',
    drawback: '',
    modifiers: { ...DEFAULT_MODIFIERS, productionMultiplier: 1.1 }
  },
  // Legacy alias — existing games created before archetype system
  npc_syndicate: {
    id: 'npc_syndicate',
    name: 'The Syndicate',
    perk: '',
    drawback: '',
    modifiers: { ...DEFAULT_MODIFIERS }
  }
}

export const CHARACTER_CLASS_IDS = Object.keys(CHARACTER_CLASSES)

export function getCharacter(id: string): CharacterClass | null {
  return CHARACTER_CLASSES[id] ?? null
}

// Modifier application helpers

export function applyCargoMultiplier(classId: string, baseSlots: number): number {
  const char = getCharacter(classId)
  if (!char) return baseSlots
  return Math.floor(baseSlots * char.modifiers.cargoMultiplier)
}

export function applyHeatModifier(classId: string, baseHeat: number): number {
  const char = getCharacter(classId)
  if (!char) return baseHeat
  return Math.floor(baseHeat * char.modifiers.heatMultiplier)
}

export function applyProductionModifier(classId: string, baseOutput: number): number {
  const char = getCharacter(classId)
  if (!char) return baseOutput
  return baseOutput * char.modifiers.productionMultiplier
}

export function applyMovementModifier(classId: string, roll: number): number {
  const char = getCharacter(classId)
  if (!char) return roll
  return Math.floor(roll * char.modifiers.movementMultiplier) + char.modifiers.movementBonus
}

export function applyBribeDuration(classId: string, _baseDuration: number): number {
  const char = getCharacter(classId)
  if (!char) return _baseDuration
  return char.modifiers.bribeBaseDuration
}

export function applyUpgradeCostModifier(classId: string, baseCost: number): number {
  const char = getCharacter(classId)
  if (!char) return baseCost
  return baseCost * char.modifiers.upgradeCostMultiplier
}

export function applyTakeoverCostModifier(classId: string, baseCost: number): number {
  const char = getCharacter(classId)
  if (!char) return baseCost
  return baseCost * char.modifiers.takeoverCostMultiplier
}

export function applySellPriceModifier(classId: string, basePrice: number): number {
  const char = getCharacter(classId)
  if (!char) return basePrice
  return basePrice * char.modifiers.sellPriceMultiplier
}
