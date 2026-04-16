"use client";

import {
  Delete02Icon,
  MoreVerticalIcon,
  SentIcon,
  TextIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogAction,
  ResponsiveAlertDialogCancel,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogTitle,
} from "@notra/ui/components/shared/responsive-alert-dialog";
import { Badge } from "@notra/ui/components/ui/badge";
import { Button } from "@notra/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { memo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { PostStatus } from "@/schemas/content";
import { formatSnakeCaseLabel } from "@/utils/format";
import { OutputTypeIcon } from "@/utils/output-types";
import { QUERY_KEYS } from "@/utils/query-keys";

const CONTENT_TYPES = [
  "changelog",
  "blog_post",
  "twitter_post",
  "linkedin_post",
  "investor_update",
] as const;

type ContentType = (typeof CONTENT_TYPES)[number];

function getContentTypeLabel(contentType: ContentType): string {
  if (contentType === "twitter_post") {
    return "tweet";
  }

  return formatSnakeCaseLabel(contentType);
}

interface ContentCardProps {
  id: string;
  title: string;
  preview: string;
  contentType: ContentType;
  status: PostStatus;
  organizationId: string;
  className?: string;
  href?: string;
}

const ContentCard = memo(function ContentCard({
  id,
  title,
  preview,
  contentType,
  status,
  organizationId,
  className,
  href,
}: ContentCardProps) {
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/organizations/${organizationId}/content/${id}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        throw new Error("Failed to delete");
      }

      toast.success("Post deleted");
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.POSTS.list(organizationId),
      });
      setShowDeleteDialog(false);
    } catch {
      toast.error("Failed to delete post");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleToggleStatus() {
    setIsTogglingStatus(true);
    const newStatus = status === "published" ? "draft" : "published";
    try {
      const res = await fetch(
        `/api/organizations/${organizationId}/content/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!res.ok) {
        throw new Error("Failed to update status");
      }

      toast.success(
        newStatus === "published" ? "Post published" : "Post moved to drafts"
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.POSTS.list(organizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.POSTS.today(organizationId),
        }),
      ]);
    } catch {
      toast.error("Failed to update post status");
    } finally {
      setIsTogglingStatus(false);
    }
  }

  const cardContent = (
    <div
      className={cn(
        "group relative flex flex-col rounded-2xl p-2",
        // Shadow as border — layered for natural depth
        "shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_2px_-1px_rgba(0,0,0,0.06),0px_2px_4px_0px_rgba(0,0,0,0.04)]",
        "dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]",
        // Hover: elevated shadow + scale on press
        "transition-[box-shadow,transform] duration-150 ease-out",
        href && [
          "cursor-pointer",
          "hover:shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08),0px_2px_4px_-1px_rgba(0,0,0,0.08),0px_4px_8px_0px_rgba(0,0,0,0.06)]",
          "dark:hover:shadow-[0_0_0_1px_rgba(255,255,255,0.13)]",
          "active:scale-[0.96]",
        ],
        "h-full bg-card",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3 px-2 py-2">
        <p className="min-w-0 truncate font-semibold text-base text-foreground" style={{ textWrap: "balance" }}>
          {title}
        </p>
        <div className="flex shrink-0 items-center">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  className="size-7 p-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={(e) => e.preventDefault()}
                  variant="ghost"
                >
                  <span className="sr-only">Open menu</span>
                  <HugeiconsIcon className="size-4" icon={MoreVerticalIcon} />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                disabled={isTogglingStatus}
                onClick={(e) => {
                  e.preventDefault();
                  handleToggleStatus();
                }}
              >
                <HugeiconsIcon
                  className="mr-2 size-4"
                  icon={status === "published" ? TextIcon : SentIcon}
                />
                {status === "published" ? "Move to draft" : "Publish"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={isDeleting}
                onClick={(e) => {
                  e.preventDefault();
                  setShowDeleteDialog(true);
                }}
                variant="destructive"
              >
                <HugeiconsIcon className="mr-2 size-4" icon={Delete02Icon} />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {/* Concentric radius: outer = 16px (rounded-2xl), padding = 8px, inner = 8px (rounded-lg) → 8 + 8 = 16 ✓ */}
      <div className="flex-1 rounded-lg bg-muted/50 px-4 py-3">
        <p className="line-clamp-3 text-muted-foreground text-sm leading-relaxed" style={{ textWrap: "pretty" }}>
          {preview}
        </p>
      </div>
      <div className="flex items-center gap-2 px-2 pt-2 pb-1">
        <Badge
          className="capitalize"
          variant={status === "published" ? "default" : "outline"}
        >
          {status}
        </Badge>
        <Badge
          className="flex items-center gap-1.5 capitalize"
          variant="secondary"
        >
          <OutputTypeIcon className="size-3" outputType={contentType} />
          {getContentTypeLabel(contentType)}
        </Badge>
      </div>
    </div>
  );

  return (
    <>
      {href ? (
        <Link
          className="block h-full w-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          href={href}
        >
          {cardContent}
        </Link>
      ) : (
        cardContent
      )}

      <ResponsiveAlertDialog
        onOpenChange={(open) => {
          if (!isDeleting) {
            setShowDeleteDialog(open);
          }
        }}
        open={showDeleteDialog}
      >
        <ResponsiveAlertDialogContent>
          <ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogTitle>
              Delete post?
            </ResponsiveAlertDialogTitle>
            <ResponsiveAlertDialogDescription>
              This will permanently delete &quot;{title}&quot;. This action
              cannot be undone.
            </ResponsiveAlertDialogDescription>
          </ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogFooter>
            <ResponsiveAlertDialogCancel disabled={isDeleting}>
              Cancel
            </ResponsiveAlertDialogCancel>
            <ResponsiveAlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </ResponsiveAlertDialogAction>
          </ResponsiveAlertDialogFooter>
        </ResponsiveAlertDialogContent>
      </ResponsiveAlertDialog>
    </>
  );
});

export { ContentCard, CONTENT_TYPES, getContentTypeLabel };
export type { ContentCardProps, ContentType };
