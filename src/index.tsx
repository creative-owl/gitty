import { readFileSync } from "node:fs"
import { createCliRenderer } from "@opentui/core"
import { createRoot, useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import {
  HUNK_DIFF_THEME_NAMES,
  HunkFileNav,
  HunkReviewStream,
  createHunkDiffFilesFromPatch,
  type HunkDiffFile,
  type HunkDiffLayout,
  type HunkDiffSelection,
  type HunkDiffThemeName,
} from "hunkdiff/opentui"
import { useMemo, useState } from "react"

type PatchSource = {
  label: string
  patch: string
}

type CliOptions = {
  help: boolean
  patchFile?: string
  staged: boolean
  sample: boolean
  layout: HunkDiffLayout
  theme: HunkDiffThemeName
  wrapLines: boolean
  sidebar: boolean
}

const DEFAULT_THEME: HunkDiffThemeName = "midnight"
const DEFAULT_LAYOUT: HunkDiffLayout = "split"
const MIN_MAIN_WIDTH = 36

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
  bun run start -- --patch path/to/change.patch
  bun run start -- --staged
  git diff | bun run start

Options:
  --patch <file>       Read a unified diff from a file.
  --staged            Show staged git changes instead of unstaged changes.
  --sample            Show the built-in sample diff.
  --layout <split|stack>
  --theme <name>      ${HUNK_DIFF_THEME_NAMES.join(", ")}
  --wrap              Wrap long code lines.
  --no-sidebar        Hide the file navigation pane.
  -h, --help          Show this help text.`
}

function parseCliOptions(args: string[]): CliOptions {
  const options: CliOptions = {
    help: false,
    staged: false,
    sample: false,
    layout: DEFAULT_LAYOUT,
    theme: DEFAULT_THEME,
    wrapLines: false,
    sidebar: true,
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

    if (arg === "--wrap") {
      options.wrapLines = true
      continue
    }

    if (arg === "--no-sidebar") {
      options.sidebar = false
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
      const next = args[index + 1]
      if (!isLayout(next)) {
        throw new Error("--layout must be either split or stack")
      }
      options.layout = next
      index += 1
      continue
    }

    if (arg.startsWith("--layout=")) {
      const next = arg.slice("--layout=".length)
      if (!isLayout(next)) {
        throw new Error("--layout must be either split or stack")
      }
      options.layout = next
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

function isLayout(value: string | undefined): value is HunkDiffLayout {
  return value === "split" || value === "stack"
}

function isTheme(value: string | undefined): value is HunkDiffThemeName {
  return HUNK_DIFF_THEME_NAMES.includes(value as HunkDiffThemeName)
}

async function resolvePatchSource(options: CliOptions): Promise<PatchSource> {
  if (options.sample) {
    return {
      label: "sample patch",
      patch: SAMPLE_PATCH,
    }
  }

  if (options.patchFile) {
    return {
      label: options.patchFile,
      patch: readFileSync(options.patchFile, "utf8"),
    }
  }

  if (!process.stdin.isTTY) {
    const patch = await Bun.stdin.text()
    if (patch.trim().length > 0) {
      return {
        label: "stdin",
        patch,
      }
    }
  }

  const gitPatch = readGitDiff(options.staged)
  if (gitPatch.trim().length > 0) {
    return {
      label: options.staged ? "git diff --cached" : "git diff",
      patch: gitPatch,
    }
  }

  if (options.staged) {
    throw new Error("No staged changes found.")
  }

  return {
    label: "sample patch",
    patch: SAMPLE_PATCH,
  }
}

function readGitDiff(staged: boolean): string {
  const args = ["diff", "--no-ext-diff", "--src-prefix=a/", "--dst-prefix=b/"]
  if (staged) {
    args.splice(1, 0, "--cached")
  }

  const result = Bun.spawnSync(["git", ...args], {
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

  const untrackedPatch = readUntrackedFilePatches()
  return [trackedPatch.trimEnd(), untrackedPatch.trimEnd()].filter(Boolean).join("\n")
}

function readUntrackedFilePatches(): string {
  const result = Bun.spawnSync(["git", "ls-files", "--others", "--exclude-standard", "-z"], {
    stderr: "pipe",
    stdout: "pipe",
  })

  if (result.exitCode !== 0) {
    return ""
  }

  const paths = new TextDecoder().decode(result.stdout).split("\0").filter(Boolean)
  return paths.map(createUntrackedFilePatch).filter(Boolean).join("\n")
}

function createUntrackedFilePatch(filePath: string): string {
  const contents = readFileSync(filePath, "utf8")
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
  const files = createHunkDiffFilesFromPatch(source.patch, source.label)
  if (files.length === 0) {
    throw new Error(`No file diffs found in ${source.label}.`)
  }
  return files
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
  return `${value.slice(0, width - 1)}...`.slice(0, width)
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

function Button({
  active,
  label,
  onPress,
}: {
  active: boolean
  label: string
  onPress: () => void
}) {
  return (
    <box
      style={{
        width: label.length + 2,
        height: 1,
        backgroundColor: active ? "#164E63" : "#1F2937",
      }}
      onMouseUp={onPress}
    >
      <text fg={active ? "#ECFEFF" : "#CBD5E1"}>{` ${label} `}</text>
    </box>
  )
}

function DiffApp({
  files,
  initialLayout,
  initialSidebar,
  initialWrapLines,
  sourceLabel,
  theme,
}: {
  files: HunkDiffFile[]
  initialLayout: HunkDiffLayout
  initialSidebar: boolean
  initialWrapLines: boolean
  sourceLabel: string
  theme: HunkDiffThemeName
}) {
  const renderer = useRenderer()
  const terminal = useTerminalDimensions()
  const firstFile = files[0]
  const [layout, setLayout] = useState(initialLayout)
  const [wrapLines, setWrapLines] = useState(initialWrapLines)
  const [showSidebar, setShowSidebar] = useState(initialSidebar)
  const [selection, setSelection] = useState<HunkDiffSelection>({
    fileId: firstFile?.id ?? "",
    hunkIndex: 0,
  })

  const totals = useMemo(
    () =>
      files.reduce(
        (acc, file) => ({
          additions: acc.additions + file.stats.additions,
          deletions: acc.deletions + file.stats.deletions,
        }),
        { additions: 0, deletions: 0 },
      ),
    [files],
  )

  const navWidth = showSidebar && terminal.width >= 82 ? Math.min(34, Math.max(26, Math.floor(terminal.width * 0.28))) : 0
  const mainWidth = Math.max(MIN_MAIN_WIDTH, terminal.width - navWidth - 4)
  const headerWidth = Math.max(1, terminal.width - 2)
  const selectedFileId = files.some((file) => file.id === selection.fileId) ? selection.fileId : firstFile?.id

  useKeyboard((key) => {
    const name = key.name.toLowerCase()
    const sequence = key.sequence?.toLowerCase()

    if (name === "escape" || name === "q" || sequence === "q") {
      renderer.destroy()
      return
    }

    if (name === "s" || sequence === "s") {
      setLayout((current) => (current === "split" ? "stack" : "split"))
      return
    }

    if (name === "w" || sequence === "w") {
      setWrapLines((current) => !current)
      return
    }

    if (name === "h" || sequence === "h") {
      setShowSidebar((current) => !current)
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
        backgroundColor: "#0B1120",
      }}
    >
      <box style={{ width: "100%", height: 1 }}>
        <text fg="#BAE6FD">{fitText(`Gitty diff viewer - ${sourceLabel}`, headerWidth)}</text>
      </box>
      <box style={{ width: "100%", height: 1 }}>
        <text fg="#94A3B8">
          {fitText(
            `${pluralize(files.length, "file")}  +${totals.additions}  -${totals.deletions}  |  s layout  w wrap  h sidebar  q quit`,
            headerWidth,
          )}
        </text>
      </box>
      <box style={{ width: "100%", height: 1, flexDirection: "row" }}>
        <Button active={layout === "split"} label="split" onPress={() => setLayout("split")} />
        <box style={{ width: 1, height: 1 }} />
        <Button active={layout === "stack"} label="stack" onPress={() => setLayout("stack")} />
        <box style={{ width: 1, height: 1 }} />
        <Button active={wrapLines} label="wrap" onPress={() => setWrapLines((current) => !current)} />
        <box style={{ width: 1, height: 1 }} />
        <Button active={showSidebar} label="files" onPress={() => setShowSidebar((current) => !current)} />
      </box>
      <box style={{ height: 1 }} />
      <box style={{ width: "100%", flexGrow: 1, flexDirection: "row" }}>
        {navWidth > 0 && selectedFileId ? (
          <>
            <box
              title="Files"
              style={{
                width: navWidth,
                height: "100%",
                border: true,
                borderStyle: "rounded",
                borderColor: "#334155",
              }}
            >
              <scrollbox style={{ width: "100%", height: "100%" }} scrollY>
                <HunkFileNav
                  files={files}
                  selectedFileId={selectedFileId}
                  width={Math.max(20, navWidth - 2)}
                  theme={theme}
                  onSelectFile={(fileId) => setSelection({ fileId, hunkIndex: 0 })}
                />
              </scrollbox>
            </box>
            <box style={{ width: 1, height: "100%" }} />
          </>
        ) : null}
        <box
          title="Diff"
          style={{
            flexGrow: 1,
            height: "100%",
            border: true,
            borderStyle: "rounded",
            borderColor: "#334155",
          }}
        >
          <scrollbox style={{ width: "100%", height: "100%" }} scrollY>
            <HunkReviewStream
              files={files}
              layout={layout}
              width={mainWidth}
              theme={theme}
              selection={selection}
              wrapLines={wrapLines}
              onSelectionChange={setSelection}
            />
          </scrollbox>
        </box>
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

  const source = await resolvePatchSource(options)
  const files = parsePatchFiles(source)
  const renderer = await createCliRenderer({
    screenMode: "alternate-screen",
    useMouse: true,
    exitOnCtrlC: true,
    openConsoleOnError: true,
  })

  createRoot(renderer).render(
    <DiffApp
      files={files}
      initialLayout={options.layout}
      initialSidebar={options.sidebar}
      initialWrapLines={options.wrapLines}
      sourceLabel={source.label}
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
