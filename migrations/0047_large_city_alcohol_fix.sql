-- Milwaukee, St. Louis, and Atlanta are large cities producing small-tier
-- alcohol types (beer/moonshine). Reassign to tier-appropriate types.

UPDATE city_pool SET primary_alcohol = 'whiskey' WHERE name = 'Milwaukee';
UPDATE city_pool SET primary_alcohol = 'whiskey' WHERE name = 'St. Louis';
UPDATE city_pool SET primary_alcohol = 'bourbon' WHERE name = 'Atlanta';
