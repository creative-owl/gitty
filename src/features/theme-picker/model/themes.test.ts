import { describe, expect, test } from "bun:test"
import { HUNK_DIFF_THEME_NAMES } from "hunkdiff/opentui"
import { formatThemeName, getThemeIndex, THEME_NAMES } from "./themes"

describe("theme picker model", () => {
  test("keeps built-in Hunk themes first and includes Ghostty themes", () => {
    expect(THEME_NAMES.slice(0, HUNK_DIFF_THEME_NAMES.length)).toEqual([...HUNK_DIFF_THEME_NAMES])
    expect(THEME_NAMES).toContain("ghostty-dracula")
    expect(THEME_NAMES).toContain("ghostty-tokyonight-storm")
  })

  test("formats theme names for display", () => {
    expect(formatThemeName("catppuccin-macchiato")).toBe("Catppuccin Macchiato")
    expect(formatThemeName("ghostty-dracula")).toBe("Dracula")
    expect(formatThemeName("zenburn")).toBe("Zenburn")
  })

  test("finds a theme index with a stable fallback", () => {
    expect(getThemeIndex("paper")).toBe(THEME_NAMES.indexOf("paper"))
    expect(getThemeIndex("ghostty-dracula")).toBe(THEME_NAMES.indexOf("ghostty-dracula"))
    expect(getThemeIndex("catppuccin-macchiato")).toBe(THEME_NAMES.indexOf("catppuccin-macchiato"))
  })
})
