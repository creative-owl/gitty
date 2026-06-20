import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { HUNK_DIFF_THEME_NAMES, type HunkDiffThemeName } from "hunkdiff/opentui"
import { asArray, isRecord, readString } from "../../../shared/lib/record"
import type { RepositoryView } from "./types"

const WORKSPACE_STATE_VERSION = 2

type WorkspaceState = {
  paths: string[]
  theme?: HunkDiffThemeName
}

export function readSavedWorkspaceState(): WorkspaceState | undefined {
  const filePath = getWorkspaceStateFilePath()
  if (!existsSync(filePath)) {
    return undefined
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown
    return {
      paths: parseWorkspacePaths(parsed),
      theme: parseWorkspaceTheme(parsed),
    }
  } catch {
    return undefined
  }
}

export function saveWorkspacePaths(paths: string[]) {
  return saveWorkspaceState({ paths })
}

export function saveWorkspaceTheme(theme: HunkDiffThemeName) {
  return saveWorkspaceState({ theme })
}

function saveWorkspaceState(nextState: Partial<WorkspaceState>) {
  try {
    const filePath = getWorkspaceStateFilePath()
    const previousState = readSavedWorkspaceState()
    const paths = "paths" in nextState ? nextState.paths : previousState?.paths
    const theme = "theme" in nextState ? nextState.theme : previousState?.theme
    const uniquePaths = uniqueNonEmptyStrings(paths ?? [])
    const payload = `${JSON.stringify(
      {
        version: WORKSPACE_STATE_VERSION,
        workspaces: uniquePaths.map((path) => ({ path })),
        ...(theme ? { theme } : {}),
      },
      null,
      2,
    )}\n`
    const temporaryPath = `${filePath}.${process.pid}.tmp`

    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(temporaryPath, payload, "utf8")
    renameSync(temporaryPath, filePath)
    return true
  } catch {
    return false
  }
}

export function getPersistableWorkspacePaths(repositories: RepositoryView[]) {
  return uniqueNonEmptyStrings(
    repositories.flatMap((repository) => (isPersistableWorkspace(repository) ? [repository.path] : [])),
  )
}

export function isPersistableWorkspace(repository: RepositoryView) {
  return repository.id.startsWith("repository:")
}

export function getWorkspaceStateFilePath() {
  return join(getWorkspaceStateDirectory(), "workspaces.json")
}

function getWorkspaceStateDirectory() {
  if (process.env.GITTY_STATE_DIR) {
    return process.env.GITTY_STATE_DIR
  }
  if (process.env.XDG_STATE_HOME) {
    return join(process.env.XDG_STATE_HOME, "gitty")
  }
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "gitty")
  }
  if (process.platform === "win32") {
    return join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "gitty")
  }
  return join(homedir(), ".local", "state", "gitty")
}

function parseWorkspacePaths(value: unknown) {
  const workspaceValues = isRecord(value) ? asArray(value.workspaces) : asArray(value)
  return uniqueNonEmptyStrings(
    workspaceValues.flatMap((workspace) => {
      const path = readWorkspacePath(workspace)
      return path ? [path] : []
    }),
  )
}

function parseWorkspaceTheme(value: unknown): HunkDiffThemeName | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const theme = readString(value.theme)
  return isTheme(theme) ? theme : undefined
}

function readWorkspacePath(value: unknown) {
  if (typeof value === "string") {
    return value
  }
  if (!isRecord(value)) {
    return ""
  }
  return readString(value.path)
}

function uniqueNonEmptyStrings(values: string[]) {
  const seen = new Set<string>()
  const uniqueValues: string[] = []

  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) {
      continue
    }
    seen.add(trimmed)
    uniqueValues.push(trimmed)
  }

  return uniqueValues
}

function isTheme(value: string): value is HunkDiffThemeName {
  return HUNK_DIFF_THEME_NAMES.includes(value as HunkDiffThemeName)
}
