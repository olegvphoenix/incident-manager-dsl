// Edge-типы. На M2 используем встроенные BezierEdge со стилизацией через
// data + className. Кастомные компоненты с форм-фактором "AddNode-кнопка
// на edge" появятся в M4.

import type { EdgeTypes } from "@xyflow/react";
import { DefaultEdge } from "./DefaultEdge";
import { RuleEdge } from "./RuleEdge";
import { TerminalEdge } from "./TerminalEdge";

export const edgeTypes: EdgeTypes = {
  defaultEdge: DefaultEdge,
  ruleEdge: RuleEdge,
  terminalEdge: TerminalEdge,
};
