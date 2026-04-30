// Прогоняет все examples/*.json через валидацию и адаптер toFlow,
// чтобы убедиться, что редактор не падает на реальных сценариях.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validate } from "../src/services/validation";
import { toFlow } from "../src/adapters/toFlow";
import { computeStepsEtag } from "../src/services/etag";
import type { ScenarioLayout } from "../src/types/layout";

const __dirname = dirname(fileURLToPath(import.meta.url));
const examplesRoot = resolve(__dirname, "..", "..", "examples");

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (name.endsWith(".json")) yield full;
  }
}

let total = 0;
let okCount = 0;
const failures: string[] = [];

for (const file of walk(examplesRoot)) {
  total++;
  const text = readFileSync(file, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    failures.push(`${file} :: parse error: ${(err as Error).message}`);
    continue;
  }
  const v = validate(parsed);
  if (!v.ok) {
    // Это нормально для bad-* анти-примеров.
    const isBad = file.includes("bad-");
    if (!isBad) failures.push(`${file} :: lvl1 fail: ${v.diagnostics.slice(0, 2).map((d) => d.message).join("; ")}`);
    process.stdout.write(`[${isBad ? "EXPECTED FAIL" : "FAIL"}] ${file.replace(examplesRoot, "")} (${v.diagnostics.length} errs)\n`);
    continue;
  }
  const layout: ScenarioLayout = {
    layoutVersion: "1.0",
    scenarioRef: { scenarioGuid: v.scenario.metadata.scenarioGuid, version: v.scenario.metadata.version },
    etag: computeStepsEtag(v.scenario.steps),
    nodes: Object.fromEntries(v.scenario.steps.map((s) => [s.id, { x: 0, y: 0 }])),
  };
  let nodes = 0,
    edges = 0;
  try {
    const f = toFlow(v.scenario, layout, v.diagnostics);
    nodes = f.nodes.length;
    edges = f.edges.length;
  } catch (err) {
    failures.push(`${file} :: toFlow threw: ${(err as Error).message}`);
    continue;
  }
  okCount++;
  process.stdout.write(
    `[OK] ${file.replace(examplesRoot, "")} steps=${v.scenario.steps.length} nodes=${nodes} edges=${edges} warnings=${v.diagnostics.length}\n`,
  );
}

process.stdout.write(`\n${okCount}/${total} OK\n`);
if (failures.length > 0) {
  process.stderr.write("\nUnexpected failures:\n");
  for (const f of failures) process.stderr.write(`  - ${f}\n`);
  process.exit(1);
}
