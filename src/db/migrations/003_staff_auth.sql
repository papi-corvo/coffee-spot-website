ALTER TABLE staff ADD COLUMN employee_code TEXT;
ALTER TABLE staff ADD COLUMN pin_hash TEXT;
CREATE UNIQUE INDEX idx_staff_employee_code ON staff(employee_code);