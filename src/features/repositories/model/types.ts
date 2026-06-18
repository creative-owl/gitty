import type { HunkDiffFile } from "hunkdiff/opentui"
import type {
  PullRequestDetailState,
  PullRequestDiffState,
  RepositoryPullRequests,
} from "../../pull-requests/model/types"

export type GitRepositoryRef = {
  name: string
  path: string
}

export type RepositoryView = {
  id: string
  name: string
  path: string
  files: HunkDiffFile[]
  pullRequestDetails?: Record<number, PullRequestDetailState>
  pullRequestDiffs?: Record<number, PullRequestDiffState>
  pullRequests?: RepositoryPullRequests
  stats: {
    additions: number
    deletions: number
  }
}
