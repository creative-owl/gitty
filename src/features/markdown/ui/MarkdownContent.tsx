import { useMemo } from "react"
import { useAppTheme } from "../../../shared/theme"
import { createMarkdownSyntaxStyle, createMarkdownTableOptions } from "../model/constants"
import { createMarkdownBlocks } from "../model/parse"
import { GithubAlertMarkdownBlock, DetailsMarkdownBlock, QuoteMarkdownBlock } from "./MarkdownBlocks"
import { MarkdownListBlockView } from "./MarkdownList"
import { MermaidDiagram } from "./MermaidDiagram"

export function MarkdownContent({
  backgroundColor,
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
  const theme = useAppTheme()
  const resolvedBackgroundColor = backgroundColor ?? theme.base
  const blocks = useMemo(() => createMarkdownBlocks(markdown, emptyText), [emptyText, markdown])
  const syntaxStyle = useMemo(() => createMarkdownSyntaxStyle(theme), [theme])
  const tableOptions = useMemo(() => createMarkdownTableOptions(theme), [theme])

  return (
    <box style={{ width: "100%", flexDirection: "column", backgroundColor: resolvedBackgroundColor }}>
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
              backgroundColor={resolvedBackgroundColor}
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
            bg={resolvedBackgroundColor}
            conceal
            content={block.content}
            fg={theme.text}
            internalBlockMode="top-level"
            key={key}
            syntaxStyle={syntaxStyle}
            tableOptions={tableOptions}
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
