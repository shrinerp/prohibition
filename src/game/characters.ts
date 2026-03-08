export interface CharacterModifiers {
  heatMultiplier: number           // multiplied against heat generated (default 1.0)
  heatDecayMultiplier: number      // multiplied against heat decay per idle season
  cargoMultiplier: number          // multiplied against max cargo capacity
  movementBonus: number            // flat dice roll bonus (additive)
  movementMultiplier: number       // multiplied against movement roll
  productionMultiplier: number     // multiplied against seasonal output
  upgradeCostMultiplier: number    // multiplied against distillery upgrade cost
  takeoverCostMultiplier: number   // multiplied against hostile takeover price
  doubleCrossBonus: number         // flat additive to double cross success rate
  bribeBaseDuration: number        // seasons a long-term bribe lasts
  sellPriceMultiplier: number      // multiplied against sell price in any city
  coastalProductionMultiplier: number  // production multiplier for owned coastal cities
  medicinalPriceMultiplier: number // sell price for Medicinal Spirits (Pharmacist only)
  cashLossOnRobMultiplier: number  // multiplied against cash lost when robbed
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
  doubleCrossBonus: 0,
  bribeBaseDuration: 4,
  sellPriceMultiplier: 1.0,
  coastalProductionMultiplier: 1.0,
  medicinalPriceMultiplier: 1.0,
  cashLossOnRobMultiplier: 1.0
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
    perk: '+15% Double Cross success rate',
    drawback: '+20% Heat when in owned cities',
    modifiers: { ...DEFAULT_MODIFIERS, doubleCrossBonus: 0.15 }
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
    perk: 'Sell Medicinal Spirits at 1.5× base price',
    drawback: 'Hostile Takeover costs +25%',
    modifiers: { ...DEFAULT_MODIFIERS, takeoverCostMultiplier: 1.25, medicinalPriceMultiplier: 1.5 }
  },
  jazz_singer: {
    id: 'jazz_singer',
    name: 'The Jazz Singer',
    perk: 'Passive income in cities with population > 50k',
    drawback: 'Higher cash loss when robbed',
    modifiers: { ...DEFAULT_MODIFIERS, cashLossOnRobMultiplier: 1.35 }
  },
  bootlegger: {
    id: 'bootlegger',
    name: 'The Bootlegger (Clyde)',
    perk: 'All dice rolls get a permanent +2 bonus',
    drawback: 'None',
    modifiers: { ...DEFAULT_MODIFIERS, movementBonus: 2 }
  },
  socialite: {
    id: 'socialite',
    name: 'The Socialite (Eleanor)',
    perk: 'Sell alcohol in any city at +15% market value',
    drawback: 'None',
    modifiers: { ...DEFAULT_MODIFIERS, sellPriceMultiplier: 1.15 }
  },
  union_leader: {
    id: 'union_leader',
    name: 'The Union Leader (Big Mike)',
    perk: '+20% Double Cross success in Large Cities',
    drawback: 'None',
    modifiers: { ...DEFAULT_MODIFIERS, doubleCrossBonus: 0.2 }
  },
  rum_runner: {
    id: 'rum_runner',
    name: 'The Rum-Runner (Captain Morgan)',
    perk: 'Owned coastal cities produce double volume',
    drawback: 'None',
    modifiers: { ...DEFAULT_MODIFIERS, coastalProductionMultiplier: 2.0 }
  }
}

export const CHARACTER_CLASS_IDS = Object.keys(CHARACTER_CLASSES)

export function getCharacter(id: string): CharacterClass | null {
  return CHARACTER_CLASSES[id] ?? null
}

// Modifier application helpers

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

export function applyDoublerossModifier(classId: string, baseRate: number): number {
  const char = getCharacter(classId)
  if (!char) return baseRate
  return baseRate + char.modifiers.doubleCrossBonus
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
