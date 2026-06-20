import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  getPersistableWorkspacePaths,
  getWorkspaceStateFilePath,
  readSavedWorkspaceState,
  saveWorkspacePaths,
  saveWorkspaceTheme,
} from "./workspaces"
import type { RepositoryView } from "./types"

let previousStateDirectory: string | undefined
let stateDirectory: string

beforeEach(() => {
  previousStateDirectory = process.env.GITTY_STATE_DIR
  stateDirectory = mkdtempSync(join(tmpdir(), "gitty-workspaces-test-"))
  process.env.GITTY_STATE_DIR = stateDirectory
})

afterEach(() => {
  if (previousStateDirectory === undefined) {
    delete process.env.GITTY_STATE_DIR
  } else {
    process.env.GITTY_STATE_DIR = previousStateDirectory
  }
  rmSync(stateDirectory, { force: true, recursive: true })
})

describe("workspace state", () => {
  test("returns undefined when no state file exists", () => {
    expect(readSavedWorkspaceState()).toBeUndefined()
  })

  test("deduplicates and preserves workspace paths when saving a theme", () => {
    expect(saveWorkspacePaths([" /repo/a ", "/repo/b", "/repo/a", ""])).toBe(true)
    expect(saveWorkspaceTheme("paper")).toBe(true)

    expect(readSavedWorkspaceState()).toEqual({
      paths: ["/repo/a", "/repo/b"],
      theme: "paper",
    })

    expect(JSON.parse(readFileSync(getWorkspaceStateFilePath(), "utf8"))).toEqual({
      version: 2,
      workspaces: [{ path: "/repo/a" }, { path: "/repo/b" }],
      theme: "paper",
    })
  })

  test("preserves a saved theme when workspace paths are rewritten", () => {
    expect(saveWorkspaceTheme("ghostty-dracula")).toBe(true)
    expect(saveWorkspacePaths(["/repo/c"])).toBe(true)

    expect(readSavedWorkspaceState()).toEqual({
      paths: ["/repo/c"],
      theme: "ghostty-dracula",
    })
  })

  test("reads legacy array state and ignores invalid themes", () => {
    writeFileSync(getWorkspaceStateFilePath(), JSON.stringify(["/repo/a", { path: "/repo/b" }]), "utf8")
    expect(readSavedWorkspaceState()).toEqual({
      paths: ["/repo/a", "/repo/b"],
      theme: undefined,
    })

    writeFileSync(
      getWorkspaceStateFilePath(),
      JSON.stringify({ theme: "unknown", workspaces: [{ path: "/repo/c" }] }),
      "utf8",
    )
    expect(readSavedWorkspaceState()).toEqual({
      paths: ["/repo/c"],
      theme: undefined,
    })
  })
})

describe("getPersistableWorkspacePaths", () => {
  test("keeps only repository-backed paths", () => {
    const repositories = [
      createRepository("repository:/repo/a", "/repo/a"),
      createRepository("patch:stdin", "stdin"),
      createRepository("repository:/repo/b", "/repo/b"),
      createRepository("repository:/repo/a:duplicate", "/repo/a"),
    ]

    expect(getPersistableWorkspacePaths(repositories)).toEqual(["/repo/a", "/repo/b"])
  })
})

function createRepository(id: string, path: string): RepositoryView {
  return {
    files: [],
    id,
    name: path,
    path,
    stats: {
      additions: 0,
      deletions: 0,
    },
  }
}
