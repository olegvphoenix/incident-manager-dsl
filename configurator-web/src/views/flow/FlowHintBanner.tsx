// Однократная подсказка-баннер, которая появляется при первом открытии Flow
// редактора. Объясняет основные интеракции: ПКМ на узле/ребре, двойной клик,
// перетаскивание из палитры. Скрывается через X — состояние сохраняется
// в localStorage, чтобы постоянным пользователям не мозолить глаза.

import { useState, useCallback, useEffect } from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import MouseIcon from "@mui/icons-material/Mouse";
import TouchAppIcon from "@mui/icons-material/TouchApp";
import OpenWithIcon from "@mui/icons-material/OpenWith";
import AltRouteIcon from "@mui/icons-material/AltRoute";
import FlagIcon from "@mui/icons-material/Flag";

const STORAGE_KEY = "configurator.flowHintDismissed.v3";

// Внешний триггер: позволяет принудительно показать баннер, не трогая localStorage.
// Используется кнопкой «Показать подсказки» в Toolbar.
export function showFlowHints() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("configurator:flow-hint:show"));
}

export const FlowHintBanner = () => {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setDismissed(false);
    }
    const onShow = () => setDismissed(false);
    window.addEventListener("configurator:flow-hint:show", onShow);
    return () => window.removeEventListener("configurator:flow-hint:show", onShow);
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // sandboxed iframe: пользователь увидит баннер ещё раз — ничего страшного
    }
  }, []);

  if (dismissed) return null;

  return (
    <Box
      sx={{
        position: "absolute",
        top: 8,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 11,
        maxWidth: 560,
        width: "calc(100% - 32px)",
      }}
    >
      <Alert
        severity="info"
        variant="outlined"
        icon={false}
        action={
          <IconButton size="small" onClick={dismiss}>
            <CloseIcon fontSize="small" />
          </IconButton>
        }
        sx={{ bgcolor: "background.paper" }}
      >
        <AlertTitle sx={{ mb: 0.5 }}>Подсказки по работе с диаграммой</AlertTitle>
        <Stack spacing={0.25}>
          <HintRow icon={<OpenWithIcon fontSize="inherit" />}>
            Перетащите тип шага из палитры слева, чтобы добавить узел
          </HintRow>
          <HintRow icon={<FlagIcon fontSize="inherit" />}>
            Перетащите <strong>Finish/Report/Escalate</strong> из палитры на шаг —
            или нажмите <strong>🏁</strong> на узле для finish одним кликом
          </HintRow>
          <HintRow icon={<AltRouteIcon fontSize="inherit" />}>
            Кнопка <strong>+</strong> на узле — добавить условный переход (rule)
          </HintRow>
          <HintRow icon={<TouchAppIcon fontSize="inherit" />}>
            <strong>Двойной клик</strong> по стрелке — быстрая правка условия
          </HintRow>
          <HintRow icon={<MouseIcon fontSize="inherit" />}>
            <strong>ПКМ</strong> на узле или стрелке — контекстное меню
          </HintRow>
        </Stack>
      </Alert>
    </Box>
  );
};

const HintRow = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
  <Stack direction="row" spacing={1} alignItems="center">
    <Box sx={{ display: "inline-flex", color: "primary.main", fontSize: 14 }}>{icon}</Box>
    <Typography variant="body2">{children}</Typography>
  </Stack>
);
