# Incident Manager — Configurator (Web)

Standalone Web-редактор сценариев Incident Manager DSL v1. Создаёт и
правит JSON-документы формата [`dsl-v1-schema.json`](../dsl-v1-schema.json)
в двух режимах:

1. **Диаграмма (Flow)** — граф шагов, рёбра по `transitions` (ReactFlow + dagre).
2. **Таблица (Table)** — виртуализированный построчный редактор для крупных
   сценариев, где диаграмма становится неудобной.

Layout (позиции узлов, viewport) хранится в **отдельном sidecar-файле**
`<имя>.layout.json` рядом со сценарием, ссылается на сценарий через
`scenarioGuid + version`. В DSL координат нет — это П1 спецификации
(платформо-независимость, см. [`../dsl-v1-draft.md`](../dsl-v1-draft.md)).

## Статус

- M0 — каркас приложения и сборка ✅
- M1 — Zustand-store, открытие/сохранение, Ajv-валидация ✅
- M2 — Flow read-only (адаптер DSL → ReactFlow, dagre auto-layout) ✅
- M3 — Step Inspector + правки + sidecar layout ✅
- M4 — редактирование Flow: connect, reconnect, delete-edge,
       autoLayout-button, undo/redo ✅
- M5 — TableView: виртуализация (`@tanstack/react-virtual`),
       inline-редактирование, фильтр по типу + поиск, левая полоса
       диагностики на строке ✅
- M6 — JSONLogic Visual Builder (Visual ↔ Raw) + нижняя панель Diagnostics
       (orphans, dangling goto, unreachable, dead-end, schema-errors) ✅
- M8 — полировка, demo-сценарии с layout, редеплой ⏳

## Что умеет

### Открыть / создать / сохранить

- **Новый** — пустой шаблон со случайным `scenarioGuid`.
- **Открыть** — диалог в режиме `multiple: true`. Можно выбрать сразу
  пару `<scenario>.json + <scenario>.layout.json` — они будут разнесены
  по типу автоматически (по имени `*.layout.json` или по содержимому
  `layoutVersion`). Если выбран только сценарий — layout пустой,
  редактор разложит граф через dagre на лету.
- **Пример** — выпадающий список со всеми встроенными сценариями из
  `examples/` (включая `00-primitives` со всеми семью типами шагов и
  крупный `10-mass-event-protocol` на 15 шагов).
- **Сохранить** — Ctrl+S. В Chromium-браузерах через File System Access
  API (повторное сохранение в тот же файл). В fallback-режиме — два
  отдельных скачивания: `*.json` и `*.layout.json`.

### Flow View (диаграмма)

- Узлы по семи типам шагов с иконками; левая зелёная полоса — initial,
  левая красная — есть ошибки, жёлтая — предупреждения.
- Терминальные узлы `__end_*` — синтетические, дорисовываются для
  default-action'ов (`finish`, `escalate`, `assign`, `generateReport`,
  `callMacro`).
- **Drag** узлов сохраняет позиции в layout. **Auto-layout-кнопка**
  (магическая палочка в Toolbar) — пересчитывает dagre, сохраняя ручные
  позиции.
- **Connect**: drag из bottom-handle одного узла в top-handle другого.
  Если у source-шага нет `default.goto` — заполняем default; иначе
  добавляем новое правило `{when: true, goto: target}`.
- **Reconnect**: тащить конец существующего ребра на другой узел —
  `default.goto` или `rules[idx].goto` обновятся семантически.
- **Delete edge**: выделить ребро + Delete. Для default-edge стирается
  `default.goto`, для rule-edge удаляется само правило.
- **MiniMap** + **Controls** (zoom, fit-view) включены.

### Table View

- Виртуализированная таблица: 8 колонок (`#`, `id`, `type`, `title`,
  `editable`, `outgoing`, `incoming`, `diag`).
- **Поиск** по id/title/type, **фильтр** по типу шага.
- **Inline-редактирование**: id (Enter/blur, regex `^[a-z][a-z0-9_]{0,63}$`,
  проверка уникальности), title (Enter/blur), type (Select с подтверждением,
  view заменяется дефолтным), editable (Switch).
- **Set start** — play-arrow в колонке `#` делает шаг начальным.
- **Outgoing/Incoming chips** показывают связи (с тултипом — кто и куда).
- **Левая полоса** на строке — красная при ошибках, жёлтая при предупреждениях,
  с тултипом-сводкой по диагностике.

### Step Inspector (правая панель)

- Identity: id (rename), type (Select с подтверждением), title, editable,
  «set start».
- View-form: специфичный для типа шага редактор (label, placeholder,
  options для RadioButton/Checkbox, мин/макс для Number, формат для Datetime,
  …).
- Transitions: список `rules` с reorder/delete + блок default. Для каждого
  правила — JSONLogic-редактор (Visual ↔ Raw), GotoSelect, ActionsEditor.
- Diagnostics в самом низу: показывает только диагностику текущего шага.

### JSONLogic Visual Builder

- Поддерживает: `==/!=/</>/<=/>=`, `in`, `and`, `or`, `not`, литералы
  (boolean/number/string), `var "state.xxx"`.
- Var-редактор с `Autocomplete` по списку шагов + опций (`state.<stepId>.value`,
  `state.<stepId>.options.<optId>`).
- Для непонятных операторов (apply, missing, …) — fallback-узел `unknown`,
  который стартует Raw-режим, чтобы пользователь мог поправить руками.

### Diagnostics panel (нижняя)

- **Свёрнутый bar** всегда виден внизу: счётчики ошибок/предупреждений
  и топ-4 кода диагностики.
- **Развёрнутая панель** (Ctrl+J) — полный список с группировкой по коду.
  Клик по записи выделяет шаг (если у диагностики есть `stepId`).
- Детекторы:
  - `ajv` — нарушения JSON Schema (Level 1).
  - `duplicate_step_id`, `duplicate_option_id`.
  - `dangling_goto` — ссылка на несуществующий шаг.
  - `default_dead_end` — default без `goto` и без finish-action.
  - `unreachable_step` — нет пути от `initialStepId`.
  - `orphan_step` — на шаг никто не ссылается (warning, отдельно от unreachable).
  - `missing_initial_step`.

### Хоткеи

| Клавиша           | Действие                                |
| ----------------- | --------------------------------------- |
| Ctrl/Cmd+S        | Сохранить                               |
| Ctrl/Cmd+Z        | Undo                                    |
| Ctrl/Cmd+Shift+Z  | Redo                                    |
| Ctrl/Cmd+Y        | Redo (Windows)                          |
| Ctrl/Cmd+J        | Toggle нижней панели диагностики        |
| Delete / Backspace| Удалить выделенное (шаг — с подтверждением, ребро — без) |
| Esc               | Снять выделение                         |

## Стек

- Vite 5 + React 18 + TypeScript 5.
- `@xyflow/react` (ReactFlow v12) — Flow-редактор.
- `@tanstack/react-virtual` — виртуализация Table.
- Zustand + zundo — state и undo/redo (`partialize` ограничивает историю
  до `scenario+layout`, ui-only изменения в past не пишутся).
- MUI v5 — UI-компоненты.
- Ajv 2020 + [`../dsl-v1-schema.json`](../dsl-v1-schema.json) — Level 1
  валидация DSL.
- `json-logic-js` — sanity-check JSONLogic-выражений в редакторе.
- `dagre` — авто-лейаут графа.

## Запуск

```bash
cd configurator-web
npm install
npm run dev          # http://localhost:5173
npm run build        # tsc + vite build (dist/)
npm run preview      # preview production-сборки на 5173 (или см. --port)
npm run typecheck    # tsc --noEmit
node scripts/smoke-examples.mjs   # smoke-валидация всех файлов из ../examples
```

## Архитектурные решения

- **Layout вне DSL.** Sidecar JSON, формат описан в
  [`src/types/layout.ts`](src/types/layout.ts). Поле `etag` (хеш
  отсортированных step.id) даёт детектор дрейфа: при загрузке редактор
  понимает, что список шагов изменился вне редактора, и доразмечает
  layout автоматически (`reconcileLayoutOnLoad`).
- **DSL — единый источник правды для семантики.** Связи (`transitions`)
  хранятся в DSL, а не в layout. Рёбра ReactFlow вычисляются
  адаптером `toFlow(scenario, layout)` каждый раз. Это исключает
  рассинхронизацию.
- **Standalone.** Никаких зависимостей от `web-configurator`. Когда
  потребуется — портируется как FSD-feature, типы и адаптеры переносятся
  без переписывания.
- **Правка через store-actions, а не через ReactFlow напрямую.**
  Пользовательские жесты (соединить, удалить, перенести) транслируются
  в семантические операции над DSL — это даёт корректный undo/redo
  и валидацию.
- **ReactFlow управляет выбором узлов сам.** Не пытаемся передавать
  `selected={true}` сверху — это приводило к двунаправленной петле
  `onSelectionChange ↔ store ↔ useMemo` (React #185). Из стора в
  ReactFlow выбор не реплицируем; в обратную сторону — пишем через
  `onSelectionChange`.

## См. также

- [`../dsl-v1-draft.md`](../dsl-v1-draft.md) — спецификация DSL v1.
- [`../dsl-v1-schema.json`](../dsl-v1-schema.json) — JSON Schema (контракт).
- [`../runner-web`](../runner-web) — референсный исполняющий runner. Часть
  кода переиспользуется (типы, валидация, JSONLogic).
- [`../proposal-versioning.md`](../proposal-versioning.md) — модель
  версионирования сценариев на сервере.
