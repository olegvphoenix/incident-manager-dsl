# Анализ существующего сервера `incident-manager-server`

> Цель: понять, что уже реализовано в Go-сервере, прежде чем писать
> `dsl-v1-draft.md`. Ветка изучения — `develop` (HEAD: `91b1443`).
>
> Финальная сводка и план — в разделе [7](#7-итоговая-сводка-и-план-для-dsl).

## Содержание

1. [Что уже видно с первого взгляда](#1-что-уже-видно-с-первого-взгляда)
2. [Этап 1. Общее устройство](#2-этап-1-общее-устройство)
3. [Этап 2. Модель данных в БД](#3-этап-2-модель-данных-в-бд)
4. [Этап 3. Формат сценария в API](#4-этап-3-формат-сценария-в-api)
5. [Найденные расхождения с `market-research.md`](#5-найденные-расхождения-с-market-researchmd)
6. [Открытые вопросы к команде сервера](#6-открытые-вопросы-к-команде-сервера)
7. [Итоговая сводка и план для DSL](#7-итоговая-сводка-и-план-для-dsl)
8. [Sub-scenario inlining — новая обязанность сервера](#8-sub-scenario-inlining--новая-обязанность-сервера)

---

## 1. Что уже видно с первого взгляда

### Что это за репо

- **Описание (Bitbucket):** `Incident Manager backend in Go`.
- **Ветка:** `develop` (master пока пустой — только `.gitignore`).
- **Объём:** ~250 файлов; production-проект, не прототип.
- **Видны PR-ы #7, #8, #9** в `git log` — команда работает по PR-процессу.
- Сборка через **Bamboo**, тесты в Docker с PostgreSQL контейнером.

### Сразу ключевые сущности (по таблицам и API)

| Сущность | Что это |
| --- | --- |
| `customers` | tenant; **multi-tenant на уровне БД через `customer_guid`** во всех таблицах |
| `agents` | агент Intellect, шлёт events в IM |
| `sources`, `source_types`, `source_actions`, `source_groups` | дерево источников событий |
| `events` | сырое событие из источника |
| `priorities`, `statuses` | справочники для инцидентов |
| **`scenarios`** | **схема обработки** (наш DSL живёт в `script jsonb`) |
| **`incident_rules`** | **триггеры**, m2m со сценариями через `incident_rule_scenarios` |
| `incident_rules_conditions` | **условия триггера** реляционно (по type/source/action/group) |
| **`incidents`** | инстанс инцидента, со **снапшотом схемы** в `scenario jsonb` и `scenario_result jsonb` |
| `incident_activities` | **журнал инцидента** (но трекает только status/priority/assignee, не шаги сценария) |
| `incident_actions`, `incident_action_transitions` | **state machine инцидента** (open → in_progress → closed) |
| `incident_rule_user_group_assignments` | RBAC: какие группы операторов работают с этим триггером |

---

## 2. Этап 1. Общее устройство

### 2.1. Технологический стек

| Слой | Library | Комментарий |
| --- | --- | --- |
| Go | 1.24.5 | свежее |
| HTTP framework | **Gin** (`gin-gonic/gin v1.11`) | стандарт |
| БД | **PostgreSQL** (`jackc/pgx/v5`) | подтверждено |
| БД query builder | `gopkg.in/mgutz/dat.v1` (низкоуровневый) + legacy `jinzhu/gorm` | без heavy-ORM |
| Миграции | `rubenv/sql-migrate` | формат `-- +migrate Up / Down` |
| OpenAPI | `getkin/kin-openapi` + форк `oapi-codegen` от Axxon | **API описано в YAML, генерится в Go** |
| UUID | `gofrs/uuid/v5` (uuid-v7) | время-сортируемые UUID |
| Cache | `karlseguin/ccache/v3` | in-memory |
| Config | `kelseyhightower/envconfig` | через env-переменные |
| Logger | `sirupsen/logrus` | стандарт |
| Validator | `go-playground/validator/v10` | стандарт |
| Тесты | `stretchr/testify` + integration с реальной PostgreSQL | надёжно |

### 2.2. Что НЕ подключено (важно для нас)

| Проверял | Нашёл? | Вывод |
| --- | --- | --- |
| `json-logic-go` | **нет** | JSONLogic-evaluator ещё не подключён — открытое окно |
| `cel-go` | нет | подтверждает наш отказ от CEL |
| protobuf для actions | нет | actions сериализуются JSON |
| Workflow-engine (Camunda/Zeebe/Temporal) | нет | сервер сам реализует workflow-логику |
| Event-bus (Kafka/NATS/AMQP) | нет | синхронное API без брокера |

### 2.3. Точка входа и структура

- **Один main:** `cmd/im/main.go` — один сервис, один бинарник.
- **`internal/im/`** — бизнес-логика incident manager (модули: `service`, `handler`, `tools`).
- **`internal/util/`** — общие утилиты (logging, httputils, dbhelpers, crypto, ...).
- **`api/im/backend.openapi.yaml`** — единый источник правды по API (2116 строк).
- **`internal/im/handler/v1/generated/`** — сгенерённые из OpenAPI handlers.

### 2.4. Build / CI

- **Bamboo** (Atlassian CI), pipeline `bs-prepare → bs-lint → bs-test → bs-build-image`.
- Корпоративный Go-proxy `npm.itvgroup.ru:3000` — все новые libs идут через него.
- **Integration tests с реальной PostgreSQL** в Docker — это значит, любая правка миграции должна пройти тесты.

---

## 3. Этап 2. Модель данных в БД

Источник: `internal/im/service/storing/migrations/001_initial_scheme.sql`.

### 3.1. Сценарий хранится **целиком как JSONB**

```sql
CREATE TABLE scenarios (
    guid            UUID PRIMARY KEY,
    name            TEXT,
    description     TEXT,
    creator_user_id BIGINT,
    read_only       BOOLEAN,
    script          jsonb            -- ← вся DSL-схема
);
```

**Совпадает с моим предложением** (Q4 в `market-research.md`).

### 3.2. Версионирования сценария **НЕТ**

Отсутствуют поля: `version`, `is_current`, `published_at`, `schema_hash`. Это **расхождение №1**, см. раздел [5](#5-найденные-расхождения-с-market-researchmd).

### 3.3. Снапшот сценария **в инциденте**

```sql
CREATE TABLE incidents (
    ...
    incident_rule_guid UUID REFERENCES incident_rules,
    scenario           jsonb NOT NULL,    -- замороженная копия script
    scenario_result    jsonb              -- прохождение оператора
);
```

То есть при создании инцидента сервер **копирует script** из текущего сценария в `incidents.scenario`. Дальше работа идёт со снапшотом, не с оригиналом. Это **частично** закрывает проблему версионирования (см. подробнее в [5](#5-найденные-расхождения-с-market-researchmd)).

### 3.4. Триггеры — **отдельная сущность с m2m**

```sql
CREATE TABLE incident_rules ( guid, name, priority_guid, customer_guid );

CREATE TABLE incident_rule_scenarios (
    rule_guid     UUID REFERENCES incident_rules,
    scenario_guid UUID REFERENCES scenarios,
    UNIQUE(rule_guid, scenario_guid)
);

CREATE TABLE incident_rules_conditions (
    incident_rule_guid UUID,
    -- условие — заполнен один из FK:
    source_type_guid   UUID NULL,
    source_guid        UUID NULL,
    source_action_guid UUID NULL,
    group_guid         UUID NULL
);
```

**Расхождение №2** с моим планом «inline в `scenario.triggers[]`». Серверная модель **сильнее** для текущего случая (m2m + реляционные условия). См. раздел [5](#5-найденные-расхождения-с-market-researchmd).

### 3.5. История инцидента — `incident_activities`

```sql
CREATE TABLE incident_activities (
    incident_guid, created_at, created_by_user_id,
    old_status_guid, new_status_guid,
    old_priority_guid, new_priority_guid,
    old_assignee_user_id, new_assignee_user_id,
    old_escalated_to_user_id, escalated_to_user_id
);
```

Трекает **только системные поля** (status/priority/assignee/escalated). **Не трекает прохождение сценария** (ответы оператора на шаги). **Расхождение №3**, см. [5](#5-найденные-расхождения-с-market-researchmd).

### 3.6. State machine инцидента — отдельный конфигурируемый слой

```sql
CREATE TABLE statuses ( code, name, is_default );
CREATE TABLE incident_actions ( code, name );
CREATE TABLE incident_action_transitions (
    incident_action_guid, from_status_guid, to_status_guid
);
```

Это **отдельный** state machine на уровне инцидента (open → in_progress → closed),
**не пересекающийся** с DSL-transitions (которые внутри сценария).

Архитектурно правильно: два уровня state — общий жизненный цикл инцидента (этот) и
прохождение сценария (наш DSL). Не путать.

### 3.7. Multi-tenant через `customer_guid`

Каждая таблица имеет `customer_guid REFERENCES customers`. Любой запрос обязан
фильтровать по нему. **DSL это не касается** — это слой выше.

### 3.8. RBAC через `incident_rule_user_group_assignments`

```sql
CREATE TABLE incident_rule_user_group_assignments (
    external_user_group_id BIGINT,           -- ссылка наружу (Intellect/Cloud)
    incident_rule_guid     UUID REFERENCES incident_rules,
    assigned_at, unassigned_at, ...
);
```

User-группы хранятся **снаружи** (`external_user_group_id BIGINT`). Связь
«группа операторов ↔ триггер». DSL не касается прав — это слой `incident_rule`.

---

## 4. Этап 3. Формат сценария в API

Источник: `api/im/backend.openapi.yaml`, схема `scenario` (строки 2013–2031).

### 4.1. Схема сценария в OpenAPI

```yaml
scenario:
  type: object
  properties:
    guid:        { type: string, format: uuid }
    name:        { type: string }
    description: { type: string }
    readOnly:    { type: boolean }
    script:      { type: object }     # ← БЕЗ структуры!
```

**Критически важно:** `script` объявлен как `type: object` **без описания свойств**. То есть:

- API **не валидирует** содержимое `script`;
- сервер **не знает**, что такое «шаг», «переход», «action» — для него это просто JSON;
- любые изменения формата DSL **не требуют правки сервера**;
- **наша зона ответственности** — определить, что лежит внутри `script`.

Аналогично:
```yaml
incident:
  properties:
    scenario:       { type: object }     # снапшот script
    scenarioResult: { type: object }     # прохождение оператора
```

Тоже чёрные ящики. **Это идеально**: сервер делает CRUD-инфраструктуру, мы делаем DSL.

### 4.2. CRUD-эндпоинты сценария

| Метод | Path | operationId |
| --- | --- | --- |
| POST | `/scenarios` | createScenario |
| GET | `/scenarios` | getScenarios |
| PATCH | `/scenarios` | updateScenario |
| DELETE | `/scenarios` | deleteScenario |
| GET | `/scenarios/{guid}` | getScenario |

Все аутентифицированы (`security: User`). Стандартный CRUD.

**Замечание:** есть PATCH (частичное обновление), но нет POST/PATCH с явным
указанием версии. То есть «опубликовать новую версию» сейчас означает **правку
существующей записи** — что и подтверждает отсутствие версионирования.

### 4.3. Триггеры в API

```yaml
incidentRule:
  required: [scenarios]
  properties:
    guid:         { type: string, format: uuid }
    name:         { type: string }
    scenarios:    [ uuid, uuid, ... ]    # массив guid'ов сценариев
    priorityGuid: uuid

incidentRuleCondition:
  properties:
    incidentRuleGuid:  uuid
    sourceTypeGuid:    uuid?     # nullable
    sourceGuid:        uuid?
    sourceActionGuid:  uuid?
    groupGuid:         uuid?
```

CRUD по `/incidents/rules`, `/incidents/conditions`, плюс
`/incidents/rules/user-group-assignments` для RBAC.

### 4.4. Все API endpoints

```
/events
/incidents, /incidents/{guid}
/incidents/rules, /incidents/rules/{guid}
/incidents/conditions, /incidents/conditions/{guid}
/incidents/rules/user-group-assignments(/{guid})
/agents, /agents/{guid}, /agents/tokens
/customers
/sources, /sources/{guid}, /sources/types(/{guid}), /sources/actions(/{guid})
/sources/groups, /sources/groups/tree, /sources/groups/memberships
/sync/sources/types, /sync/sources/actions, /sync/sources
/scenarios, /scenarios/{guid}
/priorities(/{guid}), /statuses(/{guid})
/heartbeat
```

Полный CRUD на каждую сущность + sync-эндпоинты для подтягивания из Intellect.

---

## 5. Найденные расхождения с `market-research.md`

Сводка решений, по которым сервер и наш план расходятся.

### Расхождение №1. Версионирование сценария

| | `market-research.md` | Сервер |
| --- | --- | --- |
| Что хранится | `scenarios(id, version, schema_json)` — каждая публикация = новая строка | `scenarios(guid, script)` — одна строка на сценарий |
| Что в инстансе | `instance.scenarioVersion` — ссылка на версию | `incident.scenario` — снапшот целиком |
| Аудит правок схемы | работает (старые версии в БД) | **не работает** — старые версии теряются |
| Откат «на vN-1» | возможен | невозможен |
| Размер БД | меньше | больше (snapshot per incident) |

**Аргументы в пользу серверного подхода (snapshot):**
- проще реализовать;
- инстанс самодостаточен — не нужно JOIN-ить версии;
- работает уже сейчас.

**Аргументы в пользу версионирования (Form.io / Camunda style):**
- аудит «кто и когда правил схему» — обязателен для compliance;
- откат поломанной версии за 1 SQL UPDATE;
- аналитика «N инцидентов на схеме vN» — для оптимизации сценариев;
- **что критично:** в дизайне Figma явно есть страница «Список Триггеров / Сценариев» с историей версий — то есть продукт-команда всё равно ждёт версионирования.

**Моё предложение:**

Сделать **гибрид**:
- оставить серверный snapshot в `incidents.scenario` (он реально работает);
- **добавить** к таблице `scenarios` поле `version INT` + флаг `is_current BOOLEAN`;
- при каждом обновлении сценария — INSERT новой строки `(guid, version+1, ...)`, не UPDATE;
- **новое поле** `incidents.scenario_version INT` для будущей аналитики.

Это требует **миграцию 005** на серверной стороне. Минимум ~30 строк SQL + правка `scenario_queries.go`. Аргументация для команды — compliance + откат.

### Расхождение №2. Триггеры — inline или отдельная сущность

| | `market-research.md` | Сервер |
| --- | --- | --- |
| Структура | `scenario.triggers[]` inline | `incident_rules` + m2m + conditions реляционно |
| Связь со сценарием | один-к-одному (внутри сценария) | many-to-many через `incident_rule_scenarios` |
| Условия срабатывания | в JSON | в реляционных колонках |
| Один rule → несколько сценариев | нельзя | можно |

**Сервер однозначно сильнее.** Снимаю своё inline-предложение.

**Для DSL-схемы `script` это значит:**
- внутри `script` **нет** секции `triggers`;
- триггеры — самостоятельные сущности `IncidentRule` (`incident_rule_*` API);
- `script` описывает только **что делает оператор после запуска**, а не «когда запускать».

### Расхождение №3. История прохождения сценария

| | `market-research.md` | Сервер |
| --- | --- | --- |
| Что сохраняется при ответе на шаг | `history.append({stepId, value, ts, actor, action: "answer"})` | только текущее значение в `incidents.scenario_result` |
| Что сохраняется при переходе | `history.append({action: "transition", from, to, matchedRule})` | ничего |
| Аудит «оператор передумал» | возможен | **невозможен** |
| Журнал статус/приоритет/assignee | `history` action'ы | **есть отдельно** в `incident_activities` |

**Аргументы в пользу подхода сервера (минимализм):**
- меньше пишем в БД;
- проще API.

**Аргументы в пользу `history` в `scenario_result`:**
- аудит «как именно оператор шёл по сценарию» обязателен в incident response;
- невозможно расследовать «почему оператор закрыл инцидент за 30 секунд»;
- невозможно построить отчёт «среднее число изменений ответа на шаге» (= UX-метрика);
- технически дешевле решить **сейчас** (структура `scenario_result`), чем добавлять отдельную таблицу потом.

**Моё предложение:**

В DSL зафиксировать структуру `scenarioResult`:
```jsonc
{
  "state":   { "stepId": { "value": ..., "answeredAt": ..., "by": ... } },
  "history": [
    { "ts": "...", "stepId": "...", "action": "answer",     "value": ..., "by": "..." },
    { "ts": "...", "stepId": "...", "action": "transition", "to": "...", "matchedRule": 0 }
  ]
}
```

Сервер **не нужно менять**: `scenario_result` уже `jsonb`. Но мы **зафиксируем** в DSL, что валидный `scenario_result` имеет именно эту структуру. Команда сервера может опционально добавить JSON Schema-валидацию.

### Расхождение №4. JSONLogic — где живёт

| | `market-research.md` | Сервер |
| --- | --- | --- |
| Где условия | JSONLogic внутри `transitions.rules[].when` (в `script`) | внутри `script` ничего не описано; `incident_rules_conditions` — реляционные колонки |

**Это не конфликт.** Условия в **триггерах** (`incident_rules_conditions`) — реляционные, потому что они статичны (по типу источника и т.п.). JSONLogic нужен внутри **сценария** для условных переходов между шагами — а это и есть зона `script`, где сервер не лезет.

**Решение:** оставляем JSONLogic как было; в `dsl-v1-draft.md` фиксируем,
что условия в `transitions.rules[].when` пишутся в JSONLogic. Сервер не трогаем.

Команде сервера в перспективе понадобится подключить `json-logic-go` (например,
для серверной валидации, что условия ссылаются на существующие `step.id`), но
**не блокирующе** для v1 — на v1 валидация будет на фронте при сохранении.

### Расхождение №5. Action-модель

| | `market-research.md` | Сервер |
| --- | --- | --- |
| Где живут actions | `transitions.rules[].actions[]` в `script` | внутри `script` сервер ничего не описывает |
| Action types | `callMacro`, `finish`, `generateReport`, `escalate`, `assign` | сервер не знает |

**Не конфликт.** Actions внутри `script` — наша зона. Сервер про них не знает,
до тех пор пока actions выполняются на стороне runner'а (Web/iOS/Android).
Если когда-то понадобится **server-side action** (например, `escalate` должен
поднять в БД эскалацию) — runner будет вызывать соответствующий API endpoint.

В DSL: actions — клиентские по умолчанию. Если нужен server-side — клиент
дёргает API через action-handler.

### Расхождение №6. Snapshot vs ссылка на версию (повтор расхождения №1)

Сервер копирует `script` в `incidents.scenario`. Это де-факто snapshot-подход.
Если введём версионирование (расхождение №1), хранение `incidents.scenario` остаётся
как есть, плюс рядом `incidents.scenario_version` для аналитики.

### Сводная таблица

| # | Тема | Сервер | Мы | Кто прав | Что делать |
| --- | --- | --- | --- | --- | --- |
| 1 | Версионирование схемы | snapshot per incident | versioned schema | гибрид | предложить миграцию 005 |
| 2 | Триггеры | отдельная сущность m2m | inline | **сервер** | снимаем своё |
| 3 | History прохождения | нет | есть | **мы** | фиксируем в DSL без правки сервера |
| 4 | JSONLogic | вне `script` (реляционные условия в conditions) | внутри `script` (для transitions) | **оба правы** в своих зонах | расходов нет |
| 5 | Actions | не знает | внутри `script` | **оба правы** | расходов нет |

---

## 6. Открытые вопросы к команде сервера

Эти вопросы я **не** могу закрыть из кода и хочу прояснить устно или PR-ом:

1. **Версионирование сценария.** Готовы ли принять миграцию 005, добавляющую `version` + `is_current` к `scenarios`?
2. **`incidents.scenario_result`.** Есть ли уже неформальная структура у этого JSONB? Может быть, в коде уже что-то пишут — стоит проверить `incident_converters.go` и runtime-логику (когда оператор отвечает на шаг).
3. **Запуск сценария.** Где в коде создаётся инцидент при срабатывании триггера — это видно в `incident_rule_scenarios_*` или в `event_*`? То есть — какой endpoint фронтенд дёргает «оператор взял инцидент в работу».
4. **`scenarios.read_only`.** Что этот флаг означает функционально? Системный сценарий, который нельзя редактировать?
5. **`creator_user_id`** на `scenarios`, но `customer_guid` отсутствует, при том что `scenarios_customers` — m2m. Один сценарий может принадлежать нескольким customer'ам? Это многотенантная **общая библиотека сценариев**?

---

## 7. Итоговая сводка и план для DSL

### Что мы знаем теперь

**Главное:** сервер сделал **очень удачный архитектурный ход** — `scenarios.script` объявлен как **`jsonb` без структуры** в БД и `type: object` без структуры в OpenAPI. То есть **серверная команда не пыталась угадать формат DSL** и оставила это нашей зоне.

Это значит:
- мы **можем** свободно проектировать DSL внутри `script`;
- сервер **не нужно** менять для v1 DSL — только если введём версионирование (расхождение №1);
- 4 из 6 наших ключевых решений из `market-research.md` **никак не противоречат** серверу;
- 2 расхождения требуют действий: одно (версионирование) — миграцией на сервере, другое (history) — только зафиксировать в DSL.

### Терминологический мэппинг

| Наш термин (из `market-research.md`) | Серверный термин | Что использовать в `dsl-v1-draft.md` |
| --- | --- | --- |
| `Scenario` | `scenario` (table + API) | `Scenario` ✓ |
| `script` (то, что внутри Scenario) | `scenarios.script jsonb` | **`script`** (берём имя сервера) |
| `Trigger` | `incidentRule` | в DSL **не упоминаем**, это вне `script` |
| `ScenarioInstance` | де-факто `incident` (с снапшотом script + result) | **`Incident`** — но в DSL мы говорим про runtime-state, **не сам Incident** |
| `state` + `history` (в инстансе) | `scenarios_result.state` + `scenarios_result.history` | **`scenarioResult.state`** + **`scenarioResult.history`** |
| `Step` | (внутри `script`, сервер не знает) | `Step` ✓ |
| `RadioButton`/`Checkbox`/`Select`/`Comment`/`Image`/`Button`/`Datetime` | (внутри `script`) | как есть |
| `actions[]` на переходе | (внутри `script`) | `actions` ✓ |
| `callMacro`/`finish`/`generateReport`/`escalate`/`assign` | (внутри `script`) | как есть |

### Что писать в `dsl-v1-draft.md` теперь

**С учётом этого анализа структура документа упрощается:**

```
1. Принципы            (платформо-независимость; DSL = содержимое scenarios.script)
2. Глоссарий           (наши термины ↔ серверные термины)
3. Что НЕ в DSL        (явно: триггеры, RBAC, multi-tenancy, статусы инцидента)
4. Структура script    (steps[], начальный шаг, общая metadata)
5. Step                (общие поля + transitions)
6. Типы шагов          (7 подразделов)
7. transitions         (default + rules[] с JSONLogic)
8. actions             (5 типов)
9. Структура scenarioResult (state + history)
10. Сквозной пример
11. Что отложено в v2  (versioning, миграция 005)
```

**Что мы НЕ делаем для v1:**
- `dsl-v1-draft.md` **не будет** диктовать сервер;
- предложение по версионированию (миграция 005) — **отдельный документ**, не часть DSL;
- триггеры **не описываем** — они в API сервера и так документированы.

**Объём `dsl-v1-draft.md`:** ориентировочно 600–900 строк (меньше, чем планировал
изначально — потому что уровень `Trigger`, `concurrency`, `editor` и т.д. сняли).

### Зафиксированные решения

После обсуждения 2026-04-29:

1. **Версионирование сценария — делаем.** Проектируем и DSL, и серверную часть. Будет отдельный документ `proposal-versioning.md` с описанием миграции 005 + изменений в `scenario_queries.go` + изменений в `scenarios` OpenAPI-схеме.
2. **Терминология меняется на серверную.** Используем серверные имена везде, где они есть:
   - `ScenarioInstance` → **`Incident`**;
   - `Trigger` → **`IncidentRule`** (вне DSL);
   - `instance.state` / `instance.history` → **`scenarioResult.state`** / **`scenarioResult.history`**;
   - наша «script-секция» → **`scenarios.script`** (имя совпало).
3. **Язык условий — JSONLogic.** Подтверждено. Готовые libs для Web/iOS/Android.
4. **Формат самой DSL-схемы — свой, описанный через JSON Schema.** Готовых форматов, подходящих под наши требования (мульти-платформа + workflow + UI), нет. Form.io / Airbnb / Lyft даём идеи, но не сам формат. JSON Schema используется как способ **записи** нашей схемы, что даёт бесплатно: валидацию, кодген типов на TS/Swift/Kotlin/Go, документацию.
5. **Дочерние сценарии (sub-scenario) — делаем через гибрид «design-time ссылка + inline-резолв при создании Incident'а».** В DSL это шаг `type: "CallScenario"` с pin'ом на конкретную версию. Сервер при создании Incident'а разворачивает ссылки в плоский граф шагов, runner про вложенность не знает. Подробности — `dsl-v1-draft.md` §6.8, серверная сторона — `proposal-versioning.md` §6.2 (новый модуль `scenarioresolver`). Это **новая обязанность сервера** (см. §8 ниже).
6. **Запрет циклов** при сохранении сценария (DFS-обход графа `CallScenario`-зависимостей). Нарушение — 422.

### Старт `dsl-v1-draft.md`

Отложен. Жду команду от пользователя.

---

## 8. Sub-scenario inlining — новая обязанность сервера

Документировано здесь после анализа в `dsl-v1-draft.md` §6.8 и
`proposal-versioning.md` §6.2. Этот раздел — компактная справка для команды
сервера: что нужно сделать и почему.

### 8.1. Что такое sub-scenario

Шаг в DSL с типом `CallScenario` — это **design-time ссылка** на другой
сценарий. В `scenarios.script jsonb` он выглядит так:

```jsonc
{
  "id": "do_followup",
  "type": "CallScenario",
  "view": {
    "scenarioGuid": "11111111-...",
    "version": 5
  },
  "transitions": { "default": { "goto": "btn_close" } }
}
```

### 8.2. Что должен сделать сервер

**Раз** — при сохранении сценария:
- проверить, что граф зависимостей `CallScenario` **не содержит циклов**.
  DFS-обход. При обнаружении цикла — 422 Unprocessable Entity с указанием
  пути цикла. См. `proposal-versioning.md` §6.2 «ValidateNoCycles».

**Два** — при создании Incident'а:
- **развернуть** все `CallScenario`-шаги в плоский набор обычных шагов
  (с префиксацией id);
- результат записать в `incidents.scenario jsonb` уже **без** `CallScenario`-шагов.

После inline-резолва:
- runner Web/iOS/Android получает плоский граф, которым умеет работать
  без особых знаний;
- старые Incident'ы не ломаются при правке дочернего сценария (у них свой
  замороженный снапшот в `incidents.scenario`);
- новые Incident'ы автоматически подхватят последнюю версию **родительского**
  сценария (это уже было в proposal'е), а версия дочернего зафиксирована
  через `view.version`.

### 8.3. Алгоритм inline-резолва (в общих чертах)

См. полный алгоритм в `dsl-v1-draft.md` §6.8 и `proposal-versioning.md`
§6.2. Кратко:

1. Найти все шаги `type: "CallScenario"` в родительском `script`.
2. Для каждого:
   - подгрузить дочерний (`scenarios WHERE guid=view.scenarioGuid AND version=view.version`);
   - **рекурсивно** inline'ить его (вложенность дочерних в дочернем поддерживается);
   - префикс = `view.stepIdPrefix` или `step.id` (по умолчанию);
   - переименовать step.id всех шагов дочернего → `prefix__originalId`;
   - обновить все `goto` и `var:state.X.value` ссылки внутри дочернего
     с тем же префиксом;
   - сшить «вход» (initialStepId дочернего ← `goto: step.id` родителя)
     и «выход» (терминальные шаги дочернего → `transitions.default.goto`
     из родительского `CallScenario`-шага);
   - удалить сам `CallScenario`-шаг.
3. Сериализовать результат в JSONB и записать в `incidents.scenario`.

### 8.4. Что **не** делает сервер

- **Не** интерпретирует семантику `script` помимо `CallScenario` —
  все остальные типы шагов остаются непрозрачными (принцип П7).
- **Не** валидирует JSONLogic-выражения (это задача редактора и runner'а).
- **Не** запускает actions из `transitions` (они — задача runner'а).
- **Не** делает down-grade DSL версии (этот вопрос отложен — см.
  `dsl-v1-draft.md` §13.2 О3).

### 8.5. Где это в `incident-manager-server`

Предлагаемое место — новый пакет `internal/im/service/scenarioresolver`.
Используется из:
- `ScenarioService.Save` (валидация циклов перед записью);
- `IncidentService.CreateFromRule` (inline-резолв перед записью в
  `incidents.scenario`).

См. `proposal-versioning.md` §6 для полного описания изменений в коде.

