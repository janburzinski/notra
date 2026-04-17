"use client";

import { Button } from "@notra/ui/components/ui/button";
import { ArrowRightIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface ShareForkButtonProps {
  shareToken: string;
  isAuthenticated: boolean;
}

export function ShareForkButton({
  shareToken,
  isAuthenticated,
}: ShareForkButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onFork() {
    if (!isAuthenticated) {
      const callback = encodeURIComponent(`/shared/${shareToken}`);
      router.push(`/login?callbackUrl=${callback}`);
      return;
    }
    setPending(true);
    try {
      const response = await fetch(`/api/shared/${shareToken}/fork`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        toast.error(data?.error ?? "Failed to continue this chat");
        return;
      }
      const data = (await response.json()) as { redirectTo: string };
      router.push(data.redirectTo);
    } catch {
      toast.error("Failed to continue this chat");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button disabled={pending} onClick={onFork} size="sm">
      {pending ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : (
        <ArrowRightIcon className="size-4" />
      )}
      Continue in your chat
    </Button>
  );
}
