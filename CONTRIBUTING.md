# Contributing

We accept community contributions. By contributing to Gitty, you agree to follow the [code of conduct](./CODE_OF_CONDUCT.md).

## Project structure

Follow [AGENTS.md](./AGENTS.md) for the canonical project structure and development conventions.

- Keep `src/index.tsx` as a small application bootstrap.
- Put app orchestration in `src/app`.
- Put feature-specific model and UI code under `src/features/<feature>`.
- Put reusable helpers, shared UI, fixtures, and theme values under `src/shared`.
- Put cross-feature widgets under `src/widgets`.
- Extract helpers to `src/shared` only when they are reused across slices. Keep feature-only helpers inside their feature.

## Code style

- Use TypeScript and TSX patterns already present in the codebase.
- Keep refactors scoped to the requested behavior or maintenance goal.
- Avoid mixing unrelated cleanup into feature changes.
- Prefer clear data modeling around diffs, repositories, pull requests, Markdown blocks, and terminal rows over ad hoc string handling.

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

Format commit messages as `<type>(optional-scope): <summary>`.

Common types include `feat`, `fix`, `refactor`, `docs`, `test`, and `chore`.

## Testing

Update tests for your changes when a practical test harness exists. At minimum, run the project typecheck after TypeScript or TSX changes:

```bash
bun run typecheck
```

For terminal UI changes, include manual verification notes in the pull request. Useful coverage includes local working changes, staged changes, patch files, stdin input, multiple repositories, and GitHub pull request views when `gh` is available.

## Documentation

Update [README.md](./README.md) when CLI behavior, keyboard controls, GitHub PR behavior, themes, or local development steps change.

## Dependency and GitHub Actions updates

Please do not open pull requests that only update npm packages, lockfiles, or GitHub Actions versions. We close these PRs from outside collaborators. Only maintainers and approved automated bots may create package and GitHub Actions update PRs.

## Developing

Use Bun for project commands.

```bash
bun install
bun run start
```

Additional commands:

```bash
bun run dev
bun run diff
bun run diff:staged
bun run typecheck
```

## Manual testing

Gitty can read local repositories, patch files, stdin, and staged changes:

```bash
bun run start
bun run start -- path/to/change.patch
git diff | bun run start
bun run diff:staged
```

For GitHub pull request features, install and authenticate the GitHub CLI:

```bash
gh auth login
```
