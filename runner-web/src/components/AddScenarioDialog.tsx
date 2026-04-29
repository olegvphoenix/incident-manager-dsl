import { useState, useCallback, useRef } from "react";
import { validateScenarioJson, formatError } from "../engine/validateScenario";
import { addUserScenario } from "../scenarios/userScenarios";
import { useEscape } from "../hooks/useEscape";

interface Props {
  onClose: () => void;
  onAdded: (id: string) => void;
}

interface ProcessedFile {
  fileName: string;
  status: "ok" | "error";
  errors?: string[];
  addedAs?: string;       // финальный fileName после uniquify
}

export function AddScenarioDialog({ onClose, onAdded }: Props) {
  const [results, setResults] = useState<ProcessedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEscape(onClose);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".json"));
    if (arr.length === 0) {
      setResults([{ fileName: "(нет .json файлов)", status: "error", errors: ["Перетащите или выберите .json-файлы DSL-сценариев."] }]);
      return;
    }
    const out: ProcessedFile[] = [];
    let lastAddedId: string | null = null;
    for (const file of arr) {
      const text = await file.text();
      const result = validateScenarioJson(text);
      if (!result.ok) {
        out.push({
          fileName: file.name,
          status: "error",
          errors: result.errors.map(formatError).slice(0, 20),
        });
      } else {
        const item = addUserScenario(file.name, result.scenario);
        out.push({ fileName: file.name, status: "ok", addedAs: item.fileName });
        lastAddedId = "user/" + item.fileName;
      }
    }
    setResults(out);
    if (lastAddedId) onAdded(lastAddedId);
  }, [onAdded]);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer?.files) processFiles(e.dataTransfer.files);
  }, [processFiles]);

  return (
    <div className="dialog__backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <header className="dialog__header">
          <h2>Добавить сценарий</h2>
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
            Перетащите сюда .json-файлы или <strong>кликните, чтобы выбрать</strong>
          </p>
          <p className="drop-zone__hint">
            Можно сразу несколько. Каждый файл будет провалидирован по dsl-v1-schema.json;
            прошедшие валидацию добавятся в раздел «Мои сценарии».
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            multiple
            style={{ display: "none" }}
            onChange={(e) => { if (e.target.files) processFiles(e.target.files); e.target.value = ""; }}
          />
        </div>

        {results.length > 0 && (
          <div className="dialog__results">
            <h4>Результат</h4>
            <ul className="upload-results">
              {results.map((r, i) => (
                <li key={i} className={`upload-results__item upload-results__item--${r.status}`}>
                  <div className="upload-results__head">
                    <code>{r.fileName}</code>
                    <span className="upload-results__badge">
                      {r.status === "ok" ? "✓ добавлен" : "✗ отклонён"}
                    </span>
                  </div>
                  {r.status === "ok" && r.addedAs && r.addedAs !== r.fileName && (
                    <p className="upload-results__note">
                      сохранён как <code>{r.addedAs}</code> (имя было занято)
                    </p>
                  )}
                  {r.errors && r.errors.length > 0 && (
                    <ul className="upload-results__errors">
                      {r.errors.map((e, j) => <li key={j}><code>{e}</code></li>)}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <footer className="dialog__footer">
          <button className="btn btn--secondary" onClick={onClose}>Закрыть</button>
        </footer>
      </div>
    </div>
  );
}
