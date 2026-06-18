import type { TextRow } from "../../../shared/lib/text"

export type GithubAlertType = "caution" | "important" | "note" | "tip" | "warning"

export type MarkdownRenderBlock =
  | {
      content: string
      kind: "markdown"
    }
  | MarkdownListBlock
  | {
      body: string
      kind: "details"
      open: boolean
      summary: string
    }
  | {
      content: string
      kind: "mermaid"
    }
  | {
      alertType: GithubAlertType
      content: string
      kind: "github-alert"
    }
  | {
      content: string
      kind: "quote"
    }

export type MarkdownListBlock = {
  items: MarkdownListItem[]
  kind: "list"
  ordered: boolean
  start: number
}

export type MarkdownListItem = {
  checked?: boolean
  children: MarkdownListBlock[]
  content: string
  task: boolean
}

export type TerminalImageRun = {
  backgroundColor: string
  color: string
  text: string
}

export type TerminalImageRow = {
  runs: TerminalImageRun[]
}

export type DetailsBlock = {
  body: string
  open: boolean
  summary: string
}

export type DetailsTag = {
  end: number
  index: number
  kind: "close" | "open"
}

export type MarkdownDetailsSegment =
  | {
      content: string
      kind: "details"
    }
  | {
      content: string
      kind: "text"
    }

export type MermaidRenderState =
  | {
      status: "loading"
    }
  | {
      rows: TerminalImageRow[]
      status: "rendered"
    }
  | {
      message: string
      sourceRows: TextRow[]
      status: "error"
    }

export type SvgBox = {
  bottom: number
  height: number
  left: number
  right: number
  top: number
  width: number
  x: number
  y: number
}

export type RgbColor = {
  b: number
  g: number
  r: number
}

export type MermaidDomWindow = Window & {
  CSSStyleSheet: typeof CSSStyleSheet
  Element: typeof Element
  HTMLElement: typeof HTMLElement
  SVGElement: typeof SVGElement
  document: Document
  navigator: Navigator
}
