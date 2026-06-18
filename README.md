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
changes exist. If the repo is clean, the repository opens with an empty Working
changes view.

You can add multiple git repositories, pass a patch file, read from stdin,
or view staged changes:

```bash
bun run start -- path/to/change.patch
bun run start -- --repository ../repo-a --repository ../repo-b
git diff | bun run start
bun run diff:staged
```

Inside the TUI:

- `o` opens another git repository by path. Relative paths and `~` are supported.
- In the open repository dialog, use `Up`/`Down` to pick a directory and `Tab` to complete it.
- `Tab` cycles repositories.
- Click any repository in the sidebar to switch to it.
- Click the `x` beside a repository in the sidebar to close it.
- Line wrapping is always on.
- Status messages appear in a bottom-right overlay so command controls stay visible.
- The left sidebar lists repositories, each with a `Working changes` menu item.
- For GitHub repositories, the sidebar also lists open PRs split into `Opened by you` and `Needs review`.
- The git diff UI lives inside a swappable pane and always renders split diffs.
- `q`, `Esc`, or `Ctrl+C` exits.

Gitty defaults to Catppuccin Macchiato for the app shell and Hunk diff theme.
You can still pass `--theme <name>` to try another Hunk theme.

## Notes

This app uses `hunkdiff/opentui`, which declares OpenTUI and React as peer
dependencies. The installed OpenTUI package versions are aligned to Hunk's
current peer range.

PR sections use the GitHub CLI when available. Run `gh auth login` if the
sidebar reports that PRs are unavailable.
