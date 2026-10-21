import { useSyncExternalStore } from "react";

import { useParams } from "@/lib/navigation";

import type { TemplateDraft } from "./draft";
import { VARIANT_CUSTOM_TEMPLATES, type VariantTemplate } from "./fixtures";

/**
 * Harness-only state shared by the heading's Create button and the templates
 * section, which render in different places on the page. Kept per workspace
 * so switching workspaces doesn't carry templates or an open editor along.
 */
interface HarnessState {
  custom: VariantTemplate[];
  added: ReadonlySet<string>;
  editor: { initial: TemplateDraft; title: string; editing?: string } | null;
}

type HarnessUpdate = (current: HarnessState) => HarnessState;

const initialState = (): HarnessState => ({
  custom: VARIANT_CUSTOM_TEMPLATES,
  added: new Set(),
  editor: null,
});

const states = new Map<string, HarnessState>();
const listeners = new Set<() => void>();

function read(slug: string) {
  let state = states.get(slug);
  if (!state) {
    state = initialState();
    states.set(slug, state);
  }
  return state;
}

export function useHarness() {
  const { slug = "" } = useParams<{ slug: string }>();
  const state = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => read(slug),
    () => read(slug)
  );
  const update = (change: HarnessUpdate) => {
    states.set(slug, change(read(slug)));
    for (const listener of listeners) {
      listener();
    }
  };
  return [state, update] as const;
}
