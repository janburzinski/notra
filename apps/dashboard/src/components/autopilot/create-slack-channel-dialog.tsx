"use client";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import { Button } from "@notra/ui/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@notra/ui/components/ui/input-group";
import { Label } from "@notra/ui/components/ui/label";
import { ORPCError } from "@orpc/client";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId } from "react";
import { toast } from "sonner";

import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  CreateAutopilotSlackChannelProps,
  CreateSlackChannelFormValues,
} from "@/types/slack-integration";
import { toErrorMessage } from "@/utils/error-message";

const DEFAULT_CHANNEL_VALUES: CreateSlackChannelFormValues = {
  name: "notra-autopilot",
};

export function CreateSlackChannelDialog({
  organizationId,
  integrationId,
  authorizeUrl,
  onCreated,
  onCancel,
  returnFocus,
}: CreateAutopilotSlackChannelProps) {
  const queryClient = useQueryClient();
  const id = useId();
  const create = useMutation({
    mutationFn: ({ name }: CreateSlackChannelFormValues) =>
      dashboardOrpc.integrations.slack.createChannel.call({
        organizationId,
        integrationId,
        name,
      }),
    onSuccess: async ({ channel }) => {
      const queryKey =
        dashboardOrpc.integrations.slack.listChannels.queryOptions({
          input: { organizationId, integrationId },
        }).queryKey;
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, (previous) => ({
        channels: [
          ...(previous?.channels ?? []).filter(
            (item) => item.id !== channel.id
          ),
          channel,
        ],
      }));
      onCreated(channel);
      toast.success(
        `Created #${channel.name}. Join it in Slack to see your daily brief.`
      );
    },
  });
  const form = useForm({
    defaultValues: DEFAULT_CHANNEL_VALUES,
    onSubmit: ({ value }) => {
      if (!create.isPending) {
        create.mutate(value);
      }
    },
  });
  const needsReconnect =
    create.error instanceof ORPCError &&
    create.error.data?.slackReconnectRequired === true;

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open && !create.isPending) {
          onCancel();
        }
      }}
    >
      <ResponsiveDialogContent
        className="sm:max-w-md"
        finalFocus={returnFocus}
        showCloseButton={!create.isPending}
      >
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Create Slack channel</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            A public channel for your daily brief. Notra joins automatically.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form
          className="space-y-2"
          id={`${id}-form`}
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
        >
          <Label htmlFor={`${id}-name`}>Channel name</Label>
          <form.Field name="name">
            {(field) => (
              <InputGroup>
                <InputGroupAddon aria-hidden="true">#</InputGroupAddon>
                <InputGroupInput
                  aria-describedby={`${id}-hint ${id}-error`}
                  aria-invalid={create.isError}
                  autoComplete="off"
                  disabled={create.isPending}
                  id={`${id}-name`}
                  maxLength={80}
                  name="slack-channel-name"
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                    create.reset();
                  }}
                  pattern="[a-z0-9_\-]+"
                  required
                  value={field.state.value}
                />
              </InputGroup>
            )}
          </form.Field>
          <p className="text-muted-foreground text-xs" id={`${id}-hint`}>
            Lowercase letters, numbers, hyphens, and underscores.
          </p>
          <p
            className="text-destructive text-xs"
            id={`${id}-error`}
            role="alert"
          >
            {create.isError
              ? toErrorMessage(
                  create.error,
                  "Could not create the Slack channel"
                )
              : ""}
          </p>
        </form>
        <ResponsiveDialogFooter>
          <Button
            disabled={create.isPending}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          {needsReconnect ? (
            <Button
              nativeButton={false}
              render={<a aria-label="Reconnect Slack" href={authorizeUrl} />}
              variant="secondary"
            >
              Reconnect Slack
            </Button>
          ) : (
            <Button
              data-dialog-confirm
              form={`${id}-form`}
              loading={create.isPending}
              type="submit"
            >
              Create channel
            </Button>
          )}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
