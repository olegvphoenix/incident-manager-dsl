import { useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Tooltip from "@mui/material/Tooltip";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import AddIcon from "@mui/icons-material/Add";
import SettingsIcon from "@mui/icons-material/Settings";

import { useEditorStore } from "../../store/editorStore";
import type { Step, StepId, StepType } from "../../types/dsl";
import { STEP_TYPES } from "../../types/dsl";
import type { Diagnostic } from "../../services/validation";
import { TableRow } from "./TableRow";
import { TableEmptyState } from "./TableEmptyState";
import { ScenarioSettingsDialog } from "./ScenarioSettingsDialog";
import {
  STEP_TYPE_LIST,
  STEP_TYPE_META,
  getStepLabel,
} from "./stepHelpers";
import { StepTypeIcon } from "./StepTypeIcon";

const TOOLBAR_HEIGHT = 56;

// Главный табличный редактор. Default view приложения.
//
// Архитектура: одна строка = одна «карточка шага». Свёрнута — компактная
// сводка (тип, текст для оператора, что после). Развёрнута — три секции
// редактирования. Сложный JSONLogic и расширенные параметры всё ещё в
// инспекторе справа, но 80% сценариев конструируются без него.
export const TableView = () => {
  const scenario = useEditorStore((s) => s.scenario);
  const diagnostics = useEditorStore((s) => s.ui.diagnostics);
  const selectedStepId = useEditorStore((s) => s.ui.selectedStepId);
  const loadError = useEditorStore((s) => s.ui.loadError);
  const reorderSteps = useEditorStore((s) => s.reorderSteps);
  const addStep = useEditorStore((s) => s.addStep);
  const setSelected = useEditorStore((s) => s.setSelected);
  const setDiagnosticsPanelOpen = useEditorStore((s) => s.setDiagnosticsPanelOpen);

  const parentRef = useRef<HTMLDivElement | null>(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<StepType | "all">("all");
  const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null);
  const [scenarioDialogOpen, setScenarioDialogOpen] = useState(false);

  // Множество раскрытых строк. По умолчанию — выбранный шаг развёрнут,
  // остальные свёрнуты. Раскрытие меняется только по явному действию
  // пользователя; click по пустой строке выбирает её, но не разворачивает.
  const [expandedIds, setExpandedIds] = useState<Set<StepId>>(new Set());

  // DnD-reorder состояние. Индексы относятся к scenario.steps.
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dndEnabled = search.trim() === "" && typeFilter === "all";

  const handleDragStart = (index: number) => {
    if (!dndEnabled) return;
    setDragFromIndex(index);
  };
  const handleDragOver = (index: number) => {
    if (!dndEnabled || dragFromIndex === null) return;
    if (dragOverIndex !== index) setDragOverIndex(index);
  };
  const handleDragEnd = () => {
    setDragFromIndex(null);
    setDragOverIndex(null);
  };
  const handleDrop = (toIndex: number) => {
    if (!dndEnabled) return;
    if (dragFromIndex !== null && dragFromIndex !== toIndex) {
      reorderSteps(dragFromIndex, toIndex);
    }
    handleDragEnd();
  };

  // Диагностика по шагам.
  const diagByStep = useMemo(() => {
    const m = new Map<StepId, Diagnostic[]>();
    for (const d of diagnostics) {
      if (!d.stepId) continue;
      const list = m.get(d.stepId) ?? [];
      list.push(d);
      m.set(d.stepId, list);
    }
    return m;
  }, [diagnostics]);

  const filteredSteps = useMemo(() => {
    if (!scenario) return [] as Step[];
    const q = search.trim().toLowerCase();
    return scenario.steps.filter((s) => {
      if (typeFilter !== "all" && s.type !== typeFilter) return false;
      if (!q) return true;
      // Поиск по id, типу, заголовку и тексту для оператора (view.label),
      // плюс по подписям опций — пользователь вводит то, что видел в раннере.
      const view = (s as { view?: { options?: { label: string }[] } }).view;
      const optLabels = view?.options?.map((o) => o.label).join(" ") ?? "";
      const hay = `${s.id} ${s.title ?? ""} ${s.type} ${getStepLabel(s)} ${optLabels}`.toLowerCase();
      return hay.includes(q);
    });
  }, [scenario, search, typeFilter]);

  if (!scenario) return null;

  const totalErrors = diagnostics.filter((d) => d.severity === "error").length;
  const totalWarnings = diagnostics.filter((d) => d.severity === "warning").length;

  const isEmpty = scenario.steps.length === 0;

  const handleAddStep = (type: StepType) => {
    setAddAnchor(null);
    const afterId =
      selectedStepId && scenario.steps.some((s) => s.id === selectedStepId)
        ? selectedStepId
        : undefined;
    addStep(type, afterId ? { afterStepId: afterId } : undefined);
  };

  const toggleExpand = (id: StepId, focus?: "view" | "options" | "next") => {
    setSelected(id);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id) && !focus) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    if (focus) {
      // Прокрутим к строке после раскрытия.
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-step-row="${id}"]`);
        if (el && "scrollIntoView" in el) {
          (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      });
    }
  };

  return (
    <Box sx={{ height: "100%", width: "100%", display: "flex", flexDirection: "column" }}>
      {/* Toolbar */}
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        sx={{
          height: TOOLBAR_HEIGHT,
          minHeight: TOOLBAR_HEIGHT,
          px: 2,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Tooltip title="Добавить новый шаг сценария">
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={(e) => setAddAnchor(e.currentTarget)}
            size="small"
          >
            Шаг
          </Button>
        </Tooltip>
        <Menu
          anchorEl={addAnchor}
          open={Boolean(addAnchor)}
          onClose={() => setAddAnchor(null)}
          PaperProps={{ sx: { minWidth: 280 } }}
        >
          {selectedStepId && (
            <MenuItem disabled sx={{ fontSize: 11 }}>
              <ListItemText
                primary="Вставить после выбранного шага"
                secondary={`(после: ${selectedStepId})`}
              />
            </MenuItem>
          )}
          {STEP_TYPE_LIST.map((m) => (
            <MenuItem key={m.type} onClick={() => handleAddStep(m.type)}>
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

        <TextField
          size="small"
          placeholder="Поиск по тексту, id или подписям вариантов"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 320 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearch("")}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
        <Select
          size="small"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as StepType | "all")}
          sx={{ minWidth: 200 }}
          renderValue={(v) =>
            v === "all"
              ? "Все типы шагов"
              : `${STEP_TYPE_META[v as StepType].label}`
          }
        >
          <MenuItem value="all">Все типы шагов</MenuItem>
          {STEP_TYPES.map((t) => (
            <MenuItem key={t} value={t}>
              <Stack direction="row" spacing={1} alignItems="center">
                <StepTypeIcon type={t} sx={{ color: `${STEP_TYPE_META[t].color}.main` }} />
                <span>{STEP_TYPE_META[t].label}</span>
              </Stack>
            </MenuItem>
          ))}
        </Select>

        <Box sx={{ flex: 1 }} />

        <Tooltip title="Имя сценария, версия, начальный шаг, таймеры">
          <Button
            variant="outlined"
            size="small"
            startIcon={<SettingsIcon />}
            onClick={() => setScenarioDialogOpen(true)}
          >
            Настройки сценария
          </Button>
        </Tooltip>

        <Typography variant="caption" color="text.secondary">
          {filteredSteps.length} из {scenario.steps.length}{" "}
          {pluralSteps(scenario.steps.length)}
        </Typography>
        {totalErrors > 0 && (
          <Tooltip title="Открыть панель диагностики">
            <Chip
              size="small"
              color="error"
              label={`${totalErrors} ${totalErrors === 1 ? "ошибка" : "ошибок"}`}
              onClick={() => setDiagnosticsPanelOpen(true)}
            />
          </Tooltip>
        )}
        {totalWarnings > 0 && (
          <Tooltip title="Открыть панель диагностики">
            <Chip
              size="small"
              color="warning"
              label={`${totalWarnings} ${totalWarnings === 1 ? "предупр." : "предупр."}`}
              onClick={() => setDiagnosticsPanelOpen(true)}
            />
          </Tooltip>
        )}
      </Stack>

      {loadError && (
        <Alert severity="error" sx={{ borderRadius: 0 }}>
          {loadError}
        </Alert>
      )}

      {/* Список карточек */}
      <Box ref={parentRef} sx={{ flex: 1, overflow: "auto" }}>
        {isEmpty ? (
          <TableEmptyState />
        ) : filteredSteps.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>
            <Typography variant="body2">
              Ничего не найдено по фильтру.{" "}
              <Button
                size="small"
                variant="text"
                onClick={() => {
                  setSearch("");
                  setTypeFilter("all");
                }}
              >
                Сбросить
              </Button>
            </Typography>
          </Box>
        ) : (
          filteredSteps.map((step) => {
            const indexInScenario = scenario.steps.indexOf(step);
            return (
              <Box key={step.id} data-step-row={step.id}>
                <TableRow
                  step={step}
                  rowIndex={indexInScenario}
                  isInitial={scenario.initialStepId === step.id}
                  selected={selectedStepId === step.id}
                  expanded={expandedIds.has(step.id)}
                  diagnostics={diagByStep.get(step.id) ?? []}
                  allSteps={scenario.steps}
                  dndEnabled={dndEnabled}
                  isDragging={dragFromIndex === indexInScenario}
                  isDragOver={
                    dragOverIndex === indexInScenario &&
                    dragFromIndex !== null &&
                    dragFromIndex !== indexInScenario
                  }
                  onDragStart={() => handleDragStart(indexInScenario)}
                  onDragOver={() => handleDragOver(indexInScenario)}
                  onDrop={() => handleDrop(indexInScenario)}
                  onDragEnd={handleDragEnd}
                  onToggleExpand={(focus) => toggleExpand(step.id, focus)}
                />
              </Box>
            );
          })
        )}
      </Box>

      {/* Подсказка снизу */}
      <Box
        sx={{
          height: 32,
          minHeight: 32,
          display: "flex",
          alignItems: "center",
          gap: 2,
          px: 2,
          borderTop: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          color: "text.secondary",
          fontSize: 12,
        }}
      >
        <span>Кликните по строке — раскроется редактор. Перетащите за «∷» — поменяете порядок.</span>
        <Box sx={{ flex: 1 }} />
        {!dndEnabled && (
          <Typography variant="caption" color="warning.main">
            Поиск/фильтр активен — сортировка перетаскиванием отключена.
          </Typography>
        )}
      </Box>

      <ScenarioSettingsDialog
        open={scenarioDialogOpen}
        onClose={() => setScenarioDialogOpen(false)}
      />
    </Box>
  );
};

function pluralSteps(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "шаг";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "шага";
  return "шагов";
}

// Заглушка использования — ранее экспорт в строке `_TableProps`.
export type _TableProps = { selectedStepId: StepId | null };
