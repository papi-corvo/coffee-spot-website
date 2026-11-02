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
  
  if (!variant || variant.price_centavos === null) {
    throw new AppError(`Size '${size}' is not available for ${item.name}.`);
  }

  // 3. Calculate the final base price
  let unitCentavos = variant.price_centavos;


  // 4. Return the formatted line item
  return {
    menuItemId: item.id,
    name: item.name,
    size: variant.label,
    unitCentavos: unitCentavos,
    options: []
  };
}

module.exports = { resolveLine };