import jsonLogic from "json-logic-js";
import type { RunnerState, Rule, RuleOutcome, Transitions } from "../types/dsl";

// First-match семантика по dsl-v1-draft.md §8: rules сверху вниз,
// первый truthy when выигрывает. Если ни одного — default.
//
// Контекст для JSONLogic — { state }, где state — это RunnerState
// со структурой { stepId: { value, at } }. Сценарии используют
// конструкции вроде {"var": "state.verify.value"}.

export interface EvaluatedTransition {
  outcome: RuleOutcome;
  ruleIndex: number | "default";
}

export function evaluateTransition(
  transitions: Transitions | undefined,
  state: RunnerState,
): EvaluatedTransition | null {
  if (!transitions) return null;

  const ctx = { state };

  if (transitions.rules) {
    for (let i = 0; i < transitions.rules.length; i++) {
      const rule: Rule = transitions.rules[i]!;
      let truthy = false;
      try {
        truthy = Boolean(jsonLogic.apply(rule.when as object, ctx));
      } catch (err) {
        console.error("[runner] JSONLogic eval failed at rule", i, err, rule.when);
      }
      if (truthy) {
        return { outcome: rule, ruleIndex: i };
      }
    }
  }

  return { outcome: transitions.default, ruleIndex: "default" };
}
