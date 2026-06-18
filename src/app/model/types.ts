import type { PullRequestSummary } from "../../features/pull-requests/model/types"

export type ActivePane =
  | {
      kind: "working"
      repositoryId: string
    }
  | {
      kind: "pull-request"
      pullRequestNumber: number
      repositoryId: string
    }
