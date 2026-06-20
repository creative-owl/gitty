import { useEffect, useState } from "react"
import { fitText } from "../../../shared/lib/text"
import { useAppTheme } from "../../../shared/theme"
import { getGithubAlert } from "../model/constants"
import type { MarkdownRenderBlock } from "../model/types"
import { MarkdownContent } from "./MarkdownContent"

export function GithubAlertMarkdownBlock({
  block,
  blockKeyPrefix,
  width,
}: {
  block: Extract<MarkdownRenderBlock, { kind: "github-alert" }>
  blockKeyPrefix: string
  width: number
}) {
  const theme = useAppTheme()
  const alert = getGithubAlert(theme, block.alertType)
  const contentWidth = Math.max(1, width - 4)

  return (
    <box
      title={alert.title}
      style={{
        width: "100%",
        border: true,
        borderStyle: "rounded",
        borderColor: alert.color,
        backgroundColor: theme.surface0,
        flexDirection: "column",
        marginBottom: 1,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <MarkdownContent
        backgroundColor={theme.surface0}
        blockKeyPrefix={`${blockKeyPrefix}:body`}
        emptyText="No alert content."
        markdown={block.content}
        width={contentWidth}
      />
    </box>
  )
}

export function QuoteMarkdownBlock({
  block,
  blockKeyPrefix,
  width,
}: {
  block: Extract<MarkdownRenderBlock, { kind: "quote" }>
  blockKeyPrefix: string
  width: number
}) {
  const theme = useAppTheme()
  const contentWidth = Math.max(1, width - 4)

  return (
    <box
      title="Quote"
      style={{
        width: "100%",
        border: true,
        borderStyle: "rounded",
        borderColor: theme.surface2,
        backgroundColor: theme.surface0,
        flexDirection: "column",
        marginBottom: 1,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <MarkdownContent
        backgroundColor={theme.surface0}
        blockKeyPrefix={`${blockKeyPrefix}:body`}
        emptyText="No quote content."
        markdown={block.content}
        width={contentWidth}
      />
    </box>
  )
}

export function DetailsMarkdownBlock({
  block,
  blockKeyPrefix,
  width,
}: {
  block: Extract<MarkdownRenderBlock, { kind: "details" }>
  blockKeyPrefix: string
  width: number
}) {
  const theme = useAppTheme()
  const contentWidth = Math.max(1, width - 4)
  const [isOpen, setOpen] = useState(block.open)

  useEffect(() => {
    setOpen(block.open)
  }, [block.body, block.open, block.summary])

  return (
    <box
      title="Details"
      style={{
        width: "100%",
        border: true,
        borderStyle: "rounded",
        borderColor: theme.surface2,
        backgroundColor: theme.surface0,
        flexDirection: "column",
        marginBottom: 1,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <box
        style={{ width: "100%", height: 1, backgroundColor: theme.surface0 }}
        onMouseUp={() => setOpen((current) => !current)}
      >
        <text fg={theme.mauve}>{fitText(`${isOpen ? "v" : ">"} ${block.summary}`, contentWidth)}</text>
      </box>
      {isOpen ? (
        <MarkdownContent
          backgroundColor={theme.surface0}
          blockKeyPrefix={`${blockKeyPrefix}:body`}
          emptyText="No details."
          markdown={block.body}
          width={contentWidth}
        />
      ) : null}
    </box>
  )
}
