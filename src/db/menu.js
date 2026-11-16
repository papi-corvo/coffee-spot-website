// src/db/menu.js
const { db } = require('./db');
const { AppError } = require('./errors');

/**
 * Takes a line from the frontend (id, size, options) 
 * and resolves it against the database to get the SECURE price.
 */
function resolveLine(line) {
  const { menuItemId, size, options = [] } = line;

  // 1. Find the base menu item
  const item = db.prepare('SELECT * FROM menu_items WHERE id = ? AND active = 1').get(menuItemId);
  if (!item) {
    throw new AppError(`Menu item ${menuItemId} not found or is no longer available.`);
  }

  // 2. Find the specific size/variant to get the price
  const variant = db.prepare('SELECT * FROM menu_variants WHERE item_id = ? AND code = ?').get(item.id, size);
  
  if (!variant) {
    throw new AppError(`Size '${size}' does not exist for ${item.name}.`);
  }

  // CRITICAL FIX: Block checkout if the variant price is null (unavailable)
  if (variant.price_centavos === null || variant.price_centavos <= 0) {
    throw new AppError(`Size '${size}' for ${item.name} is currently unavailable.`);
  }

  // 4. Return the formatted line item
  return {
    menuItemId: item.id,
    name: item.name,
    size: variant.label,
    unitCentavos: variant.price_centavos,
    options: []
  };
}

module.exports = { resolveLine };