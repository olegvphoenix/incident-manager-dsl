// Экспорт/импорт всех сценариев в один ZIP-архив.
// Используем fflate — компактный (~30KB) zip-кодек без зависимостей, работающий в браузере.

import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import type { Scenario } from "../types/dsl";
import type { ScenarioEntry } from "./index";
import { validateScenarioJson, formatError } from "../engine/validateScenario";
import { addUserScenariosBatch, type BatchAddResult } from "./userScenarios";

// === Экспорт ====================================================================
//
// Раскладка внутри zip:
//   examples/01-perimeter-alarm.json
//   examples/architecture/A1-...
//   user/<fileName>.json
//   _manifest.json   ← вспомогательная сводка для людей и инструментов
//
// Имена внутри архива одинаковы, как в репозитории, чтобы:
//   1) можно было распаковать поверх git-репозитория и сделать diff;
//   2) можно было импортировать обратно (и user, и examples различаются по корневой папке).

interface ManifestEntry {
  path: string;                          // путь внутри архива
  category: "examples" | "user";
  scenarioGuid: string;
  version: number;
  name: string;
  isRunnable: boolean;
  reasonNotRunnable?: string;
}
interface Manifest {
  exportedAt: string;
  dslVersion: string;
  count: number;
  entries: ManifestEntry[];
}

function buildArchiveEntries(
  examples: ScenarioEntry[],
  userEntries: ScenarioEntry[],
): { files: Record<string, Uint8Array>; manifest: Manifest } {
  const files: Record<string, Uint8Array> = {};
  const manifestEntries: ManifestEntry[] = [];

  const push = (path: string, category: "examples" | "user", entry: ScenarioEntry): void => {
    const json = JSON.stringify(entry.scenario, null, 2) + "\n";
    files[path] = strToU8(json);
    const meta = entry.scenario.metadata;
    manifestEntries.push({
      path,
      category,
      scenarioGuid: meta.scenarioGuid,
      version: meta.version,
      name: meta.name,
      isRunnable: entry.isRunnable,
      reasonNotRunnable: entry.reasonNotRunnable,
    });
  };

  for (const e of examples) push("examples/" + e.id, "examples", e);
  // У user'а id вида "user/<fileName>". Убираем префикс "user/" перед склейкой.
  for (const e of userEntries) {
    const name = e.id.startsWith("user/") ? e.id.slice("user/".length) : e.id;
    push("user/" + name, "user", e);
  }

  // dslVersion берём из первого попавшегося сценария — у всех должно быть одинаково.
  const sample = examples[0]?.scenario ?? userEntries[0]?.scenario;
  const manifest: Manifest = {
    exportedAt: new Date().toISOString(),
    dslVersion: sample?.dslVersion ?? "v1",
    count: manifestEntries.length,
    entries: manifestEntries.sort((a, b) => a.path.localeCompare(b.path)),
  };
  files["_manifest.json"] = strToU8(JSON.stringify(manifest, null, 2) + "\n");

  return { files, manifest };
}

export function exportScenariosZip(
  examples: ScenarioEntry[],
  userEntries: ScenarioEntry[],
): { blob: Blob; fileName: string; manifest: Manifest } {
  const { files, manifest } = buildArchiveEntries(examples, userEntries);
  const u8 = zipSync(files, { level: 6 });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fileName = `incident-manager-scenarios-${ts}.zip`;
  // Копируем в новый ArrayBuffer, чтобы Blob не зависел от живого SharedArrayBuffer.
  const buffer = new ArrayBuffer(u8.byteLength);
  new Uint8Array(buffer).set(u8);
  const blob = new Blob([buffer], { type: "application/zip" });
  return { blob, fileName, manifest };
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// === Импорт =====================================================================
//
// Пользователь может бросить:
//   - один или несколько .zip-архивов (вытаскиваем оттуда все .json);
//   - один или несколько .json-файлов (валидируем напрямую).
// Каждый валидный сценарий пробуем добавить в «Мои сценарии». Дубликаты
// (по scenarioGuid встроенного примера, по scenarioGuid user'а, по имени файла)
// пропускаются. Отчёт возвращается каллеру.

export interface ImportFileError {
  fileName: string;
  errors: string[];
}
export interface ImportResult {
  added: BatchAddResult["added"];
  skipped: BatchAddResult["skipped"];
  invalid: ImportFileError[];   // файлы, не прошедшие валидацию схемой / парсинг JSON
}

export async function importFiles(
  files: File[],
  builtinGuids: ReadonlySet<string>,
): Promise<ImportResult> {
  const collected: { fileName: string; text: string }[] = [];
  const invalid: ImportFileError[] = [];

  for (const f of files) {
    const lower = f.name.toLowerCase();
    if (lower.endsWith(".zip")) {
      try {
        const u8 = new Uint8Array(await f.arrayBuffer());
        const unzipped = unzipSync(u8);
        for (const [path, content] of Object.entries(unzipped)) {
          if (!path.toLowerCase().endsWith(".json")) continue;
          if (path.endsWith("/_manifest.json") || path === "_manifest.json") continue;
          collected.push({ fileName: baseName(path), text: strFromU8(content) });
        }
      } catch (e) {
        invalid.push({
          fileName: f.name,
          errors: ["не удалось распаковать ZIP: " + (e instanceof Error ? e.message : String(e))],
        });
      }
    } else if (lower.endsWith(".json")) {
      collected.push({ fileName: f.name, text: await f.text() });
    } else {
      invalid.push({ fileName: f.name, errors: ["неподдерживаемый тип файла (нужен .json или .zip)"] });
    }
  }

  // Валидируем каждый по схеме DSL.
  const validInputs: { fileName: string; scenario: Scenario }[] = [];
  for (const { fileName, text } of collected) {
    const result = validateScenarioJson(text);
    if (!result.ok) {
      invalid.push({ fileName, errors: result.errors.map(formatError) });
      continue;
    }
    validInputs.push({ fileName, scenario: result.scenario });
  }

  const batch = addUserScenariosBatch(validInputs, builtinGuids);
  return { added: batch.added, skipped: batch.skipped, invalid };
}

function baseName(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i >= 0 ? path.slice(i + 1) : path;
}
