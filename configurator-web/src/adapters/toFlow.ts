// Адаптер DSL + Layout → ReactFlow.
//
// Это чистая read-функция: на каждый рендер пересчитывает nodes/edges
// из текущего scenario и layout. Делает три вещи:
//
//   1. На каждый Step генерирует Node ReactFlow. type = step.type, чтобы
//      ReactFlow выбрал нужный nodeType-компонент. Координаты — из layout.
//
//   2. На каждое transition.goto != null генерирует Edge.
//        - default       → edgeType = "defaultEdge", без подписи
//        - rules[i].goto → edgeType = "ruleEdge", подпись = compactLogic(when)
//      На goto: null — edge с source==target (loop).
//
//   3. Для finish-action в default (когда goto не задан) генерирует
//      синтетический терминальный node "__end_<stepId>" с edge к нему.
//      Эти узлы — выдумка редактора; в DSL их нет. Они помечены
//      data.synthetic = true и игнорируются при сохранении.
//
// Семантические ошибки (Diagnostic[]) маркируют ноды/рёбра флагом hasError —
// чтобы они подсветились красным в FlowView без отдельной логики в каждой Node.

import type { Edge, Node } from "@xyflow/react";

import type { ScenarioScript, Step, StepId } from "../types/dsl";
import type { ScenarioLayout } from "../types/layout";
import type { Diagnostic } from "../services/validation";
import { compactLogicLabel } from "./jsonLogicLabel";

export interface FlowNodeData extends Record<string, unknown> {
  step?: Step;
  isInitial?: boolean;
  hasError?: boolean;
  synthetic?: boolean;
  // для терминальных узлов
  terminalKind?: "finish" | "escalate" | "assign" | "callMacro" | "generateReport";
  // количество правил у шага (для бейджа на ноде)
  rulesCount?: number;
}

export interface FlowEdgeData extends Record<string, unknown> {
  kind: "default" | "rule" | "terminal";
  ruleIndex?: number;
  hasError?: boolean;
  // для terminal — какой action породил ребро
  terminalKind?: FlowNodeData["terminalKind"];
  // полный текст условия для tooltip (raw JSONLogic, отформатированный)
  whenText?: string;
  // типы side-effect actions у этого rule/default (для индикаторов на edge)
  sideActionTypes?: string[];
}

export interface ToFlowOpts {
  // если true, генерируем терминальные ноды для finish/escalate/assign actions.
  // На M2 включаем — это даёт читаемую визуализацию завершения сценария.
  generateTerminals?: boolean;
}

export function toFlow(
  scenario: ScenarioScript,
  layout: ScenarioLayout,
  diagnostics: Diagnostic[] = [],
  opts: ToFlowOpts = { generateTerminals: true },
): { nodes: Node<FlowNodeData>[]; edges: Edge<FlowEdgeData>[] } {
  const errorByStep = new Set(
    diagnostics.filter((d) => d.severity === "error" && d.stepId).map((d) => d.stepId!),
  );
  const errorByStepRule = new Set(
    diagnostics
      .filter((d) => d.severity === "error" && d.stepId && d.ruleIndex !== undefined)
      .map((d) => `${d.stepId}::${d.ruleIndex}`),
  );

  const nodes: Node<FlowNodeData>[] = [];
  const edges: Edge<FlowEdgeData>[] = [];

  for (const step of scenario.steps) {
    const pos = layout.nodes[step.id] ?? { x: 0, y: 0 };
    const rulesCount = step.transitions?.rules?.length ?? 0;
    nodes.push({
      id: step.id,
      type: step.type,
      position: { x: pos.x, y: pos.y },
      data: {
        step,
        isInitial: step.id === scenario.initialStepId,
        hasError: errorByStep.has(step.id),
        rulesCount,
      },
    });
  }

  for (const step of scenario.steps) {
    const t = step.transitions;
    if (!t) continue;

    if (t.rules) {
      t.rules.forEach((rule, idx) => {
        if (rule.goto !== undefined && rule.goto !== null) {
          edges.push({
            id: `${step.id}::r${idx}::${rule.goto}`,
            source: step.id,
            target: rule.goto,
            type: "ruleEdge",
            label: compactLogicLabel(rule.when),
            data: {
              kind: "rule",
              ruleIndex: idx,
              hasError: errorByStepRule.has(`${step.id}::${idx}`),
              whenText: prettyWhen(rule.when),
              sideActionTypes: extractSideActionTypes(rule.actions),
            },
          });
        }
        // если goto: null — это side-effect-only правило, edge не рисуем.
      });
    }

    // default
    if (t.default.goto !== undefined && t.default.goto !== null) {
      edges.push({
        id: `${step.id}::default::${t.default.goto}`,
        source: step.id,
        target: t.default.goto,
        type: "defaultEdge",
        data: {
          kind: "default",
          hasError: errorByStepRule.has(`${step.id}::default`),
          sideActionTypes: extractSideActionTypes(t.default.actions),
        },
      });
    } else if (opts.generateTerminals) {
      // Нет goto в default — должна быть finish/escalate/assign-action.
      const action = (t.default.actions ?? []).find((a) =>
        ["finish", "escalate", "assign", "generateReport", "callMacro"].includes(a.type),
      );
      if (action) {
        const terminalId = `__end_${step.id}`;
        const terminalKind = action.type as FlowNodeData["terminalKind"];
        // Позиция терминала. Сначала смотрим в layout (это позиция
        // от dagre или от пользователя — поддерживается и сохраняется).
        // Если в layout нет — fallback: смещение от шага-хозяина.
        const stored = layout.nodes[terminalId];
        const sourceNode = nodes.find((n) => n.id === step.id);
        const sourcePos = sourceNode?.position ?? { x: 0, y: 0 };
        const position = stored
          ? { x: stored.x, y: stored.y }
          : { x: sourcePos.x + 60, y: sourcePos.y + 140 };
        nodes.push({
          id: terminalId,
          type: "endNode",
          position,
          data: { terminalKind, synthetic: true },
        });
        edges.push({
          id: `${step.id}::default::${terminalId}`,
          source: step.id,
          target: terminalId,
          type: "terminalEdge",
          data: {
            kind: "terminal",
            terminalKind,
            hasError: errorByStepRule.has(`${step.id}::default`),
            sideActionTypes: extractSideActionTypes(t.default.actions, [terminalKind!]),
          },
        });
      }
    }
  }

  return { nodes, edges };
}

// Pretty-print JSONLogic в одну компактную строку с переносами для tooltip.
// Не пытается сделать AST-понятный текст — это JSON.stringify с отступами,
// просто чтобы его можно было прочитать в hover-подсказке.
function prettyWhen(when: unknown): string {
  if (when === undefined || when === null) return "—";
  try {
    return JSON.stringify(when, null, 2);
  } catch {
    return String(when);
  }
}

// Возвращает список типов side-effect actions (без терминальных типов,
// которые уже отображены отдельным узлом/цветом ребра).
function extractSideActionTypes(actions?: { type: string }[], skip: string[] = []): string[] {
  if (!actions || actions.length === 0) return [];
  const skipSet = new Set<string>([
    "finish",
    "escalate",
    "assign",
    "generateReport",
    "callMacro",
    ...skip,
  ]);
  // Терминальные типы пропускаем для default-edge тоже — они уже отрисованы как
  // отдельные узлы через generateTerminals; для rule-edge показываем все side-actions.
  // Но конкретно для terminal-edge передан явный skip с terminalKind.
  return actions.map((a) => a.type).filter((t) => !skipSet.has(t));
}

// Список целевых StepId — список ВСЕХ возможных goto из переходов одного шага.
// Пригодится для UI, ещё не используется на M2.
export function listOutgoingGotos(step: Step): StepId[] {
  const out: StepId[] = [];
  const t = step.transitions;
  if (!t) return out;
  if (t.rules) for (const r of t.rules) if (r.goto) out.push(r.goto);
  if (t.default.goto) out.push(t.default.goto);
  return out;
}
