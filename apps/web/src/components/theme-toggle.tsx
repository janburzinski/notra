import { Moon02Icon, Sun02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@notra/ui/components/ui/button";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { useTranslations } from "use-intl";

function subscribeIsClient() {
  return () => {};
}

function ThemeToggleGlyph() {
  return (
    <span className="relative flex size-4 items-center justify-center">
      <HugeiconsIcon className="size-4 dark:hidden" icon={Moon02Icon} />
      <HugeiconsIcon
        className="absolute inset-0 hidden size-4 dark:block"
        icon={Sun02Icon}
      />
    </span>
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useTranslations("navbar.theme");
  const themeReady = useSyncExternalStore(
    subscribeIsClient,
    () => true,
    () => false
  );
  const isDark = themeReady && resolvedTheme === "dark";

  function handleToggle() {
    const dark = document.documentElement.classList.contains("dark");
    setTheme(dark ? "light" : "dark");
  }

  useHotkey("D", handleToggle, { enabled: themeReady });

  let ariaLabel = t("toggle");
  if (themeReady && isDark) {
    ariaLabel = t("light");
  } else if (themeReady) {
    ariaLabel = t("dark");
  }

  return (
    <Button
      aria-keyshortcuts="d"
      aria-label={ariaLabel}
      aria-pressed={themeReady ? isDark : undefined}
      className="text-foreground h-9 w-9 overflow-visible rounded-lg p-0"
      onClick={handleToggle}
      type="button"
      variant="ghost"
    >
      <ThemeToggleGlyph />
    </Button>
  );
}
