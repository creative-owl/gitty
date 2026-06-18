import { readFileSync } from "node:fs"
import { join } from "node:path"
import { getFiletypeFromFileName } from "@pierre/diffs"
import {
  createHunkDiffFilesFromPatch,
  type HunkDiffFile,
  type HunkDiffSelection,
} from "hunkdiff/opentui"

export type PatchSource = {
  label: string
  patch: string
}

const NULL_DIFF_PATH = "/dev/null"

export function readGitDiff(staged: boolean, repositoryPath: string): string {
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

export function parsePatchFiles(source: PatchSource): HunkDiffFile[] {
  const files = createDiffFilesFromPatch(source.patch, source.label)
  if (files.length === 0) {
    throw new Error(`No file diffs found in ${source.label}.`)
  }
  return files
}

export function createDiffFilesFromPatch(patch: string, sourceLabel: string): HunkDiffFile[] {
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

export function summarizeFiles(files: HunkDiffFile[]) {
  return files.reduce(
    (acc, file) => ({
      additions: acc.additions + file.stats.additions,
      deletions: acc.deletions + file.stats.deletions,
    }),
    { additions: 0, deletions: 0 },
  )
}

export function defaultSelection(files: HunkDiffFile[]): HunkDiffSelection {
  return {
    fileId: files[0]?.id ?? "",
    hunkIndex: 0,
  }
}

export function normalizeSelection(files: HunkDiffFile[], selection: HunkDiffSelection | undefined): HunkDiffSelection {
  if (selection && files.some((file) => file.id === selection.fileId)) {
    return selection
  }
  return defaultSelection(files)
}
