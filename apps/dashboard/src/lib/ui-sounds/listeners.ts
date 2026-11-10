import { UI_SOUND_GESTURE_WINDOW_MS } from "@/constants/ui-sounds";
import { classifyClick, isTextEntry } from "@/lib/ui-sounds/classify";
import { playUiSound, unlockUiSounds } from "@/lib/ui-sounds/player";
import type { UiSound } from "@/types/ui-sounds";

// Base UI popups carry `data-open` or `data-closed`; tooltips and hover cards
// have no popup role, so they stay silent.
const POPUP_SELECTOR = [
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="menu"]',
  '[data-slot="select-content"]',
  '[data-slot="combobox-content"]',
  '[data-slot="autocomplete-content"]',
]
  .map((selector) => `${selector}:is([data-open],[data-closed])`)
  .join(",");
const TOAST_SELECTOR = "[data-sonner-toast]";
const SLIDER_SELECTOR = 'input[type="range"],[role="slider"]';
const WATCHED_SELECTOR = `${POPUP_SELECTOR},${TOAST_SELECTOR}`;

const TOAST_SOUNDS: Record<string, UiSound> = {
  success: "success",
  error: "error",
  warning: "warning",
  info: "info",
  default: "info",
  normal: "info",
  action: "info",
};

function isTyping(event: KeyboardEvent) {
  if (event.isComposing) {
    return true;
  }
  if (
    !(event.target instanceof Element) ||
    !isTextEntry(event.target) ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey
  ) {
    return false;
  }
  return (
    event.key.length === 1 ||
    event.key === "Backspace" ||
    event.key === "Delete"
  );
}

function sliderPosition(slider: Element) {
  const read = (attribute: string, fallback: number) => {
    const value = Number.parseFloat(slider.getAttribute(attribute) ?? "");
    return Number.isFinite(value) ? value : fallback;
  };
  const min = read("aria-valuemin", read("min", 0));
  const max = read("aria-valuemax", read("max", 100));
  const value = read("aria-valuenow", min);
  return max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;
}

/**
 * Turns clicks, popups, toasts and slider moves into sounds. Popups and
 * sliders only sound right after a click or key press, so hover cards,
 * popups opened by code and values loaded from the server stay quiet.
 */
export function installUiSoundListeners() {
  // Open popups, and whether opening them made a sound.
  const openPopups = new Map<Element, boolean>();
  const toastTypes = new WeakMap<Element, string>();
  let pointerDown = false;
  let lastGestureAt = Number.NEGATIVE_INFINITY;
  // Counts pointer presses and key presses. Each one can open one popup
  // with a sound, so a submenu hovered open right after it stays quiet.
  let gesture = 0;
  let lastOpenGesture = -1;

  const isDeliberate = () =>
    pointerDown ||
    performance.now() - lastGestureAt < UI_SOUND_GESTURE_WINDOW_MS;

  const updatePopup = (popup: Element) => {
    if (popup.hasAttribute("data-open")) {
      if (!openPopups.has(popup)) {
        const audible = isDeliberate() && lastOpenGesture !== gesture;
        openPopups.set(popup, audible);
        if (audible) {
          lastOpenGesture = gesture;
          playUiSound("open");
        }
      }
      return;
    }
    // A popup that opened quietly also closes quietly.
    const audible = openPopups.get(popup);
    if (openPopups.delete(popup) && audible && isDeliberate()) {
      playUiSound("close");
    }
  };

  const updateToast = (toast: Element) => {
    const type = toast.getAttribute("data-type") ?? "default";
    if (toastTypes.get(toast) === type) {
      return;
    }
    toastTypes.set(toast, type);
    const sound = TOAST_SOUNDS[type];
    if (sound) {
      playUiSound(sound);
    }
  };

  const updateWatched = (element: Element) => {
    if (element.matches(POPUP_SELECTOR)) {
      updatePopup(element);
    } else if (element.matches(TOAST_SELECTOR)) {
      updateToast(element);
    }
  };

  const scanAdded = (element: Element) => {
    if (element.matches(WATCHED_SELECTOR)) {
      updateWatched(element);
    }
    for (const match of element.querySelectorAll(WATCHED_SELECTOR)) {
      updateWatched(match);
    }
  };

  const closeRemovedPopups = () => {
    for (const [popup, audible] of openPopups) {
      if (!popup.isConnected) {
        openPopups.delete(popup);
        if (audible && isDeliberate()) {
          playUiSound("close");
        }
      }
    }
  };

  const updateSlider = (slider: Element) => {
    const active = document.activeElement;
    if (
      isDeliberate() &&
      active !== null &&
      (slider === active || slider.contains(active))
    ) {
      playUiSound("slider", sliderPosition(slider));
    }
  };

  const observer = new MutationObserver((records) => {
    let removed = false;
    for (const record of records) {
      if (record.type === "childList") {
        for (const node of record.addedNodes) {
          if (node instanceof Element) {
            scanAdded(node);
          }
        }
        removed ||= record.removedNodes.length > 0;
        continue;
      }
      const target = record.target;
      if (!(target instanceof Element) || !target.isConnected) {
        continue;
      }
      if (record.attributeName === "aria-valuenow") {
        if (target.matches(SLIDER_SELECTOR)) {
          updateSlider(target);
        }
      } else {
        updateWatched(target);
      }
    }
    if (removed) {
      closeRemovedPopups();
    }
  });

  const onPointerDown = () => {
    pointerDown = true;
    gesture += 1;
    lastGestureAt = performance.now();
    unlockUiSounds();
  };
  const onPointerUp = () => {
    pointerDown = false;
    lastGestureAt = performance.now();
  };
  const onBlur = () => {
    pointerDown = false;
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (isTyping(event)) {
      // Lists that open while typing (autocomplete) aren't worth a sound.
      lastGestureAt = Number.NEGATIVE_INFINITY;
      return;
    }
    gesture += 1;
    lastGestureAt = performance.now();
    unlockUiSounds();
  };
  const onClick = (event: MouseEvent) => {
    // Clicks sent by code (a download link, a hidden file input) only count
    // while the user is interacting.
    if (!event.isTrusted && !isDeliberate()) {
      return;
    }
    lastGestureAt = performance.now();
    const sound = classifyClick(event.target);
    if (sound) {
      playUiSound(sound);
    }
  };

  // Popups and toasts that are already showing make no sound now, only when
  // they change.
  for (const element of document.querySelectorAll(WATCHED_SELECTOR)) {
    if (element.matches(POPUP_SELECTOR)) {
      if (element.hasAttribute("data-open")) {
        openPopups.set(element, true);
      }
    } else {
      toastTypes.set(element, element.getAttribute("data-type") ?? "default");
    }
  }

  observer.observe(document.body, {
    attributeFilter: ["data-open", "data-closed", "data-type", "aria-valuenow"],
    attributes: true,
    childList: true,
    subtree: true,
  });
  const capture = { capture: true } as const;
  window.addEventListener("pointerdown", onPointerDown, capture);
  window.addEventListener("pointerup", onPointerUp, capture);
  window.addEventListener("pointercancel", onPointerUp, capture);
  window.addEventListener("keydown", onKeyDown, capture);
  window.addEventListener("click", onClick, capture);
  window.addEventListener("blur", onBlur);

  return () => {
    observer.disconnect();
    window.removeEventListener("pointerdown", onPointerDown, capture);
    window.removeEventListener("pointerup", onPointerUp, capture);
    window.removeEventListener("pointercancel", onPointerUp, capture);
    window.removeEventListener("keydown", onKeyDown, capture);
    window.removeEventListener("click", onClick, capture);
    window.removeEventListener("blur", onBlur);
  };
}
