// pdf.js renders PDFs in a Web Worker loaded by URL, and fetches its font, CMap,
// colour-profile and WASM decoder data by URL too. Copy everything matching the
// installed pdfjs-dist into public/ before dev/build, so the two can never drift apart.
import { cpSync, mkdirSync, rmSync } from "node:fs";

const src = "node_modules/pdfjs-dist";
const out = "public/vendor/pdfjs";
rmSync("public/vendor", { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(`${src}/build/pdf.worker.min.mjs`, `${out}/pdf.worker.min.mjs`);
for (const dir of ["cmaps", "standard_fonts", "wasm", "iccs"]) cpSync(`${src}/${dir}`, `${out}/${dir}`, { recursive: true });
