/**
 * Copies the backend's documented API types into the app.
 * Run after the backend docs are regenerated:  npm run sync-types
 */
const fs = require("fs");
const path = require("path");

const src = path.resolve(__dirname, "../../worldwecare.com/docs/api-types.ts");
const dest = path.resolve(__dirname, "../src/types/api-types.ts");

if (!fs.existsSync(src)) {
  console.error(`Not found: ${src}`);
  process.exit(1);
}
fs.copyFileSync(src, dest);
console.log(`Synced ${path.relative(process.cwd(), dest)}`);
