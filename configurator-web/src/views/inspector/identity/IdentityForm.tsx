import { useEffect, useMemo, useState } from "react";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Chip from "@mui/material/Chip";

import type { Step, StepType } from "../../../types/dsl";
import { STEP_TYPES } from "../../../types/dsl";
import { useEditorStore } from "../../../store/editorStore";

interface Props {
  step: Step;
}

const STEP_ID_REGEX = /^[a-z][a-z0-9_]{0,63}$/;

// Identity-блок: id (с регекспом-валидацией и переименованием по blur),
// type (через select с предупреждением), title, editable, флаг initialStepId.
export const IdentityForm = ({ step }: Props) => {
  const renameStep = useEditorStore((s) => s.renameStep);
  const setStepType = useEditorStore((s) => s.setStepType);
  const setStepTitle = useEditorStore((s) => s.setStepTitle);
  const setStepEditable = useEditorStore((s) => s.setStepEditable);
  const setInitialStep = useEditorStore((s) => s.setInitialStep);
  const isInitial = useEditorStore((s) => s.scenario?.initialStepId === step.id);
  // Возвращаем стабильную ссылку на массив steps; Set строим в useMemo —
  // иначе zustand видит новый Set каждый рендер и попадает в infinite loop.
  const steps = useEditorStore((s) => s.scenario?.steps);
  const allIds = useMemo(() => new Set(steps?.map((x) => x.id) ?? []), [steps]);

  const [idDraft, setIdDraft] = useState(step.id);
  const [titleDraft, setTitleDraft] = useState(step.title ?? "");

  // Когда внешне меняется id шага (например, undo) — синхронизируемся.
  useEffect(() => setIdDraft(step.id), [step.id]);
  useEffect(() => setTitleDraft(step.title ?? ""), [step.title]);

  const idError =
    idDraft !== step.id && (!STEP_ID_REGEX.test(idDraft) || allIds.has(idDraft));
  const idHelper = idError
    ? !STEP_ID_REGEX.test(idDraft)
      ? "snake_case, латиница, начинается с буквы"
      : "id уже занят"
    : "Стабильный идентификатор шага";

  const handleIdBlur = () => {
    if (idDraft === step.id) return;
    if (!STEP_ID_REGEX.test(idDraft)) {
      setIdDraft(step.id);
      return;
    }
    if (allIds.has(idDraft)) {
      setIdDraft(step.id);
      return;
    }
    renameStep(step.id, idDraft);
  };

  const handleTitleBlur = () => {
    if ((step.title ?? "") === titleDraft) return;
    setStepTitle(step.id, titleDraft === "" ? undefined : titleDraft);
  };

  const handleTypeChange = (newType: StepType) => {
    if (newType === step.type) return;
    if (
      window.confirm(
        `Сменить тип шага "${step.id}" на ${newType}? View будет заменён дефолтным для нового типа.`,
      )
    ) {
      setStepType(step.id, newType);
    }
  };

  return (
    <Stack spacing={1.25}>
      <Stack direction="row" spacing={1} alignItems="center">
        <TextField
          label="step.id"
          fullWidth
          value={idDraft}
          onChange={(e) => setIdDraft(e.target.value)}
          onBlur={handleIdBlur}
          error={idError}
          helperText={idHelper}
        />
        {isInitial ? (
          <Chip size="small" label="start" color="primary" />
        ) : (
          <Chip
            size="small"
            label="set start"
            variant="outlined"
            onClick={() => setInitialStep(step.id)}
          />
        )}
      </Stack>

      <TextField
        select
        label="Тип шага"
        value={step.type}
        onChange={(e) => handleTypeChange(e.target.value as StepType)}
        fullWidth
      >
        {STEP_TYPES.map((t) => (
          <MenuItem key={t} value={t}>
            {t}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        label="Заголовок (title)"
        fullWidth
        value={titleDraft}
        onChange={(e) => setTitleDraft(e.target.value)}
        onBlur={handleTitleBlur}
        helperText="Опционально. Виден оператору как подзаголовок шага."
      />

      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={step.editable !== false}
            onChange={(e) => setStepEditable(step.id, e.target.checked)}
          />
        }
        label="editable — оператор может вернуться и изменить ответ"
      />
    </Stack>
  );
};
