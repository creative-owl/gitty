import { isThemeName, THEME_NAMES, type ThemeName } from "../shared/theme"

export type CliOptions = {
  help: boolean
  patchFile?: string
  staged: boolean
  sample: boolean
  theme: ThemeName
  themeProvided: boolean
  repositoryDirs: string[]
}

export const DEFAULT_THEME: ThemeName = "catppuccin-macchiato"

export function usage() {
  return `Usage:
  gitty [patch-file]
  gitty --repository ../repo-a --repository ../repo-b
  gitty --patch path/to/change.patch
  gitty --staged
  git diff | gitty

Options:
  --patch <file>       Read a unified diff from a file.
  --repository <dir>   Add a git repository. Repeat for multiple repositories.
  --staged            Show staged git changes instead of unstaged changes.
  --sample            Show the built-in sample diff.
  --theme <name>      ${THEME_NAMES.join(", ")}
                      Defaults to ${DEFAULT_THEME}.
  -h, --help          Show this help text.`
}

export function parseCliOptions(args: string[]): CliOptions {
  const options: CliOptions = {
    help: false,
    staged: false,
    sample: false,
    theme: DEFAULT_THEME,
    themeProvided: false,
    repositoryDirs: [],
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (!arg) {
      continue
    }

    if (arg === "-h" || arg === "--help") {
      options.help = true
      continue
    }

    if (arg === "--staged") {
      options.staged = true
      continue
    }

    if (arg === "--sample") {
      options.sample = true
      continue
    }

    if (arg === "--repository" || arg === "--workspace") {
      const next = args[index + 1]
      if (!next) {
        throw new Error(`${arg} requires a git directory`)
      }
      options.repositoryDirs.push(next)
      index += 1
      continue
    }

    if (arg.startsWith("--repository=") || arg.startsWith("--workspace=")) {
      const optionName = arg.startsWith("--repository=") ? "--repository" : "--workspace"
      const next = arg.slice(`${optionName}=`.length)
      if (!next) {
        throw new Error(`${optionName} requires a git directory`)
      }
      options.repositoryDirs.push(next)
      continue
    }

    if (arg === "--wrap" || arg === "--no-sidebar") {
      continue
    }

    if (arg === "--patch") {
      const next = args[index + 1]
      if (!next) {
        throw new Error("--patch requires a file path")
      }
      options.patchFile = next
      index += 1
      continue
    }

    if (arg.startsWith("--patch=")) {
      options.patchFile = arg.slice("--patch=".length)
      continue
    }

    if (arg === "--layout") {
      if (!args[index + 1]) {
        throw new Error("--layout requires a value")
      }
      index += 1
      continue
    }

    if (arg.startsWith("--layout=")) {
      continue
    }

    if (arg === "--theme") {
      const next = args[index + 1]
      if (!isThemeName(next)) {
        throw new Error(`--theme must be one of: ${THEME_NAMES.join(", ")}`)
      }
      options.theme = next
      options.themeProvided = true
      index += 1
      continue
    }

    if (arg.startsWith("--theme=")) {
      const next = arg.slice("--theme=".length)
      if (!isThemeName(next)) {
        throw new Error(`--theme must be one of: ${THEME_NAMES.join(", ")}`)
      }
      options.theme = next
      options.themeProvided = true
      continue
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`)
    }

    if (options.patchFile) {
      throw new Error(`Unexpected extra argument: ${arg}`)
    }
    options.patchFile = arg
  }

  return options
}
