import type { Scenario } from "../types/dsl";

// Динамический подхват ВСЕХ JSON-файлов из ../examples — рекурсивно.
// Добавили новый файл в incident-manager-dsl/examples/ — он автоматически
// появляется в списке без правок этого файла. Vite кладёт JSON в bundle при build,
// а в dev отдаёт через HMR.
const modules = import.meta.glob(
  "../../../examples/**/*.json",
  { eager: true, import: "default" },
) as Record<string, Scenario>;

export interface ScenarioEntry {
  id: string;                  // относительный путь от examples/, например "01-perimeter-alarm.json"
  path: string;                // полный путь как в glob
  scenario: Scenario;
  isRunnable: boolean;         // CallScenario без серверного резолва пока не запускаем
  reasonNotRunnable?: string;
}

function relativeId(globPath: string): string {
  const m = globPath.match(/\/examples\/(.+)$/);
  return m ? m[1]! : globPath;
}

function checkRunnable(scenario: Scenario): { ok: boolean; reason?: string } {
  const hasCallScenario = scenario.steps.some((s) => s.type === "CallScenario");
  if (hasCallScenario) {
    return {
      ok: false,
      reason: "call-scenario",
    };
  }
  // Анти-примеры из A5/ — ругаемся на этапе выполнения, но в список включаем.
  return { ok: true };
}

export function loadAllScenarios(): ScenarioEntry[] {
  const entries: ScenarioEntry[] = [];
  for (const [path, scenario] of Object.entries(modules)) {
    const check = checkRunnable(scenario);
    entries.push({
      id: relativeId(path),
      path,
      scenario,
      isRunnable: check.ok,
      reasonNotRunnable: check.reason,
    });
  }
  entries.sort((a, b) => a.id.localeCompare(b.id, "ru"));
  return entries;
}
