-- Rescale road distances to match 2d6 range (2-12)
-- Short regional hops: 2-5, cross-region: 8-12
UPDATE roads
SET distance_value = CASE
  WHEN distance_value <= 8  THEN 2 + ((ROWID * 1103515245 + 12345) & 3)   -- 2–5
  ELSE                           8 + ((ROWID * 1664525    + 1013904223) & 4) -- 8–12
END;
