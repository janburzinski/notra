# Visual PR body

Use when the change is visible, directly or indirectly (layout, colors, motion, tooltips, charts, emails, generated output).

````md
- <what the user sees differently>
- <state or breakpoint worth noting>

| State | Before (`main`) | After (this PR) |
| --- | --- | --- |
| Default | ![before](./before-default.png) | ![after](./after-default.png) |
| Hover | ![before](./before-hover.png) | ![after](./after-hover.png) |
| Dark | ![before](./before-dark.png) | ![after](./after-dark.png) |
| Mobile | ![before](./before-mobile.png) | ![after](./after-mobile.png) |

Motion (video, one row):

| Before | After |
| --- | --- |
| <video src="./before.mp4" controls></video> | <video src="./after.mp4" controls></video> |

```ts
// optional: the one prop or API that drives the new look
<Tooltip layout="rows" variant="frosted-glass" maxRows={8} />
```
````

How:

- Capture the same viewport, theme and data for both columns. Before comes from the target branch, after from the PR branch.
- Show every state that can differ: empty, single item, many items, light and dark, narrow viewport.
- Annotate every screenshot in the table (below). An unannotated before/after makes the reviewer play spot-the-difference.
- Upload with `gh pr edit --attach` so `./file.png` references get rewritten. Do not commit images.
- Crop to the changed area. Full-page screenshots hide the change.

## Annotated screenshots

Use the `annotate` skill (install it first if missing, see `../SKILL.md`). It draws handwritten
notes with arrows onto each screenshot and can capture the page itself, so arrows land exactly
on the changed element.

1. Run the target branch somewhere you can reach: a git worktree on another port, or its preview
   deploy. Never stash or reset the PR branch to get "before".
2. Write one capture spec per cell, with the same `url`, `clip`, `viewport` and `colorScheme` on
   both sides. The before notes say what was wrong; the after notes say what changed.

   ```json
   {
     "url": "http://localhost:3001/settings",
     "clip": "#billing-card",
     "out": "before-default.png",
     "notes": [
       { "text": "plan name and price fight for attention", "target": ".plan-header" },
       { "text": "cancel sits next to upgrade", "target": "button.cancel", "mark": "circle" }
     ]
   }
   ```

   ```json
   {
     "url": "http://localhost:3000/settings",
     "clip": "#billing-card",
     "out": "after-default.png",
     "notes": [
       { "text": "price leads, plan name steps back", "target": ".plan-header" },
       { "text": "cancel moved to the overflow menu", "target": "button.more" }
     ]
   }
   ```

3. Run `annotate before.json` and `annotate after.json`, read the warnings, and look at both PNGs.
   Fix anything off (the annotate skill's verify step) before uploading.
4. Use the PNGs in the table and attach them with `gh pr edit --attach`.

Notes:

- Lowercase, 2 to 8 words, the why or what changed. Never describe what is already visible.
- 1 to 3 notes per screenshot, and only on what this PR changed.
- Point at the exact element (the icon, not the card around it).
- Prefer one annotated pair per row over one combined image, so the table still reads row by row.
