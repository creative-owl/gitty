import type { TextRow } from "../lib/text"
import { fitText } from "../lib/text"

export function TextRows({
  rowKeyPrefix,
  rows,
  width,
}: {
  rowKeyPrefix: string
  rows: TextRow[]
  width: number
}) {
  return (
    <>
      {rows.map((row, index) => (
        <box
          key={`${rowKeyPrefix}:${index}`}
          style={{
            width: "100%",
            height: 1,
            backgroundColor: row.backgroundColor,
          }}
        >
          <text fg={row.color}>{fitText(row.text, width)}</text>
        </box>
      ))}
    </>
  )
}
