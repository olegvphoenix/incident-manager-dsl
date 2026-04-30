import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type NodeChange,
  type ReactFlowInstance,
} from "@xyflow/react";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import FlagIcon from "@mui/icons-material/Flag";
import AssessmentIcon from "@mui/icons-material/Assessment";
import PriorityHighIcon from "@mui/icons-material/PriorityHigh";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

import { useEditorStore } from "../../store/editorStore";
import { toFlow, type FlowEdgeData, type FlowNodeData } from "../../adapters/toFlow";
import { nodeTypes } from "./nodes";
import { edgeTypes } from "./edges";
import { StepPalette, PALETTE_MIME, TERMINAL_MIME } from "./StepPalette";
import { EdgeWhenDialog } from "./EdgeWhenDialog";
import { FlowHintBanner } from "./FlowHintBanner";
import type { Step, StepType, ActionType } from "../../types/dsl";
import { NODE_HEIGHT, NODE_WIDTH } from "../../adapters/autoLayout";

// Read-only Flow-вид: рендерит граф из текущих scenario+layout.
// Перетаскивание узлов сохраняется в layout (через setNodePosition);
// добавление/удаление узлов и редактирование рёбер — в M4.
//
// Если layout не содержит координат (все x=y=0) — один раз дёргаем
// applyAutoLayout(false), чтобы получить аккуратную dagre-раскладку.

const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 };

// Внешняя обёртка: палитра слева + ReactFlowProvider + сам редактор.
// Provider нужен, чтобы `useReactFlow().screenToFlowPosition` работал
// при drop из палитры.
export const FlowEditor = () => {
  return (
    <Box sx={{ width: "100%", height: "100%", display: "flex" }}>
      <Box sx={{ width: 160, minWidth: 160, height: "100%" }}>
        <StepPalette />
      </Box>
      <Box sx={{ flex: 1, height: "100%", position: "relative" }}>
        <ReactFlowProvider>
          <FlowEditorInner />
        </ReactFlowProvider>
      </Box>
    </Box>
  );
};

const FlowEditorInner = () => {
  const scenario = useEditorStore((s) => s.scenario);
  const layout = useEditorStore((s) => s.layout);
  const diagnostics = useEditorStore((s) => s.ui.diagnostics);
  const loadInfo = useEditorStore((s) => s.ui.loadInfo);
  const loadError = useEditorStore((s) => s.ui.loadError);
  const setLoadInfo = useEditorStore((s) => s.setLoadInfo);
  const setSelected = useEditorStore((s) => s.setSelected);
  const setSelectedEdge = useEditorStore((s) => s.setSelectedEdge);
  const setNodePosition = useEditorStore((s) => s.setNodePosition);
  const applyAutoLayout = useEditorStore((s) => s.applyAutoLayout);
  const setDefaultGoto = useEditorStore((s) => s.setDefaultGoto);
  const setRuleGoto = useEditorStore((s) => s.setRuleGoto);
  const removeRule = useEditorStore((s) => s.removeRule);
  const addStep = useEditorStore((s) => s.addStep);
  const duplicateStep = useEditorStore((s) => s.duplicateStep);
  const removeStep = useEditorStore((s) => s.removeStep);
  const setInitialStep = useEditorStore((s) => s.setInitialStep);
  const initialStepId = useEditorStore((s) => s.scenario?.initialStepId);

  const rfApi = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Контекстное меню узла. Координаты — экранные (clientX/Y), Menu позиционируется
  // через anchorReference="anchorPosition".
  const [ctxMenu, setCtxMenu] = useState<
    { mouseX: number; mouseY: number; stepId: string } | null
  >(null);
  // Контекстное меню ребра. Отдельный state — у edge другой набор действий
  // (редактировать when, заменить goto, удалить — в зависимости от kind).
  const [edgeCtxMenu, setEdgeCtxMenu] = useState<
    | {
        mouseX: number;
        mouseY: number;
        edgeId: string;
        stepId: string;
        ruleIndex: number | "default";
        kind: "default" | "rule" | "terminal";
      }
    | null
  >(null);
  // Открытая модалка редактирования when по double-click.
  const [whenDialog, setWhenDialog] = useState<
    { stepId: string; ruleIndex: number | "default" } | null
  >(null);
  const rfInstance = useRef<ReactFlowInstance<
    typeof flow.nodes[number],
    typeof flow.edges[number]
  > | null>(null);

  // Подстраховка: если по какой-то причине после загрузки все позиции
  // нулевые (например, layout пришёл от старого редактора без координат)
  // — раскладываем граф по dagre. Обычный путь покрыт reconcileLayoutOnLoad,
  // здесь — fallback.
  useEffect(() => {
    if (!scenario || !layout) return;
    if (scenario.steps.length === 0) return;
    const allZero = scenario.steps.every((s) => {
      const n = layout.nodes[s.id];
      return !n || (n.x === 0 && n.y === 0);
    });
    if (allZero) {
      applyAutoLayout(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario?.metadata.scenarioGuid, scenario?.metadata.version]);

  // ВАЖНО: не зависим от selectedStepId/selectedEdgeId. Выбор управляется
  // ReactFlow внутренне, мы только слушаем onSelectionChange и пишем в store.
  // Если задавать selected={true} на узлах и тут же реагировать на onSelectionChange,
  // получаем цикл: внешний selected → ReactFlow триггерит onSelectionChange →
  // setSelected → новый useMemo → ReactFlow снова триггерит... → React #185.
  const flow = useMemo(() => {
    if (!scenario || !layout) return { nodes: [], edges: [] };
    return toFlow(scenario, layout, diagnostics);
  }, [scenario, layout, diagnostics]);

  if (!scenario || !layout) return null;

  // Сохраняем перетаскивание И обычных шагов, И синтетических терминальных
  // узлов (__end_<stepId>). Терминалы хранятся в layout по тому же ключу,
  // что и шаги, поэтому их можно двигать так же, как и реальные узлы.
  const handleNodesChange = (changes: NodeChange<typeof flow.nodes[number]>[]) => {
    for (const change of changes) {
      if (change.type === "position" && change.position && !change.dragging) {
        setNodePosition(change.id, change.position);
      }
    }
  };

  // Создание edge через drag из source-handle в target-handle.
  // Семантика: если у source шага уже есть default.goto — добавляем новое
  // правило (rule.when = true, rule.goto = target). Иначе — заполняем default.
  // Drag НЕ из step-узла (или В терминальный узел) игнорируется.
  const handleConnect = useCallback(
    (conn: Connection) => {
      if (!scenario) return;
      if (!conn.source || !conn.target) return;
      if (conn.source.startsWith("__end_") || conn.target.startsWith("__end_")) return;
      const src = scenario.steps.find((s) => s.id === conn.source);
      if (!src) return;
      const targetExists = scenario.steps.some((s) => s.id === conn.target);
      if (!targetExists) return;

      const t = src.transitions;
      const hasDefaultGoto =
        t && t.default && t.default.goto !== undefined && t.default.goto !== null;
      if (!hasDefaultGoto) {
        setDefaultGoto(src.id, conn.target);
      } else {
        // Добавляем новое правило — пользователь дальше отредактирует when.
        useEditorStore
          .getState()
          .addRule(src.id, { when: true, goto: conn.target });
      }
    },
    [scenario, setDefaultGoto],
  );

  // Перетаскивание конца ребра на другой узел (Reconnect).
  // - default-edge:  меняем default.goto на новый target.
  // - rule-edge:     меняем rules[idx].goto.
  // - terminal-edge: конвертируем finish/escalate-action в обычный goto.
  //                  То есть, если пользователь схватил хвост FINISH-узла и
  //                  бросил на другой шаг, мы трактуем это как «после этого
  //                  шага идти в target»: убираем finish-actions из
  //                  default.actions и ставим default.goto = target.
  const handleReconnect = useCallback(
    (oldEdge: { id: string }, newConn: Connection) => {
      if (!newConn.target) return;
      // На синтетический терминал переподключать нельзя — этих узлов нет в DSL.
      if (newConn.target.startsWith("__end_")) return;
      const m = oldEdge.id.match(/^([^:]+)::(default|r(\d+))::(.+)$/);
      if (!m) return;
      const stepId = m[1]!;
      const oldTarget = m[4]!;
      const isTerminal = oldTarget.startsWith("__end_");

      if (m[2] === "default") {
        if (isTerminal) {
          useEditorStore.getState().convertTerminalToGoto(stepId, newConn.target);
        } else {
          setDefaultGoto(stepId, newConn.target);
        }
      } else {
        const idx = Number(m[3]!);
        if (Number.isFinite(idx)) setRuleGoto(stepId, idx, newConn.target);
      }
    },
    [setDefaultGoto, setRuleGoto],
  );

  const setDefaultActions = useEditorStore((s) => s.setDefaultActions);
  const convertTerminalToGoto = useEditorStore((s) => s.convertTerminalToGoto);
  const setTerminalDefault = useEditorStore((s) => s.setTerminalDefault);
  const clearTerminalDefault = useEditorStore((s) => s.clearTerminalDefault);

  // Парсит edgeId формата "<stepId>::default::<target>" или "<stepId>::r<idx>::<target>"
  // в структурированную ссылку на правило/default-переход.
  const parseEdgeId = useCallback(
    (
      edgeId: string,
    ):
      | {
          stepId: string;
          ruleIndex: number | "default";
          target: string;
          kind: "default" | "rule" | "terminal";
        }
      | null => {
      const m = edgeId.match(/^([^:]+)::(default|r(\d+))::(.+)$/);
      if (!m) return null;
      const stepId = m[1]!;
      const target = m[4]!;
      const isTerminal = target.startsWith("__end_");
      if (m[2] === "default") {
        return {
          stepId,
          ruleIndex: "default",
          target,
          kind: isTerminal ? "terminal" : "default",
        };
      }
      return {
        stepId,
        ruleIndex: Number(m[3]!),
        target,
        kind: "rule",
      };
    },
    [],
  );

  // Drop из палитры. Два сценария:
  //  1) PALETTE_MIME (Step-карточка) → addStep в координатах курсора.
  //  2) TERMINAL_MIME (finish/escalate/...) → определяем, на какой узел
  //     попало, и проставляем default.actions = [{type}]. Drop на пустое
  //     место — ничего не делаем (терминалу нужен «хозяин»-шаг).
  const handleDragOver = useCallback((e: React.DragEvent) => {
    const isStep = e.dataTransfer.types.includes(PALETTE_MIME);
    const isTerminal = e.dataTransfer.types.includes(TERMINAL_MIME);
    if (!isStep && !isTerminal) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  // Под курсором ищем DOM-узел ReactFlow с data-id — это и есть stepId.
  // Подходит и для случая, когда курсор над badge'ем «start» / «+rule» внутри узла —
  // closest('.react-flow__node') поднимется до корневого элемента узла.
  const findStepIdAtPoint = useCallback((x: number, y: number): string | null => {
    const els = document.elementsFromPoint(x, y);
    for (const el of els) {
      const node = (el as HTMLElement).closest?.(".react-flow__node");
      if (node) {
        const id = node.getAttribute("data-id");
        if (id && !id.startsWith("__end_")) return id;
      }
    }
    return null;
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      const stepType = e.dataTransfer.getData(PALETTE_MIME) as StepType;
      const terminalType = e.dataTransfer.getData(TERMINAL_MIME) as ActionType;
      e.preventDefault();

      if (stepType) {
        const flowPos = rfApi.screenToFlowPosition({ x: e.clientX, y: e.clientY });
        addStep(stepType, {
          position: { x: flowPos.x - NODE_WIDTH / 2, y: flowPos.y - NODE_HEIGHT / 2 },
        });
        return;
      }

      if (terminalType) {
        const stepId = findStepIdAtPoint(e.clientX, e.clientY);
        if (!stepId) {
          // На пустое место бросать терминал бессмысленно — игнорируем,
          // чтобы пользователь понял, что нужно целиться в шаг.
          return;
        }
        setTerminalDefault(stepId, terminalType as Parameters<typeof setTerminalDefault>[1]);
        setSelected(stepId, "default");
      }
    },
    [rfApi, addStep, findStepIdAtPoint, setTerminalDefault, setSelected],
  );

  return (
    <Box
      ref={wrapperRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      sx={{ width: "100%", height: "100%", position: "relative" }}
    >
      {(loadInfo || loadError) && (
        <Box
          sx={{
            position: "absolute",
            top: 8,
            left: 8,
            right: 8,
            zIndex: 10,
            pointerEvents: "auto",
          }}
        >
          {loadError && (
            <Alert severity="error" sx={{ mb: 0.5 }}>
              {loadError}
            </Alert>
          )}
          {loadInfo && (
            <Alert
              severity="info"
              action={
                <IconButton size="small" onClick={() => setLoadInfo(null)}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              }
            >
              {loadInfo}
            </Alert>
          )}
        </Box>
      )}
      <ReactFlow<FlowNodeAdapter, FlowEdgeAdapter>
        nodes={flow.nodes as FlowNodeAdapter[]}
        edges={flow.edges as FlowEdgeAdapter[]}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        defaultViewport={layout.viewport ?? DEFAULT_VIEWPORT}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        }}
        nodesDraggable
        nodesConnectable
        elementsSelectable
        edgesReconnectable
        deleteKeyCode={null}
        multiSelectionKeyCode="Control"
        onInit={(instance) => {
          rfInstance.current = instance;
          requestAnimationFrame(() => instance.fitView({ padding: 0.2 }));
        }}
        onNodesChange={handleNodesChange}
        onConnect={handleConnect}
        onReconnect={handleReconnect}
        onNodeContextMenu={(e, node) => {
          if (node.id.startsWith("__end_")) return;
          e.preventDefault();
          setSelected(node.id);
          setCtxMenu({ mouseX: e.clientX, mouseY: e.clientY, stepId: node.id });
          setEdgeCtxMenu(null);
        }}
        onEdgeContextMenu={(e, edge) => {
          e.preventDefault();
          const ref = parseEdgeId(edge.id);
          if (!ref) return;
          setSelected(ref.stepId, ref.ruleIndex);
          setSelectedEdge(edge.id);
          setEdgeCtxMenu({
            mouseX: e.clientX,
            mouseY: e.clientY,
            edgeId: edge.id,
            stepId: ref.stepId,
            ruleIndex: ref.ruleIndex,
            kind: ref.kind,
          });
          setCtxMenu(null);
        }}
        onEdgeDoubleClick={(e, edge) => {
          e.preventDefault();
          e.stopPropagation();
          const ref = parseEdgeId(edge.id);
          if (!ref) return;
          setSelected(ref.stepId, ref.ruleIndex);
          setSelectedEdge(edge.id);
          if (ref.kind === "rule") {
            setWhenDialog({ stepId: ref.stepId, ruleIndex: ref.ruleIndex });
          }
          // для default/terminal — Inspector сам откроется через setSelected
        }}
        onPaneContextMenu={() => {
          setCtxMenu(null);
          setEdgeCtxMenu(null);
        }}
        onSelectionChange={({ nodes, edges }) => {
          if (nodes.length === 1) {
            const id = nodes[0]!.id;
            if (!id.startsWith("__end_")) setSelected(id);
            else setSelected(null);
          } else if (edges.length === 1) {
            const edgeId = edges[0]!.id;
            // Сначала setSelected (он обнуляет selectedEdgeId), затем
            // setSelectedEdge — чтобы оба значения попали в стор.
            const m = edgeId.match(/^([^:]+)::(default|r(\d+))::(.+)$/);
            if (m) {
              const stepId = m[1]!;
              const ruleKey: number | "default" =
                m[2] === "default" ? "default" : Number(m[3]!);
              setSelected(stepId, ruleKey);
            } else {
              setSelected(null);
            }
            setSelectedEdge(edgeId);
          } else {
            setSelected(null);
            setSelectedEdge(null);
          }
        }}
        fitView
      >
        <Background gap={16} size={1} color="#cfd6dd" />
        <MiniMap pannable zoomable />
        <Controls />
      </ReactFlow>

      <FlowHintBanner />

      {/* Модалка быстрого редактирования when у rule-edge (double-click). */}
      <EdgeWhenDialog
        edge={whenDialog}
        onClose={() => setWhenDialog(null)}
      />

      {/* Контекстное меню ребра. */}
      <Menu
        open={edgeCtxMenu !== null}
        onClose={() => setEdgeCtxMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          edgeCtxMenu ? { top: edgeCtxMenu.mouseY, left: edgeCtxMenu.mouseX } : undefined
        }
        slotProps={{ paper: { sx: { minWidth: 240 } } }}
      >
        {edgeCtxMenu?.kind === "rule" && (
          <MenuItem
            onClick={() => {
              if (!edgeCtxMenu) return;
              setWhenDialog({
                stepId: edgeCtxMenu.stepId,
                ruleIndex: edgeCtxMenu.ruleIndex,
              });
              setEdgeCtxMenu(null);
            }}
          >
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Редактировать условие (when)"
              secondary={`${edgeCtxMenu.stepId} · rules[${edgeCtxMenu.ruleIndex}]`}
              secondaryTypographyProps={{
                sx: { fontFamily: "monospace", fontSize: 11 },
              }}
            />
          </MenuItem>
        )}
        {(edgeCtxMenu?.kind === "default" || edgeCtxMenu?.kind === "terminal") && (
          <MenuItem
            onClick={() => {
              if (!edgeCtxMenu) return;
              setSelected(edgeCtxMenu.stepId, "default");
              setEdgeCtxMenu(null);
            }}
          >
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Открыть default в Inspector"
              secondary={edgeCtxMenu.stepId}
              secondaryTypographyProps={{
                sx: { fontFamily: "monospace", fontSize: 11 },
              }}
            />
          </MenuItem>
        )}
        <Divider />
        {edgeCtxMenu?.kind === "rule" && (
          <MenuItem
            onClick={() => {
              if (!edgeCtxMenu) return;
              const idx = edgeCtxMenu.ruleIndex as number;
              setEdgeCtxMenu(null);
              if (window.confirm("Удалить это правило?")) {
                removeRule(edgeCtxMenu.stepId, idx);
              }
            }}
            sx={{ color: "error.main" }}
          >
            <ListItemIcon sx={{ color: "error.main" }}>
              <DeleteIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Удалить правило" />
          </MenuItem>
        )}
        {edgeCtxMenu?.kind === "default" && (
          <MenuItem
            onClick={() => {
              if (!edgeCtxMenu) return;
              const stepId = edgeCtxMenu.stepId;
              setEdgeCtxMenu(null);
              if (
                window.confirm(
                  "Заменить goto на finish? default.goto будет удалён, добавится action finish.",
                )
              ) {
                setDefaultGoto(stepId, undefined);
                setDefaultActions(stepId, [{ type: "finish" }]);
              }
            }}
            sx={{ color: "error.main" }}
          >
            <ListItemIcon sx={{ color: "error.main" }}>
              <DeleteIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Заменить goto на finish" />
          </MenuItem>
        )}
        {edgeCtxMenu?.kind === "terminal" && (
          <MenuItem
            onClick={() => {
              if (!edgeCtxMenu) return;
              const stepId = edgeCtxMenu.stepId;
              const target = window.prompt(
                "ID шага, на который перевести этот терминал (вместо finish):",
              );
              setEdgeCtxMenu(null);
              if (target && scenario?.steps.some((s) => s.id === target)) {
                convertTerminalToGoto(stepId, target);
              }
            }}
          >
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Заменить терминал на goto…" />
          </MenuItem>
        )}
      </Menu>

      {/* Контекстное меню ноды. Отдельным MUI Menu — гибче, чем нативный contextmenu. */}
      <Menu
        open={ctxMenu !== null}
        onClose={() => setCtxMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          ctxMenu ? { top: ctxMenu.mouseY, left: ctxMenu.mouseX } : undefined
        }
        slotProps={{ paper: { sx: { minWidth: 220 } } }}
      >
        <MenuItem
          onClick={() => {
            if (ctxMenu) setSelected(ctxMenu.stepId);
            setCtxMenu(null);
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Редактировать"
            secondary={ctxMenu?.stepId}
            secondaryTypographyProps={{ sx: { fontFamily: "monospace", fontSize: 11 } }}
          />
        </MenuItem>
        {ctxMenu && initialStepId !== ctxMenu.stepId && (
          <MenuItem
            onClick={() => {
              if (ctxMenu) setInitialStep(ctxMenu.stepId);
              setCtxMenu(null);
            }}
          >
            <ListItemIcon>
              <PlayArrowIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Сделать начальным" />
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            if (ctxMenu) duplicateStep(ctxMenu.stepId);
            setCtxMenu(null);
          }}
        >
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Дублировать" />
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            if (!ctxMenu) return;
            setTerminalDefault(ctxMenu.stepId, "finish");
            setSelected(ctxMenu.stepId, "default");
            setCtxMenu(null);
          }}
        >
          <ListItemIcon sx={{ color: "#2e7d32" }}>
            <FlagIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Завершить здесь (finish)"
            secondary="default → finish, goto удалится"
          />
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (!ctxMenu) return;
            setTerminalDefault(ctxMenu.stepId, "generateReport");
            setSelected(ctxMenu.stepId, "default");
            setCtxMenu(null);
          }}
        >
          <ListItemIcon sx={{ color: "#7b1fa2" }}>
            <AssessmentIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Сгенерировать отчёт (report)"
            secondary="default → generateReport"
          />
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (!ctxMenu) return;
            setTerminalDefault(ctxMenu.stepId, "escalate");
            setSelected(ctxMenu.stepId, "default");
            setCtxMenu(null);
          }}
        >
          <ListItemIcon sx={{ color: "#ed6c02" }}>
            <PriorityHighIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Эскалировать (escalate)"
            secondary="default → escalate"
          />
        </MenuItem>
        {ctxMenu &&
          stepHasTerminal(scenario?.steps.find((s) => s.id === ctxMenu.stepId)) && (
            <MenuItem
              onClick={() => {
                if (!ctxMenu) return;
                clearTerminalDefault(ctxMenu.stepId);
                setSelected(ctxMenu.stepId, "default");
                setCtxMenu(null);
              }}
            >
              <ListItemIcon>
                <RestartAltIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Сбросить терминал"
                secondary="убрать finish/report/escalate"
              />
            </MenuItem>
          )}
        <Divider />
        <MenuItem
          onClick={() => {
            if (!ctxMenu) return;
            const id = ctxMenu.stepId;
            setCtxMenu(null);
            if (window.confirm(`Удалить шаг "${id}"? Все ссылки на него превратятся в null.`)) {
              removeStep(id);
            }
          }}
          sx={{ color: "error.main" }}
        >
          <ListItemIcon sx={{ color: "error.main" }}>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Удалить" />
        </MenuItem>
      </Menu>
    </Box>
  );
};

// Локальные псевдонимы для дженерик-параметров ReactFlow.
type FlowNodeAdapter = Parameters<typeof toFlow>[0] extends never
  ? never
  : ReturnType<typeof toFlow>["nodes"][number];
type FlowEdgeAdapter = ReturnType<typeof toFlow>["edges"][number];

// Есть ли у шага терминал в default.actions (finish/escalate/...).
// Используется, чтобы условно показать пункт «Сбросить терминал» в меню.
const TERMINAL_TYPES = new Set([
  "finish",
  "escalate",
  "assign",
  "generateReport",
  "callMacro",
]);
function stepHasTerminal(step: Step | undefined): boolean {
  if (!step?.transitions?.default?.actions) return false;
  return step.transitions.default.actions.some((a) => TERMINAL_TYPES.has(a.type));
}

// чтобы TS не ругался на неиспользованные импортированные типы (FlowEdgeData, FlowNodeData
// нужны лишь для генерик-проверок выше).
export type _FlowNodeData = FlowNodeData;
export type _FlowEdgeData = FlowEdgeData;
