import type { PullRequestCheckState } from "./types"

export function formatCheckStateLabel(checkState: PullRequestCheckState) {
  if (checkState === "failed") {
    return "Checks failed"
  }
  if (checkState === "running") {
    return "Checks running"
  }
  return "Checks passed"
}
