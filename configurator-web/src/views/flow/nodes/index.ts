import type { NodeTypes } from "@xyflow/react";

import {
  ButtonNode,
  CheckboxNode,
  CommentNode,
  DatetimeNode,
  ImageNode,
  RadioButtonNode,
  SelectNode,
} from "./StepNodes";
import { EndNode } from "./EndNode";

// Ключи здесь должны совпадать с step.type из DSL — toFlow.ts кладёт
// step.type в Node.type, ReactFlow по этому ключу выбирает компонент.
// "endNode" — синтетический терминальный узел.
export const nodeTypes: NodeTypes = {
  RadioButton: RadioButtonNode,
  Checkbox: CheckboxNode,
  Select: SelectNode,
  Comment: CommentNode,
  Image: ImageNode,
  Datetime: DatetimeNode,
  Button: ButtonNode,
  endNode: EndNode,
};
