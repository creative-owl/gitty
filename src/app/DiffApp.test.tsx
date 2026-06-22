import { testRender } from "@opentui/react/test-utils"
import type { TestRendererSetup } from "@opentui/core/testing"
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { act } from "react"
import type { RepositoryView } from "../features/repositories/model/types"
import { getWorkspaceStateFilePath, readSavedWorkspaceState } from "../features/repositories/model/workspaces"
import type { ThemeName } from "../shared/theme"
import { DiffApp } from "./DiffApp"

let previousStateDirectory: string | undefined
let stateDirectory: string

beforeEach(() => {
  previousStateDirectory = process.env.GITTY_STATE_DIR
  stateDirectory = mkdtempSync(join(tmpdir(), "gitty-diff-app-test-"))
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

describe("DiffApp theme picker", () => {
  test("previews the highlighted theme and restores the previous theme on cancel", async () => {
    const app = await renderApp("catppuccin-macchiato")

    try {
      await press(app, () => app.mockInput.pressKey("t"))
      expect(app.captureCharFrame()).toContain("> * Catppuccin Macchiato")

      await press(app, () => app.mockInput.pressArrow("down"))
      expect(app.captureCharFrame()).toContain("> * Catppuccin Mocha")

      await press(app, () => app.mockInput.pressEscape())
      expect(existsSync(getWorkspaceStateFilePath())).toBe(false)
      expect(readSavedWorkspaceState()).toBeUndefined()

      await press(app, () => app.mockInput.pressKey("t"))
      expect(app.captureCharFrame()).toContain("> * Catppuccin Macchiato")
    } finally {
      await destroy(app)
    }
  })

  test("commits the selected preview theme and persists it to workspace state", async () => {
    const app = await renderApp("ghostty-dracula")

    try {
      await press(app, () => app.mockInput.pressKey("t"))
      expect(app.captureCharFrame()).toContain("> * Dracula")

      await press(app, () => app.mockInput.pressArrow("down"))
      expect(app.captureCharFrame()).toContain("> * Dracula+")

      await press(app, () => app.mockInput.pressEnter())
      expect(readSavedWorkspaceState()?.theme).toBe("ghostty-dracula-plus")
      expect(JSON.parse(readFileSync(getWorkspaceStateFilePath(), "utf8"))).toMatchObject({
        theme: "ghostty-dracula-plus",
      })

      await press(app, () => app.mockInput.pressKey("t"))
      expect(app.captureCharFrame()).toContain("> * Dracula+")
    } finally {
      await destroy(app)
    }
  })
})

async function renderApp(theme: ThemeName) {
  const app = await testRender(
    <DiffApp initialRepositories={[createRepository()]} persistWorkspaces={false} staged={false} theme={theme} />,
    { height: 30, kittyKeyboard: true, width: 100 },
  )
  await app.flush()
  return app
}

async function press(app: TestRendererSetup, action: () => void) {
  await act(async () => {
    action()
    await app.flush()
  })
  await app.flush()
}

async function destroy(app: TestRendererSetup) {
  await act(async () => {
    app.renderer.destroy()
    await Promise.resolve()
  })
}

function createRepository(): RepositoryView {
  return {
    files: [],
    id: "repository:/repo/test",
    name: "Test",
    path: "/repo/test",
    stats: {
      additions: 0,
      deletions: 0,
    },
  }
}
