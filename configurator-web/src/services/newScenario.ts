// Шаблон нового сценария. Соответствует A1-minimal-valid-scenario.json:
// один Button-шаг с finish-action. Сразу проходит Level 1 валидацию.

import { v7 as uuidv7 } from "uuid";
import type { ScenarioScript } from "../types/dsl";

export function createBlankScenario(name = "Новый сценарий"): ScenarioScript {
  return {
    dslVersion: "1.0",
    locale: "ru",
    metadata: {
      scenarioGuid: uuidv7(),
      version: 1,
      name,
    },
    initialStepId: "ack",
    steps: [
      {
        id: "ack",
        type: "Button",
        view: { label: "Подтвердить и закрыть", emphasis: "primary" },
        transitions: {
          default: {
            actions: [{ type: "finish" }],
          },
        },
      },
    ],
  };
}
