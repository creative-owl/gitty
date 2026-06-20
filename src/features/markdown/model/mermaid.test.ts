import { describe, expect, test } from "bun:test"
import { MACCHIATO } from "../../../shared/theme"
import { createMermaidRenderState } from "./mermaid"
import type { TerminalImageRow } from "./types"

function renderRowsToText(rows: TerminalImageRow[]) {
  return rows.map((row) => row.runs.map((run) => run.text).join("")).join("\n")
}

describe("Mermaid rendering", () => {
  test("renders flowcharts as readable terminal diagrams", async () => {
    const state = await createMermaidRenderState(
      `flowchart TD
  A[Start] --> B{Review PR?}
  B -->|Yes| C[Render Mermaid]
  B -->|No| D[Show Markdown]
  C --> E[Done]
  D --> E`,
      80,
      MACCHIATO,
    )

    expect(state.status).toBe("rendered")
    if (state.status !== "rendered") {
      return
    }

    const output = renderRowsToText(state.rows)
    expect(output).toContain("Start")
    expect(output).toContain("{ Review PR? }")
    expect(output).toContain("Render Mermaid")
    expect(output).toContain("Show Markdown")
    expect(output).toContain("Done")
    expect(output).toContain("▼")
    expect(output).not.toContain("▀")
  })
})
