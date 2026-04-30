// Одноразовый скрипт миграции: добавляет в каждый сценарий из ../../examples
// metadata.scenarioGuid (детерминированный по имени файла) и metadata.version
// (если ещё нет). Идемпотентный — повторный запуск ничего не меняет.
//
// Запуск: node tools/add-scenario-identity.mjs
//
// Детерминированный guid (RFC 4122 v8 namespace-based, упрощённый): берём
// SHA-256 от пути файла, форматируем как UUID. Это НЕ UUIDv7 (нет встроенной
// сортировки по времени), но даёт стабильный guid для документационных
// примеров.
//
// В реальном конфигураторе guid — UUIDv7, генерируемый в момент создания.

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, basename, dirname } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = join(__dirname, "..", "..", "examples");

function deterministicUuid(seed) {
  const h = createHash("sha256").update(seed).digest("hex");
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    "7" + h.slice(13, 16),
    "8" + h.slice(17, 20),
    h.slice(20, 32),
  ].join("-");
}

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (s.isFile() && e.endsWith(".json")) out.push(p);
  }
  return out;
}

let touched = 0, skipped = 0, broken = 0;
for (const path of walk(EXAMPLES_DIR)) {
  if (basename(path) === "package.json") continue;
  let raw;
  try { raw = readFileSync(path, "utf8"); }
  catch { continue; }
  let json;
  try { json = JSON.parse(raw); }
  catch { broken++; continue; }
  if (!json || typeof json !== "object") continue;
  if (!json.metadata) json.metadata = {};

  const rel = relative(EXAMPLES_DIR, path).replaceAll("\\", "/");
  const seed = "axxon.im.dsl.example/" + rel;

  let changed = false;
  if (!json.metadata.scenarioGuid) {
    json.metadata.scenarioGuid = deterministicUuid(seed);
    changed = true;
  }
  if (typeof json.metadata.version !== "number") {
    if (/v2-after-edit/.test(rel) || /-v2\.json$/.test(rel) || /pinned-v2/.test(rel)) {
      json.metadata.version = 2;
    } else {
      json.metadata.version = 1;
    }
    changed = true;
  }
  if (typeof json.metadata.name !== "string") {
    json.metadata.name = basename(path, ".json");
    changed = true;
  }

  if (changed) {
    const reordered = { ...json };
    const m = reordered.metadata;
    reordered.metadata = {
      scenarioGuid: m.scenarioGuid,
      version: m.version,
      name: m.name,
      ...Object.fromEntries(Object.entries(m).filter(([k]) => !["scenarioGuid", "version", "name"].includes(k))),
    };
    writeFileSync(path, JSON.stringify(reordered, null, 2) + "\n", "utf8");
    touched++;
    console.log(`  + ${rel}  guid=${m.scenarioGuid} v=${m.version}`);
  } else {
    skipped++;
  }
}
console.log(`\nDone. touched=${touched} skipped=${skipped} broken=${broken}`);
