-- Chicago and Philadelphia are major cities producing beer, which violates the
-- tier rule (major → gin/scotch only at the top). Reassign both to scotch —
-- the highest-value type ($35 base) and the only two cities that produce it,
-- making them genuinely worth their major-city acquisition cost.

UPDATE city_pool SET primary_alcohol = 'scotch' WHERE name = 'Chicago';
UPDATE city_pool SET primary_alcohol = 'scotch' WHERE name = 'Philadelphia';
