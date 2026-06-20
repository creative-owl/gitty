import type { MouseEvent } from "@opentui/core"
import type { HunkDiffThemeInput } from "hunkdiff/opentui"
import { fitText } from "../../../shared/lib/text"
import { useAppTheme } from "../../../shared/theme"
import type {
  PullRequestDetailState,
  PullRequestDiffState,
  PullRequestSummary,
  PullRequestTab,
} from "../model/types"
import { PullRequestDiffContent } from "./PullRequestDiffContent"
import { DescriptionMarkdownBlock, PullRequestTitleBlock } from "./PullRequestDiscussion"

export function PullRequestContentPane({
  activeTab,
  detailState,
  diffState,
  onOpenUrl,
  onSelectTab,
  summary,
  theme,
  width,
}: {
  activeTab: PullRequestTab
  detailState?: PullRequestDetailState
  diffState?: PullRequestDiffState
  onOpenUrl: (url: string) => void
  onSelectTab: (tab: PullRequestTab) => void
  summary?: PullRequestSummary
  theme: HunkDiffThemeInput
  width: number
}) {
  const appTheme = useAppTheme()
  const contentWidth = Math.max(1, width - 4)

  if (!detailState || detailState.status === "loading") {
    return (
      <box
        title={summary ? `PR #${summary.number}` : "Pull Request"}
        style={{
          width,
          height: "100%",
          border: true,
          borderStyle: "rounded",
          borderColor: appTheme.surface2,
          backgroundColor: appTheme.mantle,
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <text fg={appTheme.subtext0}>{fitText("Loading pull request...", contentWidth)}</text>
      </box>
    )
  }

  if (detailState.status === "unavailable") {
    return (
      <box
        title={summary ? `PR #${summary.number}` : "Pull Request"}
        style={{
          width,
          height: "100%",
          border: true,
          borderStyle: "rounded",
          borderColor: appTheme.red,
          backgroundColor: appTheme.mantle,
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <text fg={appTheme.red}>{fitText(detailState.message, contentWidth)}</text>
      </box>
    )
  }

  const detail = detailState.detail

  return (
    <box
      title={`PR #${detail.number}`}
      style={{
        width,
        height: "100%",
        border: true,
        borderStyle: "rounded",
        borderColor: appTheme.surface2,
        backgroundColor: appTheme.mantle,
        flexDirection: "column",
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <PullRequestTabBar activeTab={activeTab} onSelectTab={onSelectTab} width={contentWidth} />
      {activeTab === "discussion" ? (
        <scrollbox style={{ width: "100%", flexGrow: 1 }} scrollY>
          <PullRequestTitleBlock detail={detail} onOpenUrl={onOpenUrl} width={contentWidth} />
          <DescriptionMarkdownBlock markdown={detail.body} width={contentWidth} />
        </scrollbox>
      ) : (
        <PullRequestDiffContent diffState={diffState} theme={theme} width={contentWidth} />
      )}
    </box>
  )
}

function PullRequestTabBar({
  activeTab,
  onSelectTab,
  width,
}: {
  activeTab: PullRequestTab
  onSelectTab: (tab: PullRequestTab) => void
  width: number
}) {
  const theme = useAppTheme()
  const tabs: { label: string; value: PullRequestTab }[] = [
    { label: "Discussion", value: "discussion" },
    { label: "Diff", value: "diff" },
  ]
  const tabWidth = Math.max(10, Math.min(16, Math.floor(width / tabs.length)))

  return (
    <box style={{ width: "100%", height: 2, flexDirection: "column", backgroundColor: theme.mantle }}>
      <box style={{ width: "100%", height: 1, flexDirection: "row", backgroundColor: theme.mantle }}>
        {tabs.map((tab) => {
          const selected = activeTab === tab.value
          const selectTab = (event: MouseEvent) => {
            event.preventDefault()
            event.stopPropagation()
            onSelectTab(tab.value)
          }

          return (
            <box
              key={tab.value}
              style={{
                width: tabWidth,
                height: 1,
                backgroundColor: selected ? theme.surface0 : theme.mantle,
              }}
              onMouseUp={selectTab}
            >
              <text fg={selected ? theme.mauve : theme.text}>
                {fitText(`${selected ? ">" : " "} ${tab.label}`, tabWidth)}
              </text>
            </box>
          )
        })}
      </box>
      <box style={{ width: "100%", height: 1 }} />
    </box>
  )
}
