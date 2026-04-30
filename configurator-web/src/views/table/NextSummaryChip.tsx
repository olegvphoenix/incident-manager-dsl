import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import EastIcon from "@mui/icons-material/East";
import LoopIcon from "@mui/icons-material/Loop";
import FlagIcon from "@mui/icons-material/Flag";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import DescriptionIcon from "@mui/icons-material/Description";
import SettingsSuggestIcon from "@mui/icons-material/SettingsSuggest";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";

import type { Step } from "../../types/dsl";
import { nextColor, summarizeNext, type NextSummaryKind } from "./stepHelpers";

interface Props {
  step: Step;
  // onClick — кликабельная плашка. По клику обычно раскрывается строка
  // и фокус переходит к секции «Что после».
  onClick?: () => void;
}

// Компактная цветная плашка-сводка «куда ведёт шаг». Заменяет
// старые outgoing-чипы вида r0→step. Один маркер вместо набора —
// пользователь сразу понимает, что произойдёт.
//
// Используем MUI-иконки, а не emoji — emoji в Chip с `color=success`
// рендерятся системным цветным шрифтом и плохо контрастируют с фоном.
// MUI-иконки наследуют цвет текста и выглядят профессионально.
export const NextSummaryChip = ({ step, onClick }: Props) => {
  const sum = summarizeNext(step);
  const color = nextColor(sum.kind);
  const icon = iconFor(sum.kind);
  const tooltip = tooltipText(sum.kind, sum.text);
  return (
    <Tooltip title={tooltip}>
      <Chip
        size="small"
        color={color === "default" ? "default" : color}
        variant={sum.kind === "broken" || sum.kind === "none" ? "outlined" : "filled"}
        icon={icon}
        label={sum.text}
        onClick={onClick}
        sx={{
          maxWidth: "100%",
          fontFamily: sum.kind === "goto" ? "monospace" : "inherit",
          fontWeight: sum.kind === "goto" || sum.kind === "branches" ? 500 : 400,
          cursor: onClick ? "pointer" : "default",
          "& .MuiChip-icon": { fontSize: 16, ml: 0.5 },
          "& .MuiChip-label": { textOverflow: "ellipsis" },
        }}
      />
    </Tooltip>
  );
};

function iconFor(kind: NextSummaryKind) {
  switch (kind) {
    case "goto":
      return <EastIcon />;
    case "stay":
      return <LoopIcon />;
    case "finish":
      return <FlagIcon />;
    case "escalate":
      return <WarningAmberIcon />;
    case "assign":
      return <AssignmentIndIcon />;
    case "generateReport":
      return <DescriptionIcon />;
    case "callMacro":
      return <SettingsSuggestIcon />;
    case "branches":
      return <AccountTreeIcon />;
    case "broken":
      return <ErrorOutlineIcon />;
    case "none":
      return <HelpOutlineIcon />;
    default:
      return undefined;
  }
}

function tooltipText(kind: string, text: string): string {
  switch (kind) {
    case "goto":
      return `После шага сценарий перейдёт к: ${text}`;
    case "stay":
      return "Сценарий останется на этом шаге (петля). Полезно редко — например, для повторного ввода.";
    case "finish":
      return "Шаг завершает инцидент.";
    case "escalate":
      return "Шаг эскалирует инцидент (передаёт ответственность дальше).";
    case "assign":
      return "Шаг назначает инцидент конкретному исполнителю.";
    case "generateReport":
      return "Шаг генерирует отчёт по инциденту.";
    case "callMacro":
      return "Шаг вызывает макрос (внешнюю автоматизацию).";
    case "branches":
      return "У шага несколько веток — итог зависит от ответа оператора. Раскройте строку, чтобы увидеть все ветки.";
    case "broken":
      return "Что произойдёт после шага — не задано. Это сделает сценарий невалидным.";
    case "none":
      return "Переходы у шага не настроены.";
    default:
      return text;
  }
}
