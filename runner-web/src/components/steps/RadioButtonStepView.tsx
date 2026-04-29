import { useState } from "react";
import type { RadioButtonStep, StepValue } from "../../types/dsl";

interface Props { step: RadioButtonStep; onSubmit: (value: StepValue) => void }

export function RadioButtonStepView({ step, onSubmit }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const required = step.view.required ?? true;
  const layout = step.view.layout ?? "vertical";

  return (
    <div className="step step--radio">
      <h3 className="step__title">{step.view.label}</h3>
      <div className={`radio-list radio-list--${layout}`}>
        {step.view.options.map((opt) => (
          <label key={opt.id} className={`radio ${selected === opt.id ? "radio--checked" : ""}`}>
            <input
              type="radio"
              name={step.id}
              value={opt.id}
              checked={selected === opt.id}
              onChange={() => setSelected(opt.id)}
            />
            <span className="radio__label">{opt.label}</span>
            {opt.hint && <span className="radio__hint">{opt.hint}</span>}
          </label>
        ))}
      </div>
      <button
        type="button"
        className="btn btn--primary"
        disabled={required && selected === null}
        onClick={() => selected !== null && onSubmit(selected)}
      >
        Далее
      </button>
    </div>
  );
}
