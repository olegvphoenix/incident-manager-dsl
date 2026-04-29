import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { loadAllScenarios, type ScenarioEntry } from "../scenarios";
import { loadUserScenarios, removeUserScenario, subscribeUserScenarios, isUserScenarioId, userFileNameFromId } from "../scenarios/userScenarios";
import { ScenarioTree } from "./ScenarioTree";
import { ScenarioRunner } from "./ScenarioRunner";
import { DslJsonView } from "./DslJsonView";
import { ResultView } from "./ResultView";
import { Splitter } from "./Splitter";
import { AddScenarioDialog } from "./AddScenarioDialog";
import { ImportScenariosDialog } from "./ImportScenariosDialog";
import { exportScenariosZip, downloadBlob } from "../scenarios/portability";
import type { RunnerSnapshot } from "../engine/stateMachine";
import { startScenario, submitStep, findStep } from "../engine/stateMachine";
import type { Attachment, StepValue } from "../types/dsl";

type Mode =
  | { kind: "idle" }
  | { kind: "running"; snap: RunnerSnapshot }
  | { kind: "finished"; snap: RunnerSnapshot };

const COLS_KEY = "incident-runner.cols";
const DEFAULT_LEFT = 320;
const DEFAULT_RIGHT = 460;
const MIN_COL = 200;

function loadCols(): { left: number; right: number } {
  try {
    const raw = localStorage.getItem(COLS_KEY);
    if (raw) {
      const v = JSON.parse(raw);
      if (typeof v.left === "number" && typeof v.right === "number") return v;
    }
  } catch { /* ignore */ }
  return { left: DEFAULT_LEFT, right: DEFAULT_RIGHT };
}

export function RunnerView() {
  const exampleScenarios = useMemo(() => loadAllScenarios(), []);
  const userScenarios = useSyncExternalStore(
    subscribeUserScenarios,
    () => loadUserScenarios(),
    () => [],
  );
  const scenarios = useMemo(
    () => [...userScenarios, ...exampleScenarios],
    [userScenarios, exampleScenarios],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => scenarios.find((s) => s.id === selectedId) ?? null,
    [scenarios, selectedId],
  );
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [cols, setCols] = useState(loadCols);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // GUID'ы встроенных примеров — нужны для дедупликации при импорте, чтобы
  // нельзя было «переопределить» поведение примера через user-копию.
  const builtinGuids = useMemo(
    () => new Set(exampleScenarios.map((e) => e.scenario.metadata.scenarioGuid)),
    [exampleScenarios],
  );

  function handleExportAll() {
    const { blob, fileName } = exportScenariosZip(exampleScenarios, userScenarios);
    downloadBlob(blob, fileName);
  }

  useEffect(() => {
    try { localStorage.setItem(COLS_KEY, JSON.stringify(cols)); } catch { /* ignore */ }
  }, [cols]);

  const clampLeft = useCallback((dx: number) => {
    setCols((c) => {
      const maxLeft = Math.max(MIN_COL, window.innerWidth - c.right - MIN_COL - 40);
      const next = Math.min(maxLeft, Math.max(MIN_COL, c.left + dx));
      return { ...c, left: next };
    });
  }, []);
  const clampRight = useCallback((dx: number) => {
    setCols((c) => {
      const maxRight = Math.max(MIN_COL, window.innerWidth - c.left - MIN_COL - 40);
      const next = Math.min(maxRight, Math.max(MIN_COL, c.right - dx));
      return { ...c, right: next };
    });
  }, []);
  const resetCols = useCallback(() => {
    setCols({ left: DEFAULT_LEFT, right: DEFAULT_RIGHT });
  }, []);

  function pick(entry: ScenarioEntry) {
    setSelectedId(entry.id);
    setMode({ kind: "idle" });
  }

  function deleteSelectedUser() {
    if (!selected) return;
    const fn = userFileNameFromId(selected.id);
    if (!fn) return;
    if (!confirm(`Удалить пользовательский сценарий "${fn}"?`)) return;
    removeUserScenario(fn);
    setSelectedId(null);
    setMode({ kind: "idle" });
  }

  function run() {
    if (!selected || !selected.isRunnable) return;
    setMode({ kind: "running", snap: startScenario(selected.scenario) });
  }

  function submit(value: StepValue, attachments?: Attachment[]) {
    if (mode.kind !== "running" || !mode.snap.currentStepId) return;
    const next = submitStep(mode.snap, mode.snap.currentStepId, value, attachments);
    setMode(next.currentStepId === null
      ? { kind: "finished", snap: next }
      : { kind: "running", snap: next });
  }

  function exit() {
    setMode({ kind: "idle" });
  }

  const highlightStepId =
    mode.kind === "running" ? mode.snap.currentStepId :
    mode.kind === "finished" ? null :
    null;

  const jsonScenario =
    mode.kind === "running" || mode.kind === "finished"
      ? mode.snap.scenario
      : selected?.scenario ?? null;
  const jsonFileName = selected?.id ?? null;

  const currentStep =
    mode.kind === "running" && mode.snap.currentStepId
      ? findStep(mode.snap.scenario, mode.snap.currentStepId)
      : null;

  return (
    <div className="layout">
      <aside
        className="layout__left"
        style={{ flex: `0 0 ${cols.left}px`, width: cols.left }}
      >
        <ScenarioTree
          scenarios={scenarios}
          selectedId={selected?.id ?? null}
          runningId={mode.kind === "running" ? selected?.id ?? null : null}
          onSelect={pick}
          onAddScenario={() => setAddOpen(true)}
          onImport={() => setImportOpen(true)}
          onExportAll={handleExportAll}
        />
      </aside>

      <Splitter onResize={clampLeft} onDoubleClick={resetCols} />

      <main className="layout__center">
        {mode.kind === "running" && currentStep && (
          <ScenarioRunner
            scenario={mode.snap.scenario}
            snap={mode.snap}
            currentStep={currentStep}
            onSubmit={submit}
            onExit={exit}
          />
        )}
        {mode.kind === "finished" && (
          <ResultView snap={mode.snap} fileName={selected?.id} onExit={exit} />
        )}
        {mode.kind === "idle" && (
          <IdleCenter
            selected={selected}
            onRun={run}
            onResetCols={resetCols}
            onAddScenario={() => setAddOpen(true)}
            onDeleteUser={isUserScenarioId(selected?.id ?? "") ? deleteSelectedUser : undefined}
          />
        )}
      </main>

      <Splitter onResize={clampRight} onDoubleClick={resetCols} />

      {addOpen && (
        <AddScenarioDialog
          onClose={() => setAddOpen(false)}
          onAdded={(id) => { setSelectedId(id); }}
        />
      )}

      {importOpen && (
        <ImportScenariosDialog
          builtinGuids={builtinGuids}
          onClose={() => setImportOpen(false)}
          onImported={(id) => { if (id) setSelectedId(id); }}
        />
      )}

      <aside
        className="layout__right"
        style={{ flex: `0 0 ${cols.right}px`, width: cols.right }}
      >
        {jsonScenario ? (
          <DslJsonView
            scenario={jsonScenario}
            highlightStepId={highlightStepId}
            fileName={jsonFileName ?? undefined}
          />
        ) : (
          <div className="dsl-view dsl-view--empty">
            <p>Выберите сценарий слева, чтобы увидеть его DSL JSON.</p>
          </div>
        )}
      </aside>
    </div>
  );
}

function IdleCenter({
  selected,
  onRun,
  onResetCols,
  onAddScenario,
  onDeleteUser,
}: {
  selected: ScenarioEntry | null;
  onRun: () => void;
  onResetCols: () => void;
  onAddScenario: () => void;
  onDeleteUser?: () => void;
}) {
  if (!selected) {
    return (
      <div className="welcome">
        <h1>Incident Manager — DSL Runner</h1>
        <p>
          Слева — все сценарии, сгруппированные по ролям. Кликните по любому
          сценарию: справа появится его декларативная JSON-модель.
        </p>
        <p>
          Нажмите <strong>▶ Запустить</strong>, чтобы пройти сценарий — runner
          интерпретирует JSON и рендерит шаги в реальном времени; в правой
          панели подсвечивается тот блок DSL, который сейчас показан в центре.
        </p>
        <p>
          Можно загрузить свой сценарий из .json-файла —{" "}
          <button className="btn-mini btn-mini--primary" onClick={onAddScenario}>+ Добавить сценарий</button>.
          Файл проверяется по <code>dsl-v1-schema.json</code> (ajv) и сохраняется в localStorage.
        </p>
        <p>
          Границы между колонками можно перетаскивать — вертикальные полоски
          между ними. Размеры запоминаются.{" "}
          <button className="btn-mini" onClick={onResetCols}>сбросить ширину колонок</button>
        </p>
        <p className="welcome__note">
          Сценарии с типом <code>CallScenario</code> в этой демо не запускаются —
          для них нужен серверный inline-резолв (см. <code>dsl-v1-draft.md</code> §6.8).
        </p>
      </div>
    );
  }

  const meta = selected.scenario.metadata;
  return (
    <div className="welcome">
      <h2>{meta.name}</h2>
      {meta.description && <p>{meta.description}</p>}
      <dl className="welcome__meta">
        <dt>Файл</dt><dd><code>{selected.id}</code></dd>
        <dt>scenarioGuid</dt><dd><code className="mono-break">{meta.scenarioGuid}</code></dd>
        <dt>version</dt><dd>{meta.version}</dd>
        <dt>Шагов</dt><dd>{selected.scenario.steps.length}</dd>
        <dt>Стартовый шаг</dt><dd><code>{selected.scenario.initialStepId}</code></dd>
      </dl>
      <div className="welcome__actions">
        {selected.isRunnable ? (
          <button className="btn btn--primary" onClick={onRun}>▶ Запустить</button>
        ) : selected.reasonNotRunnable === "call-scenario" ? (
          <CallScenarioBlocked />
        ) : (
          <div className="welcome__blocked">
            <strong>Не запускается:</strong> {selected.reasonNotRunnable}
          </div>
        )}
        {onDeleteUser && (
          <button className="btn btn--danger" onClick={onDeleteUser}>
            🗑 Удалить из «Моих сценариев»
          </button>
        )}
      </div>
    </div>
  );
}

// Объяснение «почему этот сценарий нельзя запустить здесь, даже если на сервере
// inline-резолв уже работает».
function CallScenarioBlocked() {
  return (
    <div className="welcome__blocked welcome__blocked--explain">
      <p>
        <strong>Сценарий не запускается в этом runner-демо.</strong>
      </p>
      <p>
        Он содержит шаги типа <code>CallScenario</code> — это «ссылка» на другой
        библиотечный сценарий. По принципу <strong>П9</strong> runner не должен
        ничего знать про вложенность: сервер обязан развернуть (inline) все
        под-сценарии в плоский граф <em>до</em> отдачи runner&apos;у.
      </p>
      <p className="welcome__blocked-note">
        Этот web-runner — статический демо-стенд (nginx без backend), он не
        ходит ни в какой Go-сервер, поэтому inline-резолв здесь не делается
        специально, чтобы не нарушать П9. Даже если у вас на бэкенде inline уже
        реализован, это никак не влияет на этот UI.
      </p>
      <details className="welcome__blocked-howto">
        <summary>Как тогда увидеть результат inline-резолва?</summary>
        <ul>
          <li>
            Откройте пример{" "}
            <code>examples/architecture/A3-inline-before-after/3-parent-after-inline-resolve.json</code>
            {" "}— это тот же сценарий <em>после</em> inline-резолва. Запускается.
          </li>
          <li>
            Чтобы протестировать ваш Go-сервер вживую — позовите его endpoint
            (например <code>POST /scenarios/:guid/resolve</code>), сохраните
            ответ как <code>.json</code> и загрузите через{" "}
            <strong>+ Добавить</strong> или <strong>⬆ Импорт</strong> — он
            попадёт в «Мои сценарии» и будет запускаться.
          </li>
          <li>
            Подробности — <code>dsl-v1-draft.md</code> §6.8 «CallScenario» и
            принцип П9 в §1.
          </li>
        </ul>
      </details>
    </div>
  );
}
