import { useState } from "react";
import type { CommentStep, StepValue } from "../../types/dsl";

interface Props { step: CommentStep; onSubmit: (value: StepValue) => void }

export function CommentStepView({ step, onSubmit }: Props) {
  const [text, setText] = useState("");
  const required = step.view.required ?? false;
  const minLength = step.view.minLength ?? 0;
  const isReadonly = step.view.readonly === true;
  const valid = !required || text.trim().length >= minLength;

  return (
    <div className="step step--comment">
      <h3 className="step__title">{step.view.label}</h3>
      {isReadonly ? (
        <p className="readonly-note">{step.view.placeholder ?? "(текст инструкции)"}</p>
      ) : (
        <textarea
          className="textarea"
          rows={step.view.maxRows ?? 4}
          placeholder={step.view.placeholder ?? ""}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      )}
      {required && minLength > 0 && (
        <p className="step__hint">Минимум {minLength} символов. Сейчас: {text.trim().length}</p>
      )}
      <button
        type="button"
        className="btn btn--primary"
        disabled={!valid}
        onClick={() => onSubmit(isReadonly ? "(read-only acknowledged)" : text)}
      >
        {isReadonly ? "Ознакомлен" : "Далее"}
      </button>
    </div>
  );
}
