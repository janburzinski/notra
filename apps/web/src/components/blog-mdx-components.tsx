import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { MDXComponents } from "mdx/types";
import type { ComponentProps } from "react";

import { MdxLink } from "@/components/mdx-link";
import { getMDXComponents } from "@/mdx-components";
import { getLogoLinkUrl } from "@/utils/outbound-link";

function BlogLink({ children, ...props }: ComponentProps<"a">) {
  const logoUrl = getLogoLinkUrl(props.href);
  return (
    <MdxLink {...props}>
      {logoUrl ? (
        <img
          alt=""
          aria-hidden
          className="not-prose mr-1 inline-block size-[0.95em] rounded-xs object-contain align-[-0.125em]"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
          src={logoUrl}
        />
      ) : null}
      {children}
    </MdxLink>
  );
}

export function getBlogMDXComponents(): MDXComponents {
  const components = getMDXComponents({
    pre: ({ children, ...props }) => (
      <div className="code-block">
        <button
          aria-label="Copy code"
          className="code-copy-button"
          data-copy-code
          type="button"
        >
          <HugeiconsIcon className="code-copy-icon" icon={Copy01Icon} />
          <HugeiconsIcon className="code-copy-icon-success" icon={Tick02Icon} />
        </button>
        <pre {...props}>{children}</pre>
      </div>
    ),
  });
  return { ...components, a: BlogLink };
}
