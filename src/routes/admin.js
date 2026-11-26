const express = require('express');
const router = express.Router();
const { db } = require('../db/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const uploadDir = path.join(__dirname, '..', '..', 'public', 'image', 'uploads');

// Create the folder if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const MAX_PRICE = 10000; // 10,000 PHP limit
// Safe centavos conversion (avoids 19.99 * 100 = 1998.999999)
const toCentavos = (amount) => Math.round(Number(amount) * 100);

// ---------- Employee rules ----------
const NAME_RULE = /^\p{L}[\p{L}\p{M} .'-]{1,59}$/u;
const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (v, max = 120) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// EMP-002, EMP-003 ... never reuses a code
function nextEmployeeCode() {
  const rows = db.prepare("SELECT employee_code FROM staff WHERE employee_code LIKE 'EMP-%'").all();
  let highest = 0;
  for (const row of rows) {
    const n = Number(String(row.employee_code).slice(4));
    if (Number.isFinite(n) && n > highest) highest = n;
  }
  let next = highest + 1;
  let code = `EMP-${String(next).padStart(3, '0')}`;
  while (db.prepare('SELECT 1 FROM staff WHERE employee_code = ?').get(code)) {
    next += 1;
    code = `EMP-${String(next).padStart(3, '0')}`;
  }
  return code;
}

const newPin = () => String(crypto.randomInt(100000, 1000000));
const newPassword = () => crypto.randomBytes(5).toString('hex'); // 10 characters

function countActiveAdmins() {
  return db.prepare("SELECT COUNT(*) AS n FROM staff WHERE role = 'admin' AND active = 1").get().n;
}

function employeeRow(id) {
  return db.prepare(`
    SELECT id, name, role, email, employee_code,
           CASE WHEN active = 1 THEN 'active' ELSE 'inactive' END AS status
    FROM staff WHERE id = ?
  `).get(id);
}

// Configure Multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Saves to public/image/uploads
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // 1. Get the item name sent from the frontend
    const itemName = req.body.itemName || 'item';
    
    // 2. Slugify the name (e.g., "Iced Latte" -> "iced-latte")
    const baseSlug = itemName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    // 3. Keep the original extension (.jpg, .png)
    const ext = path.extname(file.originalname).toLowerCase();
    
    // Result: iced-latte.jpg
    cb(null, `${baseSlug}${ext}`);
  }
});
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG and PNG are allowed.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Optional: Limit to 5MB
  fileFilter: fileFilter
});

// GET: Dashboard Stats
router.get('/stats', (req, res) => {
  try {
    const todaySales = db.prepare(`
      SELECT COALESCE(SUM(amount_centavos), 0) as total 
      FROM payments WHERE date(paid_at, 'localtime') = date('now', 'localtime')
    `).get().total;

    const todayOrders = db.prepare(`
      SELECT COUNT(*) as count FROM orders WHERE date(created_at, 'localtime') = date('now', 'localtime')
    `).get().count;

    const openOrders = db.prepare(`
      SELECT COUNT(*) as count FROM orders WHERE status IN ('new', 'accepted', 'ready')
    `).get().count;

    const weekData = [];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = days[d.getDay()];
      
      const dailySales = db.prepare(`
        SELECT COALESCE(SUM(amount_centavos), 0) as total 
        FROM payments WHERE date(paid_at, 'localtime') = ?
      `).get(dateStr).total;
      
      weekData.push([dayName, dailySales / 100]);
    }

    const topItemsRaw = db.prepare(`
      SELECT name, SUM(quantity) as count 
      FROM order_items GROUP BY name ORDER BY count DESC LIMIT 5
    `).all();
    const topItems = topItemsRaw.map(item => [item.name, item.count]);

    const payMixRaw = db.prepare(`
      SELECT method, COUNT(*) as count FROM payments GROUP BY method
    `).all();
    const payMix = payMixRaw.map(p => [p.method.toUpperCase(), p.count]);

    const recentOrdersRaw = db.prepare(`
      SELECT code as id, receiver_name as name, order_type as type, status, created_at 
      FROM orders ORDER BY created_at DESC LIMIT 5
    `).all();
    
    const recentOrders = recentOrdersRaw.map(o => {
      const orderTotal = db.prepare(`
        SELECT COALESCE(SUM(unit_price_centavos * quantity), 0) as total FROM order_items WHERE order_id = (SELECT id FROM orders WHERE code = ?)
      `).get(o.id).total;
      
      return {
        id: o.id,
        name: o.name,
        type: o.type,
        total: orderTotal / 100,
        status: o.status,
        time: new Date(o.created_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
      };
    });

    res.json({
      week: weekData,
      ordersToday: todayOrders,
      top: topItems,
      pay: payMix,
      orders: recentOrders
    });
  } catch (error) {
    console.error("Stats error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET: All Menu Items (with variants)
router.get('/menu', (req, res) => {
  try {
    // Add WHERE deleted_at IS NULL to hide soft-deleted items
    const items = db.prepare('SELECT id, slug, name, category, group_name, active FROM menu_items WHERE deleted_at IS NULL').all();
    const variants = db.prepare('SELECT * FROM menu_variants ORDER BY sort_order').all();

    const variantsByItem = variants.reduce((acc, v) => {
      if (!acc[v.item_id]) acc[v.item_id] = [];
      acc[v.item_id].push({
        id: v.id,
        code: v.code,
        label: v.label,
        price: v.price_centavos / 100,
        price_centavos: v.price_centavos
      });
      return acc;
    }, {});

    const formattedMenu = items.map(m => {
      const itemVariants = variantsByItem[m.id] || [];
      
      // Only consider variants with a valid price to find the base price
      const validVariants = itemVariants.filter(v => v.price_centavos !== null && v.price_centavos > 0);
      
      const baseVariant = validVariants.length > 0 
        ? validVariants.reduce((min, v) => v.price < min.price ? v : min, validVariants[0])
        : null;

      return {
        slug: m.slug,
        name: m.name,
        category: m.category,
        group_name: m.group_name,
        price: baseVariant ? baseVariant.price : 0,
        active: m.active === 1,
        variants: itemVariants
      };
    });

    res.json(formattedMenu);
  } catch (error) {
    console.error("Menu fetch error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET: All Employees
router.get('/employees', (req, res) => {
  try {
    const employees = db.prepare(`
      SELECT id, name, role, email, employee_code,
             CASE WHEN active = 1 THEN 'active' ELSE 'inactive' END AS status
      FROM staff
      ORDER BY active DESC, name COLLATE NOCASE ASC
    `).all();
    res.json(employees);
  } catch (error) {
    console.error('Employees fetch error:', error);
    res.status(500).json({ error: 'Could not load employees.' });
  }
});

// POST: Register an employee and hand back their first login, once
router.post('/employees', (req, res) => {
  try {
    const name = clean(req.body.name, 60);
    const role = req.body.role;

    if (!NAME_RULE.test(name)) {
      return res.status(400).json({ error: "Enter the employee's full name." });
    }
    if (role !== 'cashier' && role !== 'admin') {
      return res.status(400).json({ error: 'Choose a role: cashier or admin.' });
    }

    let email = null;
    let employeeCode = null;
    let pinHash = null;
    let passwordHash = null;
    const credentials = {};

    if (role === 'admin') {
      email = clean(req.body.email, 120).toLowerCase();
      if (!EMAIL_RULE.test(email)) {
        return res.status(400).json({ error: 'Admins need a valid email address to log in.' });
      }
      if (db.prepare('SELECT 1 FROM staff WHERE email = ?').get(email)) {
        return res.status(409).json({ error: 'That email is already used by another employee.' });
      }
      const password = newPassword();
      passwordHash = bcrypt.hashSync(password, 10);
      credentials.login = email;
      credentials.password = password;
    } else {
      employeeCode = nextEmployeeCode();
      const pin = newPin();
      pinHash = bcrypt.hashSync(pin, 10);
      credentials.login = employeeCode;
      credentials.employeeCode = employeeCode;
      credentials.pin = pin;
    }

    const info = db.prepare(`
      INSERT INTO staff (name, role, email, employee_code, pin_hash, password_hash)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, role, email, employeeCode, pinHash, passwordHash);

    res.status(201).json({ employee: employeeRow(info.lastInsertRowid), credentials });
  } catch (error) {
    console.error('Employee create error:', error);
    if (String(error.code || '').startsWith('SQLITE_CONSTRAINT')) {
      return res.status(409).json({ error: 'That email or employee code is already taken.' });
    }
    res.status(500).json({ error: 'Could not register the employee.' });
  }
});

// PATCH: Rename, change role, activate or deactivate an employee
router.patch('/employees/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid employee.' });

    const target = db.prepare('SELECT * FROM staff WHERE id = ?').get(id);
    if (!target) return res.status(404).json({ error: 'Employee not found.' });

    const sets = [];
    const values = [];
    const credentials = {};

    if (req.body.name !== undefined) {
      const name = clean(req.body.name, 60);
      if (!NAME_RULE.test(name)) {
        return res.status(400).json({ error: "Enter the employee's full name." });
      }
      sets.push('name = ?');
      values.push(name);
    }

    if (req.body.role !== undefined && req.body.role !== target.role) {
      const nextRole = req.body.role;
      if (nextRole !== 'cashier' && nextRole !== 'admin') {
        return res.status(400).json({ error: 'Choose a role: cashier or admin.' });
      }
      if (target.id === req.staff.id) {
        return res.status(400).json({ error: 'You cannot change your own role.' });
      }
      if (target.role === 'admin' && target.active === 1 && countActiveAdmins() <= 1) {
        return res.status(400).json({ error: 'At least one active admin must remain.' });
      }

      sets.push('role = ?');
      values.push(nextRole);

      if (nextRole === 'admin') {
        // Promoting: an admin logs in with email + password, so we need an email now.
        const email = clean(req.body.email ?? target.email ?? '', 120).toLowerCase();
        if (!EMAIL_RULE.test(email)) {
          return res.status(400).json({ error: 'Promoting to admin needs a valid email. Send it with this change.' });
        }
        if (db.prepare('SELECT 1 FROM staff WHERE email = ? AND id <> ?').get(email, id)) {
          return res.status(409).json({ error: 'That email is already used by another employee.' });
        }
        const password = newPassword();
        sets.push('email = ?');
        values.push(email);
        sets.push('password_hash = ?');
        values.push(bcrypt.hashSync(password, 10));
        credentials.login = email;
        credentials.password = password;
      } else {
        // Demoting: a cashier logs in with employee code + PIN.
        if (!target.employee_code) {
          const code = nextEmployeeCode();
          sets.push('employee_code = ?');
          values.push(code);
          credentials.login = code;
          credentials.employeeCode = code;
        } else {
          credentials.login = target.employee_code;
          credentials.employeeCode = target.employee_code;
        }
        const pin = newPin();
        sets.push('pin_hash = ?');
        values.push(bcrypt.hashSync(pin, 10));
        credentials.pin = pin;
      }
    }

    if (req.body.active !== undefined) {
      const active = req.body.active ? 1 : 0;
      if (!active && target.id === req.staff.id) {
        return res.status(400).json({ error: 'You cannot deactivate your own account.' });
      }
      if (!active && target.role === 'admin' && target.active === 1 && countActiveAdmins() <= 1) {
        return res.status(400).json({ error: 'At least one active admin must remain.' });
      }
      sets.push('active = ?');
      values.push(active);
    }

    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to change.' });

    values.push(id);
    db.prepare(`UPDATE staff SET ${sets.join(', ')} WHERE id = ?`).run(...values);

    res.json({ employee: employeeRow(id), credentials });
  } catch (error) {
    console.error('Employee update error:', error);
    if (String(error.code || '').startsWith('SQLITE_CONSTRAINT')) {
      return res.status(409).json({ error: 'That email or employee code is already taken.' });
    }
    res.status(500).json({ error: 'Could not update the employee.' });
  }
});

// POST: Issue a new PIN (cashier) or password (admin)
router.post('/employees/:id/credentials', (req, res) => {
  try {
    const id = Number(req.params.id);
    const target = db.prepare('SELECT * FROM staff WHERE id = ?').get(id);
    if (!target) return res.status(404).json({ error: 'Employee not found.' });

    if (target.role === 'admin') {
      if (!target.email) {
        return res.status(400).json({ error: 'Give this admin an email address first.' });
      }
      const password = newPassword();
      db.prepare('UPDATE staff SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), id);
      return res.json({ credentials: { login: target.email, password } });
    }

    let code = target.employee_code;
    if (!code) {
      code = nextEmployeeCode();
      db.prepare('UPDATE staff SET employee_code = ? WHERE id = ?').run(code, id);
    }
    const pin = newPin();
    db.prepare('UPDATE staff SET pin_hash = ? WHERE id = ?').run(bcrypt.hashSync(pin, 10), id);
    res.json({ credentials: { login: code, employeeCode: code, pin } });
  } catch (error) {
    console.error('Credential reset error:', error);
    res.status(500).json({ error: 'Could not reset the login.' });
  }
});

// PATCH: Update a menu item (base price or availability)
router.patch('/menu/:slug', (req, res) => {
  try {
    const { slug } = req.params;
    const { price, active } = req.body;
    
    const item = db.prepare('SELECT id FROM menu_items WHERE slug = ?').get(slug);
    if (!item) return res.status(404).json({ error: 'Menu item not found' });

    // 1. Validate Availability
    if (active !== undefined) {
      db.prepare('UPDATE menu_items SET active = ? WHERE id = ?').run(active ? 1 : 0, item.id);
    }

    // 2. Validate and Update Base Price
    if (price !== undefined) {
      const numPrice = Number(price);
      
      if (!Number.isFinite(numPrice) || numPrice <= 0 || numPrice > MAX_PRICE) {
        return res.status(400).json({ error: `Price must be between 0.01 and ${MAX_PRICE}.` });
      }

      const priceCentavos = toCentavos(numPrice);
      
      // Update the FIRST (lowest/base) variant for this item
      db.prepare(`
        UPDATE menu_variants 
        SET price_centavos = ? 
        WHERE id = (SELECT id FROM menu_variants WHERE item_id = ? ORDER BY price_centavos ASC LIMIT 1)
      `).run(priceCentavos, item.id);
    }

    res.json({ message: 'Menu item updated successfully' });
  } catch (error) {
    console.error("Admin menu update error:", error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH: Update all variants for a specific item
router.patch('/menu/:slug/variants', (req, res) => {
  try {
    const { slug } = req.params;
    const { variants } = req.body;

    if (!Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({ error: 'Variants must be a non-empty array.' });
    }

    const item = db.prepare('SELECT id FROM menu_items WHERE slug = ?').get(slug);
    if (!item) return res.status(404).json({ error: 'Menu item not found' });

    // Validation: Check all prices before touching the DB
    let hasAtLeastOnePrice = false;
    
    for (const v of variants) {
      if (v.price === null) continue; // Null is allowed (means unavailable)
      
      const numPrice = Number(v.price);
      if (!Number.isFinite(numPrice) || numPrice <= 0 || numPrice > MAX_PRICE) {
        return res.status(400).json({ error: `All prices must be between 0.01 and ${MAX_PRICE}.` });
      }
      hasAtLeastOnePrice = true;
    }

    // Claude's Rule: Prevent items where ALL sizes are null
    if (!hasAtLeastOnePrice) {
      return res.status(400).json({ error: 'At least one size must have a valid price.' });
    }

    // Execute inside a transaction so it's all-or-nothing
    db.transaction(() => {
      const updateStmt = db.prepare('UPDATE menu_variants SET price_centavos = ? WHERE id = ? AND item_id = ?');
      
      variants.forEach(v => {
        // If it's null, save null. Otherwise, safely convert to centavos.
        const priceCentavos = v.price === null ? null : toCentavos(v.price);
        updateStmt.run(priceCentavos, v.id, item.id);
      });
    })();

    res.json({ message: 'Variants updated successfully' });
  } catch (error) {
    console.error("Variant update error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST: Create a new menu item
router.post('/menu', (req, res) => {
  try {
    const { name, category, group_name, description, image, variants } = req.body;

    // 1. Basic Validation
    if (!name || !category || !Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({ error: 'Name, category, and at least one variant are required.' });
    }

    if (!['coffee', 'soda', 'tea', 'pastries', 'food'].includes(category)) {
      return res.status(400).json({ error: 'Invalid category.' });
    }

    // 2. Generate a safe, unique slug
    let baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    let slug = baseSlug;
    let counter = 1;
    
    // Check if slug exists, if so, append a number (e.g., 'iced-latte-1')
    while (db.prepare('SELECT id FROM menu_items WHERE slug = ?').get(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // 3. Insert using a Transaction (all-or-nothing)
    const insertItem = db.prepare(`
      INSERT INTO menu_items (slug, name, category, group_name, description, image, active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);
    
    const insertVariant = db.prepare(`
      INSERT INTO menu_variants (item_id, code, label, price_centavos, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);

    const createNewItem = db.transaction(() => {
      // Insert the main item
      const info = insertItem.run(slug, name, category, group_name || null, description || null, image || null);
      const itemId = info.lastInsertRowid;

      // Insert all the variants (sizes)
      variants.forEach((v, index) => {
        const safeCode = v.label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const priceCentavos = toCentavos(v.price);
        insertVariant.run(itemId, safeCode, v.label, priceCentavos, index);
      });

      return itemId;
    });

    const newItemId = createNewItem();

    res.status(201).json({ message: 'Menu item created successfully', id: newItemId, slug });
  } catch (error) {
    console.error("Admin menu create error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST: Upload an image (WITH ERROR CATCHING)
router.post('/upload', (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }
    
    const imagePath = `image/uploads/${req.file.filename}`;
    res.json({ imagePath });
  });
});

// DELETE: Soft delete a menu item
router.delete('/menu/:slug', (req, res) => {
  try {
    const { slug } = req.params;
    const item = db.prepare('SELECT id FROM menu_items WHERE slug = ?').get(slug);
    
    if (!item) return res.status(404).json({ error: 'Menu item not found' });

    // Soft delete: set deleted_at to current timestamp
    db.prepare('UPDATE menu_items SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(item.id);
    
    res.json({ message: 'Menu item removed successfully' });
  } catch (error) {
    console.error("Admin delete error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;