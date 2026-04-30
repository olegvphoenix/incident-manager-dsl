import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import Tooltip from "@mui/material/Tooltip";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import type { FlowEdgeData } from "../../../adapters/toFlow";
import { EdgeActionBadges } from "./edgeHelpers";

// default-переход: сплошная серая линия. Ошибка — красная. На середине ребра —
// маленький badge со значком "default" + иконки side-effect actions, всё внутри
// Tooltip'а с подсказкой про двойной клик и ПКМ.
export const DefaultEdge = (props: EdgeProps) => {
  const data = props.data as FlowEdgeData | undefined;
  const [path, labelX, labelY] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  });
  const stroke = data?.hasError ? "#d32f2f" : "#90a4ae";
  const sideActions = data?.sideActionTypes ?? [];
  const hasBadge = sideActions.length > 0;

  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        markerEnd={props.markerEnd}
        interactionWidth={24}
        style={{
          strokeWidth: 1.6,
          stroke,
          cursor: "pointer",
        }}
      />
      {hasBadge && (
        <EdgeLabelRenderer>
          <Tooltip
            title={
              <span>
                Default-переход. ПКМ — меню, двойной клик — открыть в Inspector.
              </span>
            }
          >
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
                  fontSize: 10,
                  color: stroke,
                  fontFamily: "monospace",
                  cursor: "pointer",
                }}
              >
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <span>default</span>
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
