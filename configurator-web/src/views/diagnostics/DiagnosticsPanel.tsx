import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

import { useEditorStore } from "../../store/editorStore";
import type { Diagnostic, DiagnosticCode } from "../../services/validation";
import { scrollInspectorToSection } from "../inspector/scrollToSection";

const COLLAPSED_HEIGHT = 32;
const EXPANDED_HEIGHT = 320;

const CODE_LABEL: Record<DiagnosticCode, string> = {
  ajv: "Схема",
  duplicate_step_id: "Дубль step.id",
  duplicate_option_id: "Дубль option.id",
  dangling_goto: "Висячий goto",
  default_dead_end: "default-dead-end",
  unreachable_step: "Недостижим",
  missing_initial_step: "Нет initial",
};

// Полная панель диагностики. Каждая запись:
//   - человеческое сообщение крупно;
//   - кликабельная стрелка «перейти к проблеме» (если есть navigation);
//   - кнопка «❓» раскрывает hint — конкретная инструкция как чинить.
export const DiagnosticsPanel = () => {
  const diagnostics = useEditorStore((s) => s.ui.diagnostics);
  const open = useEditorStore((s) => s.ui.diagnosticsPanelOpen);
  const setOpen = useEditorStore((s) => s.setDiagnosticsPanelOpen);
  const setSelected = useEditorStore((s) => s.setSelected);
  const setView = useEditorStore((s) => s.setView);
  const loadError = useEditorStore((s) => s.ui.loadError);

  const counts = useMemo(() => countByCode(diagnostics), [diagnostics]);
  const errors = useMemo(
    () => diagnostics.filter((d) => d.severity === "error"),
    [diagnostics],
  );
  const warnings = useMemo(
    () => diagnostics.filter((d) => d.severity === "warning"),
    [diagnostics],
  );

  const handleNavigate = (d: Diagnostic) => {
    if (d.navigation?.kind === "metadata") {
      setSelected(null);
      requestAnimationFrame(() => {
        // у ScenarioSettings нет якорей-секций, просто прокрутим вверх
        const el = document.querySelector("[data-scenario-settings]");
        (el as HTMLElement | null)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }
    if (d.stepId) {
      setView("flow");
      setSelected(d.stepId, d.ruleIndex ?? null);
      if (d.navigation?.kind === "inspector") {
        scrollInspectorToSection(d.navigation.section);
      }
    }
  };

  if (!open) {
    return (
      <Box
        sx={{
          height: COLLAPSED_HEIGHT,
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1,
          borderTop: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          fontSize: 12,
          cursor: "pointer",
        }}
        onClick={() => setOpen(true)}
      >
        <SummaryChips errors={errors.length} warnings={warnings.length} />
        <Box sx={{ flex: 1 }} />
        {Object.entries(counts)
          .slice(0, 4)
          .map(([code, n]) => (
            <Chip
              key={code}
              size="small"
              variant="outlined"
              label={`${CODE_LABEL[code as DiagnosticCode] ?? code}: ${n}`}
              sx={{ fontSize: 11 }}
            />
          ))}
        <Tooltip title="Развернуть панель диагностики">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
            }}
          >
            <ExpandLessIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: EXPANDED_HEIGHT,
        display: "flex",
        flexDirection: "column",
        borderTop: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Stack direction="row" alignItems="center" sx={{ px: 1, py: 0.5 }}>
        <Typography variant="overline" sx={{ flex: 1, color: "text.secondary" }}>
          Диагностика — кликните по записи, чтобы перейти к проблеме
        </Typography>
        <SummaryChips errors={errors.length} warnings={warnings.length} />
        <Tooltip title="Свернуть">
          <IconButton size="small" onClick={() => setOpen(false)}>
            <ExpandMoreIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Box
        sx={{ flex: 1, overflow: "auto", borderTop: "1px solid", borderColor: "divider" }}
      >
        {loadError && (
          <DiagnosticItem
            d={{
              severity: "error",
              code: "ajv",
              message: loadError,
              humanMessage: loadError,
              hint:
                "Файл содержит ошибки в structure: посмотрите ниже список конкретных проблем и кликайте по каждой.",
            }}
            onNavigate={undefined}
          />
        )}
        {diagnostics.length === 0 && !loadError && (
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ p: 2, color: "success.main" }}
          >
            <CheckCircleOutlineIcon fontSize="small" />
            <Typography variant="body2">Сценарий валиден.</Typography>
          </Stack>
        )}
        {errors.map((d, i) => (
          <DiagnosticItem
            key={`e${i}`}
            d={d}
            onNavigate={d.stepId || d.navigation ? () => handleNavigate(d) : undefined}
          />
        ))}
        {warnings.map((d, i) => (
          <DiagnosticItem
            key={`w${i}`}
            d={d}
            onNavigate={d.stepId || d.navigation ? () => handleNavigate(d) : undefined}
          />
        ))}
      </Box>
    </Box>
  );
};

const SummaryChips = ({
  errors,
  warnings,
}: {
  errors: number;
  warnings: number;
}) => (
  <Stack direction="row" spacing={0.5} alignItems="center">
    <Chip
      size="small"
      icon={<ErrorOutlineIcon />}
      label={errors}
      color={errors > 0 ? "error" : "default"}
      variant={errors > 0 ? "filled" : "outlined"}
    />
    <Chip
      size="small"
      icon={<WarningAmberIcon />}
      label={warnings}
      color={warnings > 0 ? "warning" : "default"}
      variant={warnings > 0 ? "filled" : "outlined"}
    />
  </Stack>
);

const DiagnosticItem = ({
  d,
  onNavigate,
}: {
  d: Diagnostic;
  onNavigate?: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const human = d.humanMessage ?? d.message;
  const hint = d.hint;
  const severityColor: "error" | "warning" = d.severity;

  return (
    <Box
      sx={{
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: expanded ? "action.hover" : "transparent",
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="flex-start"
        sx={{
          px: 1.5,
          py: 0.75,
          cursor: onNavigate ? "pointer" : "default",
          "&:hover": onNavigate ? { bgcolor: "action.hover" } : undefined,
        }}
        onClick={onNavigate}
      >
        <Box sx={{ pt: 0.25 }}>
          {severityColor === "error" ? (
            <ErrorOutlineIcon fontSize="small" color="error" />
          ) : (
            <WarningAmberIcon fontSize="small" color="warning" />
          )}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontSize: 13, lineHeight: 1.35 }}>
            {human}
          </Typography>
          {!expanded && hint && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "block",
                fontSize: 11,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {hint}
            </Typography>
          )}
        </Box>
        <Chip
          size="small"
          variant="outlined"
          label={d.code}
          sx={{ fontSize: 10, height: 18, mt: 0.25 }}
        />
        {hint && (
          <Tooltip title={expanded ? "Свернуть подсказку" : "Показать подсказку «как починить»"}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              color={expanded ? "primary" : "default"}
              sx={{ p: 0.25 }}
            >
              <HelpOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {onNavigate && (
          <Tooltip title="Перейти к проблеме">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onNavigate();
              }}
              sx={{ p: 0.25 }}
            >
              <ArrowForwardIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box sx={{ px: 4, py: 1, bgcolor: "background.paper" }}>
          <Typography variant="body2" sx={{ fontSize: 12, color: "text.secondary" }}>
            <strong>Как починить:</strong> {hint}
          </Typography>
          {d.jsonPointer && (
            <Typography
              variant="caption"
              sx={{
                display: "block",
                mt: 0.5,
                fontFamily: "monospace",
                color: "text.disabled",
                fontSize: 10,
              }}
            >
              JSON path: {d.jsonPointer}
            </Typography>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};

function countByCode(diagnostics: Diagnostic[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of diagnostics) out[d.code] = (out[d.code] ?? 0) + 1;
  return out;
}
