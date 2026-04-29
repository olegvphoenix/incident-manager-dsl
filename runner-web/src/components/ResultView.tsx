import { useEffect, useMemo, useState } from "react";
import type { RunnerSnapshot } from "../engine/stateMachine";
import { buildEnvelope } from "../engine/envelope";
import { saveResult } from "../store/storage";

interface Props { snap: RunnerSnapshot; fileName?: string; onExit: () => void }

export function ResultView({ snap, fileName, onExit }: Props) {
  const [includeSnapshot, setIncludeSnapshot] = useState(true);

  const envelope = useMemo(
    () => buildEnvelope(snap, { fileName, includeSnapshot }),
    [snap, fileName, includeSnapshot],
  );
  const json = useMemo(() => JSON.stringify(envelope, null, 2), [envelope]);

  // Сохраняем в localStorage один раз (без снапшота шаблона — компактнее).
  useEffect(() => {
    saveResult(snap, fileName);
  }, [snap, fileName]);

  function download() {
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const base = (envelope.scenarioRef.fileName ?? envelope.scenarioRef.name ?? "scenario")
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, "_")
      .replace(/\.json$/i, "");
    a.download = `result_${base}_${snap.completedAt ?? "in-progress"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    try { await navigator.clipboard.writeText(json); }
    catch (e) { console.warn("clipboard failed", e); }
  }

  const ref = envelope.scenarioRef;

  return (
    <div className="result">
      <header className="result__header">
        <h2>Сценарий завершён</h2>
        <p className="result__meta">
          {ref.name ?? ref.fileName} · стартовал {snap.startedAt} · завершён {snap.completedAt}
        </p>
      </header>

      <div className="result__refs">
        <h4>Привязки к шаблону</h4>
        <dl>
          {ref.fileName && (<><dt>Файл</dt><dd><code>{ref.fileName}</code></dd></>)}
          <dt>dslVersion</dt><dd><code>{ref.dslVersion}</code></dd>
          {ref.scenarioGuid && (<><dt>scenarioGuid</dt><dd><code>{ref.scenarioGuid}</code></dd></>)}
          {ref.version !== undefined && (<><dt>version</dt><dd>{ref.version}</dd></>)}
        </dl>
        <p className="result__hint">
          В реальной системе результат лежит внутри <code>incidents.scenarioResult</code>,
          а инцидент уже привязан к сценарию через <code>incidents.scenarioId/version</code>.
          В demo-runner'е этой обвязки нет, поэтому экспорт оборачивается в самодостаточный
          envelope с теми же привязками.
        </p>
      </div>

      <div className="result__actions">
        <label className="result__toggle">
          <input
            type="checkbox"
            checked={includeSnapshot}
            onChange={(e) => setIncludeSnapshot(e.target.checked)}
          />
          Вложить полный snapshot шаблона (≈ {Math.round(JSON.stringify(snap.scenario).length / 1024)} KB)
        </label>
        <div className="row">
          <button className="btn btn--secondary" onClick={copy}>⧉ Копировать JSON</button>
          <button className="btn btn--primary" onClick={download}>↓ Скачать JSON</button>
          <button className="btn btn--secondary" onClick={onExit}>← К списку</button>
        </div>
      </div>

      {snap.attachments.length > 0 && (
        <div className="result__attachments">
          <h4>Прикреплённые вложения ({snap.attachments.length})</h4>
          <p className="result__hint">
            Сами байты лежат в <code>scenarioResult.attachments[]</code>;
            в <code>state[stepId].value</code> хранятся только id'ы (см. dsl-v1-draft.md §9).
          </p>
          <ul className="result-attachments">
            {snap.attachments.map((a) => (
              <li key={a.id} className="result-attachments__item">
                {a.dataBase64 && (
                  <img
                    className="result-attachments__preview"
                    src={`data:${a.mime};base64,${a.dataBase64}`}
                    alt={a.fileName ?? a.id}
                  />
                )}
                <div className="result-attachments__meta">
                  <div><strong>{a.fileName ?? "(без имени)"}</strong></div>
                  <div>
                    <span className="muted">stepId</span>{" "}
                    <code>{a.stepId}</code>
                    {" · "}
                    <span className="muted">source</span>{" "}
                    <code>{a.source}</code>
                  </div>
                  <div>
                    <span className="muted">mime</span> {a.mime}
                    {" · "}
                    <span className="muted">size</span> {formatBytes(a.size)}
                  </div>
                  <div>
                    <span className="muted">id</span>{" "}
                    <code className="mono-break">{a.id}</code>
                  </div>
                  {a.sha256 && (
                    <div>
                      <span className="muted">sha256</span>{" "}
                      <code className="mono-break">{a.sha256.slice(0, 16)}…</code>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details open>
        <summary>Полный envelope (JSON)</summary>
        <pre className="result__json">{json}</pre>
      </details>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
