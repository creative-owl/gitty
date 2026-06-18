import type { HunkDiffFile } from "hunkdiff/opentui"

export type PullRequestCheckState = "failed" | "running" | "passed"

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
  comments: PullRequestTimelineItem[]
  labels: PullRequestLabel[]
  number: number
  reviewDecision?: string
  reviewers: PullRequestReviewer[]
  title: string
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
  title: string
  url: string
}

export type PullRequestTimelineItem = {
  author: string
  body: string
  createdAt: string
  kind: "comment" | "review"
  reviewThreads?: PullRequestReviewThread[]
  state?: string
}

export type PullRequestReviewThread = PullRequestReviewComment & {
  replies: PullRequestReviewComment[]
}

export type PullRequestReviewComment = {
  author: string
  body: string
  createdAt: string
  id: number
  line?: number
  parentId?: number
  path?: string
}

export type PullRequestReviewContext = {
  comments: unknown[]
  reviews: unknown[]
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
