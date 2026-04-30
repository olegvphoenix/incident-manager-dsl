// Design-time TS-типы под dsl-v1-schema.json.
// Это контракт между редактором и DSL. Источник правды — ../../dsl-v1-schema.json,
// здесь — удобное TS-зеркало для type-safe работы со store и формами.
//
// Скопировано из runner-web/src/types/dsl.ts с изъятием runtime-структур
// (RunnerState/ScenarioResult/Attachment) — они не нужны в редакторе.
// При расширении DSL обновлять обе копии.

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
  | "Datetime";

export const STEP_TYPES: StepType[] = [
  "Button",
  "RadioButton",
  "Checkbox",
  "Select",
  "Comment",
  "Image",
  "Datetime",
];

// JSONLogic — произвольное JSON-выражение или булева константа,
// валидируется отдельным whitelist'ом (dsl-v1-draft.md §7).
export type JsonLogicExpr = unknown;

export type ActionType =
  | "callMacro"
  | "finish"
  | "generateReport"
  | "escalate"
  | "assign";

export const ACTION_TYPES: ActionType[] = [
  "callMacro",
  "finish",
  "generateReport",
  "escalate",
  "assign",
];

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
  view: { label: Label; emphasis?: "primary" | "secondary" | "destructive" };
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
    required?: boolean;
    minSelected?: number;
    maxSelected?: number;
    layout?: "vertical" | "horizontal";
  };
}

export interface SelectStep extends StepBase {
  type: "Select";
  view: {
    label: Label;
    placeholder?: string;
    options: Option[];
    required?: boolean;
  };
}

export interface CommentStep extends StepBase {
  type: "Comment";
  view: {
    label: Label;
    placeholder?: string;
    required?: boolean;
    readonly?: boolean;
    minLength?: number;
    maxLength?: number;
    minRows?: number;
    maxRows?: number;
  };
}

export interface ImageStep extends StepBase {
  type: "Image";
  view: {
    label: Label;
    source: "camera" | "map" | "operator" | "fixed";
    fixedSrc?: string;
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
    min?: string;
    max?: string;
  };
}

export type Step =
  | ButtonStep
  | RadioButtonStep
  | CheckboxStep
  | SelectStep
  | CommentStep
  | ImageStep
  | DatetimeStep;

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

export interface ScenarioScript {
  dslVersion: string;
  locale?: string;
  metadata: ScenarioMetadata;
  initialStepId: StepId;
  steps: Step[];
  timers?: { escalateAfterSec?: number; maxDurationSec?: number };
  concurrency?: { stepLockable?: boolean; allowMultitasking?: boolean };
}
