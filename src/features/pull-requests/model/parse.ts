import {
  asArray,
  isRecord,
  readNumber,
  readString,
} from "../../../shared/lib/record"
import type {
  PullRequestCheckState,
  PullRequestDetail,
  PullRequestLabel,
  PullRequestReviewComment,
  PullRequestReviewContext,
  PullRequestReviewer,
  PullRequestReviewThread,
  PullRequestSummary,
  PullRequestTimelineItem,
} from "./types"

const FAILED_CHECK_STATES = new Set([
  "ACTION_REQUIRED",
  "CANCELLED",
  "ERROR",
  "FAILED",
  "FAILURE",
  "STARTUP_FAILURE",
  "TIMED_OUT",
])
const PASSED_CHECK_STATES = new Set(["NEUTRAL", "SKIPPED", "SUCCESS"])
const RUNNING_CHECK_STATES = new Set(["EXPECTED", "IN_PROGRESS", "PENDING", "QUEUED", "REQUESTED", "WAITING"])

export function parsePullRequestSummaries(stdout: string): PullRequestSummary[] {
  const parsed = JSON.parse(stdout) as unknown
  if (!Array.isArray(parsed)) {
    return []
  }

  return parsed.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return []
    }

    const candidate = item as Record<string, unknown>
    if (typeof candidate.number !== "number" || typeof candidate.title !== "string") {
      return []
    }

    return [
      {
        checkState: resolvePullRequestCheckState(candidate.statusCheckRollup),
        hasChangesRequested: normalizeGitHubState(candidate.reviewDecision) === "CHANGES_REQUESTED",
        number: candidate.number,
        title: candidate.title,
        url: typeof candidate.url === "string" ? candidate.url : "",
      },
    ]
  })
}

export function parsePullRequestDetail(stdout: string, reviewContext?: PullRequestReviewContext): PullRequestDetail {
  const parsed = JSON.parse(stdout) as unknown
  if (!isRecord(parsed)) {
    throw new SyntaxError("PR detail response must be an object.")
  }

  return {
    assignees: parsePersonList(parsed.assignees),
    author: readPersonName(parsed.author) || "Unknown",
    body: readString(parsed.body).trim(),
    checkState: resolvePullRequestCheckState(parsed.statusCheckRollup),
    comments: parsePullRequestTimeline(parsed.comments, parsed.reviews || parsed.latestReviews, reviewContext),
    labels: parsePullRequestLabels(parsed.labels),
    number: typeof parsed.number === "number" ? parsed.number : 0,
    reviewDecision: formatGitHubStateLabel(parsed.reviewDecision),
    reviewers: parsePullRequestReviewers(parsed.latestReviews, parsed.reviewRequests),
    title: readString(parsed.title),
    url: readString(parsed.url),
  }
}

function parsePullRequestTimeline(
  comments: unknown,
  latestReviews: unknown,
  reviewContext?: PullRequestReviewContext,
): PullRequestTimelineItem[] {
  const commentItems = asArray(comments).flatMap((comment) => {
    if (!isRecord(comment)) {
      return []
    }

    const body = readString(comment.body).trim()
    if (!body) {
      return []
    }

    return [
      {
        author: readPersonName(comment.author) || "Unknown",
        body,
        createdAt: readString(comment.createdAt),
        kind: "comment" as const,
      },
    ]
  })

  const reviewCommentGroups = createReviewCommentGroups(reviewContext?.comments ?? [])
  const reviewItems = (reviewContext?.reviews.length ? reviewContext.reviews : asArray(latestReviews)).flatMap((review) => {
    if (!isRecord(review)) {
      return []
    }

    const reviewId = readNumber(review.id) ?? readNumber(review.databaseId)
    const state = formatGitHubStateLabel(review.state)
    const body = readString(review.body).trim()
    if (!body && !state) {
      return []
    }

    return [
      {
        author: readPersonName(review.author) || readPersonName(review.user) || "Unknown",
        body: body || `Review: ${state}`,
        createdAt: readString(review.submittedAt) || readString(review.submitted_at) || readString(review.createdAt),
        kind: "review" as const,
        reviewThreads: reviewId ? createReviewThreads(reviewCommentGroups.get(reviewId) ?? []) : [],
        state,
      },
    ]
  })

  return [...commentItems, ...reviewItems].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

function createReviewCommentGroups(comments: unknown[]): Map<number, PullRequestReviewComment[]> {
  const commentsByReviewId = new Map<number, PullRequestReviewComment[]>()

  for (const comment of comments) {
    if (!isRecord(comment)) {
      continue
    }

    const reviewId = readNumber(comment.pull_request_review_id) ?? readNumber(comment.pullRequestReviewId)
    const parsedComment = parseReviewComment(comment)
    if (!reviewId || !parsedComment) {
      continue
    }

    const reviewComments = commentsByReviewId.get(reviewId) ?? []
    reviewComments.push(parsedComment)
    commentsByReviewId.set(reviewId, reviewComments)
  }

  return commentsByReviewId
}

function parseReviewComment(comment: Record<string, unknown>): PullRequestReviewComment | undefined {
  const id = readNumber(comment.id)
  const body = readString(comment.body).trim()
  if (!id || !body) {
    return undefined
  }

  const line = readNumber(comment.line) ?? readNumber(comment.original_line)
  return {
    author: readPersonName(comment.user) || readPersonName(comment.author) || "Unknown",
    body,
    createdAt: readString(comment.created_at) || readString(comment.createdAt),
    id,
    line,
    parentId: readNumber(comment.in_reply_to_id) ?? readNumber(comment.inReplyToId),
    path: readString(comment.path),
  }
}

function createReviewThreads(comments: PullRequestReviewComment[]): PullRequestReviewThread[] {
  const commentsById = new Map(comments.map((comment) => [comment.id, comment]))
  const repliesByParentId = new Map<number, PullRequestReviewComment[]>()

  for (const comment of comments) {
    if (!comment.parentId || !commentsById.has(comment.parentId)) {
      continue
    }

    const replies = repliesByParentId.get(comment.parentId) ?? []
    replies.push(comment)
    repliesByParentId.set(comment.parentId, replies)
  }

  return comments
    .filter((comment) => !comment.parentId || !commentsById.has(comment.parentId))
    .map((comment) => ({
      ...comment,
      replies: sortReviewComments(repliesByParentId.get(comment.id) ?? []),
    }))
    .sort(compareReviewComments)
}

function sortReviewComments(comments: PullRequestReviewComment[]) {
  return [...comments].sort(compareReviewComments)
}

function compareReviewComments(a: PullRequestReviewComment, b: PullRequestReviewComment) {
  return a.createdAt.localeCompare(b.createdAt) || a.id - b.id
}

function parsePullRequestReviewers(latestReviews: unknown, reviewRequests: unknown): PullRequestReviewer[] {
  const reviewers = new Map<string, PullRequestReviewer>()

  for (const review of asArray(latestReviews)) {
    if (!isRecord(review)) {
      continue
    }

    const login = readPersonName(review.author)
    if (!login) {
      continue
    }

    reviewers.set(login, {
      login,
      state: formatGitHubStateLabel(review.state) || "Reviewed",
    })
  }

  for (const login of parsePersonList(reviewRequests)) {
    if (!reviewers.has(login)) {
      reviewers.set(login, {
        login,
        state: "Requested",
      })
    }
  }

  return [...reviewers.values()].sort((a, b) => a.login.localeCompare(b.login))
}

function parsePullRequestLabels(labels: unknown): PullRequestLabel[] {
  return asArray(labels)
    .flatMap((label) => {
      if (!isRecord(label)) {
        return []
      }

      const name = readString(label.name)
      if (!name) {
        return []
      }

      return [
        {
          color: normalizeGitHubLabelColor(label.color),
          name,
        },
      ]
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

function parsePersonList(value: unknown): string[] {
  const names = asPersonArray(value).flatMap((item) => {
    const name = readPersonName(item)
    return name ? [name] : []
  })

  return [...new Set(names)].sort((a, b) => a.localeCompare(b))
}

function asPersonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value
  }

  if (!isRecord(value)) {
    return []
  }

  return [...asArray(value.nodes), ...asArray(value.users), ...asArray(value.teams)]
}

function readPersonName(value: unknown) {
  if (!isRecord(value)) {
    return ""
  }

  return readString(value.login) || readString(value.slug) || readString(value.name)
}

function normalizeGitHubLabelColor(value: unknown) {
  const color = readString(value).replace(/^#/, "")
  if (/^[a-f0-9]{6}$/i.test(color)) {
    return `#${color}`
  }
  return undefined
}

function resolvePullRequestCheckState(statusCheckRollup: unknown): PullRequestCheckState {
  const checks = normalizeStatusCheckRollup(statusCheckRollup)
  if (checks.length === 0) {
    return "passed"
  }

  let hasRunningCheck = false
  for (const check of checks) {
    const checkState = resolveStatusCheckState(check)
    if (checkState === "failed") {
      return "failed"
    }
    if (checkState === "running") {
      hasRunningCheck = true
    }
  }

  return hasRunningCheck ? "running" : "passed"
}

function normalizeStatusCheckRollup(statusCheckRollup: unknown): unknown[] {
  if (Array.isArray(statusCheckRollup)) {
    return statusCheckRollup
  }

  if (!statusCheckRollup || typeof statusCheckRollup !== "object") {
    return []
  }

  const candidate = statusCheckRollup as Record<string, unknown>
  return Array.isArray(candidate.nodes) ? candidate.nodes : []
}

function resolveStatusCheckState(check: unknown): PullRequestCheckState {
  if (!check || typeof check !== "object") {
    return "running"
  }

  const candidate = check as Record<string, unknown>
  const states = [candidate.conclusion, candidate.state, candidate.status].flatMap((value) => {
    const normalized = normalizeGitHubState(value)
    return normalized ? [normalized] : []
  })

  if (states.some((state) => FAILED_CHECK_STATES.has(state))) {
    return "failed"
  }
  if (states.some((state) => RUNNING_CHECK_STATES.has(state))) {
    return "running"
  }
  if (states.some((state) => PASSED_CHECK_STATES.has(state))) {
    return "passed"
  }

  return "running"
}

export function normalizeGitHubState(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().toUpperCase().replace(/[-\s]+/g, "_")
    : undefined
}

function formatGitHubStateLabel(value: unknown) {
  const normalized = normalizeGitHubState(value)
  if (!normalized) {
    return ""
  }

  return normalized
    .toLowerCase()
    .split("_")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ")
}
