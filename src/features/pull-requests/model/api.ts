import { createDiffFilesFromPatch } from "../../diff/model/diff"
import type {
  PullRequestDetailState,
  PullRequestDiffState,
  PullRequestReviewContext,
  PullRequestSummary,
  RepositoryPullRequests,
} from "./types"
import { parsePullRequestDetail, parsePullRequestSummaries } from "./parse"

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
        "assignees,author,body,comments,labels,latestReviews,number,reviewDecision,reviewRequests,reviews,statusCheckRollup,title,url",
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

    const reviewContext = await readGhPullRequestReviewContext(repositoryPath, pullRequestNumber)

    return {
      detail: parsePullRequestDetail(stdout, reviewContext),
      status: "loaded",
    }
  } catch (error) {
    return {
      message: error instanceof SyntaxError ? "Could not parse PR details." : "Could not load PR details.",
      status: "unavailable",
    }
  }
}

async function readGhPullRequestReviewContext(
  repositoryPath: string,
  pullRequestNumber: number,
): Promise<PullRequestReviewContext | undefined> {
  const [reviews, comments] = await Promise.all([
    readGhApiPaginatedArray(repositoryPath, `repos/{owner}/{repo}/pulls/${pullRequestNumber}/reviews`),
    readGhApiPaginatedArray(repositoryPath, `repos/{owner}/{repo}/pulls/${pullRequestNumber}/comments`),
  ])

  if (!reviews && !comments) {
    return undefined
  }

  return {
    comments: comments ?? [],
    reviews: reviews ?? [],
  }
}

async function readGhApiPaginatedArray(repositoryPath: string, endpoint: string): Promise<unknown[] | undefined> {
  try {
    const process = Bun.spawn(["gh", "api", endpoint, "--paginate", "--slurp"], {
      cwd: repositoryPath,
      env: createGhEnvironment(),
      stderr: "pipe",
      stdin: "ignore",
      stdout: "pipe",
    })

    const [exitCode, stdout] = await Promise.all([
      process.exited,
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
    ])
    if (exitCode !== 0) {
      return undefined
    }

    return parseGhPaginatedArray(stdout)
  } catch {
    return undefined
  }
}

function parseGhPaginatedArray(stdout: string): unknown[] {
  const parsed = JSON.parse(stdout) as unknown
  if (!Array.isArray(parsed)) {
    return []
  }

  return parsed.every(Array.isArray) ? parsed.flatMap((page) => page) : parsed
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
