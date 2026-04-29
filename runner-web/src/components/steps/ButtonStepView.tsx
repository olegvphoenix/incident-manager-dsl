import type { ButtonStep, StepValue } from "../../types/dsl";

interface Props { step: ButtonStep; onSubmit: (value: StepValue) => void }

export function ButtonStepView({ step, onSubmit }: Props) {
  const emphasis = step.view.emphasis ?? "primary";
  return (
    <div className="step step--button">
      {step.title && <h3 className="step__title">{step.title}</h3>}
      <button
        type="button"
        className={`btn btn--${emphasis}`}
        onClick={() => onSubmit(true)}
      >
        {step.view.label}
      </button>
    </div>
  );
}
