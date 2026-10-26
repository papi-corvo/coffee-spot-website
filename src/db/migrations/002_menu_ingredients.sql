-- 002_menu_ingredients.sql
-- The website search looks at each product's ingredients, so the database needs them too.
-- Stored as a JSON list, e.g. ["Espresso","Steamed milk"].
ALTER TABLE menu_items ADD COLUMN ingredients TEXT;