-- 005_menu_soft_delete.sql
-- Adds a soft-delete column so admins can remove items without breaking historical receipts.
ALTER TABLE menu_items ADD COLUMN deleted_at TEXT;