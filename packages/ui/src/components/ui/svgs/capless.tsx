import type { SVGProps } from "react";

const Capless = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="4 4 26 24" {...props}>
    <title>Capless</title>
    <path
      className="stroke-foreground"
      d="M19.63 8.05A9 9 0 1 0 22.29 21.79"
      fill="none"
      strokeWidth="4.2"
      strokeLinecap="round"
    />
    <circle cx="25.08" cy="11.69" r="2.6" fill="#4fd1c5" />
  </svg>
);

export { Capless };
