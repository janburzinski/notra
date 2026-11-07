import { ctaButtonVariants } from "@notra/ui/components/shared/cta-button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@notra/ui/components/ui/collapsible";
import { TRANSITION, tween } from "@notra/ui/lib/motion";
import { cn } from "@notra/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import {
  AnimatePresence,
  m,
  type Variants,
  useReducedMotion,
} from "motion/react";
import { useState } from "react";

import { AUTH_DASHBOARD_URL, AUTH_SIGNIN_URL } from "@/constants/auth";
import {
  NAVBAR_MOBILE_OVERLAY_LAYOUT,
  NAVBAR_MOBILE_SIGNUP_SOURCE,
} from "@/constants/navbar";
import type {
  NavbarAuthActionsProps,
  NavbarMobileGroupProps,
  NavbarMobileMenuProps,
} from "@/types/navbar";
import {
  MARKETING_NAV,
  type MarketingNavGroup,
  type MarketingNavRailItem,
} from "@/utils/navigation";

import { NavbarChevron } from "./navbar-glyphs";
import { NavbarHref } from "./navbar-href";
import { TrackedSignupLink } from "./tracked-signup-link";

const ROW_CLASSNAME =
  "flex min-w-0 flex-col gap-0.5 rounded-lg py-2 transition-opacity active:opacity-60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none";

const TRIGGER_CLASSNAME =
  "flex min-h-14 w-full cursor-pointer items-center justify-between py-3 text-left font-sans text-[1.375rem] leading-none font-medium tracking-[-0.03em] text-[#1E1E1E] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none dark:text-white";

const PANEL_CLASSNAME = "overflow-hidden";

const MENU_FOOTER_PRIMARY_CLASSNAME = cn(
  ctaButtonVariants({ size: "lg" }),
  "font-display flex w-full text-base"
);
const MENU_FOOTER_SECONDARY_CLASSNAME = cn(
  ctaButtonVariants({ variant: "light", size: "lg" }),
  "font-display flex w-full text-base"
);

const STAGGER_IN = 0.028;
const STAGGER_OUT = 0.018;

const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      ...tween("normal", "emphasized"),
      delayChildren: 0.02,
      staggerChildren: 0.04,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      ...TRANSITION.exit,
      staggerChildren: STAGGER_OUT,
      staggerDirection: -1,
    },
  },
};

const staggerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: STAGGER_IN },
  },
  exit: {
    transition: { staggerChildren: STAGGER_OUT, staggerDirection: -1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: tween("fast", "emphasized"),
  },
  exit: {
    opacity: 0,
    y: 4,
    transition: TRANSITION.exit,
  },
};

const reducedOverlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0 } },
  exit: { opacity: 0, transition: { duration: 0 } },
};

const reducedItemVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0 } },
  exit: { opacity: 0, transition: { duration: 0 } },
};

export function NavbarMobileMenu({
  open,
  isAuthenticated,
  isResolved,
  overlayLayout,
  onNavigate,
}: NavbarMobileMenuProps) {
  const reduceMotion = useReducedMotion();
  const overlay = reduceMotion ? reducedOverlayVariants : overlayVariants;
  const stagger = reduceMotion ? reducedItemVariants : staggerVariants;
  const item = reduceMotion ? reducedItemVariants : itemVariants;
  const layout = NAVBAR_MOBILE_OVERLAY_LAYOUT[overlayLayout];
  const [overlaySession, setOverlaySession] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setOverlaySession((session) => session + 1);
    }
  }

  return (
    <AnimatePresence mode="wait">
      {open ? (
        <MobileNavOverlay
          isAuthenticated={isAuthenticated}
          isResolved={isResolved}
          item={item}
          key={overlaySession}
          layout={layout}
          onNavigate={onNavigate}
          overlay={overlay}
          stagger={stagger}
        />
      ) : null}
    </AnimatePresence>
  );
}

function MobileNavOverlay({
  isAuthenticated,
  isResolved,
  item,
  layout,
  onNavigate,
  overlay,
  stagger,
}: NavbarAuthActionsProps & {
  item: Variants;
  layout: (typeof NAVBAR_MOBILE_OVERLAY_LAYOUT)[keyof typeof NAVBAR_MOBILE_OVERLAY_LAYOUT];
  onNavigate: () => void;
  overlay: Variants;
  stagger: Variants;
}) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  return (
    <m.div
      animate="visible"
      aria-label="Navigation"
      aria-modal="true"
      className={cn(
        "pointer-events-none fixed inset-0 z-40 flex flex-col overflow-hidden overscroll-none bg-white lg:hidden dark:bg-neutral-950",
        layout.shell
      )}
      exit="exit"
      id="mobile-navigation"
      initial="hidden"
      role="dialog"
      variants={overlay}
    >
      <m.nav
        className={cn(
          "pointer-events-auto flex min-h-0 flex-1 [scrollbar-width:none] flex-col overflow-y-auto overscroll-contain pb-4 [&::-webkit-scrollbar]:hidden",
          layout.inset
        )}
        variants={stagger}
      >
        {MARKETING_NAV.map((entry) => {
          if (entry.type === "link") {
            return (
              <m.div key={entry.href} variants={item}>
                <Link
                  className={TRIGGER_CLASSNAME}
                  to={entry.href}
                  onClick={onNavigate}
                >
                  {entry.label}
                </Link>
              </m.div>
            );
          }

          return (
            <m.div key={entry.label} variants={item}>
              <GroupDropdown
                group={entry}
                item={item}
                onOpenChange={(next) => setOpenGroup(next ? entry.label : null)}
                onSelect={onNavigate}
                open={openGroup === entry.label}
                stagger={stagger}
              />
            </m.div>
          );
        })}
      </m.nav>

      <m.div
        className={cn(
          "pointer-events-auto flex shrink-0 gap-3 bg-white pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] dark:bg-neutral-950",
          layout.inset
        )}
        variants={stagger}
      >
        <MobileAuthActions
          isAuthenticated={isAuthenticated}
          isResolved={isResolved}
          item={item}
          onNavigate={onNavigate}
        />
      </m.div>
    </m.div>
  );
}

function GroupDropdown({
  group,
  open,
  onOpenChange,
  onSelect,
  stagger,
  item,
}: NavbarMobileGroupProps) {
  return (
    <Collapsible onOpenChange={onOpenChange} open={open}>
      <CollapsibleTrigger className={TRIGGER_CLASSNAME}>
        {group.label}
        <NavbarChevron
          className="size-5 shrink-0 text-[#1E1E1E73] transition-transform duration-200 dark:text-white/50"
          flipped={open}
        />
      </CollapsibleTrigger>
      <CollapsibleContent
        className={cn(
          PANEL_CLASSNAME,
          group.layout === "compact" &&
            "duration-fast transition-opacity ease-out data-ending-style:pointer-events-none data-ending-style:opacity-0 motion-reduce:transition-none"
        )}
      >
        <GroupPanel
          group={group}
          item={item}
          onSelect={onSelect}
          stagger={stagger}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

function GroupPanel({
  group,
  onSelect,
  stagger,
  item,
}: {
  group: MarketingNavGroup;
  onSelect: () => void;
  stagger: Variants;
  item: Variants;
}) {
  return (
    <m.div
      animate="visible"
      className="flex flex-col gap-1 pb-6"
      initial="hidden"
      variants={stagger}
    >
      {[...group.cards, ...group.rail].map((entry) => (
        <m.div key={entry.href} variants={item}>
          <MobileNavRow entry={entry} onSelect={onSelect} />
        </m.div>
      ))}
    </m.div>
  );
}

function MobileNavRow({
  entry,
  onSelect,
}: {
  entry: MarketingNavRailItem;
  onSelect: () => void;
}) {
  return (
    <NavbarHref
      className={ROW_CLASSNAME}
      external={entry.external}
      href={entry.href}
      onClick={onSelect}
    >
      <span className="font-sans text-[1.0625rem] leading-[1.375rem] font-medium tracking-[-0.015em] text-[#1E1E1E] dark:text-white">
        {entry.label}
      </span>
      {entry.description ? (
        <span className="font-sans text-sm leading-5 font-medium text-pretty text-[#1E1E1EA6] dark:text-white/50">
          {entry.description}
        </span>
      ) : null}
    </NavbarHref>
  );
}

function MobileAuthActions({
  isAuthenticated,
  isResolved,
  onNavigate,
  item,
}: NavbarAuthActionsProps & { onNavigate: () => void; item: Variants }) {
  if (!isResolved) {
    return null;
  }

  if (isAuthenticated) {
    return (
      <m.div className="flex-1" variants={item}>
        <a
          className={MENU_FOOTER_PRIMARY_CLASSNAME}
          href={AUTH_DASHBOARD_URL}
          onClick={onNavigate}
        >
          Dashboard
        </a>
      </m.div>
    );
  }

  return (
    <>
      <m.div className="flex-1" variants={item}>
        <a
          className={MENU_FOOTER_SECONDARY_CLASSNAME}
          href={AUTH_SIGNIN_URL}
          onClick={onNavigate}
        >
          Sign In
        </a>
      </m.div>
      <m.div className="flex-1" variants={item}>
        <TrackedSignupLink
          className={MENU_FOOTER_PRIMARY_CLASSNAME}
          onClick={onNavigate}
          source={NAVBAR_MOBILE_SIGNUP_SOURCE}
        >
          Sign Up
        </TrackedSignupLink>
      </m.div>
    </>
  );
}
