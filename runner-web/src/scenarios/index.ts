import type { Scenario } from "../types/dsl";

// Динамический подхват JSON-файлов из ../examples — рекурсивно.
// Добавили новый файл в incident-manager-dsl/examples/ — он автоматически
// появляется в списке без правок этого файла. Vite кладёт JSON в bundle при build,
// а в dev отдаёт через HMR.
//
// Важно: рядом со сценариями могут лежать sidecar-файлы:
//   * <name>.layout.json   — UI-разметка для конфигуратора (positions/viewport),
//                             без поля metadata.scenarioGuid;
//   * architecture/A5-anti-patterns/*.json — намеренно битые примеры для
//                             документации, у части из них может не быть
//                             валидной metadata.
// Их нельзя пропускать как обычные сценарии, иначе runner падает на старте
// при чтении meta.scenarioGuid у undefined. Фильтруем их и в glob, и runtime.
const allModules = import.meta.glob(
  "../../../examples/**/*.json",
  { eager: true, import: "default" },
) as Record<string, unknown>;

const modules = Object.fromEntries(
  Object.entries(allModules).filter(([path, value]) => {
    if (path.endsWith(".layout.json")) return false;
    if (path.includes("/A5-anti-patterns/")) return false;
    // Защита от любых других «не-сценариев», случайно попавших в examples/.
    const v = value as { metadata?: { scenarioGuid?: unknown } } | null | undefined;
    if (!v || typeof v !== "object") return false;
    if (!v.metadata || typeof v.metadata.scenarioGuid !== "string") return false;
    return true;
  }),
) as Record<string, Scenario>;

export interface ScenarioEntry {
  id: string;                  // относительный путь от examples/, например "01-perimeter-alarm.json"
  path: string;                // полный путь как в glob
  scenario: Scenario;
  isRunnable: boolean;
  reasonNotRunnable?: string;
}

function relativeId(globPath: string): string {
  const m = globPath.match(/\/examples\/(.+)$/);
  return m ? m[1]! : globPath;
}

export function loadAllScenarios(): ScenarioEntry[] {
  const entries: ScenarioEntry[] = [];
  for (const [path, scenario] of Object.entries(modules)) {
    entries.push({
      id: relativeId(path),
      path,
      scenario,
      isRunnable: true,
    });
  }
  entries.sort((a, b) => a.id.localeCompare(b.id, "ru"));
  return entries;
}
