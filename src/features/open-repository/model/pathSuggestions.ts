import { existsSync, readdirSync } from "node:fs"
import { homedir } from "node:os"
import { join, resolve } from "node:path"
import { expandHomePath } from "../../repositories/model/repositories"

export type PathSuggestion = {
  isGitRepository: boolean
  value: string
}

export const OPEN_REPOSITORY_SUGGESTION_ROWS = 5

export function createPathSuggestions(input: string): PathSuggestion[] {
  const context = resolvePathCompletionContext(input)
  const entries = readDirectoryEntries(context.directoryPath)

  const fragment = context.fragment.toLowerCase()
  const dotSuggestions = createDotPathSuggestions(context)
  const directorySuggestions = entries
    .filter((entry) => entry.isDirectory())
    .filter((entry) => (context.fragment.startsWith(".") ? true : !entry.name.startsWith(".")))
    .filter((entry) => entry.name.toLowerCase().startsWith(fragment))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const value = `${context.valuePrefix}${entry.name}/`
      return {
        isGitRepository: existsSync(join(context.directoryPath, entry.name, ".git")),
        value,
      }
    })

  return [...dotSuggestions, ...directorySuggestions].slice(0, OPEN_REPOSITORY_SUGGESTION_ROWS)
}

function readDirectoryEntries(directoryPath: string) {
  try {
    return readdirSync(directoryPath, { withFileTypes: true })
  } catch {
    return []
  }
}

function resolvePathCompletionContext(input: string) {
  if (input === "") {
    return {
      directoryPath: process.cwd(),
      fragment: "",
      valuePrefix: "",
    }
  }

  if (input === "~") {
    return {
      directoryPath: homedir(),
      fragment: "",
      valuePrefix: "~/",
    }
  }

  const lastSlashIndex = input.lastIndexOf("/")
  if (lastSlashIndex >= 0) {
    const valuePrefix = input.slice(0, lastSlashIndex + 1)
    return {
      directoryPath: resolve(expandHomePath(valuePrefix)),
      fragment: input.slice(lastSlashIndex + 1),
      valuePrefix,
    }
  }

  return {
    directoryPath: process.cwd(),
    fragment: input,
    valuePrefix: "",
  }
}

function createDotPathSuggestions({
  directoryPath,
  fragment,
  valuePrefix,
}: {
  directoryPath: string
  fragment: string
  valuePrefix: string
}): PathSuggestion[] {
  if (valuePrefix !== "") {
    return []
  }

  return [
    { isGitRepository: existsSync(join(directoryPath, ".git")), value: "./" },
    { isGitRepository: existsSync(join(resolve(directoryPath, ".."), ".git")), value: "../" },
  ].filter((suggestion) => suggestion.value.startsWith(fragment))
}
