import { useState } from "react";
import type { SelectStep, StepValue } from "../../types/dsl";

interface Props { step: SelectStep; onSubmit: (value: StepValue) => void }

export function SelectStepView({ step, onSubmit }: Props) {
  const [val, setVal] = useState<string>("");
  const required = step.view.required ?? true;

  return (
    <div className="step step--select">
      <h3 className="step__title">{step.view.label}</h3>
      <select
        className="select"
        value={val}
        onChange={(e) => setVal(e.target.value)}
      >
        <option value="" disabled>— выберите —</option>
        {step.view.options.map((opt) => (
          <option key={opt.id} value={opt.id}>{opt.label}</option>
        ))}
      </select>
      <button
        type="button"
        className="btn btn--primary"
        disabled={required && val === ""}
        onClick={() => val && onSubmit(val)}
      >
        Далее
      </button>
    </div>
  );
}
