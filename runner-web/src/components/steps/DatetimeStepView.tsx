import { useState } from "react";
import type { DatetimeStep, StepValue } from "../../types/dsl";

interface Props { step: DatetimeStep; onSubmit: (value: StepValue) => void }

export function DatetimeStepView({ step, onSubmit }: Props) {
  const [val, setVal] = useState("");
  const required = step.view.required ?? true;
  const inputType =
    step.view.kind === "time" ? "time" :
    step.view.kind === "date" ? "date" : "datetime-local";

  return (
    <div className="step step--datetime">
      <h3 className="step__title">{step.view.label}</h3>
      <input
        type={inputType}
        className="input"
        value={val}
        onChange={(e) => setVal(e.target.value)}
      />
      <div className="row">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => {
            const now = new Date();
            const iso =
              step.view.kind === "time" ? now.toTimeString().slice(0, 5) :
              step.view.kind === "date" ? now.toISOString().slice(0, 10) :
              now.toISOString().slice(0, 16);
            setVal(iso);
          }}
        >
          Сейчас
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={required && !val}
          onClick={() => val && onSubmit(val)}
        >
          Далее
        </button>
      </div>
    </div>
  );
}
