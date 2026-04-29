// Сводные «факты о DSL» для стартовой страницы.
// Числа — захардкоженные константы (избегаем тяжёлых glob'ов в основном bundle'е).
// Если поменяется состав — обновить здесь; контролируется при ревью PR.

export interface KeyFact {
  value: string;
  label: string;
  hint?: string;
}

export const KEY_FACTS: KeyFact[] = [
  {
    value: "29",
    label: "примеров сценариев",
    hint: "от витрины примитивов до production-инцидентов, библиотечных и анти-паттернов",
  },
  {
    value: "8",
    label: "типов шагов",
    hint: "RadioButton · Checkbox · Select · Comment · Image · Datetime · Button · CallScenario",
  },
  {
    value: "5",
    label: "actions на переходах",
    hint: "assign · callMacro · generateReport · escalate · finish",
  },
  {
    value: "26",
    label: "определений в JSON Schema",
    hint: "из dsl-v1-schema.json — каждое доступно во вкладке «Схема»",
  },
  {
    value: "8",
    label: "Markdown-документов",
    hint: "спецификация, market research, анализ сервера, README",
  },
  {
    value: "1.0",
    label: "версия DSL",
    hint: "контракт стабилен; v2 — отложенные пункты см. spec §12",
  },
];

export const PRINCIPLES: Array<{ id: string; title: string; short: string }> = [
  { id: "P1",  title: "Декларативно",         short: "Что показать оператору, а не как; runner интерпретирует JSON" },
  { id: "P2",  title: "Платформонезависимо",  short: "Один JSON работает на Web/iOS/Android без изменений" },
  { id: "P3",  title: "Версионируемо",        short: "scenarioGuid + version: иммутабельные ревизии" },
  { id: "P4",  title: "Валидируемо",          short: "JSON Schema + JSONLogic whitelist + серверные проверки" },
  { id: "P5",  title: "Стабильные id",        short: "Step.id и Option.id — стабильные ключи в state и логах" },
  { id: "P6",  title: "Переиспользуемо",      short: "CallScenario: библиотечные под-сценарии" },
  { id: "P7",  title: "Аудируемо",            short: "scenarioResult.history — append-only журнал событий" },
  { id: "P8",  title: "Расширяемо",           short: "Неизвестные actions/типы шагов — warning, не падение" },
  { id: "P9",  title: "SDUI",                 short: "Сервер inline-резолвит CallScenario при создании Incident'а" },
  { id: "P10", title: "Совместимо с легаси",  short: "Все типы шагов и actions ↔ существующие Helper_*/IM/" },
  { id: "P11", title: "Минимум boilerplate",  short: "Минимально валидный сценарий — 4 строки кроме metadata" },
];
