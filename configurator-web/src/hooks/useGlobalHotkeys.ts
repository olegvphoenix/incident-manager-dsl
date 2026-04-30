import { useEffect } from "react";

import { useEditorStore } from "../store/editorStore";

interface Options {
  onSave: () => void;
}

// Глобальные горячие клавиши:
//   Ctrl/Cmd+S          сохранить
//   Ctrl/Cmd+Z          undo
//   Ctrl/Cmd+Shift+Z    redo
//   Ctrl/Cmd+Y          redo (Windows-привычка)
//   Ctrl/Cmd+J          переключить панель диагностики
//   Delete / Backspace  удалить выделенное (шаг — c подтверждением;
//                        ребро — без подтверждения)
//   Esc                 снять выделение
export function useGlobalHotkeys({ onSave }: Options) {
  const removeStep = useEditorStore((s) => s.removeStep);
  const removeRule = useEditorStore((s) => s.removeRule);
  const setDefaultGoto = useEditorStore((s) => s.setDefaultGoto);
  const setSelected = useEditorStore((s) => s.setSelected);
  const setSelectedEdge = useEditorStore((s) => s.setSelectedEdge);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          (target as HTMLElement).isContentEditable);

      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        onSave();
        return;
      }
      if (ctrl && !e.shiftKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        useEditorStore.temporal.getState().undo();
        return;
      }
      if (
        ctrl &&
        ((e.shiftKey && (e.key === "z" || e.key === "Z")) || e.key === "y" || e.key === "Y")
      ) {
        e.preventDefault();
        useEditorStore.temporal.getState().redo();
        return;
      }
      if (ctrl && (e.key === "j" || e.key === "J")) {
        e.preventDefault();
        const cur = useEditorStore.getState().ui.diagnosticsPanelOpen;
        useEditorStore.getState().setDiagnosticsPanelOpen(!cur);
        return;
      }
      if (!inEditable && (e.key === "Delete" || e.key === "Backspace")) {
        const ui = useEditorStore.getState().ui;
        // приоритет — выделенное ребро
        if (ui.selectedEdgeId) {
          const m = ui.selectedEdgeId.match(/^([^:]+)::(default|r(\d+))::(.+)$/);
          if (m) {
            e.preventDefault();
            const stepId = m[1]!;
            if (m[2] === "default") {
              setDefaultGoto(stepId, undefined);
            } else {
              const idx = Number(m[3]!);
              if (Number.isFinite(idx)) removeRule(stepId, idx);
            }
            setSelectedEdge(null);
          }
          return;
        }
        if (ui.selectedStepId) {
          const id = ui.selectedStepId;
          e.preventDefault();
          if (window.confirm(`Удалить шаг "${id}"?`)) removeStep(id);
        }
        return;
      }
      if (e.key === "Escape") {
        setSelected(null);
        setSelectedEdge(null);
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onSave, removeStep, removeRule, setDefaultGoto, setSelected, setSelectedEdge]);
}
