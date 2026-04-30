import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";

import type {
  ButtonStep,
  CheckboxStep,
  CommentStep,
  DatetimeStep,
  ImageStep,
  RadioButtonStep,
  SelectStep,
  Step,
} from "../../../types/dsl";
import { OptionsEditor } from "./OptionsEditor";
import { useViewPatcher } from "./useViewPatcher";

interface Props {
  step: Step;
}

export const ViewForm = ({ step }: Props) => {
  switch (step.type) {
    case "Button":
      return <ButtonViewForm step={step} />;
    case "RadioButton":
      return <RadioButtonViewForm step={step} />;
    case "Checkbox":
      return <CheckboxViewForm step={step} />;
    case "Select":
      return <SelectViewForm step={step} />;
    case "Comment":
      return <CommentViewForm step={step} />;
    case "Image":
      return <ImageViewForm step={step} />;
    case "Datetime":
      return <DatetimeViewForm step={step} />;
  }
};

const ButtonViewForm = ({ step }: { step: ButtonStep }) => {
  const patch = useViewPatcher(step);
  return (
    <Stack spacing={1}>
      <TextField
        label="label"
        fullWidth
        value={step.view.label}
        onChange={(e) => patch({ label: e.target.value })}
      />
      <TextField
        select
        label="emphasis"
        value={step.view.emphasis ?? "primary"}
        onChange={(e) =>
          patch({ emphasis: e.target.value as ButtonStep["view"]["emphasis"] })
        }
        fullWidth
      >
        <MenuItem value="primary">primary</MenuItem>
        <MenuItem value="secondary">secondary</MenuItem>
        <MenuItem value="destructive">destructive</MenuItem>
      </TextField>
    </Stack>
  );
};

const RadioButtonViewForm = ({ step }: { step: RadioButtonStep }) => {
  const patch = useViewPatcher(step);
  return (
    <Stack spacing={1}>
      <TextField
        label="label"
        fullWidth
        value={step.view.label}
        onChange={(e) => patch({ label: e.target.value })}
      />
      <Stack direction="row" spacing={1}>
        <TextField
          select
          label="layout"
          value={step.view.layout ?? "vertical"}
          onChange={(e) =>
            patch({ layout: e.target.value as RadioButtonStep["view"]["layout"] })
          }
          sx={{ flex: 1 }}
        >
          <MenuItem value="vertical">vertical</MenuItem>
          <MenuItem value="horizontal">horizontal</MenuItem>
        </TextField>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={step.view.required !== false}
              onChange={(e) => patch({ required: e.target.checked })}
            />
          }
          label="required"
        />
      </Stack>
      <Typography variant="caption" color="text.secondary">
        Опции (минимум 2)
      </Typography>
      <OptionsEditor
        options={step.view.options}
        minOptions={2}
        onChange={(options) => patch({ options })}
      />
    </Stack>
  );
};

const CheckboxViewForm = ({ step }: { step: CheckboxStep }) => {
  const patch = useViewPatcher(step);
  return (
    <Stack spacing={1}>
      <TextField
        label="label"
        fullWidth
        value={step.view.label}
        onChange={(e) => patch({ label: e.target.value })}
      />
      <Stack direction="row" spacing={1}>
        <TextField
          label="minSelected"
          type="number"
          value={step.view.minSelected ?? ""}
          onChange={(e) => {
            const v = e.target.value === "" ? undefined : Number(e.target.value);
            patch({ minSelected: v });
          }}
          inputProps={{ min: 0 }}
          sx={{ flex: 1 }}
        />
        <TextField
          label="maxSelected"
          type="number"
          value={step.view.maxSelected ?? ""}
          onChange={(e) => {
            const v = e.target.value === "" ? undefined : Number(e.target.value);
            patch({ maxSelected: v });
          }}
          inputProps={{ min: 1 }}
          sx={{ flex: 1 }}
        />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={step.view.required === true}
              onChange={(e) => patch({ required: e.target.checked || undefined })}
            />
          }
          label="required"
        />
      </Stack>
      <Typography variant="caption" color="text.secondary">
        Опции (минимум 1)
      </Typography>
      <OptionsEditor
        options={step.view.options}
        minOptions={1}
        onChange={(options) => patch({ options })}
      />
    </Stack>
  );
};

const SelectViewForm = ({ step }: { step: SelectStep }) => {
  const patch = useViewPatcher(step);
  return (
    <Stack spacing={1}>
      <TextField
        label="label"
        fullWidth
        value={step.view.label}
        onChange={(e) => patch({ label: e.target.value })}
      />
      <TextField
        label="placeholder"
        fullWidth
        value={step.view.placeholder ?? ""}
        onChange={(e) =>
          patch({ placeholder: e.target.value === "" ? undefined : e.target.value })
        }
      />
      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={step.view.required !== false}
            onChange={(e) => patch({ required: e.target.checked })}
          />
        }
        label="required"
      />
      <Typography variant="caption" color="text.secondary">
        Опции (минимум 2)
      </Typography>
      <OptionsEditor
        options={step.view.options}
        minOptions={2}
        onChange={(options) => patch({ options })}
      />
    </Stack>
  );
};

const CommentViewForm = ({ step }: { step: CommentStep }) => {
  const patch = useViewPatcher(step);
  return (
    <Stack spacing={1}>
      <TextField
        label="label"
        fullWidth
        value={step.view.label}
        onChange={(e) => patch({ label: e.target.value })}
      />
      <TextField
        label="placeholder"
        fullWidth
        value={step.view.placeholder ?? ""}
        onChange={(e) =>
          patch({ placeholder: e.target.value === "" ? undefined : e.target.value })
        }
      />
      <Stack direction="row" spacing={1}>
        <TextField
          label="minLength"
          type="number"
          value={step.view.minLength ?? ""}
          onChange={(e) =>
            patch({ minLength: e.target.value === "" ? undefined : Number(e.target.value) })
          }
          inputProps={{ min: 0 }}
          sx={{ flex: 1 }}
        />
        <TextField
          label="maxLength"
          type="number"
          value={step.view.maxLength ?? ""}
          onChange={(e) =>
            patch({ maxLength: e.target.value === "" ? undefined : Number(e.target.value) })
          }
          inputProps={{ min: 1 }}
          sx={{ flex: 1 }}
        />
      </Stack>
      <Stack direction="row" spacing={1}>
        <TextField
          label="minRows"
          type="number"
          value={step.view.minRows ?? ""}
          onChange={(e) =>
            patch({ minRows: e.target.value === "" ? undefined : Number(e.target.value) })
          }
          inputProps={{ min: 1 }}
          sx={{ flex: 1 }}
        />
        <TextField
          label="maxRows"
          type="number"
          value={step.view.maxRows ?? ""}
          onChange={(e) =>
            patch({ maxRows: e.target.value === "" ? undefined : Number(e.target.value) })
          }
          inputProps={{ min: 1 }}
          sx={{ flex: 1 }}
        />
      </Stack>
      <Stack direction="row" spacing={2}>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={step.view.required === true}
              onChange={(e) => patch({ required: e.target.checked || undefined })}
            />
          }
          label="required"
        />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={step.view.readonly === true}
              onChange={(e) => patch({ readonly: e.target.checked || undefined })}
            />
          }
          label="readonly"
        />
      </Stack>
    </Stack>
  );
};

const ImageViewForm = ({ step }: { step: ImageStep }) => {
  const patch = useViewPatcher(step);
  return (
    <Stack spacing={1}>
      <TextField
        label="label"
        fullWidth
        value={step.view.label}
        onChange={(e) => patch({ label: e.target.value })}
      />
      <TextField
        select
        label="source"
        value={step.view.source}
        onChange={(e) => patch({ source: e.target.value as ImageStep["view"]["source"] })}
        fullWidth
      >
        <MenuItem value="camera">camera — снимок с камеры</MenuItem>
        <MenuItem value="map">map — скриншот карты</MenuItem>
        <MenuItem value="operator">operator — загружает оператор</MenuItem>
        <MenuItem value="fixed">fixed — заранее закреплённый</MenuItem>
      </TextField>
      {step.view.source === "fixed" && (
        <TextField
          label="fixedSrc (URL)"
          fullWidth
          value={step.view.fixedSrc ?? ""}
          onChange={(e) => patch({ fixedSrc: e.target.value })}
          required
        />
      )}
      <Stack direction="row" spacing={2}>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={step.view.allowMultiple === true}
              onChange={(e) => patch({ allowMultiple: e.target.checked || undefined })}
            />
          }
          label="allowMultiple"
        />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={step.view.required === true}
              onChange={(e) => patch({ required: e.target.checked || undefined })}
            />
          }
          label="required"
        />
      </Stack>
    </Stack>
  );
};

const DatetimeViewForm = ({ step }: { step: DatetimeStep }) => {
  const patch = useViewPatcher(step);
  return (
    <Stack spacing={1}>
      <TextField
        label="label"
        fullWidth
        value={step.view.label}
        onChange={(e) => patch({ label: e.target.value })}
      />
      <TextField
        select
        label="kind"
        value={step.view.kind}
        onChange={(e) => patch({ kind: e.target.value as DatetimeStep["view"]["kind"] })}
        fullWidth
      >
        <MenuItem value="date">date</MenuItem>
        <MenuItem value="time">time</MenuItem>
        <MenuItem value="datetime">datetime</MenuItem>
      </TextField>
      <Stack direction="row" spacing={1}>
        <TextField
          label="min (ISO-8601)"
          fullWidth
          value={step.view.min ?? ""}
          onChange={(e) => patch({ min: e.target.value === "" ? undefined : e.target.value })}
        />
        <TextField
          label="max (ISO-8601)"
          fullWidth
          value={step.view.max ?? ""}
          onChange={(e) => patch({ max: e.target.value === "" ? undefined : e.target.value })}
        />
      </Stack>
      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={step.view.required !== false}
            onChange={(e) => patch({ required: e.target.checked })}
          />
        }
        label="required"
      />
    </Stack>
  );
};

