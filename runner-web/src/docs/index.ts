// Все .md-файлы из incident-manager-dsl/ (вне node_modules) подхватываются
// Vite'ом во время сборки как сырой текст. Файл добавлен — он сразу появляется
// в Документации без правки этого модуля.
//
// Группировка и человекочитаемые названия — единственное, что мы здесь
// поддерживаем вручную (метаданных в самих md нет).

const rawModules = import.meta.glob<string>(
  [
    "../../../*.md",
    "../../../examples/**/*.md",
    "../../README.md",
  ],
  { eager: true, query: "?raw", import: "default" },
);

export type DocCategory = "main" | "research" | "runner" | "examples";

export interface DocCategoryDescriptor {
  id: DocCategory;
  title: string;
  hint: string;
}

export const DOC_CATEGORIES: DocCategoryDescriptor[] = [
  { id: "main",      title: "Основное",     hint: "Точка входа и спецификация DSL" },
  { id: "research",  title: "Исследование", hint: "Анализ market'а и сервера, обоснование решений" },
  { id: "runner",    title: "Runner (демо)", hint: "Документация этого web-runner'а" },
  { id: "examples",  title: "Примеры сценариев", hint: "README в папках examples/" },
];

export interface DocEntry {
  id: string;                    // относительный путь от корня incident-manager-dsl/
  title: string;                 // человекочитаемый заголовок
  category: DocCategory;
  ord: number;                   // порядок внутри категории
  source: string;                // содержимое .md
  filePathInRepo: string;        // относительный путь, как для git
}

interface DocMeta {
  title: string;
  category: DocCategory;
  ord: number;
}

// Карта известных файлов: путь → метаданные.
// Если файл не в карте — попадёт в "main" с заголовком из имени файла.
const META: Record<string, DocMeta> = {
  "README.md":                            { title: "README — обзор пакета DSL", category: "main", ord: 1 },
  "dsl-v1-draft.md":                      { title: "DSL v1 — спецификация (draft)", category: "main", ord: 2 },
  "proposal-versioning.md":               { title: "Предложение по версионированию", category: "main", ord: 3 },
  "market-research.md":                   { title: "Market research — обзор рынка", category: "research", ord: 1 },
  "server-analysis.md":                   { title: "Анализ Go-сервера", category: "research", ord: 2 },
  "runner-web/README.md":                 { title: "Runner web — README", category: "runner", ord: 1 },
  "examples/README.md":                   { title: "Примеры — общий README", category: "examples", ord: 1 },
  "examples/architecture/README.md":      { title: "Архитектурные примеры — README", category: "examples", ord: 2 },
};

// Извлекаем "относительный от incident-manager-dsl/" путь из glob-пути.
function relPath(globPath: string): string {
  // glob отдаёт путь относительно текущего файла (src/docs/index.ts):
  //   ../../../README.md                           → README.md
  //   ../../../examples/architecture/README.md     → examples/architecture/README.md
  //   ../../README.md                              → runner-web/README.md (rule below)
  if (globPath.startsWith("../../README.md")) return "runner-web/README.md";
  const m = globPath.match(/\.\.\/\.\.\/\.\.\/(.+)$/);
  return m ? m[1]! : globPath;
}

// Запасной заголовок: первая H1 из текста, иначе имя файла.
function fallbackTitle(rel: string, source: string): string {
  const h1 = source.match(/^#\s+(.+)$/m);
  if (h1) return h1[1]!.trim();
  return rel;
}

export function loadAllDocs(): DocEntry[] {
  const entries: DocEntry[] = [];
  for (const [path, source] of Object.entries(rawModules)) {
    const rel = relPath(path);
    const meta = META[rel];
    entries.push({
      id: rel,
      title: meta?.title ?? fallbackTitle(rel, source),
      category: meta?.category ?? "main",
      ord: meta?.ord ?? 999,
      source,
      filePathInRepo: rel,
    });
  }
  // Стабильная сортировка: категория по порядку из DOC_CATEGORIES, потом ord, потом title.
  const catOrder = new Map(DOC_CATEGORIES.map((c, i) => [c.id, i]));
  entries.sort((a, b) => {
    const ca = catOrder.get(a.category) ?? 99;
    const cb = catOrder.get(b.category) ?? 99;
    if (ca !== cb) return ca - cb;
    if (a.ord !== b.ord) return a.ord - b.ord;
    return a.title.localeCompare(b.title, "ru");
  });
  return entries;
}

export function findDoc(docs: DocEntry[], id: string | null): DocEntry | null {
  if (!id) return null;
  return docs.find((d) => d.id === id) ?? null;
}
