# Gitty

A Bun + OpenTUI terminal diff viewer built with Hunk's reusable
`hunkdiff/opentui` components.

## Setup

```bash
bun install
```

## Run

```bash
bun run start
```

With no input, Gitty shows the current `git diff` plus untracked files when
changes exist, otherwise it opens a sample patch.

You can also pass a patch file, read from stdin, or view staged changes:

```bash
bun run start -- path/to/change.patch
git diff | bun run start
bun run diff:staged
```

Inside the TUI:

- `s` toggles split/stack layout.
- `w` toggles line wrapping.
- `h` toggles the file sidebar.
- `q`, `Esc`, or `Ctrl+C` exits.

## Notes

This app uses `hunkdiff/opentui`, which declares OpenTUI and React as peer
dependencies. The installed OpenTUI package versions are aligned to Hunk's
current peer range.
