import { describe, it, expect } from 'vitest'
import {
  CHARACTER_CLASSES,
  getCharacter,
  applyHeatModifier,
  applyProductionModifier,
  applyMovementModifier,
  applyDoublerossModifier,
  applyBribeDuration,
  applyUpgradeCostModifier,
  applyTakeoverCostModifier,
  applySellPriceModifier,
  CHARACTER_CLASS_IDS
} from '../src/game/characters'

describe('CHARACTER_CLASSES registry', () => {
  it('has exactly 10 character classes', () => {
    expect(Object.keys(CHARACTER_CLASSES).length).toBe(10)
  })

  it('every class has id, name, perk, drawback, and modifiers', () => {
    for (const cls of Object.values(CHARACTER_CLASSES)) {
      expect(cls.id).toBeDefined()
      expect(cls.name).toBeDefined()
      expect(cls.perk).toBeDefined()
      expect(cls.drawback).toBeDefined()
      expect(cls.modifiers).toBeDefined()
    }
  })

  it('all CHARACTER_CLASS_IDS are valid keys', () => {
    for (const id of CHARACTER_CLASS_IDS) {
      expect(CHARACTER_CLASSES[id]).toBeDefined()
    }
  })
})

describe('getCharacter()', () => {
  it('returns character for valid id', () => {
    expect(getCharacter('priest_nun')).toBeDefined()
    expect(getCharacter('gangster')).toBeDefined()
  })

  it('returns null for unknown id', () => {
    expect(getCharacter('unknown_class')).toBeNull()
  })
})

describe('Priest/Nun modifiers', () => {
  it('-25% heat generation', () => {
    expect(applyHeatModifier('priest_nun', 10)).toBe(7) // 10 * 0.75 = 7.5 → floor 7
  })

  it('-20% cargo capacity', () => {
    const char = getCharacter('priest_nun')!
    expect(char.modifiers.cargoMultiplier).toBeCloseTo(0.8)
  })
})

describe('Hillbilly modifiers', () => {
  it('-20% distillery upgrade cost', () => {
    expect(applyUpgradeCostModifier('hillbilly', 100)).toBeCloseTo(80)
  })

  it('-10% movement roll', () => {
    expect(applyMovementModifier('hillbilly', 10)).toBeCloseTo(9)
  })
})

describe('Gangster modifiers', () => {
  it('+15% double cross success rate', () => {
    expect(applyDoublerossModifier('gangster', 0.5)).toBeCloseTo(0.65)
  })
})

describe('Vixen modifiers', () => {
  it('bribe duration is 6 seasons', () => {
    expect(applyBribeDuration('vixen', 4)).toBe(6)
  })

  it('-10% production volume', () => {
    expect(applyProductionModifier('vixen', 100)).toBeCloseTo(90)
  })
})

describe('Pharmacist modifiers', () => {
  it('+25% hostile takeover cost', () => {
    expect(applyTakeoverCostModifier('pharmacist', 1000)).toBeCloseTo(1250)
  })

  it('medicinal sell multiplier is 1.5x', () => {
    const char = getCharacter('pharmacist')!
    expect(char.modifiers.medicinalPriceMultiplier).toBeCloseTo(1.5)
  })
})

describe('Bootlegger (Clyde) modifiers', () => {
  it('+2 dice bonus', () => {
    expect(applyMovementModifier('bootlegger', 7)).toBe(9)
  })
})

describe('Socialite (Eleanor) modifiers', () => {
  it('+15% sell price anywhere', () => {
    expect(applySellPriceModifier('socialite', 100)).toBeCloseTo(115)
  })
})

describe('Union Leader (Big Mike) modifiers', () => {
  it('+20% double cross in large city', () => {
    expect(applyDoublerossModifier('union_leader', 0.5)).toBeCloseTo(0.7)
  })
})

describe('Rum-Runner (Captain Morgan) modifiers', () => {
  it('coastal production multiplier is 2x', () => {
    const char = getCharacter('rum_runner')!
    expect(char.modifiers.coastalProductionMultiplier).toBe(2)
  })
})
