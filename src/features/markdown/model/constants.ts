import { SyntaxStyle } from "@opentui/core"
import type { AppTheme } from "../../../shared/theme"
import type { GithubAlertType } from "./types"

export function createMarkdownSyntaxStyle(theme: AppTheme) {
  return SyntaxStyle.fromStyles({
    default: { fg: theme.text },
    conceal: { fg: theme.surface2 },
    markup: { fg: theme.subtext0 },
    "markup.heading": { bold: true, fg: theme.mauve },
    "markup.italic": { fg: theme.text, italic: true },
    "markup.link": { fg: theme.blue, underline: true },
    "markup.link.label": { fg: theme.blue, underline: true },
    "markup.link.url": { fg: theme.subtext0 },
    "markup.raw": { bg: theme.surface0, fg: theme.green },
    "markup.strikethrough": { dim: true, fg: theme.subtext0 },
    "markup.strong": { bold: true, fg: theme.lavender },
  })
}

export function createMarkdownTableOptions(theme: AppTheme) {
  return {
    borderColor: theme.surface2,
    borders: true,
    borderStyle: "rounded",
    cellPadding: 1,
    outerBorder: true,
    selectable: true,
    style: "grid",
    widthMode: "full",
    wrapMode: "word",
  } as const
}

export const MARKDOWN_LIST_INDENT_WIDTH = 2

export function getGithubAlert(theme: AppTheme, type: GithubAlertType): { color: string; title: string } {
  return {
    caution: { color: theme.red, title: "Caution" },
    important: { color: theme.mauve, title: "Important" },
    note: { color: theme.blue, title: "Note" },
    tip: { color: theme.green, title: "Tip" },
    warning: { color: theme.yellow, title: "Warning" },
  }[type]
}
