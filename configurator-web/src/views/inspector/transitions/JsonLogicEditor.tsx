import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CodeIcon from "@mui/icons-material/Code";

import { JsonLogicVisual } from "./JsonLogicVisual";
import { JsonLogicRawEditor } from "./JsonLogicRawEditor";
import { parseLogic, serializeLogic } from "./jsonLogicModel";

interface Props {
  value: unknown;
  onChange: (v: unknown) => void;
  label?: string;
}

// Контейнер JSONLogic-редактора с переключателем Visual / Raw.
//
// Visual работает с поддерживаемым подмножеством операторов (см. jsonLogicModel.ts).
// Если выражение содержит что-то непонятное (apply, missing, …), визуальный режим
// подсвечивает «raw JSONLogic»-узел красным, а пользователь может переключиться
// в Raw и поправить руками.
//
// Стартовый режим: Visual, если выражение полностью разобралось;
// иначе Raw — чтобы не пугать пользователя пустым визуалом и не «съесть»
// подвыражения, которые мы не понимаем.
export const JsonLogicEditor = ({ value, onChange, label = "when (JSONLogic)" }: Props) => {
  const parsed = useMemo(() => parseLogic(value), [value]);
  const fullyVisual = useMemo(() => isFullyVisual(parsed), [parsed]);
  const [mode, setMode] = useState<"visual" | "raw">(fullyVisual ? "visual" : "raw");

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          {label}
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={mode}
          onChange={(_, v) => v && setMode(v)}
        >
          <ToggleButton value="visual" sx={{ py: 0, px: 0.75, fontSize: 11 }}>
            <VisibilityIcon sx={{ fontSize: 14, mr: 0.25 }} />
            Visual
          </ToggleButton>
          <ToggleButton value="raw" sx={{ py: 0, px: 0.75, fontSize: 11 }}>
            <CodeIcon sx={{ fontSize: 14, mr: 0.25 }} />
            Raw
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      {mode === "visual" ? (
        <JsonLogicVisual
          node={parsed}
          onChange={(next) => onChange(serializeLogic(next))}
        />
      ) : (
        <JsonLogicRawEditor value={value} onChange={onChange} label="" />
      )}
    </Box>
  );
};

// Можно ли отрисовать поддерево полностью в Visual-режиме (нет ни одного
// `unknown` узла).
function isFullyVisual(node: ReturnType<typeof parseLogic>): boolean {
  switch (node.kind) {
    case "unknown":
      return false;
    case "compare":
      return isFullyVisual(node.left) && isFullyVisual(node.right);
    case "in":
      return isFullyVisual(node.needle) && isFullyVisual(node.haystack);
    case "and":
    case "or":
      return node.children.every(isFullyVisual);
    case "not":
      return isFullyVisual(node.child);
    default:
      return true;
  }
}
