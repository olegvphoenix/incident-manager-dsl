import { KEY_FACTS, PRINCIPLES } from "../home/facts";

interface Props {
  onGo: (target: "schema" | "runner" | "docs", deepLink?: string) => void;
}

// Стартовая страница демо-стенда. Без шумных фич: hero + 3 двери +
// сводные факты + принципы. Все CTA ведут на существующие вкладки.

export function HomeView({ onGo }: Props) {
  return (
    <div className="home">
      <section className="home__hero">
        <h1 className="home__title">Incident Manager — DSL v1</h1>
        <p className="home__subtitle">
          Декларативный JSON-формат сценариев операторских действий при инцидентах
          в системе видеонаблюдения. Один контракт — Web, iOS, Android. Демо-стенд
          показывает живой обход всей модели, библиотеку примеров и спецификацию.
        </p>
      </section>

      <section className="home__doors">
        <DoorCard
          accent="schema"
          title="Схема"
          tagline="Целостная модель"
          body="Mermaid-диаграмма всех 8 типов шагов, 5 actions, переходов и runtime-структур. Каждый узел — с описанием полей из JSON Schema, примером и легаси-маппингом."
          cta="Открыть обзор"
          onClick={() => onGo("schema")}
          secondary={[
            { label: "RadioButton", onClick: () => onGo("schema", "step:RadioButton") },
            { label: "scenarioResult", onClick: () => onGo("schema", "result") },
            { label: "JSONLogic", onClick: () => onGo("schema", "transitions:jsonlogic") },
          ]}
        />
        <DoorCard
          accent="runner"
          title="Runner"
          tagline="Прокликать сценарий"
          body="Витрина всех UI-примитивов и реальные production-сценарии. Запустите — runner интерпретирует JSON и рендерит шаги; справа подсвечивается активный фрагмент DSL. Импорт/экспорт ZIP."
          cta="К списку сценариев"
          onClick={() => onGo("runner")}
          secondary={[
            { label: "Витрина примитивов", onClick: () => onGo("runner") },
            { label: "Импорт .json/.zip", onClick: () => onGo("runner") },
          ]}
        />
        <DoorCard
          accent="docs"
          title="Документация"
          tagline="Спецификация и обоснование"
          body="DSL v1 spec, market research, анализ Go-сервера, предложение по версионированию. С оглавлением, подсветкой кода и копированием Markdown."
          cta="Открыть документы"
          onClick={() => onGo("docs")}
          secondary={[
            { label: "DSL v1 (draft)", onClick: () => onGo("docs", "dsl-v1-draft.md") },
            { label: "Анализ сервера", onClick: () => onGo("docs", "server-analysis.md") },
            { label: "Market research", onClick: () => onGo("docs", "market-research.md") },
          ]}
        />
      </section>

      <section className="home__facts">
        <h2 className="home__section-title">DSL в цифрах</h2>
        <ul className="home-facts">
          {KEY_FACTS.map((f, i) => (
            <li key={i} className="home-fact">
              <div className="home-fact__value">{f.value}</div>
              <div className="home-fact__label">{f.label}</div>
              {f.hint && <div className="home-fact__hint">{f.hint}</div>}
            </li>
          ))}
        </ul>
      </section>

      <section className="home__principles">
        <h2 className="home__section-title">Принципы дизайна</h2>
        <p className="home__section-hint">
          11 принципов, на которых стоит DSL v1. Развёрнутая аргументация — в{" "}
          <button className="link" onClick={() => onGo("docs", "dsl-v1-draft.md")}>
            спеке §1
          </button>.
        </p>
        <ul className="home-principles">
          {PRINCIPLES.map((p, i) => {
            const isHighlight = i === PRINCIPLES.length - 1;
            return (
              <li
                key={p.id}
                className={`home-principle${isHighlight ? " home-principle--highlight" : ""}`}
              >
                <span className="home-principle__id">{p.id}</span>
                <div className="home-principle__body">
                  <div className="home-principle__title">{p.title}</div>
                  <div className="home-principle__short">{p.short}</div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="home__footer">
        <p>
          Демо-стенд — <code>incident-runner-web</code>. Все артефакты лежат в репозитории{" "}
          <code>incident-manager-dsl/</code>: <code>dsl-v1-schema.json</code>,{" "}
          <code>dsl-v1-draft.md</code>, <code>examples/</code>, <code>runner-web/</code>.
        </p>
      </section>
    </div>
  );
}

interface DoorProps {
  accent: "schema" | "runner" | "docs";
  title: string;
  tagline: string;
  body: string;
  cta: string;
  onClick: () => void;
  secondary?: Array<{ label: string; onClick: () => void }>;
}

function DoorCard({ accent, title, tagline, body, cta, onClick, secondary }: DoorProps) {
  return (
    <article className={`door door--${accent}`}>
      <div className="door__head">
        <div className="door__tagline">{tagline}</div>
        <h3 className="door__title">{title}</h3>
      </div>
      <p className="door__body">{body}</p>
      <button className="btn btn--primary door__cta" onClick={onClick}>
        {cta} →
      </button>
      {secondary && secondary.length > 0 && (
        <div className="door__secondary">
          {secondary.map((s, i) => (
            <button key={i} className="link" onClick={s.onClick}>
              {s.label}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}
