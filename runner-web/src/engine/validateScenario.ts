import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schema from "../../../dsl-v1-schema.json";
import type { Scenario } from "../types/dsl";

// Один экземпляр ajv на всё приложение. Schema компилируется один раз.
const ajv = new Ajv2020({ allErrors: true, strict: false, allowUnionTypes: true });
addFormats(ajv);
const validateFn = ajv.compile(schema as object);

export interface ValidationOk { ok: true; scenario: Scenario }
export interface ValidationErr { ok: false; errors: ErrorObject[]; raw: unknown }
export type ValidationResult = ValidationOk | ValidationErr;

// Превращает ошибку Ajv в одну читаемую строку.
export function formatError(e: ErrorObject): string {
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

// Главная функция: парсит и валидирует.
export function validateScenarioJson(text: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      raw: text,
      errors: [{
        instancePath: "",
        schemaPath: "",
        keyword: "parse",
        params: {},
        message: `JSON parse error: ${msg}`,
      } as ErrorObject],
    };
  }
  const ok = validateFn(parsed);
  if (!ok) {
    return { ok: false, errors: validateFn.errors ?? [], raw: parsed };
  }
  return { ok: true, scenario: parsed as Scenario };
}
