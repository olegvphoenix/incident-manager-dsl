import { createTheme } from "@mui/material/styles";

// Базовая MUI-тема. Намеренно нейтральная — позже подгоним под фирменную палитру
// web-configurator (там тёмная) или оставим как есть для standalone.
export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#1f6feb" },
    secondary: { main: "#6e40c9" },
    background: { default: "#f6f7f9", paper: "#ffffff" },
  },
  shape: { borderRadius: 6 },
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: 13,
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true, size: "small" } },
    MuiTextField: { defaultProps: { size: "small" } },
    MuiSelect: { defaultProps: { size: "small" } },
  },
});
