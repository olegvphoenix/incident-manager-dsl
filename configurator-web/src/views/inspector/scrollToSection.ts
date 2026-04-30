// Прокрутить Inspector к секции (identity/view/transitions/...) и
// подсветить её на пару секунд. Секции помечены data-inspector-section.
//
// Используется DiagnosticsPanel при клике по ошибке: переходим к шагу +
// открываем нужную секцию.

export function scrollInspectorToSection(section: string): void {
  // Ждём один кадр — Inspector мог только что перерендериться после смены
  // selectedStepId, ещё нет DOM.
  requestAnimationFrame(() => {
    const el = document.querySelector(
      `[data-inspector-section="${section}"]`,
    ) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.style.outline = "2px solid #1976d2";
    el.style.outlineOffset = "4px";
    el.style.borderRadius = "4px";
    el.style.transition = "outline-color 0.6s ease";
    setTimeout(() => {
      el.style.outline = "";
      el.style.outlineOffset = "";
    }, 1800);
  });
}
