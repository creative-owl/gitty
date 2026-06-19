#!/usr/bin/env bun

import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { parseCliOptions, usage } from "./app/cli"
import { DiffApp } from "./app/DiffApp"
import { resolveRepositories } from "./features/repositories/model/repositories"
import { isPersistableWorkspace } from "./features/repositories/model/workspaces"

async function main() {
  const options = parseCliOptions(Bun.argv.slice(2))

  if (options.help) {
    process.stdout.write(`${usage()}\n`)
    return
  }

  const repositories = await resolveRepositories(options)
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
