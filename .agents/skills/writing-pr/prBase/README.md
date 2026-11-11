# prBase

Base templates for PR bodies. Pick the one that matches the change, delete every section that does not apply.

| Change | Template |
| --- | --- |
| Most PRs | [`default.md`](default.md) |
| Anything a user can see (UI, copy, motion, charts, emails) | [`visual.md`](visual.md) |
| Performance, size, latency, cost | [`benchmark.md`](benchmark.md) |
| Hard, high-risk or wide-scoped | [`blog.md`](blog.md) |

Rules that apply to all of them:

- Describe the final squash-merge result only. Never mention earlier iterations, shrunk diffs or commit-to-commit refactors.
- Bullets for prose, no paragraphs and no essays.
- Never write "validation", "tests passed" or "I ran X".
- Prefer a mermaid diagram or a code snippet (internals or sample usage) over a sentence.
- Use code refs (`path/to/file.ts:42`) instead of describing where something lives.
- If the repo has a `.github` PR template, keep its headings and fill them with this style.

Media:

- Before/after is always a table, never loose screenshots.
- Upload with `gh pr edit --attach ./file.png` (rewrites `./file.png` references). Never commit `.github/pr-assets`.
- `agent-browser` can capture both states for the table.
- Annotate the screenshots with the `annotate` skill (handwritten notes and arrows on what changed). Flow in [`visual.md`](visual.md); install steps in [`../SKILL.md`](../SKILL.md).
