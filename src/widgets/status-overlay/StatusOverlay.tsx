import { fitText } from "../../shared/lib/text"
import { useAppTheme } from "../../shared/theme"

export type OpenRepositoryStatus = {
  text: string
}

const STATUS_OVERLAY_MAX_WIDTH = 56
const STATUS_OVERLAY_MIN_WIDTH = 24

export function StatusOverlay({
  status,
  width,
}: {
  status?: OpenRepositoryStatus
  width: number
}) {
  const theme = useAppTheme()

  if (!status) {
    return null
  }

  const overlayWidth = Math.max(
    1,
    Math.min(width, Math.min(STATUS_OVERLAY_MAX_WIDTH, Math.max(STATUS_OVERLAY_MIN_WIDTH, status.text.length + 4))),
  )
  const contentWidth = Math.max(1, overlayWidth - 4)

  return (
    <box
      style={{
        position: "absolute",
        right: 1,
        bottom: 1,
        zIndex: 20,
        width: overlayWidth,
        height: 3,
        border: true,
        borderStyle: "rounded",
        borderColor: theme.green,
        backgroundColor: theme.mantle,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <text fg={theme.green}>{fitText(status.text, contentWidth)}</text>
    </box>
  )
}
