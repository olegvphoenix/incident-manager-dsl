import type { Scenario } from "../types/dsl";

// URL конфигуратора. Раньше был cross-origin (отдельный порт 8081), сейчас
// раздаётся как подпуть /configurator/ внутри того же runner-web контейнера,
// поэтому переход — обычная навигация в текущей вкладке (in-app).
const CONFIGURATOR_URL =
  (import.meta.env.VITE_CONFIGURATOR_URL as string | undefined) ?? "/configurator/";

// Ключ в sessionStorage, через который runner-web кладёт сценарий, а
// configurator-web подбирает его при загрузке. Используем sessionStorage,
// а не localStorage: данные нужны только до момента, когда configurator
// прочитает их — потом сразу удаляются. И не засоряем долгоживущее хранилище.
const HANDOFF_STORAGE_KEY = "im.handoff.scenario";

interface HandoffPayload {
  scenario: Scenario;
  baseName: string;
  timestamp: number;
}

// Открыть конфигуратор. Если сценарий передан — кладём его в sessionStorage,
// а configurator при старте поднимает оттуда. Same-origin = sessionStorage
// общий между документами одного origin. Это проще и надёжнее, чем
// postMessage handshake с window.open.
export function openInConfigurator(opts?: {
  scenario?: Scenario;
  baseName?: string;
}): void {
  if (opts?.scenario) {
    const payload: HandoffPayload = {
      scenario: opts.scenario,
      baseName: opts.baseName ?? opts.scenario.metadata?.name ?? "scenario",
      timestamp: Date.now(),
    };
    try {
      sessionStorage.setItem(HANDOFF_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // sessionStorage недоступен (редко) — продолжаем без сценария.
    }
  }
  // Навигация в текущей вкладке. ?from=runner — маркер для конфигуратора,
  // чтобы он знал, что нужно подобрать handoff из storage и показать toast.
  const url = opts?.scenario ? CONFIGURATOR_URL + "?from=runner" : CONFIGURATOR_URL;
  window.location.assign(url);
}

export const HANDOFF_KEY = HANDOFF_STORAGE_KEY;
