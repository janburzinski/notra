import type { SVGProps } from "react";

function IconBase({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
      width="24"
      {...props}
    >
      {children}
    </svg>
  );
}

export function TrackingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </IconBase>
  );
}

export function TrafficIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </IconBase>
  );
}

export function FeedbackIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M4 5h16v11H9l-5 4z" />
      <path d="M8 9.5h8M8 12.5h5" />
    </IconBase>
  );
}

export function ImagesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect height="18" rx="3" width="18" x="3" y="3" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M4 16.5l4.5-4.5a2 2 0 0 1 2.8 0L20 20.5" />
    </IconBase>
  );
}

export function ContentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </IconBase>
  );
}

export function SocialIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M20 11.5a7.5 7.5 0 0 1-10.8 6.75L4 20l1.75-4.2A7.5 7.5 0 1 1 20 11.5z" />
    </IconBase>
  );
}

export function ProjectsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect height="7" rx="1.5" width="7" x="3" y="3" />
      <rect height="7" rx="1.5" width="7" x="14" y="3" />
      <rect height="7" rx="1.5" width="7" x="3" y="14" />
      <rect height="7" rx="1.5" width="7" x="14" y="14" />
    </IconBase>
  );
}

export function ReferencesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M8 7C8 7 16.75 7 16.75 7C18.86 7 19.91 7 20.67 7.51C20.99 7.72 21.28 8.01 21.49 8.33C21.98 9.06 22 10.06 22 12M2 21C2 21 2 7.94 2 7.94C2 6.13 2 5.22 2.38 4.54C2.65 4.05 3.05 3.65 3.54 3.38C4.22 3 5.13 3 6.94 3C8.11 3 8.69 3 9.2 3.19C10.36 3.63 10.84 4.68 11.37 5.73C11.37 5.73 12 7 12 7" />
      <path d="M22 15C22 15 15 15 15 15M22 18C22 18 15 18 15 18M17.5 21C17.5 21 15 21 15 21" />
      <path d="M10.71 20C10.71 20 11.37 15.95 10.71 15.29C10.05 14.63 6 15.29 6 15.29M5 21C5 21 10 16 10 16" />
    </IconBase>
  );
}

export function RetentionIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M10 5C10 5 21 5 21 5" />
      <path d="M3 5C3 5 5.5 5 5.5 5" />
      <path d="M10 12C10 12 21 12 21 12" />
      <path d="M3 12C3 12 5.5 12 5.5 12" />
      <path d="M10 19C10 19 21 19 21 19" />
      <path d="M3 19C3 19 5.5 19 5.5 19" />
    </IconBase>
  );
}

export function SupportIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M17 10.8C17 10.46 17 10.29 17.05 10.13C17.2 9.68 17.6 9.51 18 9.33C18.45 9.12 18.67 9.02 18.9 9C19.15 8.98 19.4 9.04 19.62 9.16C19.9 9.32 20.1 9.62 20.31 9.87C21.25 11.02 21.72 11.59 21.9 12.22C22.04 12.73 22.04 13.27 21.9 13.78C21.64 14.7 20.85 15.47 20.26 16.18C19.96 16.55 19.81 16.73 19.62 16.84C19.4 16.96 19.15 17.02 18.9 17C18.67 16.98 18.45 16.88 18 16.67C17.6 16.49 17.2 16.32 17.05 15.87C17 15.71 17 15.54 17 15.2C17 15.2 17 10.8 17 10.8Z" />
      <path d="M7 10.8C7 10.37 6.99 9.98 6.64 9.67C6.51 9.56 6.34 9.48 6 9.33C5.55 9.12 5.33 9.02 5.1 9C4.44 8.95 4.08 9.41 3.69 9.87C2.75 11.02 2.28 11.59 2.1 12.22C1.97 12.73 1.97 13.27 2.1 13.78C2.36 14.7 3.15 15.47 3.74 16.19C4.11 16.64 4.47 17.05 5.1 17C5.33 16.98 5.55 16.88 6 16.67C6.34 16.52 6.51 16.44 6.64 16.33C6.99 16.02 7 15.63 7 15.2C7 15.2 7 10.8 7 10.8Z" />
      <path d="M5 9C5 5.69 8.13 3 12 3C15.87 3 19 5.69 19 9" />
      <path d="M19 17C19 17 19 17.8 19 17.8C19 19.57 17.21 21 15 21C15 21 13 21 13 21" />
    </IconBase>
  );
}

export function AutopilotIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v4h-4" />
      <path d="M10.5 9.5v5l4-2.5z" />
    </IconBase>
  );
}

export function PricingGiftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      viewBox="0 0 16 16"
      width="16"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M8.400 0.000C8.821 -0.000 9.235 0.111 9.600 0.322C9.965 0.532 10.268 0.835 10.479 1.200C10.690 1.565 10.800 1.979 10.800 2.400C10.800 2.822 10.689 3.236 10.478 3.601C10.478 3.601 13.200 3.600 13.200 3.600C13.200 3.600 13.200 4.800 13.200 4.800C13.200 4.800 12.000 4.800 12.000 4.800C12.000 4.800 12.000 10.800 12.000 10.800C12.000 10.959 11.937 11.112 11.824 11.224C11.712 11.337 11.559 11.400 11.400 11.400C11.400 11.400 1.800 11.400 1.800 11.400C1.641 11.400 1.488 11.337 1.376 11.224C1.263 11.112 1.200 10.959 1.200 10.800C1.200 10.800 1.200 4.800 1.200 4.800C1.200 4.800 0.000 4.800 0.000 4.800C0.000 4.800 0.000 3.600 0.000 3.600C0.000 3.600 2.722 3.601 2.722 3.601C2.424 3.085 2.328 2.477 2.454 1.896C2.579 1.314 2.916 0.799 3.399 0.452C3.883 0.104 4.478 -0.051 5.069 0.016C5.661 0.082 6.206 0.367 6.600 0.813C6.825 0.557 7.102 0.352 7.412 0.212C7.723 0.072 8.059 -0.001 8.400 0.000C8.400 0.000 8.400 0.000 8.400 0.000ZM7.200 4.800C7.200 4.800 6.000 4.800 6.000 4.800C6.000 4.800 6.000 10.800 6.000 10.800C6.000 10.800 7.200 10.800 7.200 10.800C7.200 10.800 7.200 4.800 7.200 4.800ZM4.800 1.200C4.489 1.199 4.189 1.318 3.964 1.534C3.739 1.749 3.607 2.044 3.595 2.355C3.584 2.666 3.694 2.970 3.901 3.201C4.109 3.433 4.399 3.575 4.710 3.597C4.710 3.597 4.800 3.600 4.800 3.600C4.800 3.600 6.000 3.600 6.000 3.600C6.000 3.600 6.000 2.400 6.000 2.400C6.000 2.113 5.897 1.836 5.711 1.618C5.524 1.401 5.265 1.257 4.982 1.214C4.982 1.214 4.889 1.203 4.889 1.203C4.889 1.203 4.800 1.200 4.800 1.200ZM8.400 1.200C8.097 1.200 7.806 1.314 7.584 1.520C7.362 1.726 7.226 2.008 7.203 2.310C7.203 2.310 7.200 2.400 7.200 2.400C7.200 2.400 7.200 3.600 7.200 3.600C7.200 3.600 8.400 3.600 8.400 3.600C8.703 3.600 8.994 3.486 9.216 3.280C9.438 3.074 9.574 2.792 9.597 2.490C9.597 2.490 9.600 2.400 9.600 2.400C9.600 2.082 9.474 1.777 9.249 1.551C9.023 1.326 8.718 1.200 8.400 1.200C8.400 1.200 8.400 1.200 8.400 1.200Z"
        fill="currentColor"
        fillRule="nonzero"
        transform="translate(1.4 2)"
      />
    </svg>
  );
}
