import { useEffect, useMemo, useRef } from "react";
import type { Scenario, StepId } from "../types/dsl";

interface Props {
  scenario: Scenario;
  highlightStepId: StepId | null;
  fileName?: string;
}

export function DslJsonView({ scenario, highlightStepId, fileName }: Props) {
  const json = useMemo(() => JSON.stringify(scenario, null, 2), [scenario]);
  const preRef = useRef<HTMLPreElement | null>(null);
  const hlRef = useRef<HTMLElement | null>(null);

  // При смене подсвеченного шага — прокручиваем к нему.
  // Используем scroll контейнера-pre, а не window: контейнер скроллится сам.
  useEffect(() => {
    const hl = hlRef.current;
    const pre = preRef.current;
    if (!hl || !pre || !highlightStepId) return;
    const hlRect = hl.getBoundingClientRect();
    const preRect = pre.getBoundingClientRect();
    // Если подсветка уже видна целиком — ничего не делаем.
    const visible = hlRect.top >= preRect.top && hlRect.bottom <= preRect.bottom;
    if (visible) return;
    // Скроллим так, чтобы верх подсветки оказался в ~30px от верха pre.
    const targetTop = pre.scrollTop + (hlRect.top - preRect.top) - 30;
    pre.scrollTo({ top: targetTop, behavior: "smooth" });
  }, [highlightStepId, json]);

  function download() {
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const base = (fileName ?? scenario.metadata?.name ?? "scenario")
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, "_");
    a.download = base.endsWith(".json") ? base : `${base}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    try { await navigator.clipboard.writeText(json); }
    catch (e) { console.warn("clipboard failed", e); }
  }

  // Находим { ... } блок текущего шага и подсвечиваем его.
  // Алгоритм: ищем '"id": "<stepId>"', откатываемся к ближайшей '{' выше,
  // оттуда ищем парную '}' с балансом скобок.
  const segments = useMemo<Segment[]>(() => {
    if (!highlightStepId) return [{ kind: "plain", text: json }];
    const needle = `"id": "${highlightStepId}"`;
    const at = json.indexOf(needle);
    if (at < 0) return [{ kind: "plain", text: json }];
    const blockStart = findOpeningBrace(json, at);
    if (blockStart < 0) return [{ kind: "plain", text: json }];
    const blockEnd = findClosingBrace(json, blockStart);
    if (blockEnd < 0) return [{ kind: "plain", text: json }];
    return [
      { kind: "plain", text: json.slice(0, blockStart) },
      { kind: "highlight", text: json.slice(blockStart, blockEnd + 1) },
      { kind: "plain", text: json.slice(blockEnd + 1) },
    ];
  }, [json, highlightStepId]);

  return (
    <div className="dsl-view">
      <div className="dsl-view__header">
        <div className="dsl-view__title-row">
          <h3>DSL модель</h3>
          <div className="dsl-view__actions">
            <button className="btn-mini" onClick={copy} title="Копировать JSON в буфер обмена">⧉ Копировать</button>
            <button className="btn-mini btn-mini--primary" onClick={download} title="Скачать JSON-файл">↓ Скачать</button>
          </div>
        </div>
        {scenario.metadata?.name && (
          <span className="dsl-view__sub">{scenario.metadata.name}</span>
        )}
        {fileName && <span className="dsl-view__file"><code>{fileName}</code></span>}
        {highlightStepId && (
          <span className="dsl-view__hl-note">подсвечен текущий шаг: <code>{highlightStepId}</code></span>
        )}
      </div>
      <pre className="dsl-view__pre" ref={preRef}>
        {segments.map((s, i) =>
          s.kind === "highlight" ? (
            <mark key={i} className="dsl-view__hl" ref={hlRef}>{s.text}</mark>
          ) : (
            <span key={i}>{s.text}</span>
          ),
        )}
      </pre>
    </div>
  );
}

interface Segment { kind: "plain" | "highlight"; text: string }

function findOpeningBrace(s: string, fromIdx: number): number {
  // Идём назад от fromIdx, ищем '{' такой, что у которого глубина = 0
  // относительно содержимого после него до fromIdx.
  let depth = 0;
  for (let i = fromIdx; i >= 0; i--) {
    const ch = s[i];
    if (ch === "}") depth++;
    else if (ch === "{") {
      if (depth === 0) return i;
      depth--;
    }
  }
  return -1;
}

function findClosingBrace(s: string, openIdx: number): number {
  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = openIdx; i < s.length; i++) {
    const ch = s[i]!;
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inStr) { escape = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) return i; }
  }
  return -1;
}
