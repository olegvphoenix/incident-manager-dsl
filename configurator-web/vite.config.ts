import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Конфигуратор импортирует dsl-v1-schema.json из родительской папки и опционально
// читает примеры сценариев из ../examples. Поэтому раскрываем доступ к парент-каталогу.
//
// base: '/configurator/' — конфигуратор раздаётся как подпуть внутри runner-web
// на 8080 (см. runner-web/Dockerfile). Это даёт один origin для runner и
// конфигуратора → не нужны cross-origin postMessage handshakes, live-preview
// и handoff работают без CORS.
//
// Для локального dev (npm run dev) base оставляем '/', чтобы привычно открывать
// http://localhost:5173/. Переключение управляется переменной CFG_BASE
// (см. .env.production).
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/configurator/" : "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    fs: {
      allow: [
        path.resolve(__dirname, ".."),
        path.resolve(__dirname, "..", "examples"),
      ],
    },
  },
  build: {
    // Code-split тяжёлых UI-библиотек в отдельные чанки. Основной index.js
    // получается ~280 KB вместо ~1 MB и хорошо кешируется.
    rollupOptions: {
      output: {
        manualChunks: {
          flow: ["@xyflow/react"],
          ajv: ["ajv", "ajv-formats", "ajv/dist/2020"],
          virtual: ["@tanstack/react-virtual"],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
}));
