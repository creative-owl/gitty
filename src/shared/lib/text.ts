import { MACCHIATO } from "../theme"

export type TextRow = {
  backgroundColor?: string
  color: string
  text: string
}

export function fitText(value: string, width: number) {
  if (width <= 0) {
    return ""
  }
  if (value.length <= width) {
    return value
  }
  if (width <= 1) {
    return value.slice(0, width)
  }
  if (width <= 3) {
    return value.slice(0, width)
  }
  return `${value.slice(0, width - 3)}...`
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

export function wrapText(value: string, width: number) {
  if (width <= 0) {
    return []
  }

  const rows: string[] = []
  for (const rawLine of value.replace(/\r\n/g, "\n").split("\n")) {
    if (!rawLine.trim()) {
      rows.push("")
      continue
    }

    let remaining = rawLine
    while (remaining.length > width) {
      const breakIndex = remaining.lastIndexOf(" ", width)
      const sliceEnd = breakIndex > 0 ? breakIndex : width
      rows.push(remaining.slice(0, sliceEnd).trimEnd())
      remaining = remaining.slice(sliceEnd).trimStart()
    }
    rows.push(remaining)
  }

  return rows
}

export function pushWrappedRows(
  rows: TextRow[],
  text: string,
  width: number,
  color: string = MACCHIATO.text,
  backgroundColor?: string,
) {
  const wrappedRows = wrapText(text, width)
  if (wrappedRows.length === 0) {
    rows.push({ backgroundColor, color, text: "" })
    return
  }

  for (const wrappedRow of wrappedRows) {
    rows.push({ backgroundColor, color, text: wrappedRow })
  }
}
