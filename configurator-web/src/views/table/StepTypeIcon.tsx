import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import ArrowDropDownCircleIcon from "@mui/icons-material/ArrowDropDownCircle";
import NotesIcon from "@mui/icons-material/Notes";
import ImageIcon from "@mui/icons-material/Image";
import ScheduleIcon from "@mui/icons-material/Schedule";
import SmartButtonIcon from "@mui/icons-material/SmartButton";

import type { StepType } from "../../types/dsl";

// Маленький компонент, который рендерит иконку по StepType. Вынесен,
// чтобы taskы StepTypeMeta не таскали React-зависимости. Цвет/размер
// задаёт родитель через sx.
export const StepTypeIcon = ({
  type,
  fontSize = "small",
  sx,
}: {
  type: StepType;
  fontSize?: "small" | "inherit" | "medium" | "large";
  sx?: object;
}) => {
  switch (type) {
    case "RadioButton":
      return <RadioButtonCheckedIcon fontSize={fontSize} sx={sx} />;
    case "Checkbox":
      return <CheckBoxIcon fontSize={fontSize} sx={sx} />;
    case "Select":
      return <ArrowDropDownCircleIcon fontSize={fontSize} sx={sx} />;
    case "Comment":
      return <NotesIcon fontSize={fontSize} sx={sx} />;
    case "Image":
      return <ImageIcon fontSize={fontSize} sx={sx} />;
    case "Datetime":
      return <ScheduleIcon fontSize={fontSize} sx={sx} />;
    case "Button":
      return <SmartButtonIcon fontSize={fontSize} sx={sx} />;
  }
};
