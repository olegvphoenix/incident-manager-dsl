import type { Scenario } from "../types/dsl";
import type { ScenarioEntry } from "./index";

// Пользовательские сценарии хранятся в localStorage как { fileName, scenario }.
// id у них формируется как `user/<fileName>` чтобы не конфликтовать с примерами.

const KEY = "incident-runner.userScenarios";
const PREFIX = "user/";

interface StoredItem {
  fileName: string;       // имя файла, как загрузили: "my-fire.json"
  addedAt: string;        // ISO timestamp
  scenario: Scenario;
}

function readAll(): StoredItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (i): i is StoredItem =>
        i && typeof i === "object" &&
        typeof i.fileName === "string" &&
        typeof i.addedAt === "string" &&
        i.scenario && typeof i.scenario === "object",
    );
  } catch { return []; }
}

// Кешируем результат loadUserScenarios между рендерами:
// useSyncExternalStore требует, чтобы getSnapshot возвращал стабильную ссылку
// для одних и тех же данных, иначе React попадёт в бесконечный re-render (ошибка #185).
let cachedSnapshot: ScenarioEntry[] = [];
let cachedFromRaw: string | null = null;

function recomputeSnapshot(): void {
  const raw = localStorage.getItem(KEY) ?? "";
  if (raw === cachedFromRaw) return;        // данные не менялись — не пересчитываем
  cachedFromRaw = raw;
  cachedSnapshot = readAll().map((item) => ({
    id: PREFIX + item.fileName,
    path: PREFIX + item.fileName,
    scenario: item.scenario,
    isRunnable: true,
  }));
}

function writeAll(items: StoredItem[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
  cachedFromRaw = null;   // следующий getSnapshot пересчитает
}

// События для подписки UI (свой простой emitter).
const listeners = new Set<() => void>();
export function subscribeUserScenarios(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
function notify() { listeners.forEach((l) => l()); }

// Уникальное имя файла: если уже занято — добавляем "(2)", "(3)" и т.д.
function uniqueFileName(items: StoredItem[], desired: string): string {
  const existing = new Set(items.map((i) => i.fileName));
  if (!existing.has(desired)) return desired;
  const base = desired.replace(/\.json$/i, "");
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base} (${i}).json`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}.json`;
}

export function addUserScenario(fileName: string, scenario: Scenario): StoredItem {
  const items = readAll();
  const item: StoredItem = {
    fileName: uniqueFileName(items, fileName.endsWith(".json") ? fileName : fileName + ".json"),
    addedAt: new Date().toISOString(),
    scenario,
  };
  items.push(item);
  writeAll(items);
  notify();
  return item;
}

// Пакетная вставка с дедупликацией: пропускаем сценарии, у которых
//   - совпал scenarioGuid с любым уже-загруженным (user или встроенный пример), ИЛИ
//   - совпало имя файла с уже-загруженным пользовательским.
// Возвращает структурированный отчёт, чтобы UI показал «добавлено N, пропущено M».
export interface BatchInputItem {
  fileName: string;
  scenario: Scenario;
}
export interface BatchAddResult {
  added: { fileName: string; scenarioGuid: string }[];
  skipped: { fileName: string; reason: string }[];
}
export function addUserScenariosBatch(
  inputs: BatchInputItem[],
  builtinGuids: ReadonlySet<string>,
): BatchAddResult {
  const items = readAll();
  const userGuids = new Set(items.map((i) => i.scenario.metadata.scenarioGuid));
  const userFiles = new Set(items.map((i) => i.fileName));

  const added: BatchAddResult["added"] = [];
  const skipped: BatchAddResult["skipped"] = [];

  for (const inp of inputs) {
    const guid = inp.scenario.metadata.scenarioGuid;
    if (builtinGuids.has(guid)) {
      skipped.push({ fileName: inp.fileName, reason: `scenarioGuid совпадает со встроенным примером (${guid})` });
      continue;
    }
    if (userGuids.has(guid)) {
      skipped.push({ fileName: inp.fileName, reason: `scenarioGuid уже есть в Моих сценариях (${guid})` });
      continue;
    }
    const fn = inp.fileName.endsWith(".json") ? inp.fileName : inp.fileName + ".json";
    if (userFiles.has(fn)) {
      skipped.push({ fileName: fn, reason: "имя файла уже занято в Моих сценариях" });
      continue;
    }
    items.push({ fileName: fn, addedAt: new Date().toISOString(), scenario: inp.scenario });
    userGuids.add(guid);
    userFiles.add(fn);
    added.push({ fileName: fn, scenarioGuid: guid });
  }

  if (added.length > 0) {
    writeAll(items);
    notify();
  }
  return { added, skipped };
}

export function removeUserScenario(fileName: string): void {
  const items = readAll().filter((i) => i.fileName !== fileName);
  writeAll(items);
  notify();
}

export function clearUserScenarios(): void {
  writeAll([]);
  notify();
}

// Преобразуем в формат, совместимый с примерами (тот же ScenarioEntry).
// Возвращает стабильную (по reference) ссылку, пока данные в localStorage не менялись —
// нужно для useSyncExternalStore.
export function loadUserScenarios(): ScenarioEntry[] {
  recomputeSnapshot();
  return cachedSnapshot;
}

export function isUserScenarioId(id: string): boolean {
  return id.startsWith(PREFIX);
}

export function userFileNameFromId(id: string): string | null {
  return id.startsWith(PREFIX) ? id.slice(PREFIX.length) : null;
}
