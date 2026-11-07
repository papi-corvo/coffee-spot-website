const express = require('express');
const router = express.Router();
const { db } = require('../db/db');

// GET: Dashboard Stats
router.get('/stats', (req, res) => {
  try {
    // 1. Today's Sales & Orders
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

    // 2. Last 7 Days Sales (simplified for SQLite)
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
      
      weekData.push([dayName, dailySales / 100]); // Convert to PHP
    }

    // 3. Top Items
    const topItemsRaw = db.prepare(`
      SELECT name, SUM(quantity) as count 
      FROM order_items GROUP BY name ORDER BY count DESC LIMIT 5
    `).all();
    const topItems = topItemsRaw.map(item => [item.name, item.count]);

    // 4. Payment Mix
    const payMixRaw = db.prepare(`
      SELECT method, COUNT(*) as count FROM payments GROUP BY method
    `).all();
    const payMix = payMixRaw.map(p => [p.method.toUpperCase(), p.count]);

    // 5. Recent Orders
    const recentOrdersRaw = db.prepare(`
      SELECT code as id, receiver_name as name, order_type as type, status, created_at 
      FROM orders ORDER BY created_at DESC LIMIT 5
    `).all();
    
    // We need to calculate the total for each recent order
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

// GET: All Menu Items
router.get('/menu', (req, res) => {
  try {
    // Get the lowest variant price as the base price for display
    const menu = db.prepare(`
      SELECT m.id, m.slug, m.name, m.category, m.active, 
             MIN(v.price_centavos) as price_centavos 
      FROM menu_items m 
      LEFT JOIN menu_variants v ON m.id = v.item_id 
      GROUP BY m.id
    `).all();

    const formattedMenu = menu.map(m => ({
      slug: m.slug,
      name: m.name,
      category: m.category,
      price: (m.price_centavos || 0) / 100,
      active: m.active === 1
    }));

    res.json(formattedMenu);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;