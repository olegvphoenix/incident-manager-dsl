import type { Attachment, Step, StepValue } from "../../types/dsl";
import { ButtonStepView } from "./ButtonStepView";
import { RadioButtonStepView } from "./RadioButtonStepView";
import { CheckboxStepView } from "./CheckboxStepView";
import { SelectStepView } from "./SelectStepView";
import { CommentStepView } from "./CommentStepView";
import { ImageStepView } from "./ImageStepView";
import { DatetimeStepView } from "./DatetimeStepView";

export type SubmitFn = (value: StepValue, attachments?: Attachment[]) => void;

export interface StepProps<S extends Step = Step> {
  step: S;
  onSubmit: SubmitFn;
}

export function StepRenderer({ step, onSubmit }: StepProps) {
  switch (step.type) {
    case "Button":       return <ButtonStepView step={step} onSubmit={onSubmit} />;
    case "RadioButton":  return <RadioButtonStepView step={step} onSubmit={onSubmit} />;
    case "Checkbox":     return <CheckboxStepView step={step} onSubmit={onSubmit} />;
    case "Select":       return <SelectStepView step={step} onSubmit={onSubmit} />;
    case "Comment":      return <CommentStepView step={step} onSubmit={onSubmit} />;
    case "Image":        return <ImageStepView step={step} onSubmit={onSubmit} />;
    case "Datetime":     return <DatetimeStepView step={step} onSubmit={onSubmit} />;
  }
}
