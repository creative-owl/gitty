#!/usr/bin/env bun

import { initializeApp } from "./app/bootstrap"
import { parseCliOptions, usage } from "./app/cli"
import { VERSION } from "./app/version"

async function main() {
  const options = parseCliOptions(Bun.argv.slice(2))

  if (options.help) {
    process.stdout.write(`${usage()}\n`)
    return
  }

  if (options.version) {
    process.stdout.write(`gitty ${VERSION}\n`)
    return
  }

  const {
    createCliRenderer,
    createRoot,
    DiffApp,
    resolveRepositories,
    isPersistableWorkspace,
    readSavedWorkspaceState,
  } = await initializeApp()

  const savedWorkspaceState = readSavedWorkspaceState()
  const repositories = await resolveRepositories(options)
  const theme = options.themeProvided ? options.theme : savedWorkspaceState?.theme ?? options.theme
  const persistWorkspaces =
    !options.patchFile &&
    !options.sample &&
    repositories.every((repository) => isPersistableWorkspace(repository))
  const renderer = await createCliRenderer({
    screenMode: "alternate-screen",
    useMouse: true,
    exitOnCtrlC: true,
    openConsoleOnError: true,
  })

  createRoot(renderer).render(
    <DiffApp
      initialRepositories={repositories}
      persistWorkspaces={persistWorkspaces}
      staged={options.staged}
      theme={theme}
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
