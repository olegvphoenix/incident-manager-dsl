import { useEffect, useRef } from "react";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import AddIcon from "@mui/icons-material/Add";

import type { Step } from "../../../types/dsl";
import { useEditorStore } from "../../../store/editorStore";
import { GotoSelect } from "./GotoSelect";
import { ActionsEditor } from "./ActionsEditor";
import { RuleRow } from "./RuleRow";

interface Props {
  step: Step;
}

// Полный редактор transitions: список rules с reorder/delete + default-блок.
// rules выполняются сверху вниз, первый truthy выигрывает (см. dsl-v1-draft.md §8).
// default обязан иметь либо goto, либо хотя бы один finish-action — это валидация
// на уровне семантики (проверяется в services/validation.ts).
export const TransitionsEditor = ({ step }: Props) => {
  const t = step.transitions;
  const addRule = useEditorStore((s) => s.addRule);
  const setDefaultGoto = useEditorStore((s) => s.setDefaultGoto);
  const setDefaultActions = useEditorStore((s) => s.setDefaultActions);
  // Для подсветки/scrollIntoView: какое правило сейчас выбрано (через клик
  // по edge во Flow или напрямую). "default" = блок default, число = rules[i].
  const selectedRuleIndex = useEditorStore((s) => s.ui.selectedRuleIndex);

  const rules = t?.rules ?? [];
  const defaultOutcome = t?.default ?? { actions: [{ type: "finish" as const }] };

  const defaultRef = useRef<HTMLDivElement | null>(null);
  const ruleRefs = useRef<Array<HTMLDivElement | null>>([]);

  // При смене selectedRuleIndex — скроллим к выбранному блоку.
  useEffect(() => {
    if (selectedRuleIndex === "default") {
      defaultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (typeof selectedRuleIndex === "number") {
      ruleRefs.current[selectedRuleIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [selectedRuleIndex, step.id]);

  return (
    <Stack spacing={1}>
      <Stack direction="row" alignItems="center">
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          Условные правила (rules)
        </Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => addRule(step.id, { when: true, goto: null })}
        >
          Добавить правило
        </Button>
      </Stack>

      {rules.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          Правил нет — переход всегда идёт по default.
        </Typography>
      )}

      <Stack spacing={1}>
        {rules.map((r, idx) => {
          const isSel = selectedRuleIndex === idx;
          return (
            <Box
              key={idx}
              ref={(el: HTMLDivElement | null) => {
                ruleRefs.current[idx] = el;
              }}
              sx={{
                borderRadius: 1,
                outline: isSel ? "2px solid" : "none",
                outlineColor: "primary.main",
                outlineOffset: 2,
                transition: "outline-color 0.15s",
              }}
            >
              <RuleRow stepId={step.id} ruleIndex={idx} rule={r} total={rules.length} />
            </Box>
          );
        })}
      </Stack>

      <Divider sx={{ my: 1 }} />

      <Box
        ref={defaultRef}
        sx={{
          border: "1px solid",
          borderColor: "primary.main",
          borderRadius: 1,
          p: 1,
          outline: selectedRuleIndex === "default" ? "2px solid" : "none",
          outlineColor: "primary.main",
          outlineOffset: 2,
          transition: "outline-color 0.15s",
        }}
      >
        <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600 }}>
          default — обязательный fallback
        </Typography>
        <Stack spacing={1} sx={{ mt: 0.5 }}>
          <GotoSelect
            value={defaultOutcome.goto}
            onChange={(v) => setDefaultGoto(step.id, v)}
            label="default.goto"
          />
          <Box>
            <Typography variant="caption" color="text.secondary">
              default.actions (если goto не задан — нужен хотя бы один finish)
            </Typography>
            <ActionsEditor
              actions={defaultOutcome.actions ?? []}
              onChange={(arr) => setDefaultActions(step.id, arr)}
            />
          </Box>
        </Stack>
      </Box>
    </Stack>
  );
};
