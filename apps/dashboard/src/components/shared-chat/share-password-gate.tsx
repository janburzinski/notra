"use client";

import { Button } from "@notra/ui/components/ui/button";
import { Input } from "@notra/ui/components/ui/input";
import { Label } from "@notra/ui/components/ui/label";
import { LockIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface SharePasswordGateProps {
  shareToken: string;
}

export function SharePasswordGate({ shareToken }: SharePasswordGateProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/shared/${shareToken}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "Incorrect password");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <GateShell
      description="This chat is protected by a password. Enter it below to view."
      icon={<LockIcon className="size-5" />}
      title="Password required"
    >
      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="share-password">Password</Label>
          <Input
            autoFocus
            id="share-password"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button disabled={pending || password.length === 0} type="submit">
          Unlock
        </Button>
      </form>
    </GateShell>
  );
}

export function GateShell({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="font-medium text-lg">{title}</h1>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
