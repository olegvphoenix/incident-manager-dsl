// Парсер dsl-v1-schema.json в дерево, удобное для отображения в SchemaView.
// Главный источник истины — JSON Schema; вся UI-документация генерируется из неё.
//
// Без шумных типов: используем минимально необходимый shape.

import schemaRaw from "../../../dsl-v1-schema.json";

// JSON Schema (упрощённо).
export interface RawSchema {
  $id?: string;
  $ref?: string;
  $defs?: Record<string, RawSchema>;
  title?: string;
  description?: string;
  type?: string | string[];
  enum?: unknown[];
  const?: unknown;
  pattern?: string;
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  default?: unknown;
  properties?: Record<string, RawSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: RawSchema;
  oneOf?: RawSchema[];
  anyOf?: RawSchema[];
  allOf?: RawSchema[];
  examples?: unknown[];
  // наши собственные расширения / часто встречающиеся поля
}

export const schema = schemaRaw as RawSchema;
const defs = (schema.$defs ?? {}) as Record<string, RawSchema>;

// Расширенная информация о узле, которую SchemaView рендерит.
export interface SchemaNode {
  // путь идентификатора узла — для URL и навигации.
  // Примеры: "root", "metadata", "steps", "step:RadioButton", "transitions",
  //          "action:assign", "result", "result.attachments".
  id: string;
  // что показать в дереве и в заголовке детальной панели
  title: string;
  // подзаголовок — короткое описание
  shortDescription?: string;
  // полное описание (markdown-friendly)
  description?: string;
  // ссылка на $defs (если узел это $defs/X) — позволяет получить raw schema
  defName?: string;
  // путь по схеме (для копирования / навигации backend'ов)
  schemaPath: string;
  // дочерние узлы в дереве (порядок имеет значение, иерархия для UI)
  children?: SchemaNode[];
  // что рендерить в детальной панели
  kind: "root" | "object" | "union" | "primitive" | "ref" | "section";
  // raw-схема узла (если применимо) — используется для генерации таблицы полей
  raw?: RawSchema;
  // поля для object-узлов (раскрытые из raw.properties)
  fields?: SchemaField[];
  // варианты для union-узлов (oneOf)
  variants?: SchemaNode[];
  // соответствие легаси-системе (вытянуто из description, если есть)
  legacyMapping?: string;
  // примеры, ассоциированные с узлом
  exampleSnippet?: string;
}

export interface SchemaField {
  name: string;
  required: boolean;
  type: string;            // human-readable (string / integer / array<Step> / Option / "primary" | "secondary" | …)
  refTo?: string;          // если поле ссылается на $defs/X — id этого узла
  description?: string;
  defaultValue?: unknown;
  enumValues?: unknown[];
  pattern?: string;
}

export interface SchemaTree {
  root: SchemaNode;
  byId: Record<string, SchemaNode>;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function refToDefName(ref: string): string | null {
  const m = ref.match(/^#\/\$defs\/(.+)$/);
  return m ? m[1]! : null;
}

// Превратить под-схему поля в человеко-читаемый тип, плюс — (optionally) refTo.
function describeFieldType(s: RawSchema): { type: string; refTo?: string } {
  if (s.$ref) {
    const d = refToDefName(s.$ref);
    if (d) return { type: d, refTo: defNameToNodeId(d) };
    return { type: s.$ref };
  }
  if (s.const !== undefined) return { type: `"${s.const}"` };
  if (Array.isArray(s.enum)) {
    return { type: s.enum.map((x) => JSON.stringify(x)).join(" | ") };
  }
  if (s.oneOf) {
    const parts = s.oneOf.map((x) => describeFieldType(x).type);
    return { type: parts.join(" | ") };
  }
  if (s.anyOf) {
    const parts = s.anyOf.map((x) => describeFieldType(x).type);
    return { type: parts.join(" | ") };
  }
  if (s.type === "array") {
    const inner = s.items ? describeFieldType(s.items).type : "any";
    return { type: `Array<${inner}>` };
  }
  if (Array.isArray(s.type)) return { type: s.type.join(" | ") };
  if (s.type) return { type: s.type };
  return { type: "object" };
}

function fieldsOf(s: RawSchema, parentPath: string): SchemaField[] {
  const props = s.properties ?? {};
  const required = new Set(s.required ?? []);
  return Object.entries(props).map(([name, sub]) => {
    const td = describeFieldType(sub);
    return {
      name,
      required: required.has(name),
      type: td.type,
      refTo: td.refTo,
      description: sub.description,
      defaultValue: sub.default,
      enumValues: sub.enum,
      pattern: sub.pattern,
    } satisfies SchemaField;
  }).map((f) => ({ ...f, _path: parentPath })) as SchemaField[];
}

function defNameToNodeId(defName: string): string {
  // Step* → step:RadioButton/etc; *Action → action:callMacro/etc; иначе — defName в lower-camel.
  if (defName.endsWith("Step")) {
    const stem = defName.slice(0, -"Step".length);
    return `step:${stem}`;
  }
  if (defName.endsWith("Action")) {
    const stem = defName.slice(0, -"Action".length);
    return `action:${lowercaseFirst(stem)}`;
  }
  return `def:${defName}`;
}

function lowercaseFirst(s: string): string {
  return s.length === 0 ? s : s[0]!.toLowerCase() + s.slice(1);
}

// ── tree builder ──────────────────────────────────────────────────────────────

const STEP_TYPES = [
  ["Button",       "ButtonStep"],
  ["RadioButton",  "RadioButtonStep"],
  ["Checkbox",     "CheckboxStep"],
  ["Select",       "SelectStep"],
  ["Comment",      "CommentStep"],
  ["Image",        "ImageStep"],
  ["Datetime",     "DatetimeStep"],
] as const;

const ACTION_TYPES = [
  ["assign",         "AssignAction"],
  ["callMacro",      "CallMacroAction"],
  ["generateReport", "GenerateReportAction"],
  ["escalate",       "EscalateAction"],
  ["finish",         "FinishAction"],
] as const;

function buildTree(): SchemaTree {
  const byId: Record<string, SchemaNode> = {};

  function reg<T extends SchemaNode>(node: T): T {
    byId[node.id] = node;
    return node;
  }

  // ── 1. Шаги (7 типов) ───────────────────────────────────────────────────────
  const stepNodes = STEP_TYPES.map(([variant, defName]) => reg<SchemaNode>({
    id: `step:${variant}`,
    title: variant,
    shortDescription: defs[defName]?.description?.split(".")[0],
    description: defs[defName]?.description,
    defName,
    schemaPath: `#/$defs/${defName}`,
    kind: "object",
    raw: defs[defName],
    fields: fieldsOf(defs[defName] ?? {}, `#/$defs/${defName}`),
    legacyMapping: extractLegacy(defs[defName]?.description),
    exampleSnippet: makeExampleForStep(variant),
  }));

  const stepsNode = reg<SchemaNode>({
    id: "steps",
    title: "Шаги (7 типов)",
    shortDescription: "Дискриминированное объединение по полю type",
    description: defs.Step?.description,
    defName: "Step",
    schemaPath: "#/properties/steps",
    kind: "union",
    raw: defs.Step,
    variants: stepNodes,
    children: stepNodes,
  });

  // ── 2. Actions (5 типов) ────────────────────────────────────────────────────
  const actionNodes = ACTION_TYPES.map(([typeKey, defName]) => reg<SchemaNode>({
    id: `action:${typeKey}`,
    title: typeKey,
    shortDescription: defs[defName]?.description?.split(".")[0],
    description: defs[defName]?.description,
    defName,
    schemaPath: `#/$defs/${defName}`,
    kind: "object",
    raw: defs[defName],
    fields: fieldsOf(defs[defName] ?? {}, `#/$defs/${defName}`),
    legacyMapping: extractLegacy(defs[defName]?.description),
  }));

  const actionsNode = reg<SchemaNode>({
    id: "actions",
    title: "Actions (5 типов)",
    shortDescription: "Сайд-эффекты переходов",
    description: defs.Action?.description,
    defName: "Action",
    schemaPath: "#/$defs/Action",
    kind: "union",
    raw: defs.Action,
    variants: actionNodes,
    children: actionNodes,
  });

  // ── 3. Transitions / Rule / RuleOutcome ─────────────────────────────────────
  const ruleNode = reg<SchemaNode>({
    id: "transitions:rule",
    title: "Rule",
    shortDescription: "Условное правило перехода (when + goto/actions)",
    description: defs.Rule?.description,
    defName: "Rule",
    schemaPath: "#/$defs/Rule",
    kind: "object",
    raw: defs.Rule,
    fields: fieldsOf(defs.Rule ?? {}, "#/$defs/Rule"),
  });

  const ruleOutcomeNode = reg<SchemaNode>({
    id: "transitions:default",
    title: "RuleOutcome (default)",
    shortDescription: "То же что Rule, но без when — fallback",
    description: defs.RuleOutcome?.description,
    defName: "RuleOutcome",
    schemaPath: "#/$defs/RuleOutcome",
    kind: "object",
    raw: defs.RuleOutcome,
    fields: fieldsOf(defs.RuleOutcome ?? {}, "#/$defs/RuleOutcome"),
  });

  const jsonLogicNode = reg<SchemaNode>({
    id: "transitions:jsonlogic",
    title: "JSONLogic",
    shortDescription: "Формат when-выражения. Whitelist операторов в §7 спеки",
    description: defs.JsonLogicExpr?.description,
    defName: "JsonLogicExpr",
    schemaPath: "#/$defs/JsonLogicExpr",
    kind: "primitive",
    raw: defs.JsonLogicExpr,
  });

  const transitionsNode = reg<SchemaNode>({
    id: "transitions",
    title: "Transitions",
    shortDescription: "rules[] + default. First-match по rules сверху вниз",
    description: defs.Transitions?.description,
    defName: "Transitions",
    schemaPath: "#/$defs/Transitions",
    kind: "object",
    raw: defs.Transitions,
    fields: fieldsOf(defs.Transitions ?? {}, "#/$defs/Transitions"),
    children: [ruleNode, ruleOutcomeNode, jsonLogicNode],
  });

  // ── 4. Option ───────────────────────────────────────────────────────────────
  const optionNode = reg<SchemaNode>({
    id: "option",
    title: "Option",
    shortDescription: "Вариант ответа для RadioButton/Checkbox/Select",
    description: defs.Option?.description,
    defName: "Option",
    schemaPath: "#/$defs/Option",
    kind: "object",
    raw: defs.Option,
    fields: fieldsOf(defs.Option ?? {}, "#/$defs/Option"),
  });

  // ── 5. Metadata + scalars ──────────────────────────────────────────────────
  const metadataNode = reg<SchemaNode>({
    id: "metadata",
    title: "metadata",
    shortDescription: "Identity-блок: scenarioGuid + version + name (обязательно)",
    description: schema.properties?.metadata?.description,
    schemaPath: "#/properties/metadata",
    kind: "object",
    raw: schema.properties?.metadata,
    fields: fieldsOf(schema.properties?.metadata ?? {}, "#/properties/metadata"),
  });

  const scalars = [
    ["StepId", "scalar:StepId"],
    ["OptionId", "scalar:OptionId"],
    ["Label", "scalar:Label"],
    ["ScenarioGuid", "scalar:ScenarioGuid"],
    ["ScenarioVersion", "scalar:ScenarioVersion"],
  ] as const;

  const scalarNodes = scalars.map(([defName, id]) => reg<SchemaNode>({
    id,
    title: defName,
    shortDescription: defs[defName]?.description?.split(".")[0],
    description: defs[defName]?.description,
    defName,
    schemaPath: `#/$defs/${defName}`,
    kind: "primitive",
    raw: defs[defName],
  }));

  // ── 6. ScenarioResult и attachments ────────────────────────────────────────
  // ScenarioResult описан в спеке §9, в JSON Schema его нет (он не часть DSL,
  // а runtime-производное). Описываем «синтетически» — для целостной картинки.
  const attachmentsNode = reg<SchemaNode>({
    id: "result.attachments",
    title: "attachments[]",
    shortDescription: "Side-таблица бинарных вложений (только для Image-шагов)",
    description:
      "Хранит оригинальные байты картинок, на которые ссылаются Image-шаги. " +
      "В state[stepId].value лежат только id'ы — это удерживает state компактным " +
      "и совместимым с JSONLogic. См. dsl-v1-draft.md §9.",
    schemaPath: "(runtime: scenarioResult.attachments)",
    kind: "object",
    fields: [
      { name: "id",          required: true,  type: "string", description: "Стабильный UUID вложения" },
      { name: "stepId",      required: true,  type: "StepId", refTo: "scalar:StepId", description: "К какому Image-шагу относится" },
      { name: "source",      required: true,  type: '"camera" | "map" | "operator" | "fixed"', description: "Источник: камера / карта / оператор / эталон" },
      { name: "mime",        required: true,  type: "string", description: "image/jpeg, image/png, …" },
      { name: "fileName",    required: false, type: "string", description: "Оригинальное имя файла (если известно)" },
      { name: "size",        required: true,  type: "integer", description: "Размер в байтах" },
      { name: "sha256",      required: false, type: "string", description: "Хэш содержимого (для дедупликации/целостности)" },
      { name: "capturedAt",  required: true,  type: "string (ISO-8601)", description: "Когда вложение получено" },
      { name: "dataBase64",  required: false, type: "string (base64)", description: "Содержимое в demo-runner'е и self-contained экспортах" },
      { name: "storage",     required: false, type: '{ kind: "s3", bucket, key } | { kind: "url", url }', description: "На сервере: вместо dataBase64. Лениво подгружается runner'ом" },
    ],
  });

  const stateNode = reg<SchemaNode>({
    id: "result.state",
    title: "state{}",
    shortDescription: "stepId → { value, answeredAt, by }. Тип value зависит от Step.type",
    schemaPath: "(runtime: scenarioResult.state)",
    kind: "object",
    fields: [
      { name: "stepId.value",      required: true, type: "string | string[] | null", description: "См. таблицу 'тип шага → тип value' в spec §9" },
      { name: "stepId.answeredAt", required: true, type: "string (ISO-8601)", description: "Когда оператор подтвердил ответ" },
      { name: "stepId.by",         required: false, type: "string | null",     description: "Кто отвечал (operator id); демо-runner кладёт null" },
    ],
  });

  const historyNode = reg<SchemaNode>({
    id: "result.history",
    title: "history[]",
    shortDescription: "Append-only журнал событий (answer / transition / action / finish)",
    schemaPath: "(runtime: scenarioResult.history)",
    kind: "object",
    fields: [
      { name: "ts",         required: true, type: "string (ISO-8601)" },
      { name: "stepId",     required: true, type: "StepId", refTo: "scalar:StepId" },
      { name: "action",     required: true, type: '"answer" | "transition" | "callMacro" | "generateReport" | "escalate" | "assign" | "finish" | "timeout"' },
      { name: "<доп.поля>", required: false, type: "зависят от action", description: "См. таблицу 'семантика history' в spec §9" },
    ],
  });

  const resultNode = reg<SchemaNode>({
    id: "result",
    title: "scenarioResult",
    shortDescription: "Runtime-результат прохождения сценария (НЕ часть DSL)",
    description:
      "Не описан в JSON Schema — это производное состояние, которое строит runner. " +
      "Структура зафиксирована в dsl-v1-draft.md §9. Содержит state, history и " +
      "attachments (для Image-шагов).",
    schemaPath: "(runtime, см. spec §9)",
    kind: "section",
    children: [stateNode, historyNode, attachmentsNode],
  });

  // ── 7. Корень ───────────────────────────────────────────────────────────────
  const overviewNode = reg<SchemaNode>({
    id: "overview",
    title: "Обзор: вся модель на одном экране",
    shortDescription: "Mermaid-диаграмма отношений + вход в любой узел",
    schemaPath: "(сводный экран)",
    kind: "section",
  });

  const rootChildren: SchemaNode[] = [
    overviewNode,
    metadataNode,
    stepsNode,
    transitionsNode,
    actionsNode,
    optionNode,
    reg<SchemaNode>({
      id: "scalars",
      title: "Базовые типы (StepId, Label, …)",
      shortDescription: "Атомы, которые переиспользуются всем DSL",
      schemaPath: "#/$defs/(StepId|OptionId|Label|ScenarioGuid|ScenarioVersion)",
      kind: "section",
      children: scalarNodes,
    }),
    resultNode,
  ];

  const rootNode = reg<SchemaNode>({
    id: "root",
    title: schema.title ?? "DSL v1",
    shortDescription: schema.description?.split(".")[0],
    description: schema.description,
    schemaPath: schema.$id ?? "#",
    kind: "root",
    raw: schema,
    fields: fieldsOf(schema, "#"),
    children: rootChildren,
  });

  return { root: rootNode, byId };
}

function extractLegacy(text?: string): string | undefined {
  if (!text) return undefined;
  const m = text.match(/Maps to legacy[^.]+\./i) ?? text.match(/legacy IM\/[^.]+\./i);
  return m ? m[0] : undefined;
}

function makeExampleForStep(variant: string): string {
  switch (variant) {
    case "Button":
      return `{
  "id": "ack",
  "type": "Button",
  "view": { "label": "Закрыть" },
  "transitions": {
    "default": { "actions": [ { "type": "finish" } ] }
  }
}`;
    case "RadioButton":
      return `{
  "id": "severity",
  "type": "RadioButton",
  "view": {
    "label": "Уровень тревоги",
    "options": [
      { "id": "low", "label": "Низкий" },
      { "id": "high", "label": "Высокий" }
    ]
  },
  "transitions": { "default": { "goto": "next" } }
}`;
    case "Checkbox":
      return `{
  "id": "signs",
  "type": "Checkbox",
  "view": {
    "label": "Признаки",
    "options": [
      { "id": "smoke", "label": "Задымление" },
      { "id": "alarm", "label": "Сигнализация" }
    ],
    "minSelected": 1
  },
  "transitions": { "default": { "goto": "next" } }
}`;
    case "Select":
      return `{
  "id": "object_type",
  "type": "Select",
  "view": {
    "label": "Тип объекта",
    "options": [
      { "id": "office",    "label": "Офис" },
      { "id": "warehouse", "label": "Склад" }
    ]
  },
  "transitions": { "default": { "goto": "next" } }
}`;
    case "Comment":
      return `{
  "id": "note",
  "type": "Comment",
  "view": {
    "label": "Комментарий",
    "minLength": 5,
    "maxRows": 6
  },
  "transitions": { "default": { "goto": "next" } }
}`;
    case "Image":
      return `{
  "id": "snapshot",
  "type": "Image",
  "view": {
    "label": "Снимок с камеры",
    "source": "camera",
    "allowMultiple": false
  },
  "transitions": { "default": { "goto": "next" } }
}`;
    case "Datetime":
      return `{
  "id": "incident_time",
  "type": "Datetime",
  "view": {
    "label": "Когда произошло",
    "kind": "datetime"
  },
  "transitions": { "default": { "goto": "next" } }
}`;
  }
  return "{}";
}

export const schemaTree: SchemaTree = buildTree();
