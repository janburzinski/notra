import type { UiSound } from "@/types/ui-sounds";

const CONTROL_SELECTOR = [
  "button",
  "a[href]",
  "summary",
  "label",
  "input",
  "[cmdk-item]",
  ...[
    "button",
    "link",
    "switch",
    "checkbox",
    "radio",
    "tab",
    "menuitem",
    "menuitemcheckbox",
    "menuitemradio",
    "option",
    "treeitem",
  ].map((role) => `[role="${role}"]`),
].join(",");

const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

const BUTTON_INPUT_TYPES = new Set(["button", "image", "reset", "submit"]);

export function isTextEntry(element: Element | null) {
  if (
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ) {
    return true;
  }
  if (element instanceof HTMLInputElement) {
    return !NON_TEXT_INPUT_TYPES.has(element.type);
  }
  return element instanceof HTMLElement && element.isContentEditable;
}

function isDisabled(element: Element) {
  const dataDisabled = element.getAttribute("data-disabled");
  return (
    element.matches(":disabled") ||
    element.getAttribute("aria-disabled") === "true" ||
    (dataDisabled !== null && dataDisabled !== "false") ||
    element.closest("[inert]") !== null
  );
}

function isSelected(element: Element) {
  return ["aria-selected", "aria-checked", "aria-pressed"].some(
    (attribute) => element.getAttribute(attribute) === "true"
  );
}

/**
 * `wasToggled` is true when the browser already flipped a checkbox before
 * the click reached us (a click on the box itself, not on its label).
 */
function classifyInput(
  input: HTMLInputElement,
  wasToggled: boolean
): UiSound | null {
  if (input.type === "checkbox") {
    const turningOn = wasToggled ? input.checked : !input.checked;
    return turningOn ? "toggleOn" : "toggleOff";
  }
  if (input.type === "radio") {
    return !wasToggled && input.checked ? "click" : "select";
  }
  return BUTTON_INPUT_TYPES.has(input.type) ? "click" : null;
}

function classifyControl(control: Element): UiSound | null {
  const role = control.getAttribute("role");
  if (role === "switch" || role === "checkbox" || role === "menuitemcheckbox") {
    if (
      control.getAttribute("aria-readonly") === "true" ||
      control.hasAttribute("data-readonly")
    ) {
      return null;
    }
    return control.getAttribute("aria-checked") === "true"
      ? "toggleOff"
      : "toggleOn";
  }
  const popup = control.getAttribute("aria-haspopup");
  // The popup itself makes the open or close sound once it changes.
  if (popup !== null && popup !== "false") {
    return null;
  }
  // Delete menu items are menu items too, but sound like a delete.
  if (control.getAttribute("data-variant") === "destructive") {
    return "destructive";
  }
  // cmdk marks the highlighted item as selected, so any pick is a select.
  if (control.hasAttribute("cmdk-item")) {
    return "select";
  }
  if (
    role === "radio" ||
    role === "menuitemradio" ||
    role === "tab" ||
    role === "option" ||
    control.getAttribute("data-slot") === "toggle-group-item"
  ) {
    return isSelected(control) ? "click" : "select";
  }
  if (role === "menuitem") {
    return "select";
  }
  const pressed = control.getAttribute("aria-pressed");
  if (pressed === "true" || pressed === "false") {
    return pressed === "true" ? "toggleOff" : "toggleOn";
  }
  if (control.querySelector("[data-slot='copy-state-icon']")) {
    return "copy";
  }
  const expanded = control.getAttribute("aria-expanded");
  if (expanded === "true" || expanded === "false") {
    return expanded === "true" ? "close" : "open";
  }
  if (
    control instanceof HTMLElement &&
    control.tagName === "SUMMARY" &&
    control.parentElement instanceof HTMLDetailsElement
  ) {
    return control.parentElement.open ? "close" : "open";
  }
  return "click";
}

function classifyLabelled(control: HTMLElement): UiSound | null {
  if (isDisabled(control) || isTextEntry(control)) {
    return null;
  }
  if (control instanceof HTMLInputElement) {
    return classifyInput(control, false);
  }
  return classifyControl(control);
}

function hasPointerCursor(element: Element) {
  return getComputedStyle(element).cursor === "pointer";
}

/**
 * Picks the sound for a click from what was clicked. Runs before the page
 * handles the click, so toggles still show the state they are leaving.
 */
export function classifyClick(target: EventTarget | null): UiSound | null {
  if (!(target instanceof Element) || isTextEntry(target)) {
    return null;
  }
  // Base UI forwards clicks to hidden inputs; the visible control already
  // made its sound.
  if (
    target instanceof HTMLInputElement &&
    target.getAttribute("aria-hidden") === "true"
  ) {
    return null;
  }
  const control = target.closest(CONTROL_SELECTOR);
  if (!control) {
    return hasPointerCursor(target) ? "click" : null;
  }
  if (control instanceof HTMLLabelElement) {
    if (control.control instanceof HTMLElement) {
      return classifyLabelled(control.control);
    }
    return hasPointerCursor(target) ? "click" : null;
  }
  if (isDisabled(control)) {
    return null;
  }
  if (control instanceof HTMLInputElement) {
    return classifyInput(control, true);
  }
  return classifyControl(control);
}
