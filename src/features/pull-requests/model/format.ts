import type { PullRequestCheckState } from "./types"

export function formatTimelineTimestamp(value: string) {
  return value ? value.replace("T", " ").slice(0, 16) : ""
}

export function formatCheckStateLabel(checkState: PullRequestCheckState) {
  if (checkState === "failed") {
    return "Checks failed"
  }
  if (checkState === "running") {
    return "Checks running"
  }
  return "Checks passed"
}
