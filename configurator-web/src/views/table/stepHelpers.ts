// Хелперы для табличного редактора: человеческие подписи типов, извлечение
// текста-вопроса для оператора, суммирование «что произойдёт после шага»
// и распознавание простых правил вида option→step.
//
// Идея: 80% сценариев укладываются в простые маппинги «вариант ответа →
// следующий шаг». Сложные JSONLogic-выражения мы оставляем в инспекторе
// как «расширенный режим», но НЕ заставляем новичка работать с ними.

import type {
  Action,
  Rule,
  Step,
  StepId,
  StepType,
} from "../../types/dsl";

// === Человеческие подписи типов ===

export interface StepTypeMeta {
  type: StepType;
  // Короткая русская метка для бейджа в строке таблицы.
  label: string;
  // Развёрнутое описание для тултипа / меню «+ Добавить шаг».
  description: string;
  // Цвет MUI-палитры для левой полосы строки и бейджа.
  color:
    | "primary"
    | "secondary"
    | "success"
    | "warning"
    | "info"
    | "error"
    | "default";
  // Имя иконки (mui icon component name) — конкретный импорт делает
  // компонент строки. Тут только идентификатор, чтобы не тащить React-зависимость.
  iconName:
    | "RadioButtonChecked"
    | "CheckBox"
    | "ArrowDropDownCircle"
    | "Notes"
    | "Image"
    | "Schedule"
    | "SmartButton";
}

export const STEP_TYPE_META: Record<StepType, StepTypeMeta> = {
  RadioButton: {
    type: "RadioButton",
    label: "Один из вариантов",
    description: "Оператор выбирает ОДИН вариант из короткого списка",
    color: "primary",
    iconName: "RadioButtonChecked",
  },
  Checkbox: {
    type: "Checkbox",
    label: "Несколько вариантов",
    description: "Оператор отмечает любые из вариантов",
    color: "secondary",
    iconName: "CheckBox",
  },
  Select: {
    type: "Select",
    label: "Выбор из списка",
    description: "Один вариант из длинного списка (выпадающее меню)",
    color: "info",
    iconName: "ArrowDropDownCircle",
  },
  Comment: {
    type: "Comment",
    label: "Комментарий",
    description: "Свободный текст — оператор пишет что-то от себя",
    color: "default",
    iconName: "Notes",
  },
  Image: {
    type: "Image",
    label: "Фото / изображение",
    description: "Снимок с камеры, скриншот карты или приложенный файл",
    color: "warning",
    iconName: "Image",
  },
  Datetime: {
    type: "Datetime",
    label: "Дата / время",
    description: "Выбор даты, времени или их сочетания",
    color: "info",
    iconName: "Schedule",
  },
  Button: {
    type: "Button",
    label: "Кнопка действия",
    description: "Просто кнопка без ввода — нажатие запускает переход",
    color: "success",
    iconName: "SmartButton",
  },
};

export const STEP_TYPE_LIST: StepTypeMeta[] = [
  STEP_TYPE_META.RadioButton,
  STEP_TYPE_META.Checkbox,
  STEP_TYPE_META.Select,
  STEP_TYPE_META.Comment,
  STEP_TYPE_META.Image,
  STEP_TYPE_META.Datetime,
  STEP_TYPE_META.Button,
];

// === Текст шага «как видит оператор» ===

export function getStepLabel(step: Step): string {
  // У всех типов в DSL есть view.label; держим safe-fallback, если пользователь
  // случайно сломал view (схема это поймает, но пока он печатает — мы рендерим).
  const view = (step as { view?: { label?: string } }).view;
  return view?.label?.trim() || "";
}

export function setStepLabel(_step: Step, _newLabel: string) {
  // Оставлен как маркер контракта: для смены label используется store-action
  // setStepView, а здесь — только чтение. Реальная мутация идёт через
  // updateStepLabel ниже.
}

// === Суммирование «что после» ===

const TERMINAL_TYPES = new Set<Action["type"]>([
  "finish",
  "escalate",
  "assign",
  "generateReport",
  "callMacro",
]);

export type NextSummaryKind =
  | "goto"           // default ведёт на конкретный шаг
  | "stay"           // default.goto = null (петля на себе)
  | "finish"         // default.actions содержит finish (и нет goto)
  | "escalate"       // default.actions содержит escalate
  | "assign"
  | "generateReport"
  | "callMacro"
  | "branches"       // у шага есть rules[] → разные пути
  | "broken"         // нет ни goto, ни terminal action — невалидно
  | "none";          // transitions ещё не задан

export interface NextSummary {
  // Главный «жанр» того, что произойдёт. Используется для выбора цвета/иконки.
  kind: NextSummaryKind;
  // Человеческое описание для отображения в строке. Например:
  // «→ next_step», «🏁 Завершить», «🌿 3 ветки».
  text: string;
  // Если есть несколько rules — сколько именно.
  branchCount?: number;
  // Куда ведёт default (если goto), удобно для подсветки целевой строки.
  defaultGoto?: StepId | null;
}

export function summarizeNext(step: Step): NextSummary {
  const t = step.transitions;
  if (!t) return { kind: "none", text: "не задано" };

  const rules = t.rules ?? [];
  if (rules.length > 0) {
    return {
      kind: "branches",
      text: `${rules.length} ${pluralBranches(rules.length)}`,
      branchCount: rules.length,
      defaultGoto: t.default.goto ?? undefined,
    };
  }

  // Только default — раскрываем, что именно.
  if (t.default.goto) {
    return {
      kind: "goto",
      text: t.default.goto,
      defaultGoto: t.default.goto,
    };
  }
  if (t.default.goto === null) {
    return { kind: "stay", text: "остаться на шаге", defaultGoto: null };
  }
  // goto не задан — смотрим actions.
  const term = t.default.actions?.find((a) => TERMINAL_TYPES.has(a.type));
  if (term) {
    return { kind: term.type as NextSummaryKind, text: terminalLabel(term) };
  }
  return { kind: "broken", text: "не выбрано" };
}

function pluralBranches(n: number): string {
  // 1 ветка, 2-4 ветки, 5+ веток
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "ветка";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "ветки";
  return "веток";
}

function terminalLabel(action: Action): string {
  switch (action.type) {
    case "finish":
      return "Завершить инцидент";
    case "escalate":
      return "Эскалировать";
    case "assign":
      return "Назначить исполнителя";
    case "generateReport":
      return "Сгенерировать отчёт";
    case "callMacro": {
      const macro = (action.args as { macroId?: string } | undefined)?.macroId;
      return macro ? `Макрос «${macro}»` : "Запустить макрос";
    }
    default:
      return action.type;
  }
}

// Цвет MUI-палитры для NextSummary. Иконки рендерим через NextSummaryChip
// (MUI-иконки), а не emoji — последние плохо контрастируют на цветных Chip-ах.
export function nextColor(
  kind: NextSummaryKind,
): "primary" | "warning" | "error" | "success" | "info" | "default" {
  switch (kind) {
    case "goto":
      return "primary";
    case "finish":
      return "success";
    case "escalate":
      return "warning";
    case "assign":
      return "info";
    case "generateReport":
      return "info";
    case "callMacro":
      return "info";
    case "branches":
      return "primary";
    case "broken":
      return "error";
    case "none":
      return "error";
    case "stay":
      return "default";
    default:
      return "default";
  }
}

// === Опции и простые правила «вариант → шаг» ===

export interface OptionRoute {
  // index в step.view.options
  optionIndex: number;
  optionId: string;
  optionLabel: string;
  // Привязанное к этой опции правило (если оно простое и однозначное).
  // null — правил нет, ведёт по default.
  ruleIndex: number | null;
  // Куда ведёт правило/опция.
  goto: StepId | null | undefined;
  // Если true — правило не «простое» (несколько опций в одном правиле,
  // сложное условие) — редактирование маршрута через эту таблицу запрещено,
  // нужен расширенный режим (инспектор / JSONLogic).
  complex: boolean;
  // Если правило терминальное (finish/escalate/...) — здесь его тип.
  terminal?: Action["type"];
}

// Распознаёт простое правило вида `state.<thisStepId>.value == "<optId>"` —
// именно такие правила мы будем САМИ генерировать при выборе «куда ведёт
// вариант». Если в шаге уже есть более сложные rules — мы их сохраняем
// как есть и помечаем complex=true (пользователь не сломает их случайно).
//
// Поддерживаются формы JSONLogic:
//   { "==": [{"var": "state.X.value"}, "Y"] }
//   { "==": ["Y", {"var": "state.X.value"}] }
// Для Checkbox также распознаём `in`:
//   { "in": ["Y", {"var": "state.X.value"}] }
export function detectOptionRoute(
  rule: Rule,
  thisStepId: StepId,
  stepType: StepType,
): { optionId: string } | null {
  const w = rule.when as unknown;
  if (!w || typeof w !== "object") return null;
  const obj = w as Record<string, unknown>;

  if (stepType === "Checkbox") {
    const inArr = obj["in"];
    if (Array.isArray(inArr) && inArr.length === 2) {
      const [needle, haystack] = inArr;
      const needleStr = typeof needle === "string" ? needle : null;
      const path = readVarPath(haystack);
      if (needleStr && path === `state.${thisStepId}.value`) {
        return { optionId: needleStr };
      }
    }
    return null;
  }

  // RadioButton / Select — проверяем равенство.
  const eqArr = obj["=="] ?? obj["==="];
  if (Array.isArray(eqArr) && eqArr.length === 2) {
    const [a, b] = eqArr;
    const aPath = readVarPath(a);
    const bPath = readVarPath(b);
    const aStr = typeof a === "string" ? a : null;
    const bStr = typeof b === "string" ? b : null;
    if (aPath === `state.${thisStepId}.value` && bStr) return { optionId: bStr };
    if (bPath === `state.${thisStepId}.value` && aStr) return { optionId: aStr };
  }
  return null;
}

function readVarPath(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  const v = (node as { var?: unknown }).var;
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return null;
}

// Для одного шага собирает «маршрутизацию по опциям». Используется
// в развёрнутой строке (секция «Варианты ответа»).
export function buildOptionRoutes(step: Step): OptionRoute[] | null {
  const view = (step as { view?: { options?: { id: string; label: string }[] } }).view;
  if (!view?.options) return null;

  const rules = step.transitions?.rules ?? [];
  // Map<optionId, ruleIndex>: первое правило, которое привязано к этой опции.
  const optToRule = new Map<string, number>();
  // Множество индексов «сложных» правил, которые мы НЕ узнали как option-route.
  for (let i = 0; i < rules.length; i += 1) {
    const r = rules[i]!;
    const detected = detectOptionRoute(r, step.id, step.type);
    if (detected && !optToRule.has(detected.optionId)) {
      optToRule.set(detected.optionId, i);
    }
  }

  return view.options.map((o, idx) => {
    const ruleIdx = optToRule.get(o.id) ?? null;
    if (ruleIdx === null) {
      return {
        optionIndex: idx,
        optionId: o.id,
        optionLabel: o.label,
        ruleIndex: null,
        goto: undefined,
        complex: false,
      };
    }
    const r = rules[ruleIdx]!;
    const term = r.actions?.find((a) => TERMINAL_TYPES.has(a.type));
    return {
      optionIndex: idx,
      optionId: o.id,
      optionLabel: o.label,
      ruleIndex: ruleIdx,
      goto: r.goto,
      complex: false,
      terminal: term?.type,
    };
  });
}

// Сколько правил в шаге НЕ распознаны как простые option-routes —
// если их > 0, мы покажем подсказку «есть сложные условия, откройте
// инспектор» и не дадим случайно перезаписать их.
export function countComplexRules(step: Step): number {
  const rules = step.transitions?.rules ?? [];
  if (rules.length === 0) return 0;
  let complex = 0;
  for (const r of rules) {
    if (!detectOptionRoute(r, step.id, step.type)) complex += 1;
  }
  return complex;
}

// Построение JSONLogic-выражения для простого option-route. Используется
// при создании/обновлении правила из табличной формы.
export function buildOptionWhen(
  stepId: StepId,
  stepType: StepType,
  optionId: string,
): unknown {
  if (stepType === "Checkbox") {
    return { in: [optionId, { var: `state.${stepId}.value` }] };
  }
  return { "==": [{ var: `state.${stepId}.value` }, optionId] };
}

// Тип «терминала» для секции «Что после» (default).
export type DefaultMode =
  | { kind: "goto"; goto: StepId | null | undefined }
  | { kind: "finish"; resolution?: string }
  | { kind: "generateReport"; templateId?: string }
  | { kind: "escalate"; to?: string; reason?: string }
  | { kind: "assign"; to: string }
  | { kind: "callMacro"; macroId: string; params?: Record<string, unknown> }
  | { kind: "broken" };

export function detectDefaultMode(step: Step): DefaultMode {
  const t = step.transitions;
  if (!t) return { kind: "broken" };
  const d = t.default;

  if (d.goto !== undefined) {
    return { kind: "goto", goto: d.goto };
  }
  const term = d.actions?.find((a) => TERMINAL_TYPES.has(a.type));
  if (!term) return { kind: "broken" };

  switch (term.type) {
    case "finish":
      return {
        kind: "finish",
        resolution: (term.args as { resolution?: string } | undefined)?.resolution,
      };
    case "generateReport":
      return {
        kind: "generateReport",
        templateId: (term.args as { templateId?: string } | undefined)?.templateId,
      };
    case "escalate": {
      const args = term.args as { to?: string; reason?: string } | undefined;
      return { kind: "escalate", to: args?.to, reason: args?.reason };
    }
    case "assign": {
      const args = term.args as { to?: string } | undefined;
      return { kind: "assign", to: args?.to ?? "" };
    }
    case "callMacro": {
      const args = term.args as
        | { macroId?: string; params?: Record<string, unknown> }
        | undefined;
      return {
        kind: "callMacro",
        macroId: args?.macroId ?? "",
        params: args?.params,
      };
    }
    default:
      return { kind: "broken" };
  }
}
