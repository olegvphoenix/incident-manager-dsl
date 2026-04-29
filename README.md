# Incident Manager DSL v1

Пакет с проектированием **DSL v1** для системы Incident Manager: формат
описания UI-сценариев в JSON для конфигурирования через Web и исполнения на
любой платформе (Web/iOS/Android).

> **Целевая аудитория этого пакета:**
> архитекторы, тех-лиды, продакт-менеджер, разработчики сервера и runner'ов.
> Внутри — спецификация, исполняемая JSON Schema, обоснование архитектурных
> решений, предложение по серверным изменениям и 28 рабочих примеров.

---

## TL;DR (1 минута)

- **Что это:** декларативный JSON-формат, описывающий **граф шагов** UI-сценария
  (7 типов элементов управления + ссылка на под-сценарий) с условными
  переходами на JSONLogic.
- **Почему JSON, а не код:** один и тот же сценарий рендерится Web-, iOS- и
  Android-runner'ом без перекомпиляции; правка диффится; тестируется на схеме.
- **Главные архитектурные обещания:**
  1. **Server-Driven UI** — сервер хранит и отдаёт `script`, runner —
     «глупый» интерпретатор.
  2. **Версионируемость** — каждое сохранение сценария = новая запись с
     `(guid, version)`; старые инциденты продолжают работать на своей версии.
  3. **Под-сценарии разворачиваются на сервере** — runner получает плоский
     граф, никогда не видит `CallScenario`. Это и есть «принцип П9».
  4. **JSONLogic для условий** — стандартный whitelist 16 операторов, готовые
     парсеры для всех платформ.
- **Как валидируется:** двумя уровнями — JSON Schema (структура) + сервер
  (семантика: висящие goto, циклы под-сценариев, дубли id).

---

## Что в пакете

| Файл / папка | Что | Объём |
| --- | --- | --- |
| [`dsl-v1-draft.md`](./dsl-v1-draft.md) | Главная **спецификация** DSL: принципы (П1–П9), 7+1 типов шагов, JSONLogic-whitelist, два уровня валидации, зафиксированные решения (Р1–Р5) | ~1600 строк |
| [`dsl-v1-schema.json`](./dsl-v1-schema.json) | Исполняемая **JSON Schema** (Draft 2020-12). Уровень 1 валидации. | ~600 строк |
| [`market-research.md`](./market-research.md) | Анализ 8 продуктов рынка (Form.io, Camunda, Stripe, Backstage и др.) и обоснование выбора JSONLogic + SDUI | ~860 строк |
| [`server-analysis.md`](./server-analysis.md) | Анализ существующего Go-бэкенда `incident-manager-server`: что уже есть, какие расхождения с предложением, какая терминология | ~600 строк |
| [`proposal-versioning.md`](./proposal-versioning.md) | **Предложение для команды сервера**: миграция 005, версионирование `scenarios`, новый модуль `scenarioresolver` (inline + cycle detection) | ~780 строк |
| [`examples/`](./examples/) | **13 продакшн-сценариев VMS** (10 операторских + 3 библиотечных) — что делает DSL в реальной задаче | 16 файлов |
| [`examples/architecture/`](./examples/architecture/) | **15 архитектурных примеров** — что DSL обещает, как защищён, где границы | 15 файлов + README |
| [`runner-web/`](./runner-web/) | **Референсный Web-runner на React + TypeScript.** Загружает все JSON из `examples/` и реально их выполняет в браузере. Демо архитектуры в действии. | ~25 файлов |

---

## Порядок чтения по ролям

### Если вы продакт-менеджер (~30 мин)

1. **Этот README** — TL;DR (вы здесь).
2. **`examples/README.md`** — обзор 13 сценариев на VMS-домене. Откройте 2–3 файла, посмотрите на читаемость JSON.
3. **`examples/architecture/A1-minimal-valid-scenario.json`** — нижняя граница (15 строк = валидный сценарий).
4. **`examples/architecture/A4-versioning-demo/`** — 4 файла рядом, доказывают: правка библиотечного сценария не ломает старые инциденты.
5. **`examples/architecture/A7-diff-readability/`** — два файла, между которыми минимальная правка. Это аргумент за читаемость code review.
6. **`dsl-v1-draft.md` §1 «Принципы»** — 9 принципов, на которых всё держится. Особенно П2, П5, П9.

Что вам **не нужно** читать: `dsl-v1-schema.json`, `proposal-versioning.md`,
`server-analysis.md`. Это для разработчиков.

### Если вы архитектор / тех-лид (~2 часа)

1. **`market-research.md`** — почему **именно** такие решения (JSONLogic, SDUI, разделение editor/runner). Если не согласны с базой — стоит обсудить до dive-in.
2. **`dsl-v1-draft.md`** — целиком. Основные точки внимания:
   - §1 принципы и §13.1 «Зафиксированные решения» (Р1–Р5);
   - §6 типы шагов (особенно §6.8 `CallScenario`);
   - §7 JSONLogic whitelist и §11 уровни валидации.
3. **`server-analysis.md`** §5 «Расхождения» — 6 мест, где предложение и текущий сервер разъезжаются, и как это лечится.
4. **`examples/architecture/A3-inline-before-after/`** — практический разбор обещания «runner не знает про вложенность». Открыть 3 файла side-by-side.
5. **`examples/architecture/A5-anti-patterns/`** + README — где границы валидации (что ловит схема, что — сервер, а что — только code review).
6. **`proposal-versioning.md`** §6 — изменения в Go-бэкенде, чтобы это всё работало.

### Если вы разработчик сервера (Go) (~3 часа)

1. **`server-analysis.md`** — что уже есть в `incident-manager-server`, ваша точка отсчёта.
2. **`proposal-versioning.md`** целиком — это ваше **техзадание**:
   - §3 миграция БД,
   - §4 изменения в `scenario_queries.go`,
   - §5 изменения в OpenAPI,
   - §6 новый модуль `scenarioresolver` (inline + ValidateNoCycles) — **самое важное**.
3. **`dsl-v1-schema.json`** — это контракт; сервер обязан валидировать `script` через эту схему перед сохранением.
4. **`dsl-v1-draft.md`** §6.8, §11 — детали алгоритма inline-резолва и семантической валидации.
5. **`examples/architecture/A3-inline-before-after/`** — ваш **acceptance test**: реализованный inline должен превратить файл #2 в файл #3.
6. **`examples/architecture/A5-anti-patterns/bad-1` и `bad-2`** — что ваша семантическая валидация **обязана** отвергать с 422.

### Если вы разработчик runner'а (Web/iOS/Android) (~2 часа)

1. **`dsl-v1-draft.md`** §1 принципы (особенно П1, П3, П8, П9) и §6 типы шагов — это всё, что вы рендерите.
2. **`dsl-v1-schema.json`** — типы можно сгенерировать (TypeScript: `json-schema-to-typescript`, Swift: `quicktype`, Kotlin: то же).
3. **`dsl-v1-draft.md`** §7 JSONLogic + §9 семантика `history` — основная логика runner'а.
4. **`examples/`** — 13 продакшн-сценариев = ваш regression-набор.
5. **Что вы НЕ реализуете:** тип шага `CallScenario`. Сервер развернёт его до того, как runner получит сценарий. См. файл `examples/architecture/A3-inline-before-after/3-parent-after-inline-resolve.json` — это ваш типичный input.

---

## Зафиксированные архитектурные решения (Р1–Р5)

| # | Решение | Где задокументировано |
| --- | --- | --- |
| Р1 | Использовать **JSONLogic** для условий, не свой DSL. Whitelist 16 операторов. | `dsl-v1-draft.md` §7, обоснование — `market-research.md` |
| Р2 | `scenarioResult` хранится **inline в incident'е** как jsonb-снапшот, не в отдельной таблице. | `dsl-v1-draft.md` §13.1, `proposal-versioning.md` §3 |
| Р3 | `dslVersion` хранится **внутри JSON-документа**, не в колонке БД. | `dsl-v1-draft.md` §13.1 |
| Р4 | Под-сценарии — **гибрид**: design-time ссылка с pin'ом на `version`, сервер inline'ит их в плоский граф при создании Incident'а. | `dsl-v1-draft.md` §6.8, П9, `proposal-versioning.md` §6.2 |
| Р5 | **Циклы CallScenario запрещены**, ловятся DFS-обходом на сервере при сохранении сценария. | `dsl-v1-draft.md` §13.1, `proposal-versioning.md` §6.2 |

---

## Открытые вопросы

| # | Вопрос | Где задокументирован |
| --- | --- | --- |
| O1 | Forward-compat для `Action`: строгий `oneOf` (как сейчас) или open discriminator | `examples/architecture/README.md` финал; стоит вынести в `dsl-v1-draft.md` §13.2 |
| O2 | Локализация (i18n): inline-строки в v1 или сразу `labelKey`-механика | `dsl-v1-draft.md` §12 «Что отложено в v2» |
| O3 | Linter в редакторе для уровня 3 (стилистика): отдельный workstream | `examples/architecture/README.md` «открытые вопросы» |
| O4 | Где именно логировать `callMacro` / `generateReport` — в `history` фронт-сайд или отдельная событийная таблица сервера | `dsl-v1-draft.md` §13.1 (пока выбрано «фронт-сайд») |

---

## Как валидировать примеры

```bash
cd incident-manager-dsl
python -c "import jsonschema,json,glob
schema=json.load(open('dsl-v1-schema.json',encoding='utf-8'))
for f in sorted(glob.glob('examples/**/*.json',recursive=True)):
    try:
        jsonschema.validate(json.load(open(f,encoding='utf-8')),schema)
        print('OK   ',f)
    except jsonschema.ValidationError as e:
        print('FAIL ',f,'::',e.message[:80])"
```

Ожидаемое: **27 OK + 1 FAIL** (`examples/architecture/A5-anti-patterns/bad-3-unknown-action.json`
— это анти-пример, который **должен** не пройти схему, см. `examples/architecture/README.md`).

Альтернативно — через ajv-cli:

```bash
npm install --silent ajv ajv-cli ajv-formats
npx ajv validate --spec=draft2020 -c ajv-formats -s dsl-v1-schema.json -d "examples/**/*.json" --strict=false
```

---

## Не входит в пакет

- **`json-model-web-ui 3.md`** — исходный черновик от заказчика, источник
  вдохновения. Не контракт. Лежит у заказчика.
- **`incident-manager-server/`** — Go-бэкенд, на который ссылается
  `server-analysis.md` и `proposal-versioning.md`. Лежит в отдельном репозитории.
- **`IM/`** — легаси C++/MFC + C# реализация, изучалась для понимания домена и
  выявления анти-паттернов.

---

## История пакета

- **2026-04-28..29** — первая версия. Автор архитектурных решений: вы
  (заказчик), оформление и обоснования: AI-ассистент в Cursor. Цель —
  передать на ревью и защиту с продакт-менеджером, после чего двигаться к
  реализации редактора и runner'а.
