import { ModelSprite } from "@/components/model-sprite";
import { ARROW_STEPS, MODELS } from "@/constants/models";
import type { ModelPickerProps } from "@/types/ui";
import { rgbCss } from "@/utils/color";
import { modelSpec } from "@/utils/models";

/** Six ships in a row; arrow keys move between them like any radio group. */
export function ModelPicker({ value, onChange }: ModelPickerProps) {
  const selected = modelSpec(value);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        aria-label="Choose your model"
        className="grid w-full grid-cols-6 gap-2"
        role="radiogroup"
      >
        {MODELS.map((model) => {
          const checked = model.id === value;
          return (
            <button
              aria-checked={checked}
              aria-label={model.name}
              className="px-button aspect-square p-0"
              data-variant={checked ? "primary" : undefined}
              key={model.id}
              onClick={() => onChange(model.id)}
              onKeyDown={(event) => {
                const index = MODELS.findIndex((entry) => entry.id === value);
                const step = ARROW_STEPS[event.key] ?? 0;
                if (step !== 0) {
                  event.preventDefault();
                  const next =
                    MODELS[(index + step + MODELS.length) % MODELS.length];
                  if (next) {
                    onChange(next.id);
                    const buttons = event.currentTarget.parentElement?.children;
                    (
                      buttons?.[MODELS.indexOf(next)] as HTMLElement | undefined
                    )?.focus();
                  }
                }
              }}
              role="radio"
              tabIndex={checked ? 0 : -1}
              title={model.name}
              type="button"
            >
              <ModelSprite model={model.id} scale={2.5} />
            </button>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-1 text-center">
        <p
          className="font-display text-base leading-none"
          style={{ color: rgbCss(selected.color) }}
        >
          {selected.name}
        </p>
        <p className="text-ink-2 text-sm">{selected.perk}</p>
      </div>
    </div>
  );
}
