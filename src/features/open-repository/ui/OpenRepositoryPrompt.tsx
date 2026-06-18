import { fitText } from "../../../shared/lib/text"
import { MACCHIATO } from "../../../shared/theme"
import { OPEN_REPOSITORY_SUGGESTION_ROWS, type PathSuggestion } from "../model/pathSuggestions"

export function OpenRepositoryPrompt({
  message,
  onCompleteSuggestion,
  onInput,
  onSubmit,
  selectedSuggestionIndex,
  suggestions,
  value,
  width,
}: {
  message?: string
  onCompleteSuggestion: (value: string) => void
  onInput: (value: string) => void
  onSubmit: (value: string) => void
  selectedSuggestionIndex: number
  suggestions: PathSuggestion[]
  value: string
  width: number
}) {
  const contentWidth = Math.max(1, width - 4)
  const emptyRows = Math.max(0, OPEN_REPOSITORY_SUGGESTION_ROWS - suggestions.length)
  const handleSubmit = (submittedValue: unknown) => {
    if (typeof submittedValue === "string") {
      onSubmit(submittedValue)
    }
  }

  return (
    <box
      title="Open Repository"
      style={{
        width,
        height: 4 + OPEN_REPOSITORY_SUGGESTION_ROWS,
        border: true,
        borderStyle: "rounded",
        borderColor: message ? MACCHIATO.red : MACCHIATO.surface2,
        backgroundColor: MACCHIATO.mantle,
        flexDirection: "column",
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <input
        value={value}
        placeholder="Path to git repository"
        focused
        onInput={onInput}
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          backgroundColor: MACCHIATO.base,
        }}
      />
      <box style={{ width: "100%", height: 1 }}>
        <text fg={message ? MACCHIATO.red : MACCHIATO.subtext0}>
          {fitText(message ?? "Tab completes selected, Enter opens.", contentWidth)}
        </text>
      </box>
      {suggestions.map((suggestion, index) => {
        const selected = index === selectedSuggestionIndex
        const label = `${selected ? ">" : " "} ${suggestion.value}${suggestion.isGitRepository ? "  git" : ""}`

        return (
          <box
            key={suggestion.value}
            style={{
              width: "100%",
              height: 1,
              backgroundColor: selected ? MACCHIATO.surface0 : MACCHIATO.mantle,
            }}
            onMouseUp={() => onCompleteSuggestion(suggestion.value)}
          >
            <text fg={selected ? MACCHIATO.mauve : MACCHIATO.text}>{fitText(label, contentWidth)}</text>
          </box>
        )
      })}
      {Array.from({ length: emptyRows }, (_, index) => (
        <box key={`empty-suggestion-${index}`} style={{ width: "100%", height: 1 }} />
      ))}
    </box>
  )
}
