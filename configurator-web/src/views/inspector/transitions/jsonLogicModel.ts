// Минимальная нормализованная модель JSONLogic-выражений, которую умеет
// редактировать визуальный билдер.
//
// Поддерживаемые узлы:
//   - литералы: boolean / number / string
//   - var "state.<step>.<prop>" (или произвольная строка-путь)
//   - бинарные сравнения: ==, !=, <, <=, >, >= ; in (membership)
//   - логические: and, or, not (n-арные and/or)
//
// Всё, что не подходит — попадает в `unknown` (raw JSONLogic-объект),
// и UI показывает Raw-редактор для этого поддерева. Это прагматично:
// 90% реальных условий укладываются в перечисленные операторы, а
// необычные (apply, missing, reduce, map, …) пользователь правит руками.

export type LogicLeaf =
  | { kind: "boolean"; value: boolean }
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "var"; path: string };

export type ComparisonOp = "==" | "!=" | "<" | "<=" | ">" | ">=";
export const COMPARISON_OPS: ComparisonOp[] = ["==", "!=", "<", "<=", ">", ">="];

export type LogicNode =
  | LogicLeaf
  | { kind: "compare"; op: ComparisonOp; left: LogicNode; right: LogicNode }
  | { kind: "in"; needle: LogicNode; haystack: LogicNode }
  | { kind: "and"; children: LogicNode[] }
  | { kind: "or"; children: LogicNode[] }
  | { kind: "not"; child: LogicNode }
  | { kind: "unknown"; raw: unknown };

// === parse ===

export function parseLogic(raw: unknown): LogicNode {
  if (raw === true) return { kind: "boolean", value: true };
  if (raw === false) return { kind: "boolean", value: false };
  if (typeof raw === "number") return { kind: "number", value: raw };
  if (typeof raw === "string") return { kind: "string", value: raw };

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { kind: "unknown", raw };
  }

  const obj = raw as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length !== 1) return { kind: "unknown", raw };
  const op = keys[0]!;
  const args = obj[op];

  // var — однострочный путь либо массив [path, default]
  if (op === "var") {
    if (typeof args === "string") return { kind: "var", path: args };
    if (Array.isArray(args) && typeof args[0] === "string") {
      return { kind: "var", path: args[0] };
    }
    return { kind: "unknown", raw };
  }

  if ((COMPARISON_OPS as string[]).includes(op) && Array.isArray(args) && args.length === 2) {
    return {
      kind: "compare",
      op: op as ComparisonOp,
      left: parseLogic(args[0]),
      right: parseLogic(args[1]),
    };
  }

  if (op === "in" && Array.isArray(args) && args.length === 2) {
    return {
      kind: "in",
      needle: parseLogic(args[0]),
      haystack: parseLogic(args[1]),
    };
  }

  if ((op === "and" || op === "or") && Array.isArray(args) && args.length >= 1) {
    return { kind: op, children: args.map(parseLogic) };
  }

  if (op === "!" && !Array.isArray(args)) {
    return { kind: "not", child: parseLogic(args) };
  }
  if (op === "!" && Array.isArray(args) && args.length === 1) {
    return { kind: "not", child: parseLogic(args[0]) };
  }

  return { kind: "unknown", raw };
}

// === serialize ===

export function serializeLogic(node: LogicNode): unknown {
  switch (node.kind) {
    case "boolean":
    case "number":
    case "string":
      return node.value;
    case "var":
      return { var: node.path };
    case "compare":
      return { [node.op]: [serializeLogic(node.left), serializeLogic(node.right)] };
    case "in":
      return { in: [serializeLogic(node.needle), serializeLogic(node.haystack)] };
    case "and":
      return { and: node.children.map(serializeLogic) };
    case "or":
      return { or: node.children.map(serializeLogic) };
    case "not":
      return { "!": serializeLogic(node.child) };
    case "unknown":
      return node.raw;
  }
}

// === helpers ===

export function defaultLeaf(): LogicNode {
  return { kind: "boolean", value: true };
}

export function defaultCompare(): LogicNode {
  return {
    kind: "compare",
    op: "==",
    left: { kind: "var", path: "state." },
    right: { kind: "string", value: "" },
  };
}

// Краткое текстовое представление узла — для бейджей в Flow и Table.
// Этим занимается отдельный jsonLogicLabel.ts; здесь только helper для
// Visual-режима — короткая подпись для свёрнутого узла.
export function shortLabel(node: LogicNode): string {
  switch (node.kind) {
    case "boolean":
      return node.value ? "true" : "false";
    case "number":
      return String(node.value);
    case "string":
      return JSON.stringify(node.value);
    case "var":
      return `var ${node.path}`;
    case "compare":
      return `${shortLabel(node.left)} ${node.op} ${shortLabel(node.right)}`;
    case "in":
      return `${shortLabel(node.needle)} ∈ ${shortLabel(node.haystack)}`;
    case "and":
      return node.children.map(shortLabel).join(" AND ");
    case "or":
      return node.children.map(shortLabel).join(" OR ");
    case "not":
      return `NOT ${shortLabel(node.child)}`;
    case "unknown":
      return "raw";
  }
}
