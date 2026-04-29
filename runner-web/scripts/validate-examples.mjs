// Прогоняем все JSON-сценарии из examples/** через dsl-v1-schema.json.
// Запускается из runner-web/ так:  node scripts/validate-examples.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const schemaPath = path.join(repoRoot, "dsl-v1-schema.json");
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile() && p.endsWith(".json")) out.push(p);
  }
  return out;
}

const examplesDir = path.join(repoRoot, "examples");
const files = walk(examplesDir).sort();

// Anti-pattern'ы (kind: "schema-rejects") должны быть невалидными — это и есть их назначение.
// Для них «успех» = валидатор отверг.

let valid = 0;
let antiOk = 0;
let antiSurprise = 0;
const realFailures = [];
const antiPatternsThatPassed = [];

for (const file of files) {
  const rel = path.relative(repoRoot, file).replaceAll("\\", "/");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const ok = validate(data);
  const isAnti = data?.metadata?.kind === "schema-rejects";

  if (isAnti) {
    if (!ok) antiOk++;            // ожидаемо отвергнут
    else { antiSurprise++; antiPatternsThatPassed.push(rel); } // anti-pattern почему-то прошёл
  } else {
    if (ok) valid++;
    else realFailures.push({ rel, errors: validate.errors });
  }
}

console.log(`Прогон ${files.length} файлов из examples/`);
console.log(`  валидных сценариев прошло:       ${valid}`);
console.log(`  anti-pattern'ов отвергнуто:       ${antiOk}  (ожидаемо)`);
console.log(`  валидных сценариев упало:         ${realFailures.length}`);
console.log(`  anti-pattern'ов прошло (плохо):   ${antiSurprise}`);

if (realFailures.length > 0) {
  console.log("\nНеожиданно невалидные сценарии:");
  for (const { rel, errors } of realFailures) {
    console.log(`\n  ${rel}`);
    for (const err of errors ?? []) {
      console.log(`    - ${err.instancePath || "/"} ${err.message}`);
    }
  }
  process.exit(1);
}

if (antiSurprise > 0) {
  console.log("\nАнти-паттерны, которые НЕ были отвергнуты схемой:");
  for (const rel of antiPatternsThatPassed) console.log(`  ${rel}`);
  process.exit(2);
}

console.log("\nOK.");
