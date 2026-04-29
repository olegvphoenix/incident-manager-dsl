import { useCallback, useEffect, useRef, useState } from "react";
import type { SchemaNode } from "../schema/parser";
import { schemaTree } from "../schema/parser";
import { overviewDiagramSource } from "../schema/overviewDiagram";
import { Splitter } from "./Splitter";

interface Props {
  initialNodeId: string | null;
  onChangeLocation: (nodeId: string | null) => void;
}

const DEFAULT_NODE_ID = "overview";

const SIDEBAR_KEY = "incident-runner.schemaSidebar";
const DEFAULT_SIDEBAR = 320;
const MIN_SIDEBAR = 200;
const MAX_SIDEBAR = 640;

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

export function SchemaView({ initialNodeId, onChangeLocation }: Props) {
  const [selectedId, setSelectedId] = useState<string>(initialNodeId ?? DEFAULT_NODE_ID);

  const [sidebar, setSidebar] = useState<number>(loadSidebarWidth);
  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, String(sidebar)); } catch { /* ignore */ }
  }, [sidebar]);

  const onResize = useCallback((dx: number) => {
    setSidebar((w) => Math.min(MAX_SIDEBAR, Math.max(MIN_SIDEBAR, w + dx)));
  }, []);

  const resetSidebar = useCallback(() => setSidebar(DEFAULT_SIDEBAR), []);

  useEffect(() => {
    if (initialNodeId && initialNodeId !== selectedId) {
      setSelectedId(initialNodeId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNodeId]);

  function pick(id: string) {
    setSelectedId(id);
    onChangeLocation(id === DEFAULT_NODE_ID ? null : id);
    requestAnimationFrame(() => {
      const main = document.querySelector(".schema__details");
      if (main) main.scrollTop = 0;
    });
  }

  const selected = schemaTree.byId[selectedId] ?? schemaTree.byId[DEFAULT_NODE_ID]!;

  return (
    <div className="schema">
      <aside
        className="schema__sidebar"
        style={{ flex: `0 0 ${sidebar}px`, width: sidebar }}
      >
        <div className="schema__sidebar-head">
          <h3>Модель DSL v1</h3>
          <p className="schema__sidebar-hint">
            Все 26 определений из <code>dsl-v1-schema.json</code> + runtime-структуры (<code>scenarioResult</code>) в одной навигации.
          </p>
        </div>
        <SchemaTree
          node={schemaTree.root}
          selectedId={selectedId}
          onPick={pick}
          isRoot
        />
      </aside>

      <Splitter
        onResize={onResize}
        onDoubleClick={resetSidebar}
        title="Перетащите, чтобы изменить ширину дерева. Двойной клик — сбросить."
      />

      <main className="schema__details">
        {selectedId === "overview"
          ? <OverviewPanel onPick={pick} />
          : <NodeDetailsPanel node={selected} onPick={pick} />}
      </main>
    </div>
  );
}

// ── tree ──────────────────────────────────────────────────────────────────────

function SchemaTree({
  node, selectedId, onPick, isRoot,
}: {
  node: SchemaNode;
  selectedId: string;
  onPick: (id: string) => void;
  isRoot?: boolean;
}) {
  const hasChildren = !!(node.children && node.children.length > 0);
  const [open, setOpen] = useState<boolean>(true);

  return (
    <div className={`schema-tree ${isRoot ? "schema-tree--root" : ""}`}>
      <div className="schema-tree__row">
        {hasChildren && (
          <button
            className="schema-tree__toggle"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Свернуть" : "Развернуть"}
          >
            {open ? "▾" : "▸"}
          </button>
        )}
        <button
          className={`schema-tree__node ${selectedId === node.id ? "schema-tree__node--active" : ""} schema-tree__node--${node.kind}`}
          onClick={() => onPick(node.id)}
          title={node.shortDescription}
        >
          {node.title}
        </button>
      </div>
      {hasChildren && open && (
        <div className="schema-tree__children">
          {node.children!.map((c) => (
            <SchemaTree key={c.id} node={c} selectedId={selectedId} onPick={onPick} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── overview panel (Mermaid diagram) ─────────────────────────────────────────

function OverviewPanel({ onPick }: { onPick: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "default",
          securityLevel: "loose",
          flowchart: { curve: "basis", htmlLabels: true, padding: 12 },
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        });

        const id = "schema-overview-" + Math.random().toString(36).slice(2, 8);
        const { svg, bindFunctions } = await mermaid.render(id, overviewDiagramSource);
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = svg;
        bindFunctions?.(ref.current);

        // Перехватим клики по mermaid-узлам, у которых заданы click "#schema/<id>".
        ref.current.querySelectorAll<HTMLAnchorElement>("a[href^='#schema/']").forEach((a) => {
          a.addEventListener("click", (e) => {
            e.preventDefault();
            const nodeId = a.getAttribute("href")!.slice("#schema/".length);
            onPick(nodeId);
          });
        });
      } catch (err) {
        console.error("[schema] mermaid render failed", err);
        if (!cancelled) setError((err as Error).message);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="schema-overview">
      <header className="schema-overview__head">
        <h2>Целостная модель DSL v1 — обзор</h2>
        <p>
          Слева — то, что описывает <strong>дизайн-тайм</strong> (валидируется по
          <code>dsl-v1-schema.json</code>). Справа — <strong>runtime-структуры</strong>,
          которые строит runner при прохождении сценария оператором (НЕ часть DSL).
          Кликните по любому узлу диаграммы или в дереве слева — увидите детали и пример.
        </p>
      </header>
      {error
        ? <div className="schema-overview__error">Не удалось отрендерить диаграмму: {error}</div>
        : <div ref={ref} className="schema-overview__canvas" />}
      <details className="schema-overview__source">
        <summary>Исходник Mermaid (для копирования в презентацию)</summary>
        <pre>{overviewDiagramSource}</pre>
      </details>
    </div>
  );
}

// ── node details panel ───────────────────────────────────────────────────────

function NodeDetailsPanel({
  node, onPick,
}: { node: SchemaNode; onPick: (id: string) => void }) {
  return (
    <article className="schema-node">
      <header className="schema-node__head">
        <div className="schema-node__breadcrumb">
          <button className="link" onClick={() => onPick("overview")}>← к обзору</button>
        </div>
        <h2>{node.title}</h2>
        {node.shortDescription && (
          <p className="schema-node__short">{node.shortDescription}</p>
        )}
        <dl className="schema-node__meta">
          <dt>JSON Schema путь</dt>
          <dd><code className="mono-break">{node.schemaPath}</code></dd>
          {node.defName && (
            <>
              <dt>$defs</dt>
              <dd><code>{node.defName}</code></dd>
            </>
          )}
          <dt>Тип узла</dt>
          <dd>{kindLabel(node.kind)}</dd>
        </dl>
      </header>

      {node.description && node.description !== node.shortDescription && (
        <section className="schema-node__section">
          <h3>Описание</h3>
          <p className="schema-node__desc">{node.description}</p>
        </section>
      )}

      {node.legacyMapping && (
        <section className="schema-node__section">
          <h3>Соответствие легаси (IM/)</h3>
          <p className="schema-node__legacy">{node.legacyMapping}</p>
        </section>
      )}

      {node.fields && node.fields.length > 0 && (
        <section className="schema-node__section">
          <h3>Поля</h3>
          <table className="schema-fields">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Тип</th>
                <th>Обяз.</th>
                <th>Описание</th>
              </tr>
            </thead>
            <tbody>
              {node.fields.map((f) => (
                <tr key={f.name}>
                  <td><code>{f.name}</code></td>
                  <td>
                    {f.refTo
                      ? <button className="link link--type" onClick={() => onPick(f.refTo!)}>{f.type}</button>
                      : <code className="schema-fields__type">{f.type}</code>}
                    {f.pattern && <div className="muted">pattern: <code>{f.pattern}</code></div>}
                    {f.defaultValue !== undefined && <div className="muted">default: <code>{JSON.stringify(f.defaultValue)}</code></div>}
                  </td>
                  <td>{f.required ? <span className="badge badge--required">required</span> : <span className="muted">opt</span>}</td>
                  <td className="schema-fields__desc">{f.description ?? <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {node.variants && node.variants.length > 0 && (
        <section className="schema-node__section">
          <h3>Варианты ({node.variants.length})</h3>
          <ul className="schema-variants">
            {node.variants.map((v) => (
              <li key={v.id}>
                <button className="link" onClick={() => onPick(v.id)}>{v.title}</button>
                {v.shortDescription && <span className="muted"> — {v.shortDescription}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {node.exampleSnippet && (
        <section className="schema-node__section">
          <h3>Минимальный пример</h3>
          <pre className="schema-node__example">{node.exampleSnippet}</pre>
        </section>
      )}

      <ValidationMatrix node={node} />
    </article>
  );
}

// «Что валидируется и где» — короткая матрица для каждого узла.
// На v1 это статика; в будущем можно вычислять из самой схемы (oneOf/required/...).
function ValidationMatrix({ node }: { node: SchemaNode }) {
  const rows: Array<{ what: string; where: string }> = [];
  if (node.kind === "object" || node.kind === "root") {
    rows.push({ what: "Обязательные поля", where: "JSON Schema (ajv) — на этапе сохранения сценария" });
    rows.push({ what: "Типы значений", where: "JSON Schema (ajv)" });
  }
  if (node.id.startsWith("step:")) {
    rows.push({ what: "Уникальность Step.id внутри сценария", where: "Сервер при сохранении (custom-валидация поверх ajv)" });
    rows.push({ what: "goto указывает на существующий Step.id", where: "Сервер при сохранении" });
  }
  if (node.id === "transitions" || node.id === "transitions:rule") {
    rows.push({ what: "JSONLogic — whitelist операторов", where: "Сервер (см. spec §7) — на этапе сохранения" });
  }
  if (node.id.startsWith("step:CallScenario")) {
    rows.push({ what: "Существование вызываемого scenarioGuid+version", where: "Сервер при создании Incident'а (inline-resolve)" });
    rows.push({ what: "Отсутствие циклов в графе вызовов", where: "Сервер при сохранении и при создании Incident'а" });
  }
  if (node.id === "metadata") {
    rows.push({ what: "scenarioGuid — UUID, не меняется в течение жизни", where: "JSON Schema формат + сервер на UPDATE" });
    rows.push({ what: "version — целое >= 1, монотонно растёт", where: "Сервер при публикации новой версии" });
  }
  if (node.id.startsWith("result")) {
    rows.push({ what: "Append-only history", where: "Runner: API не даёт удалить запись" });
    rows.push({ what: "attachments[].id ↔ state.value", where: "Runner при submit Image-шага" });
  }

  if (rows.length === 0) return null;
  return (
    <section className="schema-node__section">
      <h3>Что валидируется и где</h3>
      <table className="schema-validation">
        <thead><tr><th>Что</th><th>Где</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (<tr key={i}><td>{r.what}</td><td>{r.where}</td></tr>))}
        </tbody>
      </table>
    </section>
  );
}

function kindLabel(k: SchemaNode["kind"]): string {
  switch (k) {
    case "root":      return "корневой объект";
    case "object":    return "объект";
    case "union":     return "дискриминированное объединение (oneOf)";
    case "primitive": return "примитив (строка/число/логика)";
    case "ref":       return "ссылка ($ref)";
    case "section":   return "сводный раздел";
  }
}
