import type { ScenarioScript } from "../types/dsl";
import { EMPTY_LAYOUT } from "../types/layout";
import { useEditorStore } from "../store/editorStore";

// Handoff из runner-web. runner-web и configurator-web раздаются с одного
// origin (runner — корень, configurator — /configurator/), поэтому
// sessionStorage у них общий — это самый простой механизм передачи.
//
// Протокол:
//   1. runner кладёт payload в sessionStorage под ключом HANDOFF_KEY,
//      затем вызывает window.location.assign("/configurator/?from=runner").
//   2. configurator при старте видит ?from=runner → читает payload →
//      сразу удаляет ключ → загружает сценарий в редактор → чистит query.
//
// Если payload протух (>5 минут) — игнорируем. Это защита от случая
// «открыл /configurator/?from=runner вручную» с залежавшимися данными.

const HANDOFF_KEY = "im.handoff.scenario";
const MAX_AGE_MS = 5 * 60 * 1000;

interface HandoffPayload {
  scenario: ScenarioScript;
  baseName?: string;
  timestamp?: number;
}

// Должна вызываться однократно при старте. Если ?from=runner — забирает
// сценарий из sessionStorage и грузит в editorStore. В остальных случаях —
// no-op.
export function setupHandoffListener(): () => void {
  if (typeof window === "undefined") return () => {};
  const url = new URL(window.location.href);
  if (url.searchParams.get("from") !== "runner") return () => {};

  url.searchParams.delete("from");
  window.history.replaceState(null, "", url.toString());

  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(HANDOFF_KEY);
    if (raw) sessionStorage.removeItem(HANDOFF_KEY);
  } catch {
    return () => {};
  }
  if (!raw) return () => {};

  let payload: HandoffPayload;
  try {
    payload = JSON.parse(raw) as HandoffPayload;
  } catch {
    return () => {};
  }
  if (!payload.scenario) return () => {};
  if (payload.timestamp && Date.now() - payload.timestamp > MAX_AGE_MS) {
    return () => {};
  }

  const sc = payload.scenario;
  const guid = sc.metadata?.scenarioGuid ?? "";
  const version = sc.metadata?.version ?? 1;
  const layout = EMPTY_LAYOUT(guid, version);
  useEditorStore.getState().loadScenario(sc, layout, {
    baseName: payload.baseName ?? sc.metadata?.name ?? "scenario",
  });

  return () => {};
}
