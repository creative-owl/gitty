import { createContext, useContext } from "react"
import type { HunkDiffThemeName } from "hunkdiff/opentui"

export type AppTheme = {
  appearance: "dark" | "light"
  base: string
  blue: string
  green: string
  id: HunkDiffThemeName
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

export const APP_THEMES: Record<HunkDiffThemeName, AppTheme> = {
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

export const MACCHIATO = APP_THEMES["catppuccin-macchiato"]
export const AppThemeContext = createContext<AppTheme>(MACCHIATO)

export function getAppTheme(themeName: HunkDiffThemeName): AppTheme {
  return APP_THEMES[themeName] ?? MACCHIATO
}

export function useAppTheme() {
  return useContext(AppThemeContext)
}
