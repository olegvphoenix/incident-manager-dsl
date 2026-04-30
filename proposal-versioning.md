# Предложение: версионирование сценариев в `incident-manager-server`

> Адресат: команда `incident-manager-server` (Go).
> Автор: команда DSL (архитектор, OlegV).
> Статус: **proposal**, требует обсуждения и approve до реализации.
> Дата: 2026-04-29.
>
> Связанные документы:
> - [`server-analysis.md`](./server-analysis.md) — анализ текущей реализации
>   (см. §3 «Расхождение №1: Версионирование»);
> - [`market-research.md`](./market-research.md) — обзор подходов
>   (см. Q1 «Versioning»);
> - [`dsl-v1-draft.md`](./dsl-v1-draft.md) — формат `script`, на который ссылаемся;
> - [`dsl-v1-schema.json`](./dsl-v1-schema.json) — JSON Schema этого формата.

---

## TL;DR

Текущая реализация `scenarios` хранит только **последнюю** версию `script`.
Предлагается:

1. Сделать `scenarios` неизменяемой таблицей с `(guid, version)` композитным
   ключом — каждое сохранение даёт новую запись, а не UPDATE.
2. Снапшотить версию в `incidents.scenario_version` при создании инцидента,
   чтобы старые инциденты не «ломались» при правке сценария.
3. Завести материализованное представление `scenarios_latest` для тех мест,
   где UI показывает «текущую версию».

Это **5 SQL-инструкций** в новой миграции `005_add_scenarios_versioning.sql`,
**одно поле** в OpenAPI, **минимальные** правки в репозитории. Бизнес-логика
не меняется. Текущие инциденты остаются работоспособными после миграции.

---

## Содержание

1. [Проблема](#1-проблема)
2. [Сценарии использования, которые сейчас не работают](#2-сценарии-использования-которые-сейчас-не-работают)
3. [Предлагаемое решение](#3-предлагаемое-решение)
4. [Изменения в БД](#4-изменения-в-бд)
5. [Изменения в OpenAPI](#5-изменения-в-openapi)
6. [Изменения в коде сервера](#6-изменения-в-коде-сервера)
7. [Стратегия миграции существующих данных](#7-стратегия-миграции-существующих-данных)
8. [Альтернативы и почему они хуже](#8-альтернативы-и-почему-они-хуже)
9. [Риски и mitigations](#9-риски-и-mitigations)
10. [Что НЕ входит в это предложение](#10-что-не-входит-в-это-предложение)

---

## 1. Проблема

### Текущее состояние (`migrations/001_initial_scheme.sql`)

```94:102:incident-manager-server\internal\im\service\storing\migrations\001_initial_scheme.sql
CREATE TABLE scenarios
(
    guid UUID PRIMARY KEY NOT NULL, -- only uuid-v7
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    creator_user_id BIGINT NOT NULL,
    read_only BOOLEAN NOT NULL,
    script jsonb NOT NULL
);
```

В таблице:
- `guid` — единственный ключ, **версионности нет**.
- `script jsonb` — обновляется через UPDATE при каждом сохранении сценария
  в редакторе.
- Нет `created_at`, `updated_at`, `version`, `archived`.

### Частичная защита уже есть

В таблице `incidents` правильно сделан **снапшот** сценария:

```sql
-- из 001_initial_scheme.sql (см. server-analysis.md)
CREATE TABLE incidents (
    ...
    scenario jsonb NOT NULL,         -- снапшот script на момент создания
    scenario_result jsonb,           -- ответы оператора
    ...
);
```

Это спасает «уже идущие» инциденты от поломки при правке сценария — runner
читает `incidents.scenario`, а не `scenarios.script`. **Это правильно** и
сохраняется в нашем предложении.

### Но всё равно теряем

| Что теряем | Почему болит |
| --- | --- |
| **История правок** | «Кто и когда поменял сценарий пожарной тревоги? Что было до этого?» — не ответить |
| **Откат на предыдущую версию** | Конструктор сохранил баг → накатить старую версию **невозможно** без ручного восстановления из backup'а |
| **Ссылки на конкретную версию** | Триггер `incidentRule` ссылается на `scenario_guid`, а **какую** версию запускать — не зафиксировано. Сегодня — последнюю. Завтра — другую |
| **A/B-тесты сценариев** | Запустить «новую версию» только на 10% инцидентов — нельзя без новой записи `scenarios` |
| **Аудит для compliance** | «Покажите версию сценария, по которой обрабатывался инцидент 3 месяца назад» — есть `incidents.scenario` (снапшот), но нет `scenarios.version`, на который можно сослаться в отчёте |
| **Параллельная работа над сценарием** | Двое в редакторе одновременно → последний UPDATE затирает предыдущий без возможности восстановления |

---

## 2. Сценарии использования, которые сейчас не работают

### С1. Откат

> Аналитик: «Вчера выкатили правку сценария — за ночь упал процент успешно
> закрытых инцидентов. Откатите к предыдущей версии».

**Сейчас:** требует ручного восстановления из БД-backup'а, занимает часы,
теряются параллельные правки других сценариев.

**После предложения:** одна команда «activate version N-1», сразу.

### С2. История правок

> Менеджер: «За последний квартал сценарий "Кража" редактировался 14 раз.
> Покажите все версии и автора каждой».

**Сейчас:** невозможно. **После:** SQL-запрос:

```sql
SELECT version, name, creator_user_id, created_at
FROM scenarios
WHERE guid = $1
ORDER BY version DESC;
```

### С3. Аудит для compliance

> Юрист: «Инцидент INC-2025-12345 был обработан 6 месяцев назад. По какой
> версии инструкции? Покажите её точный текст».

**Сейчас:** в `incidents.scenario` есть снапшот, но нет ID версии. Сослаться
на «версию 7» в отчёте нельзя.

**После:** в `incidents` есть `scenario_version`, можно достать запись из
`scenarios WHERE (guid, version) = (..., 7)`.

### С4. A/B-тесты

> Продакт: «Хочу попробовать новую формулировку первого шага. Запустите
> новую версию сценария только на 20% инцидентов в течение недели».

**Сейчас:** невозможно — версия одна.

**После:** одно поле `incident_rule_scenarios.weight` или `traffic_pct`.
Это **за рамками** этого предложения, но становится возможным.

### С5. Параллельное редактирование

> Сейчас: два редактора открыли сценарий, оба сохранили — **second-write-wins**,
> данные первого утеряны без следа.
>
> **После:** обе версии сохраняются как разные. Optimistic locking через
> `If-Match: <version>` header в API.

---

## 3. Предлагаемое решение

### Модель «append-only versioned scenarios»

Этот подход применяется в Stripe (Versioned APIs), Camunda (`process-definition`
с автоинкремент-полем `version`), Backstage (`scaffolder.template.version`).
Подробнее — [`market-research.md`](./market-research.md) Q1.

**Ключевая идея:**
- `scenarios` становится **append-only**: `INSERT` всегда, `UPDATE` запрещён
  (или допускается только для метаданных типа `archived`).
- Композитный PK `(guid, version)`, где `guid` — стабильный ID логического
  сценария, `version` — целое число, инкрементирующееся с каждой правкой.
- Внешние ключи (`incident_rule_scenarios.scenario_guid`, …) **остаются**
  ссылаться только на `guid` (без версии), что позволяет «правилу» автоматически
  подхватывать «текущую активную» версию.
- Снапшот в `incidents` дополняется явной ссылкой на версию (`scenario_version`),
  чтобы аудит был тривиален.

### Что **не** меняется

- Все существующие FK на `scenarios(guid)` — работают как и работали (после
  правки таргета, см. §4).
- `script jsonb` — формат содержимого не меняется (это зона DSL).
- `incidents.scenario jsonb` — продолжает быть снапшотом (но плюс ссылка на
  версию).
- Триггеры (`incident_rules`), m2m (`incident_rule_scenarios`),
  state-machine инцидента — не трогаем.

---

## 4. Изменения в БД

### Новая миграция `005_add_scenarios_versioning.sql`

```sql
-- +migrate Up

------------------------------------------------------------
-- 4.1. Backup существующей таблицы (на всякий случай)
------------------------------------------------------------
CREATE TABLE scenarios_pre_v005_backup AS TABLE scenarios;

------------------------------------------------------------
-- 4.2. Удаляем старые FK, чтобы можно было пересоздать PK
------------------------------------------------------------
ALTER TABLE scenarios_customers      DROP CONSTRAINT scenarios_customers_scenario_guid_fkey;
ALTER TABLE incident_rule_scenarios  DROP CONSTRAINT incident_rule_scenarios_scenario_guid_fkey;
-- (имена FK уточнить в \d перед запуском; здесь даны по умолчанию PostgreSQL)

------------------------------------------------------------
-- 4.3. Расширяем scenarios
------------------------------------------------------------
ALTER TABLE scenarios
    ADD COLUMN version    INT                      NOT NULL DEFAULT 1,
    ADD COLUMN created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ADD COLUMN archived   BOOLEAN                  NOT NULL DEFAULT FALSE;

-- Меняем PK c guid на (guid, version):
ALTER TABLE scenarios DROP CONSTRAINT scenarios_pkey;
ALTER TABLE scenarios ADD CONSTRAINT scenarios_pkey PRIMARY KEY (guid, version);

------------------------------------------------------------
-- 4.4. Возвращаем FK с правильным таргетом
--     scenarios_customers и incident_rule_scenarios
--     ссылаются только на guid (без версии — они описывают
--     логический сценарий, а не его конкретную версию)
------------------------------------------------------------
-- Для этого нужен UNIQUE INDEX на guid:
-- увы, так не получится в чистом виде, потому что у одного guid
-- теперь несколько строк. Делаем по-другому: FK на DEFERRED
-- проверку через триггер либо через справочную таблицу.
--
-- Простейший рабочий вариант — отдельная таблица "logical scenarios":
CREATE TABLE scenario_definitions (
    guid              UUID PRIMARY KEY NOT NULL,
    creator_user_id   BIGINT           NOT NULL,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Заполняем из существующих сценариев (по одной строке на каждый guid):
INSERT INTO scenario_definitions (guid, creator_user_id)
SELECT guid, creator_user_id FROM scenarios
ON CONFLICT (guid) DO NOTHING;

-- Возвращаем FK на справочную таблицу:
ALTER TABLE scenarios_customers
    ADD CONSTRAINT scenarios_customers_scenario_guid_fkey
    FOREIGN KEY (scenario_guid) REFERENCES scenario_definitions(guid);

ALTER TABLE incident_rule_scenarios
    ADD CONSTRAINT incident_rule_scenarios_scenario_guid_fkey
    FOREIGN KEY (scenario_guid) REFERENCES scenario_definitions(guid) ON DELETE CASCADE;

-- И FK от scenarios на scenario_definitions:
ALTER TABLE scenarios
    ADD CONSTRAINT scenarios_guid_fkey
    FOREIGN KEY (guid) REFERENCES scenario_definitions(guid) ON DELETE CASCADE;

------------------------------------------------------------
-- 4.5. Добавляем версию-снапшот в incidents
------------------------------------------------------------
ALTER TABLE incidents
    ADD COLUMN scenario_version INT;

-- Бэкфилл: всем существующим инцидентам ставим version = 1
-- (потому что до миграции была только одна версия)
UPDATE incidents SET scenario_version = 1 WHERE scenario_version IS NULL;

ALTER TABLE incidents
    ALTER COLUMN scenario_version SET NOT NULL;

-- Опционально: FK на (scenarios.guid, scenarios.version) через scenario_guid +
-- scenario_version. Можем добавить, если в incidents есть колонка scenario_guid.
-- (см. server-analysis.md — нужно проверить точную структуру incidents)

------------------------------------------------------------
-- 4.6. View "последняя версия" — для UI
------------------------------------------------------------
CREATE VIEW scenarios_latest AS
SELECT DISTINCT ON (guid)
    guid, version, name, description, read_only, script,
    created_at, archived
FROM scenarios
WHERE NOT archived
ORDER BY guid, version DESC;

------------------------------------------------------------
-- 4.7. Индексы
------------------------------------------------------------
CREATE INDEX idx_scenarios_guid_version_desc
    ON scenarios(guid, version DESC);

CREATE INDEX idx_incidents_scenario_version
    ON incidents(scenario_guid, scenario_version);
-- (имя колонки scenario_guid в incidents уточнить — см. оговорку выше)


-- +migrate Down

DROP INDEX IF EXISTS idx_incidents_scenario_version;
DROP INDEX IF EXISTS idx_scenarios_guid_version_desc;
DROP VIEW  IF EXISTS scenarios_latest;

ALTER TABLE incidents DROP COLUMN IF EXISTS scenario_version;

ALTER TABLE scenarios DROP CONSTRAINT IF EXISTS scenarios_guid_fkey;
ALTER TABLE incident_rule_scenarios DROP CONSTRAINT IF EXISTS incident_rule_scenarios_scenario_guid_fkey;
ALTER TABLE scenarios_customers     DROP CONSTRAINT IF EXISTS scenarios_customers_scenario_guid_fkey;

DROP TABLE IF EXISTS scenario_definitions;

ALTER TABLE scenarios DROP CONSTRAINT scenarios_pkey;
ALTER TABLE scenarios ADD CONSTRAINT scenarios_pkey PRIMARY KEY (guid);

ALTER TABLE scenarios DROP COLUMN IF EXISTS archived;
ALTER TABLE scenarios DROP COLUMN IF EXISTS created_at;
ALTER TABLE scenarios DROP COLUMN IF EXISTS version;

-- Восстанавливаем FK старого вида:
ALTER TABLE scenarios_customers
    ADD CONSTRAINT scenarios_customers_scenario_guid_fkey
    FOREIGN KEY (scenario_guid) REFERENCES scenarios(guid);
ALTER TABLE incident_rule_scenarios
    ADD CONSTRAINT incident_rule_scenarios_scenario_guid_fkey
    FOREIGN KEY (scenario_guid) REFERENCES scenarios(guid) ON DELETE CASCADE;

DROP TABLE IF EXISTS scenarios_pre_v005_backup;
```

> ⚠ **Имена констрейнтов** (`scenarios_customers_scenario_guid_fkey` и подобные)
> по умолчанию автоматически генерируются PostgreSQL по схеме
> `<table>_<column>_fkey`, но **проверить через `\d scenarios_customers` в
> staging** перед накатом в prod. Если имена другие — поправить миграцию.
>
> ⚠ **Точная колонка `incidents.scenario_guid`** — нужно перепроверить,
> сейчас по `server-analysis.md` инцидент содержит `scenario jsonb` (снапшот),
> но возможно есть и отдельная колонка-ссылка. Это **должна** быть колонка
> для нормального FK, иначе `scenario_version` без `scenario_guid` теряет смысл.

### Итоговая схема таблиц после миграции

```
scenario_definitions    -- логические сценарии (было: scenarios.guid)
   guid PK, creator_user_id, created_at

scenarios               -- версии сценариев (append-only)
   PK(guid, version), FK guid -> scenario_definitions
   name, description, read_only, script jsonb,
   created_at, archived

scenarios_latest        -- VIEW поверх scenarios для UI

scenarios_customers     -- ссылка только на guid (любая версия видна tenant'у)
   FK scenario_guid -> scenario_definitions

incident_rule_scenarios -- триггер -> логический сценарий (без версии)
   FK scenario_guid -> scenario_definitions
   при создании инцидента сервер выбирает АКТУАЛЬНУЮ версию

incidents               -- + scenario_version (снапшот версии)
   scenario_guid, scenario_version, scenario jsonb (содержимое-снапшот)
```

---

## 5. Изменения в OpenAPI

### `components/schemas/scenario`

Добавить три поля:

```yaml
scenario:
  type: object
  properties:
    guid:
      type: string
      format: uuid
    version:                          # NEW
      type: integer
      minimum: 1
      readOnly: true
      description: |
        Auto-incremented per scenario. Server assigns on create/update.
        Client should pass it in If-Match header for optimistic locking.
    createdAt:                        # NEW
      type: string
      format: date-time
      readOnly: true
    archived:                         # NEW
      type: boolean
      default: false
    name:
      type: string
    description:
      type: string
    readOnly:
      type: boolean
    script:
      type: object
      description: |
        DSL-формат, см. dsl-v1-schema.json. Сервер проверяет лишь то, что
        это валидный JSON; семантику не интерпретирует.
```

### Endpoint'ы

| Метод | Путь | Что меняется |
| --- | --- | --- |
| `POST /scenarios` | создаёт **первую версию** (v1) логического сценария. Если в теле передан `guid` уже существующего сценария — 409 Conflict. |
| `PUT /scenarios/{guid}` | создаёт **новую версию** существующего сценария. Возвращает новую запись с `version: N+1`. Принимает заголовок `If-Match: <version>` для optimistic locking. |
| `GET /scenarios` | возвращает **последние** версии (через `scenarios_latest`). Поведение совместимо с текущим. |
| `GET /scenarios/{guid}` | возвращает **последнюю** версию. |
| `GET /scenarios/{guid}/versions` | **NEW**: список всех версий, отсортирован по `version DESC`. |
| `GET /scenarios/{guid}/versions/{version}` | **NEW**: конкретная версия. |
| `DELETE /scenarios/{guid}` | архивирует логический сценарий целиком (`scenario_definitions` + soft-delete всех версий через `archived = true`). |
| `POST /scenarios/{guid}/restore/{version}` | **NEW** (опционально, v2): создаёт новую версию из тела старой версии. Можно отложить. |

### Новые поля в `incident`

```yaml
incident:
  properties:
    ...
    scenario_guid:                    # уже есть, не меняется
      type: string
      format: uuid
    scenario_version:                 # NEW
      type: integer
      readOnly: true
      description: |
        Версия сценария, по которой создан этот инцидент. Снапшот, не меняется.
    scenario:                         # уже есть, не меняется
      type: object                    # снапшот script на момент создания
    ...
```

---

## 6. Изменения в коде сервера

Дам высокоуровневый набросок (без полной реализации, конкретный layout
зависит от существующих repository/service-слоёв в `internal/im/...`).

### 6.1. Repository

Добавить в репозиторий сценариев методы:

```go
// Создаёт первую версию нового сценария.
CreateNew(ctx, customerGUID, params CreateScenarioParams) (Scenario, error)

// Создаёт новую версию существующего сценария.
// Если ifMatchVersion != 0, проверяет, что текущая версия равна ему.
CreateNewVersion(ctx, scenarioGUID, ifMatchVersion int, params UpdateScenarioParams) (Scenario, error)

// Список последних версий (через VIEW).
ListLatest(ctx, customerGUID, filters Filter) ([]Scenario, error)

// Все версии конкретного сценария.
ListVersions(ctx, scenarioGUID) ([]Scenario, error)

// Конкретная версия.
GetVersion(ctx, scenarioGUID, version int) (Scenario, error)

// Архивирует логический сценарий целиком.
Archive(ctx, scenarioGUID) error
```

### 6.2. Service

При создании инцидента — берём свежайшую версию родительского сценария и
снапшотим её в инцидент:

```go
func (s *IncidentService) CreateFromRule(ctx, rule IncidentRule, source SourceEvent) (Incident, error) {
    scenario, err := s.scenarios.GetLatest(ctx, rule.ScenarioGUID)
    if err != nil { return Incident{}, err }

    incident := Incident{
        ...
        ScenarioGUID:    scenario.GUID,
        ScenarioVersion: scenario.Version,        // NEW (см. §4.5)
        Scenario:        scenario.Script,         // снапшот
    }

    return s.incidents.Create(ctx, incident)
}
```

При сохранении сценария — создаётся новая версия:

```go
func (s *ScenarioService) Save(ctx, params SaveParams) (Scenario, error) {
    return s.scenarios.CreateNewVersion(ctx, params.GUID, params.IfMatch, params)
}
```

### 6.3. Optimistic locking

В `PUT /scenarios/{guid}`:

```go
ifMatch, _ := strconv.Atoi(c.GetHeader("If-Match"))
scenario, err := svc.UpdateScenario(ctx, guid, ifMatch, body)
if errors.Is(err, ErrVersionConflict) {
    c.JSON(http.StatusPreconditionFailed, ...)
    return
}
```

Это спасает от потерянных правок при параллельной работе двух редакторов.

---

## 7. Стратегия миграции существующих данных

### Шаг 1. Pre-deploy

- Делаем backup БД целиком (стандарт перед миграциями).
- В staging накатываем `005_add_scenarios_versioning.sql`, проверяем:
  - все тесты проходят (особенно integration tests с real PostgreSQL,
    которые уже есть в `Makefile`);
  - smoke-test: создание сценария, обновление, создание инцидента.
- Проверяем имена FK в реальной БД (`\d scenarios_customers` и т.п.)
  — обновляем миграцию если автоимена отличаются.

### Шаг 2. Deploy

- Накатываем миграцию (sql-migrate up).
- Каждой существующей записи `scenarios` присваивается `version = 1`.
- `scenario_definitions` заполняется автоматически из существующих guid'ов.
- Существующим `incidents` ставится `scenario_version = 1`.
- Все существующие FK переезжают на `scenario_definitions(guid)`.

### Шаг 3. Деплой нового кода сервера

- Сервер начинает использовать `CreateNewVersion` вместо UPDATE.
- Со следующей правки сценария — пишется `version = 2`, и так далее.

### Совместимость с существующим UI

UI редактора сценариев продолжает работать **без изменений**, если
сервер сохранит обратную совместимость endpoint'ов:
- `PUT /scenarios/{guid}` без `If-Match` → создаёт новую версию без
  optimistic locking (поведение «как раньше», но теперь с историей).
- UI **может** добавить `If-Match` позже, отдельным релизом.

### Rollback план

- Если что-то пошло не так после деплоя — `sql-migrate down 005`.
- Все версии сценариев, созданные после деплоя, теряются (сохраняется
  только версия 1 — та, что была до миграции). **Это нужно довести до
  команды.** Поэтому rollback допустим только в течение коротких часов
  после деплоя.
- На случай долгосрочных проблем — `scenarios_pre_v005_backup` хранит
  состояние таблицы до миграции, можно восстановить вручную.

---

## 8. Альтернативы и почему они хуже

### А1. Отдельная таблица `scenario_history` (audit-log)

Идея: оставить `scenarios` как есть, но при каждом UPDATE копировать старое
содержимое в `scenario_history`.

**Хуже:**
- Дублирование данных.
- `scenarios_latest` и `scenarios_history` — две разных таблицы с одинаковой
  структурой, путаница.
- Foreign keys не могут ссылаться на `scenario_history`, поэтому
  `incidents.scenario_version` остаётся фиктивным числом.
- Откат на старую версию — это фактически копирование строки из
  `scenario_history` обратно в `scenarios`, костыль.

### А2. Хранить версию **внутри** `script jsonb`

Идея: добавить в DSL поле `scriptVersion: 5` и инкрементировать при правке.

**Хуже:**
- Версия становится частью контракта DSL → сильнее связь с DSL → сложнее
  эволюционировать схему DSL отдельно.
- Невозможно делать индекс/фильтрацию без раскручивания JSONB.
- Невозможно сделать `(guid, version)` композитным PK — версия скрыта внутри
  JSON.
- Concurrency control только через optimistic locking на JSON-поле — нестандартно
  и подвержено багам.

### А3. Только метаданные правок (без хранения старых версий)

Идея: добавить `updated_at`, `last_editor_user_id`, **не храня сам diff**.

**Хуже:**
- Решает только compliance-кейс «кто и когда».
- Откат, A/B, аудит «по какой версии работал инцидент N» — **не решает**.
- При следующем витке всё равно придётся внедрять полноценную версионность.

### А4. Event-sourcing на уровне scenario_changes

Идея: каждая правка — это event (`field_changed`, `option_added`...) в
отдельной event-таблице, текущее состояние — фолд событий.

**Хуже для нашего случая:**
- Резко усложняет реализацию редактора.
- Полезно когда нужны частые тонкие правки и аудит каждого изменения поля.
  У нас сценарии правятся редко и целиком.
- Можно ввести позже **поверх** предложенной схемы, если потребуется.

---

## 9. Риски и mitigations

| Риск | Mitigation |
| --- | --- |
| Имена FK в реальной БД отличаются от ожидаемых, миграция падает | Прогон в staging с проверкой `\d`, корректировка имен в миграции |
| `incidents.scenario_guid` колонки нет / называется иначе | Перепроверить `001_initial_scheme.sql` ПЕРЕД накатом, скорректировать §4.5 |
| Откат миграции теряет новые версии | Документировать в release notes, ограничить окно для rollback'а |
| Рост размера БД (одна правка = новая запись) | На реальных нагрузках (десятки сценариев, единицы правок в день) — пренебрежимо. При проблеме — добавить TTL `archived` версий старше N лет |
| Старый клиент UI не передаёт `If-Match` → потерянные правки при параллельной работе | OK на старте. Backwards-compatible. UI добавит `If-Match` позже отдельным PR |
| `VIEW scenarios_latest` тормозит на больших объёмах | `DISTINCT ON (guid) ... ORDER BY guid, version DESC` использует индекс `idx_scenarios_guid_version_desc`. Если всё равно медленно — материализованное представление с триггером REFRESH |

---

## 10. Что НЕ входит в это предложение

Эти вещи **не** в этом proposal'е, чтобы не раздувать scope. Каждое — отдельный
proposal, если будет нужно.

| Не входит | Когда обсуждать |
| --- | --- |
| Версионирование триггеров (`incident_rules`) | если возникнет потребность аналогичного аудита для триггеров |
| Версионирование state-machine инцидента (`statuses` + `incident_action_transitions`) | то же |
| A/B-тесты (`incident_rule_scenarios.weight`) | после реализации этого proposal'а, отдельный proposal |
| Migration plan активных инцидентов на новую версию сценария | сценарий «версия 5 содержит баг, инциденты на ней нужно переключить на версию 4» — редкий кейс, требует business rules |
| Diff-визуализация в UI | задача фронта |
| Inline-редактор «branch / merge» сценариев | задача фронта, далёкая v3 |

---

## Приложение А. Чек-лист для ревью

- [ ] §1 Проблема понятна и согласована
- [ ] §2 Сценарии С1–С5 — реальные приоритеты, не «придуманные»
- [ ] §3 Решение «append-only versioned» — выбран из альтернатив §8
- [ ] §4 Миграция технически корректна (отдельный прогон в staging)
  - [ ] Имена FK совпадают с автогенерированными
  - [ ] `incidents.scenario_guid` существует и FK можно навесить
  - [ ] Тесты `test/integration/...` проходят после миграции
- [ ] §5 OpenAPI-изменения совместимы с существующим UI редактора
- [ ] §6 Объём правок в коде разумен (estimate в днях)
- [ ] §7 Rollback план приемлем
- [ ] §10 Scope правильно огранен, ничего критичного не пропущено

---

## Приложение Б. Связь с DSL v1

Чтобы не было путаницы:

- **`scenarios.version`** (это предложение) — версия конкретного сценария
  «Кража», «Пожар» и т.п. Меняется при каждой правке. Растёт `1, 2, 3...`.
- **`script.dslVersion`** (DSL v1) — версия **формата**, в котором написан
  любой `script`. v1 = `"1.0"`. Меняется раз в годы при breaking changes
  самого DSL.

Эти две версии **независимы**: сценарий «Пожар» может иметь `version: 47`
и при этом `dslVersion: "1.0"`. После выпуска DSL v2 — может появиться
`version: 48` со `dslVersion: "2.0"` (миграция содержимого, при сохранении
непрерывности версии сценария).
