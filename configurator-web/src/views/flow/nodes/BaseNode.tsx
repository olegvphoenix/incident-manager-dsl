import { Handle, Position, type NodeProps } from "@xyflow/react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import AddIcon from "@mui/icons-material/Add";
import AltRouteIcon from "@mui/icons-material/AltRoute";
import FlagIcon from "@mui/icons-material/Flag";
import type { ReactNode } from "react";

import type { FlowNodeData } from "../../../adapters/toFlow";
import { NODE_HEIGHT, NODE_WIDTH } from "../../../adapters/autoLayout";
import { useEditorStore } from "../../../store/editorStore";

interface BaseNodeProps {
  data: FlowNodeData;
  selected?: boolean;
  icon?: ReactNode;
  typeLabel: string;
  // короткая сводка под заголовком (обычно view.label)
  summary?: ReactNode;
}

// Общая «коробка» для всех Step-нод. Все типы шагов выглядят похоже —
// меняются иконка, метка типа и краткое содержимое (summary).
// Handle'ы: top — входящие, bottom — основное исходящее. left/right
// зарезервированы для двух-веточных шагов (на M2 не используются).
export const BaseNode = ({ data, selected, icon, typeLabel, summary }: BaseNodeProps) => {
  const step = data.step!;
  const hasError = data.hasError;
  const isInitial = data.isInitial;
  const rulesCount = data.rulesCount ?? 0;
  const addRule = useEditorStore((s) => s.addRule);
  const setSelected = useEditorStore((s) => s.setSelected);
  const setTerminalDefault = useEditorStore((s) => s.setTerminalDefault);

  // Понимаем, есть ли у default уже исходящий переход или терминал.
  // Используется, чтобы не показывать «🏁» на шаге, у которого уже есть finish/goto.
  const t = step.transitions;
  const hasDefaultGoto =
    !!t && t.default && t.default.goto !== undefined && t.default.goto !== null;
  const hasTerminal =
    !!t &&
    !!t.default.actions?.some((a) =>
      ["finish", "escalate", "assign", "generateReport", "callMacro"].includes(a.type),
    );
  const showFinishButton = !hasDefaultGoto && !hasTerminal;

  return (
    <Box
      sx={{
        width: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: hasError
          ? "error.main"
          : selected
            ? "primary.main"
            : "divider",
        borderRadius: 1.5,
        boxShadow: selected ? 3 : 1,
        px: 1.25,
        py: 1,
        position: "relative",
      }}
    >
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />

      <Stack direction="row" spacing={0.75} alignItems="center">
        <Box sx={{ display: "flex", color: "primary.main" }}>{icon}</Box>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          {typeLabel}
        </Typography>
        {isInitial && (
          <Chip size="small" label="start" color="primary" sx={{ height: 18, fontSize: 10 }} />
        )}
        {rulesCount > 0 && (
          <Tooltip title={`${rulesCount} условных переход${pluralRu(rulesCount)} (rules)`}>
            <Chip
              size="small"
              icon={<AltRouteIcon sx={{ fontSize: 12, ml: "4px !important" }} />}
              label={rulesCount}
              variant="outlined"
              sx={{
                height: 18,
                fontSize: 10,
                "& .MuiChip-label": { px: 0.5 },
              }}
            />
          </Tooltip>
        )}
        <Tooltip title="Добавить условный переход (rule)">
          <IconButton
            size="small"
            className="nodrag"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              addRule(step.id);
              const newIdx = rulesCount;
              setSelected(step.id, newIdx);
            }}
            sx={{ p: 0.25, color: "primary.main" }}
          >
            <AddIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
        {showFinishButton && (
          <Tooltip title="Завершить здесь (finish). Default станет finish.">
            <IconButton
              size="small"
              className="nodrag"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setTerminalDefault(step.id, "finish");
                setSelected(step.id, "default");
              }}
              sx={{ p: 0.25, color: "#2e7d32" }}
            >
              <FlagIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        )}
        {hasError && (
          <Chip size="small" label="!" color="error" sx={{ height: 18, fontSize: 10 }} />
        )}
      </Stack>

      <Typography
        variant="body2"
        sx={{
          fontFamily: "monospace",
          mt: 0.25,
          color: "primary.dark",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {step.id}
      </Typography>

      {summary && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            mt: 0.25,
          }}
        >
          {summary}
        </Typography>
      )}
    </Box>
  );
};

// Используется для NodeProps<NodeType>. NodeType ReactFlow требует расширять Record<string, unknown>.
export type NodeAdapter = (props: NodeProps) => JSX.Element;

// "1 условный переход" / "2 условных перехода" / "5 условных переходов"
function pluralRu(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "а";
  return "ов";
}
