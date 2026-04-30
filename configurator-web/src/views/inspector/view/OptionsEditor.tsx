import { useState } from "react";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";

import type { Option } from "../../../types/dsl";

interface Props {
  options: Option[];
  onChange: (options: Option[]) => void;
  // минимально допустимое кол-во опций (RadioButton/Select требуют >= 2)
  minOptions?: number;
}

const OPT_ID_REGEX = /^[a-z0-9][a-z0-9_]{0,63}$/;

// Редактор массива Option[] для RadioButton/Checkbox/Select.
// Каждая строка: id (валидируется), label, hint (опционально), кнопки move up/down/delete.
export const OptionsEditor = ({ options, onChange, minOptions = 1 }: Props) => {
  const update = (idx: number, patch: Partial<Option>) => {
    const next = options.slice();
    next[idx] = { ...next[idx]!, ...patch };
    onChange(next);
  };
  const remove = (idx: number) => {
    if (options.length <= minOptions) return;
    onChange(options.filter((_, i) => i !== idx));
  };
  const move = (idx: number, dir: -1 | 1) => {
    const next = options.slice();
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target]!, next[idx]!];
    onChange(next);
  };
  const add = () => {
    const taken = new Set(options.map((o) => o.id));
    let n = options.length + 1;
    let id = `opt_${n}`;
    while (taken.has(id)) {
      n += 1;
      id = `opt_${n}`;
    }
    onChange([...options, { id, label: `Вариант ${n}` }]);
  };

  return (
    <Stack spacing={1}>
      {options.map((o, idx) => (
        <OptionRow
          key={idx}
          option={o}
          existingIds={options.map((x) => x.id)}
          ownIndex={idx}
          canDelete={options.length > minOptions}
          onPatch={(p) => update(idx, p)}
          onMoveUp={() => move(idx, -1)}
          onMoveDown={() => move(idx, 1)}
          onRemove={() => remove(idx)}
        />
      ))}
      <Box>
        <Button size="small" startIcon={<AddIcon />} onClick={add}>
          Добавить опцию
        </Button>
      </Box>
    </Stack>
  );
};

interface OptionRowProps {
  option: Option;
  existingIds: string[];
  ownIndex: number;
  canDelete: boolean;
  onPatch: (p: Partial<Option>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

const OptionRow = ({
  option,
  existingIds,
  ownIndex,
  canDelete,
  onPatch,
  onMoveUp,
  onMoveDown,
  onRemove,
}: OptionRowProps) => {
  const [idDraft, setIdDraft] = useState(option.id);
  const otherIds = new Set(existingIds.filter((_, i) => i !== ownIndex));
  const idError = idDraft !== option.id && (!OPT_ID_REGEX.test(idDraft) || otherIds.has(idDraft));
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        p: 1,
      }}
    >
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
        <TextField
          label="option.id"
          size="small"
          value={idDraft}
          onChange={(e) => setIdDraft(e.target.value)}
          onBlur={() => {
            if (idError) {
              setIdDraft(option.id);
              return;
            }
            if (idDraft !== option.id) onPatch({ id: idDraft });
          }}
          error={idError}
          sx={{ flex: 1, fontFamily: "monospace" }}
        />
        <Tooltip title="Вверх">
          <span>
            <IconButton size="small" onClick={onMoveUp}>
              <ArrowUpwardIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Вниз">
          <span>
            <IconButton size="small" onClick={onMoveDown}>
              <ArrowDownwardIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={canDelete ? "Удалить" : "Минимум 1 опция"}>
          <span>
            <IconButton size="small" color="error" onClick={onRemove} disabled={!canDelete}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      <TextField
        label="label"
        size="small"
        fullWidth
        value={option.label}
        onChange={(e) => onPatch({ label: e.target.value })}
        sx={{ mb: 0.5 }}
      />
      <TextField
        label="hint (опционально)"
        size="small"
        fullWidth
        value={option.hint ?? ""}
        onChange={(e) => onPatch({ hint: e.target.value === "" ? undefined : e.target.value })}
      />
    </Box>
  );
};
