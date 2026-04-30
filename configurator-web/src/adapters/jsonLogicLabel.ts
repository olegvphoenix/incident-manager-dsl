// Короткая человекочитаемая сводка JSONLogic-выражения для подписи ребра.
// Не пытается восстанавливать точный синтаксис — это компактный label,
// чтобы пользователь узнал правило (полная форма — в Inspector).
//
// Примеры:
//   { "==": [{"var":"state.x.value"}, "real"] }  → x == "real"
//   { "and": [...] }                              → x == "a" AND y > 0
//   { "in": [{"var":...}, ["a","b"]] }            → x in [a,b]
//
// На M6 этот файл будет переиспользован JsonLogicVisualBuilder'ом.

const MAX_LEN = 32;

export function compactLogicLabel(expr: unknown): string {
  if (expr === true) return "true";
  if (expr === false) return "false";
  if (expr === null || expr === undefined) return "—";
  if (typeof expr !== "object") return JSON.stringify(expr);

  const e = expr as Record<string, unknown>;
  const keys = Object.keys(e);
  if (keys.length !== 1) return clip(JSON.stringify(e));
  const op = keys[0]!;
  const args = e[op];

  switch (op) {
    case "var":
      return varName(args);
    case "==":
    case "===":
      return binOp(args, "==");
    case "!=":
    case "!==":
      return binOp(args, "!=");
    case "<":
    case ">":
    case "<=":
    case ">=":
      return binOp(args, op);
    case "in":
      return binOp(args, "in");
    case "and":
      return joinOp(args, "AND");
    case "or":
      return joinOp(args, "OR");
    case "!":
      return `NOT ${compactLogicLabel(unwrap(args))}`;
    case "!!":
      return `${compactLogicLabel(unwrap(args))}?`;
    case "missing":
      return `missing(${stringifyArr(args)})`;
    case "missing_some":
      return `missing_some(...)`;
    case "if":
      return `if(...)`;
    default:
      return clip(`${op}(${stringifyArr(args)})`);
  }
}

function varName(args: unknown): string {
  if (typeof args === "string") return shortenVar(args);
  if (Array.isArray(args) && typeof args[0] === "string") return shortenVar(args[0]);
  return "var";
}

function shortenVar(path: string): string {
  // state.foo.value → foo
  const m = path.match(/^state\.([a-z0-9_]+)\.value$/);
  return m ? m[1]! : path;
}

function binOp(args: unknown, op: string): string {
  if (!Array.isArray(args) || args.length < 2) return clip(`${op}(...)`);
  const a = compactLogicLabel(args[0]);
  const b = compactLogicLabel(args[1]);
  return clip(`${a} ${op} ${b}`);
}

function joinOp(args: unknown, sep: string): string {
  if (!Array.isArray(args) || args.length === 0) return sep;
  const parts = args.map((a) => compactLogicLabel(a));
  return clip(parts.join(` ${sep} `));
}

function unwrap(args: unknown): unknown {
  if (Array.isArray(args) && args.length === 1) return args[0];
  return args;
}

function stringifyArr(args: unknown): string {
  if (Array.isArray(args)) {
    return args.map((a) => (typeof a === "string" ? `"${a}"` : JSON.stringify(a))).join(", ");
  }
  return JSON.stringify(args);
}

function clip(s: string): string {
  return s.length > MAX_LEN ? s.slice(0, MAX_LEN - 1) + "…" : s;
}
