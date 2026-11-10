const fs = require('fs');
const path = require('path');
const { db } = require('../src/db/db');

const htmlPath = path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// Regex to match: <li ... data-item-id="X" ...> ... <img src="Y" ...
const regex = /data-item-id="(\d+)"[\s\S]*?<img src="([^"]+)"/g;
let match;
let count = 0;

db.transaction(() => {
  while ((match = regex.exec(html)) !== null) {
    const itemId = Number(match[1]);
    const imagePath = match[2];
    
    // Update the database
    const result = db.prepare('UPDATE menu_items SET image = ? WHERE id = ?').run(imagePath, itemId);
    if (result.changes > 0) count++;
  }
})();

console.log(`✅ Successfully synced images for ${count} items from HTML to the database!`);