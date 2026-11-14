---
version: alpha
name: Notra
description: Design system for the Notra product UI. Dualtone surfaces, violet as the action color, Inter for type, Geist Mono for code.
colors:
  primary: "oklch(0.56 0.22 292.7172)"
  primary-hex: "#7E4CE7"
  primary-foreground: "oklch(0.997 0 0)"
  ring: "oklch(0.56 0.22 292.7172)"
  background: "hsl(0 0% 100%)"
  foreground: "hsl(0 0% 9%)"
  card: "hsl(0 0% 100%)"
  muted: "hsl(0 0% 96.1%)"
  muted-foreground: "hsl(240 4% 40%)"
  subtle-foreground: "hsl(240 4% 45%)"
  border: "hsl(0 0% 89.8%)"
  input: "hsl(0 0% 89.8%)"
  destructive: "oklch(0.577 0.245 27.325)"
  shell: "#f3f3f2"
  shell-border: "#e7e7e5"
  table-card: "#ffffff"
  table-card-border: "#e5e5e5"
  table-row-border: "#efefee"
  dark-primary: "oklch(0.6056 0.2189 292.7172)"
  dark-primary-hex: "#8B5CF6"
  dark-background: "oklch(0.17 0.006 270)"
  dark-card: "oklch(0.195 0.006 270)"
  dark-muted: "oklch(0.27 0.006 270)"
  dark-muted-foreground: "oklch(0.77 0.006 270)"
  dark-subtle-foreground: "oklch(0.66 0.006 270)"
  dark-border: "oklch(0.31 0.006 270)"
  dark-input: "oklch(0.33 0.006 270)"
  dark-destructive: "oklch(0.65 0.21 25)"
  dark-shell: "#161616"
  dark-shell-border: "#232323"
  dark-table-card: "#1f1f1f"
  dark-table-card-border: "#333333"
  dark-table-row-border: "#292929"
  geo-search: "var(--primary)"
  geo-memory: "oklch(0.606 0.099 206.2)"
  chart-search-light: "#8B5CF6"
  chart-search-dark: "#9C87E3"
  chart-memory-light: "#18929F"
  chart-memory-dark: "#20ABBA"
---

# Notra

> Design system for the Notra product. The signature is dualtone: a muted shell with a lifted card sitting in it. Violet is the action color. Inter carries the type.

This document covers the dashboard. The marketing site has its own file at [usenotra.com/design.md](https://www.usenotra.com/design.md).

The product is light-first and quiet. Hierarchy comes from two fills and a hairline. Color is for an action, a selection, or a data series. Dark mode keeps the same roles on darker surfaces.

## Canonical sources

| What | Source |
| --- | --- |
| Surfaces, violet, radius | `packages/ui/src/styles/globals.css` |
| Fonts | `packages/ui/src/styles/typography.css` (stacks, scale), `apps/dashboard/src/styles/globals.css` (mapping) |
| Status color | `packages/ui/src/styles/status.css` |
| Chart hex | `apps/dashboard/src/constants/charts.ts` |
| Tables | `apps/ui/registry/notra/table/` (imported as `ui/table`), `packages/ui/src/constants/table.ts` |
| Modules | `apps/ui/registry/notra/card/components/instrument-module.tsx` (imported as `ui/card`) |
| Buttons | `packages/ui/src/components/ui/button.tsx` |
| Page heading, tabs, empty states | `packages/ui/src/components/shared/page-heading.tsx`, `packages/ui/src/components/ui/icon-tabs.tsx`, `apps/dashboard/src/components/empty-state.tsx` |
| Motion | `packages/ui/src/styles/motion.css`, `packages/ui/src/lib/motion.ts` |

The tables below are the values to follow. The paths are for people working in the repo. A dev-only catalog of the components lives in `apps/dashboard/src/app/design-system/`.

## Dualtone

A dualtone block is a shell that holds two surfaces. The shell is `bg-shell` with a 1px `border-shell-border` and a 2px rim (`p-0.5`) on all four sides. Its header band sits directly on the shell and holds the eyebrow, readout, and actions. The body is `bg-table-card`. It overlaps the header by 20px and holds the content.

```html
<div class="rounded-2xl border border-shell-border bg-shell p-0.5">
  <div class="min-h-24 rounded-t-[14px] px-4 pt-4 pb-9">
    <!-- eyebrow, readout, action -->
  </div>
  <div class="relative -mt-5 rounded-[14px] border border-table-card-border bg-table-card p-6 shadow-table-card">
    <!-- content -->
  </div>
</div>
```

Use `InstrumentModule` from `ui/card` rather than writing this by hand. Its variants:

| Variant | Header | Body | Use |
| --- | --- | --- | --- |
| `panel` | `min-h-24 pt-4 pb-9` | `-mt-5`, `p-6` | Charts and taller panels |
| `table` | `min-h-[4.25rem] pt-3 pb-8`, centered | `-mt-5`, `p-4` | Lists, metric bands |
| `table-compact` | `min-h-14 pt-1.5 pb-6.5`, centered | `-mt-5`, `p-4` | Dense modules |
| `flat` | Card header | Card content | A block with no label band |

- The shell is `rounded-2xl` (16px). The body and the header band are `rounded-[14px]`, which is 16px minus the 2px rim. The body carries `shadow-table-card`, which lifts it off the shell in light mode and becomes an inner highlight in dark mode.
- The dualtone shell clears the card ring (`ring-0`), so only the two borders show.
- For dualtone variants, `bareBody` drops the shell and the lifted body styling but keeps the header and the content, with no body padding. `InstrumentSection` is a heading and description with no shell, for grouping modules on a page.
- One dualtone per group. Do not nest a dualtone block inside another.
- `flat` is the plain card: `rounded-xl`, `bg-card`, and `ring-1 ring-foreground/10`. Do not add a muted tray to it.
- Every table uses the same frame: `TABLE_FRAME_CLASS` (`rounded-2xl border border-table-shell-border bg-table-shell p-0.5`) around `TABLE_BODY_CLASS` (`rounded-[14px] border border-table-card-border bg-table-card shadow-table-card`). In dark mode the shell is darker than the card. Headers (`h-9`) sit on the shell, and body cells (`h-12`) sit on `bg-table-card` with `border-table-row-border` between rows. Rows hover to `bg-muted`, selected rows are `bg-primary/5`, and keyboard focus draws an inset 2px ring.
- A table with a footer adds a band under the body (`-mt-5 rounded-b-[14px] pt-5`) that sits on the shell.
- Use `DataTable` from `ui/table` for bounded or paged lists and `InfiniteDataTable` for lists that load the next page on scroll. Use `DataTableSkeleton` while they load. The shadcn `Table` primitives render the same frame for one-off tables, such as chat markdown. Do not restyle the frame with `className`.
- Eyebrows render the label as written: `text-sm font-medium` for `table`, `table-compact` and `flat`, and `text-base font-medium` for `panel`. Readouts are `text-xs text-muted-foreground tabular-nums`, and the flat readout capitalizes its first letter. Aligned numbers use `tabular-nums`.

## Color

### Violet

The action color is token `primary`. In light mode it is `oklch(0.56 0.22 292.7172)` (about `#7E4CE7`), darkened for contrast on white. In dark mode it is `oklch(0.6056 0.2189 292.7172)`, which is `#8B5CF6`. Use it for the primary action, links, the selected control, the focus ring, and the first data series.

The main action, links, and the selected control may use violet together. Body text stays `foreground`.

### Surfaces

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `background` | `hsl(0 0% 100%)` | `oklch(0.17 0.006 270)` | Page |
| `foreground` | `hsl(0 0% 9%)` | `hsl(0 0% 98%)` | Primary text |
| `card` | white | `oklch(0.195 0.006 270)` | Flat cards, dialogs, popovers |
| `muted` | `hsl(0 0% 96.1%)` | `oklch(0.27 0.006 270)` | Secondary fill, hover |
| `shell` | `#f3f3f2` | `#161616` | Dualtone shell, alias of `table-shell` |
| `shell-border` | `#e7e7e5` | `#232323` | Dualtone shell hairline, alias of `table-shell-border` |
| `table-card` | `#ffffff` | `#1f1f1f` | Dualtone and table body |
| `table-card-border` | `#e5e5e5` | `#333333` | Body hairline |
| `table-row-border` | `#efefee` | `#292929` | Row separators |
| `muted-foreground` | `hsl(240 4% 40%)` | `oklch(0.77 0.006 270)` | Secondary text |
| `subtle-foreground` | `hsl(240 4% 45%)` | `oklch(0.66 0.006 270)` | Timestamps, hints, placeholders |
| `border` | `hsl(0 0% 89.8%)` | `oklch(0.31 0.006 270)` | Hairline |
| `input` | `hsl(0 0% 89.8%)` | `oklch(0.33 0.006 270)` | Input border |
| `primary` | `oklch(0.56 0.22 292.7172)` | `#8B5CF6` | Action, links, selection |
| `primary-foreground` | near white | near white | Text on primary |
| `destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.65 0.21 25)` | Destructive action. Dark buttons fill at 80% |

- Dark grays carry a faint cool tint (hue 270, chroma 0.006). The shell and table tokens stay neutral.
- Use `subtle-foreground` for tertiary text instead of fading `muted-foreground` with an opacity modifier.
- `surface-neutral` re-points `background`, `muted`, `border` and `input` to neutral grays inside table-card panes such as the settings modal.

### Status and series

Status and chart colors share one lightness: about L 0.55 in light, about L 0.70 in dark. A badge, an arrow, and a stroke should look like one system.

| Token | Meaning | Light | Dark |
| --- | --- | --- | --- |
| `success` / `geo-up` | Success, up | `oklch(0.55 0.109 155)` | `oklch(0.7 0.125 155)` |
| `warning` / `geo-mid` | Warning, mid | `oklch(0.57 0.113 55)` | `oklch(0.7 0.125 55)` |
| `geo-down` | Down | `oklch(0.59 0.192 27)` | `oklch(0.7 0.138 27)` |
| `info` | Neutral information | `oklch(0.55 0.13 250)` | `oklch(0.7 0.12 250)` |
| `merged` | Merged | `oklch(0.55 0.2 295)` | `oklch(0.68 0.16 295)` |
| `geo-search` | First series, own brand | `var(--primary)` | `oklch(0.68 0.134 292.717)` |
| `geo-memory` | Second series | `oklch(0.606 0.099 206.2)` | `oklch(0.68 0.111 206.2)` |

In UI, use the tokens (`bg-geo-search`, `text-geo-memory`). Canvas charts use the fixed hex in `charts.ts`: Search `#8B5CF6` / `#9C87E3`, Memory `#18929F` / `#20ABBA`, Referral `#E89A1C` / `#FFB547`, and Muted `#8A8A94` / `#9A9AA4`.

Search violet and Memory teal stay on those two series. Rival series, in order, are `#E0632F`, `#2E9E5B`, `#D4348B`, `#B68F3C`, `#3A6FF0`, `#6B6B75`. Account charts use a separate list in `ACCOUNT_SERIES_COLORS`, starting at `#358FF3`.

Use status color as a 10% tint with a stronger text token, paired with a label or an icon. Badges use `bg-success/10 text-badge-success` (`/20` in dark). `badge-*` text tokens are L 0.46 in light and L 0.76 in dark. Toast icons use a 12% tint (`bg-success/12 text-success`).

## Typography

Inter Variable is the sans (`--font-sans`) and Geist Mono Variable is the mono (`--font-mono`). The family stacks, Inter's metric-matched Arial fallback and `text-2xs`/`text-3xs` live in `packages/ui/src/styles/typography.css`; the dashboard stylesheet loads the fonts and maps them. Put `font-sans` on a surface that must be Inter. Put `font-mono` on code, paths, and identifiers.

| Role | Classes |
| --- | --- |
| Page title | `PageHeading`: `text-2xl font-bold tracking-tight text-balance`, `text-3xl` when `@container/main` is 40rem or wider |
| Page description | `text-sm text-muted-foreground text-pretty` |
| Body | weight 400 |
| Label | weight 500, often `text-sm` |
| Metric | usually `text-3xl font-semibold tracking-tight tabular-nums` (range `text-2xl` to `text-4xl`) |
| Panel eyebrow | `text-base font-medium` |
| Table or flat eyebrow | `text-sm font-medium` |
| Readout | `text-xs text-muted-foreground tabular-nums` |
| Captions, chart labels | `text-2xs` (11px) |
| Counters, tiny badges | `text-3xs` (10px) |

Write labels and eyebrows in sentence case. Components render them as written.

## Layout

- Spacing is a 4px scale (`--spacing: 0.25rem`). Keep 8–16px inside a group and 16–24px of padding inside a module body.
- Pages sit in `PageContainer`. Its default `relaxed` width is `min(40rem + 41.667cqw, 80rem)`, `compact` is `min(24rem + 50cqw, 72rem)`, and `default` is 96rem.
- The usual page column is `flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6`, with `PageHeading` first. Header actions sit to the right of the title: the primary action is a `size="sm"` button, and secondary icon actions are `size="icon-sm" variant="outline"`.
- The sidebar is 16rem wide (3rem collapsed to icons, 18rem as a mobile sheet).
- Long text is left-aligned.

## Shape

The base radius is `0.5rem` in both modes, so `rounded-sm` is 4px, `md` 6px, `lg` 8px and `xl` 12px.

| Element | Radius |
| --- | --- |
| Buttons | Default, outline, secondary, destructive: `rounded-[0.75rem]` with `corner-shape: squircle`. Ghost and link: `rounded-lg`. `xs` and `sm` sizes: 6px. `[data-slot="button"]` gets `corner-squircle` |
| Inputs | `rounded-lg`. No squircle |
| Dualtone shells, table frames | `rounded-2xl` (16px) |
| Dualtone and table bodies | `rounded-[14px]` |
| Flat cards, dialogs | `rounded-xl` |
| Menus | 14px squircle (12px for `sm`); items are 4px tighter |
| Toasts | 14px squircle |
| Tab indicators, small chips | `rounded-md` |
| Avatars, badges, count pills | `rounded-full` |

Keep one radius family per view. A dualtone module is 16px outside and 14px inside.

## Elevation

- Depth is the overlap of the two fills plus `shadow-table-card` on the body. Do not add a further drop shadow to a dualtone card.
- Floating surfaces carry their own shadows:
  - Menus use a layered shadow with a 1px inner highlight.
  - Popovers and hover cards use `shadow-md`.
  - Toasts and tooltips use layered shadows.
  - Dialogs use `ring-1 ring-foreground/10` and no shadow.
- In dark mode the theme `shadow-*` tokens are zero. Menus, toasts and the secondary button switch to dark-specific shadows with an inner top highlight.
- Menu items highlight with `bg-menu-highlight`: foreground at 5% (7% in dark mode).
- Focus stays visible. Buttons use a 3px ring at `ring-ring/50` and `border-ring` on `:focus-visible`. Inputs use a 2px ring. Do not remove an outline unless a ring replaces it.

## Motion

Use the shared scale. The CSS utilities and `DURATION`, `EASE`, and `SPRING` in `@notra/ui/lib/motion` are the same numbers.

| Name | Duration | Use |
| --- | --- | --- |
| `instant` | 100ms | Menus, tooltips, selects, popup exits |
| `fast` | 150ms | Hover, press, color, popup entrances |
| `normal` | 200ms | Expand, reveal, swap, tab indicators, dialogs |
| `slow` | 300ms | Sidebar, accordion, drawer |
| `slower` | 500ms | A deliberate reveal |

- `ease-out` (`cubic-bezier(0.23, 1, 0.32, 1)`) is the one curve for entrances, exits and moves; `ease-emphasized` is an alias. Never ease-in on UI. Exits use `ease-out` at a shorter duration. `ease-emphasized-in-out` (`cubic-bezier(0.65, 0, 0.35, 1)`) is only for symmetric morphs such as resizing.
- Tab indicators slide on a 200ms tween, not a spring.
- Springs: `indicatorFlat` for dense controls (no bounce), `snappy` for list reorder and quick layout moves, `gentle` for large surfaces such as the welcome tour. `indicator` (bounce 0.2) is for expandable tabs.
- Menus, popovers and hover cards fade and scale from 0.97, 150ms in and 100ms out, without sliding (`POPUP_MOTION_CLASS_NAME`). Dialogs fade and scale from 0.96, 200ms in and 150ms out.
- Actions triggered from the keyboard do not animate. Dialogs take an `instant` prop.
- Buttons press to `scale(0.96)`. Disabled controls stay still.
- Reduced motion drops movement and keeps feedback: keyframes and transforms stop, opacity and color changes keep a 150ms fade, and view transitions are off.

Motion explains a change. A resting screen stays still.

## Components

**Button.** Variants are `default` (primary), `outline`, `secondary`, `ghost`, `destructive`, and `link`.
- Primary and secondary use the Depth style: a vertical gradient, a 1px top highlight, and a soft drop shadow.
- Hover darkens: `brightness-90` for primary and destructive, `brightness-[0.97]` for secondary, `bg-muted` for outline and ghost.
- Sizes: default is `h-8` (32px), `text-sm`, `font-medium`. The others are `h-6` (xs, `text-xs`), `h-7` (sm, 12.8px) and `h-9` (lg). Icon buttons are `size-6` through `size-9`.
- `loading` swaps the label for bouncing dots. `progress` fills the button from the left.
- The dashboard `@/components/button` re-exports the kit button.

**Module.** `InstrumentModule` from `ui/card`, with `flat`, `panel`, `table` and `table-compact` variants as above. The eyebrow is the label. A `hint` adds a 14px info icon with a tooltip. The readout is a quiet number. `action` holds controls. The body is the content. `InstrumentEmpty` is the empty body for a module: centered copy, an optional faded preview, and a spinner while `busy`.

**Page tabs.** `IconTabsList` with `IconTabsTrigger`. The list is a `bg-muted` pill track. The indicator is `rounded-md bg-background` with a 1px shadow (`bg-foreground/10` in dark) and slides in 200ms. The active tab shows a 15px icon that slides in. Inactive tabs show text only.

**Empty state.** `EmptyState` names what is missing and the first action, which is a `size="sm"` button. A faded preview of the real module (`opacity-[0.38]`, masked to transparent) may sit above the copy, never behind it. An icon tile is fine. A generic illustration is not.

**Badge.** Pill by default (`rounded-md` with `shape="rounded"`). Sizes are `sm` (16px), `default` (20px) and `md` (24px). Status variants use the tint-and-text pairing above.

**Toast.** A gradient surface from `background` to `muted/60` with a 14px squircle and a 24px status icon tile.

**Kbd.** `h-5 min-w-5 rounded-sm bg-muted text-xs font-medium text-muted-foreground`.

**Skeleton.** `rounded-md bg-muted` with a shimmer sweep. Skeletons fade out over 200ms when content arrives. The shimmer is off under reduced motion.

**Icons.** Hugeicons only, `currentColor`. They are 16px in controls, 15px in page tabs, and 14px beside a label or in `sm` controls. Brand and engine marks keep their own artwork.

## Voice

Copy is concrete and short. Lead with the thing the reader can do. Use numerals for counts and percents. Name an action with a verb and a noun when the object would otherwise be unclear.

The product name is `Notra`.

| Rule | Do | Don't |
| --- | --- | --- |
| Case | Sentence case in copy, labels and eyebrows | Title Case on buttons and toasts |
| Numerals | `3 scans`, `12%` | "three scans" |
| Errors | What happened, then what to do | "Something went wrong" with no next step |
| Toasts | Name the object that changed | "Successfully updated" |
| Empty | Name the gap and the first action | A generic illustration with no action |
| Filler | Concrete verbs | "revolutionize", "unlock", "seamless", "effortless" |

## Do and don't

| Do | Don't |
| --- | --- |
| Build hierarchy with `muted` and `card` or `background` | Add a third gray to separate regions |
| Overlap the body onto the shell header by 20px (`-mt-5`) | Leave a gap between the two fills |
| Keep violet for the main action, links, selection, and the first series | Wash screens in violet |
| Keep Memory teal on the second series | Reuse Search or Memory hues for another series |
| Use `font-sans` for UI and `font-mono` for code | Set the product in a display serif |
| Use `DataTable` or `InfiniteDataTable` for every list | Build a table out of divs or restyle the table frame |
| Use `InstrumentModule` for dualtone blocks | Hand-roll a shell and body |
| Use `subtle-foreground` for tertiary text | Fade `muted-foreground` with opacity |
| Use `tabular-nums` on aligned numbers | Let digits jump as values change |
| Keep one dualtone per group | Nest a card inside a dualtone body |
| Keep the focus ring | Signal state with color alone |
