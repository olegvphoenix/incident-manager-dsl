import { useCallback, useEffect } from "react";
import Box from "@mui/material/Box";

import { Toolbar } from "./Toolbar";
import { WorkspacePlaceholder } from "./WorkspacePlaceholder";
import { Inspector } from "./inspector/Inspector";
import { FlowEditor } from "./flow/FlowEditor";
import { TableView } from "./table/TableView";
import { DiagnosticsPanel } from "./diagnostics/DiagnosticsPanel";
import { LivePreview } from "./preview/LivePreview";
import { useEditorStore } from "../store/editorStore";
import { useGlobalHotkeys } from "../hooks/useGlobalHotkeys";
import { saveScenario } from "../services/saveScenario";
import { setupHandoffListener } from "../services/handoff";

// Корневой layout редактора: верхний toolbar, центральная рабочая область,
// правая панель Inspector, нижняя панель Diagnostics (collapsible).
export const AppShell = () => {
  const scenario = useEditorStore((s) => s.scenario);
  const view = useEditorStore((s) => s.ui.view);
  const diagnosticsPanelOpen = useEditorStore((s) => s.ui.diagnosticsPanelOpen);
  const livePreviewOpen = useEditorStore((s) => s.ui.livePreviewOpen);

  const onSave = useCallback(() => {
    void saveScenario();
  }, []);
  useGlobalHotkeys({ onSave });

  // При первом монтировании пробуем подхватить handoff от runner-web.
  // Если в URL есть ?from=runner — слушаем postMessage от opener'а.
  useEffect(() => {
    return setupHandoffListener();
  }, []);

  // 32px = свёрнутая шапка панели; 320px = развёрнутая (см. EXPANDED_HEIGHT
  // в DiagnosticsPanel.tsx).
  const diagHeight = diagnosticsPanelOpen ? 320 : 32;

  // Ширина инспектора зависит от вида:
  //   table — узкий 300px (таблица сама несёт ~80% редактирования, инспектор
  //   нужен как «расширенные настройки» и держит активный шаг видимым);
  //   flow  — 360px (классическая ширина, формы там более плотные).
  const inspectorWidth = view === "table" ? 300 : 360;
  const gridTemplateColumns = livePreviewOpen
    ? `1fr ${inspectorWidth}px 420px`
    : `1fr ${inspectorWidth}px`;
  const gridTemplateAreas = livePreviewOpen
    ? `
        "tb tb tb"
        "ws in lp"
        "dg dg dg"
      `
    : `
        "tb tb"
        "ws in"
        "dg dg"
      `;

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateAreas,
        gridTemplateRows: `48px 1fr ${diagHeight}px`,
        gridTemplateColumns,
        height: "100vh",
        width: "100vw",
        bgcolor: "background.default",
      }}
    >
      <Box sx={{ gridArea: "tb", borderBottom: "1px solid", borderColor: "divider" }}>
        <Toolbar />
      </Box>
      <Box sx={{ gridArea: "ws", overflow: "hidden", position: "relative" }}>
        {!scenario ? (
          <WorkspacePlaceholder />
        ) : view === "flow" ? (
          <FlowEditor />
        ) : (
          <TableView />
        )}
      </Box>
      <Box
        sx={{
          gridArea: "in",
          borderLeft: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          overflow: "auto",
        }}
      >
        <Inspector />
      </Box>
      {livePreviewOpen && (
        <Box
          sx={{
            gridArea: "lp",
            borderLeft: "1px solid",
            borderColor: "divider",
            overflow: "hidden",
          }}
        >
          <LivePreview />
        </Box>
      )}
      <Box sx={{ gridArea: "dg", overflow: "hidden" }}>
        <DiagnosticsPanel />
      </Box>
    </Box>
  );
};
