import type { RunnerSnapshot } from "../engine/stateMachine";

interface Props { snapshot: RunnerSnapshot }

export function ProgressPanel({ snapshot }: Props) {
  const completed = Object.keys(snapshot.state).length;
  const total = snapshot.scenario.steps.length;

  return (
    <div className="progress">
      <h3>Прогресс</h3>
      <p className="progress__count">
        Шагов выполнено: {completed} / {total}
        <span className="progress__hint"> (общее число — верхняя граница, реальный путь зависит от условий)</span>
      </p>

      <h4>Лента событий</h4>
      <ol className="progress__history">
        {snapshot.history.length === 0 && (
          <li className="progress__empty">Пока пусто — заполните первый шаг.</li>
        )}
        {snapshot.history.map((ev, i) => {
          if (ev.action === "answer") {
            return (
              <li key={i} className="ev ev--step">
                <span className="ev__kind">answer</span>
                <code>{ev.stepId}</code>
                <span className="ev__value">{formatValue(ev.value)}</span>
              </li>
            );
          }
          if (ev.action === "transition") {
            return (
              <li key={i} className="ev ev--transition">
                <span className="ev__kind">→</span>
                <code>{ev.stepId}</code> → <code>{ev.to}</code>
                <span className="ev__rule">
                  {ev.matchedRule === null ? "default" : `rules[${ev.matchedRule}]`}
                </span>
              </li>
            );
          }
          if (ev.action === "finish") {
            return (
              <li key={i} className="ev ev--finish">
                <span className="ev__kind">✓ finish</span>
                {ev.resolution && <span className="ev__args">{ev.resolution}</span>}
              </li>
            );
          }
          return (
            <li key={i} className="ev ev--action">
              <span className="ev__kind">action</span>
              <code>{ev.action}</code>
              <span className="ev__args">
                {JSON.stringify(
                  Object.fromEntries(
                    Object.entries(ev).filter(([k]) => k !== "ts" && k !== "stepId" && k !== "action"),
                  ),
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function formatValue(v: unknown): string {
  if (Array.isArray(v)) return `[${v.join(", ")}]`;
  if (v === true) return "✓";
  if (typeof v === "string") {
    if (v.startsWith("data:")) return "(image data)";
    return v.length > 40 ? v.slice(0, 40) + "…" : v;
  }
  return JSON.stringify(v);
}
