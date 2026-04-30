// Smoke-проверка: грузим все JSON из ../examples/, прогоняем через
// validate() и toFlow(). Для каждого файла печатаем кол-во ошибок/предупреждений
// и кол-во nodes/edges, чтобы убедиться, что адаптеры устойчивы.
//
// Запуск: node scripts/smoke-examples.mjs
//
// Это design-time проверка. Использует tsx (через npx) чтобы исполнить TS-код
// прямо. Если tsx не установлен, скрипт скажет, как запустить.

import { spawnSync } from "node:child_process";

const result = spawnSync(
  "npx",
  ["-y", "tsx", "scripts/smoke-examples.ts"],
  { stdio: "inherit", shell: true },
);
process.exit(result.status ?? 0);
