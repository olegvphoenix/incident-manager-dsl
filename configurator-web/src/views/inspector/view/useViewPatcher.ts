import { useCallback } from "react";
import type { Step } from "../../../types/dsl";
import { useEditorStore } from "../../../store/editorStore";

// Хелпер для view-форм. Возвращает функцию patch(diff), которая применяет
// частичные изменения к step.view одной store-операцией. immer внутри store.
export function useViewPatcher<T extends Step>(step: T) {
  const setStepView = useEditorStore((s) => s.setStepView);
  return useCallback(
    (diff: Partial<T["view"]>) => {
      setStepView(step.id, { ...step.view, ...diff });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step.id, step.view, setStepView],
  );
}
