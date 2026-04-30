import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import Divider from "@mui/material/Divider";

// Иконки по типам шагов — те же, что используются в нодах
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";
import CheckBoxOutlinedIcon from "@mui/icons-material/CheckBoxOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import ArrowDropDownCircleOutlinedIcon from "@mui/icons-material/ArrowDropDownCircleOutlined";
import EventIcon from "@mui/icons-material/Event";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import SmartButtonIcon from "@mui/icons-material/SmartButton";

// Иконки для терминалов (совпадают с цветами TerminalEdge: finish→зелёный, и т.д.)
import FlagIcon from "@mui/icons-material/Flag";
import AssessmentIcon from "@mui/icons-material/Assessment";
import PriorityHighIcon from "@mui/icons-material/PriorityHigh";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";

import type { StepType, ActionType } from "../../types/dsl";

// MIME-тип для drag-data step-типов. Используется FlowEditor.handleDrop.
export const PALETTE_MIME = "application/dsl-step-type";

// MIME-тип для drag-data terminal-actions (finish/escalate/assign/generateReport).
// Drop на узел = установить default.actions = [{type}], очистить default.goto.
// Drop на пустое место = создать «висячий» Comment-шаг с этим терминалом
// (это редкий кейс; основная цель — drop на существующий шаг).
export const TERMINAL_MIME = "application/dsl-terminal-action";

const STEP_ITEMS: Array<{
  type: StepType;
  label: string;
  hint: string;
  icon: React.ReactNode;
}> = [
  {
    type: "RadioButton",
    label: "RadioButton",
    hint: "Выбор одного варианта из списка",
    icon: <RadioButtonCheckedIcon fontSize="small" />,
  },
  {
    type: "Checkbox",
    label: "Checkbox",
    hint: "Множественный выбор",
    icon: <CheckBoxOutlinedIcon fontSize="small" />,
  },
  {
    type: "Select",
    label: "Select",
    hint: "Выпадающий список",
    icon: <ArrowDropDownCircleOutlinedIcon fontSize="small" />,
  },
  {
    type: "Comment",
    label: "Comment",
    hint: "Свободный комментарий оператора",
    icon: <DescriptionOutlinedIcon fontSize="small" />,
  },
  {
    type: "Datetime",
    label: "Datetime",
    hint: "Дата/время",
    icon: <EventIcon fontSize="small" />,
  },
  {
    type: "Image",
    label: "Image",
    hint: "Загрузка изображения",
    icon: <ImageOutlinedIcon fontSize="small" />,
  },
  {
    type: "Button",
    label: "Button",
    hint: "Кнопка с предопределённым действием",
    icon: <SmartButtonIcon fontSize="small" />,
  },
];

const TERMINAL_ITEMS: Array<{
  type: ActionType;
  label: string;
  hint: string;
  icon: React.ReactNode;
  color: string;
}> = [
  {
    type: "finish",
    label: "Finish",
    hint: "Завершить сценарий. Бросьте на шаг — у него default станет finish.",
    icon: <FlagIcon fontSize="small" />,
    color: "#2e7d32",
  },
  {
    type: "generateReport",
    label: "Report",
    hint: "Сгенерировать отчёт. Бросьте на шаг — default станет generateReport.",
    icon: <AssessmentIcon fontSize="small" />,
    color: "#7b1fa2",
  },
  {
    type: "escalate",
    label: "Escalate",
    hint: "Эскалировать инцидент. Бросьте на шаг — default станет escalate.",
    icon: <PriorityHighIcon fontSize="small" />,
    color: "#ed6c02",
  },
  {
    type: "assign",
    label: "Assign",
    hint: "Назначить исполнителя (терминальное). Бросьте на шаг.",
    icon: <AssignmentIndIcon fontSize="small" />,
    color: "#1976d2",
  },
];

// Боковая палитра. Две секции:
//  1) «Шаги» — drag создаёт новый Step.
//  2) «Завершения» — drag НА шаг устанавливает default.actions=[{type:terminal}],
//     убирает default.goto. На пустое место — игнорируется.
export const StepPalette = () => {
  const handleStepDragStart = (e: React.DragEvent<HTMLDivElement>, type: StepType) => {
    e.dataTransfer.setData(PALETTE_MIME, type);
    e.dataTransfer.effectAllowed = "copy";
  };
  const handleTerminalDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    type: ActionType,
  ) => {
    e.dataTransfer.setData(TERMINAL_MIME, type);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <Box
      sx={{
        height: "100%",
        width: "100%",
        bgcolor: "background.paper",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box sx={{ px: 1.25, py: 1 }}>
        <Typography variant="overline" color="text.secondary">
          Палитра
        </Typography>
      </Box>

      <Stack spacing={0.5} sx={{ overflowY: "auto", px: 1, pb: 1 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ px: 0.5, mt: 0.5, fontWeight: 600 }}
        >
          Шаги · перетащите на холст
        </Typography>
        {STEP_ITEMS.map((it) => (
          <Tooltip key={it.type} placement="right" title={it.hint}>
            <Box
              draggable
              onDragStart={(e) => handleStepDragStart(e, it.type)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1,
                py: 0.75,
                borderRadius: 1,
                border: "1px solid",
                borderColor: "divider",
                cursor: "grab",
                userSelect: "none",
                bgcolor: "background.default",
                "&:hover": {
                  borderColor: "primary.main",
                  bgcolor: "action.hover",
                },
                "&:active": { cursor: "grabbing" },
              }}
            >
              <Box sx={{ color: "primary.main", display: "flex" }}>{it.icon}</Box>
              <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 12 }}>
                {it.label}
              </Typography>
            </Box>
          </Tooltip>
        ))}

        <Divider sx={{ my: 1 }} />

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ px: 0.5, fontWeight: 600 }}
        >
          Завершения · перетащите на шаг
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ px: 0.5, mb: 0.5, fontStyle: "italic", fontSize: 10 }}
        >
          У шага вместо goto появится терминал
        </Typography>
        {TERMINAL_ITEMS.map((it) => (
          <Tooltip key={it.type} placement="right" title={it.hint}>
            <Box
              draggable
              onDragStart={(e) => handleTerminalDragStart(e, it.type)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1,
                py: 0.75,
                borderRadius: 1,
                border: "1px solid",
                borderColor: it.color,
                cursor: "grab",
                userSelect: "none",
                bgcolor: "background.default",
                "&:hover": {
                  bgcolor: "action.hover",
                  borderWidth: 2,
                },
                "&:active": { cursor: "grabbing" },
              }}
            >
              <Box sx={{ color: it.color, display: "flex" }}>{it.icon}</Box>
              <Typography
                variant="body2"
                sx={{ fontFamily: "monospace", fontSize: 12, color: it.color }}
              >
                {it.label}
              </Typography>
            </Box>
          </Tooltip>
        ))}
      </Stack>
    </Box>
  );
};
