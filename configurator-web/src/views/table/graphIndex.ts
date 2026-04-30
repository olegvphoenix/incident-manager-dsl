// Производный индекс по сценарию: на каждый шаг — кто на него ссылается
// (incoming) и куда он ведёт (outgoing). Считается один раз на сценарий
// (useMemo по scenario), переиспользуется для всех строк таблицы.

import type { Action, ScenarioScript, Step, StepId } from "../../types/dsl";

export interface OutgoingRef {
  // Для удобной отрисовки: тип источника (default / rule[i]) и куда ведёт.
  kind: "default" | "rule";
  ruleIndex?: number;
  goto: StepId | null;
  // финальные эффекты (если есть): finish / escalate / assign / generateReport / callMacro
  effects: Action["type"][];
}

export interface IncomingRef {
  fromStepId: StepId;
  kind: "default" | "rule";
  ruleIndex?: number;
}

export interface GraphIndex {
  // Map<targetStepId, IncomingRef[]>
  incoming: Map<StepId, IncomingRef[]>;
  // Map<sourceStepId, OutgoingRef[]>
  outgoing: Map<StepId, OutgoingRef[]>;
}

const TERMINAL_TYPES = new Set<Action["type"]>([
  "finish",
  "escalate",
  "assign",
  "generateReport",
  "callMacro",
]);

function effectsOf(actions: Action[] | undefined): Action["type"][] {
  if (!actions) return [];
  return actions.filter((a) => TERMINAL_TYPES.has(a.type)).map((a) => a.type);
}

export function buildGraphIndex(scenario: ScenarioScript): GraphIndex {
  const incoming = new Map<StepId, IncomingRef[]>();
  const outgoing = new Map<StepId, OutgoingRef[]>();

  for (const step of scenario.steps) {
    outgoing.set(step.id, collectOutgoing(step));
  }

  for (const step of scenario.steps) {
    const outs = outgoing.get(step.id)!;
    for (const o of outs) {
      if (!o.goto) continue;
      const list = incoming.get(o.goto) ?? [];
      list.push({ fromStepId: step.id, kind: o.kind, ruleIndex: o.ruleIndex });
      incoming.set(o.goto, list);
    }
  }

  return { incoming, outgoing };
}

function collectOutgoing(step: Step): OutgoingRef[] {
  const out: OutgoingRef[] = [];
  const t = step.transitions;
  if (!t) return out;

  if (t.rules) {
    t.rules.forEach((rule, idx) => {
      out.push({
        kind: "rule",
        ruleIndex: idx,
        goto: rule.goto ?? null,
        effects: effectsOf(rule.actions),
      });
    });
  }

  out.push({
    kind: "default",
    goto: t.default.goto ?? null,
    effects: effectsOf(t.default.actions),
  });

  return out;
}
