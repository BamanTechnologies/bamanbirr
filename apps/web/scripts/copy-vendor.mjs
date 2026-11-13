// Copy runtime files the browser loads at run time (not bundled) into public/vendor.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const out = new URL("../public/vendor/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const sqlDir = dirname(require.resolve("sql.js/dist/sql-wasm.js"));
const pdfDir = join(dirname(require.resolve("pdfjs-dist/package.json")), "build");
for (const [dir, f] of [[sqlDir, "sql-wasm-browser.wasm"], [sqlDir, "sql-wasm.wasm"], [pdfDir, "pdf.worker.min.mjs"]]) {
  copyFileSync(join(dir, f), join(out, f));
}
console.log("vendor files copied to public/vendor");
