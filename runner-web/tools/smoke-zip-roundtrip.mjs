// Smoke-тест round-trip экспорт ↔ импорт.
// Не зависит от UI: использует ту же fflate-логику, что и продовый код.
// Запуск: node tools/smoke-zip-roundtrip.mjs

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";

const __dirname = dirname(fileURLToPath(import.meta.url));
const examplesDir = join(__dirname, "..", "..", "examples");

function findJson(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...findJson(full));
    else if (entry.endsWith(".json")) out.push(full);
  }
  return out;
}

const files = findJson(examplesDir);
console.log(`Found ${files.length} example .json files`);

// 1. Собираем zip-архив (как делает exportScenariosZip).
const archive = {};
for (const f of files) {
  const text = readFileSync(f, "utf8");
  const rel = "examples/" + relative(examplesDir, f).replace(/\\/g, "/");
  archive[rel] = strToU8(text);
}
archive["_manifest.json"] = strToU8(JSON.stringify({
  exportedAt: new Date().toISOString(),
  count: files.length,
}, null, 2));

const zipped = zipSync(archive, { level: 6 });
console.log(`Zipped: ${zipped.byteLength} bytes (${(zipped.byteLength / 1024).toFixed(1)} KB)`);

// 2. Распаковываем и сверяем.
const unzipped = unzipSync(zipped);
const unzippedKeys = Object.keys(unzipped).filter(k => k.endsWith(".json") && k !== "_manifest.json");
console.log(`Unzipped: ${unzippedKeys.length} json files`);

let mismatches = 0;
for (const key of unzippedKeys) {
  const original = archive[key];
  const restored = unzipped[key];
  if (original.length !== restored.length) {
    mismatches++;
    console.error(`MISMATCH ${key}: ${original.length} vs ${restored.length} bytes`);
    continue;
  }
  for (let i = 0; i < original.length; i++) {
    if (original[i] !== restored[i]) {
      mismatches++;
      console.error(`MISMATCH ${key}: byte ${i} differs`);
      break;
    }
  }
}

// 3. Парсим как JSON, проверяем что у каждого есть metadata.scenarioGuid.
let withoutGuid = 0;
for (const key of unzippedKeys) {
  const text = strFromU8(unzipped[key]);
  const obj = JSON.parse(text);
  if (!obj.metadata?.scenarioGuid) withoutGuid++;
}

console.log(`Mismatches: ${mismatches}`);
console.log(`Without scenarioGuid: ${withoutGuid}`);

if (mismatches === 0 && withoutGuid === 0 && unzippedKeys.length === files.length) {
  console.log("\n✅ Round-trip OK: все файлы байт-в-байт совпадают, у каждого есть scenarioGuid.");
  process.exit(0);
} else {
  console.error("\n❌ Round-trip failed");
  process.exit(1);
}
