import { useEffect, useState } from "react"
import { useAppTheme } from "../../../shared/theme"
import { TextRows } from "../../../shared/ui/TextRows"
import {
  createMermaidRenderState,
  getMermaidRenderBackground,
  MERMAID_MAX_TERMINAL_ROWS,
} from "../model/mermaid"
import type { MermaidRenderState, TerminalImageRow } from "../model/types"

export function MermaidDiagram({
  content,
  width,
}: {
  content: string
  width: number
}) {
  const theme = useAppTheme()
  const contentWidth = Math.max(1, width - 4)
  const background = getMermaidRenderBackground(theme)
  const [renderState, setRenderState] = useState<MermaidRenderState>({ status: "loading" })

  useEffect(() => {
    let isCancelled = false
    setRenderState({ status: "loading" })

    void createMermaidRenderState(content, contentWidth, theme).then((nextState) => {
      if (!isCancelled) {
        setRenderState(nextState)
      }
    })

    return () => {
      isCancelled = true
    }
  }, [content, contentWidth, theme])

  const height =
    renderState.status === "rendered"
      ? renderState.rows.length + 2
      : renderState.status === "error"
        ? Math.min(renderState.sourceRows.length + 2, MERMAID_MAX_TERMINAL_ROWS + 6)
        : 4
  const borderColor = renderState.status === "error" ? theme.yellow : theme.surface2

  return (
    <box
      title="Mermaid"
      style={{
        width: "100%",
        height,
        border: true,
        borderStyle: "rounded",
        borderColor,
        backgroundColor: background,
        flexDirection: "column",
        marginBottom: 1,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      {renderState.status === "loading" ? (
        <text fg={theme.subtext0} bg={background} style={{ width: contentWidth, height: 1 }}>
          Rendering Mermaid diagram...
        </text>
      ) : null}
      {renderState.status === "rendered" ? (
        <TerminalImageRows
          backgroundColor={background}
          rowKeyPrefix="pull-request-mermaid-row"
          rows={renderState.rows}
          width={contentWidth}
        />
      ) : null}
      {renderState.status === "error" ? (
        <>
          <TextRows rowKeyPrefix="pull-request-mermaid-source-row" rows={renderState.sourceRows} width={contentWidth} />
        </>
      ) : null}
    </box>
  )
}

function TerminalImageRows({
  backgroundColor,
  rowKeyPrefix,
  rows,
  width,
}: {
  backgroundColor: string
  rowKeyPrefix: string
  rows: TerminalImageRow[]
  width: number
}) {
  return (
    <>
      {rows.map((row, index) => (
        <text
          bg={backgroundColor}
          key={`${rowKeyPrefix}:${index}`}
          style={{ width, height: 1, flexShrink: 0 }}
        >
          {row.runs.map((run, runIndex) => (
            <span
              bg={run.backgroundColor}
              fg={run.color}
              key={`${rowKeyPrefix}:${index}:${runIndex}`}
            >
              {run.text}
            </span>
          ))}
        </text>
      ))}
    </>
  )
}
