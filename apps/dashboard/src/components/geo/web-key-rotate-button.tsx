"use client";

import { ConfirmDialog } from "@notra/ui/components/shared/confirm-dialog";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { useGeoWebKeyRotate } from "@/lib/hooks/use-geo";

/** Owners and admins can revoke a public key that was copied somewhere else. */
export function WebKeyRotateButton() {
  const t = useTranslations("geo.geoIngestSetup.script");
  const { activeOrganization } = useOrganizationsContext();
  const rotate = useGeoWebKeyRotate(activeOrganization?.id ?? "");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        className="-my-1 shrink-0"
        loading={rotate.isPending}
        onClick={() => setOpen(true)}
        size="xs"
        variant="ghost"
      >
        {t("rotateKey")}
      </Button>
      <ConfirmDialog
        confirmLabel={t("rotateKeyConfirm")}
        description={t("rotateKeyDescription")}
        onConfirm={() => {
          setOpen(false);
          rotate.mutate();
        }}
        onOpenChange={setOpen}
        open={open}
        title={t("rotateKeyTitle")}
        variant="destructive"
      />
    </>
  );
}
