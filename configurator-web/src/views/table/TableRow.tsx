import { memo, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import InputBase from "@mui/material/InputBase";
import Chip from "@mui/material/Chip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SettingsIcon from "@mui/icons-material/Settings";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import AddIcon from "@mui/icons-material/Add";
import FlagIcon from "@mui/icons-material/Flag";
import WarningIcon from "@mui/icons-material/Warning";
import DescriptionIcon from "@mui/icons-material/Description";
import EastIcon from "@mui/icons-material/East";

import type { Step, StepType } from "../../types/dsl";
import type { Diagnostic } from "../../services/validation";
import { useEditorStore } from "../../store/editorStore";
import {
  STEP_TYPE_LIST,
  STEP_TYPE_META,
  buildOptionRoutes,
  getStepLabel,
  summarizeNext,
} from "./stepHelpers";
import { StepTypeIcon } from "./StepTypeIcon";
import { NextSummaryChip } from "./NextSummaryChip";
import { StepRowExpanded } from "./StepRowExpanded";

const STEP_ID_REGEX = /^[a-z][a-z0-9_]{0,63}$/;

interface Props {
  step: Step;
  rowIndex: number; // позиция в scenario.steps (для DnD)
  isInitial: boolean;
  selected: boolean;
  expanded: boolean;
  diagnostics: Diagnostic[];
  allSteps: Step[]; // для GotoSelect внутри расширенной формы
  // DnD reorder (управляется родителем).
  dndEnabled: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onToggleExpand: (focus?: "view" | "options" | "next") => void;
}

// Карточка-строка шага: компактная сводка + кликом раскрывается на 3 секции
// редактирования. Заменяет прежнюю виртуализированную плотную таблицу.
export const TableRow = memo(function TableRow({
  step,
  rowIndex,
  isInitial,
  selected,
  expanded,
  diagnostics,
  allSteps,
  dndEnabled,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onToggleExpand,
}: Props) {
  const setSelected = useEditorStore((s) => s.setSelected);
  const setView = useEditorStore((s) => s.setView);
  const setInitialStep = useEditorStore((s) => s.setInitialStep);
  const renameStep = useEditorStore((s) => s.renameStep);
  const setStepType = useEditorStore((s) => s.setStepType);
  const removeStep = useEditorStore((s) => s.removeStep);
  const duplicateStep = useEditorStore((s) => s.duplicateStep);
  const patchStepView = useEditorStore((s) => s.patchStepView);
  const addStep = useEditorStore((s) => s.addStep);

  // черновики для inline-полей (label, id)
  const [labelDraft, setLabelDraft] = useState(getStepLabel(step));
  useEffect(() => setLabelDraft(getStepLabel(step)), [step]);

  const [idEditing, setIdEditing] = useState(false);
  const [idDraft, setIdDraft] = useState(step.id);
  useEffect(() => setIdDraft(step.id), [step.id]);

  const otherIds = new Set(allSteps.filter((s) => s.id !== step.id).map((s) => s.id));
  const idDuplicate = idDraft !== step.id && otherIds.has(idDraft);
  const idMalformed = idDraft !== step.id && !STEP_ID_REGEX.test(idDraft);
  const idInvalid = idDuplicate || idMalformed;

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [typeMenuAnchor, setTypeMenuAnchor] = useState<HTMLElement | null>(null);
  const [insertMenuAnchor, setInsertMenuAnchor] = useState<HTMLElement | null>(null);

  const errors = diagnostics.filter((d) => d.severity === "error");
  const warnings = diagnostics.filter((d) => d.severity === "warning");

  const meta = STEP_TYPE_META[step.type];
  const summary = summarizeNext(step);

  const commitLabel = () => {
    if (labelDraft !== getStepLabel(step)) {
      patchStepView(step.id, { label: labelDraft });
    }
  };
  const commitId = () => {
    if (idDraft === step.id) {
      setIdEditing(false);
      return;
    }
    if (idInvalid) {
      setIdDraft(step.id);
      setIdEditing(false);
      return;
    }
    renameStep(step.id, idDraft);
    setIdEditing(false);
  };

  const handleType = (newType: StepType) => {
    setTypeMenuAnchor(null);
    if (newType === step.type) return;
    if (
      window.confirm(
        `Сменить тип шага «${labelDraft || step.id}» на «${STEP_TYPE_META[newType].label}»? ` +
          `Поля шага будут заменены дефолтными для нового типа (опции, источник изображения и т.п.).`,
      )
    ) {
      setStepType(step.id, newType);
    }
  };

  const handleDelete = () => {
    setMenuAnchor(null);
    if (
      window.confirm(
        `Удалить шаг «${labelDraft || step.id}»? Все ссылки на него превратятся в null.`,
      )
    ) {
      removeStep(step.id);
    }
  };

  const handleDuplicate = () => {
    setMenuAnchor(null);
    duplicateStep(step.id);
  };
  const handleOpenInFlow = () => {
    setMenuAnchor(null);
    setSelected(step.id);
    setView("flow");
  };
  const handleOpenInInspector = () => {
    setMenuAnchor(null);
    setSelected(step.id);
  };

  const optionRoutes = buildOptionRoutes(step) ?? [];
  const optionRoutesWithRoute = optionRoutes.filter(
    (r) => r.ruleIndex !== null && (r.goto !== undefined || r.terminal),
  );

  return (
    <Box
      sx={{
        position: "relative",
        borderBottom: "1px solid",
        borderColor: isDragOver ? "primary.main" : "divider",
        borderTop: isDragOver ? "2px solid" : "1px solid transparent",
        borderTopColor: isDragOver ? "primary.main" : "transparent",
        bgcolor: selected ? "action.selected" : "background.paper",
        opacity: isDragging ? 0.45 : 1,
        // Левая полоса диагностики / стартовый шаг.
        boxShadow: errors.length > 0
          ? "inset 4px 0 0 0 var(--mui-palette-error-main, #d32f2f)"
          : warnings.length > 0
            ? "inset 4px 0 0 0 var(--mui-palette-warning-main, #ed6c02)"
            : isInitial
              ? "inset 4px 0 0 0 var(--mui-palette-success-main, #2e7d32)"
              : "none",
        "&:hover": { bgcolor: selected ? "action.selected" : "action.hover" },
      }}
      onDragOver={(e) => {
        if (!dndEnabled) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver();
      }}
      onDrop={(e) => {
        if (!dndEnabled) return;
        e.preventDefault();
        onDrop();
      }}
    >
      {/* === Свёрнутая (compact) строка === */}
      <Box
        onClick={() => {
          setSelected(step.id);
          onToggleExpand();
        }}
        sx={{
          display: "grid",
          // ┌── drag (28px)
          // │   ┌── start-chip + #N (auto, не уже содержимого — иначе СТАРТ обрезается)
          // │   │     ┌── тип шага + label (200px)
          // │   │     │     ┌── текст вопроса (1fr)
          // │   │     │     │   ┌── next-summary chip (240px)
          // │   │     │     │   │    ┌── badge диагностики (36px)
          // │   │     │     │   │    │   ┌── меню (40px)
          gridTemplateColumns: "28px auto 200px 1fr 240px 36px 40px",
          alignItems: "center",
          gap: 1,
          px: 1,
          minHeight: 64,
          cursor: "pointer",
          minWidth: 0, // позволяем 1fr сжиматься, но колонка auto ужимается под содержимое
        }}
      >
        {/* drag handle */}
        <Box
          draggable={dndEnabled}
          onDragStart={(e) => {
            if (!dndEnabled) {
              e.preventDefault();
              return;
            }
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("application/dsl-row-index", String(rowIndex));
            onDragStart();
          }}
          onDragEnd={onDragEnd}
          onClick={(e) => e.stopPropagation()}
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            color: "text.disabled",
            cursor: dndEnabled ? "grab" : "not-allowed",
            opacity: dndEnabled ? 0.6 : 0.25,
            "&:hover": dndEnabled ? { color: "text.primary", opacity: 1 } : undefined,
            "&:active": dndEnabled ? { cursor: "grabbing" } : undefined,
          }}
          title={dndEnabled ? "Перетащите, чтобы изменить порядок" : "Очистите фильтры"}
        >
          <DragIndicatorIcon fontSize="small" />
        </Box>

        {/* Стартовая отметка / номер.
            flexShrink: 0 — иначе при длинном лейбле справа Chip сжимается
            и текст обрезается до «Ст…», как было на скриншоте пользователя. */}
        <Stack
          direction="row"
          spacing={0.5}
          alignItems="center"
          onClick={(e) => e.stopPropagation()}
          sx={{ flexShrink: 0 }}
        >
          {isInitial ? (
            <Tooltip title="С этого шага начнётся сценарий">
              {/* MUI Chip по умолчанию режет .MuiChip-label через
                  text-overflow: ellipsis. Поэтому, когда соседний блок
                  захватывает место по flex, лейбл превращается в «Ст…».
                  Снимаем ellipsis и фиксируем ширину под содержимое. */}
              <Chip
                size="small"
                color="success"
                icon={<PlayArrowIcon sx={{ fontSize: 14 }} />}
                label="СТАРТ"
                sx={{
                  fontWeight: 700,
                  fontSize: 11,
                  height: 24,
                  flexShrink: 0,
                  flexGrow: 0,
                  width: "auto",
                  maxWidth: "none",
                  letterSpacing: 0.3,
                  "& .MuiChip-label": {
                    px: 0.75,
                    overflow: "visible",
                    textOverflow: "clip",
                    whiteSpace: "nowrap",
                  },
                  "& .MuiChip-icon": { ml: 0.5, mr: -0.25 },
                }}
              />
            </Tooltip>
          ) : (
            <Tooltip title="Сделать этот шаг начальным">
              <IconButton
                size="small"
                onClick={() => setInitialStep(step.id)}
                sx={{ opacity: 0.4, "&:hover": { opacity: 1 } }}
              >
                <PlayArrowIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontSize: 11, flexShrink: 0 }}
          >
            #{rowIndex + 1}
          </Typography>
        </Stack>

        {/* Тип шага */}
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          onClick={(e) => {
            e.stopPropagation();
            setTypeMenuAnchor(e.currentTarget as HTMLElement);
          }}
          sx={{
            cursor: "pointer",
            borderRadius: 1,
            px: 0.75,
            py: 0.5,
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <StepTypeIcon
            type={step.type}
            sx={{ color: `${meta.color}.main` }}
          />
          <Stack spacing={-0.25} sx={{ overflow: "hidden" }}>
            <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.2 }}>
              {meta.label}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                fontFamily: "monospace",
                fontSize: 10,
                lineHeight: 1.2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {step.type}
            </Typography>
          </Stack>
        </Stack>

        {/* Текст для оператора (или редактор id если кликнули по id) */}
        <Box onClick={(e) => e.stopPropagation()}>
          {!idEditing ? (
            <Stack spacing={-0.25}>
              <InputBase
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onBlur={commitLabel}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") {
                    setLabelDraft(getStepLabel(step));
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="Текст для оператора (например, «Что вы видите?»)"
                inputProps={{
                  "aria-label": "step label",
                  style: { fontSize: 14, fontWeight: 500 },
                }}
                sx={{
                  px: 0.5,
                  borderRadius: 0.5,
                  border: "1px solid transparent",
                  "&:hover": { borderColor: "divider" },
                  "&.Mui-focused": { borderColor: "primary.main" },
                }}
                fullWidth
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontFamily: "monospace", fontSize: 10, pl: 0.5, cursor: "text" }}
                onClick={() => setIdEditing(true)}
                title="Кликните, чтобы изменить id"
              >
                id: {step.id}
              </Typography>
            </Stack>
          ) : (
            <Stack spacing={0}>
              <InputBase
                autoFocus
                value={idDraft}
                onChange={(e) => setIdDraft(e.target.value)}
                onBlur={commitId}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") {
                    setIdDraft(step.id);
                    setIdEditing(false);
                  }
                }}
                error={idInvalid}
                inputProps={{
                  style: { fontFamily: "monospace", fontSize: 13 },
                  "aria-label": "step id",
                }}
                sx={{
                  px: 0.5,
                  borderRadius: 0.5,
                  border: "1px solid",
                  borderColor: idInvalid ? "error.main" : "primary.main",
                }}
                fullWidth
              />
              <Typography
                variant="caption"
                color={idInvalid ? "error" : "text.secondary"}
                sx={{ fontSize: 10, pl: 0.5 }}
              >
                {idDuplicate
                  ? "id уже занят"
                  : idMalformed
                    ? "snake_case латиницей: a-z, 0-9, _"
                    : "Enter — сохранить, Esc — отменить"}
              </Typography>
            </Stack>
          )}
        </Box>

        {/* «Что после» */}
        <Box onClick={(e) => e.stopPropagation()}>
          <NextSummaryChip
            step={step}
            onClick={() => onToggleExpand("next")}
          />
        </Box>

        {/* Диагностика */}
        <Box onClick={(e) => e.stopPropagation()}>
          {errors.length + warnings.length > 0 && (
            <Tooltip
              title={
                <Box>
                  {errors.map((d, i) => (
                    <Box key={`e${i}`} sx={{ fontSize: 12, color: "#fca5a5" }}>
                      • {d.humanMessage ?? d.message}
                    </Box>
                  ))}
                  {warnings.map((d, i) => (
                    <Box key={`w${i}`} sx={{ fontSize: 12, color: "#fcd34d" }}>
                      • {d.humanMessage ?? d.message}
                    </Box>
                  ))}
                </Box>
              }
            >
              <IconButton size="small">
                {errors.length > 0 ? (
                  <ErrorOutlineIcon fontSize="small" color="error" />
                ) : (
                  <WarningAmberIcon fontSize="small" color="warning" />
                )}
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Меню «⋯» + развернуть */}
        <Stack
          direction="row"
          spacing={0}
          onClick={(e) => e.stopPropagation()}
          sx={{ justifySelf: "flex-end" }}
        >
          <IconButton
            size="small"
            onClick={(e) => setMenuAnchor(e.currentTarget)}
            aria-label="more actions"
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => onToggleExpand()}
            aria-label={expanded ? "свернуть" : "развернуть"}
          >
            {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </Stack>
      </Box>

      {/* === Sub-rows: ветки и финал прямо под строкой === */}
      {!expanded && (summary.kind === "branches" || optionRoutesWithRoute.length > 0) && (
        <Box sx={{ px: 4, pb: 1 }}>
          <Stack spacing={0.5}>
            {optionRoutesWithRoute.slice(0, 4).map((r) => (
              <Stack
                key={r.optionId}
                direction="row"
                spacing={0.5}
                alignItems="center"
                sx={{ fontSize: 12, color: "text.secondary" }}
              >
                <span style={{ opacity: 0.6 }}>↳ если</span>
                <Chip size="small" label={`«${r.optionLabel}»`} variant="outlined" />
                <EastIcon fontSize="inherit" sx={{ fontSize: 14 }} />
                {r.terminal === "finish" && (
                  <Chip
                    size="small"
                    color="success"
                    icon={<FlagIcon />}
                    label="Завершить"
                  />
                )}
                {r.terminal === "escalate" && (
                  <Chip
                    size="small"
                    color="warning"
                    icon={<WarningIcon />}
                    label="Эскалировать"
                  />
                )}
                {r.terminal === "generateReport" && (
                  <Chip size="small" color="info" icon={<DescriptionIcon />} label="Отчёт" />
                )}
                {!r.terminal && r.goto && (
                  <Chip
                    size="small"
                    color="primary"
                    label={r.goto}
                    sx={{ fontFamily: "monospace" }}
                  />
                )}
                {!r.terminal && r.goto === null && (
                  <Chip size="small" variant="outlined" label="остаться" />
                )}
              </Stack>
            ))}
            {optionRoutesWithRoute.length > 4 && (
              <Typography variant="caption" color="text.secondary">
                …и ещё {optionRoutesWithRoute.length - 4} ветк{pluralEnd(optionRoutesWithRoute.length - 4)}
              </Typography>
            )}
          </Stack>
        </Box>
      )}

      {/* === Развёрнутый редактор === */}
      <Collapse in={expanded} unmountOnExit>
        <StepRowExpanded step={step} allSteps={allSteps} />
      </Collapse>

      {/* === Разделитель «вставить шаг сюда» под строкой ===
          Виден по hover на саму полоску. Не наезжает на содержимое строки —
          живёт строго в зазоре между двумя соседями. */}
      <Box
        onClick={(e) => e.stopPropagation()}
        sx={{
          height: 12,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          position: "relative",
          opacity: 0,
          transition: "opacity 0.12s",
          "&:hover": { opacity: 1 },
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: 16,
            right: 16,
            height: 1,
            bgcolor: "primary.main",
            transform: "translateY(-50%)",
          }}
        />
        <Tooltip title="Вставить новый шаг после этого">
          <IconButton
            size="small"
            color="primary"
            onClick={(e) => setInsertMenuAnchor(e.currentTarget)}
            sx={{
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "primary.main",
              width: 22,
              height: 22,
              zIndex: 1,
              "&:hover": { bgcolor: "primary.main", color: "primary.contrastText" },
            }}
          >
            <AddIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Меню действий */}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            onToggleExpand();
          }}
        >
          <ListItemIcon>
            {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText>{expanded ? "Свернуть" : "Развернуть"}</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDuplicate}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Дублировать</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleOpenInInspector}>
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Расширенные настройки (инспектор)</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleOpenInFlow}>
          <ListItemIcon>
            <OpenInNewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Открыть на карте переходов</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDelete}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText sx={{ color: "error.main" }}>Удалить</ListItemText>
        </MenuItem>
      </Menu>

      {/* Меню смены типа */}
      <Menu
        anchorEl={typeMenuAnchor}
        open={Boolean(typeMenuAnchor)}
        onClose={() => setTypeMenuAnchor(null)}
      >
        {STEP_TYPE_LIST.map((m) => (
          <MenuItem
            key={m.type}
            selected={m.type === step.type}
            onClick={() => handleType(m.type)}
          >
            <ListItemIcon>
              <StepTypeIcon type={m.type} sx={{ color: `${m.color}.main` }} />
            </ListItemIcon>
            <Stack spacing={-0.25}>
              <Typography variant="body2">{m.label}</Typography>
              <Typography variant="caption" color="text.secondary">
                {m.description}
              </Typography>
            </Stack>
          </MenuItem>
        ))}
      </Menu>

      {/* Меню «вставить шаг после» */}
      <Menu
        anchorEl={insertMenuAnchor}
        open={Boolean(insertMenuAnchor)}
        onClose={() => setInsertMenuAnchor(null)}
      >
        {STEP_TYPE_LIST.map((m) => (
          <MenuItem
            key={m.type}
            onClick={() => {
              addStep(m.type, { afterStepId: step.id });
              setInsertMenuAnchor(null);
            }}
          >
            <ListItemIcon>
              <StepTypeIcon type={m.type} sx={{ color: `${m.color}.main` }} />
            </ListItemIcon>
            <ListItemText>{m.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
});

function pluralEnd(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "а";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "и";
  return "";
}
