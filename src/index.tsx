import { existsSync, readdirSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { basename, join, resolve } from "node:path"
import {
  CliRenderEvents,
  createCliRenderer,
  SyntaxStyle,
  type CliRenderer,
  type MouseEvent,
  type Selection,
} from "@opentui/core"
import { createRoot, useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import { getFiletypeFromFileName } from "@pierre/diffs"
import {
  HUNK_DIFF_THEME_NAMES,
  HunkReviewStream,
  createHunkDiffFilesFromPatch,
  type HunkDiffFile,
  type HunkDiffSelection,
  type HunkDiffThemeName,
} from "hunkdiff/opentui"
import { Lexer, type Token, type Tokens } from "marked"
import { useEffect, useMemo, useRef, useState } from "react"

type PatchSource = {
  label: string
  patch: string
}

type GitRepositoryRef = {
  name: string
  path: string
}

type RepositoryView = {
  id: string
  name: string
  path: string
  files: HunkDiffFile[]
  pullRequestDetails?: Record<number, PullRequestDetailState>
  pullRequestDiffs?: Record<number, PullRequestDiffState>
  pullRequests?: RepositoryPullRequests
  stats: {
    additions: number
    deletions: number
  }
}

type CliOptions = {
  help: boolean
  patchFile?: string
  staged: boolean
  sample: boolean
  theme: HunkDiffThemeName
  repositoryDirs: string[]
}

type OpenRepositoryStatus = {
  text: string
}

type ClipboardCopyResult =
  | {
      method: string
      ok: true
    }
  | {
      message: string
      ok: false
    }

type ClipboardCommand = {
  command: string[]
  method: string
}

type PathSuggestion = {
  isGitRepository: boolean
  value: string
}

type ActivePane =
  | {
      kind: "working"
      repositoryId: string
    }
  | {
      kind: "pull-request"
      pullRequestNumber: number
      repositoryId: string
    }

type PullRequestCheckState = "failed" | "running" | "passed"

type PullRequestSidebarRow = {
  color: string
  pullRequest?: PullRequestSummary
  rightColor?: string
  rightText?: string
  text: string
}

type PullRequestDetailState =
  | {
      status: "loading"
    }
  | {
      detail: PullRequestDetail
      status: "loaded"
    }
  | {
      message: string
      status: "unavailable"
    }

type PullRequestDiffState =
  | {
      status: "loading"
    }
  | {
      files: HunkDiffFile[]
      status: "loaded"
    }
  | {
      message: string
      status: "unavailable"
    }

type PullRequestDetail = {
  assignees: string[]
  author: string
  body: string
  checkState: PullRequestCheckState
  comments: PullRequestTimelineItem[]
  labels: PullRequestLabel[]
  number: number
  reviewDecision?: string
  reviewers: PullRequestReviewer[]
  title: string
  url: string
}

type PullRequestLabel = {
  color?: string
  name: string
}

type PullRequestReviewer = {
  login: string
  state: string
}

type PullRequestSummary = {
  checkState: PullRequestCheckState
  hasChangesRequested: boolean
  number: number
  title: string
  url: string
}

type PullRequestTimelineItem = {
  author: string
  body: string
  createdAt: string
  kind: "comment" | "review"
  state?: string
}

type PullRequestTab = "diff" | "discussion"

type TextRow = {
  backgroundColor?: string
  color: string
  text: string
}

type GithubAlertType = "caution" | "important" | "note" | "tip" | "warning"

type MarkdownRenderBlock =
  | {
      content: string
      kind: "markdown"
    }
  | MarkdownListBlock
  | {
      body: string
      kind: "details"
      open: boolean
      summary: string
    }
  | {
      content: string
      kind: "mermaid"
    }
  | {
      alertType: GithubAlertType
      content: string
      kind: "github-alert"
    }
  | {
      content: string
      kind: "quote"
    }

type MarkdownListBlock = {
  items: MarkdownListItem[]
  kind: "list"
  ordered: boolean
  start: number
}

type MarkdownListItem = {
  checked?: boolean
  children: MarkdownListBlock[]
  content: string
  task: boolean
}

type TerminalImageRun = {
  backgroundColor: string
  color: string
  text: string
}

type TerminalImageRow = {
  runs: TerminalImageRun[]
}

type DetailsBlock = {
  body: string
  open: boolean
  summary: string
}

type DetailsTag = {
  end: number
  index: number
  kind: "close" | "open"
}

type MarkdownDetailsSegment =
  | {
      content: string
      kind: "details"
    }
  | {
      content: string
      kind: "text"
    }

type MermaidRenderState =
  | {
      status: "loading"
    }
  | {
      rows: TerminalImageRow[]
      status: "rendered"
    }
  | {
      message: string
      sourceRows: TextRow[]
      status: "error"
    }

type SvgBox = {
  bottom: number
  height: number
  left: number
  right: number
  top: number
  width: number
  x: number
  y: number
}

type RgbColor = {
  b: number
  g: number
  r: number
}

type MermaidDomWindow = Window & {
  CSSStyleSheet: typeof CSSStyleSheet
  Element: typeof Element
  HTMLElement: typeof HTMLElement
  SVGElement: typeof SVGElement
  document: Document
  navigator: Navigator
}

type RepositoryPullRequests =
  | {
      status: "loading"
    }
  | {
      openedByUser: PullRequestSummary[]
      needsReview: PullRequestSummary[]
      status: "loaded"
    }
  | {
      message: string
      status: "unavailable"
    }

const DEFAULT_THEME: HunkDiffThemeName = "catppuccin-macchiato"
const NULL_DIFF_PATH = "/dev/null"
const OPEN_REPOSITORY_SUGGESTION_ROWS = 5
const PR_DETAIL_SIDEBAR_MAX_WIDTH = 32
const PR_DETAIL_SIDEBAR_MIN_WIDTH = 22
const PR_DETAIL_SIDEBAR_RATIO = 0.32
const PULL_REQUEST_SECTION_LIMIT = 3
const PULL_REQUEST_STATUS_DOT = "●"
const PULL_REQUEST_STATUS_WIDTH = 1
const REPOSITORY_CLOSE_CONTROL_WIDTH = 3
const REPOSITORY_SIDEBAR_MAX_WIDTH = 45
const REPOSITORY_SIDEBAR_MIN_WIDTH = 29
const REPOSITORY_SIDEBAR_WIDTH_RATIO = 0.36
const STATUS_OVERLAY_DISMISS_MS = 5000
const STATUS_OVERLAY_MAX_WIDTH = 56
const STATUS_OVERLAY_MIN_WIDTH = 24

const MACCHIATO = {
  blue: "#8aadf4",
  green: "#a6da95",
  mauve: "#c6a0f6",
  lavender: "#b7bdf8",
  red: "#ed8796",
  text: "#cad3f5",
  yellow: "#eed49f",
  subtext0: "#a5adcb",
  surface2: "#5b6078",
  surface0: "#363a4f",
  base: "#24273a",
  mantle: "#1e2030",
} as const

const MARKDOWN_SYNTAX_STYLE = SyntaxStyle.fromStyles({
  default: { fg: MACCHIATO.text },
  conceal: { fg: MACCHIATO.surface2 },
  markup: { fg: MACCHIATO.subtext0 },
  "markup.heading": { bold: true, fg: MACCHIATO.mauve },
  "markup.italic": { fg: MACCHIATO.text, italic: true },
  "markup.link": { fg: MACCHIATO.blue, underline: true },
  "markup.link.label": { fg: MACCHIATO.blue, underline: true },
  "markup.link.url": { fg: MACCHIATO.subtext0 },
  "markup.raw": { bg: MACCHIATO.surface0, fg: MACCHIATO.green },
  "markup.strikethrough": { dim: true, fg: MACCHIATO.subtext0 },
  "markup.strong": { bold: true, fg: MACCHIATO.lavender },
})

const MARKDOWN_TABLE_OPTIONS = {
  borderColor: MACCHIATO.surface2,
  borders: true,
  borderStyle: "rounded",
  cellPadding: 1,
  outerBorder: true,
  selectable: true,
  style: "grid",
  widthMode: "full",
  wrapMode: "word",
} as const

const MARKDOWN_LIST_INDENT_WIDTH = 2
const MERMAID_MAX_TERMINAL_ROWS = 32
const MERMAID_MAX_TERMINAL_WIDTH = 120
const MERMAID_MIN_TERMINAL_WIDTH = 12
const MERMAID_RENDER_BACKGROUND = MACCHIATO.surface0
const MERMAID_RENDER_PALETTE = [
  MACCHIATO.base,
  MACCHIATO.mantle,
  MACCHIATO.surface0,
  MACCHIATO.surface2,
  MACCHIATO.subtext0,
  MACCHIATO.text,
  MACCHIATO.blue,
  MACCHIATO.green,
  MACCHIATO.lavender,
  MACCHIATO.mauve,
  MACCHIATO.red,
  MACCHIATO.yellow,
] as const

const GITHUB_ALERTS: Record<GithubAlertType, { color: string; title: string }> = {
  caution: { color: MACCHIATO.red, title: "Caution" },
  important: { color: MACCHIATO.mauve, title: "Important" },
  note: { color: MACCHIATO.blue, title: "Note" },
  tip: { color: MACCHIATO.green, title: "Tip" },
  warning: { color: MACCHIATO.yellow, title: "Warning" },
}

let mermaidDomReady = false
let mermaidModulePromise: Promise<typeof import("mermaid")["default"]> | undefined
let mermaidRenderCounter = 0
let mermaidRenderQueue: Promise<void> = Promise.resolve()

const EMPTY_DIFF_FILES: HunkDiffFile[] = []
const nearestMermaidColorCache = new Map<string, string>()
const mermaidPaletteRgb = MERMAID_RENDER_PALETTE.map((color) => ({
  color,
  rgb: hexToRgb(color),
}))

const FAILED_CHECK_STATES = new Set([
  "ACTION_REQUIRED",
  "CANCELLED",
  "ERROR",
  "FAILED",
  "FAILURE",
  "STARTUP_FAILURE",
  "TIMED_OUT",
])
const PASSED_CHECK_STATES = new Set(["NEUTRAL", "SKIPPED", "SUCCESS"])
const RUNNING_CHECK_STATES = new Set(["EXPECTED", "IN_PROGRESS", "PENDING", "QUEUED", "REQUESTED", "WAITING"])

const SAMPLE_PATCH = `diff --git a/src/greeting.ts b/src/greeting.ts
index 87ab12d..41ef982 100644
--- a/src/greeting.ts
+++ b/src/greeting.ts
@@ -1,8 +1,12 @@
-export function greeting(name: string) {
-  return \`Hello, \${name}.\`
+export function greeting(name: string) {
+  const normalized = name.trim()
+
+  return \`Hello, \${normalized}!\`
 }
 
-export function farewell(name: string) {
-  return \`Goodbye, \${name}.\`
+export function farewell(name: string, formal = false) {
+  if (formal) {
+    return \`Goodbye, \${name}.\`
+  }
+  return \`See you later, \${name}.\`
 }
diff --git a/src/index.ts b/src/index.ts
index 5ca1d77..cc43c91 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,5 +1,9 @@
 import { greeting } from "./greeting"
 
-console.log(greeting("OpenTUI"))
+const name = process.argv[2] ?? "OpenTUI"
+
+console.log(greeting(name))
+console.log("Diffs are now visible in the terminal.")
`

function usage() {
  return `Usage:
  bun run start -- [patch-file]
  bun run start -- --repository ../repo-a --repository ../repo-b
  bun run start -- --patch path/to/change.patch
  bun run start -- --staged
  git diff | bun run start

Options:
  --patch <file>       Read a unified diff from a file.
  --repository <dir>   Add a git repository. Repeat for multiple repositories.
  --staged            Show staged git changes instead of unstaged changes.
  --sample            Show the built-in sample diff.
  --theme <name>      ${HUNK_DIFF_THEME_NAMES.join(", ")}
                      Defaults to ${DEFAULT_THEME}.
  -h, --help          Show this help text.`
}

function parseCliOptions(args: string[]): CliOptions {
  const options: CliOptions = {
    help: false,
    staged: false,
    sample: false,
    theme: DEFAULT_THEME,
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
      if (!isTheme(next)) {
        throw new Error(`--theme must be one of: ${HUNK_DIFF_THEME_NAMES.join(", ")}`)
      }
      options.theme = next
      index += 1
      continue
    }

    if (arg.startsWith("--theme=")) {
      const next = arg.slice("--theme=".length)
      if (!isTheme(next)) {
        throw new Error(`--theme must be one of: ${HUNK_DIFF_THEME_NAMES.join(", ")}`)
      }
      options.theme = next
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

function isTheme(value: string | undefined): value is HunkDiffThemeName {
  return HUNK_DIFF_THEME_NAMES.includes(value as HunkDiffThemeName)
}

async function resolveRepositories(options: CliOptions): Promise<RepositoryView[]> {
  if (options.sample) {
    return [createPatchRepository({ label: "sample patch", patch: SAMPLE_PATCH }, "Sample")]
  }

  if (options.patchFile) {
    return [
      createPatchRepository(
        {
          label: options.patchFile,
          patch: readFileSync(options.patchFile, "utf8"),
        },
        basename(options.patchFile) || "Patch",
      ),
    ]
  }

  if (options.repositoryDirs.length > 0) {
    return resolveGitRepositoryViews(options.repositoryDirs, options.staged)
  }

  if (!process.stdin.isTTY) {
    const patch = await Bun.stdin.text()
    if (patch.trim().length > 0) {
      return [createPatchRepository({ label: "stdin", patch }, "stdin")]
    }
  }

  return resolveGitRepositoryViews([process.cwd()], options.staged)
}

function createPatchRepository(source: PatchSource, name: string): RepositoryView {
  const files = parsePatchFiles(source)
  return {
    id: `patch:${source.label}`,
    name,
    path: source.label,
    files,
    stats: summarizeFiles(files),
  }
}

function resolveGitRepositoryViews(directories: string[], staged: boolean): RepositoryView[] {
  const seenPaths = new Set<string>()
  const refs: GitRepositoryRef[] = []

  for (const directory of directories) {
    const ref = resolveGitRepository(directory)
    if (seenPaths.has(ref.path)) {
      continue
    }
    seenPaths.add(ref.path)
    refs.push(ref)
  }

  return refs.map((repository) => createGitRepositoryView(repository, staged))
}

function createGitRepositoryView(repository: GitRepositoryRef, staged: boolean): RepositoryView {
  const sourceLabel = `${repository.name} ${staged ? "staged changes" : "working changes"}`
  const patch = readGitDiff(staged, repository.path)
  const files = patch.trim().length > 0 ? createDiffFilesFromPatch(patch, sourceLabel) : []

  return {
    id: `repository:${repository.path}`,
    name: repository.name,
    path: repository.path,
    files,
    pullRequests: { status: "loading" },
    stats: summarizeFiles(files),
  }
}

function openGitRepository(directory: string, staged: boolean): RepositoryView {
  return createGitRepositoryView(resolveGitRepository(directory), staged)
}

function resolveGitRepository(directory: string): GitRepositoryRef {
  const absolutePath = resolve(expandHomePath(directory))
  let result: ReturnType<typeof Bun.spawnSync>

  try {
    result = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], {
      cwd: absolutePath,
      stderr: "pipe",
      stdout: "pipe",
    })
  } catch {
    throw new Error(`Repository is not accessible: ${directory}`)
  }

  if (result.exitCode !== 0) {
    const detail = new TextDecoder().decode(result.stderr).trim()
    throw new Error(`Repository must be inside a git repository: ${directory}${detail ? ` (${detail})` : ""}`)
  }

  const path = new TextDecoder().decode(result.stdout).trim()
  return {
    name: basename(path) || path,
    path,
  }
}

function expandHomePath(directory: string): string {
  if (directory === "~") {
    return homedir()
  }
  if (directory.startsWith("~/")) {
    return join(homedir(), directory.slice(2))
  }
  return directory
}

function createPathSuggestions(input: string): PathSuggestion[] {
  const context = resolvePathCompletionContext(input)
  const entries = readDirectoryEntries(context.directoryPath)

  const fragment = context.fragment.toLowerCase()
  const dotSuggestions = createDotPathSuggestions(context)
  const directorySuggestions = entries
    .filter((entry) => entry.isDirectory())
    .filter((entry) => (context.fragment.startsWith(".") ? true : !entry.name.startsWith(".")))
    .filter((entry) => entry.name.toLowerCase().startsWith(fragment))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const value = `${context.valuePrefix}${entry.name}/`
      return {
        isGitRepository: existsSync(join(context.directoryPath, entry.name, ".git")),
        value,
      }
    })

  return [...dotSuggestions, ...directorySuggestions].slice(0, OPEN_REPOSITORY_SUGGESTION_ROWS)
}

function readDirectoryEntries(directoryPath: string) {
  try {
    return readdirSync(directoryPath, { withFileTypes: true })
  } catch {
    return []
  }
}

function resolvePathCompletionContext(input: string) {
  if (input === "") {
    return {
      directoryPath: process.cwd(),
      fragment: "",
      valuePrefix: "",
    }
  }

  if (input === "~") {
    return {
      directoryPath: homedir(),
      fragment: "",
      valuePrefix: "~/",
    }
  }

  const lastSlashIndex = input.lastIndexOf("/")
  if (lastSlashIndex >= 0) {
    const valuePrefix = input.slice(0, lastSlashIndex + 1)
    return {
      directoryPath: resolve(expandHomePath(valuePrefix)),
      fragment: input.slice(lastSlashIndex + 1),
      valuePrefix,
    }
  }

  return {
    directoryPath: process.cwd(),
    fragment: input,
    valuePrefix: "",
  }
}

function createDotPathSuggestions({
  directoryPath,
  fragment,
  valuePrefix,
}: {
  directoryPath: string
  fragment: string
  valuePrefix: string
}): PathSuggestion[] {
  if (valuePrefix !== "") {
    return []
  }

  return [
    { isGitRepository: existsSync(join(directoryPath, ".git")), value: "./" },
    { isGitRepository: existsSync(join(resolve(directoryPath, ".."), ".git")), value: "../" },
  ].filter((suggestion) => suggestion.value.startsWith(fragment))
}

async function loadRepositoryPullRequests(repositoryPath: string): Promise<RepositoryPullRequests> {
  const [openedByUser, needsReview] = await Promise.all([
    readGhPullRequests(repositoryPath, "author:@me"),
    readGhPullRequests(repositoryPath, "review-requested:@me"),
  ])

  if (!openedByUser.ok && !needsReview.ok) {
    return {
      message: openedByUser.message,
      status: "unavailable",
    }
  }

  return {
    openedByUser: openedByUser.ok ? openedByUser.pullRequests : [],
    needsReview: needsReview.ok ? needsReview.pullRequests : [],
    status: "loaded",
  }
}

async function readGhPullRequests(
  repositoryPath: string,
  search: string,
): Promise<
  | {
      ok: true
      pullRequests: PullRequestSummary[]
    }
  | {
      message: string
      ok: false
    }
> {
  try {
    const process = Bun.spawn(
      [
        "gh",
        "pr",
        "list",
        "--state",
        "open",
        "--limit",
        "30",
        "--search",
        search,
        "--json",
        "number,reviewDecision,statusCheckRollup,title,url",
      ],
      {
        cwd: repositoryPath,
        env: createGhEnvironment(),
        stderr: "pipe",
        stdin: "ignore",
        stdout: "pipe",
      },
    )

    const [exitCode, stdout, stderr] = await Promise.all([
      process.exited,
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
    ])

    if (exitCode !== 0) {
      return {
        message: summarizeGhError(stderr),
        ok: false,
      }
    }

    return {
      ok: true,
      pullRequests: parsePullRequestSummaries(stdout),
    }
  } catch (error) {
    return {
      message: error instanceof SyntaxError ? "Could not parse GitHub PRs." : "Install and authenticate gh to show PRs.",
      ok: false,
    }
  }
}

async function readGhPullRequestDetail(
  repositoryPath: string,
  pullRequestNumber: number,
): Promise<PullRequestDetailState> {
  try {
    const process = Bun.spawn(
      [
        "gh",
        "pr",
        "view",
        String(pullRequestNumber),
        "--json",
        "assignees,author,body,comments,labels,latestReviews,number,reviewDecision,reviewRequests,reviews,statusCheckRollup,title,url",
      ],
      {
        cwd: repositoryPath,
        env: createGhEnvironment(),
        stderr: "pipe",
        stdin: "ignore",
        stdout: "pipe",
      },
    )

    const [exitCode, stdout, stderr] = await Promise.all([
      process.exited,
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
    ])

    if (exitCode !== 0) {
      return {
        message: summarizeGhError(stderr),
        status: "unavailable",
      }
    }

    return {
      detail: parsePullRequestDetail(stdout),
      status: "loaded",
    }
  } catch (error) {
    return {
      message: error instanceof SyntaxError ? "Could not parse PR details." : "Could not load PR details.",
      status: "unavailable",
    }
  }
}

async function readGhPullRequestDiff(
  repositoryPath: string,
  pullRequestNumber: number,
): Promise<PullRequestDiffState> {
  try {
    const process = Bun.spawn(["gh", "pr", "diff", String(pullRequestNumber), "--patch"], {
      cwd: repositoryPath,
      env: createGhEnvironment(),
      stderr: "pipe",
      stdin: "ignore",
      stdout: "pipe",
    })

    const [exitCode, stdout, stderr] = await Promise.all([
      process.exited,
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
    ])

    if (exitCode !== 0) {
      return {
        message: summarizeGhError(stderr),
        status: "unavailable",
      }
    }

    return {
      files: stdout.trim() ? createDiffFilesFromPatch(stdout, `PR #${pullRequestNumber}`) : [],
      status: "loaded",
    }
  } catch {
    return {
      message: "Could not load PR diff.",
      status: "unavailable",
    }
  }
}

function createGhEnvironment(): Record<string, string> {
  const environment: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      environment[key] = value
    }
  }
  environment.GH_PROMPT_DISABLED = "1"
  return environment
}

function summarizeGhError(stderr: string): string {
  const detail = stderr.trim().split("\n").find(Boolean)
  if (!detail) {
    return "Could not load GitHub PRs."
  }
  if (detail.toLowerCase().includes("not a github repository")) {
    return "No GitHub remote found."
  }
  if (detail.toLowerCase().includes("authentication")) {
    return "Authenticate gh to show PRs."
  }
  return detail
}

function openExternalUrl(url: string): string | undefined {
  const trimmedUrl = url.trim()
  if (!/^https?:\/\//i.test(trimmedUrl)) {
    return "No browser URL available for this PR."
  }

  const command = createExternalUrlCommand(trimmedUrl)
  if (!command) {
    return "Opening URLs is not supported on this platform."
  }

  try {
    const result = Bun.spawnSync(command, {
      stderr: "pipe",
      stdin: "ignore",
      stdout: "ignore",
    })

    if (result.exitCode === 0) {
      return undefined
    }

    return result.stderr.toString().trim().split("\n").find(Boolean) || "Could not open PR URL."
  } catch {
    return "Could not open PR URL."
  }
}

function createExternalUrlCommand(url: string): string[] | undefined {
  if (process.platform === "darwin") {
    return ["open", url]
  }

  if (process.platform === "win32") {
    return ["cmd.exe", "/c", "start", "", url]
  }

  if (process.platform === "linux") {
    return ["xdg-open", url]
  }

  return undefined
}

function copyTextToClipboard(renderer: CliRenderer, text: string): ClipboardCopyResult {
  if (!text) {
    return {
      message: "No selected text to copy.",
      ok: false,
    }
  }

  try {
    if (renderer.copyToClipboardOSC52(text)) {
      return {
        method: "terminal clipboard",
        ok: true,
      }
    }
  } catch {
    // Fall back to platform clipboard helpers below.
  }

  const clipboardCommand = createClipboardCommand()
  if (!clipboardCommand) {
    return {
      message: "Clipboard copy is not supported on this platform.",
      ok: false,
    }
  }

  try {
    const result = Bun.spawnSync(clipboardCommand.command, {
      stderr: "pipe",
      stdin: new TextEncoder().encode(text),
      stdout: "ignore",
    })

    if (result.exitCode === 0) {
      return {
        method: clipboardCommand.method,
        ok: true,
      }
    }

    const detail = result.stderr.toString().trim().split("\n").find(Boolean)
    return {
      message: detail ? `Clipboard copy failed: ${detail}` : "Clipboard copy failed.",
      ok: false,
    }
  } catch {
    return {
      message: "Clipboard copy failed.",
      ok: false,
    }
  }
}

function createClipboardCommand(): ClipboardCommand | undefined {
  if (process.platform === "darwin") {
    return findClipboardCommand([{ command: ["pbcopy"], method: "pbcopy" }])
  }

  if (process.platform === "win32") {
    return findClipboardCommand([
      { command: ["clip.exe"], method: "clip.exe" },
      { command: ["powershell.exe", "-NoProfile", "-Command", "Set-Clipboard"], method: "PowerShell" },
    ])
  }

  if (process.platform === "linux") {
    return findClipboardCommand([
      { command: ["wl-copy"], method: "wl-copy" },
      { command: ["xclip", "-selection", "clipboard"], method: "xclip" },
      { command: ["xsel", "--clipboard", "--input"], method: "xsel" },
    ])
  }

  return undefined
}

function findClipboardCommand(commands: ClipboardCommand[]): ClipboardCommand | undefined {
  return commands.find((clipboardCommand) => Bun.which(clipboardCommand.command[0] ?? ""))
}

function formatCopiedSelectionStatus(text: string) {
  const lines = text.split(/\r\n|\r|\n/).length
  if (lines > 1) {
    return `Copied ${pluralize(lines, "line")} to clipboard.`
  }
  return `Copied ${pluralize([...text].length, "character")} to clipboard.`
}

function parsePullRequestSummaries(stdout: string): PullRequestSummary[] {
  const parsed = JSON.parse(stdout) as unknown
  if (!Array.isArray(parsed)) {
    return []
  }

  return parsed.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return []
    }

    const candidate = item as Record<string, unknown>
    if (typeof candidate.number !== "number" || typeof candidate.title !== "string") {
      return []
    }

    return [
      {
        checkState: resolvePullRequestCheckState(candidate.statusCheckRollup),
        hasChangesRequested: normalizeGitHubState(candidate.reviewDecision) === "CHANGES_REQUESTED",
        number: candidate.number,
        title: candidate.title,
        url: typeof candidate.url === "string" ? candidate.url : "",
      },
    ]
  })
}

function parsePullRequestDetail(stdout: string): PullRequestDetail {
  const parsed = JSON.parse(stdout) as unknown
  if (!isRecord(parsed)) {
    throw new SyntaxError("PR detail response must be an object.")
  }

  return {
    assignees: parsePersonList(parsed.assignees),
    author: readPersonName(parsed.author) || "Unknown",
    body: readString(parsed.body).trim(),
    checkState: resolvePullRequestCheckState(parsed.statusCheckRollup),
    comments: parsePullRequestTimeline(parsed.comments, parsed.reviews || parsed.latestReviews),
    labels: parsePullRequestLabels(parsed.labels),
    number: typeof parsed.number === "number" ? parsed.number : 0,
    reviewDecision: formatGitHubStateLabel(parsed.reviewDecision),
    reviewers: parsePullRequestReviewers(parsed.latestReviews, parsed.reviewRequests),
    title: readString(parsed.title),
    url: readString(parsed.url),
  }
}

function parsePullRequestTimeline(comments: unknown, latestReviews: unknown): PullRequestTimelineItem[] {
  const commentItems = asArray(comments).flatMap((comment) => {
    if (!isRecord(comment)) {
      return []
    }

    const body = readString(comment.body).trim()
    if (!body) {
      return []
    }

    return [
      {
        author: readPersonName(comment.author) || "Unknown",
        body,
        createdAt: readString(comment.createdAt),
        kind: "comment" as const,
      },
    ]
  })

  const reviewItems = asArray(latestReviews).flatMap((review) => {
    if (!isRecord(review)) {
      return []
    }

    const state = formatGitHubStateLabel(review.state)
    const body = readString(review.body).trim()
    if (!body && !state) {
      return []
    }

    return [
      {
        author: readPersonName(review.author) || "Unknown",
        body: body || `Review: ${state}`,
        createdAt: readString(review.submittedAt) || readString(review.createdAt),
        kind: "review" as const,
        state,
      },
    ]
  })

  return [...commentItems, ...reviewItems].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

function parsePullRequestReviewers(latestReviews: unknown, reviewRequests: unknown): PullRequestReviewer[] {
  const reviewers = new Map<string, PullRequestReviewer>()

  for (const review of asArray(latestReviews)) {
    if (!isRecord(review)) {
      continue
    }

    const login = readPersonName(review.author)
    if (!login) {
      continue
    }

    reviewers.set(login, {
      login,
      state: formatGitHubStateLabel(review.state) || "Reviewed",
    })
  }

  for (const login of parsePersonList(reviewRequests)) {
    if (!reviewers.has(login)) {
      reviewers.set(login, {
        login,
        state: "Requested",
      })
    }
  }

  return [...reviewers.values()].sort((a, b) => a.login.localeCompare(b.login))
}

function parsePullRequestLabels(labels: unknown): PullRequestLabel[] {
  return asArray(labels)
    .flatMap((label) => {
      if (!isRecord(label)) {
        return []
      }

      const name = readString(label.name)
      if (!name) {
        return []
      }

      return [
        {
          color: normalizeGitHubLabelColor(label.color),
          name,
        },
      ]
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

function parsePersonList(value: unknown): string[] {
  const names = asPersonArray(value).flatMap((item) => {
    const name = readPersonName(item)
    return name ? [name] : []
  })

  return [...new Set(names)].sort((a, b) => a.localeCompare(b))
}

function asPersonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value
  }

  if (!isRecord(value)) {
    return []
  }

  return [...asArray(value.nodes), ...asArray(value.users), ...asArray(value.teams)]
}

function readPersonName(value: unknown) {
  if (!isRecord(value)) {
    return ""
  }

  return readString(value.login) || readString(value.slug) || readString(value.name)
}

function readString(value: unknown) {
  return typeof value === "string" ? value : ""
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}

function normalizeGitHubLabelColor(value: unknown) {
  const color = readString(value).replace(/^#/, "")
  if (/^[a-f0-9]{6}$/i.test(color)) {
    return `#${color}`
  }
  return undefined
}

function resolvePullRequestCheckState(statusCheckRollup: unknown): PullRequestCheckState {
  const checks = normalizeStatusCheckRollup(statusCheckRollup)
  if (checks.length === 0) {
    return "passed"
  }

  let hasRunningCheck = false
  for (const check of checks) {
    const checkState = resolveStatusCheckState(check)
    if (checkState === "failed") {
      return "failed"
    }
    if (checkState === "running") {
      hasRunningCheck = true
    }
  }

  return hasRunningCheck ? "running" : "passed"
}

function normalizeStatusCheckRollup(statusCheckRollup: unknown): unknown[] {
  if (Array.isArray(statusCheckRollup)) {
    return statusCheckRollup
  }

  if (!statusCheckRollup || typeof statusCheckRollup !== "object") {
    return []
  }

  const candidate = statusCheckRollup as Record<string, unknown>
  return Array.isArray(candidate.nodes) ? candidate.nodes : []
}

function resolveStatusCheckState(check: unknown): PullRequestCheckState {
  if (!check || typeof check !== "object") {
    return "running"
  }

  const candidate = check as Record<string, unknown>
  const states = [candidate.conclusion, candidate.state, candidate.status].flatMap((value) => {
    const normalized = normalizeGitHubState(value)
    return normalized ? [normalized] : []
  })

  if (states.some((state) => FAILED_CHECK_STATES.has(state))) {
    return "failed"
  }
  if (states.some((state) => RUNNING_CHECK_STATES.has(state))) {
    return "running"
  }
  if (states.some((state) => PASSED_CHECK_STATES.has(state))) {
    return "passed"
  }

  return "running"
}

function normalizeGitHubState(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().toUpperCase().replace(/[-\s]+/g, "_")
    : undefined
}

function formatGitHubStateLabel(value: unknown) {
  const normalized = normalizeGitHubState(value)
  if (!normalized) {
    return ""
  }

  return normalized
    .toLowerCase()
    .split("_")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ")
}

function readGitDiff(staged: boolean, repositoryPath: string): string {
  const args = ["diff", "--no-ext-diff", "--src-prefix=a/", "--dst-prefix=b/"]
  if (staged) {
    args.splice(1, 0, "--cached")
  }

  const result = Bun.spawnSync(["git", ...args], {
    cwd: repositoryPath,
    stderr: "pipe",
    stdout: "pipe",
  })

  if (result.exitCode !== 0) {
    return ""
  }

  const trackedPatch = new TextDecoder().decode(result.stdout)
  if (staged) {
    return trackedPatch
  }

  const untrackedPatch = readUntrackedFilePatches(repositoryPath)
  return [trackedPatch.trimEnd(), untrackedPatch.trimEnd()].filter(Boolean).join("\n")
}

function readUntrackedFilePatches(repositoryPath: string): string {
  const result = Bun.spawnSync(["git", "ls-files", "--others", "--exclude-standard", "-z"], {
    cwd: repositoryPath,
    stderr: "pipe",
    stdout: "pipe",
  })

  if (result.exitCode !== 0) {
    return ""
  }

  const paths = new TextDecoder().decode(result.stdout).split("\0").filter(Boolean)
  return paths.map((filePath) => createUntrackedFilePatch(repositoryPath, filePath)).filter(Boolean).join("\n")
}

function createUntrackedFilePatch(repositoryPath: string, filePath: string): string {
  let contents = ""

  try {
    contents = readFileSync(join(repositoryPath, filePath), "utf8")
  } catch {
    return ""
  }

  const hasTrailingNewline = contents.endsWith("\n")
  const lines = contents.length === 0 ? [] : (hasTrailingNewline ? contents.slice(0, -1) : contents).split("\n")
  const hunk =
    lines.length === 0
      ? "@@ -0,0 +0,0 @@"
      : [
          `@@ -0,0 +1,${lines.length} @@`,
          ...lines.map((line) => `+${line}`),
          ...(hasTrailingNewline ? [] : ["\\ No newline at end of file"]),
        ].join("\n")

  return [
    `diff --git a/${filePath} b/${filePath}`,
    "new file mode 100644",
    "index 0000000..0000000",
    "--- /dev/null",
    `+++ b/${filePath}`,
    hunk,
    "",
  ].join("\n")
}

function parsePatchFiles(source: PatchSource): HunkDiffFile[] {
  const files = createDiffFilesFromPatch(source.patch, source.label)
  if (files.length === 0) {
    throw new Error(`No file diffs found in ${source.label}.`)
  }
  return files
}

function createDiffFilesFromPatch(patch: string, sourceLabel: string): HunkDiffFile[] {
  return createHunkDiffFilesFromPatch(patch, sourceLabel).map(withDetectedLanguage)
}

function withDetectedLanguage(file: HunkDiffFile): HunkDiffFile {
  if (file.language) {
    return file
  }

  const languagePath = [file.path, file.metadata.name, file.previousPath, file.metadata.prevName].find(
    (path) => path && path !== NULL_DIFF_PATH,
  )
  if (!languagePath) {
    return file
  }

  return {
    ...file,
    language: getFiletypeFromFileName(languagePath),
  }
}

function summarizeFiles(files: HunkDiffFile[]) {
  return files.reduce(
    (acc, file) => ({
      additions: acc.additions + file.stats.additions,
      deletions: acc.deletions + file.stats.deletions,
    }),
    { additions: 0, deletions: 0 },
  )
}

function fitText(value: string, width: number) {
  if (width <= 0) {
    return ""
  }
  if (value.length <= width) {
    return value
  }
  if (width <= 1) {
    return value.slice(0, width)
  }
  if (width <= 3) {
    return value.slice(0, width)
  }
  return `${value.slice(0, width - 3)}...`
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

function wrapText(value: string, width: number) {
  if (width <= 0) {
    return []
  }

  const rows: string[] = []
  for (const rawLine of value.replace(/\r\n/g, "\n").split("\n")) {
    if (!rawLine.trim()) {
      rows.push("")
      continue
    }

    let remaining = rawLine
    while (remaining.length > width) {
      const breakIndex = remaining.lastIndexOf(" ", width)
      const sliceEnd = breakIndex > 0 ? breakIndex : width
      rows.push(remaining.slice(0, sliceEnd).trimEnd())
      remaining = remaining.slice(sliceEnd).trimStart()
    }
    rows.push(remaining)
  }

  return rows
}

function pushWrappedRows(
  rows: TextRow[],
  text: string,
  width: number,
  color: string = MACCHIATO.text,
  backgroundColor?: string,
) {
  const wrappedRows = wrapText(text, width)
  if (wrappedRows.length === 0) {
    rows.push({ backgroundColor, color, text: "" })
    return
  }

  for (const wrappedRow of wrappedRows) {
    rows.push({ backgroundColor, color, text: wrappedRow })
  }
}

function stripHtmlComments(value: string) {
  return value.replace(/<!--[\s\S]*?-->/g, "")
}

function createMarkdownBlocks(markdown: string, emptyText = "No description."): MarkdownRenderBlock[] {
  const source = normalizeGithubMarkdown(stripHtmlComments(markdown)).replace(/\r\n/g, "\n")
  if (!source.trim()) {
    return [{ content: emptyText, kind: "markdown" }]
  }

  const blocks: MarkdownRenderBlock[] = []
  for (const segment of splitMarkdownDetailsBlocks(source)) {
    if (segment.kind === "text") {
      pushMarkdownAndMermaidBlocks(blocks, segment.content)
      continue
    }

    blocks.push({
      kind: "details",
      ...parseDetailsBlock(segment.content),
    })
  }

  return blocks.length > 0 ? blocks : [{ content: emptyText, kind: "markdown" }]
}

function splitMarkdownDetailsBlocks(source: string): MarkdownDetailsSegment[] {
  const tags = collectMarkdownDetailsTags(source)
  const segments: MarkdownDetailsSegment[] = []
  let cursor = 0
  let tagIndex = 0

  while (tagIndex < tags.length) {
    const openTagIndex = tags.findIndex((tag, index) => index >= tagIndex && tag.index >= cursor && tag.kind === "open")
    if (openTagIndex === -1) {
      break
    }

    const openTag = tags[openTagIndex]!
    let closeTag: DetailsTag | undefined
    let depth = 0

    for (let index = openTagIndex; index < tags.length; index += 1) {
      const tag = tags[index]!
      if (tag.kind === "open") {
        depth += 1
      } else {
        depth -= 1
      }

      if (depth === 0) {
        closeTag = tag
        tagIndex = index + 1
        break
      }
    }

    if (!closeTag) {
      break
    }

    if (openTag.index > cursor) {
      segments.push({ content: source.slice(cursor, openTag.index), kind: "text" })
    }
    segments.push({ content: source.slice(openTag.index, closeTag.end), kind: "details" })
    cursor = closeTag.end
  }

  if (cursor < source.length) {
    segments.push({ content: source.slice(cursor), kind: "text" })
  }

  return segments.length > 0 ? segments : [{ content: source, kind: "text" }]
}

function collectMarkdownDetailsTags(source: string): DetailsTag[] {
  const tags: DetailsTag[] = []
  let offset = 0
  let fence: { character: "`" | "~"; length: number } | undefined

  for (const line of source.split("\n")) {
    const fenceMatch = /^(?: {0,3})(`{3,}|~{3,})/.exec(line)
    if (fenceMatch) {
      const marker = fenceMatch[1] ?? ""
      const character = marker[0] as "`" | "~"
      if (!fence) {
        fence = { character, length: marker.length }
      } else if (fence.character === character && marker.length >= fence.length) {
        fence = undefined
      }

      offset += line.length + 1
      continue
    }

    if (!fence) {
      const detailsMatch = /^[ \t]{0,3}(<\/?details\b[^>]*>)/i.exec(line)
      if (detailsMatch) {
        const raw = detailsMatch[1] ?? ""
        const index = offset + detailsMatch[0].length - raw.length
        tags.push({
          end: index + raw.length,
          index,
          kind: /^<\//.test(raw) ? "close" : "open",
        })
      }
    }

    offset += line.length + 1
  }

  return tags
}

function pushMarkdownAndMermaidBlocks(blocks: MarkdownRenderBlock[], source: string) {
  if (!source.trim()) {
    return
  }

  const tokens = Lexer.lex(source, { gfm: true })
  let markdown = ""

  for (const token of tokens) {
    if (isMermaidCodeToken(token)) {
      pushMarkdownBlock(blocks, markdown)
      markdown = ""
      blocks.push({ content: token.text, kind: "mermaid" })
      continue
    }

    if (isBlockquoteToken(token)) {
      pushMarkdownBlock(blocks, markdown)
      markdown = ""
      blocks.push(createBlockquoteMarkdownBlock(token.text))
      continue
    }

    if (isListToken(token)) {
      pushMarkdownBlock(blocks, markdown)
      markdown = ""
      blocks.push(createMarkdownListBlock(token))
      continue
    }

    markdown += token.raw
  }

  pushMarkdownBlock(blocks, markdown)
}

function pushMarkdownBlock(blocks: MarkdownRenderBlock[], content: string) {
  if (content.trim()) {
    blocks.push({ content, kind: "markdown" })
  }
}

function isMermaidCodeToken(token: Token): token is Token & { lang?: string; text: string; type: "code" } {
  return token.type === "code" && token.lang?.trim().toLowerCase().split(/\s+/)[0] === "mermaid"
}

function isBlockquoteToken(token: Token): token is Token & { text: string; type: "blockquote" } {
  return token.type === "blockquote" && typeof token.text === "string"
}

function isListToken(token: Token): token is Tokens.List {
  return token.type === "list" && Array.isArray((token as Tokens.List).items)
}

function createMarkdownListBlock(token: Tokens.List): MarkdownListBlock {
  return {
    items: token.items.map(createMarkdownListItem),
    kind: "list",
    ordered: token.ordered,
    start: typeof token.start === "number" ? token.start : 1,
  }
}

function createMarkdownListItem(item: Tokens.ListItem): MarkdownListItem {
  const contentTokens = item.tokens.filter((token) => token.type !== "checkbox" && token.type !== "list" && token.type !== "space")
  const content = contentTokens.map((token) => token.raw).join("").trim()

  return {
    checked: item.checked,
    children: item.tokens.filter(isListToken).map(createMarkdownListBlock),
    content: content || createMarkdownListItemFallbackContent(item.text),
    task: item.task,
  }
}

function createMarkdownListItemFallbackContent(text: string) {
  return text
    .replace(/(?:^|\n)\s*(?:[-+*]|\d+[.)])\s+/g, "\n")
    .trim()
}

function createBlockquoteMarkdownBlock(text: string): MarkdownRenderBlock {
  const lines = text.replace(/\r\n/g, "\n").trim().split("\n")
  const alertMatch = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i.exec(lines[0] ?? "")

  if (alertMatch) {
    return {
      alertType: alertMatch[1]?.toLowerCase() as GithubAlertType,
      content: lines.slice(1).join("\n").trim(),
      kind: "github-alert",
    }
  }

  return {
    content: text.trim(),
    kind: "quote",
  }
}

function normalizeGithubMarkdown(value: string) {
  const protectedBlocks: string[] = []
  const protectedValue = value.replace(
    /(^|\n)([ \t]{0,3})(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\2\3[ \t]*(?=\n|$)/g,
    (match) => {
      const placeholder = `\u0000GITTY_MARKDOWN_BLOCK_${protectedBlocks.length}\u0000`
      protectedBlocks.push(match)
      return placeholder
    },
  )

  const normalized = normalizeGithubInlineHtml(protectedValue)
  return protectedBlocks.reduce(
    (current, block, index) => current.replace(`\u0000GITTY_MARKDOWN_BLOCK_${index}\u0000`, block),
    normalized,
  )
}

function normalizeGithubInlineHtml(value: string) {
  return value
    .replace(/<sub\b[^>]*>([\s\S]*?)<\/sub>/gi, (_match, content: string) => normalizeHtmlInlineText(content))
    .replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (match: string, attributes: string, content: string) => {
      const href = readHtmlAttribute(attributes, "href")
      if (!href) {
        return normalizeHtmlInlineText(content)
      }

      const label = normalizeHtmlInlineText(content) || href
      return `[${escapeMarkdownLinkLabel(label)}](<${escapeMarkdownLinkHref(href)}>)`
    })
}

function readHtmlAttribute(attributes: string, name: string) {
  const pattern = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i")
  const match = pattern.exec(attributes)
  return decodeHtmlEntities((match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim())
}

function escapeMarkdownLinkLabel(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\]/g, "\\]")
}

function escapeMarkdownLinkHref(value: string) {
  return value.trim().replace(/>/g, "%3E")
}

function parseDetailsBlock(value: string): DetailsBlock {
  const summaryMatch = /<summary\b[^>]*>([\s\S]*?)<\/summary>/i.exec(value)
  const open = /^<details\b[^>]*\bopen(?:\s|=|>)/i.test(value.trim())
  const body = value
    .replace(/^[ \t]{0,3}<details\b[^>]*>/i, "")
    .replace(/[ \t]*<\/details>\s*$/i, "")
    .replace(/<summary\b[^>]*>[\s\S]*?<\/summary>/i, "")
    .trim()

  return {
    body,
    open,
    summary: normalizeHtmlInlineText(normalizeGithubInlineHtml(summaryMatch?.[1] ?? "Details")),
  }
}

function formatMermaidTitle(firstLine: string) {
  const flowchartMatch = /^(graph|flowchart)\s+([a-z]+)/i.exec(firstLine.trim())
  if (flowchartMatch) {
    return `Mermaid ${flowchartMatch[1]?.toLowerCase()} ${flowchartMatch[2]?.toUpperCase()}`
  }

  const diagramMatch = /^([a-z]+Diagram)\b/i.exec(firstLine.trim())
  if (diagramMatch) {
    return `Mermaid ${splitCamelCase(diagramMatch[1] ?? "diagram")}`
  }

  return "Mermaid diagram"
}

function splitCamelCase(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()
}

function normalizeHtmlInlineText(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  )
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
}

async function createMermaidRenderState(code: string, width: number): Promise<MermaidRenderState> {
  const firstLine = getMermaidFirstLine(code)
  try {
    const svg = await renderMermaidSvg(code)
    const rows = await renderMermaidSvgToTerminalRows(svg, width)
    if (rows.length === 0) {
      throw new Error("Mermaid returned an empty diagram.")
    }

    return { rows, status: "rendered" }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to render Mermaid diagram."
    return {
      message,
      sourceRows: createMermaidSourceRows(code, firstLine, width, message),
      status: "error",
    }
  }
}

function getMermaidFirstLine(code: string) {
  return code
    .replace(/\r\n/g, "\n")
    .split("\n")
    .find((line) => line.trim() && !line.trim().startsWith("%%"))
    ?.trim() ?? ""
}

async function renderMermaidSvg(code: string) {
  const renderTask = mermaidRenderQueue.then(async () => {
    const mermaid = await getMermaidRenderer()
    const id = `gitty-mermaid-${hashString(code)}-${mermaidRenderCounter++}`
    const { svg } = await mermaid.render(id, code)
    if (!svg.trim()) {
      throw new Error("Mermaid returned an empty SVG.")
    }
    return svg
  })

  mermaidRenderQueue = renderTask.then(
    () => undefined,
    () => undefined,
  )

  return renderTask
}

async function getMermaidRenderer() {
  await ensureMermaidDom()
  mermaidModulePromise ??= import("mermaid").then(({ default: mermaid }) => {
    mermaid.initialize({
      deterministicIds: true,
      flowchart: { htmlLabels: false },
      fontFamily: "monospace",
      securityLevel: "strict",
      startOnLoad: false,
      theme: "base",
      themeVariables: {
        background: MERMAID_RENDER_BACKGROUND,
        edgeLabelBackground: MACCHIATO.surface0,
        fontFamily: "monospace",
        lineColor: MACCHIATO.subtext0,
        mainBkg: MACCHIATO.surface2,
        nodeBorder: MACCHIATO.mauve,
        primaryBorderColor: MACCHIATO.mauve,
        primaryColor: MACCHIATO.surface0,
        primaryTextColor: MACCHIATO.text,
        secondaryColor: MACCHIATO.base,
        tertiaryColor: MACCHIATO.mantle,
      },
    })
    return mermaid
  })

  return mermaidModulePromise
}

async function ensureMermaidDom() {
  if (mermaidDomReady) {
    return
  }

  const { JSDOM } = await import("jsdom")
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true })
  const window = dom.window as unknown as MermaidDomWindow
  Object.assign(globalThis, {
    CSSStyleSheet: window.CSSStyleSheet,
    Element: window.Element,
    HTMLElement: window.HTMLElement,
    SVGElement: window.SVGElement,
    document: window.document,
    navigator: window.navigator,
    window,
  })
  installMermaidSvgMeasurementPolyfill(window)
  mermaidDomReady = true
}

function installMermaidSvgMeasurementPolyfill(window: MermaidDomWindow) {
  const svgPrototype = window.SVGElement.prototype as SVGElement & {
    getBBox?: () => SvgBox
    getComputedTextLength?: () => number
  }

  svgPrototype.getBBox = function getBBox(this: SVGElement) {
    return getSvgElementBox(this)
  }
  svgPrototype.getComputedTextLength = function getComputedTextLength(this: SVGElement) {
    return measureSvgText(this).width
  }
}

function getSvgElementBox(element: Element): SvgBox {
  const tagName = element.tagName.toLowerCase()

  if (tagName === "text" || tagName === "tspan") {
    const size = measureSvgText(element)
    return applySvgTranslate(element, createSvgBox(readSvgNumber(element, "x"), readSvgNumber(element, "y") - size.height, size.width, size.height))
  }

  if (tagName === "rect" || tagName === "image" || tagName === "foreignobject") {
    const textSize = measureSvgText(element)
    return applySvgTranslate(
      element,
      createSvgBox(
        readSvgNumber(element, "x"),
        readSvgNumber(element, "y"),
        readSvgNumber(element, "width", textSize.width),
        readSvgNumber(element, "height", textSize.height),
      ),
    )
  }

  if (tagName === "circle") {
    const radius = readSvgNumber(element, "r")
    return applySvgTranslate(
      element,
      createSvgBox(readSvgNumber(element, "cx") - radius, readSvgNumber(element, "cy") - radius, radius * 2, radius * 2),
    )
  }

  if (tagName === "ellipse") {
    const radiusX = readSvgNumber(element, "rx")
    const radiusY = readSvgNumber(element, "ry")
    return applySvgTranslate(
      element,
      createSvgBox(readSvgNumber(element, "cx") - radiusX, readSvgNumber(element, "cy") - radiusY, radiusX * 2, radiusY * 2),
    )
  }

  if (tagName === "line") {
    const x1 = readSvgNumber(element, "x1")
    const y1 = readSvgNumber(element, "y1")
    const x2 = readSvgNumber(element, "x2")
    const y2 = readSvgNumber(element, "y2")
    return applySvgTranslate(element, createSvgBox(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)))
  }

  if (tagName === "polygon" || tagName === "polyline") {
    return applySvgTranslate(element, getSvgPointsBox(element.getAttribute("points") ?? ""))
  }

  return applySvgTranslate(element, mergeSvgBoxes(Array.from(element.children).map((child) => getSvgElementBox(child))))
}

function measureSvgText(element: Element) {
  const text = (element.textContent ?? "").replace(/\s+/g, " ").trim()
  const fontSize = readSvgNumber(element, "font-size", 16)
  const lines = text.split("\n").filter(Boolean)
  const longestLineLength = Math.max(1, ...lines.map((line) => line.length))

  return {
    height: Math.max(16, Math.max(1, lines.length) * fontSize * 1.2),
    width: Math.max(16, longestLineLength * fontSize * 0.58),
  }
}

function getSvgPointsBox(points: string) {
  const values = [...points.matchAll(/(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/g)].map((match) => ({
    x: Number.parseFloat(match[1] ?? "0"),
    y: Number.parseFloat(match[2] ?? "0"),
  }))

  if (values.length === 0) {
    return createSvgBox()
  }

  const left = Math.min(...values.map((point) => point.x))
  const right = Math.max(...values.map((point) => point.x))
  const top = Math.min(...values.map((point) => point.y))
  const bottom = Math.max(...values.map((point) => point.y))
  return createSvgBox(left, top, right - left, bottom - top)
}

function applySvgTranslate(element: Element, box: SvgBox) {
  const translateMatch = /translate\(\s*(-?\d+(?:\.\d+)?)(?:[ ,]+(-?\d+(?:\.\d+)?))?\s*\)/.exec(
    element.getAttribute("transform") ?? "",
  )
  if (!translateMatch) {
    return box
  }

  const x = Number.parseFloat(translateMatch[1] ?? "0")
  const y = Number.parseFloat(translateMatch[2] ?? "0")
  return createSvgBox(box.x + x, box.y + y, box.width, box.height)
}

function mergeSvgBoxes(boxes: SvgBox[]) {
  const visibleBoxes = boxes.filter((box) => box.width > 0 || box.height > 0)
  if (visibleBoxes.length === 0) {
    return createSvgBox()
  }

  const left = Math.min(...visibleBoxes.map((box) => box.x))
  const right = Math.max(...visibleBoxes.map((box) => box.x + box.width))
  const top = Math.min(...visibleBoxes.map((box) => box.y))
  const bottom = Math.max(...visibleBoxes.map((box) => box.y + box.height))
  return createSvgBox(left, top, right - left, bottom - top)
}

function createSvgBox(x = 0, y = 0, width = 0, height = 0): SvgBox {
  return {
    bottom: y + height,
    height,
    left: x,
    right: x + width,
    top: y,
    width,
    x,
    y,
  }
}

function readSvgNumber(element: Element, name: string, fallback = 0) {
  const value = Number.parseFloat(element.getAttribute(name) ?? "")
  return Number.isFinite(value) ? value : fallback
}

async function renderMermaidSvgToTerminalRows(svg: string, width: number) {
  const sharp = (await import("sharp")).default
  const targetWidth = Math.max(MERMAID_MIN_TERMINAL_WIDTH, Math.min(width, MERMAID_MAX_TERMINAL_WIDTH))
  const maxPixelHeight = MERMAID_MAX_TERMINAL_ROWS * 2
  const { data, info } = await sharp(Buffer.from(svg))
    .resize({
      fit: "inside",
      height: maxPixelHeight,
      width: targetWidth,
      withoutEnlargement: false,
    })
    .flatten({ background: MERMAID_RENDER_BACKGROUND })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  return createTerminalImageRows(data, info.width, info.height, info.channels, width)
}

function createTerminalImageRows(data: Buffer, imageWidth: number, imageHeight: number, channels: number, renderWidth: number) {
  const rows: TerminalImageRow[] = []
  const leftPadding = Math.max(0, Math.floor((renderWidth - imageWidth) / 2))
  const rightPadding = Math.max(0, renderWidth - imageWidth - leftPadding)

  for (let y = 0; y < imageHeight; y += 2) {
    const runs: TerminalImageRun[] = []
    pushTerminalImageRun(runs, MERMAID_RENDER_BACKGROUND, MERMAID_RENDER_BACKGROUND, " ".repeat(leftPadding))

    for (let x = 0; x < imageWidth; x += 1) {
      const topColor = readTerminalPixelColor(data, imageWidth, imageHeight, channels, x, y)
      const bottomColor =
        y + 1 < imageHeight ? readTerminalPixelColor(data, imageWidth, imageHeight, channels, x, y + 1) : MERMAID_RENDER_BACKGROUND
      const glyph = topColor === MERMAID_RENDER_BACKGROUND && bottomColor === MERMAID_RENDER_BACKGROUND ? " " : "▀"
      pushTerminalImageRun(runs, topColor, bottomColor, glyph)
    }

    pushTerminalImageRun(runs, MERMAID_RENDER_BACKGROUND, MERMAID_RENDER_BACKGROUND, " ".repeat(rightPadding))
    rows.push({ runs })
  }

  return rows
}

function pushTerminalImageRun(runs: TerminalImageRun[], color: string, backgroundColor: string, text: string) {
  if (!text) {
    return
  }

  const previous = runs.at(-1)
  if (previous && previous.color === color && previous.backgroundColor === backgroundColor) {
    previous.text += text
    return
  }

  runs.push({ backgroundColor, color, text })
}

function readTerminalPixelColor(data: Buffer, imageWidth: number, imageHeight: number, channels: number, x: number, y: number) {
  if (x < 0 || y < 0 || x >= imageWidth || y >= imageHeight) {
    return MERMAID_RENDER_BACKGROUND
  }

  const offset = (y * imageWidth + x) * channels
  const alpha = channels > 3 ? (data[offset + 3] ?? 255) / 255 : 1
  const background = hexToRgb(MERMAID_RENDER_BACKGROUND)
  const color = {
    b: blendChannel(data[offset + 2] ?? background.b, background.b, alpha),
    g: blendChannel(data[offset + 1] ?? background.g, background.g, alpha),
    r: blendChannel(data[offset] ?? background.r, background.r, alpha),
  }

  return findNearestMermaidColor(color)
}

function blendChannel(value: number, background: number, alpha: number) {
  return Math.round(value * alpha + background * (1 - alpha))
}

function findNearestMermaidColor(color: RgbColor) {
  const cacheKey = `${color.r},${color.g},${color.b}`
  const cached = nearestMermaidColorCache.get(cacheKey)
  if (cached) {
    return cached
  }

  let nearest: string = MERMAID_RENDER_BACKGROUND
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const entry of mermaidPaletteRgb) {
    const distance = (color.r - entry.rgb.r) ** 2 + (color.g - entry.rgb.g) ** 2 + (color.b - entry.rgb.b) ** 2
    if (distance < nearestDistance) {
      nearest = entry.color
      nearestDistance = distance
    }
  }

  nearestMermaidColorCache.set(cacheKey, nearest)
  return nearest
}

function hexToRgb(color: string): RgbColor {
  const normalized = color.replace(/^#/, "")
  return {
    b: Number.parseInt(normalized.slice(4, 6), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    r: Number.parseInt(normalized.slice(0, 2), 16),
  }
}

function createMermaidSourceRows(code: string, firstLine: string, width: number, message: string): TextRow[] {
  const rows: TextRow[] = [
    { backgroundColor: MERMAID_RENDER_BACKGROUND, color: MACCHIATO.mauve, text: formatMermaidTitle(firstLine) },
    {
      backgroundColor: MERMAID_RENDER_BACKGROUND,
      color: MACCHIATO.yellow,
      text: message,
    },
  ]

  for (const line of code.replace(/\r\n/g, "\n").split("\n")) {
    pushWrappedRows(rows, line || " ", width, MACCHIATO.text, MERMAID_RENDER_BACKGROUND)
  }

  return rows
}

function hashString(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(36)
}

function formatTimelineTimestamp(value: string) {
  return value ? value.replace("T", " ").slice(0, 16) : ""
}

function formatCheckStateLabel(checkState: PullRequestCheckState) {
  if (checkState === "failed") {
    return "Checks failed"
  }
  if (checkState === "running") {
    return "Checks running"
  }
  return "Checks passed"
}

function defaultSelection(files: HunkDiffFile[]): HunkDiffSelection {
  return {
    fileId: files[0]?.id ?? "",
    hunkIndex: 0,
  }
}

function normalizeSelection(files: HunkDiffFile[], selection: HunkDiffSelection | undefined): HunkDiffSelection {
  if (selection && files.some((file) => file.id === selection.fileId)) {
    return selection
  }
  return defaultSelection(files)
}

function findPullRequestSummary(repository: RepositoryView, pullRequestNumber: number) {
  if (repository.pullRequests?.status !== "loaded") {
    return undefined
  }

  return [...repository.pullRequests.openedByUser, ...repository.pullRequests.needsReview].find(
    (pullRequest) => pullRequest.number === pullRequestNumber,
  )
}

function createPullRequestSidebarRows(pullRequests: RepositoryPullRequests | undefined): PullRequestSidebarRow[] {
  if (!pullRequests) {
    return []
  }

  if (pullRequests.status === "loading") {
    return [
      { color: MACCHIATO.lavender, text: "  Pull requests" },
      { color: MACCHIATO.subtext0, text: "    Loading..." },
    ]
  }

  if (pullRequests.status === "unavailable") {
    return [
      { color: MACCHIATO.lavender, text: "  Pull requests" },
      { color: MACCHIATO.subtext0, text: `    ${pullRequests.message}` },
    ]
  }

  return [
    { color: MACCHIATO.lavender, text: `  Opened by you (${pullRequests.openedByUser.length})` },
    ...createPullRequestSectionRows(pullRequests.openedByUser),
    { color: MACCHIATO.lavender, text: `  Needs review (${pullRequests.needsReview.length})` },
    ...createPullRequestSectionRows(pullRequests.needsReview),
  ]
}

function createPullRequestSectionRows(pullRequests: PullRequestSummary[]): PullRequestSidebarRow[] {
  if (pullRequests.length === 0) {
    return [{ color: MACCHIATO.subtext0, text: "    None" }]
  }

  const visiblePullRequests = pullRequests.slice(0, PULL_REQUEST_SECTION_LIMIT)
  const visiblePullRequestRows = visiblePullRequests.flatMap((pullRequest) => {
    const rows: PullRequestSidebarRow[] = [
      {
        color: MACCHIATO.text,
        pullRequest,
        rightColor: getPullRequestCheckStateColor(pullRequest.checkState),
        rightText: PULL_REQUEST_STATUS_DOT,
        text: `    #${pullRequest.number} ${pullRequest.title}`,
      },
    ]

    if (pullRequest.hasChangesRequested) {
      rows.push({
        color: MACCHIATO.red,
        pullRequest,
        text: "    Changes requested",
      })
    }

    return rows
  })
  const hiddenPullRequestCount = pullRequests.length - visiblePullRequests.length

  if (hiddenPullRequestCount <= 0) {
    return visiblePullRequestRows
  }

  return [
    ...visiblePullRequestRows,
    { color: MACCHIATO.subtext0, text: `    +${hiddenPullRequestCount} more` },
  ]
}

function getPullRequestCheckStateColor(checkState: PullRequestCheckState) {
  if (checkState === "failed") {
    return MACCHIATO.red
  }
  if (checkState === "running") {
    return MACCHIATO.yellow
  }
  return MACCHIATO.green
}

function RepositorySidebar({
  activePane,
  activeRepositoryId,
  onCloseRepository,
  onOpenRepository,
  onSelectPullRequest,
  onSelectWorkingChanges,
  width,
  repositories,
}: {
  activePane: ActivePane
  activeRepositoryId: string
  onCloseRepository: (repositoryId: string) => void
  onOpenRepository: () => void
  onSelectPullRequest: (repositoryId: string, pullRequest: PullRequestSummary) => void
  onSelectWorkingChanges: (repositoryId: string) => void
  width: number
  repositories: RepositoryView[]
}) {
  const contentWidth = Math.max(1, width - 2)

  return (
    <box
      title="Repositories"
      style={{
        width,
        height: "100%",
        border: true,
        borderStyle: "rounded",
        borderColor: MACCHIATO.surface2,
        backgroundColor: MACCHIATO.mantle,
      }}
    >
      <scrollbox style={{ width: "100%", height: "100%" }} scrollY>
        <box style={{ width: "100%", height: 2, flexDirection: "column" }}>
          <box
            style={{
              width: "100%",
              height: 1,
              backgroundColor: MACCHIATO.surface0,
            }}
            onMouseUp={onOpenRepository}
          >
            <text fg={MACCHIATO.mauve}>{fitText("+ Open repository", contentWidth)}</text>
          </box>
          <box style={{ width: "100%", height: 1 }} />
        </box>
        {repositories.map((repository) => {
          const active = repository.id === activeRepositoryId
          const workingChangesActive = active && activePane.kind === "working"
          const pullRequestRows = createPullRequestSidebarRows(repository.pullRequests)
          const selectRepository = () => onSelectWorkingChanges(repository.id)
          const closeRepository = (event: MouseEvent) => {
            event.preventDefault()
            event.stopPropagation()
            onCloseRepository(repository.id)
          }
          const selectPullRequest = (pullRequest: PullRequestSummary, event: MouseEvent) => {
            event.preventDefault()
            event.stopPropagation()
            onSelectPullRequest(repository.id, pullRequest)
          }
          const nameWidth = Math.max(1, contentWidth - REPOSITORY_CLOSE_CONTROL_WIDTH)

          return (
            <box
              key={repository.id}
              style={{ width: "100%", height: 4 + pullRequestRows.length, flexDirection: "column" }}
              onMouseUp={selectRepository}
            >
              <box
                style={{ width: "100%", height: 1, flexDirection: "row" }}
                onMouseUp={selectRepository}
              >
                <box style={{ width: nameWidth, height: 1 }} onMouseUp={selectRepository}>
                  <text fg={active ? MACCHIATO.lavender : MACCHIATO.text}>
                    {fitText(repository.name, nameWidth)}
                  </text>
                </box>
                <box
                  style={{ width: REPOSITORY_CLOSE_CONTROL_WIDTH, height: 1 }}
                  onMouseUp={closeRepository}
                >
                  <text fg={MACCHIATO.red}>{fitText(" x", REPOSITORY_CLOSE_CONTROL_WIDTH)}</text>
                </box>
              </box>
              <box
                style={{
                  width: "100%",
                  height: 1,
                  backgroundColor: workingChangesActive ? MACCHIATO.surface0 : MACCHIATO.mantle,
                }}
                onMouseUp={selectRepository}
              >
                <text fg={workingChangesActive ? MACCHIATO.mauve : MACCHIATO.text}>
                  {fitText(`${workingChangesActive ? ">" : " "} Working changes`, contentWidth)}
                </text>
              </box>
              <box style={{ width: "100%", height: 1 }} onMouseUp={selectRepository}>
                <text fg={MACCHIATO.subtext0}>
                  {fitText(
                    `  ${pluralize(repository.files.length, "file")} +${repository.stats.additions} -${repository.stats.deletions}`,
                    contentWidth,
                  )}
                </text>
              </box>
              {pullRequestRows.map((row, index) => {
                const pullRequestActive =
                  active &&
                  activePane.kind === "pull-request" &&
                  activePane.pullRequestNumber === row.pullRequest?.number
                const rightWidth = row.rightText ? Math.min(contentWidth, PULL_REQUEST_STATUS_WIDTH) : 0
                const leftWidth = Math.max(1, contentWidth - rightWidth)
                const rowColor = pullRequestActive ? MACCHIATO.mauve : row.color
                const onMouseUp = row.pullRequest
                  ? (event: MouseEvent) => selectPullRequest(row.pullRequest as PullRequestSummary, event)
                  : selectRepository

                return (
                  <box
                    key={`${repository.id}:pull-request-row:${index}`}
                    style={{
                      width: "100%",
                      height: 1,
                      flexDirection: "row",
                      backgroundColor: pullRequestActive ? MACCHIATO.surface0 : MACCHIATO.mantle,
                    }}
                    onMouseUp={onMouseUp}
                  >
                    <box style={{ width: leftWidth, height: 1 }}>
                      <text fg={rowColor}>{fitText(row.text, leftWidth)}</text>
                    </box>
                    {row.rightText ? (
                      <box style={{ width: rightWidth, height: 1 }}>
                        <text fg={row.rightColor ?? row.color}>{fitText(row.rightText, rightWidth)}</text>
                      </box>
                    ) : null}
                  </box>
                )
              })}
              <box style={{ width: "100%", height: 1 }} onMouseUp={selectRepository} />
            </box>
          )
        })}
      </scrollbox>
    </box>
  )
}

function OpenRepositoryPrompt({
  message,
  onCompleteSuggestion,
  onInput,
  onSubmit,
  selectedSuggestionIndex,
  suggestions,
  value,
  width,
}: {
  message?: string
  onCompleteSuggestion: (value: string) => void
  onInput: (value: string) => void
  onSubmit: (value: string) => void
  selectedSuggestionIndex: number
  suggestions: PathSuggestion[]
  value: string
  width: number
}) {
  const contentWidth = Math.max(1, width - 4)
  const emptyRows = Math.max(0, OPEN_REPOSITORY_SUGGESTION_ROWS - suggestions.length)
  const handleSubmit = (submittedValue: unknown) => {
    if (typeof submittedValue === "string") {
      onSubmit(submittedValue)
    }
  }

  return (
    <box
      title="Open Repository"
      style={{
        width,
        height: 4 + OPEN_REPOSITORY_SUGGESTION_ROWS,
        border: true,
        borderStyle: "rounded",
        borderColor: message ? MACCHIATO.red : MACCHIATO.surface2,
        backgroundColor: MACCHIATO.mantle,
        flexDirection: "column",
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <input
        value={value}
        placeholder="Path to git repository"
        focused
        onInput={onInput}
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          backgroundColor: MACCHIATO.base,
        }}
      />
      <box style={{ width: "100%", height: 1 }}>
        <text fg={message ? MACCHIATO.red : MACCHIATO.subtext0}>
          {fitText(message ?? "Tab completes selected, Enter opens.", contentWidth)}
        </text>
      </box>
      {suggestions.map((suggestion, index) => {
        const selected = index === selectedSuggestionIndex
        const label = `${selected ? ">" : " "} ${suggestion.value}${suggestion.isGitRepository ? "  git" : ""}`

        return (
          <box
            key={suggestion.value}
            style={{
              width: "100%",
              height: 1,
              backgroundColor: selected ? MACCHIATO.surface0 : MACCHIATO.mantle,
            }}
            onMouseUp={() => onCompleteSuggestion(suggestion.value)}
          >
            <text fg={selected ? MACCHIATO.mauve : MACCHIATO.text}>{fitText(label, contentWidth)}</text>
          </box>
        )
      })}
      {Array.from({ length: emptyRows }, (_, index) => (
        <box key={`empty-suggestion-${index}`} style={{ width: "100%", height: 1 }} />
      ))}
    </box>
  )
}

function StatusOverlay({
  status,
  width,
}: {
  status?: OpenRepositoryStatus
  width: number
}) {
  if (!status) {
    return null
  }

  const overlayWidth = Math.max(
    1,
    Math.min(width, Math.min(STATUS_OVERLAY_MAX_WIDTH, Math.max(STATUS_OVERLAY_MIN_WIDTH, status.text.length + 4))),
  )
  const contentWidth = Math.max(1, overlayWidth - 4)

  return (
    <box
      style={{
        position: "absolute",
        right: 1,
        bottom: 1,
        zIndex: 20,
        width: overlayWidth,
        height: 3,
        border: true,
        borderStyle: "rounded",
        borderColor: MACCHIATO.green,
        backgroundColor: MACCHIATO.mantle,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <text fg={MACCHIATO.green}>{fitText(status.text, contentWidth)}</text>
    </box>
  )
}

function PullRequestPane({
  detailState,
  diffState,
  onOpenUrl,
  pullRequestNumber,
  summary,
  theme,
  width,
}: {
  detailState?: PullRequestDetailState
  diffState?: PullRequestDiffState
  onOpenUrl: (url: string) => void
  pullRequestNumber: number
  summary?: PullRequestSummary
  theme: HunkDiffThemeName
  width: number
}) {
  const [activeTab, setActiveTab] = useState<PullRequestTab>("discussion")
  const sidebarWidth =
    width >= PR_DETAIL_SIDEBAR_MIN_WIDTH + 24
      ? Math.min(PR_DETAIL_SIDEBAR_MAX_WIDTH, Math.max(PR_DETAIL_SIDEBAR_MIN_WIDTH, Math.floor(width * PR_DETAIL_SIDEBAR_RATIO)))
      : 0
  const contentWidth = Math.max(1, width - sidebarWidth - (sidebarWidth > 0 ? 1 : 0))
  const detail = detailState?.status === "loaded" ? detailState.detail : undefined

  useEffect(() => {
    setActiveTab("discussion")
  }, [pullRequestNumber])

  return (
    <box style={{ width, height: "100%", flexDirection: "row" }}>
      <PullRequestContentPane
        activeTab={activeTab}
        detailState={detailState}
        diffState={diffState}
        onOpenUrl={onOpenUrl}
        onSelectTab={setActiveTab}
        summary={summary}
        theme={theme}
        width={contentWidth}
      />
      {sidebarWidth > 0 ? (
        <>
          <box style={{ width: 1, height: "100%" }} />
          <PullRequestMetadataSidebar detail={detail} summary={summary} width={sidebarWidth} />
        </>
      ) : null}
    </box>
  )
}

function PullRequestContentPane({
  activeTab,
  detailState,
  diffState,
  onOpenUrl,
  onSelectTab,
  summary,
  theme,
  width,
}: {
  activeTab: PullRequestTab
  detailState?: PullRequestDetailState
  diffState?: PullRequestDiffState
  onOpenUrl: (url: string) => void
  onSelectTab: (tab: PullRequestTab) => void
  summary?: PullRequestSummary
  theme: HunkDiffThemeName
  width: number
}) {
  const contentWidth = Math.max(1, width - 4)

  if (!detailState || detailState.status === "loading") {
    return (
      <box
        title={summary ? `PR #${summary.number}` : "Pull Request"}
        style={{
          width,
          height: "100%",
          border: true,
          borderStyle: "rounded",
          borderColor: MACCHIATO.surface2,
          backgroundColor: MACCHIATO.mantle,
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <text fg={MACCHIATO.subtext0}>{fitText("Loading pull request...", contentWidth)}</text>
      </box>
    )
  }

  if (detailState.status === "unavailable") {
    return (
      <box
        title={summary ? `PR #${summary.number}` : "Pull Request"}
        style={{
          width,
          height: "100%",
          border: true,
          borderStyle: "rounded",
          borderColor: MACCHIATO.red,
          backgroundColor: MACCHIATO.mantle,
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <text fg={MACCHIATO.red}>{fitText(detailState.message, contentWidth)}</text>
      </box>
    )
  }

  const detail = detailState.detail

  return (
    <box
      title={`PR #${detail.number}`}
      style={{
        width,
        height: "100%",
        border: true,
        borderStyle: "rounded",
        borderColor: MACCHIATO.surface2,
        backgroundColor: MACCHIATO.mantle,
        flexDirection: "column",
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <PullRequestTabBar activeTab={activeTab} onSelectTab={onSelectTab} width={contentWidth} />
      {activeTab === "discussion" ? (
        <scrollbox style={{ width: "100%", flexGrow: 1 }} scrollY>
          <PullRequestTitleBlock detail={detail} onOpenUrl={onOpenUrl} width={contentWidth} />
          <DescriptionMarkdownBlock markdown={detail.body} width={contentWidth} />
          <CommentChain comments={detail.comments} width={contentWidth} />
        </scrollbox>
      ) : (
        <PullRequestDiffContent diffState={diffState} theme={theme} width={contentWidth} />
      )}
    </box>
  )
}

function PullRequestTabBar({
  activeTab,
  onSelectTab,
  width,
}: {
  activeTab: PullRequestTab
  onSelectTab: (tab: PullRequestTab) => void
  width: number
}) {
  const tabs: { label: string; value: PullRequestTab }[] = [
    { label: "Discussion", value: "discussion" },
    { label: "Diff", value: "diff" },
  ]
  const tabWidth = Math.max(10, Math.min(16, Math.floor(width / tabs.length)))

  return (
    <box style={{ width: "100%", height: 2, flexDirection: "column", backgroundColor: MACCHIATO.mantle }}>
      <box style={{ width: "100%", height: 1, flexDirection: "row", backgroundColor: MACCHIATO.mantle }}>
        {tabs.map((tab) => {
          const selected = activeTab === tab.value
          const selectTab = (event: MouseEvent) => {
            event.preventDefault()
            event.stopPropagation()
            onSelectTab(tab.value)
          }

          return (
            <box
              key={tab.value}
              style={{
                width: tabWidth,
                height: 1,
                backgroundColor: selected ? MACCHIATO.surface0 : MACCHIATO.mantle,
              }}
              onMouseUp={selectTab}
            >
              <text fg={selected ? MACCHIATO.mauve : MACCHIATO.text}>
                {fitText(`${selected ? ">" : " "} ${tab.label}`, tabWidth)}
              </text>
            </box>
          )
        })}
      </box>
      <box style={{ width: "100%", height: 1 }} />
    </box>
  )
}

function PullRequestDiffContent({
  diffState,
  theme,
  width,
}: {
  diffState?: PullRequestDiffState
  theme: HunkDiffThemeName
  width: number
}) {
  const files = diffState?.status === "loaded" ? diffState.files : EMPTY_DIFF_FILES
  const [selection, setSelection] = useState<HunkDiffSelection>(() => defaultSelection(files))
  const normalizedSelection = normalizeSelection(files, selection)

  useEffect(() => {
    setSelection((currentSelection) => normalizeSelection(files, currentSelection))
  }, [files])

  if (!diffState || diffState.status === "loading") {
    return (
      <box style={{ width: "100%", height: 3, paddingLeft: 1, paddingTop: 1 }}>
        <text fg={MACCHIATO.subtext0}>{fitText("Loading pull request diff...", Math.max(1, width - 2))}</text>
      </box>
    )
  }

  if (diffState.status === "unavailable") {
    return (
      <box style={{ width: "100%", height: 3, paddingLeft: 1, paddingTop: 1 }}>
        <text fg={MACCHIATO.red}>{fitText(diffState.message, Math.max(1, width - 2))}</text>
      </box>
    )
  }

  if (files.length === 0) {
    return (
      <box style={{ width: "100%", height: 3, paddingLeft: 1, paddingTop: 1 }}>
        <text fg={MACCHIATO.subtext0}>{fitText("No diff files in this pull request.", Math.max(1, width - 2))}</text>
      </box>
    )
  }

  return (
    <scrollbox style={{ width: "100%", flexGrow: 1 }} scrollY>
      <HunkReviewStream
        files={files}
        highlight
        layout="split"
        width={width}
        theme={theme}
        selection={normalizedSelection}
        wrapLines
        onSelectionChange={setSelection}
      />
    </scrollbox>
  )
}

function PullRequestTitleBlock({
  detail,
  onOpenUrl,
  width,
}: {
  detail: PullRequestDetail
  onOpenUrl: (url: string) => void
  width: number
}) {
  const contentWidth = Math.max(1, width - 4)
  const titleRows = wrapText(detail.title, contentWidth)
  const url = detail.url.trim()
  const height = Math.max(2, titleRows.length + (url ? 1 : 0))
  const openUrl = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    onOpenUrl(url)
  }

  return (
    <box
      style={{
        width: "100%",
        height,
        backgroundColor: MACCHIATO.mantle,
        flexDirection: "column",
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      {titleRows.map((row, index) => (
        <box key={`pull-request-title-row:${index}`} style={{ width: "100%", height: 1 }}>
          <text fg={MACCHIATO.lavender}>{fitText(row, contentWidth)}</text>
        </box>
      ))}
      {url ? (
        <box style={{ width: "100%", height: 1, backgroundColor: MACCHIATO.surface0 }} onMouseUp={openUrl}>
          <text fg={MACCHIATO.blue}>{fitText(url, contentWidth)}</text>
        </box>
      ) : null}
    </box>
  )
}

function DescriptionMarkdownBlock({
  markdown,
  width,
}: {
  markdown: string
  width: number
}) {
  const contentWidth = Math.max(1, width - 4)

  return (
    <box
      title="Description"
      style={{
        width: "100%",
        border: true,
        borderStyle: "rounded",
        borderColor: MACCHIATO.surface2,
        backgroundColor: MACCHIATO.base,
        flexDirection: "column",
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <MarkdownContent
        blockKeyPrefix="pull-request-description"
        emptyText="No description."
        markdown={markdown}
        width={contentWidth}
      />
    </box>
  )
}

function CommentChain({
  comments,
  width,
}: {
  comments: PullRequestTimelineItem[]
  width: number
}) {
  const changesRequestedComments = comments.filter(isChangesRequestedTimelineItem)
  const commentBlockWidth = Math.max(1, Math.floor(width * 0.9))
  const leftGutterWidth = Math.max(0, width - commentBlockWidth)

  return (
    <box style={{ width: "100%", flexDirection: "column" }}>
      <box style={{ width: "100%", height: 1 }} />
      <box style={{ width: "100%", height: 1 }}>
        <text fg={MACCHIATO.mauve}>{fitText("Comment chain", width)}</text>
      </box>
      {changesRequestedComments.length === 0 ? (
        <box style={{ width: "100%", height: 1 }}>
          <text fg={MACCHIATO.subtext0}>{fitText("No changes requested comments.", width)}</text>
        </box>
      ) : (
        changesRequestedComments.map((comment, index) => (
          <box
            key={`pull-request-comment-row:${index}`}
            style={{ width: "100%", flexDirection: "row", marginBottom: 1 }}
          >
            {leftGutterWidth > 0 ? <box style={{ width: leftGutterWidth }} /> : null}
            <CommentBlock comment={comment} width={commentBlockWidth} />
          </box>
        ))
      )}
    </box>
  )
}

function isChangesRequestedTimelineItem(comment: PullRequestTimelineItem) {
  return comment.kind === "review" && normalizeGitHubState(comment.state) === "CHANGES_REQUESTED"
}

function CommentBlock({
  comment,
  width,
}: {
  comment: PullRequestTimelineItem
  width: number
}) {
  const contentWidth = Math.max(1, width - 4)

  return (
    <box
      style={{
        width,
        border: true,
        borderStyle: "rounded",
        borderColor: MACCHIATO.surface2,
        backgroundColor: MACCHIATO.base,
        flexDirection: "column",
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <box style={{ width: "100%", height: 1 }}>
        <text fg={MACCHIATO.lavender}>{fitText(formatCommentHeading(comment), contentWidth)}</text>
      </box>
      <MarkdownContent
        blockKeyPrefix={`pull-request-comment:${comment.author}:${comment.createdAt}`}
        emptyText="No content."
        markdown={comment.body}
        width={contentWidth}
      />
    </box>
  )
}

function MarkdownContent({
  backgroundColor = MACCHIATO.base,
  blockKeyPrefix,
  emptyText,
  markdown,
  width,
}: {
  backgroundColor?: string
  blockKeyPrefix: string
  emptyText: string
  markdown: string
  width: number
}) {
  const blocks = useMemo(() => createMarkdownBlocks(markdown, emptyText), [emptyText, markdown])

  return (
    <box style={{ width: "100%", flexDirection: "column", backgroundColor }}>
      {blocks.map((block, index) => {
        const key = `${blockKeyPrefix}:${index}`
        if (block.kind === "details") {
          return <DetailsMarkdownBlock block={block} blockKeyPrefix={key} key={key} width={width} />
        }

        if (block.kind === "github-alert") {
          return <GithubAlertMarkdownBlock block={block} blockKeyPrefix={key} key={key} width={width} />
        }

        if (block.kind === "mermaid") {
          return <MermaidDiagram content={block.content} key={key} width={width} />
        }

        if (block.kind === "list") {
          return (
            <MarkdownListBlockView
              backgroundColor={backgroundColor}
              block={block}
              blockKeyPrefix={key}
              key={key}
              width={width}
            />
          )
        }

        if (block.kind === "quote") {
          return <QuoteMarkdownBlock block={block} blockKeyPrefix={key} key={key} width={width} />
        }

        return (
          <markdown
            bg={backgroundColor}
            conceal
            content={block.content}
            fg={MACCHIATO.text}
            internalBlockMode="top-level"
            key={key}
            syntaxStyle={MARKDOWN_SYNTAX_STYLE}
            tableOptions={MARKDOWN_TABLE_OPTIONS}
            style={{
              width: "100%",
              flexShrink: 0,
              marginBottom: index === blocks.length - 1 ? 0 : 1,
            }}
          />
        )
      })}
    </box>
  )
}

function MarkdownListBlockView({
  backgroundColor,
  block,
  blockKeyPrefix,
  depth = 0,
  width,
}: {
  backgroundColor: string
  block: MarkdownListBlock
  blockKeyPrefix: string
  depth?: number
  width: number
}) {
  const markerWidth = getMarkdownListMarkerWidth(block)

  return (
    <box
      style={{
        width: "100%",
        backgroundColor,
        flexDirection: "column",
        flexShrink: 0,
        marginBottom: depth === 0 ? 1 : 0,
      }}
    >
      {block.items.map((item, index) => {
        const marker = createMarkdownListMarker(block, item, index)
        return (
          <MarkdownListItemView
            backgroundColor={backgroundColor}
            blockKeyPrefix={`${blockKeyPrefix}:${index}`}
            depth={depth}
            item={item}
            key={`${blockKeyPrefix}:${index}`}
            marker={marker}
            markerWidth={markerWidth}
            width={width}
          />
        )
      })}
    </box>
  )
}

function MarkdownListItemView({
  backgroundColor,
  blockKeyPrefix,
  depth,
  item,
  marker,
  markerWidth,
  width,
}: {
  backgroundColor: string
  blockKeyPrefix: string
  depth: number
  item: MarkdownListItem
  marker: string
  markerWidth: number
  width: number
}) {
  const indentWidth = depth * MARKDOWN_LIST_INDENT_WIDTH
  const markerColumnWidth = Math.min(Math.max(1, indentWidth + markerWidth + 1), Math.max(1, width - 1))
  const contentWidth = Math.max(1, width - markerColumnWidth)
  const markerText = `${" ".repeat(indentWidth)}${marker.padStart(markerWidth)} `

  return (
    <box
      style={{
        width: "100%",
        backgroundColor,
        flexDirection: "row",
        flexShrink: 0,
      }}
    >
      <text
        fg={getMarkdownListMarkerColor(item)}
        bg={backgroundColor}
        style={{ width: markerColumnWidth, height: 1, flexShrink: 0 }}
      >
        {fitText(markerText, markerColumnWidth)}
      </text>
      <box
        style={{
          width: contentWidth,
          backgroundColor,
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        {item.content ? (
          <markdown
            bg={backgroundColor}
            conceal
            content={item.content}
            fg={MACCHIATO.text}
            internalBlockMode="coalesced"
            syntaxStyle={MARKDOWN_SYNTAX_STYLE}
            tableOptions={MARKDOWN_TABLE_OPTIONS}
            style={{
              width: "100%",
              flexShrink: 0,
            }}
          />
        ) : (
          <text bg={backgroundColor} style={{ width: "100%", height: 1, flexShrink: 0 }}>
            {" "}
          </text>
        )}
        {item.children.map((child, index) => (
          <MarkdownListBlockView
            backgroundColor={backgroundColor}
            block={child}
            blockKeyPrefix={`${blockKeyPrefix}:child:${index}`}
            depth={depth + 1}
            key={`${blockKeyPrefix}:child:${index}`}
            width={contentWidth}
          />
        ))}
      </box>
    </box>
  )
}

function getMarkdownListMarkerWidth(block: MarkdownListBlock) {
  if (!block.ordered) {
    return block.items.some((item) => item.task) ? 3 : 1
  }

  const lastNumber = block.start + Math.max(0, block.items.length - 1)
  return `${lastNumber}.`.length
}

function createMarkdownListMarker(block: MarkdownListBlock, item: MarkdownListItem, index: number) {
  if (item.task) {
    return item.checked ? "[x]" : "[ ]"
  }

  return block.ordered ? `${block.start + index}.` : "-"
}

function getMarkdownListMarkerColor(item: MarkdownListItem) {
  if (!item.task) {
    return MACCHIATO.subtext0
  }

  return item.checked ? MACCHIATO.green : MACCHIATO.yellow
}

function GithubAlertMarkdownBlock({
  block,
  blockKeyPrefix,
  width,
}: {
  block: Extract<MarkdownRenderBlock, { kind: "github-alert" }>
  blockKeyPrefix: string
  width: number
}) {
  const alert = GITHUB_ALERTS[block.alertType]
  const contentWidth = Math.max(1, width - 4)

  return (
    <box
      title={alert.title}
      style={{
        width: "100%",
        border: true,
        borderStyle: "rounded",
        borderColor: alert.color,
        backgroundColor: MACCHIATO.surface0,
        flexDirection: "column",
        marginBottom: 1,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <MarkdownContent
        backgroundColor={MACCHIATO.surface0}
        blockKeyPrefix={`${blockKeyPrefix}:body`}
        emptyText="No alert content."
        markdown={block.content}
        width={contentWidth}
      />
    </box>
  )
}

function QuoteMarkdownBlock({
  block,
  blockKeyPrefix,
  width,
}: {
  block: Extract<MarkdownRenderBlock, { kind: "quote" }>
  blockKeyPrefix: string
  width: number
}) {
  const contentWidth = Math.max(1, width - 4)

  return (
    <box
      title="Quote"
      style={{
        width: "100%",
        border: true,
        borderStyle: "rounded",
        borderColor: MACCHIATO.surface2,
        backgroundColor: MACCHIATO.surface0,
        flexDirection: "column",
        marginBottom: 1,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <MarkdownContent
        backgroundColor={MACCHIATO.surface0}
        blockKeyPrefix={`${blockKeyPrefix}:body`}
        emptyText="No quote content."
        markdown={block.content}
        width={contentWidth}
      />
    </box>
  )
}

function DetailsMarkdownBlock({
  block,
  blockKeyPrefix,
  width,
}: {
  block: Extract<MarkdownRenderBlock, { kind: "details" }>
  blockKeyPrefix: string
  width: number
}) {
  const contentWidth = Math.max(1, width - 4)
  const [isOpen, setOpen] = useState(block.open)

  useEffect(() => {
    setOpen(block.open)
  }, [block.body, block.open, block.summary])

  return (
    <box
      title="Details"
      style={{
        width: "100%",
        border: true,
        borderStyle: "rounded",
        borderColor: MACCHIATO.surface2,
        backgroundColor: MACCHIATO.surface0,
        flexDirection: "column",
        marginBottom: 1,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <box
        style={{ width: "100%", height: 1, backgroundColor: MACCHIATO.surface0 }}
        onMouseUp={() => setOpen((current) => !current)}
      >
        <text fg={MACCHIATO.mauve}>{fitText(`${isOpen ? "v" : ">"} ${block.summary}`, contentWidth)}</text>
      </box>
      {isOpen ? (
        <MarkdownContent
          backgroundColor={MACCHIATO.surface0}
          blockKeyPrefix={`${blockKeyPrefix}:body`}
          emptyText="No details."
          markdown={block.body}
          width={contentWidth}
        />
      ) : null}
    </box>
  )
}

function MermaidDiagram({
  content,
  width,
}: {
  content: string
  width: number
}) {
  const contentWidth = Math.max(1, width - 4)
  const [renderState, setRenderState] = useState<MermaidRenderState>({ status: "loading" })

  useEffect(() => {
    let isCancelled = false
    setRenderState({ status: "loading" })

    void createMermaidRenderState(content, contentWidth).then((nextState) => {
      if (!isCancelled) {
        setRenderState(nextState)
      }
    })

    return () => {
      isCancelled = true
    }
  }, [content, contentWidth])

  const height =
    renderState.status === "rendered"
      ? renderState.rows.length + 2
      : renderState.status === "error"
        ? Math.min(renderState.sourceRows.length + 2, MERMAID_MAX_TERMINAL_ROWS + 6)
        : 4
  const borderColor = renderState.status === "error" ? MACCHIATO.yellow : MACCHIATO.surface2

  return (
    <box
      title="Mermaid"
      style={{
        width: "100%",
        height,
        border: true,
        borderStyle: "rounded",
        borderColor,
        backgroundColor: MERMAID_RENDER_BACKGROUND,
        flexDirection: "column",
        marginBottom: 1,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      {renderState.status === "loading" ? (
        <text fg={MACCHIATO.subtext0} bg={MERMAID_RENDER_BACKGROUND} style={{ width: contentWidth, height: 1 }}>
          Rendering Mermaid diagram...
        </text>
      ) : null}
      {renderState.status === "rendered" ? (
        <TerminalImageRows rowKeyPrefix="pull-request-mermaid-row" rows={renderState.rows} width={contentWidth} />
      ) : null}
      {renderState.status === "error" ? (
        <>
          <TextRows rowKeyPrefix="pull-request-mermaid-source-row" rows={renderState.sourceRows} width={contentWidth} />
        </>
      ) : null}
    </box>
  )
}

function TerminalImageRows({
  rowKeyPrefix,
  rows,
  width,
}: {
  rowKeyPrefix: string
  rows: TerminalImageRow[]
  width: number
}) {
  return (
    <>
      {rows.map((row, index) => (
        <text
          bg={MERMAID_RENDER_BACKGROUND}
          key={`${rowKeyPrefix}:${index}`}
          style={{ width, height: 1, flexShrink: 0 }}
        >
          {row.runs.map((run, runIndex) => (
            <span
              bg={run.backgroundColor}
              fg={run.color}
              key={`${rowKeyPrefix}:${index}:${runIndex}`}
            >
              {run.text}
            </span>
          ))}
        </text>
      ))}
    </>
  )
}

function TextRows({
  rowKeyPrefix,
  rows,
  width,
}: {
  rowKeyPrefix: string
  rows: TextRow[]
  width: number
}) {
  return (
    <>
      {rows.map((row, index) => (
        <box
          key={`${rowKeyPrefix}:${index}`}
          style={{
            width: "100%",
            height: 1,
            backgroundColor: row.backgroundColor,
          }}
        >
          <text fg={row.color}>{fitText(row.text, width)}</text>
        </box>
      ))}
    </>
  )
}

function PullRequestMetadataSidebar({
  detail,
  summary,
  width,
}: {
  detail?: PullRequestDetail
  summary?: PullRequestSummary
  width: number
}) {
  const contentWidth = Math.max(1, width - 4)
  const rows = detail
    ? createPullRequestMetadataRows(detail, contentWidth)
    : [
        {
          color: MACCHIATO.lavender,
          text: "Status",
        },
        {
          color: summary ? getPullRequestCheckStateColor(summary.checkState) : MACCHIATO.subtext0,
          text: summary ? formatCheckStateLabel(summary.checkState) : "Loading...",
        },
      ]

  return (
    <box
      title="PR Info"
      style={{
        width,
        height: "100%",
        border: true,
        borderStyle: "rounded",
        borderColor: MACCHIATO.surface2,
        backgroundColor: MACCHIATO.mantle,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <scrollbox style={{ width: "100%", height: "100%" }} scrollY>
        <TextRows rowKeyPrefix="pull-request-metadata-row" rows={rows} width={contentWidth} />
      </scrollbox>
    </box>
  )
}

function formatCommentHeading(comment: PullRequestTimelineItem) {
  const state = comment.kind === "review" && comment.state ? ` (${comment.state})` : ""
  const timestamp = formatTimelineTimestamp(comment.createdAt)
  const suffix = timestamp ? ` - ${timestamp}` : ""
  const action = comment.kind === "review" ? `reviewed${state}` : "commented"
  return `${comment.author} ${action}${suffix}`
}

function createPullRequestMetadataRows(detail: PullRequestDetail, width: number): TextRow[] {
  const rows: TextRow[] = [
    { color: MACCHIATO.lavender, text: "Status" },
    {
      color: getPullRequestCheckStateColor(detail.checkState),
      text: formatCheckStateLabel(detail.checkState),
    },
  ]

  if (detail.reviewDecision) {
    rows.push({
      color: detail.reviewDecision === "Changes Requested" ? MACCHIATO.red : MACCHIATO.subtext0,
      text: detail.reviewDecision,
    })
  }

  rows.push({ color: MACCHIATO.subtext0, text: "" })
  rows.push({ color: MACCHIATO.lavender, text: "Reviewers" })
  if (detail.reviewers.length === 0) {
    rows.push({ color: MACCHIATO.subtext0, text: "None" })
  } else {
    for (const reviewer of detail.reviewers) {
      pushWrappedRows(rows, `${reviewer.login} ${reviewer.state}`, width, getReviewerStateColor(reviewer.state))
    }
  }

  rows.push({ color: MACCHIATO.subtext0, text: "" })
  rows.push({ color: MACCHIATO.lavender, text: "Assignees" })
  if (detail.assignees.length === 0) {
    rows.push({ color: MACCHIATO.subtext0, text: "None" })
  } else {
    for (const assignee of detail.assignees) {
      pushWrappedRows(rows, assignee, width, MACCHIATO.text)
    }
  }

  rows.push({ color: MACCHIATO.subtext0, text: "" })
  rows.push({ color: MACCHIATO.lavender, text: "Labels" })
  if (detail.labels.length === 0) {
    rows.push({ color: MACCHIATO.subtext0, text: "None" })
  } else {
    for (const label of detail.labels) {
      pushWrappedRows(rows, label.name, width, label.color ?? MACCHIATO.text)
    }
  }

  return rows
}

function getReviewerStateColor(state: string) {
  const normalized = normalizeGitHubState(state)
  if (normalized === "CHANGES_REQUESTED") {
    return MACCHIATO.red
  }
  if (normalized === "APPROVED") {
    return MACCHIATO.green
  }
  if (normalized === "REQUESTED") {
    return MACCHIATO.yellow
  }
  return MACCHIATO.text
}

function GitPane({
  onSelectionChange,
  selection,
  theme,
  width,
  repository,
}: {
  onSelectionChange: (selection: HunkDiffSelection) => void
  selection: HunkDiffSelection
  theme: HunkDiffThemeName
  width: number
  repository?: RepositoryView
}) {
  const files = repository?.files ?? []
  const paneContentWidth = Math.max(1, width - 4)

  return (
    <box
      style={{
        width,
        height: "100%",
        border: true,
        borderStyle: "rounded",
        borderColor: MACCHIATO.surface2,
        backgroundColor: MACCHIATO.mantle,
        flexDirection: "column",
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      {files.length > 0 ? (
        <scrollbox style={{ width: "100%", height: "100%" }} scrollY>
          <HunkReviewStream
            files={files}
            highlight
            layout="split"
            width={paneContentWidth}
            theme={theme}
            selection={selection}
            wrapLines
            onSelectionChange={onSelectionChange}
          />
        </scrollbox>
      ) : (
        <box style={{ width: "100%", height: 3, paddingLeft: 1, paddingTop: 1 }}>
          <text fg={MACCHIATO.subtext0}>
            {fitText(
              repository ? "No working changes in this repository." : "No repository open.",
              Math.max(1, paneContentWidth - 2),
            )}
          </text>
        </box>
      )}
    </box>
  )
}

function DiffApp({
  initialRepositories,
  staged,
  theme,
}: {
  initialRepositories: RepositoryView[]
  staged: boolean
  theme: HunkDiffThemeName
}) {
  const renderer = useRenderer()
  const terminal = useTerminalDimensions()
  const pullRequestLoadIds = useRef(new Set<string>())
  const [repositories, setRepositories] = useState<RepositoryView[]>(initialRepositories)
  const firstRepository = repositories[0]
  const [activePane, setActivePane] = useState<ActivePane>(() => ({
    kind: "working",
    repositoryId: firstRepository?.id ?? "",
  }))
  const [selections, setSelections] = useState<Record<string, HunkDiffSelection>>(() =>
    Object.fromEntries(repositories.map((repository) => [repository.id, defaultSelection(repository.files)])),
  )
  const [isOpenPromptVisible, setOpenPromptVisible] = useState(false)
  const [repositoryPathInput, setRepositoryPathInput] = useState("")
  const [selectedPathSuggestionIndex, setSelectedPathSuggestionIndex] = useState(0)
  const [openPromptError, setOpenPromptError] = useState("")
  const [status, setStatus] = useState<OpenRepositoryStatus>()
  const activeRepositoryId = activePane.repositoryId

  const activeRepository = useMemo(
    () => repositories.find((repository) => repository.id === activeRepositoryId) ?? firstRepository,
    [activeRepositoryId, firstRepository, repositories],
  )
  const activePullRequestSummary =
    activePane.kind === "pull-request" && activeRepository
      ? findPullRequestSummary(activeRepository, activePane.pullRequestNumber)
      : undefined
  const activePullRequestDetailState =
    activePane.kind === "pull-request" ? activeRepository?.pullRequestDetails?.[activePane.pullRequestNumber] : undefined
  const activePullRequestDiffState =
    activePane.kind === "pull-request" ? activeRepository?.pullRequestDiffs?.[activePane.pullRequestNumber] : undefined
  const files = activeRepository?.files ?? []
  const selection = normalizeSelection(files, activeRepository ? selections[activeRepository.id] : undefined)
  const shellWidth = Math.max(1, terminal.width - 2)
  const repositoryWidth = Math.min(
    REPOSITORY_SIDEBAR_MAX_WIDTH,
    Math.max(REPOSITORY_SIDEBAR_MIN_WIDTH, Math.floor(shellWidth * REPOSITORY_SIDEBAR_WIDTH_RATIO)),
  )
  const gitPaneWidth = Math.max(1, shellWidth - repositoryWidth - 1)
  const headerWidth = shellWidth
  const commandText = `${pluralize(repositories.length, "repository", "repositories")}  |  o open repository  |  tab/click repo or PR  |  q quit`
  const pathSuggestions = useMemo(() => createPathSuggestions(repositoryPathInput), [repositoryPathInput])
  const normalizedPathSuggestionIndex =
    pathSuggestions.length > 0 ? Math.min(selectedPathSuggestionIndex, pathSuggestions.length - 1) : 0

  useEffect(() => {
    for (const repository of repositories) {
      if (repository.pullRequests?.status !== "loading" || pullRequestLoadIds.current.has(repository.id)) {
        continue
      }

      pullRequestLoadIds.current.add(repository.id)
      void loadRepositoryPullRequests(repository.path).then((pullRequests) => {
        setRepositories((currentRepositories) =>
          currentRepositories.map((currentRepository) =>
            currentRepository.id === repository.id ? { ...currentRepository, pullRequests } : currentRepository,
          ),
        )
      })
    }
  }, [repositories])

  useEffect(() => {
    if (activePane.kind !== "pull-request" || !activeRepository || activePullRequestDetailState) {
      return
    }

    const repositoryId = activeRepository.id
    const repositoryPath = activeRepository.path
    const pullRequestNumber = activePane.pullRequestNumber

    setRepositories((currentRepositories) =>
      currentRepositories.map((currentRepository) =>
        currentRepository.id === repositoryId
          ? {
              ...currentRepository,
              pullRequestDetails: {
                ...(currentRepository.pullRequestDetails ?? {}),
                [pullRequestNumber]: { status: "loading" },
              },
            }
          : currentRepository,
      ),
    )

    void readGhPullRequestDetail(repositoryPath, pullRequestNumber).then((detailState) => {
      setRepositories((currentRepositories) =>
        currentRepositories.map((currentRepository) =>
          currentRepository.id === repositoryId
            ? {
                ...currentRepository,
                pullRequestDetails: {
                  ...(currentRepository.pullRequestDetails ?? {}),
                  [pullRequestNumber]: detailState,
                },
              }
            : currentRepository,
        ),
      )
    })
  }, [activePane, activeRepository, activePullRequestDetailState])

  useEffect(() => {
    if (activePane.kind !== "pull-request" || !activeRepository || activePullRequestDiffState) {
      return
    }

    const repositoryId = activeRepository.id
    const repositoryPath = activeRepository.path
    const pullRequestNumber = activePane.pullRequestNumber

    setRepositories((currentRepositories) =>
      currentRepositories.map((currentRepository) =>
        currentRepository.id === repositoryId
          ? {
              ...currentRepository,
              pullRequestDiffs: {
                ...(currentRepository.pullRequestDiffs ?? {}),
                [pullRequestNumber]: { status: "loading" },
              },
            }
          : currentRepository,
      ),
    )

    void readGhPullRequestDiff(repositoryPath, pullRequestNumber).then((diffState) => {
      setRepositories((currentRepositories) =>
        currentRepositories.map((currentRepository) =>
          currentRepository.id === repositoryId
            ? {
                ...currentRepository,
                pullRequestDiffs: {
                  ...(currentRepository.pullRequestDiffs ?? {}),
                  [pullRequestNumber]: diffState,
                },
              }
            : currentRepository,
        ),
      )
    })
  }, [activePane, activeRepository, activePullRequestDiffState])

  useEffect(() => {
    if (!status) {
      return
    }

    const timeout = setTimeout(() => {
      setStatus((currentStatus) => (currentStatus === status ? undefined : currentStatus))
    }, STATUS_OVERLAY_DISMISS_MS)

    return () => clearTimeout(timeout)
  }, [status])

  useEffect(() => {
    const copySelectionToClipboard = (selection: Selection) => {
      const text = selection.getSelectedText()
      if (!text) {
        return
      }

      const result = copyTextToClipboard(renderer, text)
      setStatus({
        text: result.ok ? formatCopiedSelectionStatus(text) : result.message,
      })
    }

    renderer.on(CliRenderEvents.SELECTION, copySelectionToClipboard)
    return () => {
      renderer.off(CliRenderEvents.SELECTION, copySelectionToClipboard)
    }
  }, [renderer])

  function setActiveSelection(nextSelection: HunkDiffSelection) {
    if (!activeRepository) {
      return
    }

    setSelections((current) => ({
      ...current,
      [activeRepository.id]: nextSelection,
    }))
  }

  function showOpenRepositoryPrompt() {
    setRepositoryPathInput("")
    setSelectedPathSuggestionIndex(0)
    setOpenPromptError("")
    setStatus(undefined)
    setOpenPromptVisible(true)
  }

  function cancelOpenRepositoryPrompt() {
    setOpenPromptVisible(false)
    setRepositoryPathInput("")
    setSelectedPathSuggestionIndex(0)
    setOpenPromptError("")
  }

  function updateRepositoryPathInput(value: string) {
    setRepositoryPathInput(value)
    setSelectedPathSuggestionIndex(0)
    setOpenPromptError("")
  }

  function completeSelectedPathSuggestion() {
    const suggestion = pathSuggestions[normalizedPathSuggestionIndex]
    if (!suggestion) {
      return
    }

    updateRepositoryPathInput(suggestion.value)
  }

  function movePathSuggestion(delta: number) {
    if (pathSuggestions.length === 0) {
      return
    }

    setSelectedPathSuggestionIndex((currentIndex) => {
      const nextIndex = currentIndex + delta
      return (nextIndex + pathSuggestions.length) % pathSuggestions.length
    })
  }

  function selectWorkingChanges(repositoryId: string) {
    setActivePane({
      kind: "working",
      repositoryId,
    })
  }

  function selectPullRequest(repositoryId: string, pullRequest: PullRequestSummary) {
    setActivePane({
      kind: "pull-request",
      pullRequestNumber: pullRequest.number,
      repositoryId,
    })
  }

  function openPullRequestUrl(url: string) {
    const message = openExternalUrl(url)
    setStatus({
      text: message ?? "Opening pull request in browser.",
    })
  }

  function submitOpenRepository(input: string) {
    const directory = input.trim()
    if (!directory) {
      setOpenPromptError("Enter a git repository path.")
      return
    }

    let nextRepository: RepositoryView
    try {
      nextRepository = openGitRepository(directory, staged)
    } catch (error) {
      setOpenPromptError(error instanceof Error ? error.message : String(error))
      return
    }

    const existingRepository = repositories.find((repository) => repository.path === nextRepository.path)
    if (existingRepository) {
      selectWorkingChanges(existingRepository.id)
      setOpenPromptVisible(false)
      setRepositoryPathInput("")
      setOpenPromptError("")
      setStatus({ text: `Repository already open: ${existingRepository.name}.` })
      return
    }

    setRepositories((currentRepositories) => [...currentRepositories, nextRepository])
    setSelections((currentSelections) => ({
      ...currentSelections,
      [nextRepository.id]: defaultSelection(nextRepository.files),
    }))
    selectWorkingChanges(nextRepository.id)
    setOpenPromptVisible(false)
    setRepositoryPathInput("")
    setOpenPromptError("")
    setStatus({ text: `Opened ${nextRepository.name}.` })
  }

  function closeRepository(repositoryId: string) {
    const closedRepositoryIndex = repositories.findIndex((repository) => repository.id === repositoryId)
    if (closedRepositoryIndex < 0) {
      return
    }

    const closedRepository = repositories[closedRepositoryIndex]
    if (!closedRepository) {
      return
    }

    const nextRepositories = repositories.filter((repository) => repository.id !== repositoryId)
    const nextActiveRepository = nextRepositories[Math.min(closedRepositoryIndex, nextRepositories.length - 1)]

    setRepositories(nextRepositories)
    setSelections((currentSelections) => {
      const nextSelections = { ...currentSelections }
      delete nextSelections[repositoryId]
      return nextSelections
    })
    pullRequestLoadIds.current.delete(repositoryId)

    if (activeRepository?.id === repositoryId) {
      selectWorkingChanges(nextActiveRepository?.id ?? "")
    }

    setStatus({
      text:
        nextRepositories.length > 0
          ? `Closed ${closedRepository.name}.`
          : `Closed ${closedRepository.name}. Open another repository with o.`,
    })
  }

  function selectNextRepository() {
    if (repositories.length <= 1) {
      return
    }

    const currentIndex = Math.max(
      0,
      repositories.findIndex((repository) => repository.id === activeRepository?.id),
    )
    const nextRepository = repositories[(currentIndex + 1) % repositories.length]
    if (nextRepository) {
      selectWorkingChanges(nextRepository.id)
    }
  }

  useKeyboard((key) => {
    const name = key.name?.toLowerCase() ?? ""
    const sequence = key.sequence?.toLowerCase()

    if (isOpenPromptVisible) {
      if (name === "escape") {
        key.preventDefault()
        cancelOpenRepositoryPrompt()
        return
      }

      if (name === "tab" || sequence === "\t") {
        key.preventDefault()
        completeSelectedPathSuggestion()
        return
      }

      if (name === "up" || name === "kpup") {
        key.preventDefault()
        movePathSuggestion(-1)
        return
      }

      if (name === "down" || name === "kpdown") {
        key.preventDefault()
        movePathSuggestion(1)
        return
      }
      return
    }

    if (name === "escape" || name === "q" || sequence === "q") {
      renderer.destroy()
      return
    }

    if (name === "o" || sequence === "o") {
      showOpenRepositoryPrompt()
      return
    }

    if (name === "tab" || sequence === "\t") {
      selectNextRepository()
    }
  })

  return (
    <box
      style={{
        width: "100%",
        height: "100%",
        flexDirection: "column",
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 1,
        paddingBottom: 1,
        position: "relative",
        backgroundColor: MACCHIATO.base,
      }}
    >
      <box style={{ width: "100%", height: 1 }}>
        <text fg={MACCHIATO.lavender}>{fitText("Gitty", headerWidth)}</text>
      </box>
      <box style={{ width: "100%", height: 1 }}>
        <text fg={MACCHIATO.subtext0}>{fitText(commandText, headerWidth)}</text>
      </box>
      <box style={{ height: 1 }} />
      {isOpenPromptVisible ? (
        <>
          <OpenRepositoryPrompt
            message={openPromptError}
            onCompleteSuggestion={updateRepositoryPathInput}
            onInput={updateRepositoryPathInput}
            onSubmit={submitOpenRepository}
            selectedSuggestionIndex={normalizedPathSuggestionIndex}
            suggestions={pathSuggestions}
            value={repositoryPathInput}
            width={headerWidth}
          />
          <box style={{ height: 1 }} />
        </>
      ) : null}
      <box style={{ width: "100%", flexGrow: 1, flexDirection: "row" }}>
        <RepositorySidebar
          activePane={activePane}
          activeRepositoryId={activeRepository?.id ?? ""}
          onCloseRepository={closeRepository}
          onOpenRepository={showOpenRepositoryPrompt}
          onSelectPullRequest={selectPullRequest}
          onSelectWorkingChanges={selectWorkingChanges}
          width={repositoryWidth}
          repositories={repositories}
        />
        <box style={{ width: 1, height: "100%" }} />
        {activePane.kind === "pull-request" && activeRepository ? (
          <PullRequestPane
            detailState={activePullRequestDetailState}
            diffState={activePullRequestDiffState}
            onOpenUrl={openPullRequestUrl}
            pullRequestNumber={activePane.pullRequestNumber}
            summary={activePullRequestSummary}
            theme={theme}
            width={gitPaneWidth}
          />
        ) : (
          <GitPane
            onSelectionChange={setActiveSelection}
            selection={selection}
            theme={theme}
            width={gitPaneWidth}
            repository={activeRepository}
          />
        )}
      </box>
      <StatusOverlay status={status} width={headerWidth} />
    </box>
  )
}

async function main() {
  const options = parseCliOptions(Bun.argv.slice(2))

  if (options.help) {
    process.stdout.write(`${usage()}\n`)
    return
  }

  const repositories = await resolveRepositories(options)
  const renderer = await createCliRenderer({
    screenMode: "alternate-screen",
    useMouse: true,
    exitOnCtrlC: true,
    openConsoleOnError: true,
  })

  createRoot(renderer).render(
    <DiffApp
      initialRepositories={repositories}
      staged={options.staged}
      theme={options.theme}
    />,
  )
}

try {
  await main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`gitty: ${message}\n\n${usage()}\n`)
  process.exitCode = 1
}
