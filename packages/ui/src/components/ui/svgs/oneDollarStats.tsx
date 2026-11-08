import type { SVGProps } from "react";

const OneDollarStats = (props: SVGProps<SVGSVGElement>) => (
  <svg
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeWidth="2.5"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    {...props}
  >
    <title>OneDollarStats</title>
    <path d="M12 2v20" />
    <path d="M17 6.5c-.8-1.2-2.6-2-5-2-2.9 0-5 1.4-5 3.6 0 5 10 2.6 10 7.8 0 2.2-2.1 3.6-5 3.6-2.6 0-4.5-.9-5.3-2.3" />
  </svg>
);

export { OneDollarStats };
