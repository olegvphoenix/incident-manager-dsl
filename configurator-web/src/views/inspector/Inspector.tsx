import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";

import { useEditorStore, useSelectedStep } from "../../store/editorStore";
import { ScenarioSettings } from "./ScenarioSettings";
import { StepInspector } from "./StepInspector";
import { StepInspectorCompact } from "./StepInspectorCompact";

// Корневой Inspector. Логика простая: если выбран шаг — показываем редактор шага,
// иначе — глобальные настройки сценария. Когда сценарий ещё не открыт —
// просим открыть.
//
// В режиме `table` основной редактор живёт в самой таблице (карточка-строка
// разворачивается в три секции). Чтобы инспектор не дублировал те же формы,
// мы показываем «компактный» вариант — только расширенные поля и редактор
// сложных условий. В режиме `flow` остаётся полный инспектор, потому что
// там нет inline-редактора шага.
export const Inspector = () => {
  const scenario = useEditorStore((s) => s.scenario);
  const view = useEditorStore((s) => s.ui.view);
  const selected = useSelectedStep();

  if (!scenario) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="overline" color="text.secondary">
          Inspector
        </Typography>
        <Divider sx={{ my: 1 }} />
        <Typography variant="body2" color="text.secondary">
          Откройте или создайте сценарий — здесь появятся свойства шагов
          и общие настройки.
        </Typography>
      </Box>
    );
  }

  if (selected) {
    return view === "table" ? (
      <StepInspectorCompact step={selected} />
    ) : (
      <StepInspector step={selected} />
    );
  }

  return <ScenarioSettings />;
};
