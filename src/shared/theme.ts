import { createContext, useContext } from "react"
import {
  createHunkDiffTheme,
  HUNK_DIFF_THEME_NAMES,
  type HunkDiffThemeInput,
  type HunkDiffThemeName,
} from "hunkdiff/opentui"
import {
  GHOSTTY_THEME_DEFINITIONS,
  GHOSTTY_THEME_NAMES,
  type GhosttyThemeDefinition,
  type GhosttyThemeName,
} from "./ghosttyThemes"

export type { GhosttyThemeName }
export type ThemeName = HunkDiffThemeName | GhosttyThemeName

export const THEME_NAMES = [...HUNK_DIFF_THEME_NAMES, ...GHOSTTY_THEME_NAMES] as ThemeName[]

export type AppTheme = {
  appearance: "dark" | "light"
  base: string
  blue: string
  green: string
  id: ThemeName
  label: string
  lavender: string
  mantle: string
  mauve: string
  red: string
  subtext0: string
  surface0: string
  surface2: string
  text: string
  yellow: string
}

const BUILT_IN_APP_THEMES: Record<HunkDiffThemeName, AppTheme> = {
  graphite: {
    appearance: "dark",
    base: "#111315",
    blue: "#7fd1ff",
    green: "#88d39b",
    id: "graphite",
    label: "Graphite",
    lavender: "#d5e0ea",
    mantle: "#171a1d",
    mauve: "#c49bff",
    red: "#f0a0a0",
    subtext0: "#9aa4af",
    surface0: "#1d2126",
    surface2: "#343c45",
    text: "#f2f4f6",
    yellow: "#e6cf98",
  },
  midnight: {
    appearance: "dark",
    base: "#08111f",
    blue: "#7fd1ff",
    green: "#5ad188",
    id: "midnight",
    label: "Midnight",
    lavender: "#b6c9ff",
    mantle: "#0e1b2e",
    mauve: "#b794f6",
    red: "#ff8b8b",
    subtext0: "#8da5c7",
    surface0: "#13243a",
    surface2: "#284264",
    text: "#eef4ff",
    yellow: "#ffd883",
  },
  paper: {
    appearance: "light",
    base: "#f4efe6",
    blue: "#4a6890",
    green: "#3f8d58",
    id: "paper",
    label: "Paper",
    lavender: "#5a4a8e",
    mantle: "#fffaf3",
    mauve: "#7d5bc4",
    red: "#b4545b",
    subtext0: "#786753",
    surface0: "#f8f1e7",
    surface2: "#d8c8b3",
    text: "#2f2417",
    yellow: "#9f6c1f",
  },
  ember: {
    appearance: "dark",
    base: "#140b08",
    blue: "#ffb07a",
    green: "#83d99d",
    id: "ember",
    label: "Ember",
    lavender: "#d8b4fe",
    mantle: "#22120d",
    mauve: "#e1a3ff",
    red: "#ff9d8f",
    subtext0: "#c7a18d",
    surface0: "#2c1710",
    surface2: "#643627",
    text: "#fff0e6",
    yellow: "#ffd08f",
  },
  "catppuccin-latte": {
    appearance: "light",
    base: "#eff1f5",
    blue: "#1e66f5",
    green: "#40a02b",
    id: "catppuccin-latte",
    label: "Catppuccin Latte",
    lavender: "#7287fd",
    mantle: "#e6e9ef",
    mauve: "#8839ef",
    red: "#d20f39",
    subtext0: "#6c6f85",
    surface0: "#ccd0da",
    surface2: "#acb0be",
    text: "#4c4f69",
    yellow: "#df8e1d",
  },
  "catppuccin-frappe": {
    appearance: "dark",
    base: "#303446",
    blue: "#8caaee",
    green: "#a6d189",
    id: "catppuccin-frappe",
    label: "Catppuccin Frappe",
    lavender: "#babbf1",
    mantle: "#292c3c",
    mauve: "#ca9ee6",
    red: "#e78284",
    subtext0: "#a5adce",
    surface0: "#414559",
    surface2: "#626880",
    text: "#c6d0f5",
    yellow: "#e5c890",
  },
  "catppuccin-macchiato": {
    appearance: "dark",
    base: "#24273a",
    blue: "#8aadf4",
    green: "#a6da95",
    id: "catppuccin-macchiato",
    label: "Catppuccin Macchiato",
    lavender: "#b7bdf8",
    mantle: "#1e2030",
    mauve: "#c6a0f6",
    red: "#ed8796",
    subtext0: "#a5adcb",
    surface0: "#363a4f",
    surface2: "#5b6078",
    text: "#cad3f5",
    yellow: "#eed49f",
  },
  "catppuccin-mocha": {
    appearance: "dark",
    base: "#1e1e2e",
    blue: "#89b4fa",
    green: "#a6e3a1",
    id: "catppuccin-mocha",
    label: "Catppuccin Mocha",
    lavender: "#b4befe",
    mantle: "#181825",
    mauve: "#cba6f7",
    red: "#f38ba8",
    subtext0: "#a6adc8",
    surface0: "#313244",
    surface2: "#585b70",
    text: "#cdd6f4",
    yellow: "#f9e2af",
  },
  zenburn: {
    appearance: "dark",
    base: "#3f3f3f",
    blue: "#8cd0d3",
    green: "#60b48a",
    id: "zenburn",
    label: "Zenburn",
    lavender: "#94bff3",
    mantle: "#3a3a3a",
    mauve: "#dc8cc3",
    red: "#dca3a3",
    subtext0: "#709080",
    surface0: "#313633",
    surface2: "#4d4d4d",
    text: "#dcdccc",
    yellow: "#e0cf9f",
  },
}

type GhosttyResolvedTheme = {
  appTheme: AppTheme
  hunkDiffTheme: HunkDiffThemeInput
}

const GHOSTTY_THEMES = Object.fromEntries(
  GHOSTTY_THEME_DEFINITIONS.map((definition) => {
    const theme = createGhosttyTheme(definition)
    return [theme.appTheme.id, theme]
  }),
) as Record<GhosttyThemeName, GhosttyResolvedTheme>

const GHOSTTY_APP_THEMES = Object.fromEntries(
  Object.values(GHOSTTY_THEMES).map((theme) => [theme.appTheme.id, theme.appTheme]),
) as Record<GhosttyThemeName, AppTheme>

const GHOSTTY_HUNK_DIFF_THEMES = Object.fromEntries(
  Object.values(GHOSTTY_THEMES).map((theme) => [theme.appTheme.id, theme.hunkDiffTheme]),
) as Record<GhosttyThemeName, HunkDiffThemeInput>

export const APP_THEMES: Record<ThemeName, AppTheme> = {
  ...BUILT_IN_APP_THEMES,
  ...GHOSTTY_APP_THEMES,
}

export const MACCHIATO = APP_THEMES["catppuccin-macchiato"]
export const AppThemeContext = createContext<AppTheme>(MACCHIATO)

export function getAppTheme(themeName: ThemeName): AppTheme {
  return APP_THEMES[themeName] ?? MACCHIATO
}

export function getHunkDiffTheme(themeName: ThemeName): HunkDiffThemeInput {
  return GHOSTTY_HUNK_DIFF_THEMES[themeName as GhosttyThemeName] ?? (themeName as HunkDiffThemeName)
}

export function isThemeName(value: string | undefined): value is ThemeName {
  return THEME_NAMES.includes(value as ThemeName)
}

export function useAppTheme() {
  return useContext(AppThemeContext)
}

function createGhosttyTheme(definition: GhosttyThemeDefinition): GhosttyResolvedTheme {
  const [id, label, background, foreground, _selectionBackground, _selectionForeground, palette] = definition
  const themeId = id as GhosttyThemeName
  const appearance = getThemeAppearance(background)
  const red = paletteColor(palette, 9, paletteColor(palette, 1, "#ff6b6b"))
  const green = paletteColor(palette, 10, paletteColor(palette, 2, "#69db7c"))
  const yellow = paletteColor(palette, 11, paletteColor(palette, 3, "#ffd43b"))
  const blue = paletteColor(palette, 12, paletteColor(palette, 4, "#74c0fc"))
  const mauve = paletteColor(palette, 13, paletteColor(palette, 5, "#da77f2"))
  const lavender = paletteColor(palette, 14, blue)
  const mutedSource = paletteColor(palette, 8, foreground)
  const subtext0 = appearance === "light" ? blendHex(foreground, background, 0.65) : mutedSource
  const mantle = appearance === "light" ? blendHex("#ffffff", background, 0.5) : blendHex("#000000", background, 0.18)
  const surface0 = blendHex(mutedSource, background, appearance === "light" ? 0.12 : 0.35)
  const surface2 = blendHex(mutedSource, background, appearance === "light" ? 0.25 : 0.55)
  const accent = blue

  const appTheme: AppTheme = {
    appearance,
    base: background,
    blue,
    green,
    id: themeId,
    label,
    lavender,
    mantle,
    mauve,
    red,
    subtext0,
    surface0,
    surface2,
    text: foreground,
    yellow,
  }

  return {
    appTheme,
    hunkDiffTheme: createHunkDiffTheme({
      id: themeId,
      label,
      appearance,
      base: appearance === "light" ? "paper" : "graphite",
      background,
      panel: mantle,
      panelAlt: surface0,
      border: surface2,
      accent,
      accentMuted: blendHex(accent, mantle, 0.26),
      text: foreground,
      muted: subtext0,
      addedBg: blendHex(green, background, 0.14),
      removedBg: blendHex(red, background, 0.16),
      movedAddedBg: blendHex(blue, background, 0.16),
      movedRemovedBg: blendHex(mauve, background, 0.16),
      contextBg: background,
      addedContentBg: blendHex(green, background, 0.23),
      removedContentBg: blendHex(red, background, 0.24),
      contextContentBg: background,
      addedSignColor: green,
      removedSignColor: red,
      lineNumberBg: mantle,
      lineNumberFg: subtext0,
      selectedHunk: surface0,
      badgeAdded: green,
      badgeRemoved: red,
      badgeNeutral: subtext0,
      fileNew: green,
      fileDeleted: red,
      fileRenamed: yellow,
      fileModified: mauve,
      fileUntracked: blue,
      noteBorder: mauve,
      noteBackground: blendHex(mauve, mantle, 0.12),
      noteTitleBackground: blendHex(mauve, mantle, 0.22),
      noteTitleText: foreground,
      syntax: {
        default: foreground,
        keyword: mauve,
        string: green,
        comment: subtext0,
        number: yellow,
        function: blue,
        property: blue,
        type: yellow,
        punctuation: subtext0,
      },
    }),
  }
}

function paletteColor(palette: readonly string[], index: number, fallback: string) {
  return palette[index] ?? fallback
}

function getThemeAppearance(background: string): "dark" | "light" {
  return getLuminance(background) > 0.55 ? "light" : "dark"
}

function blendHex(foreground: string, background: string, ratio: number) {
  const front = hexToRgb(foreground)
  const back = hexToRgb(background)
  const mix = (frontChannel: number, backChannel: number) =>
    Math.max(0, Math.min(255, Math.round(backChannel + (frontChannel - backChannel) * ratio)))

  return rgbToHex(mix(front.r, back.r), mix(front.g, back.g), mix(front.b, back.b))
}

function getLuminance(color: string) {
  const { r, g, b } = hexToRgb(color)
  const normalize = (channel: number) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }

  return 0.2126 * normalize(r) + 0.7152 * normalize(g) + 0.0722 * normalize(b)
}

function hexToRgb(color: string) {
  const normalized = color.replace("#", "")
  const value = Number.parseInt(normalized, 16)

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`
}
