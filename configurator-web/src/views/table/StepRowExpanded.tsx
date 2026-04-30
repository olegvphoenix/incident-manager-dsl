import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Alert from "@mui/material/Alert";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import FlagIcon from "@mui/icons-material/Flag";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import DescriptionIcon from "@mui/icons-material/Description";
import EastIcon from "@mui/icons-material/East";
import LoopIcon from "@mui/icons-material/Loop";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import ListAltIcon from "@mui/icons-material/ListAlt";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import MapIcon from "@mui/icons-material/Map";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import LinkIcon from "@mui/icons-material/Link";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ScheduleIcon from "@mui/icons-material/Schedule";
import RemoveIcon from "@mui/icons-material/Remove";

import type { Step, StepId } from "../../types/dsl";
import { useEditorStore } from "../../store/editorStore";
import {
  buildOptionRoutes,
  countComplexRules,
  detectDefaultMode,
} from "./stepHelpers";
import { StepPreview } from "./StepPreview";

interface Props {
  step: Step;
  // допустимые цели для goto-выпадающих списков (= все остальные шаги).
  // Передаётся снаружи, чтобы не подписываться повторно в каждой строке.
  allSteps: Step[];
  // Фокус-секция, когда раскрытие пришло по клику на «Что после».
  initialFocus?: "view" | "options" | "next";
}

// Развёрнутый редактор шага. Три понятных секции: что увидит оператор,
// варианты ответа (если применимо), что случится после. JSONLogic и сложные
// конструкции вынесены в инспектор; для шага без сложных правил всё
// делается прямо здесь.
export const StepRowExpanded = ({ step, allSteps, initialFocus }: Props) => {
  const setView = useEditorStore((s) => s.setView);
  const setSelected = useEditorStore((s) => s.setSelected);

  const openInFlow = () => {
    setSelected(step.id);
    setView("flow");
  };
  const openInInspector = () => {
    setSelected(step.id);
  };

  const sectionRefs = {
    view: initialFocus === "view",
    options: initialFocus === "options",
    next: initialFocus === "next",
  };

  return (
    <Box
      sx={{
        bgcolor: "background.default",
        borderTop: "1px dashed",
        borderColor: "divider",
        px: 3,
        py: 2,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <Stack direction="row" spacing={2} alignItems="flex-start">
        {/* левая колонка: формы редактирования */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack spacing={2.5}>
            <SectionWhatOperatorSees step={step} highlight={sectionRefs.view} />
            <OptionsSection step={step} allSteps={allSteps} highlight={sectionRefs.options} />
            <DefaultSection step={step} allSteps={allSteps} highlight={sectionRefs.next} />
          </Stack>
        </Box>

        {/* правая колонка: «как увидит оператор» — наглядный мини-превью */}
        <Box sx={{ width: 280, flexShrink: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
            Так увидит оператор
          </Typography>
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1.5,
              p: 1.5,
              bgcolor: "background.paper",
              minHeight: 120,
            }}
          >
            <StepPreview step={step} />
          </Box>

          <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
            <Tooltip title="Открыть на карте переходов">
              <Button
                size="small"
                variant="text"
                startIcon={<OpenInNewIcon fontSize="small" />}
                onClick={openInFlow}
              >
                На карте
              </Button>
            </Tooltip>
            <Tooltip title="Расширенный режим (правый инспектор)">
              <Button size="small" variant="text" onClick={openInInspector}>
                Расш. режим
              </Button>
            </Tooltip>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
};

// === Секция A. Что увидит оператор ===

const SectionWhatOperatorSees = ({
  step,
  highlight,
}: {
  step: Step;
  highlight?: boolean;
}) => {
  const patchStepView = useEditorStore((s) => s.patchStepView);
  const view = (step as { view?: Record<string, unknown> }).view ?? {};
  const label = (view.label as string | undefined) ?? "";
  const required = view.required as boolean | undefined;
  const placeholder = view.placeholder as string | undefined;

  return (
    <SectionFrame
      icon={<HelpOutlineIcon fontSize="small" sx={{ color: "primary.main" }} />}
      title="Что увидит оператор"
      subtitle="Текст вопроса, инструкции или подпись для оператора в раннере."
      highlight={highlight}
    >
      <TextField
        label="Текст для оператора"
        placeholder="Например: «Что вы видите на камере?»"
        value={label}
        onChange={(e) => patchStepView(step.id, { label: e.target.value })}
        fullWidth
        autoFocus={highlight}
        helperText={
          label.trim() === ""
            ? "Без текста оператор не поймёт, чего от него хотят."
            : undefined
        }
        error={label.trim() === ""}
      />

      {step.type === "Comment" && (
        <TextField
          label="Подсказка под полем (placeholder)"
          value={placeholder ?? ""}
          onChange={(e) =>
            patchStepView(step.id, {
              placeholder: e.target.value === "" ? undefined : e.target.value,
            })
          }
          fullWidth
        />
      )}

      {step.type === "Image" && (
        <TextField
          select
          label="Источник изображения"
          value={(view.source as string | undefined) ?? "operator"}
          onChange={(e) => patchStepView(step.id, { source: e.target.value })}
          fullWidth
        >
          <MenuItem value="camera">
            <Stack direction="row" spacing={1} alignItems="center">
              <PhotoCameraIcon fontSize="small" />
              <span>С камеры</span>
            </Stack>
          </MenuItem>
          <MenuItem value="map">
            <Stack direction="row" spacing={1} alignItems="center">
              <MapIcon fontSize="small" />
              <span>С карты</span>
            </Stack>
          </MenuItem>
          <MenuItem value="operator">
            <Stack direction="row" spacing={1} alignItems="center">
              <AttachFileIcon fontSize="small" />
              <span>Прикрепит оператор</span>
            </Stack>
          </MenuItem>
          <MenuItem value="fixed">
            <Stack direction="row" spacing={1} alignItems="center">
              <LinkIcon fontSize="small" />
              <span>Фиксированный URL</span>
            </Stack>
          </MenuItem>
        </TextField>
      )}

      {step.type === "Image" && view.source === "fixed" && (
        <TextField
          label="URL изображения"
          value={(view.fixedSrc as string | undefined) ?? ""}
          onChange={(e) => patchStepView(step.id, { fixedSrc: e.target.value })}
          fullWidth
        />
      )}

      {step.type === "Datetime" && (
        <TextField
          select
          label="Что вводит оператор"
          value={(view.kind as string | undefined) ?? "datetime"}
          onChange={(e) => patchStepView(step.id, { kind: e.target.value })}
          fullWidth
        >
          <MenuItem value="date">
            <Stack direction="row" spacing={1} alignItems="center">
              <CalendarTodayIcon fontSize="small" />
              <span>Только дата</span>
            </Stack>
          </MenuItem>
          <MenuItem value="time">
            <Stack direction="row" spacing={1} alignItems="center">
              <AccessTimeIcon fontSize="small" />
              <span>Только время</span>
            </Stack>
          </MenuItem>
          <MenuItem value="datetime">
            <Stack direction="row" spacing={1} alignItems="center">
              <ScheduleIcon fontSize="small" />
              <span>Дата и время</span>
            </Stack>
          </MenuItem>
        </TextField>
      )}

      {step.type === "Button" && (
        <TextField
          select
          label="Стиль кнопки"
          value={(view.emphasis as string | undefined) ?? "primary"}
          onChange={(e) => patchStepView(step.id, { emphasis: e.target.value })}
          fullWidth
        >
          <MenuItem value="primary">Главная (синяя, заметная)</MenuItem>
          <MenuItem value="secondary">Обычная</MenuItem>
          <MenuItem value="destructive">Опасная (красная)</MenuItem>
        </TextField>
      )}

      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={required !== false}
            onChange={(e) => patchStepView(step.id, { required: e.target.checked })}
          />
        }
        label="Обязательно для заполнения"
      />
    </SectionFrame>
  );
};

// === Секция B. Варианты ответа (с маршрутом) ===

const HAS_OPTIONS = new Set(["RadioButton", "Checkbox", "Select"]);

const OptionsSection = ({
  step,
  allSteps,
  highlight,
}: {
  step: Step;
  allSteps: Step[];
  highlight?: boolean;
}) => {
  const addStepOption = useEditorStore((s) => s.addStepOption);
  const removeStepOption = useEditorStore((s) => s.removeStepOption);
  const reorderStepOption = useEditorStore((s) => s.reorderStepOption);
  const patchStepOption = useEditorStore((s) => s.patchStepOption);
  const setOptionRoute = useEditorStore((s) => s.setOptionRoute);

  if (!HAS_OPTIONS.has(step.type)) return null;

  const routes = buildOptionRoutes(step) ?? [];
  const complex = countComplexRules(step);

  return (
    <SectionFrame
      icon={<ListAltIcon fontSize="small" sx={{ color: "primary.main" }} />}
      title="Варианты ответа"
      subtitle="Каждый вариант можно отдельно направить в нужный шаг или сразу завершить инцидент."
      highlight={highlight}
    >
      {complex > 0 && (
        <Alert severity="info" sx={{ py: 0 }}>
          У этого шага есть {complex} сложн{complex === 1 ? "ое правило" : "ых правил"} с
          составным условием. Они отображаются на карте переходов и редактируются в расширенном
          режиме (инспектор справа).
        </Alert>
      )}

      <Stack spacing={1}>
        {routes.map((r, idx) => {
          const isLast = idx === routes.length - 1;
          const moveUp = () => {
            if (idx > 0) reorderStepOption(step.id, idx, idx - 1);
          };
          const moveDown = () => {
            if (!isLast) reorderStepOption(step.id, idx, idx + 1);
          };
          const remove = () => {
            if (routes.length <= 1) return;
            removeStepOption(step.id, idx);
          };
          return (
            <OptionRow
              key={r.optionId}
              stepId={step.id}
              allSteps={allSteps}
              optionIndex={idx}
              optionId={r.optionId}
              optionLabel={r.optionLabel}
              currentGoto={r.goto}
              currentTerminal={r.terminal}
              boundToRule={r.ruleIndex !== null}
              onChangeLabel={(label) => patchStepOption(step.id, idx, { label })}
              onChangeId={(id) => patchStepOption(step.id, idx, { id })}
              onMoveUp={moveUp}
              onMoveDown={moveDown}
              onRemove={remove}
              canRemove={routes.length > 1}
              onSetRoute={(outcome) => setOptionRoute(step.id, r.optionId, outcome)}
            />
          );
        })}

        <Box>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => addStepOption(step.id)}
          >
            Добавить вариант
          </Button>
        </Box>
      </Stack>

      <Typography variant="caption" color="text.secondary">
        Если оператор выберет вариант, для которого маршрут не задан — сценарий пойдёт по
        правилу «Что после, по умолчанию» (секция ниже).
      </Typography>
    </SectionFrame>
  );
};

interface OptionRowProps {
  stepId: StepId;
  allSteps: Step[];
  optionIndex: number;
  optionId: string;
  optionLabel: string;
  currentGoto: StepId | null | undefined;
  currentTerminal: string | undefined;
  boundToRule: boolean;
  onChangeLabel: (label: string) => void;
  onChangeId: (id: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  canRemove: boolean;
  onSetRoute: (
    outcome:
      | { kind: "goto"; goto: StepId | null }
      | { kind: "terminal"; type: "finish" | "escalate" | "assign" | "generateReport" | "callMacro" }
      | { kind: "default" },
  ) => void;
}

const OptionRow = ({
  stepId,
  allSteps,
  optionIndex,
  optionId,
  optionLabel,
  currentGoto,
  currentTerminal,
  boundToRule,
  onChangeLabel,
  onChangeId,
  onMoveUp,
  onMoveDown,
  onRemove,
  canRemove,
  onSetRoute,
}: OptionRowProps) => {
  const [labelDraft, setLabelDraft] = useState(optionLabel);
  const [idDraft, setIdDraft] = useState(optionId);
  const [showId, setShowId] = useState(false);

  // Селект «куда вести»: специальные значения __default__ / __finish__ / __escalate__
  const ROUTE_DEFAULT = "__default__";
  const ROUTE_FINISH = "__finish__";
  const ROUTE_ESCALATE = "__escalate__";
  const ROUTE_REPORT = "__report__";

  const value = (() => {
    if (!boundToRule) return ROUTE_DEFAULT;
    if (currentTerminal === "finish") return ROUTE_FINISH;
    if (currentTerminal === "escalate") return ROUTE_ESCALATE;
    if (currentTerminal === "generateReport") return ROUTE_REPORT;
    if (currentGoto === undefined || currentGoto === null) return ROUTE_DEFAULT;
    return currentGoto;
  })();

  const onChange = (v: string) => {
    if (v === ROUTE_DEFAULT) onSetRoute({ kind: "default" });
    else if (v === ROUTE_FINISH) onSetRoute({ kind: "terminal", type: "finish" });
    else if (v === ROUTE_ESCALATE) onSetRoute({ kind: "terminal", type: "escalate" });
    else if (v === ROUTE_REPORT) onSetRoute({ kind: "terminal", type: "generateReport" });
    else onSetRoute({ kind: "goto", goto: v });
  };

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        p: 1,
        display: "grid",
        gridTemplateColumns: "minmax(160px, 1fr) auto minmax(220px, 1fr) auto",
        gap: 1,
        alignItems: "center",
      }}
    >
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Chip size="small" label={`#${optionIndex + 1}`} variant="outlined" />
        <TextField
          size="small"
          value={labelDraft}
          onChange={(e) => setLabelDraft(e.target.value)}
          onBlur={() => {
            if (labelDraft !== optionLabel) onChangeLabel(labelDraft);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          placeholder="Текст варианта"
          fullWidth
        />
      </Stack>

      <EastIcon fontSize="small" color="action" />

      <TextField
        select
        size="small"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        fullWidth
      >
        <MenuItem value={ROUTE_DEFAULT}>
          <Stack direction="row" spacing={1} alignItems="center">
            <RemoveIcon fontSize="small" sx={{ color: "text.disabled" }} />
            <span style={{ color: "var(--mui-palette-text-secondary, #666)" }}>
              (по умолчанию — как ниже)
            </span>
          </Stack>
        </MenuItem>
        <MenuItem value={ROUTE_FINISH}>
          <Stack direction="row" spacing={1} alignItems="center">
            <FlagIcon fontSize="small" sx={{ color: "success.main" }} />
            <span>Завершить инцидент</span>
          </Stack>
        </MenuItem>
        <MenuItem value={ROUTE_ESCALATE}>
          <Stack direction="row" spacing={1} alignItems="center">
            <WarningAmberIcon fontSize="small" sx={{ color: "warning.main" }} />
            <span>Эскалировать</span>
          </Stack>
        </MenuItem>
        <MenuItem value={ROUTE_REPORT}>
          <Stack direction="row" spacing={1} alignItems="center">
            <DescriptionIcon fontSize="small" sx={{ color: "info.main" }} />
            <span>Сгенерировать отчёт</span>
          </Stack>
        </MenuItem>
        <Divider />
        {allSteps
          .filter((s) => s.id !== stepId)
          .map((s) => (
            <MenuItem key={s.id} value={s.id}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ width: "100%" }}>
                <EastIcon fontSize="small" sx={{ color: "primary.main" }} />
                <span style={{ fontFamily: "monospace" }}>{s.id}</span>
                {s.title && (
                  <span style={{ color: "var(--mui-palette-text-secondary, #888)", fontSize: 11 }}>
                    · {s.title}
                  </span>
                )}
              </Stack>
            </MenuItem>
          ))}
      </TextField>

      <Stack direction="row" spacing={0}>
        <Tooltip title={showId ? "Скрыть id" : "Показать/изменить id варианта (для разработчиков)"}>
          <IconButton size="small" onClick={() => setShowId((x) => !x)}>
            <Typography
              sx={{ fontFamily: "monospace", fontSize: 10, fontWeight: showId ? 700 : 400 }}
            >
              id
            </Typography>
          </IconButton>
        </Tooltip>
        <Tooltip title="Вверх">
          <span>
            <IconButton size="small" onClick={onMoveUp} disabled={optionIndex === 0}>
              <ArrowUpwardIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Вниз">
          <IconButton size="small" onClick={onMoveDown}>
            <ArrowDownwardIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={canRemove ? "Удалить вариант" : "Должен остаться хотя бы один вариант"}>
          <span>
            <IconButton size="small" color="error" onClick={onRemove} disabled={!canRemove}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {showId && (
        <Box sx={{ gridColumn: "1 / -1", pt: 0.5 }}>
          <TextField
            size="small"
            label="id варианта (для условий, snake_case)"
            value={idDraft}
            onChange={(e) => setIdDraft(e.target.value)}
            onBlur={() => {
              if (idDraft !== optionId) onChangeId(idDraft);
              else setIdDraft(optionId);
            }}
            inputProps={{ style: { fontFamily: "monospace" } }}
            sx={{ minWidth: 280 }}
            helperText="Используется в правилах. При переименовании привязанные правила обновятся автоматически."
          />
        </Box>
      )}
    </Box>
  );
};

// === Секция C. Что после (default) ===

const DefaultSection = ({
  step,
  allSteps,
  highlight,
}: {
  step: Step;
  allSteps: Step[];
  highlight?: boolean;
}) => {
  const setDefaultGoto = useEditorStore((s) => s.setDefaultGoto);
  const setTerminalDefault = useEditorStore((s) => s.setTerminalDefault);
  const patchDefaultActionArgs = useEditorStore((s) => s.patchDefaultActionArgs);

  const mode = detectDefaultMode(step);
  const kind: "goto" | "finish" | "generateReport" | "escalate" | "assign" | "broken" =
    mode.kind === "callMacro" ? "broken" : (mode.kind as never);

  const setMode = (
    next: "goto" | "finish" | "generateReport" | "escalate" | "assign",
  ) => {
    if (next === "goto") {
      // выберем первый шаг (или null если других нет)
      const target = allSteps.find((s) => s.id !== step.id);
      setDefaultGoto(step.id, target?.id ?? null);
      return;
    }
    setTerminalDefault(step.id, next);
  };

  return (
    <SectionFrame
      icon={<EastIcon fontSize="small" sx={{ color: "primary.main" }} />}
      title="Что после, по умолчанию"
      subtitle="Что произойдёт, если ни один вариант ответа не задал свой маршрут (или у шага вообще нет вариантов)."
      highlight={highlight}
    >
      <ToggleButtonGroup
        size="small"
        exclusive
        value={kind}
        onChange={(_, v) => v && setMode(v)}
        sx={{ flexWrap: "wrap" }}
      >
        <ToggleButton value="goto">
          <EastIcon fontSize="small" sx={{ mr: 0.5 }} />
          Перейти к шагу
        </ToggleButton>
        <ToggleButton value="finish">
          <FlagIcon fontSize="small" sx={{ mr: 0.5 }} />
          Завершить
        </ToggleButton>
        <ToggleButton value="generateReport">
          <DescriptionIcon fontSize="small" sx={{ mr: 0.5 }} />
          Отчёт
        </ToggleButton>
        <ToggleButton value="escalate">
          <WarningAmberIcon fontSize="small" sx={{ mr: 0.5 }} />
          Эскалация
        </ToggleButton>
        <ToggleButton value="assign">
          <AssignmentIndIcon fontSize="small" sx={{ mr: 0.5 }} />
          Назначить
        </ToggleButton>
      </ToggleButtonGroup>

      {/* конкретные настройки для выбранного режима */}
      {mode.kind === "goto" && (
        <TextField
          select
          label="Перейти к шагу"
          value={mode.goto ?? "__stay__"}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__stay__") setDefaultGoto(step.id, null);
            else setDefaultGoto(step.id, v);
          }}
          fullWidth
        >
          <MenuItem value="__stay__">
            <Stack direction="row" spacing={1} alignItems="center">
              <LoopIcon fontSize="small" sx={{ color: "text.secondary" }} />
              <span>остаться на этом шаге</span>
            </Stack>
          </MenuItem>
          <Divider />
          {allSteps
            .filter((s) => s.id !== step.id)
            .map((s) => (
              <MenuItem key={s.id} value={s.id}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <EastIcon fontSize="small" sx={{ color: "primary.main" }} />
                  <span style={{ fontFamily: "monospace" }}>{s.id}</span>
                  {s.title && (
                    <span style={{ color: "var(--mui-palette-text-secondary, #888)", fontSize: 11 }}>
                      · {s.title}
                    </span>
                  )}
                </Stack>
              </MenuItem>
            ))}
        </TextField>
      )}

      {mode.kind === "finish" && (
        <TextField
          label="Резолюция (опционально)"
          placeholder="Например: «Ложная тревога»"
          value={mode.resolution ?? ""}
          onChange={(e) =>
            patchDefaultActionArgs(step.id, { resolution: e.target.value })
          }
          fullWidth
        />
      )}

      {mode.kind === "generateReport" && (
        <TextField
          label="ID шаблона отчёта (опционально)"
          placeholder="incident-summary-v1"
          value={mode.templateId ?? ""}
          onChange={(e) =>
            patchDefaultActionArgs(step.id, { templateId: e.target.value })
          }
          fullWidth
        />
      )}

      {mode.kind === "escalate" && (
        <Stack direction="row" spacing={1}>
          <TextField
            label="Кому передать (опционально)"
            placeholder="duty-shift"
            value={mode.to ?? ""}
            onChange={(e) => patchDefaultActionArgs(step.id, { to: e.target.value })}
            sx={{ flex: 1 }}
          />
          <TextField
            label="Причина (опционально)"
            placeholder="Требует решения старшего"
            value={mode.reason ?? ""}
            onChange={(e) => patchDefaultActionArgs(step.id, { reason: e.target.value })}
            sx={{ flex: 1 }}
          />
        </Stack>
      )}

      {mode.kind === "assign" && (
        <TextField
          label="Назначить (id оператора/группы)"
          placeholder="operator-123 или group-night-shift"
          value={mode.to}
          onChange={(e) => patchDefaultActionArgs(step.id, { to: e.target.value })}
          fullWidth
          required
          error={!mode.to}
          helperText={!mode.to ? "Без получателя сценарий не пройдёт валидацию." : undefined}
        />
      )}

      {mode.kind === "callMacro" && (
        <Alert severity="info">
          Шаг настроен на вызов макроса — это «расширенный» сценарий. Откройте инспектор справа,
          чтобы поправить параметры макроса.
        </Alert>
      )}
    </SectionFrame>
  );
};

// === обёртка-секция ===

const SectionFrame = ({
  icon,
  title,
  subtitle,
  highlight,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  highlight?: boolean;
  children: React.ReactNode;
}) => {
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: highlight ? "primary.main" : "divider",
        borderRadius: 1.5,
        p: 1.5,
        bgcolor: "background.paper",
        boxShadow: highlight ? "0 0 0 3px rgba(25, 118, 210, 0.12)" : "none",
        transition: "box-shadow 0.3s, border-color 0.3s",
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: subtitle ? 0 : 1.5 }}>
        {icon}
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
      </Stack>
      {subtitle && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
          {subtitle}
        </Typography>
      )}
      <Stack spacing={1.5}>{children}</Stack>
    </Box>
  );
};
