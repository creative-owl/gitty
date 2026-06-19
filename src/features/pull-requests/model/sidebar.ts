import { MACCHIATO } from "../../../shared/theme"
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

export function createPullRequestSidebarRows(pullRequests: RepositoryPullRequests | undefined): PullRequestSidebarRow[] {
  if (!pullRequests) {
    return []
  }

  if (pullRequests.status === "loading") {
    return [
      { color: MACCHIATO.lavender, text: "  Pull requests" },
      { color: MACCHIATO.subtext0, text: "    Loading..." },
    ]
  }

  if (pullRequests.status === "unavailable") {
    return [
      { color: MACCHIATO.lavender, text: "  Pull requests" },
      { color: MACCHIATO.subtext0, text: `    ${pullRequests.message}` },
    ]
  }

  return [
    { color: MACCHIATO.lavender, text: `  Your pr's (${pullRequests.openedByUser.length})` },
    ...createPullRequestSectionRows(pullRequests.openedByUser, { needsYourReview: false }),
    { color: MACCHIATO.lavender, text: `  Needs your review (${pullRequests.needsReview.length})` },
    ...createPullRequestSectionRows(pullRequests.needsReview, { needsYourReview: true }),
  ]
}

function createPullRequestSectionRows(
  pullRequests: PullRequestSummary[],
  options: {
    needsYourReview: boolean
  },
): PullRequestSidebarRow[] {
  if (pullRequests.length === 0) {
    return [{ color: MACCHIATO.subtext0, text: "    None" }]
  }

  const visiblePullRequests = pullRequests.slice(0, PULL_REQUEST_SECTION_LIMIT)
  const visiblePullRequestRows = visiblePullRequests.flatMap((pullRequest) => {
    const rows: PullRequestSidebarRow[] = [
      {
        color: MACCHIATO.text,
        pullRequest,
        rightColor: getPullRequestStatusDotColor(pullRequest, options),
        rightText: PULL_REQUEST_STATUS_DOT,
        text: `    #${pullRequest.number} ${pullRequest.title}`,
      },
    ]

    if (pullRequest.hasChangesRequested) {
      rows.push({
        color: MACCHIATO.yellow,
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
    { color: MACCHIATO.subtext0, text: `    +${hiddenPullRequestCount} more` },
  ]
}

function getPullRequestStatusDotColor(
  pullRequest: PullRequestSummary,
  options: {
    needsYourReview: boolean
  },
) {
  if (pullRequest.checkState === "failed") {
    return MACCHIATO.red
  }
  if (pullRequest.checkState === "running") {
    return MACCHIATO.yellow
  }
  if (options.needsYourReview) {
    return MACCHIATO.yellow
  }
  if (pullRequest.reviewState === "changes_requested" || pullRequest.reviewState === "review_required") {
    return MACCHIATO.yellow
  }
  return MACCHIATO.green
}

export function getPullRequestCheckStateColor(checkState: PullRequestCheckState) {
  if (checkState === "failed") {
    return MACCHIATO.red
  }
  if (checkState === "running") {
    return MACCHIATO.yellow
  }
  return MACCHIATO.green
}
