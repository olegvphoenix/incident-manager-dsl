// Семантические правки сценария. Каждая функция принимает (scenario, layout)
// и возвращает новые (scenario, layout) через immer-produce. Чистые функции —
// store их вызывает в set(), а zundo трекает изменения.
//
// Здесь же — нормализация id'шников при rename, чтобы не было «висячих goto»:
// меняем step.id ВЕЗДЕ (initialStepId, transitions.*.goto, layout.nodes-ключи).

import { produce } from "immer";

import type {
  Action,
  Rule,
  RuleOutcome,
  ScenarioMetadata,
  ScenarioScript,
  Step,
  StepId,
  StepType,
} from "../types/dsl";
import type { ScenarioLayout } from "../types/layout";
import { createStep, suggestStepId } from "./stepFactories";

export interface ScenarioBundle {
  scenario: ScenarioScript;
  layout: ScenarioLayout;
}

type Mutator = (b: ScenarioBundle) => ScenarioBundle;

const tx = (fn: (draft: ScenarioBundle) => void): Mutator =>
  (b) => produce(b, fn);

// ===== identity =====

export const renameStep = (oldId: StepId, newId: StepId): Mutator =>
  tx((d) => {
    if (oldId === newId) return;
    if (d.scenario.steps.some((s) => s.id === newId)) return;
    for (const step of d.scenario.steps) {
      if (step.id === oldId) step.id = newId;
      const t = step.transitions;
      if (!t) continue;
      if (t.rules) {
        for (const r of t.rules) {
          if (r.goto === oldId) r.goto = newId;
        }
      }
      if (t.default.goto === oldId) t.default.goto = newId;
    }
    if (d.scenario.initialStepId === oldId) d.scenario.initialStepId = newId;
    if (d.layout.nodes[oldId]) {
      d.layout.nodes[newId] = d.layout.nodes[oldId];
      delete d.layout.nodes[oldId];
    }
  });

export const setStepTitle = (stepId: StepId, title: string | undefined): Mutator =>
  tx((d) => {
    const step = d.scenario.steps.find((s) => s.id === stepId);
    if (!step) return;
    if (title === undefined || title === "") delete step.title;
    else step.title = title;
  });

export const setStepEditable = (stepId: StepId, editable: boolean): Mutator =>
  tx((d) => {
    const step = d.scenario.steps.find((s) => s.id === stepId);
    if (!step) return;
    if (editable) delete step.editable;
    else step.editable = false;
  });

export const setStepView = (stepId: StepId, view: unknown): Mutator =>
  tx((d) => {
    const step = d.scenario.steps.find((s) => s.id === stepId) as Step | undefined;
    if (!step) return;
    (step as { view: unknown }).view = view;
  });

// Точечная правка одного поля view (label/required/placeholder/...). Используется
// табличным редактором, чтобы менять «текст вопроса» одним полем, не трогая
// остальное (опции, layout). Если view ещё не было — создаём пустой объект.
export const patchStepView = (stepId: StepId, patch: Record<string, unknown>): Mutator =>
  tx((d) => {
    const step = d.scenario.steps.find((s) => s.id === stepId) as
      | (Step & { view?: Record<string, unknown> })
      | undefined;
    if (!step) return;
    const cur = (step.view ?? {}) as Record<string, unknown>;
    const next: Record<string, unknown> = { ...cur };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) {
        delete next[k];
      } else {
        next[k] = v;
      }
    }
    step.view = next as never;
  });

// Правка одной опции в view.options. Применимо только к шагам,
// у которых view.options есть (Radio/Checkbox/Select). Если индекс
// вне диапазона — игнорируется.
export const patchStepOption = (
  stepId: StepId,
  optionIndex: number,
  patch: { id?: string; label?: string; hint?: string | null },
): Mutator =>
  tx((d) => {
    const step = d.scenario.steps.find((s) => s.id === stepId) as
      | (Step & { view?: { options?: { id: string; label: string; hint?: string }[] } })
      | undefined;
    const opts = step?.view?.options;
    if (!opts || optionIndex < 0 || optionIndex >= opts.length) return;
    const o = opts[optionIndex]!;
    if (patch.id !== undefined) {
      // не даём дубль или невалидный id
      const taken = new Set(opts.map((x, i) => (i === optionIndex ? "" : x.id)));
      if (!taken.has(patch.id) && /^[a-z0-9][a-z0-9_]{0,63}$/.test(patch.id)) {
        const oldId = o.id;
        o.id = patch.id;
        // правим existing rules, которые ссылались на старый optionId
        for (const s of d.scenario.steps) {
          const rules = s.transitions?.rules;
          if (!rules) continue;
          for (const r of rules) {
            renameOptionInWhen(r as { when: unknown }, stepId, oldId, patch.id);
          }
        }
      }
    }
    if (patch.label !== undefined) o.label = patch.label;
    if (patch.hint !== undefined) {
      if (patch.hint === null || patch.hint === "") delete o.hint;
      else o.hint = patch.hint;
    }
  });

function renameOptionInWhen(
  rule: { when: unknown },
  ownerStepId: StepId,
  oldId: string,
  newId: string,
) {
  const path = `state.${ownerStepId}.value`;
  const fix = (node: unknown): unknown => {
    if (!node || typeof node !== "object") return node;
    const obj = node as Record<string, unknown>;
    if (Array.isArray(obj["=="])) {
      const arr = obj["=="];
      const left = arr[0];
      const right = arr[1];
      const isVarPath = (n: unknown) => {
        if (!n || typeof n !== "object") return false;
        const v = (n as { var?: unknown }).var;
        return v === path || (Array.isArray(v) && v[0] === path);
      };
      if (isVarPath(left) && right === oldId) arr[1] = newId;
      else if (isVarPath(right) && left === oldId) arr[0] = newId;
    }
    if (Array.isArray(obj["in"])) {
      const arr = obj["in"];
      const left = arr[0];
      const right = arr[1];
      const isVarPath = (n: unknown) => {
        if (!n || typeof n !== "object") return false;
        const v = (n as { var?: unknown }).var;
        return v === path || (Array.isArray(v) && v[0] === path);
      };
      if (isVarPath(right) && left === oldId) arr[0] = newId;
    }
    for (const k of Object.keys(obj)) fix(obj[k]);
    return node;
  };
  fix(rule.when);
}

// Добавить опцию к шагу с view.options (Radio/Checkbox/Select).
// Возвращает id новой опции (через side-effect нельзя — но это нужно
// редко; реальный addOption делается без чтения). Идентификатор и подпись
// вычисляются автоматически, чтобы пользователь не возился.
export const addStepOption = (
  stepId: StepId,
  preset?: { id?: string; label?: string },
): Mutator =>
  tx((d) => {
    const step = d.scenario.steps.find((s) => s.id === stepId) as
      | (Step & { view?: { options?: { id: string; label: string }[] } })
      | undefined;
    if (!step?.view?.options) return;
    const taken = new Set(step.view.options.map((o) => o.id));
    let n = step.view.options.length + 1;
    let id = preset?.id ?? `opt_${n}`;
    while (taken.has(id)) {
      n += 1;
      id = `opt_${n}`;
    }
    step.view.options.push({
      id,
      label: preset?.label ?? `Вариант ${step.view.options.length + 1}`,
    });
  });

// Удалить опцию вместе с привязанным к ней простым правилом (если есть).
export const removeStepOption = (stepId: StepId, optionIndex: number): Mutator =>
  tx((d) => {
    const step = d.scenario.steps.find((s) => s.id === stepId) as
      | (Step & { view?: { options?: { id: string; label: string }[] } })
      | undefined;
    const opts = step?.view?.options;
    if (!opts || optionIndex < 0 || optionIndex >= opts.length) return;
    const removed = opts[optionIndex]!;
    opts.splice(optionIndex, 1);
    // удалим простые правила, ссылавшиеся на эту опцию
    const rules = step.transitions?.rules;
    if (rules && rules.length > 0) {
      for (let i = rules.length - 1; i >= 0; i -= 1) {
        const r = rules[i]!;
        const matched = matchesOption(r.when, stepId, removed.id);
        if (matched) rules.splice(i, 1);
      }
      if (rules.length === 0) delete step.transitions!.rules;
    }
  });

function matchesOption(when: unknown, stepId: StepId, optionId: string): boolean {
  if (!when || typeof when !== "object") return false;
  const obj = when as Record<string, unknown>;
  const path = `state.${stepId}.value`;
  const isVarPath = (n: unknown) => {
    if (!n || typeof n !== "object") return false;
    const v = (n as { var?: unknown }).var;
    return v === path || (Array.isArray(v) && v[0] === path);
  };
  const eq = obj["=="];
  if (Array.isArray(eq) && eq.length === 2) {
    if (isVarPath(eq[0]) && eq[1] === optionId) return true;
    if (isVarPath(eq[1]) && eq[0] === optionId) return true;
  }
  const inn = obj["in"];
  if (Array.isArray(inn) && inn.length === 2) {
    if (isVarPath(inn[1]) && inn[0] === optionId) return true;
  }
  return false;
}

export const setStepType = (stepId: StepId, newType: StepType): Mutator =>
  tx((d) => {
    const step = d.scenario.steps.find((s) => s.id === stepId);
    if (!step) return;
    if (step.type === newType) return;
    const oldTransitions = step.transitions;
    const oldTitle = step.title;
    const oldEditable = step.editable;
    const replacement = createStep(newType, stepId);
    if (oldTitle !== undefined) replacement.title = oldTitle;
    if (oldEditable !== undefined) replacement.editable = oldEditable;
    if (oldTransitions) replacement.transitions = oldTransitions;
    const idx = d.scenario.steps.findIndex((s) => s.id === stepId);
    d.scenario.steps[idx] = replacement;
  });

// ===== add / remove / duplicate =====

export const addStep = (
  type: StepType,
  opts?: { afterStepId?: StepId; idHint?: string; position?: { x: number; y: number } },
): Mutator =>
  tx((d) => {
    const existingIds = new Set(d.scenario.steps.map((s) => s.id));
    const id = suggestStepId(opts?.idHint ?? type.toLowerCase(), existingIds);
    const step = createStep(type, id);
    if (opts?.afterStepId) {
      const idx = d.scenario.steps.findIndex((s) => s.id === opts.afterStepId);
      d.scenario.steps.splice(idx + 1, 0, step);
    } else {
      d.scenario.steps.push(step);
    }
    d.layout.nodes[id] = {
      x: opts?.position?.x ?? 0,
      y: opts?.position?.y ?? 0,
    };
    // Если у нового шага default — терминальный action (как у factory-step
    // через createStep), сразу кладём позицию синтетического __end_ узла
    // под него. Иначе toFlow поставит fallback-смещение, и первая отрисовка
    // даст FINISH в (60,140) от шага — это часто перекрывает соседа.
    const newT = step.transitions;
    const isTerminal =
      newT &&
      (newT.default?.goto === undefined || newT.default?.goto === null) &&
      !!newT.default?.actions?.some((a) =>
        ["finish", "escalate", "assign", "generateReport", "callMacro"].includes(a.type),
      );
    if (isTerminal) {
      d.layout.nodes["__end_" + id] = {
        x: (opts?.position?.x ?? 0) + 50,
        y: (opts?.position?.y ?? 0) + 140,
      };
    }
    if (d.scenario.steps.length === 1) {
      d.scenario.initialStepId = id;
    }
  });

export const removeStep = (stepId: StepId): Mutator =>
  tx((d) => {
    const idx = d.scenario.steps.findIndex((s) => s.id === stepId);
    if (idx === -1) return;
    d.scenario.steps.splice(idx, 1);
    delete d.layout.nodes[stepId];
    delete d.layout.nodes["__end_" + stepId];
    // Чистим висячие goto в оставшихся шагах
    for (const step of d.scenario.steps) {
      const t = step.transitions;
      if (!t) continue;
      if (t.rules) {
        for (const r of t.rules) if (r.goto === stepId) r.goto = null;
      }
      if (t.default.goto === stepId) {
        // если только goto было — превращаем в finish, чтобы DSL остался валидным
        if (!t.default.actions || t.default.actions.length === 0) {
          delete t.default.goto;
          t.default.actions = [{ type: "finish" }];
        } else {
          delete t.default.goto;
        }
      }
    }
    // initialStepId
    if (d.scenario.initialStepId === stepId) {
      d.scenario.initialStepId = d.scenario.steps[0]?.id ?? "";
    }
  });

export const duplicateStep = (stepId: StepId): Mutator =>
  tx((d) => {
    const orig = d.scenario.steps.find((s) => s.id === stepId);
    if (!orig) return;
    const existingIds = new Set(d.scenario.steps.map((s) => s.id));
    const newId = suggestStepId(stepId, existingIds);
    const cloned = JSON.parse(JSON.stringify(orig)) as Step;
    cloned.id = newId;
    const idx = d.scenario.steps.findIndex((s) => s.id === stepId);
    d.scenario.steps.splice(idx + 1, 0, cloned);
    const origPos = d.layout.nodes[stepId];
    d.layout.nodes[newId] = origPos
      ? { ...origPos, x: origPos.x + 24, y: origPos.y + 24 }
      : { x: 0, y: 0 };
  });

export const setInitialStep = (stepId: StepId): Mutator =>
  tx((d) => {
    if (d.scenario.steps.some((s) => s.id === stepId)) {
      d.scenario.initialStepId = stepId;
    }
  });

// Перемещает шаг внутри scenario.steps[]. Используется TableView для drag-reorder.
// Семантика runtime от порядка шагов не зависит (graph по id), но для оператора
// порядок в TableView и сериализации важен.
export const reorderSteps = (fromIndex: number, toIndex: number): Mutator =>
  tx((d) => {
    const steps = d.scenario.steps;
    if (
      fromIndex < 0 ||
      fromIndex >= steps.length ||
      toIndex < 0 ||
      toIndex >= steps.length ||
      fromIndex === toIndex
    ) {
      return;
    }
    const [moved] = steps.splice(fromIndex, 1);
    if (!moved) return;
    steps.splice(toIndex, 0, moved);
  });

// ===== metadata / scenario-level =====

export const patchScenarioMetadata = (patch: Partial<ScenarioMetadata>): Mutator =>
  tx((d) => {
    Object.assign(d.scenario.metadata, patch);
  });

export const bumpScenarioVersion = (): Mutator =>
  tx((d) => {
    d.scenario.metadata.version += 1;
    d.layout.scenarioRef.version = d.scenario.metadata.version;
  });

export const setTimers = (
  timers: ScenarioScript["timers"] | null,
): Mutator =>
  tx((d) => {
    if (!timers || (!timers.escalateAfterSec && !timers.maxDurationSec)) {
      delete d.scenario.timers;
    } else {
      d.scenario.timers = timers;
    }
  });

export const setConcurrency = (
  concurrency: ScenarioScript["concurrency"] | null,
): Mutator =>
  tx((d) => {
    if (
      !concurrency ||
      (concurrency.stepLockable === undefined && concurrency.allowMultitasking === undefined)
    ) {
      delete d.scenario.concurrency;
    } else {
      d.scenario.concurrency = concurrency;
    }
  });

// ===== transitions =====

function ensureTransitions(step: Step) {
  if (!step.transitions) {
    step.transitions = { default: { actions: [{ type: "finish" }] } };
  }
  return step.transitions;
}

export const setDefaultGoto = (stepId: StepId, goto: StepId | null | undefined): Mutator =>
  tx((d) => {
    const step = d.scenario.steps.find((s) => s.id === stepId);
    if (!step) return;
    const t = ensureTransitions(step);
    if (goto === undefined) {
      delete t.default.goto;
    } else {
      t.default.goto = goto;
      // Если goto установлен — терминал больше не отрисовывается, его
      // координаты в layout становятся мусором, чистим.
      delete d.layout.nodes["__end_" + stepId];
    }
  });

// Конвертирует "терминальный" default (когда default.actions содержит
// finish/escalate/assign/generateReport и нет goto) в обычный goto-переход.
// Используется при reconnect-drag: пользователь схватил FINISH-стрелку
// и бросил на другой шаг — мы убираем терминальные actions и ставим goto.
const TERMINAL_ACTION_TYPES = new Set([
  "finish",
  "escalate",
  "assign",
  "generateReport",
  "callMacro",
]);
export const convertTerminalToGoto = (stepId: StepId, goto: StepId): Mutator =>
  tx((d) => {
    const step = d.scenario.steps.find((s) => s.id === stepId);
    if (!step) return;
    const t = ensureTransitions(step);
    t.default.goto = goto;
    if (t.default.actions) {
      t.default.actions = t.default.actions.filter(
        (a) => !TERMINAL_ACTION_TYPES.has(a.type),
      );
      if (t.default.actions.length === 0) delete t.default.actions;
    }
    delete d.layout.nodes["__end_" + stepId];
  });

export const setDefaultActions = (stepId: StepId, actions: Action[]): Mutator =>
  tx((d) => {
    const step = d.scenario.steps.find((s) => s.id === stepId);
    if (!step) return;
    const t = ensureTransitions(step);
    if (actions.length === 0) delete t.default.actions;
    else t.default.actions = actions;
  });

// Сделать шаг терминальным: default.actions = [{type, args?}], default.goto удаляется.
// Используется и из палитры (drop terminal-карточки на узел), и из контекстного меню,
// и из кнопки на узле. Это самая частая операция в редакторе после addStep.
export const setTerminalDefault = (
  stepId: StepId,
  type: "finish" | "escalate" | "assign" | "generateReport" | "callMacro",
  args?: Record<string, unknown>,
): Mutator =>
  tx((d) => {
    const step = d.scenario.steps.find((s) => s.id === stepId);
    if (!step) return;
    const t = ensureTransitions(step);
    delete t.default.goto;
    const action: Action = args
      ? ({ type, args } as Action)
      : ({ type } as Action);
    t.default.actions = [action];
    // Заводим стартовую позицию синтетического терминального узла прямо
    // под шагом-хозяином, чтобы он не появлялся в (0,0) и не наезжал
    // на чужие узлы. Если позиция уже была сохранена пользователем —
    // не трогаем её.
    const tid = "__end_" + stepId;
    if (!d.layout.nodes[tid]) {
      const owner = d.layout.nodes[stepId];
      const ownerPos = owner ?? { x: 0, y: 0 };
      d.layout.nodes[tid] = { x: ownerPos.x + 50, y: ownerPos.y + 140 };
    }
  });

// Снять терминал: убрать терминальные actions из default. Если goto не задан —
// добавить заглушечный finish, чтобы DSL остался валидным (default должен иметь
// хотя бы одно из goto/actions/finish-action). Используется в контекстном меню
// «Сбросить терминал». После этого пользователь обычно перетаскивает edge на шаг.
export const clearTerminalDefault = (stepId: StepId): Mutator =>
  tx((d) => {
    const step = d.scenario.steps.find((s) => s.id === stepId);
    if (!step) return;
    const t = ensureTransitions(step);
    if (t.default.actions) {
      t.default.actions = t.default.actions.filter(
        (a) => !TERMINAL_ACTION_TYPES.has(a.type),
      );
      if (t.default.actions.length === 0) delete t.default.actions;
    }
    // Если в default не осталось ни goto, ни actions — DSL сломается.
    // Возвращаем безопасный finish, чтобы валидация прошла.
    if (
      (t.default.goto === undefined || t.default.goto === null) &&
      (!t.default.actions || t.default.actions.length === 0)
    ) {
      t.default.actions = [{ type: "finish" } as Action];
    }
  });

export const addRule = (stepId: StepId, rule?: Partial<Rule>): Mutator =>
  tx((d) => {
    const step = d.scenario.steps.find((s) => s.id === stepId);
    if (!step) return;
    const t = ensureTransitions(step);
    if (!t.rules) t.rules = [];
    const fresh: Rule = {
      when: rule?.when ?? true,
      goto: rule?.goto ?? null,
      ...(rule?.actions ? { actions: rule.actions } : {}),
    };
    if (fresh.goto === null) delete (fresh as RuleOutcome).goto;
    t.rules.push(fresh);
  });

export const removeRule = (stepId: StepId, ruleIndex: number): Mutator =>
  tx((d) => {
    const step = d.scenario.steps.find((s) => s.id === stepId);
    if (!step?.transitions?.rules) return;
    step.transitions.rules.splice(ruleIndex, 1);
    if (step.transitions.rules.length === 0) delete step.transitions.rules;
  });

export const reorderRule = (
  stepId: StepId,
  fromIndex: number,
  toIndex: number,
): Mutator =>
  tx((d) => {
    const step = d.scenario.steps.find((s) => s.id === stepId);
    if (!step?.transitions?.rules) return;
    const arr = step.transitions.rules;
    if (toIndex < 0 || toIndex >= arr.length || fromIndex < 0 || fromIndex >= arr.length) return;
    const [moved] = arr.splice(fromIndex, 1);
    if (moved) arr.splice(toIndex, 0, moved);
  });

export const setRuleWhen = (stepId: StepId, ruleIndex: number, when: unknown): Mutator =>
  tx((d) => {
    const step = d.scenario.steps.find((s) => s.id === stepId);
    const rule = step?.transitions?.rules?.[ruleIndex];
    if (!rule) return;
    rule.when = when;
  });

export const setRuleGoto = (
  stepId: StepId,
  ruleIndex: number,
  goto: StepId | null | undefined,
): Mutator =>
  tx((d) => {
    const step = d.scenario.steps.find((s) => s.id === stepId);
    const rule = step?.transitions?.rules?.[ruleIndex];
    if (!rule) return;
    if (goto === undefined) delete rule.goto;
    else rule.goto = goto;
  });

export const setRuleActions = (
  stepId: StepId,
  ruleIndex: number,
  actions: Action[],
): Mutator =>
  tx((d) => {
    const step = d.scenario.steps.find((s) => s.id === stepId);
    const rule = step?.transitions?.rules?.[ruleIndex];
    if (!rule) return;
    if (actions.length === 0) delete rule.actions;
    else rule.actions = actions;
  });

// Выставить маршрут для конкретной опции: «при выборе этой опции сценарий
// идёт туда-то / делает то-то». Под капотом это правило (rule) с
// JSONLogic-условием, которое мы строим сами по optionId.
//
// outcome.kind:
//   "goto"     — обычный переход
//   "terminal" — finish/escalate/assign/generateReport/callMacro (с args)
//   "default"  — снять привязку, опция пойдёт по default
//
// Если у этой опции уже есть простое правило (распознаваемое
// detectOptionRoute) — заменяем его. Иначе — добавляем новое в конец rules.
// Сложные ручные правила пользователя НЕ трогаем.
export const setOptionRoute = (
  stepId: StepId,
  optionId: string,
  outcome:
    | { kind: "goto"; goto: StepId | null }
    | { kind: "terminal"; type: Action["type"]; args?: Record<string, unknown> }
    | { kind: "default" },
): Mutator =>
  tx((d) => {
    const step = d.scenario.steps.find((s) => s.id === stepId) as
      | (Step & { view?: { options?: { id: string }[] } })
      | undefined;
    if (!step?.view?.options) return;
    const opt = step.view.options.find((o) => o.id === optionId);
    if (!opt) return;

    if (!step.transitions) {
      step.transitions = { default: { actions: [{ type: "finish" }] } };
    }
    const t = step.transitions!;
    if (!t.rules) t.rules = [];

    // ищем существующее простое правило для этой опции
    const path = `state.${stepId}.value`;
    const isVarPath = (n: unknown) => {
      if (!n || typeof n !== "object") return false;
      const v = (n as { var?: unknown }).var;
      return v === path || (Array.isArray(v) && v[0] === path);
    };
    const isRuleForOption = (r: Rule): boolean => {
      const w = r.when as Record<string, unknown> | null;
      if (!w || typeof w !== "object") return false;
      const eq = w["=="];
      if (Array.isArray(eq) && eq.length === 2) {
        if (isVarPath(eq[0]) && eq[1] === optionId) return true;
        if (isVarPath(eq[1]) && eq[0] === optionId) return true;
      }
      const inn = w["in"];
      if (Array.isArray(inn) && inn.length === 2) {
        if (isVarPath(inn[1]) && inn[0] === optionId) return true;
      }
      return false;
    };
    const existingIdx = t.rules.findIndex(isRuleForOption);

    if (outcome.kind === "default") {
      if (existingIdx !== -1) {
        t.rules.splice(existingIdx, 1);
        if (t.rules.length === 0) delete t.rules;
      }
      return;
    }

    const stepType = step.type;
    const when =
      stepType === "Checkbox"
        ? { in: [optionId, { var: path }] }
        : { "==": [{ var: path }, optionId] };

    let nextRule: Rule;
    if (outcome.kind === "goto") {
      nextRule = { when, goto: outcome.goto };
    } else {
      const action: Action = outcome.args
        ? ({ type: outcome.type, args: outcome.args } as Action)
        : ({ type: outcome.type } as Action);
      nextRule = { when, actions: [action] };
    }

    if (existingIdx !== -1) {
      t.rules[existingIdx] = nextRule;
    } else {
      t.rules.push(nextRule);
    }
  });

// Изменить только подпись/значение действия в default. Используется
// табличной формой «Что после», когда пользователь меняет, например,
// текст резолюции для finish или templateId для отчёта.
export const patchDefaultActionArgs = (
  stepId: StepId,
  argsPatch: Record<string, unknown>,
): Mutator =>
  tx((d) => {
    const step = d.scenario.steps.find((s) => s.id === stepId);
    if (!step) return;
    const t = ensureTransitions(step);
    const acts = t.default.actions ?? [];
    const idx = acts.findIndex((a) =>
      ["finish", "escalate", "assign", "generateReport", "callMacro"].includes(a.type),
    );
    if (idx === -1) return;
    const cur = acts[idx]!;
    const nextArgs = { ...(cur.args ?? {}), ...argsPatch };
    for (const [k, v] of Object.entries(nextArgs)) {
      if (v === undefined || v === "") delete nextArgs[k];
    }
    if (Object.keys(nextArgs).length === 0) {
      delete cur.args;
    } else {
      cur.args = nextArgs;
    }
  });

// Перенести опцию вверх/вниз. Простые правила, привязанные к этой опции,
// остаются на месте — JSONLogic ссылается по optionId, а не по позиции.
export const reorderStepOption = (
  stepId: StepId,
  fromIndex: number,
  toIndex: number,
): Mutator =>
  tx((d) => {
    const step = d.scenario.steps.find((s) => s.id === stepId) as
      | (Step & { view?: { options?: { id: string; label: string }[] } })
      | undefined;
    const opts = step?.view?.options;
    if (!opts) return;
    if (
      fromIndex < 0 ||
      fromIndex >= opts.length ||
      toIndex < 0 ||
      toIndex >= opts.length ||
      fromIndex === toIndex
    ) {
      return;
    }
    const [moved] = opts.splice(fromIndex, 1);
    if (moved) opts.splice(toIndex, 0, moved);
  });
