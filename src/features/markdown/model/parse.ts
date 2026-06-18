import { Lexer, type Token, type Tokens } from "marked"
import type {
  DetailsBlock,
  DetailsTag,
  GithubAlertType,
  MarkdownDetailsSegment,
  MarkdownListBlock,
  MarkdownListItem,
  MarkdownRenderBlock,
} from "./types"

function stripHtmlComments(value: string) {
  return value.replace(/<!--[\s\S]*?-->/g, "")
}

export function createMarkdownBlocks(markdown: string, emptyText = "No description."): MarkdownRenderBlock[] {
  const source = normalizeGithubMarkdown(stripHtmlComments(markdown)).replace(/\r\n/g, "\n")
  if (!source.trim()) {
    return [{ content: emptyText, kind: "markdown" }]
  }

  const blocks: MarkdownRenderBlock[] = []
  for (const segment of splitMarkdownDetailsBlocks(source)) {
    if (segment.kind === "text") {
      pushMarkdownAndMermaidBlocks(blocks, segment.content)
      continue
    }

    blocks.push({
      kind: "details",
      ...parseDetailsBlock(segment.content),
    })
  }

  return blocks.length > 0 ? blocks : [{ content: emptyText, kind: "markdown" }]
}

function splitMarkdownDetailsBlocks(source: string): MarkdownDetailsSegment[] {
  const tags = collectMarkdownDetailsTags(source)
  const segments: MarkdownDetailsSegment[] = []
  let cursor = 0
  let tagIndex = 0

  while (tagIndex < tags.length) {
    const openTagIndex = tags.findIndex((tag, index) => index >= tagIndex && tag.index >= cursor && tag.kind === "open")
    if (openTagIndex === -1) {
      break
    }

    const openTag = tags[openTagIndex]!
    let closeTag: DetailsTag | undefined
    let depth = 0

    for (let index = openTagIndex; index < tags.length; index += 1) {
      const tag = tags[index]!
      if (tag.kind === "open") {
        depth += 1
      } else {
        depth -= 1
      }

      if (depth === 0) {
        closeTag = tag
        tagIndex = index + 1
        break
      }
    }

    if (!closeTag) {
      break
    }

    if (openTag.index > cursor) {
      segments.push({ content: source.slice(cursor, openTag.index), kind: "text" })
    }
    segments.push({ content: source.slice(openTag.index, closeTag.end), kind: "details" })
    cursor = closeTag.end
  }

  if (cursor < source.length) {
    segments.push({ content: source.slice(cursor), kind: "text" })
  }

  return segments.length > 0 ? segments : [{ content: source, kind: "text" }]
}

function collectMarkdownDetailsTags(source: string): DetailsTag[] {
  const tags: DetailsTag[] = []
  let offset = 0
  let fence: { character: "`" | "~"; length: number } | undefined

  for (const line of source.split("\n")) {
    const fenceMatch = /^(?: {0,3})(`{3,}|~{3,})/.exec(line)
    if (fenceMatch) {
      const marker = fenceMatch[1] ?? ""
      const character = marker[0] as "`" | "~"
      if (!fence) {
        fence = { character, length: marker.length }
      } else if (fence.character === character && marker.length >= fence.length) {
        fence = undefined
      }

      offset += line.length + 1
      continue
    }

    if (!fence) {
      const detailsMatch = /^[ \t]{0,3}(<\/?details\b[^>]*>)/i.exec(line)
      if (detailsMatch) {
        const raw = detailsMatch[1] ?? ""
        const index = offset + detailsMatch[0].length - raw.length
        tags.push({
          end: index + raw.length,
          index,
          kind: /^<\//.test(raw) ? "close" : "open",
        })
      }
    }

    offset += line.length + 1
  }

  return tags
}

function pushMarkdownAndMermaidBlocks(blocks: MarkdownRenderBlock[], source: string) {
  if (!source.trim()) {
    return
  }

  const tokens = Lexer.lex(source, { gfm: true })
  let markdown = ""

  for (const token of tokens) {
    if (isMermaidCodeToken(token)) {
      pushMarkdownBlock(blocks, markdown)
      markdown = ""
      blocks.push({ content: token.text, kind: "mermaid" })
      continue
    }

    if (isBlockquoteToken(token)) {
      pushMarkdownBlock(blocks, markdown)
      markdown = ""
      blocks.push(createBlockquoteMarkdownBlock(token.text))
      continue
    }

    if (isListToken(token)) {
      pushMarkdownBlock(blocks, markdown)
      markdown = ""
      blocks.push(createMarkdownListBlock(token))
      continue
    }

    markdown += token.raw
  }

  pushMarkdownBlock(blocks, markdown)
}

function pushMarkdownBlock(blocks: MarkdownRenderBlock[], content: string) {
  if (content.trim()) {
    blocks.push({ content, kind: "markdown" })
  }
}

function isMermaidCodeToken(token: Token): token is Token & { lang?: string; text: string; type: "code" } {
  return token.type === "code" && token.lang?.trim().toLowerCase().split(/\s+/)[0] === "mermaid"
}

function isBlockquoteToken(token: Token): token is Token & { text: string; type: "blockquote" } {
  return token.type === "blockquote" && typeof token.text === "string"
}

function isListToken(token: Token): token is Tokens.List {
  return token.type === "list" && Array.isArray((token as Tokens.List).items)
}

function createMarkdownListBlock(token: Tokens.List): MarkdownListBlock {
  return {
    items: token.items.map(createMarkdownListItem),
    kind: "list",
    ordered: token.ordered,
    start: typeof token.start === "number" ? token.start : 1,
  }
}

function createMarkdownListItem(item: Tokens.ListItem): MarkdownListItem {
  const contentTokens = item.tokens.filter((token) => token.type !== "checkbox" && token.type !== "list" && token.type !== "space")
  const content = contentTokens.map((token) => token.raw).join("").trim()

  return {
    checked: item.checked,
    children: item.tokens.filter(isListToken).map(createMarkdownListBlock),
    content: content || createMarkdownListItemFallbackContent(item.text),
    task: item.task,
  }
}

function createMarkdownListItemFallbackContent(text: string) {
  return text
    .replace(/(?:^|\n)\s*(?:[-+*]|\d+[.)])\s+/g, "\n")
    .trim()
}

function createBlockquoteMarkdownBlock(text: string): MarkdownRenderBlock {
  const lines = text.replace(/\r\n/g, "\n").trim().split("\n")
  const alertMatch = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i.exec(lines[0] ?? "")

  if (alertMatch) {
    return {
      alertType: alertMatch[1]?.toLowerCase() as GithubAlertType,
      content: lines.slice(1).join("\n").trim(),
      kind: "github-alert",
    }
  }

  return {
    content: text.trim(),
    kind: "quote",
  }
}

function normalizeGithubMarkdown(value: string) {
  const protectedBlocks: string[] = []
  const protectedValue = value.replace(
    /(^|\n)([ \t]{0,3})(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\2\3[ \t]*(?=\n|$)/g,
    (match) => {
      const placeholder = `\u0000GITTY_MARKDOWN_BLOCK_${protectedBlocks.length}\u0000`
      protectedBlocks.push(match)
      return placeholder
    },
  )

  const normalized = normalizeGithubInlineHtml(protectedValue)
  return protectedBlocks.reduce(
    (current, block, index) => current.replace(`\u0000GITTY_MARKDOWN_BLOCK_${index}\u0000`, block),
    normalized,
  )
}

function normalizeGithubInlineHtml(value: string) {
  return value
    .replace(/<sub\b[^>]*>([\s\S]*?)<\/sub>/gi, (_match, content: string) => normalizeHtmlInlineText(content))
    .replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (match: string, attributes: string, content: string) => {
      const href = readHtmlAttribute(attributes, "href")
      if (!href) {
        return normalizeHtmlInlineText(content)
      }

      const label = normalizeHtmlInlineText(content) || href
      return `[${escapeMarkdownLinkLabel(label)}](<${escapeMarkdownLinkHref(href)}>)`
    })
}

function readHtmlAttribute(attributes: string, name: string) {
  const pattern = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i")
  const match = pattern.exec(attributes)
  return decodeHtmlEntities((match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim())
}

function escapeMarkdownLinkLabel(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\]/g, "\\]")
}

function escapeMarkdownLinkHref(value: string) {
  return value.trim().replace(/>/g, "%3E")
}

function parseDetailsBlock(value: string): DetailsBlock {
  const summaryMatch = /<summary\b[^>]*>([\s\S]*?)<\/summary>/i.exec(value)
  const open = /^<details\b[^>]*\bopen(?:\s|=|>)/i.test(value.trim())
  const body = value
    .replace(/^[ \t]{0,3}<details\b[^>]*>/i, "")
    .replace(/[ \t]*<\/details>\s*$/i, "")
    .replace(/<summary\b[^>]*>[\s\S]*?<\/summary>/i, "")
    .trim()

  return {
    body,
    open,
    summary: normalizeHtmlInlineText(normalizeGithubInlineHtml(summaryMatch?.[1] ?? "Details")),
  }
}

function normalizeHtmlInlineText(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  )
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
}
