import { useEffect, useState } from "react"
import type { HunkDiffThemeInput } from "hunkdiff/opentui"
import type {
  PullRequestDetailState,
  PullRequestDiffState,
  PullRequestSummary,
  PullRequestTab,
} from "../model/types"
import { PullRequestContentPane } from "./PullRequestContentPane"
import { PullRequestMetadataSidebar } from "./PullRequestMetadataSidebar"

const PR_DETAIL_SIDEBAR_MAX_WIDTH = 32
const PR_DETAIL_SIDEBAR_MIN_WIDTH = 22
const PR_DETAIL_SIDEBAR_RATIO = 0.32

export function PullRequestPane({
  detailState,
  diffState,
  onOpenUrl,
  pullRequestNumber,
  summary,
  theme,
  width,
}: {
  detailState?: PullRequestDetailState
  diffState?: PullRequestDiffState
  onOpenUrl: (url: string) => void
  pullRequestNumber: number
  summary?: PullRequestSummary
  theme: HunkDiffThemeInput
  width: number
}) {
  const [activeTab, setActiveTab] = useState<PullRequestTab>("discussion")
  const sidebarWidth =
    width >= PR_DETAIL_SIDEBAR_MIN_WIDTH + 24
      ? Math.min(PR_DETAIL_SIDEBAR_MAX_WIDTH, Math.max(PR_DETAIL_SIDEBAR_MIN_WIDTH, Math.floor(width * PR_DETAIL_SIDEBAR_RATIO)))
      : 0
  const contentWidth = Math.max(1, width - sidebarWidth - (sidebarWidth > 0 ? 1 : 0))
  const detail = detailState?.status === "loaded" ? detailState.detail : undefined

  useEffect(() => {
    setActiveTab("discussion")
  }, [pullRequestNumber])

  return (
    <box style={{ width, height: "100%", flexDirection: "row" }}>
      <PullRequestContentPane
        activeTab={activeTab}
        detailState={detailState}
        diffState={diffState}
        onOpenUrl={onOpenUrl}
        onSelectTab={setActiveTab}
        summary={summary}
        theme={theme}
        width={contentWidth}
      />
      {sidebarWidth > 0 ? (
        <>
          <box style={{ width: 1, height: "100%" }} />
          <PullRequestMetadataSidebar detail={detail} summary={summary} width={sidebarWidth} />
        </>
      ) : null}
    </box>
  )
}
