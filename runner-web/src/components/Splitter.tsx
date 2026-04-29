import { useEffect, useRef, useState } from "react";

// Вертикальный сплиттер. Хранит размеры (px) двух соседних колонок в localStorage,
// родителю отдаёт обработчик drag через onResize(deltaPx).
//
// Использование: сплиттер выставляется между колонками, родитель сам решает,
// как пересчитать ширины (см. App.tsx ниже).

interface Props {
  onResize: (deltaPx: number) => void;
  onDoubleClick?: () => void;   // обычно — сбросить ширину к дефолту
  title?: string;
}

export function Splitter({ onResize, onDoubleClick, title }: Props) {
  const [dragging, setDragging] = useState(false);
  const lastX = useRef(0);

  useEffect(() => {
    if (!dragging) return;
    function move(e: MouseEvent) {
      const dx = e.clientX - lastX.current;
      lastX.current = e.clientX;
      onResize(dx);
    }
    function up() { setDragging(false); }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [dragging, onResize]);

  return (
    <div
      className={`splitter ${dragging ? "splitter--dragging" : ""}`}
      onMouseDown={(e) => {
        lastX.current = e.clientX;
        setDragging(true);
      }}
      onDoubleClick={onDoubleClick}
      role="separator"
      aria-orientation="vertical"
      title={title ?? (onDoubleClick ? "Перетащите для изменения ширины. Двойной клик — сбросить" : "Перетащите, чтобы изменить ширину")}
    />
  );
}
