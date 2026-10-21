const FOCUSABLE = 'a[href],area[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const modalStacks = new WeakMap();
function focusableElements(dialog) {
  return [...dialog.querySelectorAll(FOCUSABLE)].filter(element => {
    if (element.closest("[hidden],[inert]") || element.getAttribute("aria-hidden") === "true") return false;
    const style = dialog.ownerDocument.defaultView.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
  });
}
function focus(element) {
  if (!element) return;
  try { element.focus({ preventScroll: true }); } catch { element.focus(); }
}
export function activateModal(dialogRef, { initialFocus = null, onEscape = () => {}, trigger } = {}) {
  const getDialog = typeof dialogRef === "function" ? dialogRef : () => dialogRef;
  const initialDialog = getDialog();
  if (!initialDialog) return () => {};
  const doc = initialDialog.ownerDocument;
  const view = doc.defaultView;
  const returnTarget = trigger ?? doc.activeElement;
  let state = modalStacks.get(doc);
  if (!state) {
    state = { stack: [] };
    state.onKeydown = event => {
      const entry = state.stack.at(-1);
      const dialog = entry?.getDialog();
      if (!dialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        entry.onEscape();
        return;
      }
      if (event.key !== "Tab") return;
      const targets = focusableElements(dialog);
      const currentIndex = targets.indexOf(doc.activeElement);
      if (!targets.length) {
        event.preventDefault();
        if (!dialog.hasAttribute("tabindex")) dialog.tabIndex = -1;
        focus(dialog);
      } else if (event.shiftKey && currentIndex <= 0) {
        event.preventDefault();
        focus(targets.at(-1));
      } else if (!event.shiftKey && (currentIndex === targets.length - 1 || currentIndex === -1)) {
        event.preventDefault();
        focus(targets[0]);
      }
    };
    doc.addEventListener("keydown", state.onKeydown, true);
    modalStacks.set(doc, state);
  }
  const entry = { getDialog, onEscape };
  state.stack.push(entry);
  let target = typeof initialFocus === "function" ? initialFocus() : initialFocus;
  if (typeof target === "string") target = initialDialog.querySelector(target);
  if (!target || !initialDialog.contains(target)) target = focusableElements(initialDialog)[0] || initialDialog;
  focus(target);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    const index = state.stack.indexOf(entry);
    if (index < 0) return;
    state.stack.splice(index, 1);
    if (!state.stack.length) {
      doc.removeEventListener("keydown", state.onKeydown, true);
      modalStacks.delete(doc);
    }
    view.requestAnimationFrame(() => {
      if (returnTarget?.isConnected && returnTarget.getClientRects().length) {
        focus(returnTarget);
        return;
      }
      const parent = state.stack.at(-1);
      const parentDialog = parent?.getDialog();
      if (parentDialog) focus(focusableElements(parentDialog)[0] || parentDialog);
    });
  };
}