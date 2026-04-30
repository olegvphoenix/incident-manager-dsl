import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";

import type { Step } from "../../types/dsl";
import { useEditorStore } from "../../store/editorStore";

interface Props {
  step: Step;
}

// Расширенные параметры view, которых НЕТ в карточке-строке таблицы:
//   * editable
//   * layout vertical/horizontal (Radio/Checkbox)
//   * minSelected/maxSelected (Checkbox)
//   * minLength/maxLength/minRows/maxRows/readonly (Comment)
//   * min/max date (Datetime)
//   * hint у опций (Radio/Checkbox/Select)
// Это поля «второго уровня», нужны редко — но, когда нужны, оператор
// должен иметь к ним доступ без ухода в JSON.
export const AdvancedViewSettings = ({ step }: Props) => {
  const setStepEditable = useEditorStore((s) => s.setStepEditable);
  const patchStepView = useEditorStore((s) => s.patchStepView);
  const patchStepOption = useEditorStore((s) => s.patchStepOption);

  const view = (step as { view?: Record<string, unknown> }).view ?? {};

  return (
    <Stack spacing={1.5}>
      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={step.editable !== false}
            onChange={(e) => setStepEditable(step.id, e.target.checked)}
          />
        }
        label={
          <Typography variant="body2">
            Можно редактировать ответ после ухода со шага
          </Typography>
        }
      />

      <TextField
        size="small"
        label="Внутренний title (опционально)"
        value={step.title ?? ""}
        onChange={(e) =>
          useEditorStore
            .getState()
            .setStepTitle(step.id, e.target.value === "" ? undefined : e.target.value)
        }
        fullWidth
        helperText="Дополнительная подпись шага (видна оператору как заголовок)"
      />

      {(step.type === "RadioButton" || step.type === "Checkbox") && (
        <TextField
          size="small"
          select
          label="Раскладка вариантов"
          value={(view.layout as string | undefined) ?? "vertical"}
          onChange={(e) => patchStepView(step.id, { layout: e.target.value })}
          fullWidth
        >
          <MenuItem value="vertical">Вертикально (друг под другом)</MenuItem>
          <MenuItem value="horizontal">Горизонтально (в ряд)</MenuItem>
        </TextField>
      )}

      {step.type === "Checkbox" && (
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            type="number"
            label="Мин. отметок"
            value={(view.minSelected as number | undefined) ?? ""}
            onChange={(e) =>
              patchStepView(step.id, {
                minSelected: e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
            inputProps={{ min: 0 }}
            sx={{ flex: 1 }}
          />
          <TextField
            size="small"
            type="number"
            label="Макс. отметок"
            value={(view.maxSelected as number | undefined) ?? ""}
            onChange={(e) =>
              patchStepView(step.id, {
                maxSelected: e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
            inputProps={{ min: 1 }}
            sx={{ flex: 1 }}
          />
        </Stack>
      )}

      {step.type === "Comment" && (
        <Stack spacing={1}>
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              type="number"
              label="Мин. символов"
              value={(view.minLength as number | undefined) ?? ""}
              onChange={(e) =>
                patchStepView(step.id, {
                  minLength: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
              inputProps={{ min: 0 }}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              type="number"
              label="Макс. символов"
              value={(view.maxLength as number | undefined) ?? ""}
              onChange={(e) =>
                patchStepView(step.id, {
                  maxLength: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
              inputProps={{ min: 1 }}
              sx={{ flex: 1 }}
            />
          </Stack>
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              type="number"
              label="Мин. строк"
              value={(view.minRows as number | undefined) ?? ""}
              onChange={(e) =>
                patchStepView(step.id, {
                  minRows: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
              inputProps={{ min: 1 }}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              type="number"
              label="Макс. строк"
              value={(view.maxRows as number | undefined) ?? ""}
              onChange={(e) =>
                patchStepView(step.id, {
                  maxRows: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
              inputProps={{ min: 1 }}
              sx={{ flex: 1 }}
            />
          </Stack>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={view.readonly === true}
                onChange={(e) =>
                  patchStepView(step.id, {
                    readonly: e.target.checked ? true : undefined,
                  })
                }
              />
            }
            label={<Typography variant="body2">Только для чтения</Typography>}
          />
        </Stack>
      )}

      {step.type === "Datetime" && (
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            label="Минимум (ISO)"
            value={(view.min as string | undefined) ?? ""}
            onChange={(e) =>
              patchStepView(step.id, {
                min: e.target.value === "" ? undefined : e.target.value,
              })
            }
            sx={{ flex: 1 }}
          />
          <TextField
            size="small"
            label="Максимум (ISO)"
            value={(view.max as string | undefined) ?? ""}
            onChange={(e) =>
              patchStepView(step.id, {
                max: e.target.value === "" ? undefined : e.target.value,
              })
            }
            sx={{ flex: 1 }}
          />
        </Stack>
      )}

      {step.type === "Select" && (
        <TextField
          size="small"
          label="Placeholder (текст-подсказка)"
          value={(view.placeholder as string | undefined) ?? ""}
          onChange={(e) =>
            patchStepView(step.id, {
              placeholder: e.target.value === "" ? undefined : e.target.value,
            })
          }
          fullWidth
        />
      )}

      {/* Подсказки (hint) у опций — длинный список, имеет смысл вынести
          в инспектор, в таблице без них чище. */}
      {(step.type === "RadioButton" ||
        step.type === "Checkbox" ||
        step.type === "Select") &&
        (() => {
          const opts =
            (view.options as { id: string; label: string; hint?: string }[] | undefined) ?? [];
          if (opts.length === 0) return null;
          return (
            <Box>
              <Divider sx={{ my: 1 }} />
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                Подсказки к вариантам ответа (hint)
              </Typography>
              <Stack spacing={0.75}>
                {opts.map((o, idx) => (
                  <TextField
                    key={o.id}
                    size="small"
                    label={o.label || o.id}
                    value={o.hint ?? ""}
                    onChange={(e) =>
                      patchStepOption(step.id, idx, {
                        hint: e.target.value === "" ? null : e.target.value,
                      })
                    }
                    placeholder="Появится под вариантом мелким шрифтом"
                    fullWidth
                  />
                ))}
              </Stack>
            </Box>
          );
        })()}
    </Stack>
  );
};
