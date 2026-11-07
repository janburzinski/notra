import { Tabs, TabsList, TabsTrigger } from "@notra/ui/components/ui/tabs";
import { useSyncExternalStore } from "react";

import { THEME_OPTIONS } from "../constants/sidebar-theme";
import {
  applyThemeChoice,
  isThemeChoice,
  readThemeChoice,
  subscribeThemeChoice,
} from "../lib/theme";

/** The dashboard's tab switch, picking the color theme. */
export default function ThemeSwitch() {
  const choice = useSyncExternalStore(
    subscribeThemeChoice,
    readThemeChoice,
    () => "system" as const
  );

  return (
    <Tabs
      onValueChange={(value) => {
        if (typeof value === "string" && isThemeChoice(value)) {
          applyThemeChoice(value);
        }
      }}
      value={choice}
    >
      <TabsList aria-label="Color theme" className="w-full">
        {THEME_OPTIONS.map((option) => (
          <TabsTrigger key={option.value} value={option.value}>
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
