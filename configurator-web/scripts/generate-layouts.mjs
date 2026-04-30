// Генерация sidecar layout-файлов через TS-скрипт generate-layouts.ts.
// Запуск: node scripts/generate-layouts.mjs [<rel-path>...]

import { spawnSync } from "node:child_process";

const result = spawnSync(
  "npx",
  ["-y", "tsx", "scripts/generate-layouts.ts", ...process.argv.slice(2)],
  { stdio: "inherit", shell: true },
);
process.exit(result.status ?? 0);
