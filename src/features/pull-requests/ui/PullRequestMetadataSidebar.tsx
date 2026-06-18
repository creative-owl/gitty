import { pushWrappedRows, type TextRow } from "../../../shared/lib/text"
import { MACCHIATO } from "../../../shared/theme"
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
  const contentWidth = Math.max(1, width - 4)
  const rows = detail
    ? createPullRequestMetadataRows(detail, contentWidth)
    : [
        {
          color: MACCHIATO.lavender,
          text: "Status",
        },
        {
          color: summary ? getPullRequestCheckStateColor(summary.checkState) : MACCHIATO.subtext0,
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
        borderColor: MACCHIATO.surface2,
        backgroundColor: MACCHIATO.mantle,
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

function createPullRequestMetadataRows(detail: PullRequestDetail, width: number): TextRow[] {
  const rows: TextRow[] = [
    { color: MACCHIATO.lavender, text: "Status" },
    {
      color: getPullRequestCheckStateColor(detail.checkState),
      text: formatCheckStateLabel(detail.checkState),
    },
  ]

  if (detail.reviewDecision) {
    rows.push({
      color: detail.reviewDecision === "Changes Requested" ? MACCHIATO.red : MACCHIATO.subtext0,
      text: detail.reviewDecision,
    })
  }

  rows.push({ color: MACCHIATO.subtext0, text: "" })
  rows.push({ color: MACCHIATO.lavender, text: "Reviewers" })
  if (detail.reviewers.length === 0) {
    rows.push({ color: MACCHIATO.subtext0, text: "None" })
  } else {
    for (const reviewer of detail.reviewers) {
      pushWrappedRows(rows, `${reviewer.login} ${reviewer.state}`, width, getReviewerStateColor(reviewer.state))
    }
  }

  rows.push({ color: MACCHIATO.subtext0, text: "" })
  rows.push({ color: MACCHIATO.lavender, text: "Assignees" })
  if (detail.assignees.length === 0) {
    rows.push({ color: MACCHIATO.subtext0, text: "None" })
  } else {
    for (const assignee of detail.assignees) {
      pushWrappedRows(rows, assignee, width, MACCHIATO.text)
    }
  }

  rows.push({ color: MACCHIATO.subtext0, text: "" })
  rows.push({ color: MACCHIATO.lavender, text: "Labels" })
  if (detail.labels.length === 0) {
    rows.push({ color: MACCHIATO.subtext0, text: "None" })
  } else {
    for (const label of detail.labels) {
      pushWrappedRows(rows, label.name, width, label.color ?? MACCHIATO.text)
    }
  }

  return rows
}

function getReviewerStateColor(state: string) {
  const normalized = normalizeGitHubState(state)
  if (normalized === "CHANGES_REQUESTED") {
    return MACCHIATO.red
  }
  if (normalized === "APPROVED") {
    return MACCHIATO.green
  }
  if (normalized === "REQUESTED") {
    return MACCHIATO.yellow
  }
  return MACCHIATO.text
}
