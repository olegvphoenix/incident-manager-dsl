// Автоматическая раскладка графа через dagre.
// Используется в двух случаях:
//   1) при загрузке сценария без sidecar layout — для всех узлов;
//   2) при etag-merge для НОВЫХ узлов (старые остаются на сохранённых позициях).
//
// dagre раскладывает направленный граф top-to-bottom; именно это естественно
// для UI-сценария: оператор идёт сверху вниз. Размер узла фиксированный
// (NODE_WIDTH × NODE_HEIGHT), реальные размеры ReactFlow измерит позже —
// dagre нужно лишь оценить занятость холста.

import dagre from "dagre";
import type { ScenarioScript, StepId } from "../types/dsl";

export const NODE_WIDTH = 240;
export const NODE_HEIGHT = 80;
export const NODE_HSPACING = 60;
export const NODE_VSPACING = 80;

// Размер терминального узла (FINISH/REPORT/ESCALATE/ASSIGN) для dagre.
// В UI он рисуется компактнее, но dagre важна примерная занятость места,
// чтобы соседи не наехали.
export const TERMINAL_WIDTH = 140;
export const TERMINAL_HEIGHT = 48;

// Префикс id для синтетических терминальных узлов.
export const TERMINAL_PREFIX = "__end_";

export interface NodePosition {
  x: number;
  y: number;
}

export interface AutoLayoutOptions {
  // позиции, которые надо СОХРАНИТЬ (например, уже размещённые узлы из layout-файла).
  // dagre всё равно учитывает эти узлы при раскладке, но возвращаемая позиция
  // для них не используется.
  preserve?: Record<StepId, NodePosition>;
}

export function autoLayoutScenario(
  scenario: ScenarioScript,
  opts: AutoLayoutOptions = {},
): Record<StepId, NodePosition> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "TB",
    nodesep: NODE_HSPACING,
    ranksep: NODE_VSPACING,
    marginx: 16,
    marginy: 16,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const step of scenario.steps) {
    g.setNode(step.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  // Регистрируем синтетические терминальные узлы по тем шагам, у которых
  // default — это finish/escalate/assign/generateReport/callMacro без goto.
  // Это позволяет dagre учесть их при раскладке (иначе они слепо лепятся
  // справа-снизу от исходного шага и накладываются на чужие узлы).
  const TERMINAL_TYPES = new Set([
    "finish",
    "escalate",
    "assign",
    "generateReport",
    "callMacro",
  ]);
  for (const step of scenario.steps) {
    const t = step.transitions;
    if (!t) continue;
    const hasGoto = t.default?.goto !== undefined && t.default?.goto !== null;
    if (hasGoto) continue;
    const hasTerminal = !!t.default?.actions?.some((a) =>
      TERMINAL_TYPES.has(a.type),
    );
    if (!hasTerminal) continue;
    const tid = TERMINAL_PREFIX + step.id;
    g.setNode(tid, { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT });
    g.setEdge(step.id, tid);
  }

  for (const step of scenario.steps) {
    const t = step.transitions;
    if (!t) continue;
    if (t.rules) {
      for (const r of t.rules) {
        if (r.goto && g.hasNode(r.goto)) {
          g.setEdge(step.id, r.goto);
        }
      }
    }
    if (t.default.goto && g.hasNode(t.default.goto)) {
      g.setEdge(step.id, t.default.goto);
    }
  }

  dagre.layout(g);

  const out: Record<StepId, NodePosition> = {};
  const preserve = opts.preserve ?? {};
  for (const step of scenario.steps) {
    if (preserve[step.id]) {
      out[step.id] = preserve[step.id]!;
      continue;
    }
    const n = g.node(step.id);
    if (!n) continue;
    out[step.id] = { x: n.x - NODE_WIDTH / 2, y: n.y - NODE_HEIGHT / 2 };
  }

  // Возвращаем и позиции терминальных узлов — но только тех, что dagre
  // действительно разложил, и по ключу TERMINAL_PREFIX + stepId.
  for (const step of scenario.steps) {
    const tid = TERMINAL_PREFIX + step.id;
    if (!g.hasNode(tid)) continue;
    if (preserve[tid]) {
      out[tid] = preserve[tid]!;
      continue;
    }
    const n = g.node(tid);
    if (!n) continue;
    out[tid] = { x: n.x - TERMINAL_WIDTH / 2, y: n.y - TERMINAL_HEIGHT / 2 };
  }

  return out;
}
