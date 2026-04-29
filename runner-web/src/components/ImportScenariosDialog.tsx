import { useCallback, useRef, useState } from "react";
import { importFiles, type ImportResult } from "../scenarios/portability";
import { useEscape } from "../hooks/useEscape";

interface Props {
  builtinGuids: ReadonlySet<string>;
  onClose: () => void;
  onImported: (lastAddedId: string | null) => void;
}

export function ImportScenariosDialog({ builtinGuids, onClose, onImported }: Props) {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEscape(onClose);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    setBusy(true);
    try {
      const arr = Array.from(files);
      const r = await importFiles(arr, builtinGuids);
      setResult(r);
      const last = r.added.length > 0 ? "user/" + r.added[r.added.length - 1]!.fileName : null;
      onImported(last);
    } finally {
      setBusy(false);
    }
  }, [builtinGuids, onImported]);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer?.files) processFiles(e.dataTransfer.files);
  }, [processFiles]);

  return (
    <div className="dialog__backdrop" onClick={onClose}>
      <div className="dialog dialog--wide" onClick={(e) => e.stopPropagation()}>
        <header className="dialog__header">
          <h2>Импорт сценариев</h2>
          <button className="btn-mini" onClick={onClose}>×</button>
        </header>

        <div
          className={`drop-zone ${dragActive ? "drop-zone--active" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <p className="drop-zone__primary">
            Перетащите ZIP-архив или несколько .json-файлов или{" "}
            <strong>кликните, чтобы выбрать</strong>
          </p>
          <p className="drop-zone__hint">
            ZIP — типично результат «⬇ Экспорт ZIP». Каждый сценарий валидируется по
            <code> dsl-v1-schema.json</code>. Дубликаты по <code>scenarioGuid</code> или имени
            файла пропускаются. Импорт всегда идёт в раздел <strong>«Мои сценарии»</strong>.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".json,.zip,application/json,application/zip"
            multiple
            style={{ display: "none" }}
            onChange={(e) => { if (e.target.files) processFiles(e.target.files); e.target.value = ""; }}
          />
        </div>

        {busy && <p className="dialog__busy">Распаковываю и валидирую…</p>}

        {result && (
          <div className="dialog__results">
            <h4>Результат</h4>
            <ul className="import-summary">
              <li><strong>{result.added.length}</strong> добавлено</li>
              <li><strong>{result.skipped.length}</strong> пропущено (дубликаты)</li>
              <li><strong>{result.invalid.length}</strong> отклонено (невалидно)</li>
            </ul>

            {result.added.length > 0 && (
              <details open>
                <summary>Добавлены ({result.added.length})</summary>
                <ul className="upload-results">
                  {result.added.map((a, i) => (
                    <li key={i} className="upload-results__item upload-results__item--ok">
                      <div className="upload-results__head">
                        <code>{a.fileName}</code>
                        <span className="upload-results__badge">✓ добавлен</span>
                      </div>
                      <p className="upload-results__note">
                        scenarioGuid: <code className="mono-break">{a.scenarioGuid}</code>
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {result.skipped.length > 0 && (
              <details>
                <summary>Пропущены ({result.skipped.length})</summary>
                <ul className="upload-results">
                  {result.skipped.map((s, i) => (
                    <li key={i} className="upload-results__item upload-results__item--skip">
                      <div className="upload-results__head">
                        <code>{s.fileName}</code>
                        <span className="upload-results__badge">⊘ пропущен</span>
                      </div>
                      <p className="upload-results__note">{s.reason}</p>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {result.invalid.length > 0 && (
              <details open>
                <summary>Не прошли валидацию ({result.invalid.length})</summary>
                <ul className="upload-results">
                  {result.invalid.map((v, i) => (
                    <li key={i} className="upload-results__item upload-results__item--error">
                      <div className="upload-results__head">
                        <code>{v.fileName}</code>
                        <span className="upload-results__badge">✗ отклонён</span>
                      </div>
                      <ul className="upload-results__errors">
                        {v.errors.slice(0, 20).map((e, j) => (
                          <li key={j}><code>{e}</code></li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        <footer className="dialog__footer">
          <button className="btn btn--secondary" onClick={onClose}>Закрыть</button>
        </footer>
      </div>
    </div>
  );
}
