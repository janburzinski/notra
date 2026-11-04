// Diagrams for blog posts, ported from the old usenotra.com blog. Snippets may only import from "react",
// so the shared primitives and every diagram live in this one file. script.js starts the flow
// animations once a diagram (data-diagram) scrolls into view.
const cn = (...classes) => classes.filter(Boolean).join(" ");

const LogoSvg = ({ className, viewBox, children }) => (
  <svg
    aria-hidden="true"
    className={cn("size-3.5 shrink-0", className)}
    fill="currentColor"
    viewBox={viewBox}
    xmlns="http://www.w3.org/2000/svg"
  >
    {children}
  </svg>
);

export const VercelLogo = ({ className }) => (
  <LogoSvg className={className} viewBox="0 0 256 222">
    <path d="m128 0 128 221.705H0z" />
  </LogoSvg>
);

export const RailwayLogo = ({ className }) => (
  <LogoSvg className={className} viewBox="0 0 1024 1024">
    <path d="M4.8 438.2A520.7 520.7 0 000 489.7h777.8c-2.7-5.3-6.4-10-10-14.7-133-171.8-204.5-157-306.9-161.3-34-1.4-57.2-2-193-2-72.7 0-151.7.2-228.6.4A621 621 0 0015 386.3h398.6v51.9H4.8zm779.1 103.5H.4c.8 13.8 2.1 27.5 4 41h723.4c32.2 0 50.3-18.3 56.1-41zM45 724.3s120 294.5 466.5 299.7c207 0 385-123 465.9-299.7H45z" />
    <path d="M511.5 0A512.2 512.2 0 0065.3 260.6l202.7-.2c158.4 0 164.2.6 195.2 2l19.1.6c66.7 2.3 148.7 9.4 213.2 58.2 35 26.5 85.6 85 115.7 126.5 27.9 38.5 35.9 82.8 17 125.2-17.5 39-55 62.2-100.4 62.2H16.7s4.2 18 10.6 37.8h970.6a510.4 510.4 0 0026.1-160.7A512.4 512.4 0 00511.5 0z" />
  </LogoSvg>
);

export const WorkOSLogo = ({ className }) => (
  <LogoSvg className={className} viewBox="0 0 55.4 48">
    <path d="M0 24c0 1.1.3 2.1.8 3l9.7 16.8c1 1.7 2.5 3.1 4.4 3.7 3.6 1.2 7.5-.3 9.4-3.5l2.3-4.1-9.2-16 9.8-16.9L29.5 3c.7-1.2 1.6-2.2 2.7-3H17.2c-2.6 0-5.1 1.4-6.4 3.7L.8 21c-.5.9-.8 1.9-.8 3" />
    <path d="M55.4 24c0-1.1-.3-2.1-.8-3l-9.8-17c-1.9-3.3-5.8-4.7-9.4-3.5-1.9.6-3.4 2-4.4 3.7L28.7 8 38 24l-9.8 16.9-2.3 4.1c-.7 1.2-1.6 2.2-2.7 3h15.1c2.6 0 5.1-1.4 6.4-3.7l10-17.3c.4-.9.7-1.9.7-3" />
  </LogoSvg>
);

export const TinybirdLogo = ({ className }) => (
  <LogoSvg className={className} viewBox="0 0 32 32">
    <path d="m7.948 32 14.415-9.413-8.808-3.33z" />
    <path d="m0 14.112 22.363 8.474 3.775-17.6z" />
    <path d="M32 2.93 22.077 0l-3.345 7.566z" />
  </LogoSvg>
);

export const GitHubLogo = ({ className }) => (
  <LogoSvg className={className} viewBox="0 0 1024 1024">
    <path
      clipRule="evenodd"
      fillRule="evenodd"
      d="M512 0C229.12 0 0 229.12 0 512c0 226.56 146.56 417.92 350.08 485.76 25.6 4.48 35.2-10.88 35.2-24.32 0-12.16-.64-52.48-.64-95.36-128.64 23.68-161.92-31.36-172.16-60.16-5.76-14.72-30.72-60.16-52.48-72.32-17.92-9.6-43.52-33.28-.64-33.92 40.32-.64 69.12 37.12 78.72 52.48 46.08 77.44 119.68 55.68 149.12 42.24 4.48-33.28 17.92-55.68 32.64-68.48-113.92-12.8-232.96-56.96-232.96-252.8 0-55.68 19.84-101.76 52.48-137.6-5.12-12.8-23.04-65.28 5.12-135.68 0 0 42.88-13.44 140.8 52.48 40.96-11.52 84.48-17.28 128-17.28s87.04 5.76 128 17.28c97.92-66.56 140.8-52.48 140.8-52.48 28.16 70.4 10.24 122.88 5.12 135.68 32.64 35.84 52.48 81.28 52.48 137.6 0 196.48-119.68 240-233.6 252.8 18.56 16 34.56 46.72 34.56 94.72 0 68.48-.64 123.52-.64 140.8 0 13.44 9.6 29.44 35.2 24.32C877.44 929.92 1024 737.92 1024 512 1024 229.12 794.88 0 512 0"
    />
  </LogoSvg>
);

const BRAND_LOGOS = {
  GitHub: GitHubLogo,
  Railway: RailwayLogo,
  Tinybird: TinybirdLogo,
  WorkOS: WorkOSLogo,
};

export const Brand = ({ name, children }) => {
  const Logo = BRAND_LOGOS[name];
  return (
    <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
      <Logo className="size-[0.9em] translate-y-[0.1em]" />
      {children ?? name}
    </span>
  );
};

const Diagram = ({ label, caption, children }) => (
  <figure className="not-prose my-10 font-mono text-sm" data-diagram>
    {label ? (
      <div className="text-muted-foreground mb-4 text-xs tracking-widest uppercase">
        {label}
      </div>
    ) : null}
    {children}
    {caption ? (
      <figcaption className="text-muted-foreground mt-5 text-center font-sans text-sm">
        {caption}
      </figcaption>
    ) : null}
  </figure>
);

const StepSquare = ({ children }) => (
  <span className="border-primary/40 bg-primary/10 text-primary grid size-5 shrink-0 place-items-center rounded-sm border text-xs">
    {children}
  </span>
);

const StepCircle = ({ children, accent }) => (
  <span
    className={cn(
      "grid size-5 shrink-0 place-items-center rounded-full border text-xs",
      accent
        ? "border-primary/60 text-primary"
        : "border-muted-foreground/50 text-muted-foreground"
    )}
  >
    {children}
  </span>
);

const FLOW_TARGET = {
  down: "translateY(100%)",
  right: "translateX(100%)",
  left: "translateX(-100%)",
};

const FlowDot = ({
  axis = "down",
  delay = 0,
  accent = true,
  short = false,
  linear = false,
}) => (
  <span
    aria-hidden="true"
    className={cn(
      "pointer-events-none absolute motion-reduce:hidden",
      short ? "diagram-flow-travel-short" : "diagram-flow-travel",
      linear && "diagram-flow-linear",
      axis === "down" ? "inset-x-0 top-0 h-full" : "inset-y-0 w-full",
      axis === "left" && "right-0",
      axis === "right" && "left-0"
    )}
    style={{ "--flow-delay": delay, "--flow-target": FLOW_TARGET[axis] }}
  >
    <span
      className={cn(
        "absolute size-1.5",
        axis === "down" && "top-0 left-1/2 -translate-1/2",
        axis === "right" && "top-1/2 left-0 -translate-1/2",
        axis === "left" && "top-1/2 right-0 translate-x-1/2 -translate-y-1/2",
        accent ? "text-primary" : "text-foreground"
      )}
    >
      <span
        className={cn(
          "absolute from-transparent to-current",
          axis === "down"
            ? "bottom-1/2 left-1/2 h-4 w-px -translate-x-1/2 bg-linear-to-b"
            : "top-1/2 h-px w-4 -translate-y-1/2",
          axis === "right" && "right-1/2 bg-linear-to-r",
          axis === "left" && "left-1/2 bg-linear-to-l"
        )}
      />
      <span className="absolute inset-0 rounded-xs bg-current" />
    </span>
  </span>
);

const FlowScan = ({ delay, accent }) => (
  <span
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden"
  >
    <span
      className={cn(
        "diagram-flow-scan absolute inset-0 border-b bg-linear-to-b from-transparent",
        accent
          ? "border-primary/70 to-primary/10"
          : "border-foreground/30 to-foreground/[0.05]"
      )}
      style={{ "--flow-delay": delay }}
    />
  </span>
);

const Panel = ({
  title,
  aside,
  step,
  accent = false,
  scan,
  className,
  children,
}) => (
  <div
    className={cn(
      "bg-card relative overflow-hidden rounded-xl border",
      accent ? "border-primary/50 bg-primary/[0.04]" : "border-border",
      className
    )}
  >
    {title ? (
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3",
          children && "border-b",
          accent ? "border-primary/30" : "border-border"
        )}
      >
        {step === undefined ? null : <StepSquare>{step}</StepSquare>}
        <span className="text-foreground min-w-0 flex-1 truncate">{title}</span>
        {aside ? (
          <span
            className={cn(
              "shrink-0",
              accent ? "text-primary" : "text-muted-foreground"
            )}
          >
            {aside}
          </span>
        ) : null}
      </div>
    ) : null}
    {children ? <div className="px-4 py-3">{children}</div> : null}
    {scan === undefined ? null : <FlowScan accent={accent} delay={scan} />}
  </div>
);

const Row = ({ k, v, accent = false, muted = false }) => (
  <div
    className={cn(
      "flex items-center justify-between gap-4 py-1.5",
      muted && "opacity-50"
    )}
  >
    <span className="text-muted-foreground">{k}</span>
    <span
      className={cn("text-right", accent ? "text-primary" : "text-foreground")}
    >
      {v}
    </span>
  </div>
);

const ArrowHead = ({ accent }) => (
  <svg
    aria-hidden="true"
    className={cn(
      "-mt-px shrink-0",
      accent ? "text-primary" : "text-muted-foreground/60"
    )}
    height="6"
    viewBox="0 0 10 6"
    width="10"
  >
    <path d="M0 0 L5 6 L10 0 Z" fill="currentColor" />
  </svg>
);

const Connector = ({
  step,
  label,
  dashed = false,
  accent = !dashed,
  flowDelay,
  className,
}) => (
  <div className={cn("flex h-14 items-stretch gap-4 pl-8", className)}>
    <div className="relative flex w-px flex-col items-center">
      <span
        className={cn(
          "w-0 flex-1 border-l",
          dashed && "border-dashed",
          accent ? "border-primary" : "border-muted-foreground/60"
        )}
      />
      <ArrowHead accent={accent} />
      {flowDelay === undefined ? null : (
        <span className="absolute inset-x-0 top-0 bottom-1.5">
          <FlowDot accent={accent} delay={flowDelay} />
        </span>
      )}
    </div>
    {label ? (
      <div className="flex items-center gap-2.5">
        {step === undefined ? null : (
          <StepCircle accent={accent}>{step}</StepCircle>
        )}
        <span className={accent ? "text-primary" : "text-muted-foreground"}>
          {label}
        </span>
      </div>
    ) : null}
  </div>
);

const Legend = ({ children }) => (
  <div className="text-muted-foreground mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
    {children}
  </div>
);

const WithLogo = ({ Logo, children }) => (
  <span className="inline-flex items-center gap-2">
    {Logo ? <Logo /> : null}
    {children}
  </span>
);

const SWAPS = [
  { name: "Login", prod: "WorkOS", demo: "signed cookie", Logo: WorkOSLogo },
  { name: "Models", prod: "AI providers", demo: "fake model" },
  {
    name: "Analytics",
    prod: "Tinybird",
    demo: "generated",
    Logo: TinybirdLogo,
  },
  {
    name: "Repos",
    prod: "GitHub App",
    demo: "fictional repo",
    Logo: GitHubLogo,
  },
];

export const DemoDeploymentsDiagram = () => (
  <Diagram caption="Both deployments run the same code. The demo swaps the service behind each choke point.">
    <div className="flex flex-col items-center">
      <Panel
        aside="dashboard + api"
        className="w-full sm:w-80"
        scan={0}
        title="main"
      />
      <div className="hidden w-full sm:block">
        <div className="bg-border relative mx-auto h-5 w-px">
          <FlowDot accent={false} delay={0.11} short />
        </div>
        <div className="mx-auto flex h-5 w-[calc(50%+0.5rem)]">
          <span className="border-border relative flex-1 border-t border-l">
            <span className="absolute inset-x-0 -top-px h-px">
              <FlowDot accent={false} axis="left" delay={0.16} linear />
            </span>
            <span className="absolute inset-y-0 -left-px w-px">
              <FlowDot accent={false} delay={0.28} short />
            </span>
          </span>
          <span className="border-primary relative flex-1 border-r">
            <span className="from-border to-primary absolute inset-x-0 top-0 h-px bg-linear-to-r to-60%" />
            <span className="absolute inset-x-0 top-0 h-px">
              <FlowDot axis="right" delay={0.16} linear />
            </span>
            <span className="absolute inset-y-0 -right-px w-px">
              <FlowDot delay={0.28} short />
            </span>
          </span>
        </div>
      </div>
      <div className="mt-4 grid w-full gap-4 sm:mt-0 sm:grid-cols-2">
        <Panel aside="usenotra.com" scan={0.33} title="production">
          <Row k="Hosting" v={<WithLogo Logo={VercelLogo}>Vercel</WithLogo>} />
          {SWAPS.map((swap) => (
            <Row
              k={swap.name}
              key={swap.name}
              v={<WithLogo Logo={swap.Logo}>{swap.prod}</WithLogo>}
            />
          ))}
        </Panel>
        <Panel accent aside="demo.usenotra.com" scan={0.33} title="demo">
          <Row
            accent
            k="Hosting"
            v={<WithLogo Logo={RailwayLogo}>Railway</WithLogo>}
          />
          {SWAPS.map((swap) => (
            <Row accent k={swap.name} key={swap.name} v={swap.demo} />
          ))}
        </Panel>
      </div>
    </div>
  </Diagram>
);

export const DemoCookieDiagram = () => (
  <Diagram
    caption="Anyone can read the payload, but only the server can produce a valid signature for it."
    label="The notra_demo cookie"
  >
    <div className="border-border flex overflow-hidden rounded-xl border text-base">
      <span className="bg-card text-foreground min-w-0 flex-[1.4] truncate px-4 py-4">
        eyJhbm9ueW1vdXNJZCI6…
      </span>
      <span className="border-border bg-muted text-muted-foreground border-x px-3 py-4">
        .
      </span>
      <span className="bg-primary/10 text-primary min-w-0 flex-1 truncate px-4 py-4">
        Qm9xT1h3c2Vk…
      </span>
    </div>
    <div className="mt-4 grid gap-4 sm:grid-cols-[1.4fr_1fr]">
      <Panel aside="public" title="payload">
        <Row k="anonymousId" v="anon_k3J9…" />
        <Row k="encoding" v="base64url JSON" />
        <Row k="visible in" v="UI, API key metadata" />
      </Panel>
      <Panel accent aside="grants access" title="signature">
        <Row accent k="algorithm" v="HMAC-SHA256" />
        <Row accent k="check" v="timingSafeEqual" />
      </Panel>
    </div>
  </Diagram>
);

const POOL_ROWS = [
  { id: "anon_k3J9…", note: "was pool_7Hc… · yours", state: "claimed" },
  { id: "pool_Q2mA…", note: "ready", state: "ready" },
  { id: "pool_x81L…", note: "ready", state: "ready" },
  { id: "pool_n4Tb…", note: "seeding", state: "refill" },
];

export const DemoPoolDiagram = () => (
  <Diagram
    caption="Your first request claims a sandbox that was seeded earlier, which takes about 0.4 seconds."
    label="A first visit"
  >
    <Panel aside="no cookie" scan={0} title="GET /api/demo/enter" />
    <Connector
      flowDelay={0.11}
      label="claim · FOR UPDATE SKIP LOCKED"
      step={1}
    />
    <Panel accent aside="pool" scan={0.23} title="demo_sandboxes">
      {POOL_ROWS.map((row) => (
        <div
          className={cn(
            "my-1 flex items-center justify-between gap-4 rounded-md border px-3 py-2",
            row.state === "claimed"
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-border text-foreground",
            row.state === "refill" && "text-muted-foreground border-dashed"
          )}
          key={row.id}
        >
          <span>{row.id}</span>
          <span
            className={
              row.state === "claimed" ? "text-primary" : "text-muted-foreground"
            }
          >
            {row.note}
          </span>
        </div>
      ))}
    </Panel>
    <Connector flowDelay={0.34} label="307 + signed cookie" step={2} />
    <Panel aside="your workspace" scan={0.46} title="/demo-xxxx/geo" />
    <Legend>
      <span className="flex items-center gap-2">
        <span className="border-muted-foreground/60 size-3 rounded-sm border border-dashed" />
        refilled after the response, one refill at a time
      </span>
    </Legend>
  </Diagram>
);

const TIMELINE_DAYS = 14;

const TIMELINE_ROWS = [
  {
    label: "Monday",
    seeded: [1, 2, 4, 6, 8],
    yours: 10,
    scheduled: 12,
    now: 10,
  },
  {
    label: "Tuesday",
    seeded: [2, 3, 5, 7, 9],
    yours: 10,
    scheduled: 13,
    now: 11,
  },
];

const TimelineCell = ({ row, day }) => {
  const isSeeded = row.seeded.includes(day);
  const isYours = row.yours === day;
  const isScheduled = row.scheduled === day;
  return (
    <span
      className={cn(
        "h-10 rounded-xs sm:h-12",
        isSeeded && "bg-primary",
        isYours && "bg-foreground",
        isScheduled && "border-primary border-2",
        !(isSeeded || isYours || isScheduled) &&
          "border-border border border-dashed"
      )}
    />
  );
};

export const DemoRebaseDiagram = () => (
  <Diagram
    caption="On a new day, seeded events and scheduled posts move forward by the time since the anchor, and your own post keeps its timestamp."
    label="Rebase on a new local day"
  >
    <div className="space-y-8">
      {TIMELINE_ROWS.map((row) => (
        <div
          className="grid gap-3 sm:grid-cols-[7rem_1fr] sm:items-end"
          key={row.label}
        >
          <span className="text-foreground sm:pb-3">{row.label}</span>
          <div
            className="relative"
            style={{ "--now": `${(row.now / TIMELINE_DAYS) * 100}%` }}
          >
            <div className="text-foreground absolute -top-6 left-(--now) pl-2 text-xs whitespace-nowrap">
              now
            </div>
            <div className="bg-foreground absolute -top-1 -bottom-1 left-[calc(var(--now)+1px)] w-px" />
            <div className="grid grid-cols-14 gap-1">
              {Array.from({ length: TIMELINE_DAYS }, (_, index) => (
                <TimelineCell day={index + 1} key={index} row={row} />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
    <Legend>
      <span className="flex items-center gap-2">
        <span className="bg-primary size-3 rounded-sm" />
        seeded event
      </span>
      <span className="flex items-center gap-2">
        <span className="bg-foreground size-3 rounded-sm" />
        your post
      </span>
      <span className="flex items-center gap-2">
        <span className="border-primary size-3 rounded-sm border-2" />
        scheduled post
      </span>
      <span className="opacity-60">1 cell = 1 day</span>
    </Legend>
  </Diagram>
);

const FEED = [
  {
    method: "POST",
    path: "/v1/posts",
    status: 201,
    source: "API",
    when: "now",
  },
  {
    method: "GET",
    path: "/v1/posts",
    status: 200,
    source: "Console",
    when: "2m",
  },
  {
    method: "PATCH",
    path: "/v1/posts/…",
    status: 200,
    source: "UI",
    when: "5m",
  },
];

export const DemoApiFlowDiagram = () => (
  <Diagram
    caption="A post created with curl appears in the open dashboard, together with the request that created it."
    label="One request, live in the dashboard"
  >
    <Panel aside="your terminal" scan={0} title="curl" />
    <Connector
      flowDelay={0.11}
      label="POST /v1/posts · Bearer notra_demo_…"
      step={1}
    />
    <Panel aside="apps/api" scan={0.23} title="demo-api.usenotra.com">
      <Row k="key" v="Unkey, separate workspace" />
      <Row k="limit" v="60 req/min" />
      <Row k="writes" v="post + demo_request_log" />
    </Panel>
    <Connector
      flowDelay={0.34}
      label="Upstash Realtime · demo:<orgId>"
      step={2}
    />
    <Panel accent aside="live" scan={0.46} title="Dashboard · API feed">
      {FEED.map((entry, index) => (
        <div
          className={cn(
            "grid grid-cols-[3.5rem_1fr_auto] items-baseline gap-3 py-1.5",
            index === 0 ? "text-primary" : "text-muted-foreground"
          )}
          key={`${entry.method}-${entry.path}-${entry.when}`}
        >
          <span>{entry.method}</span>
          <span className={index === 0 ? "text-primary" : "text-foreground"}>
            {entry.path}
          </span>
          <span>
            {entry.status} · {entry.source} · {entry.when}
          </span>
        </div>
      ))}
    </Panel>
  </Diagram>
);

// "Introducing Notra Sites"

export const C15tLogo = ({ className }) => (
  <LogoSvg className={className} viewBox="0 0 148.3 149.8">
    <path
      clipRule="evenodd"
      d="M74.133 14.042c-5.58 0-10.105 4.524-10.105 10.104 0 5.581 4.524 10.105 10.105 10.105 5.58 0 10.105-4.524 10.105-10.105 0-5.58-4.524-10.104-10.105-10.104ZM50.556 24.146C50.556 11.125 61.112.57 74.133.57 87.154.57 97.71 11.125 97.71 24.146c0 13.022-10.556 23.578-23.577 23.578-4.06 0-7.88-1.027-11.216-2.834L44.354 63.453a23.424 23.424 0 0 1 1.858 4.48h55.843c2.899-9.74 11.921-16.841 22.601-16.841 13.022 0 23.578 10.556 23.578 23.577 0 13.022-10.556 23.578-23.578 23.578-10.68 0-19.702-7.102-22.601-16.841H46.211a23.455 23.455 0 0 1-2.628 5.798l18.015 18.015a23.473 23.473 0 0 1 12.535-3.604c13.021 0 23.577 10.556 23.577 23.577 0 13.022-10.556 23.577-23.577 23.577-13.021 0-23.577-10.555-23.577-23.577 0-3.506.765-6.833 2.138-9.824l-19.26-19.26a23.49 23.49 0 0 1-9.823 2.139C10.588 98.247.032 87.69.032 74.669c0-13.021 10.556-23.577 23.577-23.577 4.061 0 7.882 1.026 11.217 2.834L53.39 35.364a23.473 23.473 0 0 1-2.834-11.218Zm63.996 50.523v.023c.012 5.57 4.531 10.082 10.104 10.082 5.581 0 10.105-4.524 10.105-10.105 0-5.58-4.524-10.104-10.105-10.104-5.573 0-10.092 4.511-10.104 10.082v.022ZM23.61 64.565c-5.58 0-10.104 4.524-10.104 10.104 0 5.58 4.524 10.105 10.104 10.105 5.581 0 10.105-4.524 10.105-10.105 0-5.58-4.524-10.104-10.105-10.104Zm40.418 60.627c0-5.581 4.524-10.104 10.105-10.104 5.58 0 10.105 4.523 10.105 10.104 0 5.581-4.524 10.105-10.105 10.105-5.58 0-10.105-4.524-10.105-10.105Z"
      fillRule="evenodd"
    />
  </LogoSvg>
);

export const DatabuddyLogo = ({ className = "size-3.5 shrink-0" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 997.25 1000"
    aria-hidden="true"
    className={className}
  >
    <path
      className="fill-black dark:fill-white"
      d="M344.93,999.91c-18.79.46-37.6-.85-56.09-4.21-9.59-1.74-19.12-4.02-25.77-6.87-19.38-8.33-36.97-23.23-46.92-41.97-12.28-23.12-6.85-43.42-.56-67.29,1.09-4.14,2.11-8.79.59-13.03-1.44-4.01-4.86-7.16-8.54-9.14-9.6-5.16-21.14-8.01-31.19-12.7-77.67-36.21-143.18-91.77-167.26-177.15-33.34-118.21,26.66-247.11,135.77-300.85,4.84-2.38,7.66-7.49,7.25-12.87-7.49-98.57,13.37-185.63,62.19-259.18,21.33-32.14,44.01-55.51,69.31-71.43C307.88,8.03,334.25,0,359.98,0c20.16,0,41.05,5.03,58.28,15.73,7.17,4.45,13.39,11.18,19.27,17.14,4.51,4.57,7.9,10.14,12.61,14.52,5.94,5.52,12.57,6.18,20.25,7.62,6.13,1.15,12.46,2.34,18.75,4.27,48.65,14.94,91.43,54.77,114.42,106.54,18.77,42.24,25.58,92.08,20.25,148.14-2.51,26.41-7.5,53.85-16.16,88.97-.95,3.83-1.73,8.62-2.53,13.79-.69,4.47,2.79,8.52,7.31,8.46,37-.49,74.74,2.93,109.84,15.19,29.32,10.25,56.49,25.53,80.39,45.4,23.55,19.59,43.86,43.37,58.52,70.32,13.1,24.09,21.55,50.78,23.32,78.22.47,7.29.2,14.68.58,21.95.32,6.15,2.21,11.97,8.46,14.57,6.18,2.57,12.94,1.13,19.39,1.13,41.13,0,60.39,21.94,72.7,41,31.59,68.36-8.72,151.46-31.92,176.36-28.31,30.4-68.42,51.34-110.39,51.34-26.52,0-48.81-13.45-74.76-13.58-29.53-.14-54.02,22.09-80.21,32.89-18.95,7.82-39.41,14.32-61.76,19.62-26.88,6.37-54.31,10.19-81.88,11.86-66.47,4.02-133.06,6.84-199.78,8.46Z"
    />
    <g>
      <path
        className="fill-white dark:fill-black"
        d="M930.71,738.38c-39.18-33.15-105.18,35.52-113.51,90.61-4.91,32.49,27.41,58.67,58.27,47.39,38.53-14.08,65.36-59.25,69.66-100.68,1.46-14.03-3.65-28.21-14.42-37.32Z"
      />
      <path
        className="fill-white dark:fill-black"
        d="M288.62,550.63c-2.36-9.97-9.45-18.7-19.03-22.29-29.14-10.67-50.49,27.68-44.49,52.8,1.89,7.79,7.98,17.62,16.91,16.77,8.69-1.09,15.73-11.71,23.62-15.82,6.61-3.97,13.65-5.1,18.89-10.01l.09-.09c5.67-5.48,5.81-13.74,4.02-21.35Z"
      />
      <path
        className="fill-white dark:fill-black"
        d="M424.18,940.3c56.61-1.21,113-7.83,168.17-20.58,60.29-13.94,126.7-36.95,159.48-73.95,57.36-64.73,102.7-169.85,60.36-253-24.53-48.17-71.64-86.82-121.91-102.39-41.54-12.87-87.03-11.19-128.04,2.9-20.92,7.19-40.78,17.61-58.38,31.04-14.51,11.08-42.71,25.55-45.21,45.52-1.42,11.35,7.05,23.5,17.97,26.62,14.39,4.11,25.44-8.05,36.65-14.7,27.75-16.46,59.78-25.72,92.05-26.37,49.31-.99,107.61,16.39,131.73,62.42,22.05,42.08,15.44,96.01-9.59,135.29-37.03,58.1-104.47,83.22-166.72,104.2-72.63,24.49-220.3,33.87-235.83,35.1-15.54,1.24-46.89,3.94-46.89,26.76s45.16,22.35,45.16,22.35c0,0,60.02-.34,100.99-1.22Z"
      />
      <path
        className="fill-white dark:fill-black"
        d="M566.62,290.34c.41-33.66-4.26-66.9-15.77-98.07-14.5-39.28-47.37-74.64-88.96-79.54-9.8-1.16-19.83-.62-29.44-2.88-17.25-4.05-21.99-21.23-32.73-33.17-13.74-15.28-33.17-22.23-53.66-17.76-22.37,4.88-40.82,20.52-56.37,37.33-36.54,39.49-61.85,88.88-74.15,141.16-6.15,26.16-9.08,53.09-8.54,79.96.3,15.04,1.3,30.4,4.49,45.12,2.25,10.4,8.78,22.56,2.78,32.93-6.11,10.56-23.18,13.37-33.35,18.27-14.39,6.93-28.04,15.4-40.62,25.24-52.95,41.42-85.56,108.91-81.2,175.99,4.36,67.08,47.21,131.21,109.09,157.47,22.71,9.64,47.63,13.72,72.24,12.56,34.44-1.62,74.32-14.58,100.63-37.26,7.07-6.1,13.4-13.17,17.77-21.47,2.26-4.31,4.76-9.55,4.16-14.53-.38-3.18-2.06-6.27-4.78-7.96-2.64-1.64-5.97-1.84-9.02-1.2-4.2.88-8.25,3.07-12.2,4.7-9.72,4.02-19.23,8.52-29.03,12.36-10.9,4.27-22.31,7.81-34.09,8.33-76.46,3.37-143.66-55.63-142.73-134.06.55-46.24,26.1-91.25,68.41-111.44,43.49-20.76,99.4-10.99,125.37,32.31,6.64,11.06,11.05,23.75,22.85,30.92,5.82,3.53,13.1,4.3,19.14,1.16,13.67-7.12,10.18-26.77,5.78-41.29-27.36-90.31-25.84-221.06,42.58-294.54,10.71-11.5,25.4-20.22,41.12-20.27,22.36-.07,41.78,17.67,50.16,38.41,8.38,20.73,7.83,43.9,5.96,66.19-4.66,55.75-16.78,110.88-35.92,163.45-4.37,11.99-9.19,24.45-4.86,37.37,2.26,6.74,7.67,12.22,14.63,13.65,14,2.88,24.21-11.51,30.22-24.09,27.74-58.02,49.19-127.56,50.02-195.35ZM277.99,385.02c-27.27-46.18-25.62-105.37-8.54-154.6,5.31-15.32,12.27-30.02,20.04-44.23,7.14-13.05,14.48-26.96,23.64-38.71,9.07-11.62,24.6-24.78,40.27-23.74,3.79.27,7.34,2.19,9.44,5.36,4.33,6.53,1.32,12.38-2.3,17.54-3.49,4.97-7.11,9.86-10.54,14.87-6.85,10.01-13.37,20.26-19.42,30.77-12.06,20.95-22.27,43.02-29.51,66.1-2.85,9.08-5.24,18.3-7.12,27.63-4.59,22.79-7.33,46.18-8.88,69.36-.63,9.23-.61,18.48-.54,27.73.13,3.65-4.69,5.06-6.54,1.91Z"
      />
    </g>
  </svg>
);

const IconBase = ({ className, children }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    height="24"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={1.5}
    viewBox="0 0 24 24"
    width="24"
    xmlns="http://www.w3.org/2000/svg"
  >
    {children}
  </svg>
);

const ProjectsIcon = ({ className }) => (
  <IconBase className={className}>
    <rect height="7" rx="1.5" width="7" x="3" y="3" />
    <rect height="7" rx="1.5" width="7" x="14" y="3" />
    <rect height="7" rx="1.5" width="7" x="3" y="14" />
    <rect height="7" rx="1.5" width="7" x="14" y="14" />
  </IconBase>
);

const ReferencesIcon = ({ className }) => (
  <IconBase className={className}>
    <path
      d="M6.000 4.000C6.000 4.000 14.750 4.000 14.750 4.000C16.857 4.000 17.910 4.000 18.667 4.506C18.994 4.724 19.276 5.006 19.494 5.333C19.980 6.059 19.999 7.059 20.000 9.000M0.000 18.000C0.000 18.000 0.000 4.944 0.000 4.944C0.000 3.128 0.000 2.220 0.380 1.538C0.651 1.052 1.052 0.651 1.538 0.380C2.220 0.000 3.128 0.000 4.944 0.000C6.108 0.000 6.690 0.000 7.199 0.191C8.362 0.627 8.842 1.684 9.367 2.733C9.367 2.733 10.000 4.000 10.000 4.000"
      transform="matrix(1 0 0 1 2 3)"
    />
    <path
      d="M7.000 0.000C7.000 0.000 0.000 0.000 0.000 0.000M7.000 3.000C7.000 3.000 0.000 3.000 0.000 3.000M2.500 6.000C2.500 6.000 0.000 6.000 0.000 6.000"
      transform="matrix(1 0 0 1 15 15)"
    />
    <path
      d="M5.707 5.000C5.707 5.000 6.366 0.952 5.707 0.293C5.048 -0.366 1.000 0.293 1.000 0.293M0.000 6.000C0.000 6.000 5.000 1.000 5.000 1.000"
      transform="matrix(1 0 0 1 5 15)"
    />
  </IconBase>
);

const ContentIcon = ({ className }) => (
  <IconBase className={className}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6" />
    <path d="M9 17h4" />
  </IconBase>
);

const ImagesIcon = ({ className }) => (
  <IconBase className={className}>
    <rect height="18" rx="3" width="18" x="3" y="3" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M4 16.5l4.5-4.5a2 2 0 0 1 2.8 0L20 20.5" />
  </IconBase>
);

const TrafficIcon = ({ className }) => (
  <IconBase className={className}>
    <path d="M3 12h4l3-8 4 16 3-8h4" />
  </IconBase>
);

const ZdrIcon = ({ className }) => (
  <IconBase className={className}>
    <path d="M12 3l7 2.5v5.5c0 4.3-2.9 7.3-7 8.5-4.1-1.2-7-4.2-7-8.5V5.5z" />
    <path d="M9 12l2 2 4-4" />
  </IconBase>
);

const ArrowRightIcon = ({ className }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M18.5 12L4.99997 12"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
    <path
      d="M13 18C13 18 19 13.5811 19 12C19 10.4188 13 6 13 6"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  </svg>
);

const EASE_OUT = "ease-[cubic-bezier(0.23,1,0.32,1)]";

const Window = ({ address, controls, children }) => (
  <div className="border-border bg-card overflow-hidden rounded-xl border shadow-[0_0.0625rem_0.125rem_#0A0D140A,0_0.25rem_1rem_#0A0D140F] dark:shadow-none">
    <div className="border-border flex items-center gap-3 border-b px-3 py-2.5">
      <div aria-hidden="true" className="hidden gap-1.5 sm:flex">
        <span className="bg-muted-foreground/25 size-2.5 rounded-full" />
        <span className="bg-muted-foreground/25 size-2.5 rounded-full" />
        <span className="bg-muted-foreground/25 size-2.5 rounded-full" />
      </div>
      <div className="bg-muted text-muted-foreground min-w-0 flex-1 truncate rounded-md px-3 py-1 font-mono text-xs">
        {address}
      </div>
      {controls}
    </div>
    {children}
  </div>
);

export const SitesDeployDiagram = () => (
  <Diagram
    caption="A failed build never touches the live site. A Notra Sites check on the commit lists every error with its file and line."
    label="A deploy"
  >
    <Panel
      aside="blog/launch.mdx"
      scan={0}
      title={<WithLogo Logo={GitHubLogo}>git push</WithLogo>}
    />
    <Connector flowDelay={0.11} label="build the exact commit" step={1} />
    <Panel
      accent
      aside="no network, no secrets"
      scan={0.23}
      title="build sandbox"
    >
      <Row accent k="pages" v="static HTML + Markdown" />
      <Row accent k="search" v="sitemaps, RSS, JSON-LD" />
      <Row accent k="agents" v="llms.txt, llms-full.txt" />
      <Row accent k="social" v="OG image for every post" />
    </Panel>
    <Connector
      flowDelay={0.34}
      label="upload, check, switch live in one step"
      step={2}
    />
    <div className="grid gap-4 sm:grid-cols-2">
      <Panel accent aside="push to main" scan={0.46} title="blog.acme.com">
        <Row accent k="visitors" v="everyone" />
        <Row accent k="indexed" v="yes" />
      </Panel>
      <Panel aside="pull request" scan={0.46} title="pr-42--acme.notra.site">
        <Row k="visitors" v="your team" />
        <Row k="indexed" v="never" />
      </Panel>
    </div>
  </Diagram>
);

const READERS = [
  { id: "person", label: "Person" },
  { id: "agent", label: "AI agent" },
];

const AGENT_TONE = { muted: "text-muted-foreground", body: "text-foreground" };

const AGENT_LINES = [
  {
    text: '$ curl -i -H "Accept: text/markdown" acme.com/blog/launch',
    tone: "muted",
  },
  { key: "x-robots-tag", text: "noindex", tone: "body" },
  {
    key: "link",
    text: '<https://acme.com/blog/launch>; rel="canonical"',
    tone: "body",
  },
  { text: "", tone: "body" },
  { text: "# Acme Flow is live", tone: "body" },
  { text: "", tone: "body" },
  { text: "- Published: 2026-09-28", tone: "muted" },
  { text: "- Authors: Jan Burzinski", tone: "muted" },
  { text: "", tone: "body" },
  {
    text: "Acme Flow ships today. Write a post, push it, and it's live:",
    tone: "body",
  },
  { text: "", tone: "body" },
  { text: "- Publish from GitHub", tone: "body" },
  { text: "- Previews for every pull request", tone: "body" },
];

const stackLayer = (hidden) =>
  cn(
    "transition-[opacity,filter] duration-200 ease-out [grid-area:stack]",
    hidden && "pointer-events-none opacity-0 blur-[2px]"
  );

export const SitesReadersDemo = () => {
  const [reader, setReader] = useState("person");
  const isAgent = reader === "agent";

  const toggle = (
    <div
      aria-label="Request the page as"
      className="bg-muted relative grid shrink-0 grid-cols-2 rounded-md p-0.5 font-sans text-xs font-medium"
      role="group"
    >
      <span
        aria-hidden="true"
        className={cn(
          "bg-background absolute inset-y-0.5 left-0.5 w-[calc(50%-0.125rem)] rounded-[0.3125rem] shadow-sm transition-transform duration-200",
          EASE_OUT,
          isAgent && "translate-x-full"
        )}
      />
      {READERS.map((option) => (
        <button
          aria-pressed={reader === option.id}
          className={cn(
            "relative px-3 py-1 transition-colors",
            reader === option.id
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          key={option.id}
          onClick={() => setReader(option.id)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  return (
    <figure className="not-prose my-10">
      <Window address="acme.com/blog/launch" controls={toggle}>
        <div className="grid [grid-template-areas:'stack']">
          <div aria-hidden={isAgent} className={stackLayer(isAgent)}>
            <div className="flex h-full flex-col justify-center px-6 py-8 font-sans sm:px-10">
              <div className="text-muted-foreground text-xs">
                Sep 28, 2026 · Jan Burzinski
              </div>
              <div className="font-heading text-foreground mt-2 text-3xl font-medium tracking-[-0.02em]">
                Acme Flow is live
              </div>
              <p className="text-foreground/80 mt-5 text-sm leading-6">
                Acme Flow ships today. Write a post, push it, and it&apos;s
                live:
              </p>
              <ul className="text-foreground/80 mt-2 space-y-1 text-sm">
                <li>• Publish from GitHub</li>
                <li>• Previews for every pull request</li>
              </ul>
            </div>
          </div>
          <div aria-hidden={!isAgent} className={stackLayer(!isAgent)}>
            <pre className="overflow-x-auto px-6 py-6 font-mono text-xs leading-5 sm:px-10">
              {AGENT_LINES.map((line, index) => (
                <span
                  className={cn("block min-h-5", AGENT_TONE[line.tone])}
                  key={index}
                >
                  {line.key ? (
                    <>
                      <span className="text-primary">{line.key}</span>:{" "}
                    </>
                  ) : null}
                  {line.text}
                </span>
              ))}
            </pre>
          </div>
        </div>
      </Window>
      <figcaption className="text-muted-foreground mt-4 text-center font-sans text-sm">
        Same URL, same post. Switch who&apos;s asking.
      </figcaption>
    </figure>
  );
};

const DATABUDDY_ROW = <WithLogo Logo={DatabuddyLogo}>databuddy.js</WithLogo>;

const LOG_ROWS = {
  pending: [
    { what: "GET /blog/launch", status: "200", tone: "ok" },
    { what: DATABUDDY_ROW, status: "waiting", tone: "wait" },
    { what: "Notra page view", status: "waiting", tone: "wait" },
  ],
  accepted: [
    { what: "GET /blog/launch", status: "200", tone: "ok" },
    { what: DATABUDDY_ROW, status: "loaded", tone: "ok" },
    { what: "page_view → Databuddy", status: "sent", tone: "ok" },
    { what: "web vitals → Databuddy", status: "sent", tone: "ok" },
    { what: "Notra page view", status: "counted", tone: "ok" },
  ],
  rejected: [
    { what: "GET /blog/launch", status: "200", tone: "ok" },
    { what: DATABUDDY_ROW, status: "blocked", tone: "off" },
    { what: "Notra page view", status: "not counted", tone: "off" },
  ],
};

const TONE_CLASS = {
  ok: "text-primary",
  wait: "text-muted-foreground",
  off: "text-muted-foreground",
};

const ConsentButton = ({ buttonRef, children, primary = false, onClick }) => (
  <button
    ref={buttonRef}
    className={cn(
      "rounded-md px-3 py-1.5 text-xs font-medium transition-transform duration-150 ease-out active:scale-[0.97]",
      primary
        ? "bg-foreground text-background"
        : "border-border text-foreground border"
    )}
    onClick={onClick}
    type="button"
  >
    {children}
  </button>
);

export const SitesConsentDemo = () => {
  const [choice, setChoice] = useState("pending");
  const decided = choice !== "pending";
  // Move focus to the control that replaces the one just pressed, never on the first render.
  const settingsRef = useRef(null);
  const acceptRef = useRef(null);
  const chose = useRef(false);
  useEffect(() => {
    if (chose.current) {
      (decided ? settingsRef : acceptRef).current?.focus();
    }
  }, [decided]);
  const choose = (value) => {
    chose.current = true;
    setChoice(value);
  };

  return (
    <figure className="not-prose my-10">
      <div className="grid gap-4 md:grid-cols-[1.15fr_1fr]">
        <Window address="acme.com/blog/launch">
          <div className="relative h-64 overflow-hidden px-6 py-6 font-sans">
            <div className="font-heading text-foreground text-xl font-medium tracking-[-0.02em]">
              Acme Flow is live
            </div>
            <div aria-hidden="true" className="mt-4 space-y-2.5">
              <div className="bg-muted h-2 w-full rounded-full" />
              <div className="bg-muted h-2 w-11/12 rounded-full" />
              <div className="bg-muted h-2 w-4/5 rounded-full" />
              <div className="bg-muted h-2 w-2/3 rounded-full" />
            </div>

            <div
              inert={decided}
              className={cn(
                "border-border bg-background absolute inset-x-3 bottom-3 rounded-lg border p-3 shadow-[0_0.25rem_1rem_#0A0D1414] transition-[transform,opacity] duration-200",
                EASE_OUT,
                decided &&
                  "pointer-events-none translate-y-[calc(100%+0.75rem)] opacity-0"
              )}
            >
              <div className="text-foreground flex items-center gap-2 text-xs font-medium">
                <C15tLogo className="size-3.5" />
                We use cookies to measure visits.
              </div>
              <div className="mt-3 flex gap-2">
                <ConsentButton onClick={() => choose("rejected")}>
                  Reject
                </ConsentButton>
                <ConsentButton
                  buttonRef={acceptRef}
                  primary
                  onClick={() => choose("accepted")}
                >
                  Accept
                </ConsentButton>
              </div>
            </div>

            <button
              inert={!decided}
              ref={settingsRef}
              className={cn(
                "text-muted-foreground hover:text-foreground absolute bottom-3 left-6 text-xs underline-offset-4 transition-[opacity,color] duration-200 hover:underline",
                !decided && "pointer-events-none opacity-0"
              )}
              onClick={() => choose("pending")}
              type="button"
            >
              Privacy settings
            </button>
          </div>
        </Window>

        <div className="border-border bg-card rounded-xl border p-4 font-mono text-xs">
          <div className="text-muted-foreground mb-3 tracking-widest uppercase">
            What loads
          </div>
          <ul aria-live="polite" className="space-y-1">
            {LOG_ROWS[choice].map((row, index) => (
              <li
                className="consent-log-row flex items-center justify-between gap-4 py-1.5"
                key={`${choice}-${index}`}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <span className="text-foreground flex min-w-0 items-center">
                  {row.what}
                </span>
                <span className={cn("shrink-0", TONE_CLASS[row.tone])}>
                  {row.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <figcaption className="text-muted-foreground mt-4 text-center font-sans text-sm">
        Accept or reject the banner to see what loads. Choices are stored in
        your own c15t backend, and AI crawlers are always counted.
      </figcaption>
    </figure>
  );
};

const FREE_PLAN_FEATURES = [
  {
    Icon: ProjectsIcon,
    label: "1 site and 1 custom domain",
    subtitle: "with a “Powered by Notra” badge",
  },
  {
    Icon: ReferencesIcon,
    label: "Deploys from your GitHub repo",
    subtitle: "with a preview for every pull request",
  },
  { Icon: ContentIcon, label: "Markdown, llms.txt and sitemaps" },
  { Icon: ImagesIcon, label: "OG image for every post" },
  { Icon: TrafficIcon, label: "Visitor and AI agent analytics" },
  { Icon: ZdrIcon, label: "Databuddy and c15t integrations" },
];

export const SitesFreePlanCard = () => (
  <aside className="not-prose my-10 grid gap-1.75 rounded-3xl bg-[#F7F7F7] p-1.75 sm:grid-cols-2 dark:bg-white/[0.04]">
    <div className="flex flex-col justify-between gap-8 rounded-2xl bg-white p-6 shadow-[0_0.125rem_0.3125rem_#00000008] dark:bg-white/[0.04]">
      <div className="flex flex-col gap-2">
        <h3 className="font-heading text-[1.375rem] leading-7 font-medium tracking-[0.01em] text-black dark:text-white">
          Notra Sites
        </h3>
        <p className="font-sans text-[0.9375rem] leading-5 font-normal tracking-[-0.015em] text-[#6B6B6B] dark:text-white/60">
          Your blog and changelog, hosted on your domain and ready for AI
          agents.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-[2.625rem] leading-13 font-normal tracking-[-0.01em] text-[#1E1E1E] dark:text-white">
            $0
          </span>
          <span className="font-sans text-sm leading-[1.125rem] font-normal tracking-[-0.015em] text-[#1E1E1EB3] dark:text-white/60">
            for your first site
          </span>
        </div>
        <a
          className="notra-cta-button notra-cta-primary w-full gap-2 text-base"
          href="https://app.usenotra.com/signup?db_source=blog-notra-sites"
        >
          <span>Create your site</span>
          <ArrowRightIcon className="size-4" />
        </a>
      </div>
    </div>
    <div className="flex flex-col gap-5 p-6">
      <span className="font-sans text-sm leading-[1.125rem] font-medium text-[#1E1E1E] dark:text-white">
        Included on the Free plan
      </span>
      <ul className="flex flex-col gap-3.5">
        {FREE_PLAN_FEATURES.map(({ Icon, label, subtitle }) => (
          <li className="flex items-center gap-2.5" key={label}>
            <span className="shrink-0 text-[#1E1E1EBF] dark:text-white/60">
              <Icon className="size-6" />
            </span>
            <div className="flex flex-col">
              <span className="font-sans text-sm leading-[1.125rem] font-normal text-[#1E1E1EBF] dark:text-white/70">
                {label}
              </span>
              {subtitle ? (
                <span className="font-sans text-xs leading-4 font-normal text-[#1E1E1EB3] dark:text-white/50">
                  {subtitle}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  </aside>
);
