import { describe, expect, test } from "bun:test"
import { getAppTheme, getHunkDiffTheme, isThemeName, THEME_NAMES } from "./theme"

describe("theme catalog", () => {
  test("resolves built-in and Ghostty theme ids", () => {
    expect(isThemeName("paper")).toBe(true)
    expect(isThemeName("ghostty-dracula")).toBe(true)
    expect(THEME_NAMES).toContain("ghostty-tokyonight-storm")
  })

  test("returns custom Hunk themes for Ghostty themes", () => {
    expect(getHunkDiffTheme("paper")).toBe("paper")
    expect(getHunkDiffTheme("ghostty-dracula")).toMatchObject({
      appearance: "dark",
      id: "ghostty-dracula",
      label: "Dracula",
      text: "#f8f8f2",
    })
    expect(getAppTheme("ghostty-dracula")).toMatchObject({
      base: "#282a36",
      label: "Dracula",
      text: "#f8f8f2",
    })
  })
})
