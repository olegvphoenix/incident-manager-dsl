import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";

import { useEditorStore } from "../../../store/editorStore";
import type { StepId } from "../../../types/dsl";

interface Props {
  value: StepId | null | undefined; // undefined = не задан, null = stay (петля)
  onChange: (v: StepId | null | undefined) => void;
  excludeNone?: boolean;
  label?: string;
}

const NONE = "__none__";
const STAY = "__stay__";

// Combobox для goto. Список = все step.id текущего сценария + специальные значения:
//   none — не задан (актуально только для default, если используются actions)
//   stay — null, остаться на текущем шаге (rare)
export const GotoSelect = ({ value, onChange, excludeNone = false, label = "goto" }: Props) => {
  // Селектор возвращает либо тот же массив, либо undefined — стабильная ссылка.
  // Нельзя возвращать `?? []`, иначе zustand посчитает каждый рендер новым значением.
  const steps = useEditorStore((s) => s.scenario?.steps);

  const v = value === undefined ? NONE : value === null ? STAY : value;

  return (
    <TextField
      select
      size="small"
      label={label}
      value={v}
      onChange={(e) => {
        const x = e.target.value;
        if (x === NONE) onChange(undefined);
        else if (x === STAY) onChange(null);
        else onChange(x);
      }}
      fullWidth
    >
      {!excludeNone && <MenuItem value={NONE}>(нет goto)</MenuItem>}
      <MenuItem value={STAY}>(остаться, goto: null)</MenuItem>
      {(steps ?? []).map((s) => (
        <MenuItem key={s.id} value={s.id} sx={{ fontFamily: "monospace" }}>
          → {s.id}
          {s.title ? ` · ${s.title}` : ""}
        </MenuItem>
      ))}
    </TextField>
  );
};
