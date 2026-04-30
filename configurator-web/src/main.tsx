import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { AppShell } from "./views/AppShell";
import { theme } from "./styles/theme";
import "./styles/globals.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root element is missing in index.html");

createRoot(rootEl).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ReactFlowProvider>
        <AppShell />
      </ReactFlowProvider>
    </ThemeProvider>
  </StrictMode>,
);
