import { HunkReviewStream, type HunkDiffSelection, type HunkDiffThemeName } from "hunkdiff/opentui"
import { fitText } from "../../../shared/lib/text"
import { MACCHIATO } from "../../../shared/theme"
import type { RepositoryView } from "../../repositories/model/types"

export function GitPane({
  onSelectionChange,
  selection,
  theme,
  width,
  repository,
}: {
  onSelectionChange: (selection: HunkDiffSelection) => void
  selection: HunkDiffSelection
  theme: HunkDiffThemeName
  width: number
  repository?: RepositoryView
}) {
  const files = repository?.files ?? []
  const paneContentWidth = Math.max(1, width - 4)

  return (
    <box
      style={{
        width,
        height: "100%",
        border: true,
        borderStyle: "rounded",
        borderColor: MACCHIATO.surface2,
        backgroundColor: MACCHIATO.mantle,
        flexDirection: "column",
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      {files.length > 0 ? (
        <scrollbox style={{ width: "100%", height: "100%" }} scrollY>
          <HunkReviewStream
            files={files}
            highlight
            layout="split"
            width={paneContentWidth}
            theme={theme}
            selection={selection}
            wrapLines
            onSelectionChange={onSelectionChange}
          />
        </scrollbox>
      ) : (
        <box style={{ width: "100%", height: 3, paddingLeft: 1, paddingTop: 1 }}>
          <text fg={MACCHIATO.subtext0}>
            {fitText(
              repository ? "No working changes in this repository." : "No repository open.",
              Math.max(1, paneContentWidth - 2),
            )}
          </text>
        </box>
      )}
    </box>
  )
}
