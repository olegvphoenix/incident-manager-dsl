// Sidecar-формат layout'а сценария. Хранится в отдельном файле <name>.layout.json
// рядом со <name>.json (DSL). DSL ничего не знает про координаты — это П1 спецификации
// (платформо-независимость). Редактор хранит позиции узлов отдельно и связывает
// layout со сценарием через scenarioGuid + version.
//
// etag — короткий хеш отсортированного списка step.id'ов. Помогает редактору
// при загрузке сравнить, не рассинхронизирован ли layout (шаги могли быть
// добавлены/удалены вне редактора, например через прямую правку JSON).

import type { StepId } from "./dsl";

export interface NodeLayout {
  x: number;
  y: number;
  collapsed?: boolean;
  note?: string;
}

export interface ScenarioLayout {
  layoutVersion: "1.0";
  scenarioRef: {
    scenarioGuid: string;
    version: number;
  };
  // sha1(sorted(step.id).join(',')) на момент сохранения
  etag: string;
  viewport?: { x: number; y: number; zoom: number };
  nodes: Record<StepId, NodeLayout>;
}

export const EMPTY_LAYOUT = (
  scenarioGuid: string,
  version: number,
): ScenarioLayout => ({
  layoutVersion: "1.0",
  scenarioRef: { scenarioGuid, version },
  etag: "",
  viewport: { x: 0, y: 0, zoom: 1 },
  nodes: {},
});
