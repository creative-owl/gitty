# Collaborator guide

As a collaborator, you help administer Gitty. This guide covers the responsibilities that come with that access. For project structure, development commands, and commit conventions, use [AGENTS.md](./AGENTS.md), the canonical contributor guide.

## Code of conduct

Read the [Code of Conduct](./CODE_OF_CONDUCT.md) and help enforce it. Keep the community friendly and welcoming.

## Triage issues

- Apply appropriate labels and respond as needed.
- For bug reports, ask for a minimal reproduction before deeper triage. Useful details include Gitty version or commit SHA, operating system, terminal emulator, terminal size, Bun version, Git version, GitHub CLI version when PR features are involved, and a small repository or patch that reproduces the problem.
- Ask reporters to remove secrets, private repository names, private file paths, and access tokens from screenshots, diffs, logs, and patches.
- For rendering issues, ask whether the problem appears in multiple terminal emulators and whether the issue affects local diffs, staged diffs, patch input, stdin input, or pull request views.
- If an issue is not directly about Gitty, convert it to a discussion or close it with a short explanation.
- Close issues only when they are resolved, a fix is merged, the report lacks enough detail or a reproduction, or the reporter requests closure. Do not close issues only for inactivity.

## Answer questions

Be helpful and patient. If a question comes from unclear docs, update the docs and consider adding an example instead of only answering in the thread. You are not expected to teach Git, GitHub, Bun, terminal configuration, or unrelated tooling. Redirect those questions politely.

## Submit PRs

When opening a PR, make sure:

- The change fits within Gitty's scope as a Bun and OpenTUI terminal diff viewer for repositories, patches, stdin, staged changes, and GitHub pull requests.
- `src/index.tsx` stays a small application bootstrap.
- App orchestration stays in `src/app`, feature-specific model and UI code stays under `src/features/<feature>`, reusable helpers stay under `src/shared` only when reused across slices, and cross-feature widgets stay under `src/widgets`.
- Behavior that shells out to `git`, uses `gh`, reads patches, parses pull request metadata, renders Markdown/Mermaid content, or opens URLs handles failure states clearly and does not leak credentials.
- GitHub pull request features continue to degrade gracefully when `gh` is missing, unauthenticated, or pointed at a repository without a GitHub remote.
- Terminal UI changes work at narrow and wide terminal sizes and avoid text overlap, layout jumps, or hidden controls.
- Public CLI behavior is documented in [README.md](./README.md) when it changes.
- TypeScript or TSX changes pass `bun run typecheck`.
- Bug fixes include a focused regression test when a practical test harness exists. If the behavior is hard to automate, describe the manual verification performed.
- Do not add runtime dependencies without discussion.
- Package, lockfile, or GitHub Actions update PRs are maintainer or approved-bot only.
- PR titles use [Conventional Commits](https://www.conventionalcommits.org/) (`fix:`, `feat:`, `chore:`, `docs:`, etc.).
- Call out whether the change is patch, minor, or breaking.

At least one maintainer must review and approve a PR before merge. If you are unsure about the impact of a change, ask for a second opinion. Call out breaking changes in the PR description. Bug fixes should reproduce the issue and verify the fix whenever possible.

If changes are requested, address them promptly. If you cannot make the changes, say so clearly so someone else can pick them up.

> [!IMPORTANT]
> We wait up to 28 days for a response to requested changes before closing the PR as stale. After that, we will either address the issue in a maintainer-led PR or open an issue for other contributors. If the author wants to continue the work, they should recreate the PR from the latest version of the target branch, address all feedback, and request review from a maintainer.

## Security disclosures

If someone reports a suspected vulnerability in a public issue, do not discuss specifics in the thread. Redirect them to the process described in [SECURITY.md](./SECURITY.md) and close or hide the issue as appropriate.

## What collaborators should not do

- Add runtime dependencies without discussion.
- Merge package, lockfile, or GitHub Actions version update PRs from outside collaborators.
- Weaken handling for local path expansion, repository selection, shell command arguments, URL opening, Markdown/Mermaid rendering, diff parsing, or GitHub CLI output without focused regression coverage.
- Request or publish private repository data, tokens, local machine details, or confidential patches unless they are required for a private security report.

---

Thanks for helping keep Gitty healthy. If you are unsure about a call, ask another collaborator before acting. We would rather move a little slower than ship a regression.
