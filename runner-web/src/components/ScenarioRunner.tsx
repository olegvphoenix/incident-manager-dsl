import type { Scenario, Step } from "../types/dsl";
import type { RunnerSnapshot } from "../engine/stateMachine";
import { StepRenderer, type SubmitFn } from "./steps/StepRenderer";
import { ProgressPanel } from "./ProgressPanel";

interface Props {
  scenario: Scenario;
  snap: RunnerSnapshot;
  currentStep: Step;
  onSubmit: SubmitFn;
  onExit: () => void;
}

export function ScenarioRunner({ scenario, snap, currentStep, onSubmit, onExit }: Props) {
  return (
    <div className="runner">
      <header className="runner__header">
        <button className="btn btn--secondary" onClick={onExit}>← Прервать</button>
        <h2 className="runner__title">{scenario.metadata?.name ?? "(сценарий без имени)"}</h2>
      </header>

      <section className="runner__step-card">
        <StepRenderer step={currentStep} onSubmit={onSubmit} />
      </section>

      <section className="runner__progress">
        <ProgressPanel snapshot={snap} />
      </section>
    </div>
  );
}
