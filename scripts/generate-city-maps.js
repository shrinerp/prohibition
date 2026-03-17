#!/usr/bin/env node
'use strict'
/**
 * Generate prohibition-era city maps using nano-banana CLI.
 * Run: node scripts/generate-city-maps.js | sh
 */
const fs = require('fs')
const path = require('path')

const SEED_FILE = path.join(__dirname, '../migrations/0002_seed_cities.sql')
const OUT_DIR = path.join(__dirname, '../src/frontend/public/city-maps')

const TIER_DESC = {
  major: 'dense metropolitan',
  large: 'busy urban',
  medium: 'mid-size city',
  small: 'sparse small town hamlet',
}

function parseCities(sql) {
  const cities = []
  const lineRe = /\('([^']+)',\s*'[^']*',\s*'[^']*',\s*'(?:[^']|'')*',\s*'[^']*',\s*'(major|large|medium|small)'/g
  let m
  while ((m = lineRe.exec(sql)) !== null) {
    const name = m[1].replace(/''/g, "'")
    const tier = m[2]
    const slug = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    cities.push({ name, tier, slug })
  }
  return cities
}

const sql = fs.readFileSync(SEED_FILE, 'utf8')
const cities = parseCities(sql)

console.log(`export PATH="$HOME/.bun/bin:$PATH"`)
console.log(`mkdir -p ${OUT_DIR}`)

for (const city of cities) {
  const tierDesc = TIER_DESC[city.tier] ?? 'mid-size city'
  const prompt = `Prohibition-era 1920s bird's-eye street map of ${city.name}, sepia-toned, top-down overhead view, ${tierDesc} density, detailed city blocks, ink drawing style, no labels, board game`
  console.log(`nano-banana '${prompt.replace(/'/g, "'\\''")}' --output ${city.slug} --dir ${OUT_DIR}`)
}
