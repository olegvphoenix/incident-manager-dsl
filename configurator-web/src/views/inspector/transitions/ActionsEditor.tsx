import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";

import type { Action, ActionType } from "../../../types/dsl";
import { ACTION_TYPES } from "../../../types/dsl";

interface Props {
  actions: Action[];
  onChange: (actions: Action[]) => void;
}

// Редактор массива actions. Каждый action — chip с типом + поля args в зависимости от type.
// Только базовые поля каждого action (по dsl-v1-schema.json):
//   finish.args.resolution, escalate.args.{to,reason}, assign.args.to,
//   generateReport.args.templateId, callMacro.args.{macroId,params}.
// params (свободный объект) кладём как raw JSON.
export const ActionsEditor = ({ actions, onChange }: Props) => {
  const update = (idx: number, next: Action) => {
    const arr = actions.slice();
    arr[idx] = next;
    onChange(arr);
  };
  const remove = (idx: number) => onChange(actions.filter((_, i) => i !== idx));
  const add = () => onChange([...actions, { type: "finish" }]);

  return (
    <Stack spacing={1}>
      {actions.map((a, idx) => (
        <ActionRow
          key={idx}
          action={a}
          onChange={(next) => update(idx, next)}
          onRemove={() => remove(idx)}
        />
      ))}
      <Box>
        <Button size="small" startIcon={<AddIcon />} onClick={add}>
          Добавить action
        </Button>
      </Box>
    </Stack>
  );
};

interface RowProps {
  action: Action;
  onChange: (a: Action) => void;
  onRemove: () => void;
}

const COLOR: Record<ActionType, "success" | "warning" | "info" | "secondary" | "default"> = {
  finish: "success",
  escalate: "warning",
  assign: "info",
  generateReport: "secondary",
  callMacro: "default",
};

const ActionRow = ({ action, onChange, onRemove }: RowProps) => {
  const args = (action.args ?? {}) as Record<string, unknown>;
  const setArg = (key: string, value: unknown) => {
    const nextArgs = { ...args };
    if (value === undefined || value === "") delete nextArgs[key];
    else nextArgs[key] = value;
    onChange({
      type: action.type,
      ...(Object.keys(nextArgs).length ? { args: nextArgs } : {}),
    });
  };

  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <Chip size="small" color={COLOR[action.type]} label={action.type} sx={{ fontWeight: 600 }} />
        <TextField
          select
          size="small"
          value={action.type}
          onChange={(e) => onChange({ type: e.target.value as ActionType })}
          sx={{ flex: 1 }}
        >
          {ACTION_TYPES.map((t) => (
            <MenuItem key={t} value={t}>
              {t}
            </MenuItem>
          ))}
        </TextField>
        <Tooltip title="Удалить action">
          <IconButton size="small" color="error" onClick={onRemove}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      {action.type === "finish" && (
        <TextField
          label="resolution"
          size="small"
          fullWidth
          value={(args.resolution as string) ?? ""}
          onChange={(e) => setArg("resolution", e.target.value)}
          helperText="processed | rejected | false_alarm | (свободно)"
        />
      )}

      {action.type === "escalate" && (
        <Stack spacing={0.75}>
          <TextField
            label="to"
            size="small"
            fullWidth
            value={(args.to as string) ?? ""}
            onChange={(e) => setArg("to", e.target.value)}
            helperText="ID оператора/группы (опционально — сервер маршрутизирует)"
          />
          <TextField
            label="reason"
            size="small"
            fullWidth
            value={(args.reason as string) ?? ""}
            onChange={(e) => setArg("reason", e.target.value)}
          />
        </Stack>
      )}

      {action.type === "assign" && (
        <TextField
          label="to (обязательно)"
          size="small"
          fullWidth
          required
          value={(args.to as string) ?? ""}
          onChange={(e) => setArg("to", e.target.value)}
        />
      )}

      {action.type === "generateReport" && (
        <TextField
          label="templateId"
          size="small"
          fullWidth
          value={(args.templateId as string) ?? ""}
          onChange={(e) => setArg("templateId", e.target.value)}
          helperText="Опционально. Сервер выберет дефолт, если пусто."
        />
      )}

      {action.type === "callMacro" && (
        <Stack spacing={0.75}>
          <TextField
            label="macroId (обязательно)"
            size="small"
            fullWidth
            required
            value={(args.macroId as string) ?? ""}
            onChange={(e) => setArg("macroId", e.target.value)}
          />
          <TextField
            label="params (raw JSON, опционально)"
            size="small"
            fullWidth
            multiline
            minRows={1}
            value={args.params ? JSON.stringify(args.params, null, 2) : ""}
            onChange={(e) => {
              const text = e.target.value;
              if (text === "") {
                setArg("params", undefined);
                return;
              }
              try {
                const parsed = JSON.parse(text);
                setArg("params", parsed);
              } catch {
                /* не применяем — кнопка сохранения проверит */
              }
            }}
            InputProps={{ sx: { fontFamily: "monospace", fontSize: 12 } }}
          />
        </Stack>
      )}
    </Box>
  );
};
