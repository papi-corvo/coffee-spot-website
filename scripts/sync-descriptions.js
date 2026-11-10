const { db } = require('../src/db/db');
const fs = require('fs');
const path = require('path');

// 1. Locate and read app.js
const appJsPath = path.join(__dirname, '..', 'public', 'js', 'app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

// 2. Extract the PRODUCT_INFO object using Regex
const match = appJsContent.match(/const PRODUCT_INFO = ({[\s\S]*?});/);
if (!match) {
  console.error("❌ Could not find PRODUCT_INFO in app.js");
  process.exit(1);
}

// 3. Safely evaluate the string into a JavaScript object
let PRODUCT_INFO;
try {
  // Using Function constructor to evaluate instead of eval() for slightly better safety
  PRODUCT_INFO = new Function('return ' + match[1])();
} catch (e) {
  console.error("❌ Failed to parse PRODUCT_INFO object:", e.message);
  process.exit(1);
}

// 4. Update the database
let updatedCount = 0;

const updateStmt = db.prepare('UPDATE menu_items SET description = ? WHERE name = ?');

db.transaction(() => {
  for (const [name, info] of Object.entries(PRODUCT_INFO)) {
    if (info.desc && info.desc.length > 0) {
      // Look for the item by name, ignoring case
      const result = updateStmt.run(info.desc, name);
      if (result.changes > 0) {
        updatedCount++;
      }
    }
  }
})();

console.log(`\n✅ Successfully synced descriptions for ${updatedCount} items into the database!\n`);