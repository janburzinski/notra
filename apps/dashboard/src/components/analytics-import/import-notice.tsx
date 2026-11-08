import { Alert02Icon, InformationCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@notra/ui/components/ui/alert";

import type { ImportNoticeProps } from "@/types/components/analytics-import";

export function ImportNotice({
  title,
  description,
  tone = "default",
  action,
}: ImportNoticeProps) {
  return (
    <Alert
      role={tone === "destructive" ? "alert" : "status"}
      variant={tone === "destructive" ? "destructive" : "default"}
    >
      <HugeiconsIcon
        aria-hidden="true"
        className={tone === "destructive" ? undefined : "text-muted-foreground"}
        icon={tone === "destructive" ? Alert02Icon : InformationCircleIcon}
      />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
      {action ? (
        <div className="text-foreground col-start-2 mt-2">{action}</div>
      ) : null}
    </Alert>
  );
}
