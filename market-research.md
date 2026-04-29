# Обзор рынка: что взять в DSL для Менеджера инцидентов

> Документ — рабочий обзор, не спецификация. Цель — для каждого открытого
> архитектурного вопроса нашего DSL получить готовое решение, подсмотренное у
> зрелого продукта, и зафиксировать «берём / не берём».
>
> Дата: 2026-04-28. Метод: B (средняя глубина) — публичная документация и
> инженерные блоги, без чтения исходников.

## Содержание

1. [О чём этот документ](#1-о-чём-этот-документ)
2. [7 открытых вопросов DSL](#2-7-открытых-вопросов-dsl)
3. [Изученные продукты — карта](#3-изученные-продукты--карта)
4. [Q1. Версионирование сценария при живых инстансах](#q1-версионирование-сценария-при-живых-инстансах)
5. [Q2. Язык условий: свой или готовый](#q2-язык-условий-свой-или-готовый)
6. [Q3. Один DSL — три рендера (Web/iOS/Android)](#q3-один-dsl--три-рендера-webiosandroid)
7. [Q4. Структура инстанса: state vs history](#q4-структура-инстанса-state-vs-history)
8. [Q5. Эволюция схемы и совместимость](#q5-эволюция-схемы-и-совместимость)
9. [Q6. Action-модель на переходе](#q6-action-модель-на-переходе)
10. [Q7. Граница «схема ↔ платформенная обёртка»](#q7-граница-схема--платформенная-обёртка)
11. [Сводная таблица решений](#11-сводная-таблица-решений)
12. [Что менять в `IM/` относительно прошлых выводов](#12-что-менять-в-im-относительно-прошлых-выводов)
13. [Что вернуть к рассмотрению потом](#13-что-вернуть-к-рассмотрению-потом)
14. [Источники](#14-источники)

---

## 1. О чём этот документ

В прошлых раундах мы:
- разобрали проект `IM/` — это нижняя граница (что DSL обязан покрыть);
- решили, что `json-model-web-ui 3.md` — черновик, не контракт;
- закрепили принцип «DSL платформо-независим: Web-конфигуратор, runner'ы Web/iOS/Android».

Из этого выкристаллизовались **7 архитектурных вопросов**, по которым у нас не
было однозначного ответа без рыночной валидации. Этот документ закрывает их.

Каждый Q-вопрос разобран по схеме:
- **что сделали продукты на рынке** (с цитатами и ссылками);
- **вердикт для DSL v1** (что берём, что отбрасываем);
- **что это меняет относительно нашего прошлого плана**.

---

## 2. 7 открытых вопросов DSL

| # | Вопрос | Почему важно |
| --- | --- | --- |
| Q1 | Как версионировать сценарий, когда живые инстансы запущены на старой версии? | без ответа — каждое изменение ломает работу; самая дорогая ошибка |
| Q2 | Язык условий: свой DSL (`equals`/`in`/...) или готовый (CEL/JSONLogic/JEXL)? | свой = парсер на 3 платформах; готовый = выбрать тот, у которого есть libs для iOS/Android |
| Q3 | Можно ли одним JSON-документом рендерить Web/iOS/Android? Что для этого нужно? | основное требование задачи |
| Q4 | Что хранить в инстансе: только текущее состояние, только журнал, или оба? | определяет API и БД |
| Q5 | Как менять схему, не ломая существующие инстансы? | долгоживущие сценарии гарантированно переживут несколько правок |
| Q6 | Какая модель «эффектов перехода» (`callMacro`, `finish`, ...) выдержит расширение? | сейчас в `IM/` это три флага и счётчик — не масштабируется |
| Q7 | Что обязано быть в DSL, а что — только в платформенной обёртке? | без чёткой границы DSL раздуется и потеряет переносимость |

---

## 3. Изученные продукты — карта

| Продукт | Категория | Какие Q закрывает |
| --- | --- | --- |
| **Form.io** | schema-driven forms (web) | Q1, Q4, Q5 |
| **Camunda 8 / Zeebe** | workflow engine, BPMN 2.0 | Q1, Q5, Q6 |
| **Airbnb Ghost Platform (GP)** | server-driven UI, multi-platform | Q3, Q6, Q7 |
| **Lyft Canvas / lbsbff** | server-driven UI, multi-platform | Q6, Q7 |
| **Backstage Scaffolder** | JSON-Schema + UI hints | Q3, Q7 |
| **Stripe Mobile Payment Element** | shared config, native rendering | Q3, Q7 |
| **JSONLogic / Google CEL** | embedded expression language | Q2 |

Стартовая выборка была из 8 продуктов. **Notion / Coda formulas** убраны (они
про UI редактора, не про схему). **Temporal** оставлен как
контр-пример для Q1 и Q5.

---

## Q1. Версионирование сценария при живых инстансах

### Что сделали продукты

**Form.io — Form Revisions.**
> «Each time you publish changes to a form, the platform stores the complete
> form JSON schema as a numbered revision. Submissions are tagged with the
> revision number against which they were captured».
>
> ([Form Revisions feature][form-rev-feat])

Конкретно: каждый submission хранит поле `_fvid` — указатель на ту версию
схемы, под которой он был создан. При просмотре можно выбрать рендер либо
«как тогда выглядело» (`use original version`), либо «по текущей схеме»
(`use current version`). Базовый `form` хранит non-versioned метаданные
(title, path, permissions) + указатель на «current revision». Полные копии
`components` лежат в **отдельной коллекции**.

> «The base form object contains non-versioned metadata: title, path,
> permissions, and a reference to the “current” revision. A separate
> collection stores complete copies of the form's `components` array for each
> revision».
>
> ([Form Revisions: How Form.io Preserves...][form-rev-deep])

**Camunda 8 (Zeebe).**
> «By default, deploying a process or decision definition means that the
> workflow engine will check if the version has changed. If it has, it will
> register that deployment as a new version of the definition. By default,
> running instances will continue to run on the basis of the version they
> started with, new instances will be created based on the latest version
> of that definition».
>
> ([Versioning process definitions][camunda-versioning])

То есть Camunda по дефолту **не трогает** живые инстансы при публикации новой
версии — они доезжают на своей. **Миграция на новую версию — отдельная
явная операция**, через UI Operate или через API. Подробности — в Q5.

**Temporal — анти-пример.**
Temporal ушёл в другой край: версионирование живёт **в самом коде workflow**
через `workflow.GetVersion()`, и разработчик пишет ветвление прямо в логике
(«если версия ≥ 2 — делать так, иначе так»). Это работает для код-first
движков, но **категорически не подходит** для декларативного DSL: у нас нет
кода, в котором можно ветвить.

### Вердикт для DSL v1

**Берём модель Form.io + Camunda one-to-one:**

1. `Scenario` имеет поля `id` (стабильный) + `version` (числовой, монотонно
   растущий). Каждая публикация — новая версия. Старые версии **не удаляются**
   из БД.
2. `ScenarioInstance` хранит ссылку на конкретную пару:
   ```
   scenarioInstance.scenarioId      = "incident-fire"
   scenarioInstance.scenarioVersion = 7
   ```
3. **Запущенные инстансы доезжают на своей версии** — это default. Новые
   инстансы создаются на «текущей» версии (специально помеченной флагом
   `isCurrent: true` или просто «максимальная по `version`»).
4. **Миграция между версиями** — отдельная фича, в v1 НЕ делаем. Если
   когда-то понадобится — модель Camunda (mapping `stepId` → `stepId`) уже
   нам подходит, потому что у нас тоже идентификаторы шагов стабильные.

### Что меняет относительно прошлого

В прошлых раундах я говорил «`Scenario` → `ScenarioInstance`», но **не
фиксировал** обязательность хранить `scenarioVersion` в инстансе. Теперь это
обязательное поле. Без него после первой же правки сценария мы теряем
способность просмотреть исторический инстанс «как тогда выглядело».

---

## Q2. Язык условий: свой или готовый

### Что сделали продукты

Вариантов на рынке три, и они хорошо изучены:

**JSONLogic** — JSON-кодированные правила.
> «JSONLogic encodes rules as portable JSON data, evaluable consistently
> across languages... Unlike embedded code, JSON Logic rules are pure data;
> they can be safely stored, versioned, and evaluated».
>
> ([JSON Logic Specification][jsonlogic-spec])

Готовые runtime'ы для **всех трёх наших платформ**:
- JS/TS — оригинальный `json-logic-js`;
- iOS / Swift — `advantagefse/json-logic-swift` (SPM), iOS ≥ 9.0;
- Android / Kotlin — `advantagefse/json-logic-kotlin` или Kotlin Multiplatform `allegro/json-logic-kmp` (поддерживает iOS+JVM из одного кодагена);
- Java backend — `jamsesso/json-logic-java`, `meiskalt7/json-logic-java`.

**Google CEL (Common Expression Language)** — C-подобный синтаксис, не
тьюринг-полный, протобуф-AST.
> «CEL evaluates in linear time, is mutation free, and not Turing-complete...
> allows the implementation to evaluate orders of magnitude faster than
> equivalently sandboxed JavaScript».
>
> ([CEL spec][cel-spec])

CEL технически очень хорош (быстрый, безопасный, типизированный), но —
ключевое — у Google есть официальные реализации для **Go, C++, Java, Python**
и нет для Swift/Kotlin. На iOS существует только `superwall/Superscript-iOS`
(обёртка над Rust-evaluator-ом, third-party, 3 звезды), на Kotlin —
экспериментальный `OpenSavvy/cel-kotlin` ([см. источник][cel-kotlin]).
Полагаться на это в production'е risky.

**JEXL** — Java-only, синтаксис JS-подобный, есть проблемы с безопасностью.
> «If an application allows expressions to access classes and methods
> available in the JVM, and if a malicious user can feed an arbitrary
> expression, it often leads to arbitrary code execution».
>
> ([Expression Language Injections in Java][jexl-security])

Для multi-platform не подходит совсем.

### Вердикт для DSL v1

**Берём JSONLogic.** Решающие факторы:
1. **Есть готовые libs на всех трёх платформах**, которые мы реально таргетируем.
2. **Это JSON**, что естественно для нашей JSON-схемы — никакой парсинг
   текстовой строки внутри другого JSON не нужен.
3. **Не тьюринг-полный**, безопасно для пользовательского ввода.
4. Спецификация маленькая, тестов много — если runtime для Swift/Kotlin
   когда-то перестанет поддерживаться, перенаписать его — задача недели,
   не проекта.

CEL отбрасываем из-за **отсутствия официальных libs для Swift/Kotlin**. Если
бы мы делали backend-only — взяли бы CEL, потому что он строго лучше как
язык. Но для нас критерий №1 — multi-platform.

JEXL отбрасываем как Java-only.

**Свой DSL (`equals`/`in`/`all_of`...) тоже отбрасываем.** В прошлых раундах
я предлагал именно его, опираясь на `json-model-web-ui 3.md`. Это была
ошибка: каждое расширение нашего DSL = ручная реализация на 3 платформах.
JSONLogic уже даёт нам ровно эти операторы (`==`, `in`, `and`, `or`, `none`,
`all`, `some`) бесплатно и одинаково на всех платформах.

### Пример: транслитерация наших условий в JSONLogic

Что было в `json-model-web-ui 3.md`:
```json
{ "all_of": [{"step": "s1", "in": ["yes"]}, {"step": "s2", "equals": "ok"}] }
```

То же на JSONLogic:
```json
{ "and": [
    { "in": [{ "var": "state.s1.value" }, ["yes"]] },
    { "==": [{ "var": "state.s2.value" }, "ok"] }
] }
```

Чуть многословнее, но **0 строк парсера** на каждой платформе.

### Что меняет относительно прошлого

Полностью меняется блок «DSL условий» в нашем плане. Раньше я обещал секцию
«операторы и комбинаторы». Теперь её **не будет**: ссылка на JSONLogic
spec + список операторов, которые мы реально используем (whitelist). Это
сэкономит ~50 строк документа и убирает целое архитектурное обязательство.

---

## Q3. Один DSL — три рендера (Web/iOS/Android)

### Что сделали продукты

**Airbnb Ghost Platform — единая GraphQL-схема.**
> «The key decision that helped us make our server-driven UI system scalable
> was to use a single, shared GraphQL schema for Web, iOS, and Android —
> i.e., we’re using the same schema for handling responses and generating
> strongly typed data models across all of our platforms».
>
> ([A Deep Dive into Airbnb's Server-Driven UI System][airbnb-deep])

Главное наблюдение: они **не описывают вёрстку в схеме**. В схеме —
семантические сущности (`Section`, `Screen`, `Action`), а **как** конкретно
section рендерится в данной платформе — задача **client component registry**:
TypeScript на web, Swift на iOS, Kotlin на Android. Каждая платформа
поддерживает свой реестр компонентов с одинаковыми семантическими именами.

> «What sets GP apart is its utilization of frameworks in native languages
> for each platform. This means Typescript for web, Swift for iOS, and
> Kotlin for Android, providing developers with the tools they are most
> comfortable with».
>
> ([Okoone: Airbnb's Ghost Platform][okoone])

**Lyft Canvas — два уровня компонентов.**
Lyft пошёл дальше и явно разделил:
- **Declarative Components** — простые («как HTML»): сервер диктует layout,
  клиент тупо рендерит.
- **Semantic Components** — сложные: сервер шлёт только данные, клиент
  знает свой layout и сам решает, как они отрисуются.

> «Declarative Components are remarkably useful for simpler experiences but
> don't support highly responsive (i.e. fully client-side) interactions. To
> get around these limitations, we support Semantic Components that the
> client parses and knows how to render. These components map to
> predetermined layouts/views on the client, the server just sends down the
> data necessary to hydrate them».
>
> ([Journey to Server Driven UI at Lyft][lyft-journey])

**Stripe Embedded Payment Element.**
> «The Payment Element supports visual customization, which allows you to
> match the design of your app. The layout stays consistent but you can
> modify colors, fonts, and more by using the appearance property on your
> EmbeddedPaymentElement.Configuration object».
>
> ([Stripe: Embedded mobile][stripe-mobile])

Ключевая фраза — **`The layout stays consistent`**. Stripe **гарантирует
одинаковую семантику** ввода карты на iOS и Android, но **дизайн
кастомизируется только через семантические токены** (цвета, шрифт, скругления,
тип шрифта). Никаких px-сеток в конфиге.

**Backstage Scaffolder.**
Backstage использует стандартную **JSON Schema** + параллельно лежащий
`uiSchema` с UI-подсказками (`ui:field`, `ui:options`, `ui:widget`).
Это разделение двух документов:
> JSON Schema описывает **что** (тип, валидация); uiSchema — **как**
> (виджет, плейсхолдер, фокус, режим). ([Writing Custom Field Extensions][backstage-custom])

### Вердикт для DSL v1

**Архитектура «Airbnb GP + Lyft Semantic Components»:**

1. **Семантика в DSL — да.** Тип шага (`RadioButton`, `Comment`, `Image`,
   ...), его поля (`options[]`, `required`, `multiline`, `source`), переходы,
   actions.
2. **Вёрстки в DSL — нет.** Никаких `width`, `padding`, `margin`, `color`,
   `fontSize`, `className`, `style`. Платформенный runner сам решает, как
   именно отрисовать `RadioButton`-шаг на iOS (обычно `UITableView` с
   галочкой), на Android (`MaterialRadioGroup`), на Web (`<input
   type="radio">`).
3. **Реестр компонентов — на стороне runner'а** каждой платформы. Это **не
   часть DSL**. Это часть нашего будущего SDK для каждой платформы. В DSL —
   только семантические `type`-имена, на которые этот реестр реагирует.

**Что в `view` всё-таки можно?** Только **семантические подсказки**, которые
имеют смысл во всех трёх вселенных и платформа имеет право игнорировать,
если так нативно не принято:
- `view.emphasis: "primary" | "secondary" | "destructive"` — у Web/iOS/Android
  есть.
- `view.size: "compact" | "regular"` — есть у всех.
- `view.layout: "vertical" | "horizontal"` — для Radio/Checkbox; iOS может
  игнорировать (там нативный паттерн — list).

### Что меняет относительно прошлого

В прошлых раундах я уже сформулировал принцип «DSL платформо-независим, без
CSS/px», но **не имел подтверждения**, что серьёзные продукты так делают.
Теперь оно есть: Airbnb, Lyft и Stripe строят SDUI **именно так**. Это
снимает риск «вдруг у нас странный подход». Подход стандартный.

Ещё важнее: **Lyft-овая идея «Semantic vs Declarative components»**
подсказывает потенциальное расширение DSL **в будущем v2** — если у нас
появятся очень сложные шаги (графики, карты, мультимедиа-проигрыватели), мы
можем сделать их `Semantic` (сервер шлёт данные, клиент рисует), а простые
оставить как сейчас. На v1 — все 7 типов простые, обходимся без этого
разделения.

---

## Q4. Структура инстанса: state vs history

### Что сделали продукты

**Form.io разделяет три понятия:**

1. **Form Schema** — структура формы (versioned).
2. **Submission** — последняя версия данных одного заполнения.
3. **Submission Revisions** — журнал всех изменений данного submission'а.

> «Form Revisions track changes to the form schema itself... Submission
> Revisions track changes to individual submission data. When a user updates
> their answers, corrects a mistake, or an administrator modifies a value,
> Submission Revisions preserve the previous data state».
>
> ([Form Change Logs][form-change-logs])

То есть Form.io хранит:
- **submission.data** — текущее состояние, словарь `componentKey → value`;
- **submission.revisions[]** — журнал, где `_vid` — порядковый номер,
  `modifiedBy`, `created`, plus полная копия `data` на момент правки;
- **submission._fvid** — версия схемы, под которой был сделан submission.

Submission Revisions — **per-form опция**, потому что они могут раздуть БД.

**Camunda — разделение «state» и «event journal».**
Camunda хранит:
- **process instance state** — текущее положение токенов (где сейчас идёт
  процесс), значения переменных;
- **history** — события `ACTIVITY_INSTANCE_CREATE`,
  `VARIABLE_INSTANCE_UPDATE`, и т.д., каждое со своим timestamp.

History event-журнал доступен через отдельный History API. Это разделение
позволяет горячую часть (state) держать в OLTP-БД, а историю — выгружать в
OLAP / DWH.

**Lyft — отдельный сервис, отдельный store.**
> «We proposed a new BFF (backend for frontend) microservice named lbsbff
> exclusively for the Lyft bikes & scooters experience to abstract away
> hardware and provider implementation details from the client».
>
> ([Lyft Journey][lyft-journey])

State держится в lbsbff в его собственном представлении, отделённом от
бизнес-моделей upstream-сервисов.

### Вердикт для DSL v1

**Берём модель Form.io: state и history живут вместе в одном `Instance`-документе, но как разные поля.**

```jsonc
{
  "id": "instance-001",
  "scenarioId": "incident-fire",
  "scenarioVersion": 7,           // см. Q1
  "status": "in_progress",        // NEW | IN_PROGRESS | FINISHED | ESCALATED
  "operator": "u-12345",
  "createdAt": "2026-04-28T20:00:00Z",
  "updatedAt": "2026-04-28T20:14:30Z",

  "currentStepId": "s_describe",  // где сейчас стоит токен

  "state": {                      // последнее значение каждого шага
    "s_type": { "value": "fire" },
    "s_severity": { "value": "high" }
  },

  "history": [                    // append-only журнал
    { "ts": "...Z", "stepId": "s_type",
      "action": "answer", "value": "fire", "actor": "u-12345" },
    { "ts": "...Z", "stepId": "s_type",
      "action": "transition", "to": "s_severity",
      "matchedRule": 0 }
  ]
}
```

**Почему именно так:**
1. `state` — для O(1)-чтения «что сейчас выбрано»; используется UI-runner'ом
   при перерисовке, и — что важно — в JSONLogic-условиях
   (`{"var": "state.s_type.value"}`).
2. `history` — для аудита, отчётов, возможности «отмотать на N шагов назад».
   Покрывает текущее поведение `IM/`, где `EventData.Works[]` — именно
   journal действий.
3. **Один документ, два поля** (а не две таблицы): пока мы не упёрлись в
   объём, выгоднее держать инстанс целиком — простые транзакции, нет
   join'ов.

**Submission Revisions = весь history-блок** (а не отдельная коллекция). Если
объём истории станет проблемой, выделим в отдельную коллекцию совместимо.

### Что меняет относительно прошлого

В предыдущих раундах я фиксировал, что нужны **и** `state`, **и** `history`,
но не утвердил **формат каждого**. Form.io даёт нам готовый паттерн: `state`
— `Map<stepId, value>`; `history` — `[{ ts, stepId, action, ... }]`. Берём
точь-в-точь.

Также ясно, что **`history` должна различать типы событий**: ответ на шаге,
переход на следующий, эскалация, переназначение оператора. Не одно поле
`action: string` без enum'а — это enum:
```
"answer" | "transition" | "escalate" | "assign" | "finish"
```

---

## Q5. Эволюция схемы и совместимость

### Что сделали продукты

**Form.io: «schema update не трогает старые submission'ы».**
> «This separation means you can update a form schema without invalidating
> existing submissions. You can query submissions independently of their
> parent forms. You can store millions of submissions across thousands of
> form versions without schema migrations corrupting your data».
>
> ([Form JSON Schema vs Submission][form-vs-sub])

Если в новой версии добавили required-поле — старые submission'ы **не
получают его волшебным образом**. Они продолжают существовать с тем составом
данных, который был.

> «Assuming schema updates migrate existing data... When you add a new
> required field to a form, existing submissions do not suddenly gain that
> field. They contain exactly what users submitted at the time. Your
> application code must handle submissions that predate schema changes».
>
> ([там же][form-vs-sub])

**Camunda: миграция как явная операция, с маппингом.**
> «Process instance migration fits a running process instance to a different
> process definition... You must provide a migration plan with mapping
> instructions to the target process definition to clarify your intentions».
>
> ([Process instance migration][camunda-migration])

Ключевые ограничения Camunda:
- Маппинг **только по `elementId`** (наш аналог — `step.id`).
- **Тип элемента менять нельзя**: service task → service task, **не**
  service task → user task.
- **Активные элементы** мапятся явно. Неактивные — игнорируются.

**Airbnb GP: «server is responsible for compatibility».**
> «If the client doesn't know about a component sent from the server it
> simply won't render it. It's the server's responsibility to send something
> that can be rendered, that includes attributes of a known component».
>
> ([MobileNativeFoundation discussion][mnf-discussion])

Каждый клиент шлёт хедер с версиями (app, OS, framework), **сервер
адаптирует ответ** под конкретного клиента. Если фича доступна не на всех
клиентах, сервер шлёт fallback-component, понятный старым.

### Вердикт для DSL v1

**Объединяем Form.io + Camunda:**

1. **Default-стратегия: «старые инстансы доезжают на своей версии»** (как в
   Form.io и Camunda). Никаких автоматических миграций.

2. **Совместимость на уровне правки схемы:**
   - **Безопасно (не требует миграции):**
     - добавление нового шага, на который никто пока не goto'ится;
     - добавление optional-поля в `view` существующего шага;
     - добавление новой опции в `options[]` (но **не** удаление старых,
       потому что в `state` могут лежать ID старых).
   - **Опасно (только через явную миграцию):**
     - удаление шага, на который кто-то ссылается;
     - смена `type` шага (`RadioButton` → `Select`);
     - удаление `options[].id`, на который ссылается `state` старого
       инстанса;
     - удаление action из `transitions.rules[].actions[]`.

3. **Версия монотонна.** Любая правка опубликованной схемы = новая версия,
   старая остаётся в БД. Если правка совместима — фронт-конструктор
   разрешает «продвинуть live к новой версии» без дополнительных шагов;
   если несовместима — конструктор **показывает diff и предупреждение**.

4. **Миграция инстансов между версиями — не делаем в v1.** Когда
   понадобится, реализуем по модели Camunda: маппинг `stepId → stepId`,
   запрет смены `type`, валидация перед коммитом.

5. **Action-уровень.** Если runner на iOS не знает action `escalate` (старая
   версия app), он его **игнорирует** (по модели Airbnb GP) и логирует
   предупреждение. Critical actions помечаются `required: true` и тогда
   runner отказывается выполнять сценарий, требуя обновить app.

### Что меняет относительно прошлого

В прошлых раундах я говорил о версионировании, но **не говорил о правилах
совместимости**. Теперь у нас есть конкретный список безопасных и опасных
изменений. Это надо вынести в `dsl-v1-draft.md` как отдельный раздел
«Schema Evolution Rules».

Также появилось требование к **редактору**: при сохранении новой версии он
должен показать diff с предыдущей и подсветить опасные изменения. Это уже
не часть DSL, но требование к будущему конструктору.

---

## Q6. Action-модель на переходе

### Что сделали продукты

**Camunda: Service Task с `type` + headers.**
> «`camunda:topic` becomes `zeebe:taskDefinition type`. ... All inputs and
> outputs are treated like all other inputs and outputs».
>
> ([Camunda 8 Technical details][camunda-tech])

В Zeebe service task = `{ type: "send-email", retries: 3, headers: {...} }`.
Тип строкой, аргументы — отдельно. Кто-то (job worker) подписан на этот
type и выполняет.

**Airbnb GP: интерфейс `IAction`.**
> «We do this through an `IAction` interface in our schema. ... There is a
> standard set of generic actions that GP handles universally, such as
> navigating to a screen or scrolling to a section. Features can add their
> own `IAction` types and use those to handle their feature's unique
> actions».
>
> ([Airbnb deep dive][airbnb-deep])

Шаги (sections) могут иметь поля типа `onSubtitleClickAction: IAction`,
которые сервер заполняет конкретным action'ом. Платформа маршрутизирует к
обработчику.

**Lyft Canvas: Actions decoupled from Components.**
> «An Action represents a single piece of logic that can be associated with
> preconfigured trigger points, like a button tap, a view load, a checkbox
> toggle, etc. Actions can be deep links; but, generally, they are
> pre-registered commands on the client that perform associated client code
> (specific network requests, launching a flow like unlocking a bike or
> opening the help center, changing client state, etc)».
>
> ([Lyft Journey][lyft-journey])

И — критически важно для нас — **Actions chained**:
> «Actions can also be chained. For example, you can trigger an Action that
> shows an alert, which then triggers further actions when buttons inside of
> that alert are tapped».
>
> ([там же][lyft-journey])

То есть один переход может стрельнуть несколькими actions подряд.

### Вердикт для DSL v1

**Берём общую форму «дискриминированный union по `type`»:**

```jsonc
{
  "type": "callMacro",
  "args": { "macroId": "MACRO-fire-protocol" }
}
```

Базовый набор v1 (5 actions, покрывает `IM/`):
- `callMacro` — `args: { macroId: string, params?: object }`
- `finish` — `args: {}` (опционально `args: { resolution: "PROCESSED" | ... }`)
- `generateReport` — `args: { reportTemplateId?: string }`
- `escalate` — `args: { to?: string }` (operator id или group id)
- `assign` — `args: { to: string }`

**Actions — массив.** На одном переходе может быть несколько (Lyft chain).
Выполнение — последовательное в порядке записи.

**Расширение типов action — без правки схемы DSL.** В DSL описан только
`{ type, args }` контракт, конкретные `type`-имена живут в **Action
Registry** на каждой платформе. Чтобы добавить новый action на iOS, не
нужно менять JSON Schema — нужно зарегистрировать handler в Swift SDK.
Это **в точности подход Airbnb / Lyft**, и это правильный путь.

**Версионирование action.** Если новый runner не знает `type` — игнорирует
с warning'ом (Airbnb), кроме случая `required: true`. Это согласуется с
Q5.

### Что меняет относительно прошлого

В прошлых раундах я уже предлагал «dispatch по `type`», но **не фиксировал**
явно, что:
1. Actions **массив** (а не один на переход).
2. Action Registry — **не часть DSL**, а часть SDK каждой платформы.
3. Игнорирование неизвестного action — стандартный default.

Все три добавились благодаря Airbnb + Lyft.

Также важно: я раньше склонялся к `transition.actions[]`, **и не было**
параллельной мысли про `step.onEnter` / `step.onExit`. Сейчас, изучив
рынок, видно, что Airbnb даёт actions **на любые UI-trigger'ы** (тап,
load, toggle), а Camunda даёт `executionListeners` (start/end). Для v1
нам **достаточно `transition.actions[]`** — именно это закрывает все три
случая в `IM/` (`is_finish`, `is_report`, `macro.{i}`). Lifecycle-actions
(`onEnter`/`onExit`) — задел на v2.

---

## Q7. Граница «схема ↔ платформенная обёртка»

### Что сделали продукты

Этот вопрос распадается на «**что в DSL?**» и «**что в SDK?**».

**Stripe — самая чистая граница.**
> «The Configuration object contains general-purpose configuration options
> for EmbeddedPaymentElement that don't change between payments, like
> `returnURL`. The IntentConfiguration object contains details about the
> specific payment like the amount and currency, as well as a
> `confirmationTokenConfirmHandler` callback».
>
> ([Stripe Embedded][stripe-embedded])

**В configuration** — данные (что показать, какие методы, валюта).
**В callback** — поведение (что делать, когда платёж подтверждается). И —
самое важное:
> «The layout stays consistent but you can modify colors, fonts, and more by
> using the appearance property».
>
> ([Stripe Embedded Mobile][stripe-mobile])

Кастомизация — через **appearance API** (цвета, шрифты, скругления). Никаких
«положи кнопку на 200 пикселей правее».

**Backstage — uiSchema отдельно от schema.**
JSON Schema говорит «поле `name` строка, обязательное». uiSchema говорит
«рисуй его как `ValidateKebabCase` widget с ui:options `{ focused: true }`».
Это два **разных документа**, связанных по ключам. Расширения — через
`createFormField` + регистрация компонента в реестре.

**Airbnb GP — registry на клиенте.**
> «Clients use a component registry to render UI natively».
>
> ([LinkedIn post on Ghost Platform][gp-linkedin])

В DSL — `componentType: "TitleSection"`. На клиенте — таблица
`"TitleSection"` → конкретный Swift/Kotlin/TS-компонент. Расширение
компонента не меняет DSL.

### Вердикт для DSL v1

**Граница такая:**

| Где живёт | Что | Кто меняет |
| --- | --- | --- |
| **DSL (schema, JSON в БД)** | сценарий, шаги, типы шагов, options, transitions, actions, view (только семантика) | архитектор/конфигуратор |
| **Platform Component Registry** (Web/iOS/Android SDK) | конкретные UI-компоненты для каждого `step.type`; визуальный стиль (цвета, шрифты) | mobile/web разработчик |
| **Platform Action Registry** (Web/iOS/Android SDK) | handler'ы для каждого `action.type` | mobile/web разработчик |
| **Platform Theme** (опционально) | appearance-токены по аналогии со Stripe | дизайн-система |

**В DSL запрещено:**
- любые px/CSS;
- ссылки на конкретные платформенные виджеты (`UIPickerView`,
  `MaterialRadioGroup`, `<select>`);
- callback'и-функции (DSL — данные, не код);
- HTML-фрагменты (мы видели в `IM/` `comment` хелперах раздельные
  `min_height` для high size и для длины строки — путаница; разнесём чётко).

**В DSL разрешено (и нужно):**
- семантический `type`;
- семантические подсказки (`emphasis`, `size`, `layout`);
- бизнес-данные (`options[]`, `required`, `editable`);
- ссылки на бизнес-объекты (`macroId`, `reportTemplateId`);
- условия (JSONLogic).

**В SDK обязано быть:**
- Component Registry: для каждого `type` — нативный компонент;
- Action Registry: для каждого `action.type` — handler;
- Default-handler для неизвестного `type` (skip + warning, как Airbnb);
- (опционально) Theme-конфиг.

### Что меняет относительно прошлого

В прошлых раундах я расплывчато говорил «не CSS, не px». Теперь у меня есть
**4-колоночная таблица обязанностей**, которую можно вставить прямо в
`dsl-v1-draft.md` как раздел «Architecture Boundaries».

Это также явно отвечает на вопрос «**где будет жить тема (цвета, шрифты)?**»
— отдельным platform theme-объектом, **вне DSL сценария**, по образцу Stripe.
Это снимает с архитектора DSL обязанность думать о цветах.

---

## 11. Сводная таблица решений

| # | Вопрос | Решение для DSL v1 | Источник |
| --- | --- | --- | --- |
| Q1 | Версионирование сценария | `Scenario { id, version }`, `Instance { scenarioVersion }`. Старые инстансы доезжают на своей. | Form.io + Camunda |
| Q2 | Язык условий | **JSONLogic.** Готовые libs для Web/iOS/Android. | JSONLogic, отказ от CEL/JEXL |
| Q3 | Один DSL — три рендера | В DSL — только семантика. Вёрстка — в platform Component Registry. | Airbnb GP, Lyft, Stripe |
| Q4 | Структура инстанса | Один документ, два поля: `state` (Map) + `history` ([]). | Form.io |
| Q5 | Эволюция схемы | «Старые версии не трогаем». Список безопасных/опасных правок. Миграции — в v2. | Form.io + Camunda |
| Q6 | Action-модель | `actions[] = { type, args }`, dispatch по type, registry на клиенте. | Airbnb GP, Lyft |
| Q7 | Граница schema/SDK | 4 уровня: DSL / Component Registry / Action Registry / Theme. | Stripe + Backstage |

---

## 12. Что менять в `IM/` относительно прошлых выводов

Вернусь к финальному списку из 17 пунктов, который я зафиксировал после
анализа `IM/`. Рынок несколько вещей **подтвердил**, несколько —
**пересмотрел**, несколько — **добавил**.

### Подтверждено

| Пункт | Чем подтверждено |
| --- | --- |
| DSL платформо-независим | Airbnb, Lyft, Stripe — все работают именно так |
| `step` — единица сценария | соответствует `User Task` BPMN, `Section` Airbnb |
| 7 раздельных `type` | Airbnb GP `SectionComponentType` enum работает аналогично |
| `options[]` с `{ id, label }` | стандарт JSON Schema, у Form.io так же |
| `transitions = { default, rules[] }` first-match | подходит к JSONLogic естественно |
| `actions[]` на переходе | Lyft chained actions, Airbnb IAction |
| Финал = `Action.finish` | Lyft / Camunda end-event-эквивалент |
| Триггеры inline в `scenario.triggers[]` | пока что — да; продуктового аргумента «много-ко-многим» рынок не дал |

### Пересмотрено

| Пункт | Что было | Что становится |
| --- | --- | --- |
| **Свой DSL условий** | `equals` / `in` / `all_of` / ... | **JSONLogic** (готовый, multi-platform) |
| **Editable/locker/multitasking** | как поля DSL | **разделить:** `step.editable` — да, в DSL; `concurrency` — отдельный объект `scenario.concurrency`, runner может игнорировать (как `appearance` Stripe) |
| **Локализация v1** | inline-строка | inline-строка **+ обязательно** `scenario.locale: "ru"` для будущей миграции на ключи. Без `locale` runner не сможет нормально fallback'ить |
| **`view.label` vs `labelKey`** | оба нельзя одновременно | **только `label` в v1**, поле `labelKey` зарезервировано в JSON Schema (но не валидируется), для совместимости миграции |

### Добавлено

| Пункт | Откуда | Зачем |
| --- | --- | --- |
| `scenarioVersion` в инстансе обязательно | Form.io `_fvid` | без этого — не воспроизвести историю |
| История событий с enum `action: "answer" \| "transition" \| ...` | Camunda History API | для аудита и отчётов |
| Schema Evolution Rules (safe/unsafe changes) | Form.io | для будущего редактора |
| Action Registry на клиенте, отдельно от DSL | Airbnb GP / Lyft | правильное разделение обязанностей |
| Theme-конфиг отдельно от DSL | Stripe Appearance API | если когда-то понадобится |
| Default «skip unknown action with warning» | Airbnb GP | мягкая совместимость |

---

## 13. Что вернуть к рассмотрению потом

**Не v1, но рынок намекает, что когда-то понадобится:**

1. **Lifecycle actions** (`step.onEnter`, `step.onExit`). У Camunda есть
   execution listeners, у Airbnb — actions на load и unmount. Для нас
   полезно, когда захочется «при входе в шаг автозаполнить из БД». На v1 —
   нет.
2. **Lyft Semantic Components.** Если когда-то добавим сложные шаги (карта
   с привязкой объекта, видео-плеер), стоит сделать их «семантическими»:
   сервер шлёт только ID объекта, клиент сам рисует свою сложную логику.
3. **Server-side adaptation per client version** (Airbnb-style). Сейчас
   все наши runner'ы будут одной версии. Когда мобильные версии начнут
   расходиться — клиент шлёт `app-version` хедер, сервер адаптирует ответ.
4. **Деление одного `Scenario` на несколько с call-activity.** Camunda
   рекомендует «cutting long processes» через call activities. Если
   сценарии станут длинными (12+ шагов), стоит разрешить вызов
   подсценариев.
5. **Submission Revisions per-form** (Form.io). Если history раздуется —
   делаем его опциональным per-сценарий.
6. **Process Instance Migration** (Camunda style). Когда-то понадобится.
   Контракт уже совместим (стабильные `step.id`).
7. **Локализация через ключи + словарь.** Когда понадобится более одного
   языка.
8. **Graphical editor metadata** (`editor.layout.nodes[]`). Если/когда
   будем делать визуальный граф-редактор — добавляем подсекцию.

---

## 14. Источники

[form-rev-feat]: https://form.io/features/form-revisions/
[form-rev-deep]: https://form.io/features/form-revisions-form-json-schema
[form-vs-sub]: https://form.io/form-json-schema-vs-submission/
[form-change-logs]: https://form.io/features/form-change-logs/
[camunda-versioning]: https://docs.camunda.io/docs/components/best-practices/operations/versioning-process-definitions
[camunda-migration]: https://docs.camunda.io/docs/components/concepts/process-instance-migration/
[camunda-tech]: https://docs.camunda.io/docs/8.6/guides/migrating-from-camunda-7/technical-details/
[airbnb-deep]: https://medium.com/airbnb-engineering/a-deep-dive-into-airbnbs-server-driven-ui-system-842244c5f5
[okoone]: https://okoone.com/spark/product-design-research/changing-user-interface-with-airbnbs-ghost-platform
[gp-linkedin]: https://www.linkedin.com/posts/harshit-sachan-334a50174_flutter-serverdrivenui-sdui-activity-7351838144461225984-ZoAG
[mnf-discussion]: https://github.com/MobileNativeFoundation/discussions/discussions/47
[lyft-journey]: https://eng.lyft.com/the-journey-to-server-driven-ui-at-lyft-bikes-and-scooters-c19264a0378e
[stripe-mobile]: https://docs.stripe.com/elements/appearance-api/embedded-mobile
[stripe-embedded]: https://docs.stripe.com/payments/mobile/accept-payment-embedded
[backstage-custom]: https://backstage.io/docs/features/software-templates/writing-custom-field-extensions
[jsonlogic-spec]: https://shinyjsonlogic.com/specification
[cel-spec]: https://github.com/google/cel-spec/
[cel-kotlin]: https://gitlab.com/opensavvy/cel-kotlin
[jexl-security]: https://betterprogramming.pub/expression-language-injections-in-java-e08bd17addf4

- Form.io. **Form Revisions**, [features page][form-rev-feat].
- Form.io. **How Form.io Preserves Your Form JSON Schema Across Versions**, [deep dive][form-rev-deep].
- Form.io. **Form JSON Schema vs Submission**, [article][form-vs-sub].
- Form.io. **Complete Audit Trail to Log Forms**, [features][form-change-logs].
- Camunda. **Versioning process definitions** (best practices), [docs][camunda-versioning].
- Camunda. **Process instance migration**, [docs][camunda-migration].
- Camunda. **Migrating from Camunda 7: technical details**, [docs][camunda-tech].
- Airbnb Tech Blog (Ryan Brooks). **A Deep Dive into Airbnb's Server-Driven UI System**, [Medium][airbnb-deep].
- Okoone. **Changing user interface with Airbnb's Ghost Platform**, [okoone.com][okoone].
- LinkedIn (Harshit Sachan). **Airbnb's Ghost Platform: A Unified Server-Driven UI**, [post][gp-linkedin].
- MobileNativeFoundation discussions. **Server-driven UI strategies**, [GitHub Discussions #47][mnf-discussion].
- Lyft Engineering (Alex Hartwell). **The Journey to Server Driven UI At Lyft Bikes and Scooters**, [eng.lyft.com][lyft-journey].
- Stripe. **Embedded mobile** (Appearance API), [docs][stripe-mobile].
- Stripe. **Accept in-app payments**, [docs][stripe-embedded].
- Backstage. **Writing Custom Field Extensions**, [docs][backstage-custom].
- Shiny JSON Logic. **JSON Logic Specification**, [shinyjsonlogic.com][jsonlogic-spec].
- Google. **CEL specification**, [GitHub][cel-spec].
- OpenSavvy. **CEL for Kotlin (experimental)**, [GitLab][cel-kotlin].
- Better Programming (Artem Smotrakov). **Expression Language Injections in Java**, [article][jexl-security].

JSONLogic implementation libraries:
- iOS / Swift — `advantagefse/json-logic-swift` (SPM, MIT, iOS ≥ 9.0).
- Android / Kotlin — `advantagefse/json-logic-kotlin` (Maven Central, MIT) или KMP-вариант `allegro/json-logic-kmp` (поддерживает iOS+JVM из одного кодагена).
- JVM — `jamsesso/json-logic-java`, `meiskalt7/json-logic-java`.

