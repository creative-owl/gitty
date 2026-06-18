import { useEffect, useState } from "react"
import { MACCHIATO } from "../../../shared/theme"
import { TextRows } from "../../../shared/ui/TextRows"
import {
  createMermaidRenderState,
  MERMAID_MAX_TERMINAL_ROWS,
  MERMAID_RENDER_BACKGROUND,
} from "../model/mermaid"
import type { MermaidRenderState, TerminalImageRow } from "../model/types"

export function MermaidDiagram({
  content,
  width,
}: {
  content: string
  width: number
}) {
  const contentWidth = Math.max(1, width - 4)
  const [renderState, setRenderState] = useState<MermaidRenderState>({ status: "loading" })

  useEffect(() => {
    let isCancelled = false
    setRenderState({ status: "loading" })

    void createMermaidRenderState(content, contentWidth).then((nextState) => {
      if (!isCancelled) {
        setRenderState(nextState)
      }
    })

    return () => {
      isCancelled = true
    }
  }, [content, contentWidth])

  const height =
    renderState.status === "rendered"
      ? renderState.rows.length + 2
      : renderState.status === "error"
        ? Math.min(renderState.sourceRows.length + 2, MERMAID_MAX_TERMINAL_ROWS + 6)
        : 4
  const borderColor = renderState.status === "error" ? MACCHIATO.yellow : MACCHIATO.surface2

  return (
    <box
      title="Mermaid"
      style={{
        width: "100%",
        height,
        border: true,
        borderStyle: "rounded",
        borderColor,
        backgroundColor: MERMAID_RENDER_BACKGROUND,
        flexDirection: "column",
        marginBottom: 1,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      {renderState.status === "loading" ? (
        <text fg={MACCHIATO.subtext0} bg={MERMAID_RENDER_BACKGROUND} style={{ width: contentWidth, height: 1 }}>
          Rendering Mermaid diagram...
        </text>
      ) : null}
      {renderState.status === "rendered" ? (
        <TerminalImageRows rowKeyPrefix="pull-request-mermaid-row" rows={renderState.rows} width={contentWidth} />
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
  rowKeyPrefix,
  rows,
  width,
}: {
  rowKeyPrefix: string
  rows: TerminalImageRow[]
  width: number
}) {
  return (
    <>
      {rows.map((row, index) => (
        <text
          bg={MERMAID_RENDER_BACKGROUND}
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
