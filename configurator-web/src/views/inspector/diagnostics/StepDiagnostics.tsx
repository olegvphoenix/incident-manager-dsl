import { useMemo } from "react";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";

import { useEditorStore } from "../../../store/editorStore";

interface Props {
  stepId: string;
}

// Список диагностик, относящихся к этому шагу. Сгруппированы по severity.
export const StepDiagnostics = ({ stepId }: Props) => {
  const all = useEditorStore((s) => s.ui.diagnostics);
  const diagnostics = useMemo(
    () => all.filter((d) => d.stepId === stepId),
    [all, stepId],
  );
  if (diagnostics.length === 0) return null;
  const errors = diagnostics.filter((d) => d.severity === "error");
  const warnings = diagnostics.filter((d) => d.severity === "warning");

  return (
    <Stack spacing={1}>
      <Typography variant="caption" color="text.secondary">
        Диагностика
      </Typography>
      {errors.length > 0 && (
        <Alert severity="error">
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {errors.map((d, i) => (
              <li key={i}>{d.message}</li>
            ))}
          </ul>
        </Alert>
      )}
      {warnings.length > 0 && (
        <Alert severity="warning">
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {warnings.map((d, i) => (
              <li key={i}>{d.message}</li>
            ))}
          </ul>
        </Alert>
      )}
    </Stack>
  );
};
