import type { MouseEvent } from "@opentui/core"
import type { ActivePane } from "../../../app/model/types"
import { fitText, pluralize } from "../../../shared/lib/text"
import { useAppTheme } from "../../../shared/theme"
import {
  createPullRequestSidebarRows,
  PULL_REQUEST_STATUS_WIDTH,
} from "../../pull-requests/model/sidebar"
import type { PullRequestSummary } from "../../pull-requests/model/types"
import type { RepositoryView } from "../../repositories/model/types"

const REPOSITORY_CLOSE_CONTROL_WIDTH = 3

export function RepositorySidebar({
  activePane,
  activeRepositoryId,
  onCloseRepository,
  onOpenRepository,
  onSelectPullRequest,
  onSelectWorkingChanges,
  width,
  repositories,
}: {
  activePane: ActivePane
  activeRepositoryId: string
  onCloseRepository: (repositoryId: string) => void
  onOpenRepository: () => void
  onSelectPullRequest: (repositoryId: string, pullRequest: PullRequestSummary) => void
  onSelectWorkingChanges: (repositoryId: string) => void
  width: number
  repositories: RepositoryView[]
}) {
  const theme = useAppTheme()
  const contentWidth = Math.max(1, width - 2)

  return (
    <box
      title="Repositories"
      style={{
        width,
        height: "100%",
        border: true,
        borderStyle: "rounded",
        borderColor: theme.surface2,
        backgroundColor: theme.mantle,
      }}
    >
      <scrollbox style={{ width: "100%", height: "100%" }} scrollY>
        <box style={{ width: "100%", height: 2, flexDirection: "column" }}>
          <box
            style={{
              width: "100%",
              height: 1,
              backgroundColor: theme.surface0,
            }}
            onMouseUp={onOpenRepository}
          >
            <text fg={theme.mauve}>{fitText("+ Open repository", contentWidth)}</text>
          </box>
          <box style={{ width: "100%", height: 1 }} />
        </box>
        {repositories.map((repository) => {
          const active = repository.id === activeRepositoryId
          const workingChangesActive = active && activePane.kind === "working"
          const pullRequestRows = createPullRequestSidebarRows(repository.pullRequests, theme)
          const selectRepository = () => onSelectWorkingChanges(repository.id)
          const closeRepository = (event: MouseEvent) => {
            event.preventDefault()
            event.stopPropagation()
            onCloseRepository(repository.id)
          }
          const selectPullRequest = (pullRequest: PullRequestSummary, event: MouseEvent) => {
            event.preventDefault()
            event.stopPropagation()
            onSelectPullRequest(repository.id, pullRequest)
          }
          const nameWidth = Math.max(1, contentWidth - REPOSITORY_CLOSE_CONTROL_WIDTH)

          return (
            <box
              key={repository.id}
              style={{ width: "100%", height: 4 + pullRequestRows.length, flexDirection: "column" }}
              onMouseUp={selectRepository}
            >
              <box
                style={{ width: "100%", height: 1, flexDirection: "row" }}
                onMouseUp={selectRepository}
              >
                <box style={{ width: nameWidth, height: 1 }} onMouseUp={selectRepository}>
                  <text fg={active ? theme.lavender : theme.text}>
                    {fitText(repository.name, nameWidth)}
                  </text>
                </box>
                <box
                  style={{ width: REPOSITORY_CLOSE_CONTROL_WIDTH, height: 1 }}
                  onMouseUp={closeRepository}
                >
                  <text fg={theme.red}>{fitText(" x", REPOSITORY_CLOSE_CONTROL_WIDTH)}</text>
                </box>
              </box>
              <box
                style={{
                  width: "100%",
                  height: 1,
                  backgroundColor: workingChangesActive ? theme.surface0 : theme.mantle,
                }}
                onMouseUp={selectRepository}
              >
                <text fg={workingChangesActive ? theme.mauve : theme.text}>
                  {fitText(`${workingChangesActive ? ">" : " "} Working changes`, contentWidth)}
                </text>
              </box>
              <box style={{ width: "100%", height: 1 }} onMouseUp={selectRepository}>
                <text fg={theme.subtext0}>
                  {fitText(
                    `  ${pluralize(repository.files.length, "file")} +${repository.stats.additions} -${repository.stats.deletions}`,
                    contentWidth,
                  )}
                </text>
              </box>
              {pullRequestRows.map((row, index) => {
                const pullRequestActive =
                  active &&
                  activePane.kind === "pull-request" &&
                  activePane.pullRequestNumber === row.pullRequest?.number
                const rightWidth = row.rightText ? Math.min(contentWidth, PULL_REQUEST_STATUS_WIDTH) : 0
                const leftWidth = Math.max(1, contentWidth - rightWidth)
                const rowColor = pullRequestActive ? theme.mauve : row.color
                const onMouseUp = row.pullRequest
                  ? (event: MouseEvent) => selectPullRequest(row.pullRequest as PullRequestSummary, event)
                  : selectRepository

                return (
                  <box
                    key={`${repository.id}:pull-request-row:${index}`}
                    style={{
                      width: "100%",
                      height: 1,
                      flexDirection: "row",
                      backgroundColor: pullRequestActive ? theme.surface0 : theme.mantle,
                    }}
                    onMouseUp={onMouseUp}
                  >
                    <box style={{ width: leftWidth, height: 1 }}>
                      <text fg={rowColor}>{fitText(row.text, leftWidth)}</text>
                    </box>
                    {row.rightText ? (
                      <box style={{ width: rightWidth, height: 1 }}>
                        <text fg={row.rightColor ?? row.color}>{fitText(row.rightText, rightWidth)}</text>
                      </box>
                    ) : null}
                  </box>
                )
              })}
              <box style={{ width: "100%", height: 1 }} onMouseUp={selectRepository} />
            </box>
          )
        })}
      </scrollbox>
    </box>
  )
}
