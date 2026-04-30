import { useCallback, useEffect, useMemo, useState } from "react";
import { ScenarioRunner } from "./ScenarioRunner";
import { ResultView } from "./ResultView";
import { startScenario, submitStep, findStep } from "../engine/stateMachine";
import type { RunnerSnapshot } from "../engine/stateMachine";
import type { Attachment, Scenario, StepValue } from "../types/dsl";
import { validateScenarioJson, formatError } from "../engine/validateScenario";

// Минимальный встраиваемый рантайм для конфигуратора (live-preview).
// Активируется при hash = #embed-runner.
//
// Протокол postMessage (host = configurator, child = этот iframe):
//   child → host: { type: "PREVIEW_READY" }              сразу после монтирования
//   host  → child: { type: "LOAD_SCENARIO", scenario }   передаёт сценарий
//   host  → child: { type: "RESET" }                     запросить пере-старт
//
// Сценарий передаётся объектом, без сериализации в файл, и валидируется
// тем же validateScenario, что и в обычном Runner.
//
// Хост и iframe сейчас на одном origin (один nginx), поэтому targetOrigin = "*"
// допустим. При разнесении на разные домены — ужесточить.

type Mode =
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | { kind: "running"; snap: RunnerSnapshot }
  | { kind: "finished"; snap: RunnerSnapshot };

interface PreviewMessage {
  type: "LOAD_SCENARIO" | "RESET";
  scenario?: Scenario;
}

export function EmbedRunnerView() {
  const [mode, setMode] = useState<Mode>({ kind: "empty" });
  const [scenario, setScenario] = useState<Scenario | null>(null);

  // Принимаем входящие postMessage от host.
  useEffect(() => {
    const onMessage = (e: MessageEvent<PreviewMessage>) => {
      const data = e.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "LOAD_SCENARIO" && data.scenario) {
        try {
          // Валидация по той же схеме, что и в обычном Runner.
          // На входе уже объект, поэтому пропускаем через JSON-сериализацию.
          const result = validateScenarioJson(JSON.stringify(data.scenario));
          if (!result.ok) {
            setMode({
              kind: "error",
              message: result.errors.map(formatError).join("\n"),
            });
            return;
          }
          setScenario(result.scenario);
          setMode({ kind: "running", snap: startScenario(result.scenario) });
        } catch (err) {
          setMode({
            kind: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      } else if (data.type === "RESET") {
        if (scenario) {
          setMode({ kind: "running", snap: startScenario(scenario) });
        } else {
          setMode({ kind: "empty" });
        }
      }
    };
    window.addEventListener("message", onMessage);
    // Сообщаем host'у, что готовы принимать сценарий.
    window.parent?.postMessage({ type: "PREVIEW_READY" }, "*");
    return () => window.removeEventListener("message", onMessage);
  }, [scenario]);

  const submit = useCallback(
    (value: StepValue, attachments?: Attachment[]) => {
      if (mode.kind !== "running" || !mode.snap.currentStepId) return;
      const next = submitStep(mode.snap, mode.snap.currentStepId, value, attachments);
      setMode(
        next.currentStepId === null
          ? { kind: "finished", snap: next }
          : { kind: "running", snap: next },
      );
    },
    [mode],
  );

  const restart = useCallback(() => {
    if (scenario) setMode({ kind: "running", snap: startScenario(scenario) });
  }, [scenario]);

  const currentStep = useMemo(() => {
    if (mode.kind !== "running" || !mode.snap.currentStepId) return null;
    return findStep(mode.snap.scenario, mode.snap.currentStepId);
  }, [mode]);

  return (
    <div className="embed-runner" style={{ height: "100%", width: "100%", overflow: "auto" }}>
      {mode.kind === "empty" && (
        <div style={{ padding: 24, color: "#64748b", textAlign: "center" }}>
          Ожидание сценария от редактора…
        </div>
      )}
      {mode.kind === "error" && (
        <div style={{ padding: 16 }}>
          <div style={{ color: "#dc2626", fontWeight: 600, marginBottom: 8 }}>
            Сценарий не валиден:
          </div>
          <pre
            style={{
              fontSize: 12,
              whiteSpace: "pre-wrap",
              background: "#fef2f2",
              padding: 12,
              borderRadius: 6,
            }}
          >
            {mode.message}
          </pre>
        </div>
      )}
      {mode.kind === "running" && currentStep && (
        <ScenarioRunner
          scenario={mode.snap.scenario}
          snap={mode.snap}
          currentStep={currentStep}
          onSubmit={submit}
          onExit={restart}
        />
      )}
      {mode.kind === "finished" && (
        <ResultView snap={mode.snap} onExit={restart} />
      )}
    </div>
  );
}
