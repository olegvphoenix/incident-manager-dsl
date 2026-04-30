// Двухуровневая валидация сценария по dsl-v1-draft.md §11.
//
//  Level 1 (Ajv по dsl-v1-schema.json) — структура. Если не проходит,
//  редактор не позволит сохранить файл.
//
//  Level 2 (семантика) — то, что схема выразить не может:
//    - дубли step.id;
//    - висячие goto (на несуществующий step);
//    - дубли option.id внутри одного шага;
//    - default без goto и без finish-action;
//    - недостижимые шаги от initialStepId;
//    - default.goto отсутствует И actions не содержат finish.
//
// Семантические ошибки не блокируют сохранение — это warnings; UI их подсвечивает.

import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schema from "../../../dsl-v1-schema.json";
import type { ScenarioScript, Rule, Transitions } from "../types/dsl";

const ajv = new Ajv2020({ allErrors: true, strict: false, allowUnionTypes: true });
addFormats(ajv);
const validateScript = ajv.compile(schema as object);

export type Severity = "error" | "warning";
export type DiagnosticCode =
  | "ajv"
  | "duplicate_step_id"
  | "duplicate_option_id"
  | "dangling_goto"
  | "default_dead_end"
  | "unreachable_step"
  | "missing_initial_step";

// Подсказка-инструкция «как починить». Опциональна.
export interface DiagnosticHint {
  // Куда вести пользователя по клику.
  // 'inspector' — открыть Inspector на нужной секции (нужен stepId + section);
  // 'flow'      — переключить view на flow и выбрать узел;
  // 'metadata'  — секция «Сценарий» в Inspector (initialStepId и т.п.);
  navigate?:
    | { kind: "inspector"; section: "identity" | "view" | "transitions" | "metadata" }
    | { kind: "flow" }
    | { kind: "metadata" };
  // Короткая фраза действия: «Откройте Inspector → секция View», «Удалите свойство…».
  actionLabel?: string;
}

export interface Diagnostic {
  severity: Severity;
  code: DiagnosticCode;
  // Технический message (как было) — для отладки/grep.
  message: string;
  // Человеческая формулировка для пользователя. Если пусто — UI покажет message.
  humanMessage?: string;
  // Подсказка «как починить» — отображается в expanded-режиме под сообщением.
  hint?: string;
  stepId?: string;
  ruleIndex?: number | "default";
  // путь к месту в JSON для подсветки в Inspector / Table
  jsonPointer?: string;
  // Куда вести пользователя по клику (обогащается интерпретатором ajv-ошибок).
  navigation?: DiagnosticHint["navigate"];
}

// Level 1.
export interface SchemaCheckOk { ok: true; scenario: ScenarioScript }
export interface SchemaCheckFail { ok: false; errors: ErrorObject[]; raw: unknown }
export type SchemaCheckResult = SchemaCheckOk | SchemaCheckFail;

export function checkSchema(input: unknown): SchemaCheckResult {
  const ok = validateScript(input);
  if (!ok) return { ok: false, errors: validateScript.errors ?? [], raw: input };
  return { ok: true, scenario: input as ScenarioScript };
}

export function formatAjvError(e: ErrorObject): string {
  const where = e.instancePath || "(root)";
  const what = e.message ?? "validation error";
  const params =
    e.keyword === "additionalProperties" && e.params?.additionalProperty
      ? ` "${e.params.additionalProperty}"`
      : e.keyword === "required" && e.params?.missingProperty
        ? ` "${e.params.missingProperty}"`
        : e.keyword === "const" && e.params?.allowedValue !== undefined
          ? ` (allowed: ${JSON.stringify(e.params.allowedValue)})`
          : "";
  return `${where}: ${what}${params}`;
}

export function ajvErrorsToDiagnostics(
  errors: ErrorObject[],
  raw?: unknown,
): Diagnostic[] {
  return errors.map<Diagnostic>((e) => humanizeAjvError(e, raw));
}

// Парсит instancePath в JSON Pointer-формате: "/steps/2/view/options/0/id"
// → { stepIdx: 2, segments: ["view","options","0","id"] }.
function parseInstancePath(
  path: string,
): {
  stepIdx?: number;
  ruleIdx?: number | "default";
  section?: "identity" | "view" | "transitions" | "metadata" | "timers" | "concurrency";
  field?: string;
  segments: string[];
} {
  if (!path || path === "(root)") return { segments: [] };
  const segments = path
    .split("/")
    .slice(1)
    .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));

  const result: ReturnType<typeof parseInstancePath> = { segments };
  let cursor = 0;

  if (segments[cursor] === "metadata") {
    result.section = "metadata";
    result.field = segments[cursor + 1];
    return result;
  }
  if (segments[cursor] === "timers") {
    result.section = "timers";
    result.field = segments[cursor + 1];
    return result;
  }
  if (segments[cursor] === "concurrency") {
    result.section = "concurrency";
    result.field = segments[cursor + 1];
    return result;
  }

  if (segments[cursor] === "steps" && segments[cursor + 1]) {
    result.stepIdx = Number(segments[cursor + 1]);
    cursor += 2;
    const next = segments[cursor];
    if (next === "view") {
      result.section = "view";
      result.field = segments.slice(cursor + 1).join(".");
    } else if (next === "transitions") {
      result.section = "transitions";
      // /transitions/rules/0/...  или /transitions/default/...
      const sub = segments[cursor + 1];
      if (sub === "default") result.ruleIdx = "default";
      else if (sub === "rules" && segments[cursor + 2] !== undefined) {
        result.ruleIdx = Number(segments[cursor + 2]);
      }
      result.field = segments.slice(cursor + 1).join(".");
    } else if (next === "id" || next === "type" || next === "title") {
      result.section = "identity";
      result.field = next;
    } else if (next !== undefined) {
      result.field = segments.slice(cursor).join(".");
    }
  }
  return result;
}

// Достаёт step.id по индексу из raw-сценария (Level1 fail — типов ещё нет).
function safeStepIdAt(raw: unknown, idx: number): string | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const steps = (raw as { steps?: unknown }).steps;
  if (!Array.isArray(steps) || !steps[idx]) return undefined;
  const s = steps[idx] as { id?: unknown };
  return typeof s?.id === "string" ? s.id : undefined;
}

// Шапка сообщения вида "Шаг 'verify_event' (RadioButton) → View".
function locationHeader(
  stepId: string | undefined,
  stepType: string | undefined,
  sectionLabel: string | undefined,
): string {
  if (!stepId) return sectionLabel ? sectionLabel + ": " : "";
  const t = stepType ? ` (${stepType})` : "";
  const sect = sectionLabel ? ` → ${sectionLabel}` : "";
  return `Шаг «${stepId}»${t}${sect}: `;
}

const SECTION_LABEL: Record<string, string> = {
  identity: "Идентификация",
  view: "View (содержимое)",
  transitions: "Transitions (переходы)",
  metadata: "Сценарий",
  timers: "Таймеры",
  concurrency: "Concurrency",
};

// Главная функция перевода Ajv-ошибки в человеческое сообщение.
// Цель: пользователь должен понять «где» и «что делать», без чтения JSON Pointer.
function humanizeAjvError(e: ErrorObject, raw?: unknown): Diagnostic {
  const parsed = parseInstancePath(e.instancePath ?? "");
  const stepId =
    parsed.stepIdx !== undefined ? safeStepIdAt(raw, parsed.stepIdx) : undefined;
  const stepType =
    parsed.stepIdx !== undefined && raw && typeof raw === "object"
      ? ((raw as { steps?: { type?: string }[] }).steps?.[parsed.stepIdx]?.type)
      : undefined;
  const sectionLabel = parsed.section ? SECTION_LABEL[parsed.section] : undefined;
  const header = locationHeader(stepId, stepType, sectionLabel);

  let humanMessage = "";
  let hint = "";

  switch (e.keyword) {
    case "additionalProperties": {
      const prop = (e.params as { additionalProperty?: string })?.additionalProperty ?? "?";
      humanMessage = `${header}лишнее поле «${prop}»`;
      hint =
        parsed.section === "view"
          ? `Поле «${prop}» не поддерживается типом «${stepType ?? "step"}». Удалите его или смените тип шага.`
          : `Удалите свойство «${prop}» — оно не описано в схеме DSL для этого места.`;
      break;
    }
    case "required": {
      const prop = (e.params as { missingProperty?: string })?.missingProperty ?? "?";
      humanMessage = `${header}не хватает обязательного поля «${prop}»`;
      hint =
        parsed.section === "view" && (prop === "options" || prop === "label")
          ? `Откройте Inspector → секция «View» и заполните поле «${prop}».`
          : `Добавьте свойство «${prop}» в этом месте.`;
      break;
    }
    case "const": {
      const allowed = (e.params as { allowedValue?: unknown })?.allowedValue;
      if (parsed.field === "type") {
        humanMessage = `${header}тип шага должен быть «${allowed}», а указан «${stepType ?? "?"}»`;
        hint =
          `View и Type шага рассинхронизированы. Откройте Inspector → секция «Идентификация» и смените тип на «${allowed}», ` +
          `или верните тип в исходный, если поменяли по ошибке.`;
      } else {
        humanMessage = `${header}значение должно быть «${allowed}»`;
        hint = `Замените значение на «${allowed}» (см. описание поля в DSL спецификации).`;
      }
      break;
    }
    case "enum": {
      const allowed = (e.params as { allowedValues?: unknown[] })?.allowedValues;
      humanMessage = `${header}значение «${parsed.field ?? "поле"}» должно быть одним из: ${allowed ? allowed.map((x) => `«${x}»`).join(", ") : "?"}`;
      hint = `Выберите одно из перечисленных значений.`;
      break;
    }
    case "type": {
      const expect = (e.params as { type?: string })?.type ?? "?";
      humanMessage = `${header}поле должно иметь тип «${expect}»`;
      hint = `Проверьте формат значения. Например, число вместо строки, массив вместо одиночного значения.`;
      break;
    }
    case "minItems": {
      const n = (e.params as { limit?: number })?.limit ?? 1;
      humanMessage = `${header}нужно минимум ${n} элемент${n === 1 ? "" : "а"}`;
      hint = `Добавьте недостающие элементы в список (опции, правила, шаги).`;
      break;
    }
    case "minLength": {
      const n = (e.params as { limit?: number })?.limit ?? 1;
      humanMessage = `${header}строка не может быть пустой (минимум ${n})`;
      hint = `Заполните это поле — оно обязательное и не может быть пустой строкой.`;
      break;
    }
    case "pattern": {
      humanMessage = `${header}значение не соответствует формату`;
      hint = `Поле должно соответствовать регулярному выражению из схемы. Чаще всего это id (буквы/цифры/подчёркивания, без пробелов).`;
      break;
    }
    case "format": {
      const fmt = (e.params as { format?: string })?.format ?? "?";
      humanMessage = `${header}значение должно быть в формате «${fmt}»`;
      hint = `Например, для «uuid» — строка вида 00000000-0000-0000-0000-000000000000.`;
      break;
    }
    case "oneOf":
    case "anyOf": {
      humanMessage = `${header}структура не подходит ни под один из вариантов схемы`;
      hint =
        `Чаще всего это значит, что у шага не совпадают «type» и поля «view». ` +
        `Откройте Inspector → секция «Идентификация» и проверьте тип шага. ` +
        `Если меняли тип через JSON — придётся либо вернуть тип, либо переделать view под него.`;
      break;
    }
    default: {
      humanMessage = `${header}${e.message ?? "ошибка валидации"}`;
      hint = `Проверьте структуру в этом месте по схеме dsl-v1-schema.json.`;
    }
  }

  // Навигация — по парсеру.
  let navigation: DiagnosticHint["navigate"] | undefined;
  if (parsed.section === "metadata" || parsed.section === "timers" || parsed.section === "concurrency") {
    navigation = { kind: "metadata" };
  } else if (stepId && parsed.section) {
    navigation = {
      kind: "inspector",
      section: parsed.section as "identity" | "view" | "transitions",
    };
  } else if (stepId) {
    navigation = { kind: "flow" };
  }

  return {
    severity: "error",
    code: "ajv",
    message: formatAjvError(e),
    humanMessage,
    hint,
    stepId,
    ruleIndex: parsed.ruleIdx,
    jsonPointer: e.instancePath || undefined,
    navigation,
  };
}

// Level 2.
export function checkSemantics(scenario: ScenarioScript): Diagnostic[] {
  const out: Diagnostic[] = [];
  const stepIds = new Set<string>();

  for (const step of scenario.steps) {
    if (stepIds.has(step.id)) {
      out.push({
        severity: "error",
        code: "duplicate_step_id",
        message: `Дубль step.id "${step.id}"`,
        humanMessage: `Шаг «${step.id}»: id повторяется`,
        hint:
          "У двух шагов один id — это ломает goto. Откройте Inspector → секция «Идентификация» одного из шагов и переименуйте его (id уникален в пределах сценария).",
        stepId: step.id,
        navigation: { kind: "inspector", section: "identity" },
      });
    } else {
      stepIds.add(step.id);
    }
  }

  if (!stepIds.has(scenario.initialStepId)) {
    out.push({
      severity: "error",
      code: "missing_initial_step",
      message: `initialStepId "${scenario.initialStepId}" не найден среди шагов`,
      humanMessage: `Сценарий: initialStepId «${scenario.initialStepId}» указывает на несуществующий шаг`,
      hint:
        "Откройте секцию «Сценарий» (Inspector справа, без выделения шага) и выберите начальный шаг из списка. Либо ПКМ на узле в Flow → «Сделать начальным».",
      navigation: { kind: "metadata" },
    });
  }

  // Дубли option.id, висячие goto, default-dead-end.
  for (const step of scenario.steps) {
    // Опции
    const view = (step as { view?: { options?: { id: string }[] } }).view;
    const opts = view?.options;
    if (opts && Array.isArray(opts)) {
      const seen = new Set<string>();
      for (const opt of opts) {
        if (seen.has(opt.id)) {
          out.push({
            severity: "error",
            code: "duplicate_option_id",
            message: `В шаге "${step.id}" дубль option.id "${opt.id}"`,
            humanMessage: `Шаг «${step.id}»: повторяется option.id «${opt.id}»`,
            hint:
              "Откройте Inspector → секция «View» этого шага и переименуйте одну из опций — id опций уникальны внутри шага.",
            stepId: step.id,
            navigation: { kind: "inspector", section: "view" },
          });
        }
        seen.add(opt.id);
      }
    }

    // Transitions
    const t = step.transitions;
    if (!t) continue;
    checkTransitions(step.id, t, stepIds, out);
  }

  // Достижимость от initialStepId — BFS по графу transitions.
  // Сообщаем только об одном виде проблемы — "недостижим"; «orphan» отдельно
  // не отчитываем, потому что на практике это тот же самый сигнал и пользователь
  // получал два предупреждения на каждый только что добавленный шаг.
  //
  // Чтобы не пугать пользователя сразу после drop'а из палитры, мы подавляем
  // warning для шагов, которые выглядят как «свежие черновики»: на них никто
  // не ссылается, и сами они не ссылаются на что-то осмысленное (default.goto
  // на самого себя — это фабричный self-loop, не «настоящий» исходящий).
  // Как только пользователь подключит шаг хотя бы с одной стороны (ребро
  // снаружи или goto наружу) — warning появится, если действительно недостижим.
  if (stepIds.has(scenario.initialStepId) && scenario.steps.length > 1) {
    const reachable = computeReachable(scenario);
    const incomingCount = computeIncomingCount(scenario);

    for (const step of scenario.steps) {
      if (reachable.has(step.id)) continue;
      if (step.id === scenario.initialStepId) continue;
      if (isFreshDraftStep(step, incomingCount.get(step.id) ?? 0)) continue;
      out.push({
        severity: "warning",
        code: "unreachable_step",
        message: `Шаг "${step.id}" недостижим от initialStepId`,
        humanMessage: `Шаг «${step.id}» недостижим от начального шага`,
        hint:
          "Ни один переход не ведёт на этот шаг. Либо подключите его (drag из узла-источника на этот узел), либо удалите шаг (ПКМ → Удалить), либо сделайте этот шаг начальным (ПКМ → «Сделать начальным»).",
        stepId: step.id,
        navigation: { kind: "flow" },
      });
    }
  }

  return out;
}

// «Свежий» / «черновик» шаг — на него никто не ссылается, и сам он никуда
// осмысленно не ведёт. Self-loop фабричного default (goto = собственный id)
// не считается «настоящим» исходящим — это дефолт после addStep.
function isFreshDraftStep(
  step: ScenarioScript["steps"][number],
  incoming: number,
): boolean {
  if (incoming > 0) return false;
  const t = step.transitions;
  if (!t) return true;
  // Любое правило с goto на чужой шаг — уже не «черновик».
  if (t.rules && t.rules.length > 0) {
    for (const r of t.rules) {
      if (r.goto !== undefined && r.goto !== null && r.goto !== step.id) return false;
    }
  }
  // default.goto на чужой шаг — тоже не черновик.
  if (t.default && t.default.goto !== undefined && t.default.goto !== null) {
    if (t.default.goto !== step.id) return false;
  }
  return true;
}

function computeIncomingCount(scenario: ScenarioScript): Map<string, number> {
  const counts = new Map<string, number>();
  for (const step of scenario.steps) counts.set(step.id, 0);
  for (const step of scenario.steps) {
    const t = step.transitions;
    if (!t) continue;
    if (t.rules) {
      for (const r of t.rules) {
        // self-loop не учитываем — он не делает шаг «достижимым извне».
        if (r.goto && r.goto !== step.id && counts.has(r.goto)) {
          counts.set(r.goto, (counts.get(r.goto) ?? 0) + 1);
        }
      }
    }
    if (t.default.goto && t.default.goto !== step.id && counts.has(t.default.goto)) {
      counts.set(t.default.goto, (counts.get(t.default.goto) ?? 0) + 1);
    }
  }
  return counts;
}

function checkTransitions(
  stepId: string,
  t: Transitions,
  stepIds: Set<string>,
  out: Diagnostic[],
) {
  if (t.rules) {
    t.rules.forEach((rule: Rule, idx: number) => {
      if (rule.goto && rule.goto !== null && !stepIds.has(rule.goto)) {
        out.push({
          severity: "error",
          code: "dangling_goto",
          message: `Висячий goto "${rule.goto}" в правиле #${idx} шага "${stepId}"`,
          humanMessage: `Шаг «${stepId}» → правило #${idx}: goto указывает на несуществующий шаг «${rule.goto}»`,
          hint:
            "Шаг, на который ссылается это правило, был удалён или переименован. В Inspector → Transitions выберите существующий шаг в поле goto, либо удалите правило, либо в Flow перетащите конец стрелки на нужный узел.",
          stepId,
          ruleIndex: idx,
          navigation: { kind: "inspector", section: "transitions" },
        });
      }
    });
  }
  // default
  const def = t.default;
  if (def.goto && def.goto !== null && !stepIds.has(def.goto)) {
    out.push({
      severity: "error",
      code: "dangling_goto",
      message: `Висячий goto "${def.goto}" в default шага "${stepId}"`,
      humanMessage: `Шаг «${stepId}» → default: goto указывает на несуществующий шаг «${def.goto}»`,
      hint:
        "default-переход ведёт на несуществующий шаг. В Inspector → Transitions выберите goto заново, либо в Flow перетащите конец default-стрелки на существующий узел, либо ПКМ на узле → «Завершить здесь (finish)».",
      stepId,
      ruleIndex: "default",
      navigation: { kind: "inspector", section: "transitions" },
    });
  }
  // default-dead-end: если goto не задан и нет finish-action.
  const hasGoto = "goto" in def;
  const hasFinish = (def.actions ?? []).some((a) => a.type === "finish");
  if (!hasGoto && !hasFinish) {
    out.push({
      severity: "error",
      code: "default_dead_end",
      message: `default шага "${stepId}" не имеет ни goto, ни finish-action`,
      humanMessage: `Шаг «${stepId}»: default-переход «в никуда»`,
      hint:
        "У default не указан goto и нет finish-action. Это означает, что после шага непонятно, что делать. Решения: ПКМ на узле → «Завершить здесь (finish)», или в Flow перетащите стрелку на нужный шаг.",
      stepId,
      ruleIndex: "default",
      navigation: { kind: "inspector", section: "transitions" },
    });
  }
}

function computeReachable(scenario: ScenarioScript): Set<string> {
  const stepById = new Map(scenario.steps.map((s) => [s.id, s] as const));
  const reachable = new Set<string>();
  const queue: string[] = [scenario.initialStepId];

  while (queue.length) {
    const id = queue.shift()!;
    if (reachable.has(id)) continue;
    reachable.add(id);

    const step = stepById.get(id);
    if (!step?.transitions) continue;
    const t = step.transitions;
    if (t.rules) {
      for (const r of t.rules) {
        if (r.goto && stepById.has(r.goto)) queue.push(r.goto);
      }
    }
    if (t.default.goto && stepById.has(t.default.goto)) {
      queue.push(t.default.goto);
    }
  }

  return reachable;
}

// Полная валидация (Level 1 + 2). Возвращает либо ok-сценарий + warnings,
// либо набор ошибок (когда Level 1 не прошёл).
export type FullValidation =
  | { ok: true; scenario: ScenarioScript; diagnostics: Diagnostic[] }
  | { ok: false; diagnostics: Diagnostic[]; raw: unknown };

export function validate(input: unknown): FullValidation {
  const lvl1 = checkSchema(input);
  if (!lvl1.ok) {
    return {
      ok: false,
      diagnostics: ajvErrorsToDiagnostics(lvl1.errors, lvl1.raw),
      raw: lvl1.raw,
    };
  }
  const semantic = checkSemantics(lvl1.scenario);
  return { ok: true, scenario: lvl1.scenario, diagnostics: semantic };
}
