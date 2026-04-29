import { useState } from "react";
import type { CheckboxStep, StepValue } from "../../types/dsl";

interface Props { step: CheckboxStep; onSubmit: (value: StepValue) => void }

export function CheckboxStepView({ step, onSubmit }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const min = step.view.minSelected ?? 0;
  const max = step.view.maxSelected ?? Infinity;
  const valid = selected.length >= min && selected.length <= max;

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <div className="step step--checkbox">
      <h3 className="step__title">{step.view.label}</h3>
      {(min > 0 || max !== Infinity) && (
        <p className="step__hint">
          Выберите{" "}
          {min === max ? `ровно ${min}` :
           min > 0 && max !== Infinity ? `от ${min} до ${max}` :
           min > 0 ? `минимум ${min}` :
           `не более ${max}`}
        </p>
      )}
      <div className="checkbox-list">
        {step.view.options.map((opt) => {
          const checked = selected.includes(opt.id);
          return (
            <label key={opt.id} className={`checkbox ${checked ? "checkbox--checked" : ""}`}>
              <input type="checkbox" checked={checked} onChange={() => toggle(opt.id)} />
              <span className="checkbox__label">{opt.label}</span>
              {opt.hint && <span className="checkbox__hint">{opt.hint}</span>}
            </label>
          );
        })}
      </div>
      <button
        type="button"
        className="btn btn--primary"
        disabled={!valid}
        onClick={() => onSubmit(selected)}
      >
        Далее
      </button>
    </div>
  );
}
