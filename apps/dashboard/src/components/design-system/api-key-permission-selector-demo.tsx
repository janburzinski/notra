"use client";

import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@notra/ui/components/shared/responsive-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@notra/ui/components/ui/card";
import { Field, FieldLabel } from "@notra/ui/components/ui/field";
import { Input } from "@notra/ui/components/ui/input";
import { useState } from "react";

import { ApiKeyPermissionSelector } from "@/components/api-keys/permission-selector";
import { Button } from "@/components/button";
import { API_KEY_DEFAULT_SCOPES } from "@/constants/api-keys";
import type { ApiKeyAccessMode } from "@/types/api-keys";

export function ApiKeyPermissionSelectorDemo() {
  const [accessMode, setAccessMode] = useState<ApiKeyAccessMode>("full");
  const [scopes, setScopes] = useState<string[]>([...API_KEY_DEFAULT_SCOPES]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>API key permissions</CardTitle>
        <CardDescription>
          Responsive dialog with full, GEO, and restricted access modes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveDialog>
          <ResponsiveDialogTrigger render={<Button variant="outline" />}>
            Open permission selector
          </ResponsiveDialogTrigger>
          <ResponsiveDialogContent className="flex max-h-[85svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
            <ResponsiveDialogHeader className="shrink-0 border-b p-4 pr-14">
              <ResponsiveDialogTitle className="text-2xl">
                Create API Key
              </ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                Configure access for a new API key.
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
              <Field className="shrink-0">
                <FieldLabel>Name</FieldLabel>
                <Input readOnly value="Design system key" />
              </Field>
              <Field className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <FieldLabel>Permissions</FieldLabel>
                <ApiKeyPermissionSelector
                  accessMode={accessMode}
                  className="[&>div]:py-2.5"
                  onAccessModeChange={(mode, nextScopes) => {
                    setAccessMode(mode);
                    setScopes(nextScopes);
                  }}
                  onValueChange={setScopes}
                  value={scopes}
                />
              </Field>
            </div>
            <ResponsiveDialogFooter className="bg-background/95 supports-backdrop-filter:bg-background/80 mx-0 mb-0 shrink-0 rounded-b-xl border-t p-4">
              <ResponsiveDialogClose render={<Button variant="outline" />}>
                Close
              </ResponsiveDialogClose>
            </ResponsiveDialogFooter>
          </ResponsiveDialogContent>
        </ResponsiveDialog>
      </CardContent>
    </Card>
  );
}
