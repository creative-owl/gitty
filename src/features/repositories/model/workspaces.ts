import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { asArray, isRecord, readString } from "../../../shared/lib/record"
import type { RepositoryView } from "./types"

const WORKSPACE_STATE_VERSION = 1

type WorkspaceState = {
  paths: string[]
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
    }
  } catch {
    return undefined
  }
}

export function saveWorkspacePaths(paths: string[]) {
  try {
    const filePath = getWorkspaceStateFilePath()
    const uniquePaths = uniqueNonEmptyStrings(paths)
    const payload = `${JSON.stringify(
      {
        version: WORKSPACE_STATE_VERSION,
        workspaces: uniquePaths.map((path) => ({ path })),
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
  return uniqueNonEmptyStrings(workspaceValues.flatMap((workspace) => {
    const path = readWorkspacePath(workspace)
    return path ? [path] : []
  }))
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
