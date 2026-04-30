import { useMemo } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Chip from "@mui/material/Chip";
import AddIcon from "@mui/icons-material/Add";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import AccountTreeIcon from "@mui/icons-material/AccountTree";

import { useEditorStore } from "../store/editorStore";
import { DEV_EXAMPLES } from "../services/devExamples";
import { createBlankScenario } from "../services/newScenario";
import { EMPTY_LAYOUT } from "../types/layout";
import { hasFsAccess, openScenarioFile } from "../services/scenarioIO";

// Welcome-экран при отсутствии открытого сценария: список встроенных примеров +
// быстрые действия «Новый» и «Открыть файл». Сразу показывает пользователю,
// что есть в системе — без необходимости лезть в меню «Пример».
export const WorkspacePlaceholder = () => {
  const loadError = useEditorStore((s) => s.ui.loadError);
  const loadScenario = useEditorStore((s) => s.loadScenario);
  const setLoadError = useEditorStore((s) => s.setLoadError);

  // Грубая категоризация по имени файла, чтобы сгруппировать «production»,
  // «showcase», «architecture». Если позже появится поле metadata.kind —
  // переключимся на него.
  const grouped = useMemo(() => {
    const production = DEV_EXAMPLES.filter((e) => /^\d{2}-/.test(e.fileName));
    const showcase = DEV_EXAMPLES.filter((e) => e.fileName.startsWith("00-") || e.fileName.includes("primitives"));
    const architecture = DEV_EXAMPLES.filter((e) => e.fileName.startsWith("A"));
    return { production, showcase, architecture };
  }, []);

  const handleNew = () => {
    const blank = createBlankScenario();
    loadScenario(
      blank,
      EMPTY_LAYOUT(blank.metadata.scenarioGuid, blank.metadata.version),
      { baseName: "untitled-scenario" },
    );
  };

  const handleOpen = async () => {
    setLoadError(null);
    try {
      const opened = await openScenarioFile();
      if (!opened) return;
      loadScenario(opened.scenario, opened.layout, {
        scenarioHandle: opened.handle,
        layoutHandle: opened.layoutHandle,
        baseName: opened.baseName,
      });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  };

  const handlePick = (fileName: string) => {
    const ex = DEV_EXAMPLES.find((e) => e.fileName === fileName);
    if (!ex) return;
    loadScenario(ex.scenario, null, { baseName: ex.fileName });
  };

  return (
    <Box
      sx={{
        height: "100%",
        width: "100%",
        overflow: "auto",
        bgcolor: "background.default",
        backgroundImage:
          "radial-gradient(circle, rgba(0,0,0,0.04) 1px, transparent 1px)",
        backgroundSize: "16px 16px",
      }}
    >
      <Box sx={{ maxWidth: 980, mx: "auto", px: 3, py: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Конфигуратор сценариев
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Выберите готовый сценарий из списка ниже, создайте новый или загрузите файл с диска.
        </Typography>

        {loadError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {loadError}
          </Alert>
        )}

        <Stack direction="row" spacing={1.5} sx={{ mt: 3 }}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleNew}>
            Новый сценарий
          </Button>
          <Button variant="outlined" startIcon={<FolderOpenIcon />} onClick={handleOpen}>
            {hasFsAccess ? "Открыть файл…" : "Открыть .json…"}
          </Button>
        </Stack>

        {grouped.production.length > 0 && (
          <Section
            title="Production-сценарии"
            hint="10 типовых сценариев из examples/. Точка входа для редактирования и доработки."
          >
            {grouped.production.map((ex) => (
              <ExampleCard
                key={ex.fileName}
                fileName={ex.fileName}
                label={ex.label}
                steps={ex.scenario.steps.length}
                onClick={() => handlePick(ex.fileName)}
              />
            ))}
          </Section>
        )}

        {grouped.showcase.length > 0 && (
          <Section
            title="Showcase"
            hint="Витрина всех 7 типов шагов в одном файле."
          >
            {grouped.showcase.map((ex) => (
              <ExampleCard
                key={ex.fileName}
                fileName={ex.fileName}
                label={ex.label}
                steps={ex.scenario.steps.length}
                onClick={() => handlePick(ex.fileName)}
              />
            ))}
          </Section>
        )}

        {grouped.architecture.length > 0 && (
          <Section
            title="Архитектурные примеры"
            hint="Минимальные сценарии для проверки границ DSL."
          >
            {grouped.architecture.map((ex) => (
              <ExampleCard
                key={ex.fileName}
                fileName={ex.fileName}
                label={ex.label}
                steps={ex.scenario.steps.length}
                onClick={() => handlePick(ex.fileName)}
              />
            ))}
          </Section>
        )}
      </Box>
    </Box>
  );
};

const Section = ({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) => (
  <Box sx={{ mt: 4 }}>
    <Typography variant="overline" sx={{ fontWeight: 600 }}>
      {title}
    </Typography>
    <Typography variant="caption" sx={{ display: "block", color: "text.secondary", mb: 1 }}>
      {hint}
    </Typography>
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 1.5,
      }}
    >
      {children}
    </Box>
  </Box>
);

const ExampleCard = ({
  fileName,
  label,
  steps,
  onClick,
}: {
  fileName: string;
  label: string;
  steps: number;
  onClick: () => void;
}) => (
  <Card variant="outlined" sx={{ "&:hover": { borderColor: "primary.main" } }}>
    <CardActionArea onClick={onClick} sx={{ p: 1.5, height: "100%", alignItems: "flex-start" }}>
      <Stack spacing={0.5} sx={{ width: "100%" }}>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <AccountTreeIcon fontSize="small" color="primary" />
          <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
            {label}
          </Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography
            variant="caption"
            sx={{
              fontFamily: "monospace",
              color: "text.secondary",
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {fileName}.json
          </Typography>
          <Chip size="small" label={`${steps} шаг${plural(steps)}`} variant="outlined" />
        </Stack>
      </Stack>
    </CardActionArea>
  </Card>
);

function plural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "а";
  return "ов";
}
