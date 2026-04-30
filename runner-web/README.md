# Incident Manager — Web Runner (демо)

Минимальное демо-приложение, которое:

- читает **все** JSON-сценарии из `../examples/` (рекурсивно, через
  `import.meta.glob` — добавили файл, он появился в списке после рестарта dev);
- рендерит их шаги согласно DSL v1 (см. `../dsl-v1-draft.md`);
- вычисляет переходы через JSONLogic (`json-logic-js`, единственная
  не-React зависимость в продуктовой части);
- сохраняет результат в `localStorage` и предлагает скачать как JSON.

Это **референс-runner**: показывает, что DSL действительно
платформо-независим, и служит проверкой архитектурных решений.

## Что НЕ сделано (осознанно, для упрощения первой версии)

- **Server-side actions** (`callMacro`, `generateReport`, `escalate`, `assign`)
  записываются только в `history`, реальных вызовов не делают.
- **Image source `camera` / `map`** — рисуем placeholder, потоки не подключены.
- **Семантическая валидация** (висящие `goto`, дубли id) на этом уровне
  не проверяется — предполагается, что сервер уже всё проверил.

## Запуск

```bash
cd incident-manager-dsl/runner-web
npm install
npm run dev
```

Откроется на `http://localhost:5173`. На странице — список всех сценариев из
`../examples/`. Кликаете по любому → проходите → видите финальный
`scenarioResult` JSON.

## Сборка статики

```bash
npm run build
```

Собранная статика — в `dist/`. Можно отдавать любым статик-сервером.

## Структура

```
src/
├── App.tsx
├── main.tsx
├── types/dsl.ts                  # TS-контракт DSL
├── engine/
│   ├── transitionEvaluator.ts    # JSONLogic + first-match
│   └── stateMachine.ts           # переходы, history, finished
├── scenarios/index.ts            # Vite glob → ScenarioEntry[]
├── store/storage.ts              # localStorage (заменится на HTTP позже)
├── components/
│   ├── ScenarioPicker.tsx
│   ├── ScenarioRunner.tsx
│   ├── ProgressPanel.tsx
│   ├── ResultView.tsx
│   └── steps/                    # 7 step-компонентов + StepRenderer
└── styles/index.css
```

## Как добавить новый сценарий

1. Положите валидный по `../dsl-v1-schema.json` JSON в `../examples/` (или
   подпапку — glob рекурсивный).
2. Перезапустите dev-сервер (`Ctrl+C`, `npm run dev`) — Vite пересоздаст glob.
3. Сценарий появится в списке.

Не редактируйте код runner'а для этого. Это и есть смысл declarative DSL.
