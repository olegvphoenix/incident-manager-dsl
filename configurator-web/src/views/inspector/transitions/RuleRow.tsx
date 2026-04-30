import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";

import type { Rule, StepId } from "../../../types/dsl";
import { useEditorStore } from "../../../store/editorStore";
import { GotoSelect } from "./GotoSelect";
import { JsonLogicEditor } from "./JsonLogicEditor";
import { ActionsEditor } from "./ActionsEditor";

interface Props {
  stepId: StepId;
  ruleIndex: number;
  rule: Rule;
  total: number;
}

export const RuleRow = ({ stepId, ruleIndex, rule, total }: Props) => {
  const setRuleWhen = useEditorStore((s) => s.setRuleWhen);
  const setRuleGoto = useEditorStore((s) => s.setRuleGoto);
  const setRuleActions = useEditorStore((s) => s.setRuleActions);
  const removeRule = useEditorStore((s) => s.removeRule);
  const reorderRule = useEditorStore((s) => s.reorderRule);

  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1 }}>
      <Stack direction="row" alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          Правило #{ruleIndex + 1}
        </Typography>
        <Tooltip title="Выше в порядке проверки">
          <span>
            <IconButton
              size="small"
              onClick={() => reorderRule(stepId, ruleIndex, ruleIndex - 1)}
              disabled={ruleIndex === 0}
            >
              <ArrowUpwardIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Ниже">
          <span>
            <IconButton
              size="small"
              onClick={() => reorderRule(stepId, ruleIndex, ruleIndex + 1)}
              disabled={ruleIndex === total - 1}
            >
              <ArrowDownwardIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Удалить правило">
          <IconButton
            size="small"
            color="error"
            onClick={() => removeRule(stepId, ruleIndex)}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Stack spacing={1}>
        <JsonLogicEditor
          value={rule.when}
          onChange={(v) => setRuleWhen(stepId, ruleIndex, v)}
          label="when"
        />
        <GotoSelect
          value={rule.goto}
          onChange={(v) => setRuleGoto(stepId, ruleIndex, v)}
        />
        <Box>
          <Typography variant="caption" color="text.secondary">
            Actions (опционально, выполняются перед переходом)
          </Typography>
          <ActionsEditor
            actions={rule.actions ?? []}
            onChange={(arr) => setRuleActions(stepId, ruleIndex, arr)}
          />
        </Box>
      </Stack>
    </Box>
  );
};
