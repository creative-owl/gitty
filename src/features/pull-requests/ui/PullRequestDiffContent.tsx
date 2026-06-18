import { HunkReviewStream, type HunkDiffFile, type HunkDiffSelection, type HunkDiffThemeName } from "hunkdiff/opentui"
import { useEffect, useState } from "react"
import { defaultSelection, normalizeSelection } from "../../diff/model/diff"
import { fitText } from "../../../shared/lib/text"
import { MACCHIATO } from "../../../shared/theme"
import type { PullRequestDiffState } from "../model/types"

const EMPTY_DIFF_FILES: HunkDiffFile[] = []

export function PullRequestDiffContent({
  diffState,
  theme,
  width,
}: {
  diffState?: PullRequestDiffState
  theme: HunkDiffThemeName
  width: number
}) {
  const files = diffState?.status === "loaded" ? diffState.files : EMPTY_DIFF_FILES
  const [selection, setSelection] = useState<HunkDiffSelection>(() => defaultSelection(files))
  const normalizedSelection = normalizeSelection(files, selection)

  useEffect(() => {
    setSelection((currentSelection) => normalizeSelection(files, currentSelection))
  }, [files])

  if (!diffState || diffState.status === "loading") {
    return (
      <box style={{ width: "100%", height: 3, paddingLeft: 1, paddingTop: 1 }}>
        <text fg={MACCHIATO.subtext0}>{fitText("Loading pull request diff...", Math.max(1, width - 2))}</text>
      </box>
    )
  }

  if (diffState.status === "unavailable") {
    return (
      <box style={{ width: "100%", height: 3, paddingLeft: 1, paddingTop: 1 }}>
        <text fg={MACCHIATO.red}>{fitText(diffState.message, Math.max(1, width - 2))}</text>
      </box>
    )
  }

  if (files.length === 0) {
    return (
      <box style={{ width: "100%", height: 3, paddingLeft: 1, paddingTop: 1 }}>
        <text fg={MACCHIATO.subtext0}>{fitText("No diff files in this pull request.", Math.max(1, width - 2))}</text>
      </box>
    )
  }

  return (
    <scrollbox style={{ width: "100%", flexGrow: 1 }} scrollY>
      <HunkReviewStream
        files={files}
        highlight
        layout="split"
        width={width}
        theme={theme}
        selection={normalizedSelection}
        wrapLines
        onSelectionChange={setSelection}
      />
    </scrollbox>
  )
}
