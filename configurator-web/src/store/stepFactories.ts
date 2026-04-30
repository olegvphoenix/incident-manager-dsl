// Фабрики «пустых» шагов нужного типа. Используются при addStep / setStepType.
// Возвращают валидный по схеме DSL шаг с разумными дефолтами.

import type { Option, Step, StepId, StepType } from "../types/dsl";

let optionCounter = 0;
function nextOption(prefix = "opt"): Option {
  optionCounter += 1;
  return { id: `${prefix}_${optionCounter}`, label: `Вариант ${optionCounter}` };
}

export function createStep(type: StepType, id: StepId): Step {
  switch (type) {
    case "Button":
      return {
        id,
        type: "Button",
        view: { label: "Подтвердить", emphasis: "primary" },
        transitions: { default: { actions: [{ type: "finish" }] } },
      };
    case "RadioButton":
      return {
        id,
        type: "RadioButton",
        view: {
          label: "Выберите вариант",
          options: [nextOption("opt"), nextOption("opt")],
          required: true,
          layout: "vertical",
        },
        transitions: { default: { goto: id } },
      };
    case "Checkbox":
      return {
        id,
        type: "Checkbox",
        view: {
          label: "Отметьте применимое",
          options: [nextOption("opt"), nextOption("opt")],
          required: false,
          layout: "vertical",
        },
        transitions: { default: { goto: id } },
      };
    case "Select":
      return {
        id,
        type: "Select",
        view: {
          label: "Выберите из списка",
          options: [nextOption("opt"), nextOption("opt")],
          required: true,
        },
        transitions: { default: { goto: id } },
      };
    case "Comment":
      return {
        id,
        type: "Comment",
        view: { label: "Комментарий", required: false, minRows: 2, maxRows: 6 },
        transitions: { default: { goto: id } },
      };
    case "Image":
      return {
        id,
        type: "Image",
        view: { label: "Снимок", source: "camera", required: false },
        transitions: { default: { goto: id } },
      };
    case "Datetime":
      return {
        id,
        type: "Datetime",
        view: { label: "Время события", kind: "datetime", required: true },
        transitions: { default: { goto: id } },
      };
  }
}

// Сгенерировать уникальный step.id вида <base>_2, _3 если <base> занят.
export function suggestStepId(base: string, existing: Set<StepId>): StepId {
  const safe = base
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^([0-9])/, "_$1") || "step";
  const trimmed = safe.slice(0, 60);
  if (!existing.has(trimmed)) return trimmed;
  let n = 2;
  while (existing.has(`${trimmed}_${n}`)) n++;
  return `${trimmed}_${n}`;
}
