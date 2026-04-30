import { useCallback, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import TableRowsIcon from "@mui/icons-material/TableRows";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import AddIcon from "@mui/icons-material/Add";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import SaveIcon from "@mui/icons-material/Save";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import ScienceIcon from "@mui/icons-material/Science";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import HomeIcon from "@mui/icons-material/Home";

import { useEditorStore, useTemporalStore } from "../store/editorStore";
import { showFlowHints } from "./flow/FlowHintBanner";
import { DEV_EXAMPLES } from "../services/devExamples";
import { STEP_TYPES, type StepType } from "../types/dsl";
import {
  hasFsAccess,
  openLayoutFile,
  openScenarioFile,
} from "../services/scenarioIO";
import { saveScenario } from "../services/saveScenario";
import { createBlankScenario } from "../services/newScenario";
import { EMPTY_LAYOUT } from "../types/layout";

export const Toolbar = () => {
  const view = useEditorStore((s) => s.ui.view);
  const setView = useEditorStore((s) => s.setView);
  const scenario = useEditorStore((s) => s.scenario);
  const baseName = useEditorStore((s) => s.ui.baseName);
  const dirty = useEditorStore((s) => s.ui.dirty);
  const scenarioHandle = useEditorStore((s) => s.scenarioHandle);
  const loadScenario = useEditorStore((s) => s.loadScenario);
  const setLoadError = useEditorStore((s) => s.setLoadError);

  const undo = useTemporalStore((s) => s.undo);
  const redo = useTemporalStore((s) => s.redo);
  const pastStates = useTemporalStore((s) => s.pastStates);
  const futureStates = useTemporalStore((s) => s.futureStates);
  const applyAutoLayout = useEditorStore((s) => s.applyAutoLayout);
  const addStep = useEditorStore((s) => s.addStep);
  const livePreviewOpen = useEditorStore((s) => s.ui.livePreviewOpen);
  const setLivePreviewOpen = useEditorStore((s) => s.setLivePreviewOpen);

  const [examplesAnchor, setExamplesAnchor] = useState<HTMLElement | null>(null);
  const [addStepAnchor, setAddStepAnchor] = useState<HTMLElement | null>(null);

  const handleNew = useCallback(() => {
    const blank = createBlankScenario();
    loadScenario(blank, EMPTY_LAYOUT(blank.metadata.scenarioGuid, blank.metadata.version), {
      baseName: "untitled-scenario",
    });
  }, [loadScenario]);

  const handleOpen = useCallback(async () => {
    setLoadError(null);
    try {
      const opened = await openScenarioFile();
      if (!opened) return;
      // Попытка автоматически найти sidecar layout — в этой версии оставляем null;
      // пользователь может догрузить через "Открыть layout..." (в fallback)
      // или мы сами запишем layout при сохранении.
      loadScenario(opened.scenario, opened.layout, {
        scenarioHandle: opened.handle,
        layoutHandle: opened.layoutHandle,
        baseName: opened.baseName,
      });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, [loadScenario, setLoadError]);

  const handleOpenLayout = useCallback(async () => {
    if (!scenario) return;
    try {
      const res = await openLayoutFile();
      if (!res) return;
      // мерджим в текущий store: зовём loadScenario с теми же handles
      loadScenario(scenario, res.layout, {
        scenarioHandle,
        layoutHandle: res.handle,
        baseName,
      });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, [scenario, scenarioHandle, baseName, loadScenario, setLoadError]);

  const handleSave = useCallback(async () => {
    await saveScenario();
  }, []);

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={2}
      sx={{ height: "100%", px: 2, bgcolor: "background.paper" }}
    >
      <Tooltip title="Перейти на главную Incident Manager">
        <IconButton
          size="small"
          onClick={() => {
            // Переход в корень — там runner-web главная.
            window.location.assign("/");
          }}
        >
          <HomeIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        Incident Manager — Configurator
      </Typography>
      {scenario && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }}
        >
          {scenario.metadata.name} · v{scenario.metadata.version}
          {dirty && " · *"}
        </Typography>
      )}

      <Box sx={{ flex: 1 }} />

      <Stack direction="row" spacing={0.5}>
        <Tooltip title="Undo (Ctrl+Z)">
          <span>
            <IconButton size="small" onClick={() => undo()} disabled={pastStates.length === 0}>
              <UndoIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Redo (Ctrl+Shift+Z)">
          <span>
            <IconButton size="small" onClick={() => redo()} disabled={futureStates.length === 0}>
              <RedoIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      <Stack direction="row" spacing={1}>
        {/* Авто-расстановка узлов и быстрое добавление шага — это операции
            «Карты переходов». В режиме таблицы у нас есть свой «+ Шаг»
            (с правильной вставкой после выбранного), а «Layout» не имеет
            смысла. Поэтому в режиме table эти кнопки скрыты. */}
        {view === "flow" && (
          <>
            <Tooltip title="Пересчитать расположение узлов на карте">
              <span>
                <IconButton
                  size="small"
                  onClick={() => applyAutoLayout(false)}
                  disabled={!scenario}
                >
                  <AutoFixHighIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Добавить шаг (вставится в конец)">
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<PlaylistAddIcon />}
                  onClick={(e) => setAddStepAnchor(e.currentTarget)}
                  disabled={!scenario}
                >
                  Шаг
                </Button>
              </span>
            </Tooltip>
            <Menu
              anchorEl={addStepAnchor}
              open={Boolean(addStepAnchor)}
              onClose={() => setAddStepAnchor(null)}
            >
              {STEP_TYPES.map((t) => (
                <MenuItem
                  key={t}
                  onClick={() => {
                    addStep(t as StepType);
                    setAddStepAnchor(null);
                  }}
                >
                  + {t}
                </MenuItem>
              ))}
            </Menu>
          </>
        )}
        <Button startIcon={<AddIcon />} variant="outlined" onClick={handleNew}>
          Новый
        </Button>
        <Button startIcon={<FolderOpenIcon />} variant="outlined" onClick={handleOpen}>
          Открыть
        </Button>
        <Tooltip title="Открыть встроенный пример сценария">
          <Button
            size="small"
            startIcon={<ScienceIcon />}
            variant="text"
            onClick={(e) => setExamplesAnchor(e.currentTarget)}
          >
            Пример
          </Button>
        </Tooltip>
        <Menu
          anchorEl={examplesAnchor}
          open={Boolean(examplesAnchor)}
          onClose={() => setExamplesAnchor(null)}
        >
          {DEV_EXAMPLES.map((ex) => (
            <MenuItem
              key={ex.fileName}
              onClick={() => {
                loadScenario(ex.scenario, null, { baseName: ex.fileName });
                setExamplesAnchor(null);
              }}
            >
              {ex.label}
            </MenuItem>
          ))}
        </Menu>
        {!hasFsAccess && scenario && (
          <Button variant="outlined" onClick={handleOpenLayout} disabled={!scenario}>
            + layout
          </Button>
        )}
        <Button
          startIcon={<SaveIcon />}
          variant="contained"
          onClick={handleSave}
          disabled={!scenario}
        >
          Сохранить
        </Button>
      </Stack>

      <Tooltip
        title={
          view === "flow"
            ? "Показать подсказки по работе с картой переходов"
            : "Показать подсказки по работе с картой переходов (откроет карту)"
        }
      >
        <IconButton
          size="small"
          onClick={() => {
            setView("flow");
            showFlowHints();
          }}
        >
          <HelpOutlineIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title={livePreviewOpen ? "Скрыть live-preview" : "Показать live-preview"}>
        <span>
          <IconButton
            size="small"
            onClick={() => setLivePreviewOpen(!livePreviewOpen)}
            color={livePreviewOpen ? "primary" : "default"}
            disabled={!scenario}
          >
            {livePreviewOpen ? (
              <VisibilityIcon fontSize="small" />
            ) : (
              <VisibilityOffIcon fontSize="small" />
            )}
          </IconButton>
        </span>
      </Tooltip>

      {/* Таблица — основной редактор. Карта переходов (Flow) — вспомогательный
          вид для сложных сценариев и визуализации связей. */}
      <ToggleButtonGroup
        size="small"
        exclusive
        value={view}
        onChange={(_, v) => v && setView(v)}
      >
        <ToggleButton value="table" aria-label="table view">
          <TableRowsIcon fontSize="small" sx={{ mr: 0.5 }} />
          Таблица
        </ToggleButton>
        <ToggleButton value="flow" aria-label="flow view">
          <AccountTreeIcon fontSize="small" sx={{ mr: 0.5 }} />
          Карта переходов
        </ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );
};
