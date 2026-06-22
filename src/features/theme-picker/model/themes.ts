import { getAppTheme, THEME_NAMES, type ThemeName } from "../../../shared/theme"

export { THEME_NAMES }

export function getThemeIndex(theme: ThemeName) {
  return Math.max(0, THEME_NAMES.indexOf(theme))
}

export function formatThemeName(theme: ThemeName) {
  return getAppTheme(theme).label
}
