// Server-side responsibility implemented in the browser for demo purposes.
// Implements the algorithm described in dsl-v1-draft.md §6.8.
//
// In a real deployment, the Go server runs this when an Incident is created:
// it takes scenarios.script (which may contain CallScenario steps) and
// produces incidents.scenario (a flat graph). The runner only ever sees
// flat graphs, that's the principle P9.
//
// Here the runner does it itself purely so we can demo the inlining live and
// verify that the test fixtures in examples/architecture/A3-inline-before-after/
// reduce to file #3 starting from files #1 and #2.

import type {
  CallScenarioStep, Scenario, Step, StepId, RuleOutcome, Transitions,
} from '../types/dsl';

export class CycleError extends Error {
  constructor(public readonly path: string[]) {
    super(`CallScenario cycle detected: ${path.join(' -> ')}`);
    this.name = 'CycleError';
  }
}

export class MissingScenarioError extends Error {
  constructor(public readonly guid: string, public readonly version: number) {
    super(`CallScenario references unknown scenario ${guid} v${version}`);
    this.name = 'MissingScenarioError';
  }
}

export type ScenarioCatalog = Map<string, Scenario>;

/** Build a key the catalog uses: `${guid}__v${version}`. */
export function catalogKey(guid: string, version: number): string {
  return `${guid}__v${version}`;
}

export function buildCatalog(scenarios: Scenario[]): ScenarioCatalog {
  const catalog: ScenarioCatalog = new Map();
  for (const sc of scenarios) {
    const guid = sc.metadata?.scenarioGuid;
    const version = sc.metadata?.version;
    if (typeof guid === 'string' && typeof version === 'number') {
      catalog.set(catalogKey(guid, version), sc);
    }
  }
  return catalog;
}

function isCallScenario(s: Step): s is CallScenarioStep {
  return s.type === 'CallScenario';
}

function prefixId(prefix: string, id: StepId): StepId {
  return `${prefix}__${id}`;
}

/** Returns true if this step has no outgoing goto and is therefore terminal. */
function isTerminal(s: Step): boolean {
  const t = s.transitions;
  if (!t) return true;
  if (!t.default) return true;
  // default has no goto OR goto is null OR goto points outside child (handled at stitch time)
  return t.default.goto == null;
}

function rewriteOutcome(
  o: RuleOutcome,
  rewrite: (id: StepId) => StepId
): RuleOutcome {
  return {
    ...o,
    goto: o.goto == null ? o.goto : rewrite(o.goto),
  };
}

function rewriteTransitions(
  t: Transitions | undefined,
  rewrite: (id: StepId) => StepId
): Transitions | undefined {
  if (!t) return t;
  return {
    rules: t.rules?.map(r => ({
      ...r,
      goto: r.goto == null ? r.goto : rewrite(r.goto),
    })),
    default: rewriteOutcome(t.default, rewrite),
  };
}

/** Stitch a child terminal step's outgoing transition with the parent's continuation. */
function stitchTerminalWithParent(
  childTerminal: Step,
  parentContinuation: RuleOutcome
): Step {
  // Per draft §6.8: actions of the parent CallScenario.transitions.default
  // replace the child's terminal actions; goto comes from the parent.
  const newTransitions: Transitions = {
    default: {
      goto: parentContinuation.goto ?? null,
      actions: parentContinuation.actions,
    },
  };
  return { ...childTerminal, transitions: newTransitions };
}

interface InlineContext {
  catalog: ScenarioCatalog;
  // Scenarios currently on the resolution stack — used for cycle detection.
  stack: string[];
  visitedKeys: Set<string>;
}

function inlineScenario(scenario: Scenario, ctx: InlineContext): Scenario {
  const out: Step[] = [];

  for (const step of scenario.steps) {
    if (!isCallScenario(step)) {
      out.push(step);
      continue;
    }

    const childKey = catalogKey(step.view.scenarioGuid, step.view.version);

    if (ctx.stack.includes(childKey)) {
      throw new CycleError([...ctx.stack, childKey]);
    }

    const child = ctx.catalog.get(childKey);
    if (!child) {
      throw new MissingScenarioError(step.view.scenarioGuid, step.view.version);
    }

    // Recursively flatten the child first (depth-first inline).
    const flatChild = inlineScenario(child, {
      ...ctx,
      stack: [...ctx.stack, childKey],
    });
    ctx.visitedKeys.add(childKey);

    const prefix = step.view.stepIdPrefix ?? step.id;
    const rewrite = (id: StepId) => prefixId(prefix, id);

    // Take the parent's continuation from the CallScenario step itself.
    const parentContinuation: RuleOutcome = step.transitions?.default ?? { goto: null };

    // Rewrite all child step ids and inline them.
    for (const childStep of flatChild.steps) {
      const renamed: Step = {
        ...childStep,
        id: prefixId(prefix, childStep.id),
        transitions: rewriteTransitions(childStep.transitions, rewrite),
        // Inherit editable from the parent CallScenario unless the child step
        // explicitly sets it (per dsl-v1-schema.json CallScenarioStep doc).
        editable: childStep.editable ?? step.editable,
      };
      // If this child step is terminal in the original, stitch with parent.
      const wasTerminal = isTerminal(childStep);
      out.push(wasTerminal ? stitchTerminalWithParent(renamed, parentContinuation) : renamed);
    }

    // The CallScenario step itself is dropped. References to it from elsewhere
    // in the parent (e.g. goto: step.id) need to be redirected to the child's
    // entry point. We do that in a second pass below.
  }

  // Second pass: redirect any goto/initialStepId that pointed at a CallScenario
  // step to the child's entry (prefix__childInitialStepId).
  // Build redirect map from the original (un-flattened) step list.
  const redirects = new Map<StepId, StepId>();
  for (const step of scenario.steps) {
    if (!isCallScenario(step)) continue;
    const child = ctx.catalog.get(catalogKey(step.view.scenarioGuid, step.view.version))!;
    const prefix = step.view.stepIdPrefix ?? step.id;
    redirects.set(step.id, prefixId(prefix, child.initialStepId));
  }

  if (redirects.size > 0) {
    const rewrite = (id: StepId) => redirects.get(id) ?? id;
    for (let i = 0; i < out.length; i++) {
      out[i] = {
        ...out[i],
        transitions: rewriteTransitions(out[i].transitions, rewrite),
      } as Step;
    }
  }

  const initialStepId = redirects.get(scenario.initialStepId) ?? scenario.initialStepId;

  return {
    ...scenario,
    initialStepId,
    steps: out,
  };
}

/**
 * Inline all CallScenario references in `scenario` recursively, producing a
 * flat graph. Throws CycleError if a cycle is detected, MissingScenarioError
 * if a referenced scenario+version is not in the catalog.
 */
export function resolveScenario(scenario: Scenario, catalog: ScenarioCatalog): Scenario {
  return inlineScenario(scenario, { catalog, stack: [], visitedKeys: new Set() });
}

/**
 * Static check that scanning a scenario tree starting from `scenario` doesn't
 * hit a cycle. Doesn't produce flattened output.
 */
export function validateNoCycles(scenario: Scenario, catalog: ScenarioCatalog): void {
  const visit = (sc: Scenario, stack: string[]) => {
    for (const step of sc.steps) {
      if (!isCallScenario(step)) continue;
      const key = catalogKey(step.view.scenarioGuid, step.view.version);
      if (stack.includes(key)) throw new CycleError([...stack, key]);
      const child = catalog.get(key);
      if (child) visit(child, [...stack, key]);
    }
  };
  visit(scenario, []);
}

/** True if scenario tree contains at least one CallScenario step (anywhere). */
export function hasCallScenario(scenario: Scenario, catalog: ScenarioCatalog): boolean {
  const seen = new Set<string>();
  const visit = (sc: Scenario): boolean => {
    for (const step of sc.steps) {
      if (isCallScenario(step)) return true;
      // No nested scenarios outside CallScenario — but a future child may have one.
    }
    // Recurse into referenced children.
    for (const step of sc.steps) {
      if (!isCallScenario(step)) continue;
      const key = catalogKey(step.view.scenarioGuid, step.view.version);
      if (seen.has(key)) continue;
      seen.add(key);
      const child = catalog.get(key);
      if (child && visit(child)) return true;
    }
    return false;
  };
  return visit(scenario);
}
