// Генерирует sidecar layout-файлы рядом с указанными сценариями.
// По умолчанию — для пары компактных и крупных примеров (см. TARGETS),
// чтобы продемонстрировать пользователю формат scenario.json + scenario.layout.json.
//
// Запуск: node scripts/generate-layouts.mjs
//   или:  node scripts/generate-layouts.mjs <relative-path-to-scenario.json> [...]

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

import { validate } from "../src/services/validation";
import { autoLayoutScenario } from "../src/adapters/autoLayout";
import { computeStepsEtag } from "../src/services/etag";
import type { ScenarioLayout } from "../src/types/layout";

const __dirname = dirname(fileURLToPath(import.meta.url));
const examplesRoot = resolve(__dirname, "..", "..", "examples");

const TARGETS_DEFAULT = [
  "02-fire-alarm.json",
  "09-camera-sabotage-suspicion.json",
  "10-mass-event-protocol.json",
];

const args = process.argv.slice(2);
const targets = args.length > 0 ? args : TARGETS_DEFAULT;

let okCount = 0;
const failures: string[] = [];

for (const rel of targets) {
  const file = resolve(examplesRoot, rel);
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (err) {
    failures.push(`${rel} :: read error: ${(err as Error).message}`);
    continue;
  }

  const parsed = JSON.parse(text) as unknown;
  const v = validate(parsed);
  if (!v.ok) {
    failures.push(
      `${rel} :: lvl1 fail: ${v.diagnostics
        .slice(0, 2)
        .map((d) => d.message)
        .join("; ")}`,
    );
    continue;
  }

  const positions = autoLayoutScenario(v.scenario);
  const nodes: ScenarioLayout["nodes"] = {};
  for (const step of v.scenario.steps) {
    const p = positions[step.id] ?? { x: 0, y: 0 };
    nodes[step.id] = { x: p.x, y: p.y };
  }

  const layout: ScenarioLayout = {
    layoutVersion: "1.0",
    scenarioRef: {
      scenarioGuid: v.scenario.metadata.scenarioGuid,
      version: v.scenario.metadata.version,
    },
    etag: computeStepsEtag(v.scenario.steps),
    nodes,
    viewport: { x: 0, y: 0, zoom: 1 },
  };

  const layoutPath = file.replace(/\.json$/i, ".layout.json");
  writeFileSync(layoutPath, JSON.stringify(layout, null, 2) + "\n", "utf8");
  okCount++;
  process.stdout.write(
    `[OK] ${rel} -> ${basename(layoutPath)} (steps=${v.scenario.steps.length})\n`,
  );
}

process.stdout.write(`\n${okCount}/${targets.length} layouts written\n`);
if (failures.length > 0) {
  process.stderr.write("\nFailures:\n");
  for (const f of failures) process.stderr.write(`  - ${f}\n`);
  process.exit(1);
}
