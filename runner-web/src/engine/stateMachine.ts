import type {
  Action,
  Attachment,
  HistoryEvent,
  RunnerState,
  Scenario,
  Step,
  StepId,
  StepValue,
} from "../types/dsl";
import { evaluateTransition } from "./transitionEvaluator";

// RunnerSnapshot — внутреннее представление прогресса.
// При сериализации в ScenarioResult имена полей приводятся к спеке (см. types/dsl.ts).

export interface RunnerSnapshot {
  scenario: Scenario;
  currentStepId: StepId | null;   // null = сценарий завершён
  state: RunnerState;
  history: HistoryEvent[];
  attachments: Attachment[];      // side-таблица для Image-шагов; см. dsl §9
  startedAt: string;
  completedAt: string | null;
}

export function startScenario(scenario: Scenario): RunnerSnapshot {
  return {
    scenario,
    currentStepId: scenario.initialStepId,
    state: {},
    history: [],
    attachments: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
}

export function findStep(scenario: Scenario, stepId: StepId): Step | undefined {
  return scenario.steps.find((s) => s.id === stepId);
}

// Преобразует "сырое" submit-значение из UI в каноническое для StepEntry.
// Button присылает true → канонически value=null (см. dsl-v1-draft.md §9 таблица value).
function canonicalize(step: Step | undefined, raw: StepValue): StepValue {
  if (step?.type === "Button") return null;
  return raw;
}

function actionEvent(
  action: Action,
  stepId: StepId,
  ts: string,
): HistoryEvent | null {
  switch (action.type) {
    case "callMacro":      return { ts, stepId, action: "callMacro", macroId: action.args?.["macroId"] as string | undefined, params: action.args?.["params"] };
    case "generateReport": return { ts, stepId, action: "generateReport", templateId: action.args?.["templateId"] as string | undefined };
    case "escalate":       return { ts, stepId, action: "escalate", to: action.args?.["to"] as string | undefined, reason: action.args?.["reason"] as string | undefined };
    case "assign":         return { ts, stepId, action: "assign", to: String(action.args?.["to"] ?? "") };
    case "finish":         return { ts, stepId, action: "finish", resolution: action.args?.["resolution"] as string | undefined };
  }
}

export function submitStep(
  snap: RunnerSnapshot,
  stepId: StepId,
  rawValue: StepValue,
  newAttachments?: Attachment[],
): RunnerSnapshot {
  if (snap.currentStepId !== stepId) {
    console.warn("[runner] submit for non-current step", stepId, "current:", snap.currentStepId);
    return snap;
  }
  const step = findStep(snap.scenario, stepId);
  if (!step) return snap;

  const ts = new Date().toISOString();
  const value = canonicalize(step, rawValue);

  const nextState: RunnerState = {
    ...snap.state,
    [stepId]: { value, answeredAt: ts, by: null },
  };

  // Image-шаги передают свои attachments. При повторном submit'е того же шага
  // (оператор передумал) старые вложения стираем — id'ы из предыдущего
  // state.value больше не валидны.
  let nextAttachments = snap.attachments;
  if (step.type === "Image") {
    nextAttachments = snap.attachments.filter((a) => a.stepId !== stepId);
    if (newAttachments && newAttachments.length > 0) {
      nextAttachments = [...nextAttachments, ...newAttachments];
    }
  }

  const history: HistoryEvent[] = [
    ...snap.history,
    { ts, stepId, action: "answer", value, by: null },
  ];

  const evaluated = evaluateTransition(step.transitions, nextState);

  let finished = false;
  let nextStepId: StepId | null = stepId;

  if (evaluated) {
    if (Array.isArray(evaluated.outcome.actions)) {
      for (const action of evaluated.outcome.actions) {
        const ev = actionEvent(action, stepId, ts);
        if (ev) history.push(ev);
        if (action.type === "finish") finished = true;
      }
    }
    if (finished) {
      nextStepId = null;
    } else {
      // Семантика по dsl-v1-draft.md §7 «Завершение сценария»:
      // - в Rule  goto может отсутствовать только если есть actions (side effects, остаться на шаге);
      // - в default goto обязан быть, либо в actions должен быть {type:"finish"} (ловится схемой DefaultOutcome).
      //   Если по какой-то причине пришёл невалидный default без goto и без finish —
      //   остаёмся на текущем шаге и пишем warning, чтобы не «зависнуть в null».
      const hasGotoKey = Object.prototype.hasOwnProperty.call(evaluated.outcome, "goto");
      const goto = evaluated.outcome.goto ?? null;
      if (!hasGotoKey && evaluated.ruleIndex === "default") {
        console.warn(
          "[runner] default outcome without `goto` and without `finish` action — staying on step",
          stepId,
          "(this scenario violates DSL schema; configurator must reject it)",
        );
        nextStepId = stepId;
      } else if (goto && goto !== stepId) {
        history.push({
          ts,
          stepId,
          action: "transition",
          to: goto,
          matchedRule: evaluated.ruleIndex === "default" ? null : evaluated.ruleIndex,
        });
        nextStepId = goto;
      } else {
        // goto: null или goto === stepId — остаться на месте
        nextStepId = stepId;
      }
    }
  } else {
    finished = true;
    nextStepId = null;
  }

  return {
    ...snap,
    currentStepId: nextStepId,
    state: nextState,
    history,
    attachments: nextAttachments,
    completedAt: finished ? ts : snap.completedAt,
  };
}
