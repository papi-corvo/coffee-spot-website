const express = require('express');
const router = express.Router();
const { db } = require('../db/db');

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
    const items = db.prepare('SELECT id, slug, name, category, active FROM menu_items').all();
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
      SELECT id, name, COALESCE(email, employee_code) as email, role, 
             CASE WHEN active = 1 THEN 'active' ELSE 'inactive' END as status 
      FROM staff
    `).all();
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH: Update a menu item (price or availability)
router.patch('/menu/:slug', (req, res) => {
  try {
    const { slug } = req.params;
    const { price, active } = req.body;
    
    const item = db.prepare('SELECT id FROM menu_items WHERE slug = ?').get(slug);
    if (!item) return res.status(404).json({ error: 'Menu item not found' });

    if (active !== undefined) {
      db.prepare('UPDATE menu_items SET active = ? WHERE id = ?').run(active ? 1 : 0, item.id);
    }

    if (price !== undefined) {
      const priceCentavos = Math.round(Number(price) * 100);
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

    if (!Array.isArray(variants)) {
      return res.status(400).json({ error: 'Variants must be an array' });
    }

    const item = db.prepare('SELECT id FROM menu_items WHERE slug = ?').get(slug);
    if (!item) return res.status(404).json({ error: 'Menu item not found' });

    db.transaction(() => {
      const updateStmt = db.prepare('UPDATE menu_variants SET price_centavos = ? WHERE id = ? AND item_id = ?');
      
      variants.forEach(v => {
        const priceCentavos = v.price === null ? null : Math.round(Number(v.price) * 100);
        
        if (priceCentavos !== null && (!Number.isFinite(priceCentavos) || priceCentavos < 0 || priceCentavos > 1000000)) {
          throw new Error(`Invalid price for variant ID ${v.id}`);
        }
        updateStmt.run(priceCentavos, v.id, item.id);
      });
    })();

    res.json({ message: 'Variants updated successfully' });
  } catch (error) {
    console.error("Variant update error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;