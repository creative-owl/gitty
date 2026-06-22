import { useMemo } from "react"
import type { BoxProps, TextProps } from "@opentui/react"
import { GitPane } from "../features/diff/ui/GitPane"
import { OpenRepositoryPrompt } from "../features/open-repository/ui/OpenRepositoryPrompt"
import { PullRequestPane } from "../features/pull-requests/ui/PullRequestPane"
import { RepositorySidebar } from "../features/repository-sidebar/ui/RepositorySidebar"
import { ThemePickerPopup } from "../features/theme-picker/ui/ThemePickerPopup"
import { fitText } from "../shared/lib/text"
import { StatusOverlay } from "../widgets/status-overlay/StatusOverlay"
import type { DiffAppController } from "./useDiffAppController"

type BoxStyle = NonNullable<BoxProps["style"]>
type TextStyle = NonNullable<TextProps["style"]>

const APP_CONTAINER_LAYOUT_STYLE = {
  width: "100%",
  height: "100%",
  flexDirection: "column",
  paddingLeft: 1,
  paddingRight: 1,
  paddingTop: 1,
  paddingBottom: 1,
  position: "relative",
} satisfies BoxStyle

export function DiffAppView({ controller }: { controller: DiffAppController }) {
  const {
    activePane,
    activePullRequestDetailState,
    activePullRequestDiffState,
    activePullRequestSummary,
    activeRepository,
    appTheme,
    closeRepository,
    commandText,
    gitPaneWidth,
    headerWidth,
    hunkTheme,
    isOpenPromptVisible,
    isThemePickerVisible,
    normalizedPathSuggestionIndex,
    openPromptError,
    openPullRequestUrl,
    pathSuggestions,
    repositories,
    repositoryPathInput,
    repositoryWidth,
    selectPullRequest,
    selectTheme,
    selectWorkingChanges,
    selectedThemeIndex,
    selection,
    setActiveSelection,
    showOpenRepositoryPrompt,
    status,
    submitOpenRepository,
    theme,
    themePickerHeight,
    themePickerTop,
    updateRepositoryPathInput,
  } = controller

  const appContainerStyle = useMemo(
    () => ({
      ...APP_CONTAINER_LAYOUT_STYLE,
      backgroundColor: appTheme.base,
    }),
    [appTheme.base],
  )
  const titleTextStyle = useMemo<TextStyle>(() => ({ fg: appTheme.lavender }), [appTheme.lavender])
  const commandTextStyle = useMemo<TextStyle>(() => ({ fg: appTheme.subtext0 }), [appTheme.subtext0])

  return (
    <box style={appContainerStyle}>
      <box style={{ width: "100%", height: 1 }}>
        <text style={titleTextStyle}>{fitText("Gitty", headerWidth)}</text>
      </box>
      <box style={{ width: "100%", height: 1 }}>
        <text style={commandTextStyle}>{fitText(commandText, headerWidth)}</text>
      </box>
      <box style={{ height: 1 }} />
      {isOpenPromptVisible ? (
        <>
          <OpenRepositoryPrompt
            message={openPromptError}
            onCompleteSuggestion={updateRepositoryPathInput}
            onInput={updateRepositoryPathInput}
            onSubmit={submitOpenRepository}
            selectedSuggestionIndex={normalizedPathSuggestionIndex}
            suggestions={pathSuggestions}
            value={repositoryPathInput}
            width={headerWidth}
          />
          <box style={{ height: 1 }} />
        </>
      ) : null}
      <box style={{ width: "100%", flexGrow: 1, flexDirection: "row" }}>
        <RepositorySidebar
          activePane={activePane}
          activeRepositoryId={activeRepository?.id ?? ""}
          onCloseRepository={closeRepository}
          onOpenRepository={showOpenRepositoryPrompt}
          onSelectPullRequest={selectPullRequest}
          onSelectWorkingChanges={selectWorkingChanges}
          width={repositoryWidth}
          repositories={repositories}
        />
        <box style={{ width: 1, height: "100%" }} />
        {activePane.kind === "pull-request" && activeRepository ? (
          <PullRequestPane
            detailState={activePullRequestDetailState}
            diffState={activePullRequestDiffState}
            onOpenUrl={openPullRequestUrl}
            pullRequestNumber={activePane.pullRequestNumber}
            summary={activePullRequestSummary}
            theme={hunkTheme}
            width={gitPaneWidth}
          />
        ) : (
          <GitPane
            onSelectionChange={setActiveSelection}
            selection={selection}
            theme={hunkTheme}
            width={gitPaneWidth}
            repository={activeRepository}
          />
        )}
      </box>
      <StatusOverlay status={status} width={headerWidth} />
      {isThemePickerVisible ? (
        <ThemePickerPopup
          currentTheme={theme}
          height={themePickerHeight}
          onSelectTheme={selectTheme}
          selectedThemeIndex={selectedThemeIndex}
          top={themePickerTop}
          width={headerWidth}
        />
      ) : null}
    </box>
  )
}
