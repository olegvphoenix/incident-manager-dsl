import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import Tooltip from "@mui/material/Tooltip";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import type { FlowEdgeData } from "../../../adapters/toFlow";
import { EdgeActionBadges } from "./edgeHelpers";

const COLOR: Record<NonNullable<FlowEdgeData["terminalKind"]>, string> = {
  finish: "#2e7d32",
  escalate: "#ed6c02",
  assign: "#1976d2",
  generateReport: "#7b1fa2",
  callMacro: "#455a64",
};

const KIND_LABEL: Record<NonNullable<FlowEdgeData["terminalKind"]>, string> = {
  finish: "Завершение сценария",
  escalate: "Эскалация",
  assign: "Назначение исполнителя (терминальное)",
  generateReport: "Генерация отчёта (терминальное)",
  callMacro: "Вызов макроса (терминальное)",
};

// Ребро от шага к терминальной ноде. Цвет соответствует kind action'а.
// Tooltip объясняет терминальный смысл и подсказывает, что можно перетащить
// конец стрелки на другой шаг — финиш заменится на goto.
export const TerminalEdge = (props: EdgeProps) => {
  const data = props.data as FlowEdgeData | undefined;
  const kind = data?.terminalKind ?? "finish";
  const stroke = COLOR[kind];
  const [path, labelX, labelY] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  });

  const sideActions = data?.sideActionTypes ?? [];
  const hasBadge = sideActions.length > 0;

  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        markerEnd={props.markerEnd}
        interactionWidth={24}
        style={{ strokeWidth: 2, stroke, cursor: "pointer" }}
      />
      {hasBadge && (
        <EdgeLabelRenderer>
          <Tooltip title={`${KIND_LABEL[kind]}. Перетащите конец на другой шаг, чтобы заменить на goto.`}>
            <div
              style={{
                position: "absolute",
                transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`,
                pointerEvents: "all",
              }}
              className="nodrag nopan"
            >
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.5,
                  px: 0.5,
                  py: 0.25,
                  bgcolor: "white",
                  border: `1px solid ${stroke}`,
                  borderRadius: 0.75,
                  cursor: "pointer",
                }}
              >
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <EdgeActionBadges actionTypes={sideActions} />
                </Stack>
              </Box>
            </div>
          </Tooltip>
        </EdgeLabelRenderer>
      )}
    </>
  );
};
