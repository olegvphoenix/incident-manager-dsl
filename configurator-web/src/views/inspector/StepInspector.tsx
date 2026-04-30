import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import DeleteIcon from "@mui/icons-material/Delete";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import type { Step } from "../../types/dsl";
import { useEditorStore } from "../../store/editorStore";
import { IdentityForm } from "./identity/IdentityForm";
import { ViewForm } from "./view/ViewForm";
import { TransitionsEditor } from "./transitions/TransitionsEditor";
import { StepDiagnostics } from "./diagnostics/StepDiagnostics";

interface Props {
  step: Step;
}

// Главный редактор шага. Сверху — кнопки навигации (назад к настройкам сценария,
// duplicate, delete), затем identity, форма по типу шага, переходы, диагностика.
export const StepInspector = ({ step }: Props) => {
  const setSelected = useEditorStore((s) => s.setSelected);
  const removeStep = useEditorStore((s) => s.removeStep);
  const duplicateStep = useEditorStore((s) => s.duplicateStep);

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Tooltip title="К настройкам сценария">
          <IconButton size="small" onClick={() => setSelected(null)}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Typography variant="overline" color="text.secondary" sx={{ flex: 1 }}>
          Шаг
        </Typography>
        <Tooltip title="Дублировать шаг">
          <IconButton size="small" onClick={() => duplicateStep(step.id)}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Удалить шаг">
          <IconButton
            size="small"
            color="error"
            onClick={() => {
              if (window.confirm(`Удалить шаг "${step.id}"? Все ссылки на него превратятся в null.`)) {
                removeStep(step.id);
              }
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      <Divider sx={{ mb: 1 }} />

      <Stack spacing={2}>
        <Box data-inspector-section="identity">
          <IdentityForm step={step} />
        </Box>

        <Divider />
        <Box data-inspector-section="view">
          <Typography variant="caption" color="text.secondary">
            View — параметры отображения
          </Typography>
          <ViewForm step={step} />
        </Box>

        <Divider />
        <Box data-inspector-section="transitions">
          <Typography variant="caption" color="text.secondary">
            Transitions — переходы и actions
          </Typography>
          <TransitionsEditor step={step} />
        </Box>

        <StepDiagnostics stepId={step.id} />
      </Stack>
    </Box>
  );
};
