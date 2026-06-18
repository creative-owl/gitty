import { SyntaxStyle } from "@opentui/core"
import { MACCHIATO } from "../../../shared/theme"
import type { GithubAlertType } from "./types"

export const MARKDOWN_SYNTAX_STYLE = SyntaxStyle.fromStyles({
  default: { fg: MACCHIATO.text },
  conceal: { fg: MACCHIATO.surface2 },
  markup: { fg: MACCHIATO.subtext0 },
  "markup.heading": { bold: true, fg: MACCHIATO.mauve },
  "markup.italic": { fg: MACCHIATO.text, italic: true },
  "markup.link": { fg: MACCHIATO.blue, underline: true },
  "markup.link.label": { fg: MACCHIATO.blue, underline: true },
  "markup.link.url": { fg: MACCHIATO.subtext0 },
  "markup.raw": { bg: MACCHIATO.surface0, fg: MACCHIATO.green },
  "markup.strikethrough": { dim: true, fg: MACCHIATO.subtext0 },
  "markup.strong": { bold: true, fg: MACCHIATO.lavender },
})

export const MARKDOWN_TABLE_OPTIONS = {
  borderColor: MACCHIATO.surface2,
  borders: true,
  borderStyle: "rounded",
  cellPadding: 1,
  outerBorder: true,
  selectable: true,
  style: "grid",
  widthMode: "full",
  wrapMode: "word",
} as const

export const MARKDOWN_LIST_INDENT_WIDTH = 2

export const GITHUB_ALERTS: Record<GithubAlertType, { color: string; title: string }> = {
  caution: { color: MACCHIATO.red, title: "Caution" },
  important: { color: MACCHIATO.mauve, title: "Important" },
  note: { color: MACCHIATO.blue, title: "Note" },
  tip: { color: MACCHIATO.green, title: "Tip" },
  warning: { color: MACCHIATO.yellow, title: "Warning" },
}
