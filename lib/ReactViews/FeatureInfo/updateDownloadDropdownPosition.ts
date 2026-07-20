function getFixedContainingBlock(
  element: HTMLElement
): { bottom: number } | undefined {
  let ancestor = element.parentElement;
  while (ancestor) {
    const style = window.getComputedStyle(ancestor);
    if (
      style.transform !== "none" ||
      style.perspective !== "none" ||
      style.filter !== "none" ||
      /transform|perspective|filter/.test(
        style.getPropertyValue("will-change")
      ) ||
      /paint|layout|strict|content/.test(style.getPropertyValue("contain"))
    ) {
      const rect = ancestor.getBoundingClientRect();
      const borderBottom = parseFloat(style.borderBottomWidth) || 0;
      return { bottom: rect.bottom - borderBottom };
    }
    ancestor = ancestor.parentElement;
  }
  return undefined;
}

export default function updateDownloadDropdownPosition(
  wrapper: HTMLElement | null
): void {
  const button = wrapper?.querySelector("button");
  if (!wrapper || !button) return;
  const buttonRect = button.getBoundingClientRect();
  const spaceAbove = buttonRect.top - 4 - 10;
  const referenceBottom =
    getFixedContainingBlock(wrapper)?.bottom ?? window.innerHeight;
  wrapper.style.setProperty(
    "--download-dropdown-bottom",
    `${referenceBottom - buttonRect.top + 4}px`
  );
  wrapper.style.setProperty(
    "--download-dropdown-max-height",
    `${Math.max(spaceAbove, 80)}px`
  );
}
