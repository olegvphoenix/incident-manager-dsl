// Единая логика сохранения сценария + sidecar layout. Используется и
// кнопкой Toolbar, и Ctrl+S хоткеем.
//
// Стратегия сохранения зависит от наличия handle'ов:
//   - оба handle уже есть     → молча перезаписываем оба файла
//   - есть только сценарий    → запрашиваем layout одним диалогом
//   - оба отсутствуют         → две showSaveFilePicker подряд (или fallback)
//   - нет FS Access           → два download'а

import { computeStepsEtag } from "./etag";
import { useEditorStore } from "../store/editorStore";
import {
  downloadJson,
  hasFsAccess,
  pickSaveHandle,
  writeJsonViaHandle,
} from "./scenarioIO";
import { EMPTY_LAYOUT, type ScenarioLayout } from "../types/layout";

export interface SaveResult {
  ok: boolean;
  message?: string;
}

export async function saveScenario(): Promise<SaveResult> {
  const state = useEditorStore.getState();
  const { scenario } = state;
  if (!scenario) return { ok: false, message: "Сценарий не открыт" };

  const fileBase = state.ui.baseName ?? "scenario";

  const layoutToSave: ScenarioLayout = {
    ...(state.layout ??
      EMPTY_LAYOUT(scenario.metadata.scenarioGuid, scenario.metadata.version)),
    etag: computeStepsEtag(scenario.steps),
    scenarioRef: {
      scenarioGuid: scenario.metadata.scenarioGuid,
      version: scenario.metadata.version,
    },
  };

  if (hasFsAccess) {
    let sh = state.scenarioHandle;
    if (!sh) sh = await pickSaveHandle(`${fileBase}.json`);
    if (!sh) return { ok: false };
    let lh = state.layoutHandle;
    if (!lh) lh = await pickSaveHandle(`${fileBase}.layout.json`);
    if (!lh) return { ok: false };
    await writeJsonViaHandle(sh, scenario);
    await writeJsonViaHandle(lh, layoutToSave);

    useEditorStore.setState({
      scenarioHandle: sh,
      layoutHandle: lh,
      layout: layoutToSave,
    });
    state.setBaseName(fileBase);
    state.markClean();
    return { ok: true, message: "Сохранено" };
  }
  // fallback
  downloadJson(`${fileBase}.json`, scenario);
  downloadJson(`${fileBase}.layout.json`, layoutToSave);
  useEditorStore.setState({ layout: layoutToSave });
  state.markClean();
  return { ok: true, message: "Файлы скачаны (browser fallback)" };
}
