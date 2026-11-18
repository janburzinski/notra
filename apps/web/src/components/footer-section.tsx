import { cn } from "@notra/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { ConsentDialogLink } from "c15t/tanstack-start/components/consent-dialog-link";
import { useTranslations } from "use-intl";

import { DeferredDithering } from "@/components/deferred-dithering";
import { GlitterWordmark } from "@/components/landing/glitter-wordmark";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  FOOTER_DITHERING,
  FOOTER_LEGAL_LINKS,
  FOOTER_LINK_COLUMNS,
  FOOTER_SOCIAL_LINKS,
} from "@/constants/landing/footer";
import { useGlitterEgg } from "@/hooks/use-glitter-egg";
import type { FooterLink } from "@/types/landing/footer";
import { isProxiedPath } from "@/utils/proxied-paths";

import { NotraMark } from "./notra-mark";

const LINK_CLASS =
  "font-medium font-sans text-[#1e1e1ebf] text-base leading-6 tracking-[-0.01em] transition-colors hover:text-[#5b21b6] dark:text-foreground/60 dark:hover:text-[#a78bfa]";

function FooterColumnLink({ link }: { link: FooterLink }) {
  const t = useTranslations("footer.links");
  if (!link.href) {
    return (
      <span
        className={cn(
          "dark:text-foreground/60 font-sans text-base leading-6 font-medium tracking-[-0.01em] text-[#1e1e1ebf]"
        )}
      >
        {t(link.id)}
      </span>
    );
  }

  return (
    <Link
      className={LINK_CLASS}
      to={link.href}
      reloadDocument={isProxiedPath(link.href)}
      rel={link.external ? "noopener noreferrer" : undefined}
      target={link.external ? "_blank" : undefined}
    >
      {t(link.id)}
    </Link>
  );
}

export function FooterDither() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <DeferredDithering
        className="absolute top-[8.8125rem] left-[-5.40625rem] h-[66.125rem] min-h-[calc(100%-8.8125rem)] w-[calc(100%+10.8125rem)] min-w-[100.8125rem]"
        colorBack={FOOTER_DITHERING.colorBack}
        colorFront={FOOTER_DITHERING.colorFront}
        scale={FOOTER_DITHERING.scale}
        shape={FOOTER_DITHERING.shape}
        size={FOOTER_DITHERING.size}
        speed={FOOTER_DITHERING.speed}
        type={FOOTER_DITHERING.type}
      />
    </div>
  );
}

export default function FooterSection() {
  const year = new Date().getFullYear();
  const glitter = useGlitterEgg();
  const t = useTranslations("footer");

  return (
    <footer className="relative isolate overflow-hidden rounded-t-3xl bg-[linear-gradient(in_oklab_180deg,oklab(80.3%_0.045_-0.074/15%)_0%,oklab(71.8%_0.066_-0.109/50%)_100%)] pt-6 shadow-[0_0.0625rem_0.125rem_#28282814,0_0_0_0.0625rem_#ececec] dark:bg-[#141019] dark:bg-none dark:shadow-none">
      <FooterDither />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 flex justify-center overflow-hidden">
        <img
          decoding="async"
          loading="lazy"
          alt=""
          aria-hidden="true"
          className={cn(
            "h-auto w-[121.4%] max-w-[126rem] min-w-[60rem] translate-y-[23%] transition-[opacity,filter] duration-500 ease-out motion-reduce:transition-none dark:opacity-40",
            glitter.active &&
              "opacity-0 blur-md motion-reduce:blur-none dark:opacity-0"
          )}
          height={536}
          src="/marketing/landing/footer-wordmark.svg"
          width={1748}
        />
        {glitter.active ? (
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-[87rem] px-6 md:px-8">
            <GlitterWordmark active />
          </div>
        ) : null}
      </div>

      <div className="relative mx-auto flex w-full max-w-[87rem] flex-col px-6 pb-64 md:px-8 md:pb-[30rem]">
        <div className="flex flex-col gap-12 py-7 lg:flex-row lg:items-start lg:justify-between lg:gap-24">
          <div className="flex w-full max-w-[18.5rem] flex-col gap-7">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Notra"
                  onClick={glitter.onMarkClick}
                  className="flex size-10 items-center justify-center rounded-lg select-none dark:bg-[#F6F3F1] dark:shadow-sm dark:ring-1 dark:inset-shadow-sm dark:shadow-black/40 dark:ring-white/10 dark:inset-shadow-white/8"
                >
                  <NotraMark className="pointer-events-none size-7 shrink-0" />
                </button>
                <span className="font-display text-foreground text-lg leading-[1.14] font-semibold tracking-[-0.015em]">
                  Notra
                </span>
              </div>
              <p className="dark:text-foreground/70 font-sans text-base leading-6 font-medium tracking-[-0.01em] text-[#1e1e1ebf]">
                {t("tagline")}
              </p>
            </div>

            <div className="flex items-center gap-4">
              {FOOTER_SOCIAL_LINKS.map((social) => (
                <Link
                  aria-label={t("socialLabel", { network: social.label })}
                  className="dark:text-foreground/50 dark:hover:text-foreground text-[#1e1e1e80] transition-colors hover:text-[#1e1e1e]"
                  to={social.href}
                  key={social.label}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <social.Icon className="size-5 [&_path.fill-foreground]:fill-current" />
                </Link>
              ))}
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {FOOTER_LEGAL_LINKS.map((link) => (
                  <Link
                    className="dark:text-foreground/50 dark:hover:text-foreground font-sans text-[0.8125rem] leading-[1.125rem] font-medium text-[#1e1e1ea6] transition-colors hover:text-[#1e1e1e]"
                    to={link.href ?? "/"}
                    key={link.id}
                  >
                    {t(`links.${link.id}`)}
                  </Link>
                ))}
                <ConsentDialogLink
                  slotKey="trigger.text"
                  className="dark:text-foreground/50 dark:hover:text-foreground font-sans text-[0.8125rem] leading-[1.125rem] font-medium text-[#1e1e1ea6] transition-colors hover:text-[#1e1e1e]"
                >
                  {t("privacySettings")}
                </ConsentDialogLink>
              </div>
              <p className="dark:text-foreground/50 font-sans text-[0.8125rem] leading-[1.125rem] font-medium text-[#1e1e1ea6]">
                {t("copyright", { year })}
              </p>
              <LanguageSwitcher />
            </div>
          </div>

          <div className="grid w-full grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:w-auto lg:flex-1 lg:justify-items-end">
            {FOOTER_LINK_COLUMNS.map((column) => (
              <div className="flex flex-col gap-8" key={column.groups[0]?.id}>
                {column.groups.map((group) => (
                  <div className="flex flex-col gap-4" key={group.id}>
                    <h3 className="font-sans text-base leading-6 font-medium tracking-[-0.01em] text-[#5b21b6] dark:text-[#a78bfa]">
                      {t(`groups.${group.id}`)}
                    </h3>
                    <ul className="flex flex-col gap-4.5">
                      {group.links.map((link) => (
                        <li key={link.id}>
                          <FooterColumnLink link={link} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
