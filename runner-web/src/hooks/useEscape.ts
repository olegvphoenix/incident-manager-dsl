import { useEffect } from "react";

// Подписывается на keydown=Escape пока компонент смонтирован.
// Вешаем обработчик на window в фазе capture, чтобы Esc срабатывал даже когда
// фокус оказался на элементе, у которого свой stopPropagation
// (например, на input внутри диалога).
//
// Если открыто несколько диалогов разом — каждый смонтированный обработчик
// получит событие; наверх его уже отправит браузер. На практике мы открываем
// только один диалог за раз, поэтому конфликтов нет.
export function useEscape(onEscape: () => void): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Не закрываем, если пользователь использует Esc внутри IME-композиции.
      if (e.isComposing) return;
      e.stopPropagation();
      onEscape();
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [onEscape]);
}
