import { createDiffFilesFromPatch } from "../../diff/model/diff"
import { asArray, isRecord } from "../../../shared/lib/record"
import type {
  PullRequestDetailState,
  PullRequestDiffState,
  PullRequestSummary,
  RepositoryPullRequests,
} from "./types"
import { parsePullRequestDetail, parsePullRequestSummaries } from "./parse"

const PULL_REQUEST_REVIEW_THREADS_QUERY = `
  query($owner: String!, $name: String!, $number: Int!, $endCursor: String) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $number) {
        reviewThreads(first: 100, after: $endCursor) {
          nodes {
            isResolved
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }
`

export async function loadRepositoryPullRequests(repositoryPath: string): Promise<RepositoryPullRequests> {
  const [openedByUser, needsReview] = await Promise.all([
    readGhPullRequests(repositoryPath, "author:@me"),
    readGhPullRequests(repositoryPath, "review-requested:@me"),
  ])

  if (!openedByUser.ok && !needsReview.ok) {
    return {
      message: openedByUser.message,
      status: "unavailable",
    }
  }

  return {
    openedByUser: openedByUser.ok ? openedByUser.pullRequests : [],
    needsReview: needsReview.ok ? needsReview.pullRequests : [],
    status: "loaded",
  }
}

async function readGhPullRequests(
  repositoryPath: string,
  search: string,
): Promise<
  | {
      ok: true
      pullRequests: PullRequestSummary[]
    }
  | {
      message: string
      ok: false
    }
> {
  try {
    const process = Bun.spawn(
      [
        "gh",
        "pr",
        "list",
        "--state",
        "open",
        "--limit",
        "30",
        "--search",
        search,
        "--json",
        "number,reviewDecision,statusCheckRollup,title,url",
      ],
      {
        cwd: repositoryPath,
        env: createGhEnvironment(),
        stderr: "pipe",
        stdin: "ignore",
        stdout: "pipe",
      },
    )

    const [exitCode, stdout, stderr] = await Promise.all([
      process.exited,
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
    ])

    if (exitCode !== 0) {
      return {
        message: summarizeGhError(stderr),
        ok: false,
      }
    }

    return {
      ok: true,
      pullRequests: parsePullRequestSummaries(stdout),
    }
  } catch (error) {
    return {
      message: error instanceof SyntaxError ? "Could not parse GitHub PRs." : "Install and authenticate gh to show PRs.",
      ok: false,
    }
  }
}

export async function readGhPullRequestDetail(
  repositoryPath: string,
  pullRequestNumber: number,
): Promise<PullRequestDetailState> {
  try {
    const process = Bun.spawn(
      [
        "gh",
        "pr",
        "view",
        String(pullRequestNumber),
        "--json",
        "assignees,author,body,labels,latestReviews,number,reviewDecision,reviewRequests,statusCheckRollup,title,url",
      ],
      {
        cwd: repositoryPath,
        env: createGhEnvironment(),
        stderr: "pipe",
        stdin: "ignore",
        stdout: "pipe",
      },
    )

    const [exitCode, stdout, stderr] = await Promise.all([
      process.exited,
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
    ])

    if (exitCode !== 0) {
      return {
        message: summarizeGhError(stderr),
        status: "unavailable",
      }
    }

    const unresolvedReviewThreadCount = await readGhPullRequestUnresolvedReviewThreadCount(
      repositoryPath,
      pullRequestNumber,
    )

    return {
      detail: parsePullRequestDetail(stdout, unresolvedReviewThreadCount),
      status: "loaded",
    }
  } catch (error) {
    return {
      message: error instanceof SyntaxError ? "Could not parse PR details." : "Could not load PR details.",
      status: "unavailable",
    }
  }
}

async function readGhPullRequestUnresolvedReviewThreadCount(
  repositoryPath: string,
  pullRequestNumber: number,
): Promise<number | undefined> {
  try {
    const process = Bun.spawn(
      [
        "gh",
        "api",
        "graphql",
        "--paginate",
        "--slurp",
        "-F",
        "owner={owner}",
        "-F",
        "name={repo}",
        "-F",
        `number=${pullRequestNumber}`,
        "-f",
        `query=${PULL_REQUEST_REVIEW_THREADS_QUERY}`,
      ],
      {
        cwd: repositoryPath,
        env: createGhEnvironment(),
        stderr: "pipe",
        stdin: "ignore",
        stdout: "pipe",
      },
    )

    const [exitCode, stdout] = await Promise.all([
      process.exited,
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
    ])
    if (exitCode !== 0) {
      return undefined
    }

    return parseUnresolvedReviewThreadCount(stdout)
  } catch {
    return undefined
  }
}

function parseUnresolvedReviewThreadCount(stdout: string) {
  const parsed = JSON.parse(stdout) as unknown
  const pages = Array.isArray(parsed) ? parsed : [parsed]
  let foundReviewThreads = false
  let count = 0

  for (const page of pages) {
    if (!isRecord(page)) {
      continue
    }
    if (asArray(page.errors).length > 0) {
      return undefined
    }

    const data = isRecord(page.data) ? page.data : undefined
    const repository = data && isRecord(data.repository) ? data.repository : undefined
    const pullRequest = repository && isRecord(repository.pullRequest) ? repository.pullRequest : undefined
    const reviewThreads = pullRequest && isRecord(pullRequest.reviewThreads) ? pullRequest.reviewThreads : undefined
    if (!reviewThreads) {
      continue
    }

    for (const thread of asArray(reviewThreads?.nodes)) {
      if (isRecord(thread) && thread.isResolved === false) {
        count += 1
      }
    }
    foundReviewThreads = true
  }

  return foundReviewThreads ? count : undefined
}

export async function readGhPullRequestDiff(
  repositoryPath: string,
  pullRequestNumber: number,
): Promise<PullRequestDiffState> {
  try {
    const process = Bun.spawn(["gh", "pr", "diff", String(pullRequestNumber), "--patch"], {
      cwd: repositoryPath,
      env: createGhEnvironment(),
      stderr: "pipe",
      stdin: "ignore",
      stdout: "pipe",
    })

    const [exitCode, stdout, stderr] = await Promise.all([
      process.exited,
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
    ])

    if (exitCode !== 0) {
      return {
        message: summarizeGhError(stderr),
        status: "unavailable",
      }
    }

    return {
      files: stdout.trim() ? createDiffFilesFromPatch(stdout, `PR #${pullRequestNumber}`) : [],
      status: "loaded",
    }
  } catch {
    return {
      message: "Could not load PR diff.",
      status: "unavailable",
    }
  }
}

function createGhEnvironment(): Record<string, string> {
  const environment: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      environment[key] = value
    }
  }
  environment.GH_PROMPT_DISABLED = "1"
  return environment
}

function summarizeGhError(stderr: string): string {
  const detail = stderr.trim().split("\n").find(Boolean)
  if (!detail) {
    return "Could not load GitHub PRs."
  }
  if (detail.toLowerCase().includes("not a github repository")) {
    return "No GitHub remote found."
  }
  if (detail.toLowerCase().includes("authentication")) {
    return "Authenticate gh to show PRs."
  }
  return detail
}
