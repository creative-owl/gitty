import { HUNK_DIFF_THEME_NAMES, type HunkDiffThemeName } from "hunkdiff/opentui"

export const THEME_NAMES = [...HUNK_DIFF_THEME_NAMES]

export function getThemeIndex(theme: HunkDiffThemeName) {
  return Math.max(0, THEME_NAMES.indexOf(theme))
}

export function formatThemeName(theme: HunkDiffThemeName) {
  return theme
    .split("-")
    .map((part) => (part ? `${part[0]?.toUpperCase()}${part.slice(1)}` : part))
    .join(" ")
}
