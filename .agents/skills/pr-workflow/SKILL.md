---
name: pr-workflow
description: Git workflow for pushing code and opening pull requests on GitHub. ALWAYS use this before you git push, push to a remote, open or create a pull request, raise a PR, or "ship" code. Covers confirming the user actually asked to push, cutting a Conventional-Commits feature branch off main, writing a Conventional-Commit PR title, and filling the repo's .github PR template in the team's description style. Use whenever the user says push, ship, open/create a PR, raise a pull request, or commit-and-push.
---

## Workflow

1. **Confirm the user asked — in their latest message.** Pushing to a remote /
   opening a PR is outward-facing and hard to undo. Do it only when the user's
   *most recent* request actually says to push, ship, or open a PR. Approval
   from an earlier turn does **not** carry forward — "make the change" is not
   "push it." If you finished work and the user didn't ask to push, **stop and
   ask.** Never push proactively.

2. **Branch off the default branch.** Unless the user explicitly says to push
   straight to main (e.g. "commit straight to main", "push to main directly"),
   create a feature branch named with Conventional Commits:
   `<type>/<kebab-description>`, e.g. `feat/add-logout-button`.

3. **Commit with a Conventional Commit message**, then push the branch.
   **Always make a new commit.** Never force-push (`git push --force` /
   `--force-with-lease`) and never amend (`git commit --amend`) or otherwise
   rewrite existing commits — unless the user explicitly asks for it in their
   latest message. To update a PR or fix a previous commit, add another commit
   and push normally.

4. **Open the PR** with a Conventional-Commit title
   (`<type>[(scope)][!]: <subject>`, e.g. `feat(auth): add OAuth login`). The
   subject is a plain sentence about the behaviour, e.g.
   `fix(sites): retry a dev page whose body is slower than the poll timeout`.
   For the body, fill the repo's `.github` PR template as described in
   [Writing the description](#writing-the-description). Keep its headings and
   the checklist exactly as written and add **no** extra sections (no
   "## Summary", no "## Test plan"). If there's no template, use the same
   bullet style without the headings.

`type` is one of: `feat fix docs style refactor perf test build ci chore revert`.

## Writing the description

Match the style of the team's existing PRs (e.g. #2308, #2311, #2312):

- **`### Description` is a bullet list**, replacing the template's placeholder
  sentence.
  - The first bullet says what changes for the user or system and why, in one
    or two plain sentences. Name the problem it fixes or the PR it builds on
    (`#2296`).
  - Following bullets cover the specifics: new files and functions in
    backticks (`apps/sites-e2e/emulators/google-fonts`,
    `downloadSiteFonts(plan, { signal, endpoints })`), env vars and where they
    are declared, what triggers it, edge cases, and what stays the same
    ("Production leaves it unset.", "Releases are unchanged.").
  - Mention docs touched (`AGENTS.md`, a README) in their own bullet.
  - The last bullet is always `Written with an AI coding agent.`
- **Then, when it helps, one small visual** under the bullets: a `mermaid`
  flowchart or sequence diagram for flows across services or workflows, or a
  short fenced code snippet (with the file path as a comment) for the one line
  that carries the logic. Skip it for small fixes.
- **`### Screenshot/Recording (if applicable)`**: for UI changes, one context
  line (fixture, viewport) and a before/after table:

  ```markdown
  | State | Before (`main`) | After (this PR) |
  | --- | --- | --- |
  | Closed | ![before](url) | ![after](url) |
  ```

  Otherwise replace the placeholder with `None.`
- **Leave the `<details>` checklist untouched**, boxes unchecked.

Voice: short declarative sentences in present tense, concrete names over
adjectives, no marketing words, no em-dashes. Describe what the code does now,
not how you got there.

## Notes

- **Default branch:** the base for the PR is the repo's default branch — read it
  from `origin/HEAD`, falling back to `main`.
- **Branch names:** lowercase the description, replace spaces and punctuation
  with dashes, prefix the type — `"Add Login (OAuth)"` with type `feat` →
  `feat/add-login-oauth`.
- **Finding the PR template:** check `.github/PULL_REQUEST_TEMPLATE.md` first,
  then the lowercase variant, then the repo root, then `docs/`. The
  `.github/PULL_REQUEST_TEMPLATE/` directory form holds multiple templates — if
  the repo uses it, pass the chosen file to `gh pr create --body-file`.
- **Opening the PR:** write the filled-in body to a file in the scratchpad and
  run `gh pr create --base <default-branch> --title "<conventional title>"
  --body-file <that file>`.

## Gotchas

- **"The user asked earlier" is not the latest message.** Step 1 is about the
  *most recent* request. If it was "fix the bug" and you fixed it, you have
  **not** been asked to push. Ask first.
- **Fill the template, don't extend it.** Replace the placeholder text under
  its headings; leave the headings and checklist exactly as written. Stacking
  your own "## Summary / ## Test plan" on top of the template is wrong, and so
  is leaving the "Give a short summary…" placeholder in place.
- **Never rewrite history to "clean up."** Force-pushing and amending are
  destructive and break anyone who pulled the branch. Even when a previous
  commit was wrong, the default is a new follow-up commit, *not* an amend or
  force-push. Only rewrite when the user explicitly tells you to in their
  latest message.
- **The template lookup checks `.github` first**, then the repo root, then
  `docs/`, and includes the `.github/PULL_REQUEST_TEMPLATE/` directory form
  (multiple templates). If the repo has several, ask which to use.

## Troubleshooting

- `gh pr create` fails with `no default remote repository` → run
  `gh repo set-default <owner>/<repo>` once, or pass `--repo <owner>/<repo>`.
- `gh: not authenticated` → the user must run `gh auth login` themselves
  (suggest they type `! gh auth login`). Don't authenticate for them.
