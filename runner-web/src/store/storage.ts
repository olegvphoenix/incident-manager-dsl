import type { ResultEnvelope } from "../types/dsl";
import type { RunnerSnapshot } from "../engine/stateMachine";
import { buildEnvelope } from "../engine/envelope";

// Простейшее хранилище результатов в localStorage.
// Когда появится сервер, этот модуль заменится на HTTP-клиент,
// больше нигде ничего менять не придётся.

const KEY = "incident-manager-runner.results";

export function saveResult(snap: RunnerSnapshot, fileName?: string): void {
  const all = listResults();
  const item = buildEnvelope(snap, { fileName, includeSnapshot: false });
  all.push(item);
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch (err) {
    console.warn("[runner] cannot persist result to localStorage", err);
  }
}

export function listResults(): ResultEnvelope[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ResultEnvelope[];
  } catch {
    return [];
  }
}

export function clearResults(): void {
  localStorage.removeItem(KEY);
}
