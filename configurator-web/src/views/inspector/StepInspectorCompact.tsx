import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import DeleteIcon from "@mui/icons-material/Delete";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import TuneIcon from "@mui/icons-material/Tune";

import type { Step } from "../../types/dsl";
import { useEditorStore } from "../../store/editorStore";
import { TransitionsEditor } from "./transitions/TransitionsEditor";
import { StepDiagnostics } from "./diagnostics/StepDiagnostics";
import { StepTypeIcon } from "../table/StepTypeIcon";
import { STEP_TYPE_META, getStepLabel } from "../table/stepHelpers";
import { AdvancedViewSettings } from "./AdvancedViewSettings";

interface Props {
  step: Step;
}

// «Компактный» инспектор для режима таблицы. Не дублирует то, что уже есть
// в карточке-строке (id, тип, текст вопроса, опции с маршрутами, default).
// Показывает только:
//   * сводку выделенного шага + быстрые действия;
//   * Advanced view (поля, которые вынесены из таблицы — layout, hints,
//     min/max длины и т.п.);
//   * полный редактор transitions (для сложных JSONLogic условий, которых
//     нельзя выразить через простой маппинг option→step);
//   * диагностику.
export const StepInspectorCompact = ({ step }: Props) => {
  const setSelected = useEditorStore((s) => s.setSelected);
  const setView = useEditorStore((s) => s.setView);
  const removeStep = useEditorStore((s) => s.removeStep);
  const duplicateStep = useEditorStore((s) => s.duplicateStep);

  const meta = STEP_TYPE_META[step.type];
  const label = getStepLabel(step);

  return (
    <Box sx={{ p: 1.5 }}>
      {/* Header: иконка типа + краткая сводка + действия */}
      <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1 }}>
        <StepTypeIcon type={step.type} sx={{ color: `${meta.color}.main`, mt: 0.5 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            {meta.label}
          </Typography>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={label}
          >
            {label || <span style={{ color: "var(--mui-palette-text-disabled, #999)" }}>(без текста)</span>}
          </Typography>
          <Chip
            size="small"
            label={step.id}
            variant="outlined"
            sx={{ fontFamily: "monospace", fontSize: 10, height: 18, mt: 0.25 }}
          />
        </Box>
        <Stack direction="row" spacing={0}>
          <Tooltip title="Дублировать">
            <IconButton size="small" onClick={() => duplicateStep(step.id)}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Удалить">
            <IconButton
              size="small"
              color="error"
              onClick={() => {
                if (
                  window.confirm(
                    `Удалить шаг «${label || step.id}»? Все ссылки на него превратятся в null.`,
                  )
                ) {
                  removeStep(step.id);
                }
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Alert
        severity="info"
        icon={false}
        sx={{ py: 0.5, fontSize: 11, mb: 1.5 }}
      >
        Основные настройки — в карточке шага в таблице. Здесь — расширенные параметры и
        редактор сложных правил.
      </Alert>

      <Stack spacing={1.5}>
        {/* Расширенные параметры view (то, чего нет в таблице) */}
        <Section title="Расширенные параметры" icon={<TuneIcon fontSize="small" />}>
          <AdvancedViewSettings step={step} />
        </Section>

        <Divider />

        {/* Полный редактор transitions: для сложных правил с and/or/not */}
        <Box>
          <Typography variant="overline" color="text.secondary">
            Условия и действия (расширенный режим)
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
            Если простого маппинга «вариант → шаг» недостаточно: составные условия,
            произвольные actions, callMacro с params.
          </Typography>
          <Box data-inspector-section="transitions">
            <TransitionsEditor step={step} />
          </Box>
        </Box>

        <Divider />

        {/* Диагностика по этому шагу */}
        <StepDiagnostics stepId={step.id} />

        <Divider />

        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="text"
            startIcon={<OpenInNewIcon fontSize="small" />}
            onClick={() => {
              setSelected(step.id);
              setView("flow");
            }}
          >
            На карте
          </Button>
          <Button size="small" variant="text" onClick={() => setSelected(null)}>
            К настройкам сценария
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

const Section = ({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <Box>
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.75 }}>
      {icon}
      <Typography variant="overline" color="text.secondary">
        {title}
      </Typography>
    </Stack>
    {children}
  </Box>
);
