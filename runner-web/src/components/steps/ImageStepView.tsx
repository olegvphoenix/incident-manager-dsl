import { useRef, useState } from "react";
import type { Attachment, ImageStep, StepValue } from "../../types/dsl";
import type { SubmitFn } from "./StepRenderer";

interface Props { step: ImageStep; onSubmit: SubmitFn }

// Демо-runner: реальные камеры/карты не подключены, но для всех source
// разрешаем выбрать файл (визуальный фолбэк), чтобы было что положить
// в attachments. Источник (camera/map/operator/fixed) сохраняется
// в attachment.source — как это будет в реальной системе.
//
// Хранение строго по dsl-v1-draft.md §9: state[stepId].value = массив id,
// сами байты — в side-таблице scenarioResult.attachments[].

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB лимит на один файл

export function ImageStepView({ step, onSubmit }: Props) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const v = step.view;
  const allowMultiple = v.allowMultiple === true;
  const required = v.required === true;

  function reset() {
    setItems([]);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setError(null);

    const accepted: Attachment[] = [];
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        setError(
          `Файл "${file.name}" слишком большой (${formatSize(file.size)}). ` +
          `Максимум — ${formatSize(MAX_FILE_BYTES)}.`,
        );
        continue;
      }
      try {
        const att = await fileToAttachment(file, step.id, v.source);
        accepted.push(att);
      } catch (err) {
        setError(`Не удалось прочитать "${file.name}": ${(err as Error).message}`);
      }
    }

    setItems((prev) => allowMultiple ? [...prev, ...accepted] : accepted.slice(0, 1));

    if (inputRef.current) inputRef.current.value = "";
  }

  function removeOne(id: string) {
    setItems((prev) => prev.filter((a) => a.id !== id));
  }

  function submitNow() {
    const value: StepValue = items.map((a) => a.id);
    onSubmit(value, items);
  }

  const canSubmit = required ? items.length > 0 : true;

  return (
    <div className="step step--image">
      {v.label && <h3 className="step__title">{v.label}</h3>}

      <SourceHint source={v.source} cameraId={v.cameraId} fixedSrc={v.fixedSrc} />

      {items.length > 0 && (
        <ul className="image-attachments">
          {items.map((a) => (
            <li key={a.id} className="image-attachments__item">
              {a.dataBase64 && (
                <img
                  className="image-attachments__preview"
                  src={`data:${a.mime};base64,${a.dataBase64}`}
                  alt={a.fileName ?? a.id}
                />
              )}
              <div className="image-attachments__meta">
                <div className="image-attachments__name">{a.fileName ?? "(без имени)"}</div>
                <div className="image-attachments__sub">
                  {a.mime} · {formatSize(a.size)}
                </div>
                <code className="image-attachments__id">{a.id}</code>
              </div>
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => removeOne(a.id)}
                title="Удалить вложение"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="image-picker">
        <label className="btn btn--secondary">
          {items.length === 0
            ? (allowMultiple ? "Выбрать файлы…" : "Выбрать файл…")
            : (allowMultiple ? "Добавить ещё…" : "Заменить файл…")}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple={allowMultiple}
            onChange={onPick}
            style={{ display: "none" }}
          />
        </label>
        {items.length > 0 && (
          <button type="button" className="btn btn--ghost" onClick={reset}>
            Очистить
          </button>
        )}
      </div>

      {error && <div className="step__error">{error}</div>}

      <button
        type="button"
        className="btn btn--primary"
        disabled={!canSubmit}
        onClick={submitNow}
        title={!canSubmit ? "Прикрепите хотя бы один файл" : undefined}
      >
        Далее
      </button>
    </div>
  );
}

function SourceHint({
  source,
  cameraId,
  fixedSrc,
}: { source: ImageStep["view"]["source"]; cameraId?: string; fixedSrc?: string }) {
  switch (source) {
    case "camera":
      return (
        <div className="image-source-hint">
          📹 <strong>Источник:</strong> снимок с камеры{cameraId ? ` ${cameraId}` : ""}.
          В реальной системе runner запросит снимок у VMS;
          в демо — выберите файл, чтобы продемонстрировать формат result'а.
        </div>
      );
    case "map":
      return (
        <div className="image-source-hint">
          🗺️ <strong>Источник:</strong> скриншот карты в точке инцидента.
          В демо — выберите файл вручную.
        </div>
      );
    case "operator":
      return (
        <div className="image-source-hint">
          📎 <strong>Источник:</strong> загрузка оператором.
        </div>
      );
    case "fixed":
      return (
        <div className="image-source-hint">
          📌 <strong>Источник:</strong> предзагруженное эталонное изображение
          {fixedSrc ? <> (<code>{fixedSrc}</code>)</> : null}.
          В демо — можно «принять» эталон, выбрав файл-копию.
        </div>
      );
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function fileToAttachment(
  file: File,
  stepId: string,
  source: ImageStep["view"]["source"],
): Promise<Attachment> {
  const buf = await file.arrayBuffer();
  const dataBase64 = arrayBufferToBase64(buf);
  const sha256 = await sha256Hex(buf);
  return {
    id: makeId(),
    stepId,
    source,
    mime: file.type || guessMime(file.name),
    fileName: file.name,
    size: file.size,
    sha256,
    capturedAt: new Date().toISOString(),
    dataBase64,
  };
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `att-${crypto.randomUUID()}`;
  }
  return `att-${Math.random().toString(36).slice(2, 10)}`;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

async function sha256Hex(buf: ArrayBuffer): Promise<string | undefined> {
  if (typeof crypto === "undefined" || !crypto.subtle) return undefined;
  try {
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return undefined;
  }
}

function guessMime(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "png":  return "image/png";
    case "gif":  return "image/gif";
    case "webp": return "image/webp";
    case "bmp":  return "image/bmp";
    case "svg":  return "image/svg+xml";
    default:     return "application/octet-stream";
  }
}
