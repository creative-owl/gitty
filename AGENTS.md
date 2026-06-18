# Agent Instructions

## Project Structure

- Keep `src/index.tsx` as a small application bootstrap.
- Put app orchestration in `src/app`.
- Put feature-specific model and UI code under `src/features/<feature>`.
- Put reusable helpers, shared UI, fixtures, and theme values under `src/shared`.
- Put cross-feature widgets under `src/widgets`.
- Extract helpers to `src/shared` only when they are reused across slices. Keep feature-only helpers inside their feature.

## Development

- Use Bun for project commands.
- Run `bun run typecheck` after TypeScript or TSX changes.
- Keep refactors scoped to the requested behavior or maintenance goal.
- Avoid mixing unrelated cleanup into feature changes.

## Commits

- Use Conventional Commits for all commit messages.
- Format commit messages as `<type>(optional-scope): <summary>`.
- Prefer common types such as `feat`, `fix`, `refactor`, `docs`, `test`, and `chore`.
- Keep summaries concise, imperative, and without a trailing period.
- Examples:
  - `feat: add pull request review threads`
  - `refactor(app): split index into feature slices`
  - `docs: add agent instructions`
