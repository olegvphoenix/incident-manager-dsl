import { Handle, Position, type NodeProps } from "@xyflow/react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import FlagIcon from "@mui/icons-material/Flag";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import DescriptionIcon from "@mui/icons-material/Description";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";

import type { FlowNodeData } from "../../../adapters/toFlow";

// Терминальный узел — синтетический. Появляется в графе для шагов,
// у которых default не имеет goto, но есть finish/escalate/assign-action
// (см. dsl-v1-schema.json /$defs/DefaultOutcome). В DSL такой узел НЕ хранится:
// при сохранении адаптер toFlow его пересоздаёт по action'ам.

const ICON: Record<NonNullable<FlowNodeData["terminalKind"]>, JSX.Element> = {
  finish: <FlagIcon fontSize="small" />,
  escalate: <TrendingUpIcon fontSize="small" />,
  assign: <PersonAddAlt1Icon fontSize="small" />,
  generateReport: <DescriptionIcon fontSize="small" />,
  callMacro: <PlayArrowIcon fontSize="small" />,
};

const COLOR: Record<NonNullable<FlowNodeData["terminalKind"]>, string> = {
  finish: "#2e7d32",
  escalate: "#ed6c02",
  assign: "#1976d2",
  generateReport: "#7b1fa2",
  callMacro: "#455a64",
};

const LABEL: Record<NonNullable<FlowNodeData["terminalKind"]>, string> = {
  finish: "FINISH",
  escalate: "ESCALATE",
  assign: "ASSIGN",
  generateReport: "REPORT",
  callMacro: "MACRO",
};

export const EndNode = (props: NodeProps) => {
  const data = props.data as FlowNodeData;
  const kind = data.terminalKind ?? "finish";
  return (
    <Box
      sx={{
        width: 130,
        height: 40,
        bgcolor: "background.paper",
        border: "2px solid",
        borderColor: COLOR[kind],
        borderRadius: 999,
        px: 1.5,
        py: 0.75,
        boxShadow: 1,
        position: "relative",
      }}
    >
      <Handle type="target" position={Position.Top} id="top" />
      <Stack direction="row" spacing={1} alignItems="center" sx={{ color: COLOR[kind] }}>
        {ICON[kind]}
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          {LABEL[kind]}
        </Typography>
      </Stack>
    </Box>
  );
};
