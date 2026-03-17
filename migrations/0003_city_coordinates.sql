-- Add real geographic coordinates to city_pool
ALTER TABLE city_pool ADD COLUMN lat REAL NOT NULL DEFAULT 0;
ALTER TABLE city_pool ADD COLUMN lon REAL NOT NULL DEFAULT 0;

UPDATE city_pool SET lat = 41.85,  lon = -87.65  WHERE id = 1;  -- Chicago
UPDATE city_pool SET lat = 40.71,  lon = -74.01  WHERE id = 2;  -- New York City
UPDATE city_pool SET lat = 42.33,  lon = -83.05  WHERE id = 3;  -- Detroit
UPDATE city_pool SET lat = 29.95,  lon = -90.07  WHERE id = 4;  -- New Orleans
UPDATE city_pool SET lat = 37.77,  lon = -122.42 WHERE id = 5;  -- San Francisco
UPDATE city_pool SET lat = 38.63,  lon = -90.20  WHERE id = 6;  -- St. Louis
UPDATE city_pool SET lat = 25.77,  lon = -80.19  WHERE id = 7;  -- Miami
UPDATE city_pool SET lat = 47.61,  lon = -122.33 WHERE id = 8;  -- Seattle
UPDATE city_pool SET lat = 29.30,  lon = -94.80  WHERE id = 9;  -- Galveston
UPDATE city_pool SET lat = 39.36,  lon = -74.43  WHERE id = 10; -- Atlantic City
UPDATE city_pool SET lat = 42.89,  lon = -78.88  WHERE id = 11; -- Buffalo
UPDATE city_pool SET lat = 30.69,  lon = -88.04  WHERE id = 12; -- Mobile
UPDATE city_pool SET lat = 32.72,  lon = -117.16 WHERE id = 13; -- San Diego
UPDATE city_pool SET lat = 32.08,  lon = -81.09  WHERE id = 14; -- Savannah
UPDATE city_pool SET lat = 41.50,  lon = -81.69  WHERE id = 15; -- Cleveland
UPDATE city_pool SET lat = 46.79,  lon = -92.10  WHERE id = 16; -- Duluth
UPDATE city_pool SET lat = 43.19,  lon = -112.35 WHERE id = 17; -- Blackfoot
UPDATE city_pool SET lat = 36.60,  lon = -82.19  WHERE id = 18; -- Bristol (VA/TN)
UPDATE city_pool SET lat = 38.25,  lon = -85.76  WHERE id = 19; -- Louisville
UPDATE city_pool SET lat = 39.10,  lon = -94.58  WHERE id = 20; -- Kansas City
UPDATE city_pool SET lat = 35.05,  lon = -85.31  WHERE id = 21; -- Chattanooga
UPDATE city_pool SET lat = 43.04,  lon = -87.91  WHERE id = 22; -- Milwaukee
UPDATE city_pool SET lat = 40.69,  lon = -89.59  WHERE id = 23; -- Peoria
UPDATE city_pool SET lat = 34.50,  lon = -93.06  WHERE id = 24; -- Hot Springs
UPDATE city_pool SET lat = 36.17,  lon = -86.78  WHERE id = 25; -- Nashville
UPDATE city_pool SET lat = 41.59,  lon = -93.62  WHERE id = 26; -- Des Moines
UPDATE city_pool SET lat = 39.10,  lon = -84.51  WHERE id = 27; -- Cincinnati
UPDATE city_pool SET lat = 40.44,  lon = -80.00  WHERE id = 28; -- Pittsburgh
UPDATE city_pool SET lat = 33.75,  lon = -84.39  WHERE id = 29; -- Atlanta
UPDATE city_pool SET lat = 39.74,  lon = -104.98 WHERE id = 30; -- Denver
UPDATE city_pool SET lat = 41.26,  lon = -95.94  WHERE id = 31; -- Omaha
UPDATE city_pool SET lat = 40.76,  lon = -111.89 WHERE id = 32; -- Salt Lake City
UPDATE city_pool SET lat = 35.08,  lon = -106.65 WHERE id = 33; -- Albuquerque
UPDATE city_pool SET lat = 35.15,  lon = -90.05  WHERE id = 34; -- Memphis
UPDATE city_pool SET lat = 39.77,  lon = -86.16  WHERE id = 35; -- Indianapolis
UPDATE city_pool SET lat = 33.45,  lon = -112.07 WHERE id = 36; -- Phoenix
UPDATE city_pool SET lat = 39.95,  lon = -75.17  WHERE id = 37; -- Philadelphia
UPDATE city_pool SET lat = 38.91,  lon = -77.04  WHERE id = 38; -- Washington DC
UPDATE city_pool SET lat = 39.29,  lon = -76.61  WHERE id = 39; -- Baltimore
UPDATE city_pool SET lat = 34.05,  lon = -118.24 WHERE id = 40; -- Los Angeles
UPDATE city_pool SET lat = 40.74,  lon = -74.17  WHERE id = 41; -- Newark
UPDATE city_pool SET lat = 42.36,  lon = -71.06  WHERE id = 42; -- Boston
UPDATE city_pool SET lat = 44.98,  lon = -93.27  WHERE id = 43; -- Minneapolis
UPDATE city_pool SET lat = 32.75,  lon = -97.33  WHERE id = 44; -- Fort Worth
UPDATE city_pool SET lat = 45.52,  lon = -122.68 WHERE id = 45; -- Portland
UPDATE city_pool SET lat = 35.47,  lon = -97.52  WHERE id = 46; -- Oklahoma City
UPDATE city_pool SET lat = 34.75,  lon = -92.29  WHERE id = 47; -- Little Rock
UPDATE city_pool SET lat = 37.54,  lon = -77.44  WHERE id = 48; -- Richmond
UPDATE city_pool SET lat = 41.82,  lon = -71.42  WHERE id = 49; -- Providence
UPDATE city_pool SET lat = 36.17,  lon = -115.14 WHERE id = 50; -- Las Vegas
