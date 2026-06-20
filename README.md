<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/assets/gitty-cat-dark-mode.svg">
    <source media="(prefers-color-scheme: light)" srcset="./docs/assets/gitty-cat-light-mode.svg">
    <img src="./docs/assets/gitty-cat-light-mode.svg" alt="Gitty cat icon" width="96" height="96">
  </picture>
</div>

# Gitty

A Bun + OpenTUI terminal diff viewer built with [`hunkdiff/opentui`](https://www.npmjs.com/package/hunkdiff) components and inspired by [Hunk](https://github.com/modem-dev/hunk).

## Local Development

```bash
bun install
bun run start
```

With no input, Gitty shows the current `git diff` plus untracked files when changes exist. If the repo is clean, the repository opens with an empty Working changes view.

You can add multiple git repositories, pass a patch file, read from stdin, or view staged changes:

```bash
gitty path/to/change.patch
gitty --repository ../repo-a --repository ../repo-b
git diff | gitty
gitty --staged
```

Inside the TUI:

- `o` opens another git repository by path. Relative paths and `~` are supported.
- In the open repository dialog, use `Up`/`Down` to pick a directory and `Tab` to complete it.
- `Tab` cycles repositories.
- Click any repository in the sidebar to switch to it.
- Click a PR in the sidebar to open its description. Click the PR URL in the detail header to open it in your browser.
- Click the `x` beside a repository in the sidebar to close it.
- Line wrapping is always on.
- Status messages appear in a bottom-right overlay so command controls stay visible.
- The left sidebar lists repositories, each with a `Working changes` menu item.
- For GitHub repositories, the sidebar also lists open PRs split into `Your pr's` and `Needs your review`, with merge readiness dots and changes-requested notices. PR detail views render a prominent plain title, the description as Markdown in its own block, and reviewers, assignees, labels, and unresolved comment count in a right sidebar.
- The git diff UI lives inside a swappable pane and always renders split diffs.
- `q`, `Esc`, or `Ctrl+C` exits.

Gitty defaults to Catppuccin Macchiato for the app shell and Hunk diff theme. You can still pass `--theme <name>` to try another Hunk theme.

## Notes

This app uses [`hunkdiff/opentui`](https://www.npmjs.com/package/hunkdiff), which declares OpenTUI and React as peer dependencies. The installed OpenTUI package versions are aligned to Hunk's current peer range.

Gitty takes inspiration from [Hunk](https://github.com/modem-dev/hunk), the terminal diff review tool that publishes the reusable `hunkdiff` components.

PR sections use the GitHub CLI when available. Run `gh auth login` if the sidebar reports that PRs are unavailable.

## Attribution

Cat icon created by Dan Hetteix from [The Noun Project](https://thenounproject.com/).
