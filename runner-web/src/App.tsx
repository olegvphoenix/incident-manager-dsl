import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { RunnerView } from "./components/RunnerView";
import { HomeView } from "./components/HomeView";

// Документация, схема, mermaid и highlight.js — крупные. Грузятся только при переходе на вкладку.
const DocsView = lazy(() => import("./components/DocsView").then((m) => ({ default: m.DocsView })));
const SchemaView = lazy(() => import("./components/SchemaView").then((m) => ({ default: m.SchemaView })));

// Маршрутизация через URL hash (никакого роутера не нужно):
//   #home                                    — стартовая (по умолчанию)
//   #runner                                  — runner
//   #docs                                    — документация, дефолтный документ
//   #docs/dsl-v1-draft.md                    — конкретный документ
//   #docs/dsl-v1-draft.md#3-структура        — документ + якорь внутри
//   #schema                                  — обзор модели DSL
//   #schema/<nodeId>                         — конкретный узел схемы
//
// Всё в hash, чтобы при перезагрузке статика nginx не отдавала 404 на под-пути.

type Tab = "home" | "runner" | "docs" | "schema";

interface Location {
  tab: Tab;
  docId: string | null;
  anchor: string | null;
  schemaNodeId: string | null;
}

function parseLocation(): Location {
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw || raw === "home") return { tab: "home", docId: null, anchor: null, schemaNodeId: null };
  if (raw === "runner") return { tab: "runner", docId: null, anchor: null, schemaNodeId: null };
  if (raw === "docs") return { tab: "docs", docId: null, anchor: null, schemaNodeId: null };
  if (raw.startsWith("docs/")) {
    const rest = raw.slice("docs/".length);
    const idx = rest.indexOf("#");
    if (idx < 0) return { tab: "docs", docId: rest, anchor: null, schemaNodeId: null };
    return { tab: "docs", docId: rest.slice(0, idx), anchor: rest.slice(idx + 1), schemaNodeId: null };
  }
  if (raw === "schema") return { tab: "schema", docId: null, anchor: null, schemaNodeId: null };
  if (raw.startsWith("schema/")) {
    return { tab: "schema", docId: null, anchor: null, schemaNodeId: raw.slice("schema/".length) };
  }
  return { tab: "home", docId: null, anchor: null, schemaNodeId: null };
}

function buildHash(loc: Location): string {
  if (loc.tab === "home") return "home";
  if (loc.tab === "runner") return "runner";
  if (loc.tab === "schema") return loc.schemaNodeId ? `schema/${loc.schemaNodeId}` : "schema";
  let s = "docs";
  if (loc.docId) s += "/" + loc.docId;
  if (loc.anchor) s += "#" + loc.anchor;
  return s;
}

export default function App() {
  const [loc, setLoc] = useState<Location>(parseLocation);

  // Синхронизация с back/forward в браузере.
  useEffect(() => {
    const onPop = () => setLoc(parseLocation());
    window.addEventListener("hashchange", onPop);
    return () => window.removeEventListener("hashchange", onPop);
  }, []);

  // Обновление URL при смене состояния (без срабатывания hashchange-обработчика
  // если значение совпадает).
  const updateLocation = useCallback((next: Location) => {
    const target = "#" + buildHash(next);
    if (window.location.hash !== target) {
      window.history.replaceState(null, "", target);
    }
    setLoc(next);
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__brand">Incident Manager — DSL</div>
        <nav className="topbar__tabs">
          <button
            className={`topbar__tab ${loc.tab === "home" ? "topbar__tab--active" : ""}`}
            onClick={() => updateLocation({ tab: "home", docId: null, anchor: null, schemaNodeId: null })}
          >
            Главная
          </button>
          <button
            className={`topbar__tab ${loc.tab === "runner" ? "topbar__tab--active" : ""}`}
            onClick={() => updateLocation({ tab: "runner", docId: null, anchor: null, schemaNodeId: null })}
          >
            Runner
          </button>
          <button
            className={`topbar__tab ${loc.tab === "schema" ? "topbar__tab--active" : ""}`}
            onClick={() => updateLocation({ tab: "schema", docId: null, anchor: null, schemaNodeId: loc.schemaNodeId })}
          >
            Схема
          </button>
          <button
            className={`topbar__tab ${loc.tab === "docs" ? "topbar__tab--active" : ""}`}
            onClick={() => updateLocation({ tab: "docs", docId: loc.docId, anchor: loc.anchor, schemaNodeId: null })}
          >
            Документация
          </button>
        </nav>
        <div className="topbar__spacer" />
      </header>

      <div className="app__body">
        {loc.tab === "home" && (
          <HomeView
            onGo={(target, deepLink) => {
              if (target === "schema") {
                updateLocation({ tab: "schema", docId: null, anchor: null, schemaNodeId: deepLink ?? null });
              } else if (target === "docs") {
                updateLocation({ tab: "docs", docId: deepLink ?? null, anchor: null, schemaNodeId: null });
              } else {
                updateLocation({ tab: "runner", docId: null, anchor: null, schemaNodeId: null });
              }
            }}
          />
        )}
        {loc.tab === "runner" && <RunnerView />}
        {loc.tab === "schema" && (
          <Suspense fallback={<div className="docs-empty">Загружается схема…</div>}>
            <SchemaView
              initialNodeId={loc.schemaNodeId}
              onChangeLocation={(schemaNodeId) =>
                updateLocation({ tab: "schema", docId: null, anchor: null, schemaNodeId })
              }
            />
          </Suspense>
        )}
        {loc.tab === "docs" && (
          <Suspense fallback={<div className="docs-empty">Загружается документация…</div>}>
            <DocsView
              initialDocId={loc.docId}
              initialAnchor={loc.anchor}
              onChangeLocation={(docId, anchor) =>
                updateLocation({ tab: "docs", docId, anchor, schemaNodeId: null })
              }
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
