import { pluralize, pushWrappedRows, type TextRow } from "../../../shared/lib/text"
import { type AppTheme, useAppTheme } from "../../../shared/theme"
import { TextRows } from "../../../shared/ui/TextRows"
import { formatCheckStateLabel } from "../model/format"
import { normalizeGitHubState } from "../model/parse"
import { getPullRequestCheckStateColor } from "../model/sidebar"
import type { PullRequestDetail, PullRequestSummary } from "../model/types"

export function PullRequestMetadataSidebar({
  detail,
  summary,
  width,
}: {
  detail?: PullRequestDetail
  summary?: PullRequestSummary
  width: number
}) {
  const theme = useAppTheme()
  const contentWidth = Math.max(1, width - 4)
  const rows = detail
    ? createPullRequestMetadataRows(detail, contentWidth, theme)
    : [
        {
          color: theme.lavender,
          text: "Status",
        },
        {
          color: summary ? getPullRequestCheckStateColor(summary.checkState, theme) : theme.subtext0,
          text: summary ? formatCheckStateLabel(summary.checkState) : "Loading...",
        },
      ]

  return (
    <box
      title="PR Info"
      style={{
        width,
        height: "100%",
        border: true,
        borderStyle: "rounded",
        borderColor: theme.surface2,
        backgroundColor: theme.mantle,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <scrollbox style={{ width: "100%", height: "100%" }} scrollY>
        <TextRows rowKeyPrefix="pull-request-metadata-row" rows={rows} width={contentWidth} />
      </scrollbox>
    </box>
  )
}

function createPullRequestMetadataRows(detail: PullRequestDetail, width: number, theme: AppTheme): TextRow[] {
  const rows: TextRow[] = [
    { color: theme.lavender, text: "Status" },
    {
      color: getPullRequestCheckStateColor(detail.checkState, theme),
      text: formatCheckStateLabel(detail.checkState),
    },
  ]

  if (detail.reviewDecision) {
    rows.push({
      color: detail.reviewDecision === "Changes Requested" ? theme.red : theme.subtext0,
      text: detail.reviewDecision,
    })
  }

  rows.push({ color: theme.subtext0, text: "" })
  rows.push({ color: theme.lavender, text: "Unresolved comments" })
  rows.push({
    color: getUnresolvedReviewThreadCountColor(detail.unresolvedReviewThreadCount, theme),
    text: formatUnresolvedReviewThreadCount(detail.unresolvedReviewThreadCount),
  })

  rows.push({ color: theme.subtext0, text: "" })
  rows.push({ color: theme.lavender, text: "Reviewers" })
  if (detail.reviewers.length === 0) {
    rows.push({ color: theme.subtext0, text: "None" })
  } else {
    for (const reviewer of detail.reviewers) {
      pushWrappedRows(rows, `${reviewer.login} ${reviewer.state}`, width, getReviewerStateColor(reviewer.state, theme))
    }
  }

  rows.push({ color: theme.subtext0, text: "" })
  rows.push({ color: theme.lavender, text: "Assignees" })
  if (detail.assignees.length === 0) {
    rows.push({ color: theme.subtext0, text: "None" })
  } else {
    for (const assignee of detail.assignees) {
      pushWrappedRows(rows, assignee, width, theme.text)
    }
  }

  rows.push({ color: theme.subtext0, text: "" })
  rows.push({ color: theme.lavender, text: "Labels" })
  if (detail.labels.length === 0) {
    rows.push({ color: theme.subtext0, text: "None" })
  } else {
    for (const label of detail.labels) {
      pushWrappedRows(rows, label.name, width, label.color ?? theme.text)
    }
  }

  return rows
}

function formatUnresolvedReviewThreadCount(count: number | undefined) {
  return count === undefined ? "Unavailable" : pluralize(count, "comment")
}

function getUnresolvedReviewThreadCountColor(count: number | undefined, theme: AppTheme) {
  if (count === undefined) {
    return theme.subtext0
  }
  return count > 0 ? theme.yellow : theme.green
}

function getReviewerStateColor(state: string, theme: AppTheme) {
  const normalized = normalizeGitHubState(state)
  if (normalized === "CHANGES_REQUESTED") {
    return theme.red
  }
  if (normalized === "APPROVED") {
    return theme.green
  }
  if (normalized === "REQUESTED") {
    return theme.yellow
  }
  return theme.text
}
