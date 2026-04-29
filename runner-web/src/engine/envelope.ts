import type { ResultEnvelope, ScenarioResult } from "../types/dsl";
import type { RunnerSnapshot } from "./stateMachine";

interface BuildOpts {
  fileName?: string;
  includeSnapshot?: boolean;   // вкладывать ли весь scenario script
}

export function buildEnvelope(snap: RunnerSnapshot, opts: BuildOpts = {}): ResultEnvelope {
  const meta = snap.scenario.metadata;
  const result: ScenarioResult = {
    dslVersion: snap.scenario.dslVersion,
    state: snap.state,
    history: snap.history,
    currentStepId: snap.currentStepId,
    completedAt: snap.completedAt,
    ...(snap.attachments.length > 0 ? { attachments: snap.attachments } : {}),
  };
  return {
    envelopeKind: "incident-runner-demo",
    envelopeVersion: 1,
    exportedAt: new Date().toISOString(),
    scenarioRef: {
      fileName: opts.fileName,
      name: meta.name,
      scenarioGuid: meta.scenarioGuid,
      version: meta.version,
      dslVersion: snap.scenario.dslVersion,
    },
    scenarioSnapshot: opts.includeSnapshot ? snap.scenario : undefined,
    scenarioResult: result,
  };
}
