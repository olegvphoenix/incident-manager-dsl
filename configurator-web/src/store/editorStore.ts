// Главный store редактора. Zustand + zundo (undo/redo).
//
// Архитектурный принцип: единый источник правды для семантики — `scenario`
// (формат DSL v1). Layout — отдельная структура `layout` (sidecar). UI-состояние
// (выделение, view, dirty, диагностика) — `ui`. zundo трекает только
// семантические изменения; ui-only изменения (setView/setSelected/setDiagnostics)
// в историю не попадают.
//
// Семантические правки идут через ChainedAction:
//   1) ScenarioBundle = { scenario, layout } прогоняется через mutator (immer);
//   2) result заменяет state.scenario / state.layout;
//   3) запускается validate() → ui.diagnostics;
//   4) пересчитывается layout.etag и ui.dirty.

import { create } from "zustand";
import { temporal, type TemporalState } from "zundo";
import { useStore } from "zustand";

import type {
  Action,
  Rule,
  ScenarioMetadata,
  ScenarioScript,
  Step,
  StepId,
  StepType,
} from "../types/dsl";
import type { NodeLayout, ScenarioLayout } from "../types/layout";
import { EMPTY_LAYOUT } from "../types/layout";
import { computeStepsEtag } from "../services/etag";
import { validate, type Diagnostic } from "../services/validation";
import { autoLayoutScenario } from "../adapters/autoLayout";
import * as A from "./actions";
import type { ScenarioBundle } from "./actions";

export type ViewMode = "flow" | "table";

export interface UiState {
  view: ViewMode;
  selectedStepId: StepId | null;
  selectedRuleIndex: number | "default" | null;
  // Выделенное в Flow ребро (id из toFlow). Хранится отдельно от
  // selectedStepId, потому что ReactFlow различает выделение нод и edges.
  selectedEdgeId: string | null;
  // Раскрыта ли нижняя панель диагностики.
  diagnosticsPanelOpen: boolean;
  // Открыт ли drawer live-preview (мини-runner справа от инспектора).
  livePreviewOpen: boolean;
  dirty: boolean;
  baseName: string | null;
  diagnostics: Diagnostic[];
  loadError: string | null;
  // информационное сообщение при загрузке (etag mismatch и т.п.) —
  // не ошибка, можно скрыть после знакомства
  loadInfo: string | null;
}

export interface EditorState {
  scenario: ScenarioScript | null;
  layout: ScenarioLayout | null;
  scenarioHandle: FileSystemFileHandle | null;
  layoutHandle: FileSystemFileHandle | null;
  ui: UiState;

  // ===== ui-only (без истории) =====
  setView: (v: ViewMode) => void;
  setSelected: (stepId: StepId | null, ruleIndex?: number | "default" | null) => void;
  setSelectedEdge: (edgeId: string | null) => void;
  setDiagnosticsPanelOpen: (open: boolean) => void;
  setLivePreviewOpen: (open: boolean) => void;
  setDiagnostics: (d: Diagnostic[]) => void;
  setLoadError: (msg: string | null) => void;
  setLoadInfo: (msg: string | null) => void;
  markClean: () => void;

  // ===== load (тоже трекаем, чтобы undo возвращал на исходник) =====
  loadScenario: (
    scenario: ScenarioScript,
    layout: ScenarioLayout | null,
    opts?: {
      scenarioHandle?: FileSystemFileHandle | null;
      layoutHandle?: FileSystemFileHandle | null;
      baseName?: string | null;
    },
  ) => void;

  setScenarioHandle: (h: FileSystemFileHandle | null) => void;
  setLayoutHandle: (h: FileSystemFileHandle | null) => void;
  setBaseName: (name: string | null) => void;

  // ===== layout-level =====
  applyAutoLayout: (preserveExisting?: boolean) => void;
  setNodePosition: (stepId: StepId, pos: { x: number; y: number }) => void;
  setViewport: (vp: { x: number; y: number; zoom: number }) => void;

  // ===== scenario-level (с историей) =====
  patchMetadata: (patch: Partial<ScenarioMetadata>) => void;
  bumpVersion: () => void;
  setTimers: (timers: ScenarioScript["timers"] | null) => void;
  setConcurrency: (c: ScenarioScript["concurrency"] | null) => void;
  setInitialStep: (id: StepId) => void;

  // ===== step-level =====
  addStep: (
    type: StepType,
    opts?: { afterStepId?: StepId; idHint?: string; position?: { x: number; y: number } },
  ) => void;
  removeStep: (id: StepId) => void;
  duplicateStep: (id: StepId) => void;
  reorderSteps: (fromIndex: number, toIndex: number) => void;
  renameStep: (oldId: StepId, newId: StepId) => void;
  setStepType: (id: StepId, t: StepType) => void;
  setStepTitle: (id: StepId, title: string | undefined) => void;
  setStepEditable: (id: StepId, editable: boolean) => void;
  setStepView: (id: StepId, view: unknown) => void;
  patchStepView: (id: StepId, patch: Record<string, unknown>) => void;
  patchStepOption: (
    id: StepId,
    optionIndex: number,
    patch: { id?: string; label?: string; hint?: string | null },
  ) => void;
  addStepOption: (id: StepId, preset?: { id?: string; label?: string }) => void;
  removeStepOption: (id: StepId, optionIndex: number) => void;
  reorderStepOption: (id: StepId, fromIndex: number, toIndex: number) => void;
  setOptionRoute: (
    id: StepId,
    optionId: string,
    outcome:
      | { kind: "goto"; goto: StepId | null }
      | { kind: "terminal"; type: Action["type"]; args?: Record<string, unknown> }
      | { kind: "default" },
  ) => void;
  patchDefaultActionArgs: (id: StepId, argsPatch: Record<string, unknown>) => void;

  // ===== transitions =====
  addRule: (stepId: StepId, rule?: Partial<Rule>) => void;
  removeRule: (stepId: StepId, idx: number) => void;
  reorderRule: (stepId: StepId, from: number, to: number) => void;
  setRuleWhen: (stepId: StepId, idx: number, when: unknown) => void;
  setRuleGoto: (stepId: StepId, idx: number, goto: StepId | null | undefined) => void;
  setRuleActions: (stepId: StepId, idx: number, actions: Action[]) => void;
  setDefaultGoto: (stepId: StepId, goto: StepId | null | undefined) => void;
  setDefaultActions: (stepId: StepId, actions: Action[]) => void;
  convertTerminalToGoto: (stepId: StepId, goto: StepId) => void;
  setTerminalDefault: (
    stepId: StepId,
    type: "finish" | "escalate" | "assign" | "generateReport" | "callMacro",
    args?: Record<string, unknown>,
  ) => void;
  clearTerminalDefault: (stepId: StepId) => void;
}

const initialUi = (): UiState => ({
  // По умолчанию открываем таблицу: для непрограммиста табличный редактор
  // ближе к ментальной модели «список шагов сценария», чем граф. Flow
  // остаётся вспомогательным видом и доступен по переключателю в Toolbar.
  view: "table",
  selectedStepId: null,
  selectedRuleIndex: null,
  selectedEdgeId: null,
  diagnosticsPanelOpen: false,
  livePreviewOpen: false,
  dirty: false,
  baseName: null,
  diagnostics: [],
  loadError: null,
  loadInfo: null,
});

// Применить mutator к bundle и обновить state. Вспомогательная функция,
// которая инкапсулирует «общую часть» всех семантических action'ов:
// 1) проверить, что scenario/layout есть; 2) прогнать mutator;
// 3) пересчитать etag и валидацию; 4) обновить ui.
function applyMutator(
  state: EditorState,
  mutator: (b: ScenarioBundle) => ScenarioBundle,
): Partial<EditorState> | EditorState {
  if (!state.scenario || !state.layout) return state;
  const next = mutator({ scenario: state.scenario, layout: state.layout });
  if (next.scenario === state.scenario && next.layout === state.layout) {
    return state; // no-op
  }
  const nextLayout: ScenarioLayout = {
    ...next.layout,
    etag: computeStepsEtag(next.scenario.steps),
    scenarioRef: {
      scenarioGuid: next.scenario.metadata.scenarioGuid,
      version: next.scenario.metadata.version,
    },
  };
  const v = validate(next.scenario);
  return {
    scenario: next.scenario,
    layout: nextLayout,
    ui: {
      ...state.ui,
      dirty: true,
      diagnostics: v.ok ? v.diagnostics : v.diagnostics,
      loadError: v.ok ? null : "Сценарий не проходит валидацию по dsl-v1-schema.json",
    },
  };
}

export const useEditorStore = create<EditorState>()(
  temporal(
    (set, get) => ({
      scenario: null,
      layout: null,
      scenarioHandle: null,
      layoutHandle: null,
      ui: initialUi(),

      // ----- ui-only -----
      setView: (v) =>
        set((s) => (s.ui.view === v ? s : { ui: { ...s.ui, view: v } })),
      // setSelected явно выбирает шаг (и опционально rule). Если до этого было
      // выбрано ребро — снимаем (ребро != шаг).
      setSelected: (stepId, ruleIndex = null) =>
        set((s) => {
          if (
            s.ui.selectedStepId === stepId &&
            s.ui.selectedRuleIndex === ruleIndex &&
            (!stepId || s.ui.selectedEdgeId === null)
          ) {
            return s;
          }
          return {
            ui: {
              ...s.ui,
              selectedStepId: stepId,
              selectedRuleIndex: ruleIndex,
              selectedEdgeId: stepId ? null : s.ui.selectedEdgeId,
            },
          };
        }),
      // setSelectedEdge может быть вызван с edgeId ИЛИ с null. В отличие от
      // прежней версии — он НЕ обнуляет selectedStepId/selectedRuleIndex,
      // потому что Flow при клике на ребро параллельно вызывает setSelected
      // с парой (sourceStep, ruleKey), чтобы Inspector сразу открыл нужное
      // правило. Чтобы оба состояния не дрались — здесь только edgeId.
      setSelectedEdge: (edgeId) =>
        set((s) =>
          s.ui.selectedEdgeId === edgeId
            ? s
            : { ui: { ...s.ui, selectedEdgeId: edgeId } },
        ),
      setDiagnosticsPanelOpen: (open) =>
        set((s) =>
          s.ui.diagnosticsPanelOpen === open
            ? s
            : { ui: { ...s.ui, diagnosticsPanelOpen: open } },
        ),
      setLivePreviewOpen: (open) =>
        set((s) =>
          s.ui.livePreviewOpen === open
            ? s
            : { ui: { ...s.ui, livePreviewOpen: open } },
        ),
      setDiagnostics: (d) =>
        set((s) => (s.ui.diagnostics === d ? s : { ui: { ...s.ui, diagnostics: d } })),
      setLoadError: (msg) =>
        set((s) => (s.ui.loadError === msg ? s : { ui: { ...s.ui, loadError: msg } })),
      setLoadInfo: (msg) =>
        set((s) => (s.ui.loadInfo === msg ? s : { ui: { ...s.ui, loadInfo: msg } })),
      markClean: () =>
        set((s) => (s.ui.dirty === false ? s : { ui: { ...s.ui, dirty: false } })),
      setScenarioHandle: (h) => set({ scenarioHandle: h }),
      setLayoutHandle: (h) => set({ layoutHandle: h }),
      setBaseName: (name) => set((s) => ({ ui: { ...s.ui, baseName: name } })),

      // ----- load -----
      loadScenario: (scenario, layout, opts = {}) => {
        const v = validate(scenario);
        const finalLayout = reconcileLayoutOnLoad(scenario, layout);
        const expectedEtag = computeStepsEtag(scenario.steps);
        let info: string | null = null;
        if (layout && layout.etag && layout.etag !== expectedEtag) {
          info =
            "Layout рассинхронизирован со сценарием (etag отличается). Новые шаги расставлены автоматически, лишние записи отброшены при сохранении.";
        } else if (!layout) {
          info = null; // авто-layout сделает FlowEditor — не шумим
        }
        const hasErrors = v.diagnostics.some((d) => d.severity === "error");
        set({
          scenario,
          layout: finalLayout,
          scenarioHandle: opts.scenarioHandle ?? null,
          layoutHandle: opts.layoutHandle ?? null,
          ui: {
            ...initialUi(),
            // При наличии любых ошибок сразу показываем диагностику —
            // иначе пользователь увидит маленький красный значок внизу
            // и не поймёт, где проблема.
            diagnosticsPanelOpen: hasErrors,
            baseName: opts.baseName ?? null,
            diagnostics: v.ok ? v.diagnostics : v.diagnostics,
            loadError: v.ok ? null : "Сценарий не прошёл валидацию по dsl-v1-schema.json",
            loadInfo: info,
          },
        });
        useEditorStore.temporal.getState().clear();
      },

      // ----- layout -----
      applyAutoLayout: (preserveExisting = true) =>
        set((state) => {
          if (!state.scenario || !state.layout) return state;
          const preserve: Record<StepId, { x: number; y: number }> = {};
          if (preserveExisting) {
            for (const [id, n] of Object.entries(state.layout.nodes)) {
              if (n.x !== 0 || n.y !== 0) preserve[id] = { x: n.x, y: n.y };
            }
          }
          const placed = autoLayoutScenario(state.scenario, { preserve });
          // Стартуем с пустого набора: при «полном пересчёте» (кнопка
          // AutoFix) лишние записи (например, давно удалённые терминалы)
          // не должны висеть. Заодно это то, чего ожидает пользователь —
          // «причеши граф».
          const nextNodes: Record<StepId, NodeLayout> = preserveExisting
            ? { ...state.layout.nodes }
            : {};
          for (const [id, p] of Object.entries(placed)) {
            nextNodes[id] = { ...(nextNodes[id] ?? {}), x: p.x, y: p.y };
          }
          return {
            layout: { ...state.layout, nodes: nextNodes },
            ui: { ...state.ui, dirty: true },
          };
        }),

      setNodePosition: (stepId, pos) =>
        set((state) => {
          if (!state.layout) return state;
          const cur = state.layout.nodes[stepId];
          if (cur && cur.x === pos.x && cur.y === pos.y) return state;
          return {
            layout: {
              ...state.layout,
              nodes: { ...state.layout.nodes, [stepId]: { ...(cur ?? {}), ...pos } },
            },
            ui: { ...state.ui, dirty: true },
          };
        }),

      setViewport: (vp) =>
        set((state) => {
          if (!state.layout) return state;
          const cur = state.layout.viewport;
          if (cur && cur.x === vp.x && cur.y === vp.y && cur.zoom === vp.zoom) return state;
          return {
            layout: { ...state.layout, viewport: vp },
            ui: { ...state.ui, dirty: true },
          };
        }),

      // ----- scenario-level -----
      patchMetadata: (patch) => set((s) => applyMutator(s, A.patchScenarioMetadata(patch))),
      bumpVersion: () => set((s) => applyMutator(s, A.bumpScenarioVersion())),
      setTimers: (timers) => set((s) => applyMutator(s, A.setTimers(timers))),
      setConcurrency: (c) => set((s) => applyMutator(s, A.setConcurrency(c))),
      setInitialStep: (id) => set((s) => applyMutator(s, A.setInitialStep(id))),

      // ----- step-level -----
      addStep: (type, opts) => {
        set((s) => applyMutator(s, A.addStep(type, opts)));
        // выделяем созданный шаг
        const st = get();
        if (st.scenario) {
          const last =
            opts?.afterStepId !== undefined
              ? st.scenario.steps[
                  st.scenario.steps.findIndex((x) => x.id === opts.afterStepId) + 1
                ]
              : st.scenario.steps[st.scenario.steps.length - 1];
          if (last) get().setSelected(last.id);
        }
      },
      removeStep: (id) => {
        const st = get();
        set((s) => applyMutator(s, A.removeStep(id)));
        if (st.ui.selectedStepId === id) get().setSelected(null);
      },
      duplicateStep: (id) => set((s) => applyMutator(s, A.duplicateStep(id))),
      reorderSteps: (fromIndex, toIndex) =>
        set((s) => applyMutator(s, A.reorderSteps(fromIndex, toIndex))),
      renameStep: (oldId, newId) => {
        const st = get();
        set((s) => applyMutator(s, A.renameStep(oldId, newId)));
        if (st.ui.selectedStepId === oldId) get().setSelected(newId);
      },
      setStepType: (id, t) => set((s) => applyMutator(s, A.setStepType(id, t))),
      setStepTitle: (id, title) => set((s) => applyMutator(s, A.setStepTitle(id, title))),
      setStepEditable: (id, editable) =>
        set((s) => applyMutator(s, A.setStepEditable(id, editable))),
      setStepView: (id, view) => set((s) => applyMutator(s, A.setStepView(id, view))),
      patchStepView: (id, patch) =>
        set((s) => applyMutator(s, A.patchStepView(id, patch))),
      patchStepOption: (id, optionIndex, patch) =>
        set((s) => applyMutator(s, A.patchStepOption(id, optionIndex, patch))),
      addStepOption: (id, preset) =>
        set((s) => applyMutator(s, A.addStepOption(id, preset))),
      removeStepOption: (id, optionIndex) =>
        set((s) => applyMutator(s, A.removeStepOption(id, optionIndex))),
      reorderStepOption: (id, fromIndex, toIndex) =>
        set((s) => applyMutator(s, A.reorderStepOption(id, fromIndex, toIndex))),
      setOptionRoute: (id, optionId, outcome) =>
        set((s) => applyMutator(s, A.setOptionRoute(id, optionId, outcome))),
      patchDefaultActionArgs: (id, argsPatch) =>
        set((s) => applyMutator(s, A.patchDefaultActionArgs(id, argsPatch))),

      // ----- transitions -----
      addRule: (stepId, rule) => set((s) => applyMutator(s, A.addRule(stepId, rule))),
      removeRule: (stepId, idx) => set((s) => applyMutator(s, A.removeRule(stepId, idx))),
      reorderRule: (stepId, from, to) =>
        set((s) => applyMutator(s, A.reorderRule(stepId, from, to))),
      setRuleWhen: (stepId, idx, when) =>
        set((s) => applyMutator(s, A.setRuleWhen(stepId, idx, when))),
      setRuleGoto: (stepId, idx, goto) =>
        set((s) => applyMutator(s, A.setRuleGoto(stepId, idx, goto))),
      setRuleActions: (stepId, idx, actions) =>
        set((s) => applyMutator(s, A.setRuleActions(stepId, idx, actions))),
      setDefaultGoto: (stepId, goto) =>
        set((s) => applyMutator(s, A.setDefaultGoto(stepId, goto))),
      setDefaultActions: (stepId, actions) =>
        set((s) => applyMutator(s, A.setDefaultActions(stepId, actions))),
      convertTerminalToGoto: (stepId, goto) =>
        set((s) => applyMutator(s, A.convertTerminalToGoto(stepId, goto))),
      setTerminalDefault: (stepId, type, args) =>
        set((s) => applyMutator(s, A.setTerminalDefault(stepId, type, args))),
      clearTerminalDefault: (stepId) =>
        set((s) => applyMutator(s, A.clearTerminalDefault(stepId))),
    }),
    {
      partialize: (state) => ({
        scenario: state.scenario,
        layout: state.layout,
      }),
      limit: 50,
      equality: (a, b) => a.scenario === b.scenario && a.layout === b.layout,
    },
  ),
);

// Подгоняет sidecar layout к загруженному сценарию.
//
// Логика etag-merge:
//   - если layout не загружен (existing = null) — сразу прогоняем dagre,
//     чтобы граф был визуально читаем с первого кадра, без промежуточного
//     состояния «все узлы в (0,0)».
//   - если etag layout'а совпал с актуальным → берём как есть.
//   - если etag не совпал (часть шагов добавлена/удалена вне редактора):
//     старые координаты сохраняем, для НОВЫХ шагов зовём dagre, лишние
//     записи в layout.nodes не сохраняются на следующем save.
function reconcileLayoutOnLoad(
  scenario: ScenarioScript,
  existing: ScenarioLayout | null,
): ScenarioLayout {
  const actualEtag = computeStepsEtag(scenario.steps);
  const base =
    existing ?? EMPTY_LAYOUT(scenario.metadata.scenarioGuid, scenario.metadata.version);

  const knownPositions: Record<StepId, { x: number; y: number }> = {};
  for (const step of scenario.steps) {
    const n = base.nodes[step.id];
    if (n && (n.x !== 0 || n.y !== 0)) {
      knownPositions[step.id] = { x: n.x, y: n.y };
    }
  }

  const noLayout = existing === null;
  const etagMismatch = existing !== null && base.etag !== actualEtag;
  const hasUnplaced = scenario.steps.some((s) => !knownPositions[s.id]);

  // Терминальные синтетические узлы (__end_<id>) в старых layout-файлах
  // отсутствуют — раньше они вычислялись «на лету». Сейчас мы храним их
  // позицию в layout. Если у шага есть терминал, но в layout под этим id
  // ничего нет — нужно прогнать dagre, чтобы получить корректную позицию.
  const TERMINAL_TYPES = new Set([
    "finish",
    "escalate",
    "assign",
    "generateReport",
    "callMacro",
  ]);
  const hasUnplacedTerminal = scenario.steps.some((s) => {
    const t = s.transitions;
    if (!t) return false;
    if (t.default?.goto !== undefined && t.default?.goto !== null) return false;
    const term = t.default?.actions?.some((a) => TERMINAL_TYPES.has(a.type));
    if (!term) return false;
    const tid = "__end_" + s.id;
    const cur = base.nodes[tid];
    return !cur || (cur.x === 0 && cur.y === 0);
  });

  let computedPositions: Record<StepId, { x: number; y: number }> = {};
  if ((noLayout || etagMismatch || hasUnplacedTerminal) && (hasUnplaced || hasUnplacedTerminal)) {
    computedPositions = autoLayoutScenario(scenario, { preserve: knownPositions });
  }

  const nodes: ScenarioLayout["nodes"] = { ...base.nodes };
  for (const step of scenario.steps) {
    const cur = nodes[step.id];
    const known = knownPositions[step.id];
    const placed = computedPositions[step.id];
    if (known) {
      nodes[step.id] = { ...(cur ?? {}), x: known.x, y: known.y };
    } else if (placed) {
      nodes[step.id] = { ...(cur ?? {}), x: placed.x, y: placed.y };
    } else if (!cur) {
      nodes[step.id] = { x: 0, y: 0 };
    }
  }
  // Подхватываем позиции синтетических терминальных узлов (__end_<stepId>),
  // которые dagre тоже учитывает. Если уже была сохранена позиция от
  // прошлого drag — оставляем её. Иначе используем dagre.
  for (const [id, p] of Object.entries(computedPositions)) {
    if (!id.startsWith("__end_")) continue;
    if (nodes[id] && (nodes[id].x !== 0 || nodes[id].y !== 0)) continue;
    nodes[id] = { ...(nodes[id] ?? {}), x: p.x, y: p.y };
  }

  return {
    ...base,
    scenarioRef: {
      scenarioGuid: scenario.metadata.scenarioGuid,
      version: scenario.metadata.version,
    },
    nodes,
    etag: actualEtag,
  };
}

// === temporal hook ===
export const useTemporalStore = <T,>(
  selector: (state: TemporalState<Pick<EditorState, "scenario" | "layout">>) => T,
): T => useStore(useEditorStore.temporal, selector);

// Селектор-хелпер: текущий выбранный Step (или null).
export const useSelectedStep = (): Step | null => {
  return useEditorStore((s) => {
    const id = s.ui.selectedStepId;
    if (!id || !s.scenario) return null;
    return s.scenario.steps.find((x) => x.id === id) ?? null;
  });
};
