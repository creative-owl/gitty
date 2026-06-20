import type { MouseEvent } from "@opentui/core"
import { MarkdownContent } from "../../markdown/ui/MarkdownContent"
import { fitText, wrapText } from "../../../shared/lib/text"
import { useAppTheme } from "../../../shared/theme"
import type { PullRequestDetail } from "../model/types"

export function PullRequestTitleBlock({
  detail,
  onOpenUrl,
  width,
}: {
  detail: PullRequestDetail
  onOpenUrl: (url: string) => void
  width: number
}) {
  const theme = useAppTheme()
  const contentWidth = Math.max(1, width - 4)
  const titleRows = wrapText(detail.title, contentWidth)
  const url = detail.url.trim()
  const height = Math.max(2, titleRows.length + (url ? 1 : 0))
  const openUrl = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    onOpenUrl(url)
  }

  return (
    <box
      style={{
        width: "100%",
        height,
        backgroundColor: theme.mantle,
        flexDirection: "column",
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      {titleRows.map((row, index) => (
        <box key={`pull-request-title-row:${index}`} style={{ width: "100%", height: 1 }}>
          <text fg={theme.lavender}>{fitText(row, contentWidth)}</text>
        </box>
      ))}
      {url ? (
        <box style={{ width: "100%", height: 1, backgroundColor: theme.surface0 }} onMouseUp={openUrl}>
          <text fg={theme.blue}>{fitText(url, contentWidth)}</text>
        </box>
      ) : null}
    </box>
  )
}

export function DescriptionMarkdownBlock({
  markdown,
  width,
}: {
  markdown: string
  width: number
}) {
  const theme = useAppTheme()
  const contentWidth = Math.max(1, width - 4)

  return (
    <box
      title="Description"
      style={{
        width: "100%",
        border: true,
        borderStyle: "rounded",
        borderColor: theme.surface2,
        backgroundColor: theme.base,
        flexDirection: "column",
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <MarkdownContent
        blockKeyPrefix="pull-request-description"
        emptyText="No description."
        markdown={markdown}
        width={contentWidth}
      />
    </box>
  )
}
