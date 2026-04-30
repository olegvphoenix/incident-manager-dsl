import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Radio from "@mui/material/Radio";
import Checkbox from "@mui/material/Checkbox";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import ImageIcon from "@mui/icons-material/Image";

import type { Step } from "../../types/dsl";

interface Props {
  step: Step;
}

// Лёгкое визуальное превью шага «как увидит оператор». Не интерактивное —
// это иллюстрация. Полноценный runner живёт в LivePreview-панели.
export const StepPreview = ({ step }: Props) => {
  const view = (step as { view?: Record<string, unknown> }).view ?? {};
  const label = (view.label as string | undefined) ?? "Без текста";
  const required = view.required !== false;

  switch (step.type) {
    case "RadioButton": {
      const opts = (view.options as { id: string; label: string }[] | undefined) ?? [];
      return (
        <Stack spacing={0.5}>
          <PreviewLabel text={label} required={required} />
          {opts.length === 0 ? (
            <Typography variant="caption" color="error">
              нет вариантов
            </Typography>
          ) : (
            <Stack spacing={0}>
              {opts.slice(0, 5).map((o, i) => (
                <FormControlLabel
                  key={o.id}
                  control={<Radio size="small" disabled checked={i === 0} />}
                  label={<Typography variant="body2">{o.label}</Typography>}
                  sx={{ m: 0 }}
                />
              ))}
              {opts.length > 5 && (
                <Typography variant="caption" color="text.secondary">
                  …ещё {opts.length - 5}
                </Typography>
              )}
            </Stack>
          )}
        </Stack>
      );
    }
    case "Checkbox": {
      const opts = (view.options as { id: string; label: string }[] | undefined) ?? [];
      return (
        <Stack spacing={0.5}>
          <PreviewLabel text={label} required={required} />
          {opts.slice(0, 5).map((o) => (
            <FormControlLabel
              key={o.id}
              control={<Checkbox size="small" disabled />}
              label={<Typography variant="body2">{o.label}</Typography>}
              sx={{ m: 0 }}
            />
          ))}
          {opts.length > 5 && (
            <Typography variant="caption" color="text.secondary">
              …ещё {opts.length - 5}
            </Typography>
          )}
        </Stack>
      );
    }
    case "Select": {
      const opts = (view.options as { id: string; label: string }[] | undefined) ?? [];
      const placeholder = (view.placeholder as string | undefined) ?? "Выберите...";
      return (
        <Stack spacing={0.5}>
          <PreviewLabel text={label} required={required} />
          <Select size="small" disabled value="" displayEmpty fullWidth>
            <MenuItem value="">
              <em>{placeholder}</em>
            </MenuItem>
            {opts.map((o) => (
              <MenuItem key={o.id} value={o.id}>
                {o.label}
              </MenuItem>
            ))}
          </Select>
        </Stack>
      );
    }
    case "Comment":
      return (
        <Stack spacing={0.5}>
          <PreviewLabel text={label} required={required} />
          <TextField
            size="small"
            multiline
            minRows={(view.minRows as number | undefined) ?? 2}
            maxRows={4}
            disabled
            placeholder={(view.placeholder as string | undefined) ?? "Введите комментарий..."}
          />
        </Stack>
      );
    case "Image":
      return (
        <Stack spacing={0.5}>
          <PreviewLabel text={label} required={required} />
          <Box
            sx={{
              border: "1px dashed",
              borderColor: "divider",
              borderRadius: 1,
              p: 2,
              textAlign: "center",
              color: "text.secondary",
            }}
          >
            <ImageIcon fontSize="large" />
            <Typography variant="caption" sx={{ display: "block" }}>
              {view.source === "camera"
                ? "Снимок с камеры"
                : view.source === "map"
                  ? "Снимок с карты"
                  : view.source === "fixed"
                    ? "Изображение по URL"
                    : "Прикрепить файл"}
            </Typography>
          </Box>
        </Stack>
      );
    case "Datetime":
      return (
        <Stack spacing={0.5}>
          <PreviewLabel text={label} required={required} />
          <TextField
            size="small"
            disabled
            value={
              view.kind === "date"
                ? "01.01.2026"
                : view.kind === "time"
                  ? "12:00"
                  : "01.01.2026 12:00"
            }
          />
        </Stack>
      );
    case "Button": {
      const emphasis = (view.emphasis as string | undefined) ?? "primary";
      return (
        <Stack spacing={0.5} alignItems="center" sx={{ py: 1 }}>
          <Button
            variant={emphasis === "secondary" ? "outlined" : "contained"}
            color={emphasis === "destructive" ? "error" : "primary"}
            size="medium"
            disabled
          >
            {label}
          </Button>
        </Stack>
      );
    }
  }
};

const PreviewLabel = ({ text, required }: { text: string; required: boolean }) => (
  <Typography variant="body2" sx={{ fontWeight: 500 }}>
    {text}
    {required && <span style={{ color: "var(--mui-palette-error-main, #d32f2f)" }}> *</span>}
  </Typography>
);
