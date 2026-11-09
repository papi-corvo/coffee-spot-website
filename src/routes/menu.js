const express = require('express');
const router = express.Router();
const { db } = require('../db/db');

router.get('/', (req, res) => {
  try {
    // 1. Get all active menu items
    const items = db.prepare('SELECT * FROM menu_items WHERE active = 1').all();
    
    // 2. Get all variants (sizes/prices)
    const variants = db.prepare('SELECT * FROM menu_variants').all();

    // 3. Group variants by their item_id
    const variantsByItem = variants.reduce((acc, v) => {
      if (!acc[v.item_id]) acc[v.item_id] = [];
      acc[v.item_id].push({
        code: v.code,        // 'medium'
        label: v.label,      // 'Medium'
        price: v.price_centavos / 100
      });
      return acc;
    }, {});

    // 4. Combine items and their variants
    const menu = items.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category, // 'coffee', 'soda', 'tea', 'pastries', 'food'
      image: item.image,
      description: item.description || 'Freshly prepared for you.',
      variants: variantsByItem[item.id] || []
    }));

    res.json(menu);
  } catch (error) {
    console.error("Menu fetch failed:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;