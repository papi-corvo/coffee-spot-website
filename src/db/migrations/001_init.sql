-- =====================================================================
-- 001_init.sql — Coffee Spot database, first version
-- Rules used everywhere:
--   * Money is stored as whole centavos (PHP 120.00 -> 12000). No decimals, no rounding bugs.
--   * Dates are UTC text, e.g. 2026-10-20T09:30:00.000Z
--   * Never edit this file after it has been applied. Add 002_..., 003_... instead.
-- =====================================================================

-- Shop details printed on receipts (name, address, TIN, VAT flag, footer ...)
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Staff. No passwords here: login will come from Supabase Auth later,
-- and auth_user_id will hold that user's Supabase id.
CREATE TABLE staff (
  id           INTEGER PRIMARY KEY,
  name         TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'cashier' CHECK (role IN ('cashier', 'admin')),
  auth_user_id TEXT UNIQUE,
  active       INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ---------- MENU: every product is stored once, here ----------
CREATE TABLE menu_items (
  id          INTEGER PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,            -- stable key, e.g. 'cafe-latte'
  name        TEXT NOT NULL,
  category    TEXT NOT NULL CHECK (category IN ('coffee', 'soda', 'tea', 'pastries', 'food')),
  group_name  TEXT,                            -- e.g. 'Special Drinks', 'Milk-Based Frappe'
  image       TEXT,
  description TEXT,
  active      INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- Sizes / servings of an item and their prices.
CREATE TABLE menu_variants (
  id             INTEGER PRIMARY KEY,
  item_id        INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  code           TEXT NOT NULL,                -- 'medium', 'large', 'solo', 'w/rice-4pcs'
  label          TEXT NOT NULL,                -- 'Medium'
  price_centavos INTEGER CHECK (price_centavos IS NULL OR price_centavos >= 0),  -- NULL = not available
  sort_order     INTEGER NOT NULL DEFAULT 0,
  UNIQUE (item_id, code)
);

-- Add-ons and choices (Hot/Iced, wing flavor, extra bacon ...).
CREATE TABLE menu_options (
  id             INTEGER PRIMARY KEY,
  item_id        INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  group_name     TEXT NOT NULL,                -- 'Temperature', 'Add-on', 'Flavor'
  kind           TEXT NOT NULL CHECK (kind IN ('single', 'multi')),
  label          TEXT NOT NULL,
  price_centavos INTEGER NOT NULL DEFAULT 0 CHECK (price_centavos >= 0),
  is_default     INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  sort_order     INTEGER NOT NULL DEFAULT 0
);

-- ---------- ORDERS ----------
CREATE TABLE orders (
  id            INTEGER PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,          -- customer-facing, also inside the QR code
  status        TEXT NOT NULL DEFAULT 'new'
                CHECK (status IN ('pending', 'new', 'accepted', 'ready', 'done', 'rejected', 'voided')),
  channel       TEXT NOT NULL DEFAULT 'website',
  order_type    TEXT NOT NULL CHECK (order_type IN ('pickup', 'delivery')),
  receiver_name TEXT NOT NULL CHECK (length(trim(receiver_name)) > 0),
  phone         TEXT,
  pay_pref      TEXT NOT NULL DEFAULT 'cash' CHECK (pay_pref IN ('cash', 'gcash', 'maya')),
  note          TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_orders_status ON orders (status, created_at);

CREATE TABLE delivery_addresses (
  order_id  INTEGER PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone     TEXT,
  street    TEXT NOT NULL,
  barangay  TEXT NOT NULL,
  city      TEXT NOT NULL,
  notes     TEXT
);

-- Each line keeps a SNAPSHOT of name, size and price at the time of sale,
-- so changing the menu later never changes an old order or receipt.
CREATE TABLE order_items (
  id                  INTEGER PRIMARY KEY,
  order_id            INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id        INTEGER REFERENCES menu_items(id) ON DELETE SET NULL,   -- for sales reports
  name                TEXT NOT NULL,
  size                TEXT NOT NULL DEFAULT '',
  unit_price_centavos INTEGER NOT NULL CHECK (unit_price_centavos >= 0),      -- per piece, add-ons included
  quantity            INTEGER NOT NULL CHECK (quantity >= 1)
);
CREATE INDEX idx_order_items_order ON order_items (order_id);

CREATE TABLE order_item_options (
  id             INTEGER PRIMARY KEY,
  order_item_id  INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  price_centavos INTEGER NOT NULL DEFAULT 0 CHECK (price_centavos >= 0)
);

-- PWD / Senior only. A regular order simply has no row here.
CREATE TABLE order_discounts (
  order_id         INTEGER PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('pwd', 'senior')),
  rate_bps         INTEGER NOT NULL CHECK (rate_bps BETWEEN 0 AND 10000),    -- 2000 = 20.00%
  amount_centavos  INTEGER NOT NULL CHECK (amount_centavos >= 0),
  id_number        TEXT NOT NULL CHECK (length(trim(id_number)) > 0),
  name_on_id       TEXT
);

-- ---------- PAYMENT + RECEIPT ----------
-- UNIQUE(order_id): an order can only be paid once, enforced by the database itself.
CREATE TABLE payments (
  id                INTEGER PRIMARY KEY,
  order_id          INTEGER NOT NULL UNIQUE REFERENCES orders(id),
  method            TEXT NOT NULL CHECK (method IN ('cash', 'gcash', 'maya')),
  amount_centavos   INTEGER NOT NULL CHECK (amount_centavos >= 0),
  tendered_centavos INTEGER CHECK (tendered_centavos IS NULL OR tendered_centavos >= 0),
  change_centavos   INTEGER CHECK (change_centavos IS NULL OR change_centavos >= 0),
  reference_no      TEXT,
  staff_id          INTEGER REFERENCES staff(id),
  paid_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (method <> 'cash' OR tendered_centavos >= amount_centavos),
  CHECK (method = 'cash' OR length(trim(coalesce(reference_no, ''))) > 0)
);

-- Counter used to hand out receipt numbers in order, e.g. R-2026-000123
CREATE TABLE receipt_sequences (
  year        INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE receipts (
  id                 INTEGER PRIMARY KEY,
  receipt_no         TEXT NOT NULL UNIQUE,
  order_id           INTEGER NOT NULL UNIQUE REFERENCES orders(id),
  issued_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  issued_by          INTEGER REFERENCES staff(id),
  subtotal_centavos  INTEGER NOT NULL CHECK (subtotal_centavos >= 0),
  discount_centavos  INTEGER NOT NULL DEFAULT 0 CHECK (discount_centavos >= 0),
  total_centavos     INTEGER NOT NULL CHECK (total_centavos >= 0),
  snapshot_json      TEXT NOT NULL,            -- exactly what was printed, incl. shop details
  reprint_count      INTEGER NOT NULL DEFAULT 0 CHECK (reprint_count >= 0),
  voided_at          TEXT,
  void_reason        TEXT
);

-- Audit trail: every status change, who made it, why.
CREATE TABLE status_history (
  id          INTEGER PRIMARY KEY,
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status   TEXT NOT NULL,
  staff_id    INTEGER REFERENCES staff(id),
  reason      TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_status_history_order ON status_history (order_id);