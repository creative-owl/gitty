import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { basename, join, resolve } from "node:path"
import { SAMPLE_PATCH } from "../../../shared/fixtures/samplePatch"
import {
  createDiffFilesFromPatch,
  parsePatchFiles,
  readGitDiff,
  summarizeFiles,
  type PatchSource,
} from "../../diff/model/diff"
import type { GitRepositoryRef, RepositoryView } from "./types"
import { readSavedWorkspaceState } from "./workspaces"

export type RepositoryResolveOptions = {
  patchFile?: string
  repositoryDirs: string[]
  sample: boolean
  staged: boolean
}

export async function resolveRepositories(options: RepositoryResolveOptions): Promise<RepositoryView[]> {
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

  const savedWorkspaces = readSavedWorkspaceState()
  if (savedWorkspaces) {
    if (savedWorkspaces.paths.length === 0) {
      return []
    }

    const repositories = resolveAvailableGitRepositoryViews(savedWorkspaces.paths, options.staged)
    if (repositories.length > 0) {
      return repositories
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

function resolveAvailableGitRepositoryViews(directories: string[], staged: boolean): RepositoryView[] {
  const views: RepositoryView[] = []

  for (const directory of directories) {
    try {
      views.push(openGitRepository(directory, staged))
    } catch {
      continue
    }
  }

  return uniqueRepositoryViews(views)
}

function uniqueRepositoryViews(repositories: RepositoryView[]) {
  const seenPaths = new Set<string>()
  const uniqueRepositories: RepositoryView[] = []

  for (const repository of repositories) {
    if (seenPaths.has(repository.path)) {
      continue
    }
    seenPaths.add(repository.path)
    uniqueRepositories.push(repository)
  }

  return uniqueRepositories
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

export function openGitRepository(directory: string, staged: boolean): RepositoryView {
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

export function expandHomePath(directory: string): string {
  if (directory === "~") {
    return homedir()
  }
  if (directory.startsWith("~/")) {
    return join(homedir(), directory.slice(2))
  }
  return directory
}
