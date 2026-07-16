export default function updateDownloadDropdownPosition(
  wrapper: HTMLElement | null
): void {
  const button = wrapper?.querySelector("button");
  if (!wrapper || !button) return;
  const buttonRect = button.getBoundingClientRect();
  const spaceAbove = buttonRect.top - 4 - 10;
  wrapper.style.setProperty(
    "--download-dropdown-bottom",
    `${window.innerHeight - buttonRect.top + 4}px`
  );
  wrapper.style.setProperty(
    "--download-dropdown-max-height",
    `${Math.max(spaceAbove, 80)}px`
  );
}
