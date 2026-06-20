import type { HunkDiffThemeName } from "hunkdiff/opentui"
import { fitText } from "../../../shared/lib/text"
import { MACCHIATO } from "../../../shared/theme"
import { formatThemeName, THEME_NAMES } from "../model/themes"

const THEME_PICKER_MAX_WIDTH = 42
const THEME_PICKER_MIN_WIDTH = 28

export function ThemePickerPopup({
  currentTheme,
  onSelectTheme,
  selectedThemeIndex,
  top,
  width,
}: {
  currentTheme: HunkDiffThemeName
  onSelectTheme: (theme: HunkDiffThemeName) => void
  selectedThemeIndex: number
  top: number
  width: number
}) {
  const popupWidth = Math.max(1, Math.min(width, Math.max(THEME_PICKER_MIN_WIDTH, THEME_PICKER_MAX_WIDTH)))
  const left = Math.max(0, Math.floor((width - popupWidth) / 2))
  const contentWidth = Math.max(1, popupWidth - 4)

  return (
    <box
      title="Theme"
      style={{
        position: "absolute",
        left,
        top,
        zIndex: 30,
        width: popupWidth,
        height: THEME_NAMES.length + 4,
        border: true,
        borderStyle: "rounded",
        borderColor: MACCHIATO.lavender,
        backgroundColor: MACCHIATO.mantle,
        flexDirection: "column",
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <box style={{ width: "100%", height: 1 }}>
        <text fg={MACCHIATO.subtext0}>{fitText("Up/down selects, Enter applies, Esc closes.", contentWidth)}</text>
      </box>
      <box style={{ width: "100%", height: 1 }} />
      {THEME_NAMES.map((theme, index) => {
        const selected = index === selectedThemeIndex
        const active = theme === currentTheme
        const label = `${selected ? ">" : " "} ${active ? "*" : " "} ${formatThemeName(theme)}`

        return (
          <box
            key={theme}
            style={{
              width: "100%",
              height: 1,
              backgroundColor: selected ? MACCHIATO.surface0 : MACCHIATO.mantle,
            }}
            onMouseUp={() => onSelectTheme(theme)}
          >
            <text fg={selected ? MACCHIATO.mauve : active ? MACCHIATO.lavender : MACCHIATO.text}>
              {fitText(label, contentWidth)}
            </text>
          </box>
        )
      })}
    </box>
  )
}
