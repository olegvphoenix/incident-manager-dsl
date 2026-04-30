import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import AddIcon from "@mui/icons-material/Add";

import { useEditorStore } from "../../store/editorStore";
import { STEP_TYPE_META } from "./stepHelpers";
import { StepTypeIcon } from "./StepTypeIcon";

// Empty state, когда в сценарии 0 шагов. Помогает пользователю не залипнуть
// «как мне начать?», предлагает 3 готовых пресета и быстрый старт с нуля.
export const TableEmptyState = () => {
  const addStep = useEditorStore((s) => s.addStep);
  const setSelected = useEditorStore((s) => s.setSelected);
  const setOptionRoute = useEditorStore((s) => s.setOptionRoute);
  const setTerminalDefault = useEditorStore((s) => s.setTerminalDefault);
  const patchStepView = useEditorStore((s) => s.patchStepView);
  const patchStepOption = useEditorStore((s) => s.patchStepOption);
  const setDefaultGoto = useEditorStore((s) => s.setDefaultGoto);

  const startBlankRadio = () => {
    addStep("RadioButton", { idHint: "verify" });
  };
  const startBlankComment = () => {
    addStep("Comment", { idHint: "comment" });
  };
  const startBlankImage = () => {
    addStep("Image", { idHint: "snapshot" });
  };

  // Пресет «Подтверждение и завершение»: 1 шаг RadioButton (да/нет) →
  // если «да» — finish с резолюцией, если «нет» — escalate.
  const startConfirmPreset = () => {
    addStep("RadioButton", { idHint: "verify" });
    // следующее редактирование выполнится после mutation: используем setTimeout
    setTimeout(() => {
      const state = useEditorStore.getState();
      const step = state.scenario?.steps[0];
      if (!step) return;
      patchStepView(step.id, { label: "Подтверждаете инцидент?" });
      // переименуем opt_1/opt_2 в yes/no
      patchStepOption(step.id, 0, { id: "yes", label: "Да, подтверждаю" });
      setTimeout(() => {
        patchStepOption(step.id, 1, { id: "no", label: "Нет, ложная тревога" });
        setTimeout(() => {
          setOptionRoute(step.id, "yes", { kind: "terminal", type: "escalate" });
          setOptionRoute(step.id, "no", {
            kind: "terminal",
            type: "finish",
            args: { resolution: "Ложная тревога" },
          });
          setTerminalDefault(step.id, "finish");
          setSelected(step.id);
        }, 0);
      }, 0);
    }, 0);
  };

  // Пресет «Опрос → комментарий → завершение».
  const startSurveyPreset = () => {
    addStep("RadioButton", { idHint: "what_seen" });
    setTimeout(() => {
      const s1 = useEditorStore.getState().scenario?.steps[0];
      if (!s1) return;
      patchStepView(s1.id, { label: "Что вы видите на камере?" });
      patchStepOption(s1.id, 0, { id: "normal", label: "Всё в норме" });
      patchStepOption(s1.id, 1, { id: "abnormal", label: "Замечено отклонение" });
      addStep("Comment", { idHint: "details", afterStepId: s1.id });
      setTimeout(() => {
        const all = useEditorStore.getState().scenario?.steps ?? [];
        const s2 = all[1];
        if (!s2) return;
        patchStepView(s2.id, { label: "Опишите подробнее (опционально)" });
        addStep("Button", { idHint: "submit", afterStepId: s2.id });
        setTimeout(() => {
          const all2 = useEditorStore.getState().scenario?.steps ?? [];
          const s3 = all2[2];
          if (!s3) return;
          patchStepView(s3.id, { label: "Завершить" });
          setDefaultGoto(s1.id, s2.id);
          setDefaultGoto(s2.id, s3.id);
          setTerminalDefault(s3.id, "finish");
          setSelected(s1.id);
        }, 0);
      }, 0);
    }, 0);
  };

  return (
    <Box sx={{ p: 4, maxWidth: 920, mx: "auto" }}>
      <Stack spacing={3}>
        <Box sx={{ textAlign: "center" }}>
          <Typography variant="h5" sx={{ mb: 1 }}>
            Сценарий ещё пустой
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Добавьте первый шаг — оператор увидит его, когда придёт инцидент.
          </Typography>
        </Box>

        <Box>
          <Typography variant="overline" color="text.secondary">
            Готовые пресеты
          </Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mt: 1 }}>
            <PresetCard
              title="Подтверждение и завершение"
              description="Один вопрос «Да/Нет» — при «Да» эскалируем, при «Нет» завершаем как ложную тревогу."
              onClick={startConfirmPreset}
            />
            <PresetCard
              title="Опрос оператора"
              description="3 шага: радио-выбор, комментарий, кнопка «Завершить»."
              onClick={startSurveyPreset}
            />
          </Stack>
        </Box>

        <Box>
          <Typography variant="overline" color="text.secondary">
            Или начать с одного шага
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", gap: 1 }}>
            <Button
              startIcon={
                <StepTypeIcon
                  type="RadioButton"
                  sx={{ color: `${STEP_TYPE_META.RadioButton.color}.main` }}
                />
              }
              variant="outlined"
              onClick={startBlankRadio}
            >
              {STEP_TYPE_META.RadioButton.label}
            </Button>
            <Button
              startIcon={
                <StepTypeIcon type="Comment" sx={{ color: `text.primary` }} />
              }
              variant="outlined"
              onClick={startBlankComment}
            >
              {STEP_TYPE_META.Comment.label}
            </Button>
            <Button
              startIcon={
                <StepTypeIcon
                  type="Image"
                  sx={{ color: `${STEP_TYPE_META.Image.color}.main` }}
                />
              }
              variant="outlined"
              onClick={startBlankImage}
            >
              {STEP_TYPE_META.Image.label}
            </Button>
            <Button startIcon={<AddIcon />} variant="text">
              ...или нажмите «Шаг» в верхнем меню
            </Button>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
};

const PresetCard = ({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) => (
  <Card variant="outlined" sx={{ flex: 1 }}>
    <CardActionArea onClick={onClick}>
      <CardContent>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </CardContent>
    </CardActionArea>
  </Card>
);
