import { useMemo } from "react"
import { MACCHIATO } from "../../../shared/theme"
import { MARKDOWN_SYNTAX_STYLE, MARKDOWN_TABLE_OPTIONS } from "../model/constants"
import { createMarkdownBlocks } from "../model/parse"
import type { MarkdownRenderBlock } from "../model/types"
import { GithubAlertMarkdownBlock, DetailsMarkdownBlock, QuoteMarkdownBlock } from "./MarkdownBlocks"
import { MarkdownListBlockView } from "./MarkdownList"
import { MermaidDiagram } from "./MermaidDiagram"

export function MarkdownContent({
  backgroundColor = MACCHIATO.base,
  blockKeyPrefix,
  emptyText,
  markdown,
  width,
}: {
  backgroundColor?: string
  blockKeyPrefix: string
  emptyText: string
  markdown: string
  width: number
}) {
  const blocks = useMemo(() => createMarkdownBlocks(markdown, emptyText), [emptyText, markdown])

  return (
    <box style={{ width: "100%", flexDirection: "column", backgroundColor }}>
      {blocks.map((block, index) => {
        const key = `${blockKeyPrefix}:${index}`
        if (block.kind === "details") {
          return <DetailsMarkdownBlock block={block} blockKeyPrefix={key} key={key} width={width} />
        }

        if (block.kind === "github-alert") {
          return <GithubAlertMarkdownBlock block={block} blockKeyPrefix={key} key={key} width={width} />
        }

        if (block.kind === "mermaid") {
          return <MermaidDiagram content={block.content} key={key} width={width} />
        }

        if (block.kind === "list") {
          return (
            <MarkdownListBlockView
              backgroundColor={backgroundColor}
              block={block}
              blockKeyPrefix={key}
              key={key}
              width={width}
            />
          )
        }

        if (block.kind === "quote") {
          return <QuoteMarkdownBlock block={block} blockKeyPrefix={key} key={key} width={width} />
        }

        return (
          <markdown
            bg={backgroundColor}
            conceal
            content={block.content}
            fg={MACCHIATO.text}
            internalBlockMode="top-level"
            key={key}
            syntaxStyle={MARKDOWN_SYNTAX_STYLE}
            tableOptions={MARKDOWN_TABLE_OPTIONS}
            style={{
              width: "100%",
              flexShrink: 0,
              marginBottom: index === blocks.length - 1 ? 0 : 1,
            }}
          />
        )
      })}
    </box>
  )
}
