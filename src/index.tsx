import { existsSync, readdirSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { basename, join, resolve } from "node:path"
import { createCliRenderer, type MouseEvent } from "@opentui/core"
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

type PathSuggestion = {
  isGitRepository: boolean
  value: string
}

type PullRequestSummary = {
  number: number
  title: string
  url: string
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
const PULL_REQUEST_SECTION_LIMIT = 3
const REPOSITORY_CLOSE_CONTROL_WIDTH = 3
const REPOSITORY_SIDEBAR_MAX_WIDTH = 45
const REPOSITORY_SIDEBAR_MIN_WIDTH = 29
const REPOSITORY_SIDEBAR_WIDTH_RATIO = 0.36
const STATUS_OVERLAY_MAX_WIDTH = 56
const STATUS_OVERLAY_MIN_WIDTH = 24

const MACCHIATO = {
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
        "number,title,url",
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
        number: candidate.number,
        title: candidate.title,
        url: typeof candidate.url === "string" ? candidate.url : "",
      },
    ]
  })
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

function createPullRequestSidebarRows(pullRequests: RepositoryPullRequests | undefined) {
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

function createPullRequestSectionRows(pullRequests: PullRequestSummary[]) {
  if (pullRequests.length === 0) {
    return [{ color: MACCHIATO.subtext0, text: "    None" }]
  }

  const visiblePullRequests = pullRequests.slice(0, PULL_REQUEST_SECTION_LIMIT).map((pullRequest) => ({
    color: MACCHIATO.text,
    text: `    #${pullRequest.number} ${pullRequest.title}`,
  }))
  const hiddenPullRequestCount = pullRequests.length - visiblePullRequests.length

  if (hiddenPullRequestCount <= 0) {
    return visiblePullRequests
  }

  return [
    ...visiblePullRequests,
    { color: MACCHIATO.subtext0, text: `    +${hiddenPullRequestCount} more` },
  ]
}

function RepositorySidebar({
  activeRepositoryId,
  onCloseRepository,
  onOpenRepository,
  onSelectRepository,
  width,
  repositories,
}: {
  activeRepositoryId: string
  onCloseRepository: (repositoryId: string) => void
  onOpenRepository: () => void
  onSelectRepository: (repositoryId: string) => void
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
          const pullRequestRows = createPullRequestSidebarRows(repository.pullRequests)
          const selectRepository = () => onSelectRepository(repository.id)
          const closeRepository = (event: MouseEvent) => {
            event.preventDefault()
            event.stopPropagation()
            onCloseRepository(repository.id)
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
                  backgroundColor: active ? MACCHIATO.surface0 : MACCHIATO.mantle,
                }}
                onMouseUp={selectRepository}
              >
                <text fg={active ? MACCHIATO.mauve : MACCHIATO.text}>
                  {fitText(`${active ? ">" : " "} Working changes`, contentWidth)}
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
              {pullRequestRows.map((row, index) => (
                <box
                  key={`${repository.id}:pull-request-row:${index}`}
                  style={{ width: "100%", height: 1 }}
                  onMouseUp={selectRepository}
                >
                  <text fg={row.color}>{fitText(row.text, contentWidth)}</text>
                </box>
              ))}
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
  const [activeRepositoryId, setActiveRepositoryId] = useState(firstRepository?.id ?? "")
  const [selections, setSelections] = useState<Record<string, HunkDiffSelection>>(() =>
    Object.fromEntries(repositories.map((repository) => [repository.id, defaultSelection(repository.files)])),
  )
  const [isOpenPromptVisible, setOpenPromptVisible] = useState(false)
  const [repositoryPathInput, setRepositoryPathInput] = useState("")
  const [selectedPathSuggestionIndex, setSelectedPathSuggestionIndex] = useState(0)
  const [openPromptError, setOpenPromptError] = useState("")
  const [status, setStatus] = useState<OpenRepositoryStatus>()

  const activeRepository = useMemo(
    () => repositories.find((repository) => repository.id === activeRepositoryId) ?? firstRepository,
    [activeRepositoryId, firstRepository, repositories],
  )
  const files = activeRepository?.files ?? []
  const selection = normalizeSelection(files, activeRepository ? selections[activeRepository.id] : undefined)
  const shellWidth = Math.max(1, terminal.width - 2)
  const repositoryWidth = Math.min(
    REPOSITORY_SIDEBAR_MAX_WIDTH,
    Math.max(REPOSITORY_SIDEBAR_MIN_WIDTH, Math.floor(shellWidth * REPOSITORY_SIDEBAR_WIDTH_RATIO)),
  )
  const gitPaneWidth = Math.max(1, shellWidth - repositoryWidth - 1)
  const headerWidth = shellWidth
  const commandText = `${pluralize(repositories.length, "repository", "repositories")}  |  o open repository  |  tab/click repository  |  q quit`
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
      setActiveRepositoryId(existingRepository.id)
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
    setActiveRepositoryId(nextRepository.id)
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
      setActiveRepositoryId(nextActiveRepository?.id ?? "")
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
      setActiveRepositoryId(nextRepository.id)
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
          activeRepositoryId={activeRepository?.id ?? ""}
          onCloseRepository={closeRepository}
          onOpenRepository={showOpenRepositoryPrompt}
          onSelectRepository={setActiveRepositoryId}
          width={repositoryWidth}
          repositories={repositories}
        />
        <box style={{ width: 1, height: "100%" }} />
        <GitPane
          onSelectionChange={setActiveSelection}
          selection={selection}
          theme={theme}
          width={gitPaneWidth}
          repository={activeRepository}
        />
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
