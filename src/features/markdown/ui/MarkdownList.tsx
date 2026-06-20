import { useMemo } from "react"
import { fitText } from "../../../shared/lib/text"
import { type AppTheme, useAppTheme } from "../../../shared/theme"
import { createMarkdownSyntaxStyle, createMarkdownTableOptions, MARKDOWN_LIST_INDENT_WIDTH } from "../model/constants"
import type { MarkdownListBlock, MarkdownListItem } from "../model/types"

export function MarkdownListBlockView({
  backgroundColor,
  block,
  blockKeyPrefix,
  depth = 0,
  width,
}: {
  backgroundColor: string
  block: MarkdownListBlock
  blockKeyPrefix: string
  depth?: number
  width: number
}) {
  const theme = useAppTheme()
  const markerWidth = getMarkdownListMarkerWidth(block)

  return (
    <box
      style={{
        width: "100%",
        backgroundColor,
        flexDirection: "column",
        flexShrink: 0,
        marginBottom: depth === 0 ? 1 : 0,
      }}
    >
      {block.items.map((item, index) => {
        const marker = createMarkdownListMarker(block, item, index)
        return (
          <MarkdownListItemView
            backgroundColor={backgroundColor}
            blockKeyPrefix={`${blockKeyPrefix}:${index}`}
            depth={depth}
            item={item}
            key={`${blockKeyPrefix}:${index}`}
            marker={marker}
            markerWidth={markerWidth}
            theme={theme}
            width={width}
          />
        )
      })}
    </box>
  )
}

function MarkdownListItemView({
  backgroundColor,
  blockKeyPrefix,
  depth,
  item,
  marker,
  markerWidth,
  theme,
  width,
}: {
  backgroundColor: string
  blockKeyPrefix: string
  depth: number
  item: MarkdownListItem
  marker: string
  markerWidth: number
  theme: AppTheme
  width: number
}) {
  const syntaxStyle = useMemo(() => createMarkdownSyntaxStyle(theme), [theme])
  const tableOptions = useMemo(() => createMarkdownTableOptions(theme), [theme])
  const indentWidth = depth * MARKDOWN_LIST_INDENT_WIDTH
  const markerColumnWidth = Math.min(Math.max(1, indentWidth + markerWidth + 1), Math.max(1, width - 1))
  const contentWidth = Math.max(1, width - markerColumnWidth)
  const markerText = `${" ".repeat(indentWidth)}${marker.padStart(markerWidth)} `

  return (
    <box
      style={{
        width: "100%",
        backgroundColor,
        flexDirection: "row",
        flexShrink: 0,
      }}
    >
      <text
        fg={getMarkdownListMarkerColor(item, theme)}
        bg={backgroundColor}
        style={{ width: markerColumnWidth, height: 1, flexShrink: 0 }}
      >
        {fitText(markerText, markerColumnWidth)}
      </text>
      <box
        style={{
          width: contentWidth,
          backgroundColor,
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        {item.content ? (
          <markdown
            bg={backgroundColor}
            conceal
            content={item.content}
            fg={theme.text}
            internalBlockMode="coalesced"
            syntaxStyle={syntaxStyle}
            tableOptions={tableOptions}
            style={{
              width: "100%",
              flexShrink: 0,
            }}
          />
        ) : (
          <text bg={backgroundColor} style={{ width: "100%", height: 1, flexShrink: 0 }}>
            {" "}
          </text>
        )}
        {item.children.map((child, index) => (
          <MarkdownListBlockView
            backgroundColor={backgroundColor}
            block={child}
            blockKeyPrefix={`${blockKeyPrefix}:child:${index}`}
            depth={depth + 1}
            key={`${blockKeyPrefix}:child:${index}`}
            width={contentWidth}
          />
        ))}
      </box>
    </box>
  )
}

function getMarkdownListMarkerWidth(block: MarkdownListBlock) {
  if (!block.ordered) {
    return block.items.some((item) => item.task) ? 3 : 1
  }

  const lastNumber = block.start + Math.max(0, block.items.length - 1)
  return `${lastNumber}.`.length
}

function createMarkdownListMarker(block: MarkdownListBlock, item: MarkdownListItem, index: number) {
  if (item.task) {
    return item.checked ? "[x]" : "[ ]"
  }

  return block.ordered ? `${block.start + index}.` : "-"
}

function getMarkdownListMarkerColor(item: MarkdownListItem, theme: AppTheme) {
  if (!item.task) {
    return theme.subtext0
  }

  return item.checked ? theme.green : theme.yellow
}
