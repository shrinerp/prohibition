-- Enforce premium alcohol type → city tier rules.
--
-- Tier rules (what a city's primary_alcohol may be):
--   small  → moonshine, beer, rye, malort, vodka, tequila
--   medium → + rum, wine, brandy, bourbon
--   large  → + whiskey
--   major  → + gin, scotch
--
-- Three cities in the original seed violated these rules by assigning gin
-- (a major-tier type) to medium/small cities. Reassign to historically
-- accurate, tier-appropriate types.

-- Atlantic City NJ (medium, coastal) — rum running hub, not a gin city
UPDATE city_pool SET primary_alcohol = 'rum'      WHERE name = 'Atlantic City';

-- Indianapolis IN (medium, inland) — Indiana distilling history, not a gin city
UPDATE city_pool SET primary_alcohol = 'bourbon'  WHERE name = 'Indianapolis';

-- Las Vegas NV (small, frontier) — backroom moonshine, not a gin city
UPDATE city_pool SET primary_alcohol = 'moonshine' WHERE name = 'Las Vegas';
