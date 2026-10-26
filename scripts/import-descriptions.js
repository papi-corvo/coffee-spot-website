/* =====================================================================
   db/import-descriptions.js — copies each product's description and ingredients
   from the PRODUCT_INFO object in your website JavaScript into the database.
   Run:  node db/import-descriptions.js                 (searches the whole Javascript folder)
     or: node db/import-descriptions.js path/to/file.js (use one specific file)
   Run it AFTER seed-menu.js. Safe to repeat.
   ===================================================================== */
const fs = require('fs');
const path = require('path');
const { db } = require('../src/db/db');

const DEFINITION = /(?:(?:const|let|var)\s+|window\.)PRODUCT_INFO\s*=\s*\{/;
const jsDir = path.join(__dirname, '..', 'Javascript');

let file = process.argv[2];
if (!file) {
  const candidates = fs.existsSync(jsDir) ? fs.readdirSync(jsDir).filter((f) => f.endsWith('.js')).sort() : [];
  const hit = candidates.find((f) => DEFINITION.test(fs.readFileSync(path.join(jsDir, f), 'utf8')));
  if (!hit) {
    console.error('Could not find a "const PRODUCT_INFO = {" definition.');
    console.error('Files searched in Javascript/: ' + (candidates.join(', ') || '(none found)'));
    console.error('It may be inside index.html or another folder. In VS Code press Ctrl+Shift+F and search PRODUCT_INFO,');
    console.error('then run:  node db/import-descriptions.js path/to/that/file');
    process.exit(1);
  }
  file = path.join(jsDir, hit);
}
const src = fs.readFileSync(file, 'utf8');
const m = DEFINITION.exec(src);
if (!m) { console.error('No PRODUCT_INFO definition found in ' + file); process.exit(1); }
console.log('Reading PRODUCT_INFO from ' + path.relative(path.join(__dirname, '..'), file));

// find the matching closing brace, skipping text inside quotes and // comments
function extractObject(text, open) {
  let depth = 0, quote = null;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (quote) { if (ch === '\\') i++; else if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '/' && text[i + 1] === '/') { i = text.indexOf('\n', i); if (i < 0) break; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return text.slice(open, i + 1);
  }
  throw new Error('PRODUCT_INFO block is not closed');
}

const info = new Function('return (' + extractObject(src, m.index + m[0].length - 1) + ')')();
const update = db.prepare('UPDATE menu_items SET description = ?, ingredients = ? WHERE name = ?');

let updated = 0; const notInMenu = [];
db.transaction(() => {
  for (const [name, v] of Object.entries(info)) {
    const r = update.run(v.desc || null, JSON.stringify(v.ingredients || []), name);
    r.changes ? updated++ : notInMenu.push(name);
  }
})();

console.log(`Updated ${updated} products from ${path.basename(file)}.`);
if (notInMenu.length) console.log('In main.js but not in the menu table:', notInMenu.join(', '));
const missing = db.prepare('SELECT name FROM menu_items WHERE active = 1 AND description IS NULL').all().map((r) => r.name);
console.log(missing.length ? 'Menu items still without a description: ' + missing.join(', ') : 'Every active menu item has a description.');