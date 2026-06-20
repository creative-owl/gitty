import type { AppTheme } from "../../../shared/theme"
import type { RepositoryView } from "../../repositories/model/types"
import type { PullRequestCheckState, PullRequestSummary, RepositoryPullRequests } from "./types"

export type PullRequestSidebarRow = {
  color: string
  pullRequest?: PullRequestSummary
  rightColor?: string
  rightText?: string
  text: string
}

const PULL_REQUEST_SECTION_LIMIT = 3
const PULL_REQUEST_STATUS_DOT = "●"
const PULL_REQUEST_STATUS_WIDTH = 1

export { PULL_REQUEST_STATUS_WIDTH }

export function findPullRequestSummary(repository: RepositoryView, pullRequestNumber: number) {
  if (repository.pullRequests?.status !== "loaded") {
    return undefined
  }

  return [...repository.pullRequests.openedByUser, ...repository.pullRequests.needsReview].find(
    (pullRequest) => pullRequest.number === pullRequestNumber,
  )
}

export function createPullRequestSidebarRows(
  pullRequests: RepositoryPullRequests | undefined,
  theme: AppTheme,
): PullRequestSidebarRow[] {
  if (!pullRequests) {
    return []
  }

  if (pullRequests.status === "loading") {
    return [
      { color: theme.lavender, text: "  Pull requests" },
      { color: theme.subtext0, text: "    Loading..." },
    ]
  }

  if (pullRequests.status === "unavailable") {
    return [
      { color: theme.lavender, text: "  Pull requests" },
      { color: theme.subtext0, text: `    ${pullRequests.message}` },
    ]
  }

  return [
    { color: theme.lavender, text: `  Your pr's (${pullRequests.openedByUser.length})` },
    ...createPullRequestSectionRows(pullRequests.openedByUser, { needsYourReview: false }, theme),
    { color: theme.lavender, text: `  Needs your review (${pullRequests.needsReview.length})` },
    ...createPullRequestSectionRows(pullRequests.needsReview, { needsYourReview: true }, theme),
  ]
}

function createPullRequestSectionRows(
  pullRequests: PullRequestSummary[],
  options: {
    needsYourReview: boolean
  },
  theme: AppTheme,
): PullRequestSidebarRow[] {
  if (pullRequests.length === 0) {
    return [{ color: theme.subtext0, text: "    None" }]
  }

  const visiblePullRequests = pullRequests.slice(0, PULL_REQUEST_SECTION_LIMIT)
  const visiblePullRequestRows = visiblePullRequests.flatMap((pullRequest) => {
    const rows: PullRequestSidebarRow[] = [
      {
        color: theme.text,
        pullRequest,
        rightColor: getPullRequestStatusDotColor(pullRequest, options, theme),
        rightText: PULL_REQUEST_STATUS_DOT,
        text: `    #${pullRequest.number} ${pullRequest.title}`,
      },
    ]

    if (pullRequest.hasChangesRequested) {
      rows.push({
        color: theme.yellow,
        pullRequest,
        text: "    Changes requested",
      })
    }

    return rows
  })
  const hiddenPullRequestCount = pullRequests.length - visiblePullRequests.length

  if (hiddenPullRequestCount <= 0) {
    return visiblePullRequestRows
  }

  return [
    ...visiblePullRequestRows,
    { color: theme.subtext0, text: `    +${hiddenPullRequestCount} more` },
  ]
}

function getPullRequestStatusDotColor(
  pullRequest: PullRequestSummary,
  options: {
    needsYourReview: boolean
  },
  theme: AppTheme,
) {
  if (pullRequest.checkState === "failed") {
    return theme.red
  }
  if (pullRequest.checkState === "running") {
    return theme.yellow
  }
  if (options.needsYourReview) {
    return theme.yellow
  }
  if (pullRequest.reviewState === "changes_requested" || pullRequest.reviewState === "review_required") {
    return theme.yellow
  }
  return theme.green
}

export function getPullRequestCheckStateColor(checkState: PullRequestCheckState, theme: AppTheme) {
  if (checkState === "failed") {
    return theme.red
  }
  if (checkState === "running") {
    return theme.yellow
  }
  return theme.green
}
