import { describe, expect, test } from "bun:test"
import { HUNK_DIFF_THEME_NAMES } from "hunkdiff/opentui"
import { formatThemeName, getThemeIndex, THEME_NAMES } from "./themes"

describe("theme picker model", () => {
  test("uses the built-in Hunk theme order", () => {
    expect(THEME_NAMES).toEqual([...HUNK_DIFF_THEME_NAMES])
  })

  test("formats theme names for display", () => {
    expect(formatThemeName("catppuccin-macchiato")).toBe("Catppuccin Macchiato")
    expect(formatThemeName("zenburn")).toBe("Zenburn")
  })

  test("finds a theme index with a stable fallback", () => {
    expect(getThemeIndex("paper")).toBe(THEME_NAMES.indexOf("paper"))
    expect(getThemeIndex("catppuccin-macchiato")).toBe(THEME_NAMES.indexOf("catppuccin-macchiato"))
  })
})
