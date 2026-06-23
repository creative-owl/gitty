import { CliRenderEvents, type Selection } from "@opentui/core"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import type { HunkDiffSelection } from "hunkdiff/opentui"
import { useEffect, useMemo, useRef, useState } from "react"
import { defaultSelection, normalizeSelection } from "../features/diff/model/diff"
import { createPathSuggestions } from "../features/open-repository/model/pathSuggestions"
import {
  loadRepositoryPullRequests,
  readGhPullRequestDetail,
  readGhPullRequestDiff,
} from "../features/pull-requests/model/api"
import { findPullRequestSummary } from "../features/pull-requests/model/sidebar"
import type { PullRequestSummary } from "../features/pull-requests/model/types"
import { openGitRepository } from "../features/repositories/model/repositories"
import type { RepositoryView } from "../features/repositories/model/types"
import {
  getPersistableWorkspacePaths,
  saveWorkspacePaths,
  saveWorkspaceTheme,
} from "../features/repositories/model/workspaces"
import { getThemeIndex, THEME_NAMES } from "../features/theme-picker/model/themes"
import {
  copyTextToClipboard,
  formatCopiedSelectionStatus,
  openExternalUrl,
} from "../shared/lib/platform"
import { pluralize } from "../shared/lib/text"
import { getAppTheme, getHunkDiffTheme, type ThemeName } from "../shared/theme"
import type { OpenRepositoryStatus } from "../widgets/status-overlay/StatusOverlay"
import type { ActivePane } from "./model/types"

const REPOSITORY_SIDEBAR_MAX_WIDTH = 45
const REPOSITORY_SIDEBAR_MIN_WIDTH = 29
const REPOSITORY_SIDEBAR_WIDTH_RATIO = 0.36
const STATUS_OVERLAY_DISMISS_MS = 5000

export type DiffAppControllerOptions = {
  initialRepositories: RepositoryView[]
  persistWorkspaces: boolean
  staged: boolean
  theme: ThemeName
}

export function useDiffAppController({
  initialRepositories,
  persistWorkspaces,
  staged,
  theme: initialTheme,
}: DiffAppControllerOptions) {
  const renderer = useRenderer()
  const terminal = useTerminalDimensions()
  const pullRequestLoadIds = useRef(new Set<string>())
  const lastSavedWorkspacePathKey = useRef<string | undefined>(undefined)
  const themeBeforePicker = useRef<ThemeName | undefined>(undefined)
  const [repositories, setRepositories] = useState<RepositoryView[]>(initialRepositories)
  const firstRepository = repositories[0]
  const [activePane, setActivePane] = useState<ActivePane>(() => ({
    kind: "working",
    repositoryId: firstRepository?.id ?? "",
  }))
  const [selections, setSelections] = useState<Record<string, HunkDiffSelection>>(() =>
    Object.fromEntries(repositories.map((repository) => [repository.id, defaultSelection(repository.files)])),
  )
  const [isOpenPromptVisible, setOpenPromptVisible] = useState(false)
  const [repositoryPathInput, setRepositoryPathInput] = useState("")
  const [selectedPathSuggestionIndex, setSelectedPathSuggestionIndex] = useState(0)
  const [openPromptError, setOpenPromptError] = useState("")
  const [theme, setTheme] = useState<ThemeName>(initialTheme)
  const [isThemePickerVisible, setThemePickerVisible] = useState(false)
  const [selectedThemeIndex, setSelectedThemeIndex] = useState(() => getThemeIndex(initialTheme))
  const [status, setStatus] = useState<OpenRepositoryStatus>()
  const activeRepositoryId = activePane.repositoryId

  const activeRepository = useMemo(
    () => repositories.find((repository) => repository.id === activeRepositoryId) ?? firstRepository,
    [activeRepositoryId, firstRepository, repositories],
  )
  const activePullRequestSummary =
    activePane.kind === "pull-request" && activeRepository
      ? findPullRequestSummary(activeRepository, activePane.pullRequestNumber)
      : undefined
  const activePullRequestDetailState =
    activePane.kind === "pull-request" ? activeRepository?.pullRequestDetails?.[activePane.pullRequestNumber] : undefined
  const activePullRequestDiffState =
    activePane.kind === "pull-request" ? activeRepository?.pullRequestDiffs?.[activePane.pullRequestNumber] : undefined
  const files = activeRepository?.files ?? []
  const selection = normalizeSelection(files, activeRepository ? selections[activeRepository.id] : undefined)
  const shellWidth = Math.max(1, terminal.width - 2)
  const repositoryWidth = Math.min(
    REPOSITORY_SIDEBAR_MAX_WIDTH,
    Math.max(REPOSITORY_SIDEBAR_MIN_WIDTH, Math.floor(shellWidth * REPOSITORY_SIDEBAR_WIDTH_RATIO)),
  )
  const gitPaneWidth = Math.max(1, shellWidth - repositoryWidth - 1)
  const headerWidth = shellWidth
  const commandText = `${pluralize(repositories.length, "repository", "repositories")}  |  o open repository  |  t theme  |  tab/click repo or PR  |  q quit`
  const pathSuggestions = useMemo(() => createPathSuggestions(repositoryPathInput), [repositoryPathInput])
  const normalizedPathSuggestionIndex =
    pathSuggestions.length > 0 ? Math.min(selectedPathSuggestionIndex, pathSuggestions.length - 1) : 0
  const themePickerHeight = Math.max(5, Math.min(THEME_NAMES.length + 4, Math.max(5, terminal.height - 2), 18))
  const themePickerTop = Math.max(1, Math.min(Math.max(1, terminal.height - themePickerHeight - 1), 4))
  const appTheme = useMemo(() => getAppTheme(theme), [theme])
  const hunkTheme = useMemo(() => getHunkDiffTheme(theme), [theme])

  useEffect(() => {
    persistWorkspaceRepositories(repositories)
  }, [persistWorkspaces, repositories])

  useEffect(() => {
    for (const repository of repositories) {
      if (repository.pullRequests?.status !== "loading" || pullRequestLoadIds.current.has(repository.id)) {
        continue
      }

      pullRequestLoadIds.current.add(repository.id)
      void loadRepositoryPullRequests(repository.path)
        .then((pullRequests) => {
          setRepositories((currentRepositories) =>
            currentRepositories.map((currentRepository) =>
              currentRepository.id === repository.id ? { ...currentRepository, pullRequests } : currentRepository,
            ),
          )
        })
        .catch((error: unknown) => {
          setRepositories((currentRepositories) =>
            currentRepositories.map((currentRepository) =>
              currentRepository.id === repository.id
                ? {
                    ...currentRepository,
                    pullRequests: {
                      message: getLoadErrorMessage(error, "Could not load GitHub PRs."),
                      status: "unavailable",
                    },
                  }
                : currentRepository,
            ),
          )
        })
    }
  }, [repositories])

  useEffect(() => {
    if (!isThemePickerVisible) {
      return
    }

    const previewTheme = THEME_NAMES[selectedThemeIndex]
    if (previewTheme) {
      setTheme(previewTheme)
    }
  }, [isThemePickerVisible, selectedThemeIndex])

  useEffect(() => {
    if (activePane.kind !== "pull-request" || !activeRepository || activePullRequestDetailState) {
      return
    }

    const repositoryId = activeRepository.id
    const repositoryPath = activeRepository.path
    const pullRequestNumber = activePane.pullRequestNumber

    setRepositories((currentRepositories) =>
      currentRepositories.map((currentRepository) =>
        currentRepository.id === repositoryId
          ? {
              ...currentRepository,
              pullRequestDetails: {
                ...(currentRepository.pullRequestDetails ?? {}),
                [pullRequestNumber]: { status: "loading" },
              },
            }
          : currentRepository,
      ),
    )

    void readGhPullRequestDetail(repositoryPath, pullRequestNumber)
      .then((detailState) => {
        setRepositories((currentRepositories) =>
          currentRepositories.map((currentRepository) =>
            currentRepository.id === repositoryId
              ? {
                  ...currentRepository,
                  pullRequestDetails: {
                    ...(currentRepository.pullRequestDetails ?? {}),
                    [pullRequestNumber]: detailState,
                  },
                }
              : currentRepository,
          ),
        )
      })
      .catch((error: unknown) => {
        setRepositories((currentRepositories) =>
          currentRepositories.map((currentRepository) =>
            currentRepository.id === repositoryId
              ? {
                  ...currentRepository,
                  pullRequestDetails: {
                    ...(currentRepository.pullRequestDetails ?? {}),
                    [pullRequestNumber]: {
                      message: getLoadErrorMessage(error, "Could not load PR details."),
                      status: "unavailable",
                    },
                  },
                }
              : currentRepository,
          ),
        )
      })
  }, [activePane, activeRepository, activePullRequestDetailState])

  useEffect(() => {
    if (activePane.kind !== "pull-request" || !activeRepository || activePullRequestDiffState) {
      return
    }

    const repositoryId = activeRepository.id
    const repositoryPath = activeRepository.path
    const pullRequestNumber = activePane.pullRequestNumber

    setRepositories((currentRepositories) =>
      currentRepositories.map((currentRepository) =>
        currentRepository.id === repositoryId
          ? {
              ...currentRepository,
              pullRequestDiffs: {
                ...(currentRepository.pullRequestDiffs ?? {}),
                [pullRequestNumber]: { status: "loading" },
              },
            }
          : currentRepository,
      ),
    )

    void readGhPullRequestDiff(repositoryPath, pullRequestNumber)
      .then((diffState) => {
        setRepositories((currentRepositories) =>
          currentRepositories.map((currentRepository) =>
            currentRepository.id === repositoryId
              ? {
                  ...currentRepository,
                  pullRequestDiffs: {
                    ...(currentRepository.pullRequestDiffs ?? {}),
                    [pullRequestNumber]: diffState,
                  },
                }
              : currentRepository,
          ),
        )
      })
      .catch((error: unknown) => {
        setRepositories((currentRepositories) =>
          currentRepositories.map((currentRepository) =>
            currentRepository.id === repositoryId
              ? {
                  ...currentRepository,
                  pullRequestDiffs: {
                    ...(currentRepository.pullRequestDiffs ?? {}),
                    [pullRequestNumber]: {
                      message: getLoadErrorMessage(error, "Could not load PR diff."),
                      status: "unavailable",
                    },
                  },
                }
              : currentRepository,
          ),
        )
      })
  }, [activePane, activeRepository, activePullRequestDiffState])

  useEffect(() => {
    if (!status) {
      return
    }

    const timeout = setTimeout(() => {
      setStatus((currentStatus) => (currentStatus === status ? undefined : currentStatus))
    }, STATUS_OVERLAY_DISMISS_MS)

    return () => clearTimeout(timeout)
  }, [status])

  useEffect(() => {
    const copySelectionToClipboard = (selection: Selection) => {
      const text = selection.getSelectedText()
      if (!text) {
        return
      }

      const result = copyTextToClipboard(renderer, text)
      setStatus({
        text: result.ok ? formatCopiedSelectionStatus(text) : result.message,
      })
    }

    renderer.on(CliRenderEvents.SELECTION, copySelectionToClipboard)
    return () => {
      renderer.off(CliRenderEvents.SELECTION, copySelectionToClipboard)
    }
  }, [renderer])

  function setActiveSelection(nextSelection: HunkDiffSelection) {
    if (!activeRepository) {
      return
    }

    setSelections((current) => ({
      ...current,
      [activeRepository.id]: nextSelection,
    }))
  }

  function showOpenRepositoryPrompt() {
    setRepositoryPathInput("")
    setSelectedPathSuggestionIndex(0)
    setOpenPromptError("")
    setStatus(undefined)
    setThemePickerVisible(false)
    setOpenPromptVisible(true)
  }

  function cancelOpenRepositoryPrompt() {
    setOpenPromptVisible(false)
    setRepositoryPathInput("")
    setSelectedPathSuggestionIndex(0)
    setOpenPromptError("")
  }

  function updateRepositoryPathInput(value: string) {
    setRepositoryPathInput(value)
    setSelectedPathSuggestionIndex(0)
    setOpenPromptError("")
  }

  function completeSelectedPathSuggestion() {
    const suggestion = pathSuggestions[normalizedPathSuggestionIndex]
    if (!suggestion) {
      return
    }

    updateRepositoryPathInput(suggestion.value)
  }

  function movePathSuggestion(delta: number) {
    if (pathSuggestions.length === 0) {
      return
    }

    setSelectedPathSuggestionIndex((currentIndex) => {
      const nextIndex = currentIndex + delta
      return (nextIndex + pathSuggestions.length) % pathSuggestions.length
    })
  }

  function selectWorkingChanges(repositoryId: string) {
    setActivePane({
      kind: "working",
      repositoryId,
    })
  }

  function selectPullRequest(repositoryId: string, pullRequest: PullRequestSummary) {
    setActivePane({
      kind: "pull-request",
      pullRequestNumber: pullRequest.number,
      repositoryId,
    })
  }

  function openPullRequestUrl(url: string) {
    const message = openExternalUrl(url)
    setStatus({
      text: message ?? "Opening pull request in browser.",
    })
  }

  function submitOpenRepository(input: string) {
    const directory = input.trim()
    if (!directory) {
      setOpenPromptError("Enter a git repository path.")
      return
    }

    let nextRepository: RepositoryView
    try {
      nextRepository = openGitRepository(directory, staged)
    } catch (error) {
      setOpenPromptError(error instanceof Error ? error.message : String(error))
      return
    }

    const existingRepository = repositories.find((repository) => repository.path === nextRepository.path)
    if (existingRepository) {
      selectWorkingChanges(existingRepository.id)
      setOpenPromptVisible(false)
      setRepositoryPathInput("")
      setOpenPromptError("")
      setStatus({ text: `Repository already open: ${existingRepository.name}.` })
      return
    }

    const nextRepositories = [...repositories, nextRepository]
    setRepositories(nextRepositories)
    persistWorkspaceRepositories(nextRepositories)
    setSelections((currentSelections) => ({
      ...currentSelections,
      [nextRepository.id]: defaultSelection(nextRepository.files),
    }))
    selectWorkingChanges(nextRepository.id)
    setOpenPromptVisible(false)
    setRepositoryPathInput("")
    setOpenPromptError("")
    setStatus({ text: `Opened ${nextRepository.name}.` })
  }

  function closeRepository(repositoryId: string) {
    const closedRepositoryIndex = repositories.findIndex((repository) => repository.id === repositoryId)
    if (closedRepositoryIndex < 0) {
      return
    }

    const closedRepository = repositories[closedRepositoryIndex]
    if (!closedRepository) {
      return
    }

    const nextRepositories = repositories.filter((repository) => repository.id !== repositoryId)
    const nextActiveRepository = nextRepositories[Math.min(closedRepositoryIndex, nextRepositories.length - 1)]

    setRepositories(nextRepositories)
    persistWorkspaceRepositories(nextRepositories)
    setSelections((currentSelections) => {
      const nextSelections = { ...currentSelections }
      delete nextSelections[repositoryId]
      return nextSelections
    })
    pullRequestLoadIds.current.delete(repositoryId)

    if (activeRepository?.id === repositoryId) {
      selectWorkingChanges(nextActiveRepository?.id ?? "")
    }

    setStatus({
      text:
        nextRepositories.length > 0
          ? `Closed ${closedRepository.name}.`
          : `Closed ${closedRepository.name}. Open another repository with o.`,
    })
  }

  function selectNextRepository() {
    if (repositories.length <= 1) {
      return
    }

    const currentIndex = Math.max(
      0,
      repositories.findIndex((repository) => repository.id === activeRepository?.id),
    )
    const nextRepository = repositories[(currentIndex + 1) % repositories.length]
    if (nextRepository) {
      selectWorkingChanges(nextRepository.id)
    }
  }

  function showThemePicker() {
    setOpenPromptVisible(false)
    setOpenPromptError("")
    themeBeforePicker.current = theme
    setSelectedThemeIndex(getThemeIndex(theme))
    setStatus(undefined)
    setThemePickerVisible(true)
  }

  function cancelThemePicker() {
    const restoredTheme = themeBeforePicker.current ?? theme
    themeBeforePicker.current = undefined
    setTheme(restoredTheme)
    setThemePickerVisible(false)
    setSelectedThemeIndex(getThemeIndex(restoredTheme))
  }

  function moveThemeSelection(delta: number) {
    setSelectedThemeIndex((currentIndex) => {
      const nextIndex = currentIndex + delta
      return (nextIndex + THEME_NAMES.length) % THEME_NAMES.length
    })
  }

  function selectTheme(nextTheme: ThemeName) {
    themeBeforePicker.current = undefined
    setTheme(nextTheme)
    setSelectedThemeIndex(getThemeIndex(nextTheme))
    setThemePickerVisible(false)
    const saved = saveWorkspaceTheme(nextTheme)
    setStatus({
      text: saved ? `Theme saved: ${nextTheme}.` : `Theme changed: ${nextTheme}.`,
    })
  }

  function submitSelectedTheme() {
    const nextTheme = THEME_NAMES[selectedThemeIndex]
    if (nextTheme) {
      selectTheme(nextTheme)
    }
  }

  function persistWorkspaceRepositories(nextRepositories: RepositoryView[]) {
    if (!persistWorkspaces) {
      return
    }

    const workspacePaths = getPersistableWorkspacePaths(nextRepositories)
    const workspacePathKey = workspacePaths.join("\0")
    if (lastSavedWorkspacePathKey.current === workspacePathKey) {
      return
    }

    lastSavedWorkspacePathKey.current = workspacePathKey
    saveWorkspacePaths(workspacePaths)
  }

  useKeyboard((key) => {
    const name = key.name?.toLowerCase() ?? ""
    const sequence = key.sequence?.toLowerCase()
    const isEscape = name === "escape" || sequence === "\x1B"

    if (isOpenPromptVisible) {
      if (isEscape) {
        key.preventDefault()
        cancelOpenRepositoryPrompt()
        return
      }

      if (name === "tab" || sequence === "\t") {
        key.preventDefault()
        completeSelectedPathSuggestion()
        return
      }

      if (name === "up" || name === "kpup") {
        key.preventDefault()
        movePathSuggestion(-1)
        return
      }

      if (name === "down" || name === "kpdown") {
        key.preventDefault()
        movePathSuggestion(1)
        return
      }
      return
    }

    if (isThemePickerVisible) {
      if (isEscape) {
        key.preventDefault()
        cancelThemePicker()
        return
      }

      if (name === "up" || name === "kpup") {
        key.preventDefault()
        moveThemeSelection(-1)
        return
      }

      if (name === "down" || name === "kpdown") {
        key.preventDefault()
        moveThemeSelection(1)
        return
      }

      if (name === "return" || name === "enter" || sequence === "\r") {
        key.preventDefault()
        submitSelectedTheme()
        return
      }
      return
    }

    if (isEscape || name === "q" || sequence === "q") {
      persistWorkspaceRepositories(repositories)
      renderer.destroy()
      return
    }

    if (name === "o" || sequence === "o") {
      showOpenRepositoryPrompt()
      return
    }

    if (name === "t" || sequence === "t") {
      showThemePicker()
      return
    }

    if (name === "tab" || sequence === "\t") {
      selectNextRepository()
    }
  })

  return {
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
  }
}

export type DiffAppController = ReturnType<typeof useDiffAppController>

function getLoadErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === "string" && error) {
    return error
  }

  return fallbackMessage
}
