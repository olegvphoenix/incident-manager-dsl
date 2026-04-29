// Делает тестовый ZIP с двумя сценариями: один новый (свежий guid), один — копия
// существующего примера (для проверки skip-by-guid). Результат сохраняется в
// dist-tools/test-import.zip — этот файл руками подсовываем в диалог импорта.

import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync, strToU8 } from "fflate";

const __dirname = dirname(fileURLToPath(import.meta.url));
const examplesDir = join(__dirname, "..", "..", "examples");
const outDir = join(__dirname, "..", "dist-tools");
mkdirSync(outDir, { recursive: true });

// 1. «Новый» сценарий (guid сгенерирован для теста, его точно нет в репозитории).
const fresh = {
  dslVersion: "v1",
  metadata: {
    scenarioGuid: "0192f000-0000-7000-8000-000000000999",
    version: 1,
    name: "TEST: одношаговый сценарий импорта",
  },
  initialStepId: "s1",
  steps: [
    {
      id: "s1",
      type: "Comment",
      title: "Импорт-тест",
      view: { text: "Если ты это видишь — импорт сработал." },
      transitions: [{ goto: null }],
    },
  ],
};

// 2. Копия настоящего примера — должна быть пропущена (тот же scenarioGuid).
const dupSrc = readFileSync(join(examplesDir, "01-perimeter-alarm.json"), "utf8");

const archive = {
  "user/test-import-fresh.json": strToU8(JSON.stringify(fresh, null, 2)),
  "user/test-import-duplicate.json": strToU8(dupSrc),
};

const zipped = zipSync(archive, { level: 6 });
const outFile = join(outDir, "test-import.zip");
writeFileSync(outFile, zipped);
console.log(`Wrote ${outFile} (${zipped.byteLength} bytes)`);
