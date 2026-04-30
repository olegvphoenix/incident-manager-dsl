// Список встроенных в сборку демонстрационных сценариев из ../../examples.
// Доступен из Toolbar через меню "Пример" — пользователь может открыть
// любой существующий сценарий одним кликом, без диалога выбора файла.
// Sidecar-layout у этих сценариев отсутствует — редактор раскладывает
// граф автоматически (dagre) при загрузке.
//
// Vite инлайнит JSON во время сборки, поэтому это не дороже обычного импорта.

import perimeterAlarm from "../../../examples/01-perimeter-alarm.json";
import fireAlarm from "../../../examples/02-fire-alarm.json";
import accessControl from "../../../examples/03-access-control-violation.json";
import suspiciousObject from "../../../examples/04-suspicious-object.json";
import cameraOffline from "../../../examples/05-camera-offline.json";
import fight from "../../../examples/06-fight-aggressive-behavior.json";
import restrictedArea from "../../../examples/07-restricted-area-breach.json";
import evacuationDrill from "../../../examples/08-evacuation-drill.json";
import cameraSabotage from "../../../examples/09-camera-sabotage-suspicion.json";
import massEvent from "../../../examples/10-mass-event-protocol.json";
import primitives from "../../../examples/showcase/00-primitives.json";
import a1Minimal from "../../../examples/architecture/A1-minimal-valid-scenario.json";

import type { ScenarioScript } from "../types/dsl";

export interface DevExample {
  fileName: string;
  label: string;
  scenario: ScenarioScript;
}

export const DEV_EXAMPLES: DevExample[] = [
  { fileName: "01-perimeter-alarm", label: "01 — Тревога периметра", scenario: perimeterAlarm as ScenarioScript },
  { fileName: "02-fire-alarm", label: "02 — Пожарная тревога", scenario: fireAlarm as ScenarioScript },
  { fileName: "03-access-control-violation", label: "03 — СКУД: нарушение", scenario: accessControl as ScenarioScript },
  { fileName: "04-suspicious-object", label: "04 — Подозрительный предмет", scenario: suspiciousObject as ScenarioScript },
  { fileName: "05-camera-offline", label: "05 — Камера офлайн", scenario: cameraOffline as ScenarioScript },
  { fileName: "06-fight-aggressive-behavior", label: "06 — Драка / агрессия", scenario: fight as ScenarioScript },
  { fileName: "07-restricted-area-breach", label: "07 — Проникновение в режимную зону", scenario: restrictedArea as ScenarioScript },
  { fileName: "08-evacuation-drill", label: "08 — Учебная эвакуация", scenario: evacuationDrill as ScenarioScript },
  { fileName: "09-camera-sabotage-suspicion", label: "09 — Подозрение на саботаж камеры (14 шагов)", scenario: cameraSabotage as ScenarioScript },
  { fileName: "10-mass-event-protocol", label: "10 — Массовое мероприятие (15 шагов)", scenario: massEvent as ScenarioScript },
  { fileName: "00-primitives", label: "Showcase — все 7 типов шагов", scenario: primitives as ScenarioScript },
  { fileName: "A1-minimal-valid-scenario", label: "A1 — Минимальный валидный сценарий", scenario: a1Minimal as ScenarioScript },
];
