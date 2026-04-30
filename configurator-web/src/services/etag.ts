// Лёгкий синхронный хеш для etag в layout-файле. Не криптография —
// используется только чтобы понять, что список step.id'ов изменился
// между сохранениями. Полный SHA-1 не нужен: дёшево, без зависимостей.
//
// Алгоритм: FNV-1a 32-bit поверх отсортированных id'ов. Возвращает hex-строку.

import type { Step } from "../types/dsl";

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function fnv1a(input: string): number {
  let hash = FNV_OFFSET;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // умножение по модулю 2^32 через Math.imul
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

export function computeStepsEtag(steps: Pick<Step, "id">[]): string {
  const sorted = steps.map((s) => s.id).sort();
  const joined = sorted.join("\u0001"); // разделитель, который не встретится в snake_case id
  return fnv1a(joined).toString(16).padStart(8, "0");
}
