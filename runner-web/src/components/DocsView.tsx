import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeHighlight from "rehype-highlight";
import { Splitter } from "./Splitter";

// highlight.js: грузим только те языки, что реально встречаются в наших md.
// Это сокращает bundle на ~600KB по сравнению с полным набором.
import json from "highlight.js/lib/languages/json";
import typescript from "highlight.js/lib/languages/typescript";
import javascript from "highlight.js/lib/languages/javascript";
import bash from "highlight.js/lib/languages/bash";
import sql from "highlight.js/lib/languages/sql";
import go from "highlight.js/lib/languages/go";
import yaml from "highlight.js/lib/languages/yaml";
import xml from "highlight.js/lib/languages/xml";
import "highlight.js/styles/github.css";

const HL_LANGUAGES = {
  json,
  jsonc: json,
  typescript,
  ts: typescript,
  javascript,
  js: javascript,
  bash,
  shell: bash,
  sh: bash,
  sql,
  go,
  yaml,
  yml: yaml,
  xml,
  html: xml,
};

import { loadAllDocs, findDoc, DOC_CATEGORIES, type DocEntry, type DocCategory } from "../docs";
import { extractToc } from "../docs/toc";
import { downloadBlob } from "../scenarios/portability";

interface Props {
  initialDocId?: string | null;
  initialAnchor?: string | null;
  onChangeLocation: (docId: string, anchor: string | null) => void;
}

const SIDEBAR_KEY = "incident-runner.docsSidebar";
const DEFAULT_SIDEBAR = 300;
const MIN_SIDEBAR = 180;
const MAX_SIDEBAR = 600;

function loadSidebarWidth(): number {
  try {
    const raw = localStorage.getItem(SIDEBAR_KEY);
    if (raw) {
      const v = Number(raw);
      if (Number.isFinite(v) && v >= MIN_SIDEBAR && v <= MAX_SIDEBAR) return v;
    }
  } catch { /* ignore */ }
  return DEFAULT_SIDEBAR;
}

export function DocsView({ initialDocId, initialAnchor, onChangeLocation }: Props) {
  const docs = useMemo(() => loadAllDocs(), []);
  const [docId, setDocId] = useState<string>(initialDocId ?? docs[0]?.id ?? "");
  const doc = findDoc(docs, docId);
  const toc = useMemo(() => (doc ? extractToc(doc.source) : []), [doc]);

  const contentRef = useRef<HTMLDivElement | null>(null);

  const [sidebar, setSidebar] = useState<number>(loadSidebarWidth);
  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, String(sidebar)); } catch { /* ignore */ }
  }, [sidebar]);

  // Режим сайдбара: "doc" — компактный заголовок документа + большой ToC,
  //                  "list" — полный список всех документов, без ToC.
  // По умолчанию открываемся в "doc", а после выбора документа — возвращаемся в "doc".
  const [sidebarMode, setSidebarMode] = useState<"doc" | "list">("doc");
  const pickDoc = (id: string) => {
    setDocId(id);
    setSidebarMode("doc");
  };

  const onResize = useCallback((dx: number) => {
    setSidebar((w) => Math.min(MAX_SIDEBAR, Math.max(MIN_SIDEBAR, w + dx)));
  }, []);

  const resetSidebar = useCallback(() => setSidebar(DEFAULT_SIDEBAR), []);

  // При смене документа — пробрасываем в URL и прокручиваем к якорю (если есть).
  useEffect(() => {
    onChangeLocation(docId, null);
  }, [docId]);  // eslint-disable-line react-hooks/exhaustive-deps

  // initialAnchor — прокручиваем после первого рендера выбранного документа.
  useEffect(() => {
    if (!initialAnchor || !contentRef.current) return;
    const t = setTimeout(() => {
      scrollToAnchor(contentRef.current, initialAnchor, "instant");
    }, 50);
    return () => clearTimeout(t);
  }, [initialAnchor, doc]);

  // Группируем документы по категориям.
  const byCategory = useMemo(() => {
    const map = new Map<DocCategory, DocEntry[]>();
    for (const cat of DOC_CATEGORIES) map.set(cat.id, []);
    for (const d of docs) map.get(d.category)?.push(d);
    return map;
  }, [docs]);

  // Перехват кликов по внутренним ссылкам: <a href="./market-research.md"> → переключение,
  // <a href="#section"> → прокрутка + обновление url.
  //
  // ⚠️ Важно: rehype-slug делает id из заголовков как есть (с кириллицей), но браузер,
  // когда строит DOM из <a href="#1-принципы-dsl">, percent-encode'ит непечатные ASCII-символы
  // в href. Поэтому getAttribute("href") вернёт "#1-%D0%BF%D1%80%D0%B8%D0%BD%D1%86%D0%B8%D0%BF%D1%8B-dsl",
  // и querySelector("#1-%D0%BF%...") ничего не найдёт. Декодируем перед поиском.
  const onContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const a = target.closest("a") as HTMLAnchorElement | null;
    if (!a) return;
    const rawHref = a.getAttribute("href") ?? "";
    const href = safeDecode(rawHref);

    if (href.startsWith("#")) {
      e.preventDefault();
      const anchor = href.slice(1);
      onChangeLocation(docId, anchor);
      scrollToAnchor(contentRef.current, anchor, "smooth");
      return;
    }
    // Относительная ссылка на другой md внутри пакета.
    if (/\.md(?:#|$)/.test(href) && !/^https?:/.test(href)) {
      e.preventDefault();
      const [path, anchor] = splitRef(href);
      const target = resolveDocId(docId, path);
      const candidate = docs.find((d) => d.id === target);
      if (candidate) {
        setDocId(candidate.id);
        if (anchor) {
          // Установим якорь в URL; effect выше прокрутит после рендера.
          setTimeout(() => onChangeLocation(candidate.id, anchor), 0);
        }
      }
    }
  };

  if (!doc) {
    return <div className="docs-empty">Документация не найдена.</div>;
  }

  return (
    <div className="docs">
      <aside
        className="docs__sidebar"
        style={{ flex: `0 0 ${sidebar}px`, width: sidebar }}
      >
        {sidebarMode === "list" ? (
          <>
            <div className="docs__sidebar-head">
              <h3 className="docs__sidebar-title">Документы</h3>
              <button
                className="btn-mini"
                onClick={() => setSidebarMode("doc")}
                title="Вернуться к оглавлению текущего документа"
              >
                ✕ Закрыть
              </button>
            </div>
            {DOC_CATEGORIES.map((cat) => {
              const items = byCategory.get(cat.id) ?? [];
              if (items.length === 0) return null;
              return (
                <div key={cat.id} className="docs__cat">
                  <div className="docs__cat-title">{cat.title}</div>
                  {items.map((d) => (
                    <button
                      key={d.id}
                      className={`docs__item ${d.id === docId ? "docs__item--active" : ""}`}
                      onClick={() => pickDoc(d.id)}
                      title={d.id}
                    >
                      <span className="docs__item-title">{d.title}</span>
                      <span className="docs__item-path">{d.id}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </>
        ) : (
          <>
            <button
              className="docs__current"
              onClick={() => setSidebarMode("list")}
              title="Показать список всех документов"
            >
              <span className="docs__current-back">← Все документы</span>
              <span className="docs__current-title">{doc.title}</span>
              <span className="docs__current-path">{doc.id}</span>
            </button>

            {toc.length > 0 ? (
              <div className="docs__toc">
                <div className="docs__cat-title">Оглавление</div>
                {toc.map((t, i) => (
                  <a
                    key={i}
                    href={`#${t.id}`}
                    className={`docs__toc-item docs__toc-item--d${t.depth}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onChangeLocation(docId, t.id);
                      scrollToAnchor(contentRef.current, t.id, "smooth");
                    }}
                  >
                    {t.text}
                  </a>
                ))}
              </div>
            ) : (
              <p className="docs__toc-empty">У документа нет заголовков для оглавления.</p>
            )}
          </>
        )}
      </aside>

      <Splitter onResize={onResize} onDoubleClick={resetSidebar} />

      <article className="docs__content" ref={contentRef} onClick={onContentClick}>
        <header className="docs__header">
          <div className="docs__header-text">
            <h1>{doc.title}</h1>
            <code className="docs__path">{doc.filePathInRepo}</code>
          </div>
          <DocActions doc={doc} />
        </header>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[
            rehypeSlug,
            [rehypeHighlight, { ignoreMissing: true, languages: HL_LANGUAGES, detect: false }],
          ]}
        >
          {doc.source}
        </ReactMarkdown>
      </article>
    </div>
  );
}

// Кнопки в шапке документа: скачать .md и скопировать markdown в буфер.
// Скачивание идёт через тот же downloadBlob, что и для DSL-сценариев.
// Имя файла берём из id (там уже относительный путь от incident-manager-dsl/),
// заменяя слэши на дефисы, чтобы файл сразу читался без подкаталогов.
function DocActions({ doc }: { doc: DocEntry }) {
  const [copied, setCopied] = useState(false);

  function download() {
    const blob = new Blob([doc.source], { type: "text/markdown;charset=utf-8" });
    const safeName = doc.id.replace(/[\\/]+/g, "-");
    downloadBlob(blob, safeName);
  }
  async function copy() {
    let ok = false;
    // Современный API. Доступен только в secure context (https / localhost).
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(doc.source);
        ok = true;
      } catch { /* fallthrough к execCommand */ }
    }
    // Fallback для http-окружения: невидимый textarea + execCommand("copy").
    // execCommand считается deprecated, но во всех браузерах ещё работает и
    // покрывает наш кейс с http-демо без TLS.
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = doc.source;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        ta.style.pointerEvents = "none";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch { /* совсем не получилось — пусть пользователь скачает .md */ }
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }
  return (
    <div className="docs__actions">
      <button className="btn-mini" onClick={copy} title="Скопировать markdown в буфер обмена">
        {copied ? "✓ Скопировано" : "⧉ Копировать"}
      </button>
      <button className="btn-mini btn-mini--primary" onClick={download} title="Скачать исходный .md файл">
        ↓ Скачать .md
      </button>
    </div>
  );
}

// Разбиваем "./other.md#anchor" на ["./other.md", "anchor"].
function splitRef(href: string): [string, string | null] {
  const i = href.indexOf("#");
  if (i < 0) return [href, null];
  return [href.slice(0, i), href.slice(i + 1)];
}

// Резолвим относительный путь "./other.md" / "../examples/README.md"
// относительно текущего документа в плоский id (как в DocEntry.id).
function resolveDocId(currentId: string, relative: string): string {
  const stack = currentId.split("/");
  stack.pop(); // убираем имя текущего файла
  for (const segment of relative.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") { stack.pop(); continue; }
    stack.push(segment);
  }
  return stack.join("/");
}

// decodeURIComponent кидает на невалидном % — глотаем эту ошибку и возвращаем как есть.
function safeDecode(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}

// Прокручивает .docs__content к элементу с заданным id.
// Используем getElementById вместо querySelector("#id"), потому что id с кириллицей
// или начинающиеся с цифры ломают CSS-селектор, даже после CSS.escape (на проблемных
// символах вроде кириллицы Safari/Chrome ведут себя по-разному).
// Скроллим именно сам контейнер, а не window — иначе на странице со sticky-топбаром
// scrollIntoView уведёт элемент под заголовок.
function scrollToAnchor(
  container: HTMLElement | null,
  id: string,
  behavior: "smooth" | "instant",
): boolean {
  if (!container) return false;
  const el = container.ownerDocument.getElementById(id);
  if (!el) return false;
  const cRect = container.getBoundingClientRect();
  const eRect = el.getBoundingClientRect();
  const top = container.scrollTop + (eRect.top - cRect.top) - 8;
  container.scrollTo({ top, behavior: behavior === "instant" ? "auto" : behavior });
  return true;
}
