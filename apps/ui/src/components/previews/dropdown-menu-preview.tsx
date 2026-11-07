import {
  CheckIcon,
  ChevronRightIcon,
  DownloadIcon,
  SettingsIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";

import {
  DROPDOWN_ITEM_CLASS_NAME,
  DROPDOWN_POPUP_CLASS_NAME,
} from "@/registry/notra/dropdown-menu/constants/dropdown-menu";

// The menu is drawn open with the real popup and item styles. A live Base UI
// menu only renders its popup after hydration, inside a portal.
export default function DropdownMenuPreview() {
  return (
    <div aria-hidden className={`${DROPDOWN_POPUP_CLASS_NAME} w-56 p-1`}>
      <div className="text-muted-foreground px-2.5 py-1.5 text-xs font-medium">
        Workspace
      </div>
      <div className={DROPDOWN_ITEM_CLASS_NAME} data-highlighted="">
        <SettingsIcon />
        Settings
        <span className="text-muted-foreground ml-auto text-xs tracking-widest">
          ⌘,
        </span>
      </div>
      <div className={DROPDOWN_ITEM_CLASS_NAME}>
        <UsersIcon />
        Invite members
      </div>
      <div className={DROPDOWN_ITEM_CLASS_NAME}>
        <DownloadIcon />
        Export
        <ChevronRightIcon className="ml-auto" />
      </div>
      <div className="bg-border mx-2 my-1 h-px" />
      <div className={`${DROPDOWN_ITEM_CLASS_NAME} pr-8`}>
        Show activity
        <span className="absolute right-2.5 flex size-4 items-center justify-center">
          <CheckIcon />
        </span>
      </div>
      <div className="bg-border mx-2 my-1 h-px" />
      <div
        className={`${DROPDOWN_ITEM_CLASS_NAME} text-destructive *:[svg]:text-destructive`}
      >
        <Trash2Icon />
        Delete workspace
      </div>
    </div>
  );
}
