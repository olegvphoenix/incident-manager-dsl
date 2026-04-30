// Модалка быстрого редактирования when у rule-ребра. Открывается по double-click
// на edge в Flow Editor. Позволяет править условие, не открывая Inspector.
//
// Для default-ребра (где условия нет) показываем подсказку «у default нет условий —
// открыть в Inspector» и кнопку перехода в инспектор.

import { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

import { useEditorStore } from "../../store/editorStore";
import { JsonLogicEditor } from "../inspector/transitions/JsonLogicEditor";

interface EdgeRef {
  stepId: string;
  ruleIndex: number | "default";
}

interface Props {
  edge: EdgeRef | null;
  onClose: () => void;
}

export const EdgeWhenDialog = ({ edge, onClose }: Props) => {
  const scenario = useEditorStore((s) => s.scenario);
  const setRuleWhen = useEditorStore((s) => s.setRuleWhen);

  // Локальная копия — чтобы не дёргать undo-стек на каждое изменение,
  // а коммитить разом по «Сохранить».
  const [draft, setDraft] = useState<unknown>(true);

  useEffect(() => {
    if (!edge || !scenario) return;
    const step = scenario.steps.find((s) => s.id === edge.stepId);
    if (!step) return;
    if (edge.ruleIndex === "default") {
      setDraft(undefined);
    } else {
      const rule = step.transitions?.rules?.[edge.ruleIndex];
      setDraft(rule?.when ?? true);
    }
  }, [edge, scenario]);

  if (!edge || !scenario) return null;
  const step = scenario.steps.find((s) => s.id === edge.stepId);
  if (!step) return null;

  const isDefault = edge.ruleIndex === "default";

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="baseline" spacing={1}>
          <Typography variant="subtitle1">
            {isDefault ? "Default-переход" : "Условие правила"}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontFamily: "monospace" }}
          >
            {step.id}
            {!isDefault && ` · rules[${edge.ruleIndex}]`}
          </Typography>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {isDefault ? (
          <Box>
            <Typography variant="body2" color="text.secondary">
              У default-перехода нет условия. Это «иначе» для всех правил.
              Чтобы поменять goto или actions — откройте Inspector справа,
              либо перетащите конец стрелки на другой шаг.
            </Typography>
          </Box>
        ) : (
          <JsonLogicEditor value={draft} onChange={setDraft} label="when" />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        {!isDefault && (
          <Button
            variant="contained"
            onClick={() => {
              setRuleWhen(edge.stepId, edge.ruleIndex as number, draft);
              onClose();
            }}
          >
            Сохранить
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
