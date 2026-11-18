import type { Messages } from "use-intl";

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  defaultOpen: boolean;
};

export type FaqContent = {
  heading: string;
  subcopy: string;
  items: FaqItem[];
};

export type FaqSectionProps = {
  content?: FaqContent;
  className?: string;
};

export type LandingFaqItem = {
  id: Extract<keyof Messages["landing"]["faq"]["items"], string>;
  defaultOpen: boolean;
};
