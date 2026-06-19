import type { HunkDiffFile } from "hunkdiff/opentui"

export type PullRequestCheckState = "failed" | "running" | "passed"
export type PullRequestReviewState = "approved" | "changes_requested" | "review_required"

export type PullRequestDetailState =
  | {
      status: "loading"
    }
  | {
      detail: PullRequestDetail
      status: "loaded"
    }
  | {
      message: string
      status: "unavailable"
    }

export type PullRequestDiffState =
  | {
      status: "loading"
    }
  | {
      files: HunkDiffFile[]
      status: "loaded"
    }
  | {
      message: string
      status: "unavailable"
    }

export type PullRequestDetail = {
  assignees: string[]
  author: string
  body: string
  checkState: PullRequestCheckState
  labels: PullRequestLabel[]
  number: number
  reviewDecision?: string
  reviewers: PullRequestReviewer[]
  title: string
  unresolvedReviewThreadCount?: number
  url: string
}

export type PullRequestLabel = {
  color?: string
  name: string
}

export type PullRequestReviewer = {
  login: string
  state: string
}

export type PullRequestSummary = {
  checkState: PullRequestCheckState
  hasChangesRequested: boolean
  number: number
  reviewState?: PullRequestReviewState
  title: string
  url: string
}

export type PullRequestTab = "diff" | "discussion"

export type RepositoryPullRequests =
  | {
      status: "loading"
    }
  | {
      openedByUser: PullRequestSummary[]
      needsReview: PullRequestSummary[]
      status: "loaded"
    }
  | {
      message: string
      status: "unavailable"
    }
