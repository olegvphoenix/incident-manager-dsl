// Чтение и запись пары файлов: сценарий (DSL) + sidecar layout.
//
// Стратегия:
//   - Если браузер поддерживает File System Access API (Chrome/Edge),
//     используем showOpenFilePicker / showSaveFilePicker — это даёт повторное
//     сохранение в тот же файл (через сохранённый FileSystemFileHandle).
//   - Иначе fallback: <input type=file> для open и blob+download для save.
//
// Layout-файл соседствует со сценарием по имени: scenario.json → scenario.layout.json.
// Поскольку File System Access API не позволяет автоматически прочитать
// сосед без directory-handle, мы открываем диалог в режиме `multiple: true`
// и просим выбрать сразу оба файла. Если пользователь выбрал только сценарий —
// layout остаётся null и редактор раскладывает граф автоматически (dagre).
//
// Для fallback-режима <input type=file multiple> работает так же.

import type { ScenarioScript } from "../types/dsl";
import type { ScenarioLayout } from "../types/layout";

declare global {
  interface Window {
    showOpenFilePicker?: (opts?: unknown) => Promise<FileSystemFileHandle[]>;
    showSaveFilePicker?: (opts?: unknown) => Promise<FileSystemFileHandle>;
  }
}

export const hasFsAccess =
  typeof window !== "undefined" &&
  typeof window.showOpenFilePicker === "function" &&
  typeof window.showSaveFilePicker === "function";

export interface OpenedScenario {
  scenario: ScenarioScript;
  layout: ScenarioLayout | null;
  // handle сценария — нужен для save без повторного диалога. null в fallback-режиме.
  handle: FileSystemFileHandle | null;
  layoutHandle: FileSystemFileHandle | null;
  // имя без .json — пригодится для fallback-сохранения
  baseName: string;
  // сырой текст файла на случай, если структура битая (для отображения ошибок)
  rawText: string;
}

const SCENARIO_PICKER_OPTS = {
  types: [
    {
      description: "Incident Manager scenario (DSL v1)",
      accept: { "application/json": [".json"] },
    },
  ],
  excludeAcceptAllOption: false,
  // Можно выбрать сразу пару: scenario.json + scenario.layout.json.
  multiple: true,
};

const LAYOUT_PICKER_OPTS = {
  types: [
    {
      description: "Incident Manager scenario layout",
      accept: { "application/json": [".layout.json", ".json"] },
    },
  ],
  multiple: false,
};

function stripJsonExt(name: string): string {
  return name.replace(/\.layout\.json$/i, "").replace(/\.json$/i, "");
}

// Внутренняя классификация выбранных файлов: один из них — сценарий (DSL),
// второй (если есть) — sidecar layout. Распознаём по имени (`*.layout.json`)
// и/или по содержимому (`layoutVersion` vs `dslVersion`).
type Classified = {
  scenario: { handle: FileSystemFileHandle | null; file: File; text: string } | null;
  layout: { handle: FileSystemFileHandle | null; file: File; text: string } | null;
};

async function classifyFiles(
  picks: Array<{ handle: FileSystemFileHandle | null; file: File }>,
): Promise<Classified> {
  const out: Classified = { scenario: null, layout: null };
  for (const p of picks) {
    const text = await p.file.text();
    const isLayoutByName = /\.layout\.json$/i.test(p.file.name);
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // битый JSON — отдадим как сценарий, чтобы вверху увидели loadError
    }
    const isLayoutByContent =
      typeof parsed === "object" &&
      parsed !== null &&
      "layoutVersion" in (parsed as Record<string, unknown>);
    if ((isLayoutByName || isLayoutByContent) && !out.layout) {
      out.layout = { handle: p.handle, file: p.file, text };
    } else if (!out.scenario) {
      out.scenario = { handle: p.handle, file: p.file, text };
    }
  }
  return out;
}

export async function openScenarioFile(): Promise<OpenedScenario | null> {
  if (hasFsAccess) {
    let handles: FileSystemFileHandle[];
    try {
      handles = await window.showOpenFilePicker!(SCENARIO_PICKER_OPTS);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return null;
      throw err;
    }
    const picks: Array<{ handle: FileSystemFileHandle | null; file: File }> = [];
    for (const h of handles) {
      picks.push({ handle: h, file: await h.getFile() });
    }
    const cls = await classifyFiles(picks);
    if (!cls.scenario) return null;
    return {
      scenario: JSON.parse(cls.scenario.text) as ScenarioScript,
      layout: cls.layout ? (JSON.parse(cls.layout.text) as ScenarioLayout) : null,
      handle: cls.scenario.handle,
      layoutHandle: cls.layout?.handle ?? null,
      baseName: stripJsonExt(cls.scenario.file.name),
      rawText: cls.scenario.text,
    };
  }
  return openViaInput();
}

function openViaInput(): Promise<OpenedScenario | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      if (files.length === 0) return resolve(null);
      const picks = files.map((f) => ({ handle: null as FileSystemFileHandle | null, file: f }));
      const cls = await classifyFiles(picks);
      if (!cls.scenario) return resolve(null);
      resolve({
        scenario: JSON.parse(cls.scenario.text) as ScenarioScript,
        layout: cls.layout ? (JSON.parse(cls.layout.text) as ScenarioLayout) : null,
        handle: null,
        layoutHandle: null,
        baseName: stripJsonExt(cls.scenario.file.name),
        rawText: cls.scenario.text,
      });
    };
    input.click();
  });
}

// Открыть layout-файл руками (для fallback-сценария).
export async function openLayoutFile(): Promise<{
  layout: ScenarioLayout;
  handle: FileSystemFileHandle | null;
} | null> {
  if (hasFsAccess) {
    try {
      const [handle] = await window.showOpenFilePicker!(LAYOUT_PICKER_OPTS);
      const file = await handle!.getFile();
      const text = await file.text();
      return { layout: JSON.parse(text) as ScenarioLayout, handle: handle! };
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return null;
      throw err;
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const text = await file.text();
      resolve({ layout: JSON.parse(text) as ScenarioLayout, handle: null });
    };
    input.click();
  });
}

export async function writeJsonViaHandle(
  handle: FileSystemFileHandle,
  data: unknown,
): Promise<void> {
  // FileSystemWritableFileStream входит в стандарт, но в TS-lib этого имени нет —
  // приводим через unknown.
  const writable = await (
    handle as unknown as {
      createWritable: () => Promise<{ write: (s: string) => Promise<void>; close: () => Promise<void> }>;
    }
  ).createWritable();
  await writable.write(JSON.stringify(data, null, 2) + "\n");
  await writable.close();
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2) + "\n"], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Создать новый handle через showSaveFilePicker (диалог "сохранить как").
export async function pickSaveHandle(suggestedName: string): Promise<FileSystemFileHandle | null> {
  if (!hasFsAccess) return null;
  try {
    return await window.showSaveFilePicker!({
      suggestedName,
      types: [
        {
          description: "JSON",
          accept: { "application/json": [".json"] },
        },
      ],
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return null;
    throw err;
  }
}
