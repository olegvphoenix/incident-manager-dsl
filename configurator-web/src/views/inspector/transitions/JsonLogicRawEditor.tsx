import { useEffect, useRef, useState } from "react";
import TextField from "@mui/material/TextField";
import jsonLogic from "json-logic-js";

interface Props {
  value: unknown;
  onChange: (v: unknown) => void;
  label?: string;
}

// Простой raw JSON-редактор JSONLogic-выражения. Парсим на blur, при ошибке
// подсвечиваем и не отдаём наверх. Visual builder придёт в M6.
//
// Внимание: `value` — это произвольный объект (JSONLogic), который родитель
// чаще всего пересоздаёт каждый рендер. Сравнивать его по ссылке нельзя
// (бесконечный цикл). Сравниваем по сериализованному значению через ref.
export const JsonLogicRawEditor = ({ value, onChange, label = "when (JSONLogic)" }: Props) => {
  const initial = JSON.stringify(value, null, 2);
  const [draft, setDraft] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const lastSerializedRef = useRef(initial);

  useEffect(() => {
    const serialized = JSON.stringify(value, null, 2);
    if (serialized === lastSerializedRef.current) return;
    lastSerializedRef.current = serialized;
    setDraft(serialized);
    setErr(null);
  }, [value]);

  const flush = () => {
    try {
      const parsed = JSON.parse(draft);
      // Прогоним пробный apply, чтобы поймать кривой синтаксис JSONLogic.
      jsonLogic.apply(parsed, { state: {} });
      setErr(null);
      onChange(parsed);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <TextField
      label={label || undefined}
      multiline
      minRows={2}
      maxRows={8}
      fullWidth
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={flush}
      error={!!err}
      helperText={err ?? 'Пример: { "==": [{ "var": "state.x.value" }, "yes" ] }'}
      InputProps={{
        sx: { fontFamily: "monospace", fontSize: 12 },
      }}
    />
  );
};
