---
name: writing-pr
description: Use when writing or editing a pull request title or body.
---

dont write essays, dont include that you ran tests. rather, write a concise body. focus on mermaid codeblock diagrams, code samples/snippets (this can be internals, or even sample usage). use bullet points for the text you do write. 'validation/i ran tests' is not needed
for visual changes (either directly or indirectly) show a table of before and after with uploaded images/videos. (you could use agent-browser for this)
mark up those screenshots with the `annotate` skill: short handwritten notes with arrows that say what changed and why, so reviewers see the decision, not just two pictures. the full flow is in `prBase/visual.md`. if `annotate` is not available (no skill, no `annotate` command), install it first, then load its SKILL.md:

```bash
A=~/.agents/skills/annotate
[ -d "$A" ] || git clone --depth 1 https://github.com/janburzinski/annotate "$A"
[ -d "$A/cli/node_modules" ] || (cd "$A/cli" && bun install)
command -v annotate >/dev/null || { mkdir -p ~/.local/bin && ln -sf "$A/cli/src/index.ts" ~/.local/bin/annotate; }
```

if `~/.local/bin` is not on PATH, call it as `bun ~/.agents/skills/annotate/cli/src/index.ts`.
for benchmarks, always show tables of before/after (baseline from target branch, candidate from the PR)
dont at intermediate PR details - e.g. if we reduced PR size from +6k lines to +1k lines, dont even mention it lol. if we refactored from one commit to another it doesnt matter. only the final aggregate squash merge commit is what matters for commentary
for truely impressive, difficult, or high risk/wide scoped changes you might write the body like a technical blog (again with context, storytelling, code samples/before/after etc diagrams, images whatever.
feel free to use code refs

Templates live in `prBase/`: start from `prBase/README.md`, then use `default.md`, `visual.md`, `benchmark.md` or `blog.md` depending on the change.
