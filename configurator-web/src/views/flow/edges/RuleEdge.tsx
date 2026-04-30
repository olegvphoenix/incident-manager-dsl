import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import Tooltip from "@mui/material/Tooltip";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import type { FlowEdgeData } from "../../../adapters/toFlow";
import { EdgeActionBadges } from "./edgeHelpers";

// rule-переход: пунктирная синяя линия с подписью compactLogic(when).
// Подпись лежит поверх линии в её середине и оборачивается в Tooltip,
// показывающий полное JSONLogic-выражение (whenText) + подсказку UX.
export const RuleEdge = (props: EdgeProps) => {
  const data = props.data as FlowEdgeData | undefined;
  const [path, labelX, labelY] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  });

  const stroke = data?.hasError ? "#d32f2f" : "#1f6feb";
  const sideActions = data?.sideActionTypes ?? [];
  const whenText = data?.whenText ?? "";

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
          strokeDasharray: "6 4",
          cursor: "pointer",
        }}
      />
      <EdgeLabelRenderer>
        <Tooltip
          arrow
          placement="top"
          title={
            <Box sx={{ maxWidth: 360 }}>
              <Box sx={{ fontSize: 11, opacity: 0.8, mb: 0.25 }}>when (JSONLogic):</Box>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  fontSize: 11,
                  fontFamily: "monospace",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: 220,
                  overflow: "auto",
                }}
              >
                {whenText || "—"}
              </Box>
              <Box sx={{ fontSize: 10, opacity: 0.7, mt: 0.5 }}>
                Двойной клик — править условие. ПКМ — меню.
              </Box>
            </Box>
          }
        >
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`,
              padding: "2px 6px",
              borderRadius: 4,
              fontSize: 11,
              fontFamily: "monospace",
              background: "white",
              border: `1px solid ${stroke}`,
              color: stroke,
              pointerEvents: "all",
              maxWidth: 220,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
            className="nodrag nopan"
          >
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Box
                sx={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 160,
                }}
              >
                {String(props.label ?? "")}
              </Box>
              <EdgeActionBadges actionTypes={sideActions} />
            </Stack>
          </div>
        </Tooltip>
      </EdgeLabelRenderer>
    </>
  );
};
