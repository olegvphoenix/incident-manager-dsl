import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import RefreshIcon from "@mui/icons-material/Refresh";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CloseIcon from "@mui/icons-material/Close";

import { useEditorStore } from "../../store/editorStore";

// URL runner-web. В dev / prod может различаться:
// - dev:  локальный nginx или другой адрес → задаётся через VITE_RUNNER_EMBED_URL
// - prod: nginx раздаёт runner-web по /runner/ → дефолт ниже
//
// Передаём готовый URL с #embed-runner.
const RUNNER_BASE_URL =
  (import.meta.env.VITE_RUNNER_EMBED_URL as string | undefined) ?? "/runner/";
const EMBED_URL = `${RUNNER_BASE_URL.replace(/\/$/, "/")}#embed-runner`;

// Drawer live-preview справа от Inspector. Внутри iframe → runner-web в embed-режиме.
// Хост шлёт сценарий через postMessage; iframe валидирует и запускает.
//
// Re-load делаем дебаунсом по изменению scenario — чтобы при типовом редактировании
// не дёргать iframe на каждый ввод символа.
export const LivePreview = () => {
  const scenario = useEditorStore((s) => s.scenario);
  const setLivePreviewOpen = useEditorStore((s) => s.setLivePreviewOpen);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const debounceRef = useRef<number | null>(null);

  // Слушаем PREVIEW_READY от iframe — он шлёт его при монтировании.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const data = e.data as { type?: string };
      if (data?.type === "PREVIEW_READY") setReady(true);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Шлём сценарий после ready и далее на каждое изменение (с дебаунсом).
  useEffect(() => {
    if (!ready || !scenario) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "LOAD_SCENARIO", scenario },
        "*",
      );
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [ready, scenario]);

  const handleReset = () => {
    iframeRef.current?.contentWindow?.postMessage({ type: "RESET" }, "*");
  };

  const handleOpenStandalone = () => {
    // Открыть полноценный runner в новой вкладке. Сценарий не передаётся
    // (там работа из своего хранилища), это just-for-debug.
    window.open(RUNNER_BASE_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <Box
      sx={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
      }}
    >
      <Box
        sx={{
          height: 36,
          minHeight: 36,
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 1,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
          Live-preview
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Перезапустить с начала">
          <span>
            <IconButton size="small" onClick={handleReset} disabled={!ready || !scenario}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Открыть Runner в новой вкладке">
          <IconButton size="small" onClick={handleOpenStandalone}>
            <OpenInNewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Закрыть live-preview">
          <IconButton size="small" onClick={() => setLivePreviewOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Box sx={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <iframe
          ref={iframeRef}
          src={EMBED_URL}
          title="Live preview"
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            display: "block",
            background: "#fff",
          }}
        />
        {!scenario && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "rgba(255,255,255,0.85)",
              color: "text.secondary",
              fontSize: 13,
            }}
          >
            Откройте или создайте сценарий, чтобы увидеть его в Runner.
          </Box>
        )}
      </Box>
    </Box>
  );
};
