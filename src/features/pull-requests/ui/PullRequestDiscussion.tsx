import type { MouseEvent } from "@opentui/core"
import { MarkdownContent } from "../../markdown/ui/MarkdownContent"
import { fitText, wrapText } from "../../../shared/lib/text"
import { MACCHIATO } from "../../../shared/theme"
import { formatTimelineTimestamp } from "../model/format"
import type {
  PullRequestDetail,
  PullRequestReviewComment,
  PullRequestReviewThread,
  PullRequestTimelineItem,
} from "../model/types"

export function PullRequestTitleBlock({
  detail,
  onOpenUrl,
  width,
}: {
  detail: PullRequestDetail
  onOpenUrl: (url: string) => void
  width: number
}) {
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
        backgroundColor: MACCHIATO.mantle,
        flexDirection: "column",
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      {titleRows.map((row, index) => (
        <box key={`pull-request-title-row:${index}`} style={{ width: "100%", height: 1 }}>
          <text fg={MACCHIATO.lavender}>{fitText(row, contentWidth)}</text>
        </box>
      ))}
      {url ? (
        <box style={{ width: "100%", height: 1, backgroundColor: MACCHIATO.surface0 }} onMouseUp={openUrl}>
          <text fg={MACCHIATO.blue}>{fitText(url, contentWidth)}</text>
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
  const contentWidth = Math.max(1, width - 4)

  return (
    <box
      title="Description"
      style={{
        width: "100%",
        border: true,
        borderStyle: "rounded",
        borderColor: MACCHIATO.surface2,
        backgroundColor: MACCHIATO.base,
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

export function CommentChain({
  comments,
  width,
}: {
  comments: PullRequestTimelineItem[]
  width: number
}) {
  const commentBlockWidth = Math.max(1, Math.floor(width * 0.9))
  const leftGutterWidth = Math.max(0, width - commentBlockWidth)

  return (
    <box style={{ width: "100%", flexDirection: "column" }}>
      <box style={{ width: "100%", height: 1 }} />
      <box style={{ width: "100%", height: 1 }}>
        <text fg={MACCHIATO.mauve}>{fitText("Comment chain", width)}</text>
      </box>
      {comments.length === 0 ? (
        <box style={{ width: "100%", height: 1 }}>
          <text fg={MACCHIATO.subtext0}>{fitText("No comments yet.", width)}</text>
        </box>
      ) : (
        comments.map((comment, index) => (
          <box
            key={`pull-request-comment-row:${index}`}
            style={{ width: "100%", flexDirection: "row", marginBottom: 1 }}
          >
            {leftGutterWidth > 0 ? <box style={{ width: leftGutterWidth }} /> : null}
            <CommentBlock comment={comment} width={commentBlockWidth} />
          </box>
        ))
      )}
    </box>
  )
}

function CommentBlock({
  comment,
  width,
}: {
  comment: PullRequestTimelineItem
  width: number
}) {
  const contentWidth = Math.max(1, width - 4)

  return (
    <box
      style={{
        width,
        border: true,
        borderStyle: "rounded",
        borderColor: MACCHIATO.surface2,
        backgroundColor: MACCHIATO.base,
        flexDirection: "column",
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <box style={{ width: "100%", height: 1 }}>
        <text fg={MACCHIATO.lavender}>{fitText(formatCommentHeading(comment), contentWidth)}</text>
      </box>
      <MarkdownContent
        blockKeyPrefix={`pull-request-comment:${comment.author}:${comment.createdAt}`}
        emptyText="No content."
        markdown={comment.body}
        width={contentWidth}
      />
      {comment.reviewThreads?.length ? (
        <ReviewThreadList
          blockKeyPrefix={`pull-request-review-thread:${comment.author}:${comment.createdAt}`}
          threads={comment.reviewThreads}
          width={contentWidth}
        />
      ) : null}
    </box>
  )
}

function ReviewThreadList({
  blockKeyPrefix,
  threads,
  width,
}: {
  blockKeyPrefix: string
  threads: PullRequestReviewThread[]
  width: number
}) {
  return (
    <box style={{ width: "100%", flexDirection: "column" }}>
      {threads.map((thread) => (
        <ReviewThreadBlock
          blockKeyPrefix={`${blockKeyPrefix}:${thread.id}`}
          key={`${blockKeyPrefix}:${thread.id}`}
          thread={thread}
          width={width}
        />
      ))}
    </box>
  )
}

function ReviewThreadBlock({
  blockKeyPrefix,
  thread,
  width,
}: {
  blockKeyPrefix: string
  thread: PullRequestReviewThread
  width: number
}) {
  const contentWidth = Math.max(1, width - 4)
  const replyWidth = Math.max(1, width - 2)
  const location = formatReviewCommentLocation(thread)

  return (
    <box style={{ width: "100%", flexDirection: "column", marginTop: 1 }}>
      <box
        style={{
          width: "100%",
          border: true,
          borderStyle: "rounded",
          borderColor: MACCHIATO.surface2,
          backgroundColor: MACCHIATO.base,
          flexDirection: "column",
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <box style={{ width: "100%", height: 1 }}>
          <text fg={MACCHIATO.lavender}>
            {fitText(`${thread.author}${location ? ` - ${location}` : ""}`, contentWidth)}
          </text>
        </box>
        <MarkdownContent
          blockKeyPrefix={blockKeyPrefix}
          emptyText="No content."
          markdown={thread.body}
          width={contentWidth}
        />
      </box>
      {thread.replies.map((reply) => (
        <box
          key={`${blockKeyPrefix}:reply:${reply.id}`}
          style={{ width: "100%", flexDirection: "row", marginTop: 1 }}
        >
          <box style={{ width: 2 }} />
          <ReviewReplyBlock
            blockKeyPrefix={`${blockKeyPrefix}:reply:${reply.id}`}
            reply={reply}
            width={replyWidth}
          />
        </box>
      ))}
    </box>
  )
}

function ReviewReplyBlock({
  blockKeyPrefix,
  reply,
  width,
}: {
  blockKeyPrefix: string
  reply: PullRequestReviewComment
  width: number
}) {
  const contentWidth = Math.max(1, width - 4)

  return (
    <box
      style={{
        width,
        border: true,
        borderStyle: "rounded",
        borderColor: MACCHIATO.surface2,
        backgroundColor: MACCHIATO.base,
        flexDirection: "column",
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <box style={{ width: "100%", height: 1 }}>
        <text fg={MACCHIATO.lavender}>{fitText(reply.author, contentWidth)}</text>
      </box>
      <MarkdownContent
        blockKeyPrefix={blockKeyPrefix}
        emptyText="No content."
        markdown={reply.body}
        width={contentWidth}
      />
    </box>
  )
}

function formatReviewCommentLocation(comment: PullRequestReviewComment) {
  if (!comment.path) {
    return ""
  }
  return comment.line ? `${comment.path}:${comment.line}` : comment.path
}

function formatCommentHeading(comment: PullRequestTimelineItem) {
  const state = comment.kind === "review" && comment.state ? ` (${comment.state})` : ""
  const timestamp = formatTimelineTimestamp(comment.createdAt)
  const suffix = timestamp ? ` - ${timestamp}` : ""
  const action = comment.kind === "review" ? `reviewed${state}` : "commented"
  return `${comment.author} ${action}${suffix}`
}
