import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";

import type { ScenarioScript } from "../../types/dsl";
import { useEditorStore } from "../../store/editorStore";

// Глобальные настройки сценария: identity (name/version/guid/description/tags),
// initialStepId, timers (escalateAfterSec/maxDurationSec), concurrency,
// действие «Save as new version» (бамп metadata.version).
export const ScenarioSettings = () => {
  const scenario = useEditorStore((s) => s.scenario);
  if (!scenario) return null;
  // key по scenarioGuid+version: при загрузке другого сценария inner
  // монтируется заново и lazy-initial useState (tagsRaw) подхватывает
  // актуальные теги. Это проще и надёжнее, чем синхронизация через useEffect
  // (которая на каждом рендере видит «новую» строку tags.join() и попадает
  // в infinite loop).
  return (
    <ScenarioSettingsInner
      key={`${scenario.metadata.scenarioGuid}::${scenario.metadata.version}`}
      scenario={scenario}
    />
  );
};

const ScenarioSettingsInner = ({ scenario }: { scenario: ScenarioScript }) => {
  const patchMetadata = useEditorStore((s) => s.patchMetadata);
  const setTimers = useEditorStore((s) => s.setTimers);
  const setConcurrency = useEditorStore((s) => s.setConcurrency);
  const setInitialStep = useEditorStore((s) => s.setInitialStep);
  const bumpVersion = useEditorStore((s) => s.bumpVersion);

  // Локальный draft-state: пользователь редактирует строку «через запятую»,
  // массив тегов уезжает в store только на blur (чтобы каждая запятая не
  // триггерила mutator + zundo snapshot). Lazy initial — и никаких useEffect.
  const [tagsRaw, setTagsRaw] = useState(() =>
    (scenario.metadata.tags ?? []).join(", "),
  );

  const flushTags = () => {
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    patchMetadata({ tags: tags.length > 0 ? tags : undefined });
  };

  const copyGuid = async () => {
    try {
      await navigator.clipboard.writeText(scenario.metadata.scenarioGuid);
    } catch {
      // ignore
    }
  };

  return (
    <Box sx={{ p: 2 }} data-scenario-settings>
      <Typography variant="overline" color="text.secondary">
        Настройки сценария
      </Typography>
      <Divider sx={{ my: 1 }} />

      <Stack spacing={1.5}>
        <TextField
          label="Имя сценария"
          fullWidth
          value={scenario.metadata.name}
          onChange={(e) => patchMetadata({ name: e.target.value })}
        />

        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            label="Версия"
            type="number"
            value={scenario.metadata.version}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isInteger(v) && v >= 1) patchMetadata({ version: v });
            }}
            sx={{ width: 100 }}
            inputProps={{ min: 1, step: 1 }}
          />
          <Tooltip title="Save as new version: бампит metadata.version + 1">
            <Button
              size="small"
              variant="outlined"
              startIcon={<RocketLaunchIcon />}
              onClick={() => bumpVersion()}
            >
              v + 1
            </Button>
          </Tooltip>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
            scenarioGuid
          </Typography>
          <Chip
            size="small"
            label={`${scenario.metadata.scenarioGuid.slice(0, 8)}…${scenario.metadata.scenarioGuid.slice(-4)}`}
            sx={{ fontFamily: "monospace" }}
          />
          <IconButton size="small" onClick={copyGuid} title="Скопировать">
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Stack>

        <TextField
          label="Описание"
          fullWidth
          multiline
          minRows={2}
          maxRows={6}
          value={scenario.metadata.description ?? ""}
          onChange={(e) =>
            patchMetadata({
              description: e.target.value === "" ? undefined : e.target.value,
            })
          }
        />

        <TextField
          label="Теги (через запятую)"
          fullWidth
          value={tagsRaw}
          onChange={(e) => setTagsRaw(e.target.value)}
          onBlur={flushTags}
          helperText="vms, perimeter"
        />

        <Divider />

        <TextField
          select
          label="Начальный шаг (initialStepId)"
          value={scenario.initialStepId}
          onChange={(e) => setInitialStep(e.target.value)}
          fullWidth
        >
          {scenario.steps.map((step) => (
            <MenuItem key={step.id} value={step.id}>
              {step.id} ({step.type}){step.title ? ` — ${step.title}` : ""}
            </MenuItem>
          ))}
        </TextField>

        <Divider />
        <Typography variant="caption" color="text.secondary">
          Таймеры
        </Typography>
        <Stack direction="row" spacing={1}>
          <TextField
            label="Эскалация через, сек"
            type="number"
            value={scenario.timers?.escalateAfterSec ?? ""}
            onChange={(e) => {
              const n = e.target.value === "" ? undefined : Number(e.target.value);
              setTimers({
                escalateAfterSec: n,
                maxDurationSec: scenario.timers?.maxDurationSec,
              });
            }}
            inputProps={{ min: 1 }}
            sx={{ flex: 1 }}
          />
          <TextField
            label="Макс. длительность, сек"
            type="number"
            value={scenario.timers?.maxDurationSec ?? ""}
            onChange={(e) => {
              const n = e.target.value === "" ? undefined : Number(e.target.value);
              setTimers({
                escalateAfterSec: scenario.timers?.escalateAfterSec,
                maxDurationSec: n,
              });
            }}
            inputProps={{ min: 1 }}
            sx={{ flex: 1 }}
          />
        </Stack>

        <Divider />
        <Typography variant="caption" color="text.secondary">
          Concurrency
        </Typography>
        <Stack>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={scenario.concurrency?.stepLockable !== false}
                onChange={(e) =>
                  setConcurrency({
                    stepLockable: e.target.checked,
                    allowMultitasking: scenario.concurrency?.allowMultitasking,
                  })
                }
              />
            }
            label="stepLockable — блокировать инцидент за одним оператором"
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={scenario.concurrency?.allowMultitasking !== false}
                onChange={(e) =>
                  setConcurrency({
                    stepLockable: scenario.concurrency?.stepLockable,
                    allowMultitasking: e.target.checked,
                  })
                }
              />
            }
            label="allowMultitasking — оператор может вести несколько инцидентов"
          />
        </Stack>
      </Stack>
    </Box>
  );
};
