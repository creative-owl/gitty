import { describe, expect, test } from "bun:test"
import { DEFAULT_THEME, parseCliOptions } from "./cli"

describe("parseCliOptions", () => {
  test("uses defaults when no arguments are provided", () => {
    expect(parseCliOptions([])).toEqual({
      help: false,
      repositoryDirs: [],
      sample: false,
      staged: false,
      theme: DEFAULT_THEME,
      themeProvided: false,
      version: false,
    })
  })

  test("parses repositories, staged changes, and explicit theme", () => {
    expect(
      parseCliOptions(["--repository", "../repo-a", "--workspace=../repo-b", "--staged", "--theme", "ghostty-dracula"]),
    ).toEqual({
      help: false,
      repositoryDirs: ["../repo-a", "../repo-b"],
      sample: false,
      staged: true,
      theme: "ghostty-dracula",
      themeProvided: true,
      version: false,
    })
  })

  test("parses version requests", () => {
    expect(parseCliOptions(["--version"])).toMatchObject({
      version: true,
    })
    expect(parseCliOptions(["-V"])).toMatchObject({
      version: true,
    })
  })

  test("parses patch file arguments", () => {
    expect(parseCliOptions(["--patch=changes.patch"])).toMatchObject({
      patchFile: "changes.patch",
    })
    expect(parseCliOptions(["inline.patch"])).toMatchObject({
      patchFile: "inline.patch",
    })
  })

  test("rejects invalid themes and unknown options", () => {
    expect(() => parseCliOptions(["--theme", "unknown"])).toThrow("--theme must be one of:")
    expect(() => parseCliOptions(["--missing"])).toThrow("Unknown option: --missing")
  })
})
