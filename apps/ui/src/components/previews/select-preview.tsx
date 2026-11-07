import { CheckIcon } from "lucide-react";

import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DROPDOWN_ITEM_CLASS_NAME,
  DROPDOWN_POPUP_CLASS_NAME,
} from "@/registry/notra/dropdown-menu/constants/dropdown-menu";

import { FREQUENCY_OPTIONS } from "../../../registry/notra/select/constants/select";

const OPEN_OPTIONS = FREQUENCY_OPTIONS.filter(
  (option) => option.value !== "custom"
);

export default function SelectPreview() {
  return (
    <div aria-hidden className="flex w-48 flex-col gap-1">
      <Select defaultValue="weekly" items={FREQUENCY_OPTIONS}>
        <SelectTrigger className="w-full" tabIndex={-1}>
          <SelectValue />
        </SelectTrigger>
      </Select>
      <div className={`${DROPDOWN_POPUP_CLASS_NAME} p-1`}>
        {OPEN_OPTIONS.map((option) => (
          <div
            className={`${DROPDOWN_ITEM_CLASS_NAME} pr-8`}
            data-highlighted={option.value === "monthly" ? "" : undefined}
            key={option.value}
          >
            {option.label}
            {option.value === "weekly" && (
              <span className="absolute right-2.5 flex size-4 items-center justify-center">
                <CheckIcon />
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
