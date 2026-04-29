// Минимальный набор TS-типов под dsl-v1-schema.json.
// Сюда смотрят и engine, и все step-компоненты — это контракт.
// При расширении схемы — обновлять здесь, иначе TS отлается ошибками.

export type StepId = string;
export type OptionId = string;
export type Label = string;

export interface Option {
  id: OptionId;
  label: Label;
  hint?: string;
}

export type StepType =
  | "Button"
  | "RadioButton"
  | "Checkbox"
  | "Select"
  | "Comment"
  | "Image"
  | "Datetime"
  | "CallScenario";

// JSONLogic — произвольный JSON, валидируется отдельным whitelist'ом
// при сохранении сценария на сервере. В runner'е просто eval'им.
export type JsonLogicExpr = unknown;

export type ActionType =
  | "callMacro"
  | "finish"
  | "generateReport"
  | "escalate"
  | "assign";

export interface Action {
  type: ActionType;
  args?: Record<string, unknown>;
}

export interface RuleOutcome {
  goto?: StepId | null;
  actions?: Action[];
}

export interface Rule extends RuleOutcome {
  when: JsonLogicExpr;
}

export interface Transitions {
  rules?: Rule[];
  default: RuleOutcome;
}

interface StepBase {
  id: StepId;
  title?: Label;
  editable?: boolean;
  transitions?: Transitions;
}

export interface ButtonStep extends StepBase {
  type: "Button";
  view: { label: Label; emphasis?: "primary" | "secondary" | "danger" };
}

export interface RadioButtonStep extends StepBase {
  type: "RadioButton";
  view: {
    label: Label;
    options: Option[];
    required?: boolean;
    layout?: "vertical" | "horizontal";
  };
}

export interface CheckboxStep extends StepBase {
  type: "Checkbox";
  view: {
    label: Label;
    options: Option[];
    minSelected?: number;
    maxSelected?: number;
  };
}

export interface SelectStep extends StepBase {
  type: "Select";
  view: { label: Label; options: Option[]; required?: boolean };
}

export interface CommentStep extends StepBase {
  type: "Comment";
  view: {
    label: Label;
    required?: boolean;
    readonly?: boolean;
    minLength?: number;
    maxRows?: number;
    placeholder?: string;
  };
}

export interface ImageStep extends StepBase {
  type: "Image";
  view: {
    label?: Label;
    source: "camera" | "map" | "operator" | "fixed";
    fixedSrc?: string;
    cameraId?: string;
    allowMultiple?: boolean;
    required?: boolean;
  };
}

export interface DatetimeStep extends StepBase {
  type: "Datetime";
  view: {
    label: Label;
    kind: "time" | "date" | "datetime";
    required?: boolean;
  };
}

export interface CallScenarioStep extends StepBase {
  type: "CallScenario";
  view: { scenarioGuid: string; version: number; stepIdPrefix?: string };
}

export type Step =
  | ButtonStep
  | RadioButtonStep
  | CheckboxStep
  | SelectStep
  | CommentStep
  | ImageStep
  | DatetimeStep
  | CallScenarioStep;

// Identity-блок сценария. scenarioGuid + version + name обязательны
// (см. dsl-v1-schema.json /metadata/required); прочие поля свободные.
export interface ScenarioMetadata {
  scenarioGuid: string;
  version: number;
  name: string;
  description?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  author?: string;
  [k: string]: unknown;
}

export interface Scenario {
  dslVersion: string;
  metadata: ScenarioMetadata;
  initialStepId: StepId;
  steps: Step[];
  timers?: { escalateAfterSec?: number; maxDurationSec?: number };
  concurrency?: { stepLockable?: boolean; allowMultitasking?: boolean };
}

// Runtime-структуры (живут в state'е runner'а).
// Поля и формат соответствуют dsl-v1-draft.md §9.
//
// stepId → значение, ответ оператора. Формат значения зависит от типа шага.
export type StepValue =
  | string                  // RadioButton, Select, Comment, Datetime, Image
  | string[]                // Checkbox, Image (multiple)
  | null                    // Button (по спеке §9: «у кнопки нет значения»)
  | true                    // legacy: при submit Button мы кладём true; при сериализации мапим в null
  | { skipped: true };      // зарезервировано

// StepEntry. См. dsl-v1-draft.md §9 «Структура state[stepId]» + «Семантика skip».
// Различие трёх случаев:
//   1) шаг ещё не достигнут           → ключ stepId отсутствует в state
//   2) оператор ответил                → { value, answeredAt, by }
//   3) оператор пропустил (skip)       → { value: null, answeredAt, by, skipped: true }
// Поле skipped допустимо ТОЛЬКО для шагов с view.required: false; для остальных
// runner обязан отвергать submit с skipped=true.
export interface StepEntry {
  value: StepValue;
  answeredAt: string;
  by?: string | null;
  skipped?: boolean;
}

export type RunnerState = Record<StepId, StepEntry>;

// События в history соответствуют спецификации §9: action + специфичные поля.
export type HistoryEvent =
  | { ts: string; stepId: StepId; action: "answer"; value: StepValue; by?: string | null }
  | { ts: string; stepId: StepId; action: "skip"; by?: string | null }
  | { ts: string; stepId: StepId; action: "transition"; to: StepId; matchedRule: number | null }
  | { ts: string; stepId: StepId; action: "callMacro"; macroId?: string; params?: unknown }
  | { ts: string; stepId: StepId; action: "generateReport"; templateId?: string }
  | { ts: string; stepId: StepId; action: "escalate"; to?: string; reason?: string }
  | { ts: string; stepId: StepId; action: "assign"; to: string }
  | { ts: string; stepId: StepId; action: "finish"; resolution?: string };

// Side-таблица бинарных вложений для шагов типа Image (см. dsl-v1-draft.md §9).
// state[stepId].value хранит только массив id'ов; сами байты — здесь.
// В демо-runner'е используется dataBase64; в реальной системе сервер заменит
// на storage = { kind: "s3" | "url", ... }.
export interface Attachment {
  id: string;
  stepId: StepId;
  source: "camera" | "map" | "operator" | "fixed";
  mime: string;
  fileName?: string;
  size: number;
  sha256?: string;
  capturedAt: string;
  dataBase64?: string;
  storage?:
    | { kind: "s3"; bucket: string; key: string }
    | { kind: "url"; url: string };
}

// Результат прохождения сценария — строго по dsl-v1-draft.md §9.
export interface ScenarioResult {
  dslVersion: string;
  state: RunnerState;
  history: HistoryEvent[];
  attachments?: Attachment[];
  currentStepId: StepId | null;
  completedAt: string | null;
}

// Внешний конверт демо-runner'а (аналог incidents-записи в реальной системе).
// Делает результат самодостаточным: позволяет позже понять, по какому DSL и какому
// шаблону он получен, без обращения к серверу.
export interface ResultEnvelope {
  envelopeKind: "incident-runner-demo";
  envelopeVersion: 1;
  exportedAt: string;
  scenarioRef: {
    fileName?: string;
    name?: string;
    scenarioGuid?: string;
    version?: number;
    dslVersion?: string;
  };
  scenarioSnapshot?: Scenario;
  scenarioResult: ScenarioResult;
}
