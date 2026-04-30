// Общие хелперы для edges:
// - набор иконок side-effect actions (assign/notify/log/...) с подсказками,
// - tooltip-обёртка для всей линии,
// - cursor:pointer на интерактивной overlay-зоне поверх линии,
// - emit события в FlowEditor (контекстное меню по ПКМ, double-click).
//
// EdgeLabelRenderer кладёт DOM поверх ReactFlow, но мы хотим, чтобы события
// тоже работали на самой линии. Для этого в каждом edge компоненте мы
// рисуем «толстую невидимую обводку» (interaction layer) с pointerEvents=stroke,
// которая получает hover/click/contextmenu, и прокидывает их в общий
// диспетчер событий.

import Tooltip from "@mui/material/Tooltip";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";

import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import NotificationsIcon from "@mui/icons-material/Notifications";
import HttpIcon from "@mui/icons-material/Http";
import EditNoteIcon from "@mui/icons-material/EditNote";
import HistoryEduIcon from "@mui/icons-material/HistoryEdu";
import HourglassTopIcon from "@mui/icons-material/HourglassTop";
import BoltIcon from "@mui/icons-material/Bolt";

const ICON_MAP: Record<string, { Icon: typeof BoltIcon; label: string; color: string }> = {
  assign: { Icon: AssignmentIndIcon, label: "assign", color: "#1976d2" },
  notify: { Icon: NotificationsIcon, label: "notify", color: "#ed6c02" },
  request: { Icon: HttpIcon, label: "request (HTTP)", color: "#455a64" },
  setState: { Icon: EditNoteIcon, label: "setState", color: "#6a1b9a" },
  log: { Icon: HistoryEduIcon, label: "log", color: "#37474f" },
  delay: { Icon: HourglassTopIcon, label: "delay", color: "#888" },
};

const FALLBACK_ICON = BoltIcon;

interface EdgeActionBadgesProps {
  actionTypes?: string[];
}

// Маленькие иконки под/возле подписи edge'a, чтобы side-effect actions
// (assign, notify, и т.п.) были видны прямо в Flow без открытия Inspector.
export const EdgeActionBadges = ({ actionTypes }: EdgeActionBadgesProps) => {
  if (!actionTypes || actionTypes.length === 0) return null;
  // Уникальные типы, в порядке появления (повторы агрегируются)
  const seen = new Set<string>();
  const items = actionTypes.filter((t) => {
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  });

  return (
    <Stack direction="row" spacing={0.25} alignItems="center">
      {items.map((t) => {
        const meta = ICON_MAP[t] ?? {
          Icon: FALLBACK_ICON,
          label: t,
          color: "#666",
        };
        const Icon = meta.Icon;
        return (
          <Tooltip key={t} title={`Action: ${meta.label}`}>
            <Box
              sx={{
                display: "inline-flex",
                width: 14,
                height: 14,
                borderRadius: "50%",
                bgcolor: "white",
                border: `1px solid ${meta.color}`,
                color: meta.color,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon sx={{ fontSize: 10 }} />
            </Box>
          </Tooltip>
        );
      })}
    </Stack>
  );
};
