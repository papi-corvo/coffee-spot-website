-- 004_admin_auth.sql
ALTER TABLE staff ADD COLUMN email TEXT;
ALTER TABLE staff ADD COLUMN password_hash TEXT;

-- SQLite workaround for unique constraints
CREATE UNIQUE INDEX idx_staff_email ON staff(email);