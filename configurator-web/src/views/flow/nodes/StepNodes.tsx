// Конкретные node-компоненты по типам шагов. Каждый — тонкая обёртка
// над BaseNode с правильной иконкой и краткой сводкой view.

import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import ArrowDropDownCircleIcon from "@mui/icons-material/ArrowDropDownCircle";
import CommentIcon from "@mui/icons-material/Comment";
import ImageIcon from "@mui/icons-material/Image";
import ScheduleIcon from "@mui/icons-material/Schedule";
import SmartButtonIcon from "@mui/icons-material/SmartButton";
import type { NodeProps } from "@xyflow/react";

import type {
  ButtonStep,
  CheckboxStep,
  CommentStep,
  DatetimeStep,
  ImageStep,
  RadioButtonStep,
  SelectStep,
} from "../../../types/dsl";
import { BaseNode } from "./BaseNode";
import type { FlowNodeData } from "../../../adapters/toFlow";

const ICON_PROPS = { fontSize: "small" as const };

export const RadioButtonNode = (props: NodeProps) => {
  const data = props.data as FlowNodeData;
  const step = data.step as RadioButtonStep;
  return (
    <BaseNode
      data={data}
      selected={props.selected}
      icon={<RadioButtonCheckedIcon {...ICON_PROPS} />}
      typeLabel="RadioButton"
      summary={`${step.view.label} · ${step.view.options?.length ?? 0} опций`}
    />
  );
};

export const CheckboxNode = (props: NodeProps) => {
  const data = props.data as FlowNodeData;
  const step = data.step as CheckboxStep;
  return (
    <BaseNode
      data={data}
      selected={props.selected}
      icon={<CheckBoxIcon {...ICON_PROPS} />}
      typeLabel="Checkbox"
      summary={`${step.view.label} · ${step.view.options?.length ?? 0} опций`}
    />
  );
};

export const SelectNode = (props: NodeProps) => {
  const data = props.data as FlowNodeData;
  const step = data.step as SelectStep;
  return (
    <BaseNode
      data={data}
      selected={props.selected}
      icon={<ArrowDropDownCircleIcon {...ICON_PROPS} />}
      typeLabel="Select"
      summary={`${step.view.label} · ${step.view.options?.length ?? 0} опций`}
    />
  );
};

export const CommentNode = (props: NodeProps) => {
  const data = props.data as FlowNodeData;
  const step = data.step as CommentStep;
  return (
    <BaseNode
      data={data}
      selected={props.selected}
      icon={<CommentIcon {...ICON_PROPS} />}
      typeLabel="Comment"
      summary={step.view.label}
    />
  );
};

export const ImageNode = (props: NodeProps) => {
  const data = props.data as FlowNodeData;
  const step = data.step as ImageStep;
  return (
    <BaseNode
      data={data}
      selected={props.selected}
      icon={<ImageIcon {...ICON_PROPS} />}
      typeLabel="Image"
      summary={`${step.view.label} · ${step.view.source}`}
    />
  );
};

export const DatetimeNode = (props: NodeProps) => {
  const data = props.data as FlowNodeData;
  const step = data.step as DatetimeStep;
  return (
    <BaseNode
      data={data}
      selected={props.selected}
      icon={<ScheduleIcon {...ICON_PROPS} />}
      typeLabel="Datetime"
      summary={`${step.view.label} · ${step.view.kind}`}
    />
  );
};

export const ButtonNode = (props: NodeProps) => {
  const data = props.data as FlowNodeData;
  const step = data.step as ButtonStep;
  return (
    <BaseNode
      data={data}
      selected={props.selected}
      icon={<SmartButtonIcon {...ICON_PROPS} />}
      typeLabel="Button"
      summary={step.view.label}
    />
  );
};
