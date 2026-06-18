import { readFileSync } from "node:fs"
import { basename, join, resolve } from "node:path"
import { createCliRenderer } from "@opentui/core"
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
import { useMemo, useState } from "react"

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

const DEFAULT_THEME: HunkDiffThemeName = "catppuccin-macchiato"
const NULL_DIFF_PATH = "/dev/null"

const MACCHIATO = {
  mauve: "#c6a0f6",
  lavender: "#b7bdf8",
  text: "#cad3f5",
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

  return refs.map((repository, index) => {
    const sourceLabel = `${repository.name} ${staged ? "staged changes" : "working changes"}`
    const patch = readGitDiff(staged, repository.path)
    const files = patch.trim().length > 0 ? createDiffFilesFromPatch(patch, sourceLabel) : []

    return {
      id: `repository:${index}:${repository.path}`,
      name: repository.name,
      path: repository.path,
      files,
      stats: summarizeFiles(files),
    }
  })
}

function resolveGitRepository(directory: string): GitRepositoryRef {
  const absolutePath = resolve(directory)
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

function RepositorySidebar({
  activeRepositoryId,
  onSelectRepository,
  width,
  repositories,
}: {
  activeRepositoryId: string
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
        {repositories.map((repository) => {
          const active = repository.id === activeRepositoryId

          return (
            <box key={repository.id} style={{ width: "100%", height: 5, flexDirection: "column" }}>
              <box style={{ width: "100%", height: 1 }}>
                <text fg={active ? MACCHIATO.lavender : MACCHIATO.text}>
                  {fitText(repository.name, contentWidth)}
                </text>
              </box>
              <box style={{ width: "100%", height: 1 }}>
                <text fg={MACCHIATO.subtext0}>{fitText(repository.path, contentWidth)}</text>
              </box>
              <box
                style={{
                  width: "100%",
                  height: 1,
                  backgroundColor: active ? MACCHIATO.surface0 : MACCHIATO.mantle,
                }}
                onMouseUp={() => onSelectRepository(repository.id)}
              >
                <text fg={active ? MACCHIATO.mauve : MACCHIATO.text}>
                  {fitText(`${active ? ">" : " "} Working changes`, contentWidth)}
                </text>
              </box>
              <box style={{ width: "100%", height: 1 }}>
                <text fg={MACCHIATO.subtext0}>
                  {fitText(
                    `  ${pluralize(repository.files.length, "file")} +${repository.stats.additions} -${repository.stats.deletions}`,
                    contentWidth,
                  )}
                </text>
              </box>
              <box style={{ width: "100%", height: 1 }} />
            </box>
          )
        })}
      </scrollbox>
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
            {fitText("No working changes in this repository.", Math.max(1, paneContentWidth - 2))}
          </text>
        </box>
      )}
    </box>
  )
}

function DiffApp({
  theme,
  repositories,
}: {
  theme: HunkDiffThemeName
  repositories: RepositoryView[]
}) {
  const renderer = useRenderer()
  const terminal = useTerminalDimensions()
  const firstRepository = repositories[0]
  const [activeRepositoryId, setActiveRepositoryId] = useState(firstRepository?.id ?? "")
  const [selections, setSelections] = useState<Record<string, HunkDiffSelection>>(() =>
    Object.fromEntries(repositories.map((repository) => [repository.id, defaultSelection(repository.files)])),
  )

  const activeRepository = useMemo(
    () => repositories.find((repository) => repository.id === activeRepositoryId) ?? firstRepository,
    [activeRepositoryId, firstRepository, repositories],
  )
  const files = activeRepository?.files ?? []
  const selection = normalizeSelection(files, activeRepository ? selections[activeRepository.id] : undefined)
  const shellWidth = Math.max(1, terminal.width - 2)
  const repositoryWidth = Math.min(30, Math.max(19, Math.floor(shellWidth * 0.24)))
  const gitPaneWidth = Math.max(1, shellWidth - repositoryWidth - 1)
  const headerWidth = shellWidth

  function setActiveSelection(nextSelection: HunkDiffSelection) {
    if (!activeRepository) {
      return
    }

    setSelections((current) => ({
      ...current,
      [activeRepository.id]: nextSelection,
    }))
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

    if (name === "escape" || name === "q" || sequence === "q") {
      renderer.destroy()
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
        backgroundColor: MACCHIATO.base,
      }}
    >
      <box style={{ width: "100%", height: 1 }}>
        <text fg={MACCHIATO.lavender}>{fitText("Gitty", headerWidth)}</text>
      </box>
      <box style={{ width: "100%", height: 1 }}>
        <text fg={MACCHIATO.subtext0}>
          {fitText(
            `${pluralize(repositories.length, "repository", "repositories")}  |  tab repository  q quit`,
            headerWidth,
          )}
        </text>
      </box>
      <box style={{ height: 1 }} />
      <box style={{ width: "100%", flexGrow: 1, flexDirection: "row" }}>
        <RepositorySidebar
          activeRepositoryId={activeRepository?.id ?? ""}
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
      theme={options.theme}
      repositories={repositories}
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
