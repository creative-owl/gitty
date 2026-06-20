import { fitText, pushWrappedRows, type TextRow } from "../../../shared/lib/text"
import type { AppTheme } from "../../../shared/theme"
import type { MermaidDomWindow, MermaidRenderState, SvgBox, TerminalImageRow, TerminalImageRun } from "./types"

export const MERMAID_MAX_TERMINAL_ROWS = 32
const MERMAID_MAX_TERMINAL_WIDTH = 120
const MERMAID_MIN_TERMINAL_WIDTH = 12

let mermaidDomReady = false
let mermaidModulePromise: Promise<typeof import("mermaid")["default"]> | undefined
let mermaidRenderCounter = 0
let mermaidRenderQueue: Promise<void> = Promise.resolve()

export function getMermaidRenderBackground(theme: AppTheme) {
  return theme.surface0
}

export async function createMermaidRenderState(code: string, width: number, theme: AppTheme): Promise<MermaidRenderState> {
  const firstLine = getMermaidFirstLine(code)
  try {
    const svg = await renderMermaidSvg(code, theme)
    const rows = await renderMermaidSvgToTerminalRows(svg, width, theme)
    if (rows.length === 0) {
      throw new Error("Mermaid returned an empty diagram.")
    }

    return { rows, status: "rendered" }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to render Mermaid diagram."
    return {
      message,
      sourceRows: createMermaidSourceRows(code, firstLine, width, message, theme),
      status: "error",
    }
  }
}

function getMermaidFirstLine(code: string) {
  return code
    .replace(/\r\n/g, "\n")
    .split("\n")
    .find((line) => line.trim() && !line.trim().startsWith("%%"))
    ?.trim() ?? ""
}

async function renderMermaidSvg(code: string, theme: AppTheme) {
  const renderTask = mermaidRenderQueue.then(async () => {
    const mermaid = await getMermaidRenderer(theme)
    const id = `gitty-mermaid-${hashString(code)}-${mermaidRenderCounter++}`
    const { svg } = await mermaid.render(id, code)
    if (!svg.trim()) {
      throw new Error("Mermaid returned an empty SVG.")
    }
    return svg
  })

  mermaidRenderQueue = renderTask.then(
    () => undefined,
    () => undefined,
  )

  return renderTask
}

async function getMermaidRenderer(theme: AppTheme) {
  await ensureMermaidDom()
  mermaidModulePromise ??= import("mermaid").then(({ default: mermaid }) => mermaid)
  const mermaid = await mermaidModulePromise

  mermaid.initialize({
    deterministicIds: true,
    flowchart: { htmlLabels: false },
    fontFamily: "monospace",
    securityLevel: "strict",
    startOnLoad: false,
    theme: "base",
    themeVariables: {
      background: getMermaidRenderBackground(theme),
      edgeLabelBackground: theme.surface0,
      fontFamily: "monospace",
      lineColor: theme.subtext0,
      mainBkg: theme.surface2,
      nodeBorder: theme.mauve,
      primaryBorderColor: theme.mauve,
      primaryColor: theme.surface0,
      primaryTextColor: theme.text,
      secondaryColor: theme.base,
      tertiaryColor: theme.mantle,
    },
  })

  return mermaid
}

async function ensureMermaidDom() {
  if (mermaidDomReady) {
    return
  }

  const { JSDOM } = await import("jsdom")
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true })
  const window = dom.window as unknown as MermaidDomWindow
  Object.assign(globalThis, {
    CSSStyleSheet: window.CSSStyleSheet,
    Element: window.Element,
    HTMLElement: window.HTMLElement,
    SVGElement: window.SVGElement,
    document: window.document,
    navigator: window.navigator,
    window,
  })
  installMermaidSvgMeasurementPolyfill(window)
  mermaidDomReady = true
}

function installMermaidSvgMeasurementPolyfill(window: MermaidDomWindow) {
  const svgPrototype = window.SVGElement.prototype as SVGElement & {
    getBBox?: () => SvgBox
    getComputedTextLength?: () => number
  }

  svgPrototype.getBBox = function getBBox(this: SVGElement) {
    return getSvgElementBox(this)
  }
  svgPrototype.getComputedTextLength = function getComputedTextLength(this: SVGElement) {
    return measureSvgText(this).width
  }
}

function getSvgElementBox(element: Element): SvgBox {
  const tagName = element.tagName.toLowerCase()

  if (tagName === "text" || tagName === "tspan") {
    const size = measureSvgText(element)
    return applySvgTranslate(element, createSvgBox(readSvgNumber(element, "x"), readSvgNumber(element, "y") - size.height, size.width, size.height))
  }

  if (tagName === "rect" || tagName === "image" || tagName === "foreignobject") {
    const textSize = measureSvgText(element)
    return applySvgTranslate(
      element,
      createSvgBox(
        readSvgNumber(element, "x"),
        readSvgNumber(element, "y"),
        readSvgNumber(element, "width", textSize.width),
        readSvgNumber(element, "height", textSize.height),
      ),
    )
  }

  if (tagName === "circle") {
    const radius = readSvgNumber(element, "r")
    return applySvgTranslate(
      element,
      createSvgBox(readSvgNumber(element, "cx") - radius, readSvgNumber(element, "cy") - radius, radius * 2, radius * 2),
    )
  }

  if (tagName === "ellipse") {
    const radiusX = readSvgNumber(element, "rx")
    const radiusY = readSvgNumber(element, "ry")
    return applySvgTranslate(
      element,
      createSvgBox(readSvgNumber(element, "cx") - radiusX, readSvgNumber(element, "cy") - radiusY, radiusX * 2, radiusY * 2),
    )
  }

  if (tagName === "line") {
    const x1 = readSvgNumber(element, "x1")
    const y1 = readSvgNumber(element, "y1")
    const x2 = readSvgNumber(element, "x2")
    const y2 = readSvgNumber(element, "y2")
    return applySvgTranslate(element, createSvgBox(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)))
  }

  if (tagName === "polygon" || tagName === "polyline") {
    return applySvgTranslate(element, getSvgPointsBox(element.getAttribute("points") ?? ""))
  }

  return applySvgTranslate(element, mergeSvgBoxes(Array.from(element.children).map((child) => getSvgElementBox(child))))
}

function measureSvgText(element: Element) {
  const text = (element.textContent ?? "").replace(/\s+/g, " ").trim()
  const fontSize = readSvgNumber(element, "font-size", 16)
  const lines = text.split("\n").filter(Boolean)
  const longestLineLength = Math.max(1, ...lines.map((line) => line.length))

  return {
    height: Math.max(16, Math.max(1, lines.length) * fontSize * 1.2),
    width: Math.max(16, longestLineLength * fontSize * 0.58),
  }
}

function getSvgPointsBox(points: string) {
  const values = [...points.matchAll(/(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/g)].map((match) => ({
    x: Number.parseFloat(match[1] ?? "0"),
    y: Number.parseFloat(match[2] ?? "0"),
  }))

  if (values.length === 0) {
    return createSvgBox()
  }

  const left = Math.min(...values.map((point) => point.x))
  const right = Math.max(...values.map((point) => point.x))
  const top = Math.min(...values.map((point) => point.y))
  const bottom = Math.max(...values.map((point) => point.y))
  return createSvgBox(left, top, right - left, bottom - top)
}

function applySvgTranslate(element: Element, box: SvgBox) {
  const translateMatch = /translate\(\s*(-?\d+(?:\.\d+)?)(?:[ ,]+(-?\d+(?:\.\d+)?))?\s*\)/.exec(
    element.getAttribute("transform") ?? "",
  )
  if (!translateMatch) {
    return box
  }

  const x = Number.parseFloat(translateMatch[1] ?? "0")
  const y = Number.parseFloat(translateMatch[2] ?? "0")
  return createSvgBox(box.x + x, box.y + y, box.width, box.height)
}

function mergeSvgBoxes(boxes: SvgBox[]) {
  const visibleBoxes = boxes.filter((box) => box.width > 0 || box.height > 0)
  if (visibleBoxes.length === 0) {
    return createSvgBox()
  }

  const left = Math.min(...visibleBoxes.map((box) => box.x))
  const right = Math.max(...visibleBoxes.map((box) => box.x + box.width))
  const top = Math.min(...visibleBoxes.map((box) => box.y))
  const bottom = Math.max(...visibleBoxes.map((box) => box.y + box.height))
  return createSvgBox(left, top, right - left, bottom - top)
}

function createSvgBox(x = 0, y = 0, width = 0, height = 0): SvgBox {
  return {
    bottom: y + height,
    height,
    left: x,
    right: x + width,
    top: y,
    width,
    x,
    y,
  }
}

function readSvgNumber(element: Element, name: string, fallback = 0) {
  const value = Number.parseFloat(element.getAttribute(name) ?? "")
  return Number.isFinite(value) ? value : fallback
}

async function renderMermaidSvgToTerminalRows(svg: string, width: number, theme: AppTheme) {
  const targetWidth = Math.max(MERMAID_MIN_TERMINAL_WIDTH, Math.min(width, MERMAID_MAX_TERMINAL_WIDTH))
  const rows = await renderFlowchartSvgToTerminalRows(svg, targetWidth, width, theme)
  if (rows.length === 0) {
    throw new Error("This Mermaid diagram type is not supported by the terminal renderer.")
  }

  return rows
}

type TerminalDiagramCell = {
  color: string
  text: string
}

type TerminalDiagramPoint = {
  x: number
  y: number
}

type TerminalDiagramBox = SvgBox & {
  centerX: number
  centerY: number
}

type TerminalDiagramNode = {
  box: TerminalDiagramBox
  shape: "box" | "decision"
  text: string
}

type TerminalDiagramEdge = {
  label?: TerminalDiagramLabel
  points: TerminalDiagramPoint[]
}

type TerminalDiagramLabel = TerminalDiagramPoint & {
  text: string
}

async function renderFlowchartSvgToTerminalRows(
  svg: string,
  targetWidth: number,
  renderWidth: number,
  theme: AppTheme,
) {
  const { JSDOM } = await import("jsdom")
  const document = new JSDOM(svg, { contentType: "image/svg+xml" }).window.document
  const root = document.querySelector("svg")
  if (!root?.classList.contains("flowchart")) {
    return []
  }

  const nodes = collectTerminalDiagramNodes(document)
  const edges = collectTerminalDiagramEdges(document)
  if (nodes.length === 0) {
    return []
  }

  return createTerminalDiagramRows(nodes, edges, targetWidth, renderWidth, theme)
}

function collectTerminalDiagramNodes(document: Document) {
  const nodes: TerminalDiagramNode[] = []
  for (const node of document.querySelectorAll("g.node")) {
    const text = normalizeSvgText(node.textContent ?? "")
    const shapeElement = node.querySelector("rect, polygon, circle, ellipse, path")
    if (!text || !shapeElement) {
      continue
    }

    const groupTranslate = parseSvgTranslate(node.getAttribute("transform"))
    const shapeTranslate = parseSvgTranslate(shapeElement.getAttribute("transform"))
    const shapeBox = getSvgShapeBox(shapeElement)
    const box = createTerminalDiagramBox(
      groupTranslate.x + shapeTranslate.x + shapeBox.x,
      groupTranslate.y + shapeTranslate.y + shapeBox.y,
      shapeBox.width,
      shapeBox.height,
    )

    nodes.push({
      box,
      shape: shapeElement.tagName.toLowerCase() === "polygon" ? "decision" : "box",
      text,
    })
  }

  return nodes
}

function getSvgShapeBox(element: Element) {
  const tagName = element.tagName.toLowerCase()
  if (tagName === "rect" || tagName === "image" || tagName === "foreignobject" || tagName === "path") {
    return createSvgBox(
      readSvgNumber(element, "x"),
      readSvgNumber(element, "y"),
      readSvgNumber(element, "width", 60),
      readSvgNumber(element, "height", 30),
    )
  }

  if (tagName === "circle") {
    const radius = readSvgNumber(element, "r")
    return createSvgBox(readSvgNumber(element, "cx") - radius, readSvgNumber(element, "cy") - radius, radius * 2, radius * 2)
  }

  if (tagName === "ellipse") {
    const radiusX = readSvgNumber(element, "rx")
    const radiusY = readSvgNumber(element, "ry")
    return createSvgBox(
      readSvgNumber(element, "cx") - radiusX,
      readSvgNumber(element, "cy") - radiusY,
      radiusX * 2,
      radiusY * 2,
    )
  }

  if (tagName === "polygon" || tagName === "polyline") {
    return getSvgPointsBox(element.getAttribute("points") ?? "")
  }

  return createSvgBox()
}

function collectTerminalDiagramEdges(document: Document) {
  const labels = collectTerminalDiagramLabels(document)
  const edges: TerminalDiagramEdge[] = []

  for (const edge of document.querySelectorAll("path.flowchart-link[data-edge='true']")) {
    const points = readTerminalDiagramEdgePoints(edge)
    if (points.length < 2) {
      continue
    }

    const edgeId = edge.getAttribute("data-id") ?? edge.id
    edges.push({
      label: labels.get(edgeId),
      points,
    })
  }

  return edges
}

function collectTerminalDiagramLabels(document: Document) {
  const labels = new Map<string, TerminalDiagramLabel>()
  for (const label of document.querySelectorAll("g.edgeLabel")) {
    const labelGroup = label.querySelector(".label[data-id]")
    const text = normalizeSvgText(labelGroup?.textContent ?? "")
    const id = labelGroup?.getAttribute("data-id")
    if (!id || !text) {
      continue
    }

    const position = parseSvgTranslate(label.getAttribute("transform"))
    labels.set(id, { text, x: position.x, y: position.y })
  }

  return labels
}

function readTerminalDiagramEdgePoints(edge: Element) {
  const encodedPoints = edge.getAttribute("data-points")
  if (encodedPoints) {
    try {
      const decoded = JSON.parse(Buffer.from(encodedPoints, "base64").toString("utf8")) as TerminalDiagramPoint[]
      const points = decoded.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
      if (points.length >= 2) {
        return points
      }
    } catch {
      // Fall back to the path data below.
    }
  }

  return [...(edge.getAttribute("d") ?? "").matchAll(/[MLC]\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/g)].map(
    (match) => ({
      x: Number.parseFloat(match[1] ?? "0"),
      y: Number.parseFloat(match[2] ?? "0"),
    }),
  )
}

function createTerminalDiagramRows(
  nodes: TerminalDiagramNode[],
  edges: TerminalDiagramEdge[],
  targetWidth: number,
  renderWidth: number,
  theme: AppTheme,
) {
  const bounds = createTerminalDiagramBounds(nodes, edges)
  if (bounds.width <= 0 || bounds.height <= 0) {
    return []
  }

  const background = getMermaidRenderBackground(theme)
  const gridHeight = MERMAID_MAX_TERMINAL_ROWS
  const grid = createTerminalDiagramGrid(targetWidth, gridHeight, background)
  const scaleX = (targetWidth - 1) / Math.max(1, bounds.width)
  const scaleY = (gridHeight - 1) / Math.max(1, bounds.height)
  const project = (point: TerminalDiagramPoint) => ({
    x: clamp(Math.round((point.x - bounds.x) * scaleX), 0, targetWidth - 1),
    y: clamp(Math.round((point.y - bounds.y) * scaleY), 0, gridHeight - 1),
  })
  const arrowheads: { direction: TerminalDiagramPoint; point: TerminalDiagramPoint }[] = []

  for (const edge of edges) {
    const projectedPoints = edge.points.map(project)
    for (let index = 0; index < projectedPoints.length - 1; index += 1) {
      drawTerminalDiagramLine(grid, projectedPoints[index]!, projectedPoints[index + 1]!, theme.subtext0)
    }

    const lastPoint = projectedPoints.at(-1)
    const originalLastPoint = edge.points.at(-1)
    const originalPreviousPoint = edge.points.at(-2)
    if (lastPoint && originalLastPoint && originalPreviousPoint) {
      arrowheads.push({
        direction: { x: originalLastPoint.x - originalPreviousPoint.x, y: originalLastPoint.y - originalPreviousPoint.y },
        point: lastPoint,
      })
    }
  }

  for (const node of nodes) {
    drawTerminalDiagramNode(grid, node, project({ x: node.box.centerX, y: node.box.centerY }), scaleX, theme)
  }

  for (const edge of edges) {
    if (edge.label) {
      const position = project(edge.label)
      const label = ` ${edge.label.text} `
      drawTerminalDiagramText(grid, position.x - Math.floor(label.length / 2), position.y, label, theme.yellow)
    }
  }

  for (const arrowhead of arrowheads) {
    drawTerminalDiagramArrowhead(grid, arrowhead.point, arrowhead.direction, theme.subtext0)
  }

  return createTerminalDiagramRowsFromGrid(trimTerminalDiagramGrid(grid), renderWidth, background)
}

function createTerminalDiagramBounds(nodes: TerminalDiagramNode[], edges: TerminalDiagramEdge[]) {
  const boxes = nodes.map((node) => node.box)
  const points = edges.flatMap((edge) => [...edge.points, ...(edge.label ? [edge.label] : [])])
  const left = Math.min(...boxes.map((box) => box.left), ...points.map((point) => point.x))
  const right = Math.max(...boxes.map((box) => box.right), ...points.map((point) => point.x))
  const top = Math.min(...boxes.map((box) => box.top), ...points.map((point) => point.y))
  const bottom = Math.max(...boxes.map((box) => box.bottom), ...points.map((point) => point.y))
  const paddingX = Math.max(16, (right - left) * 0.08)
  const paddingY = Math.max(16, (bottom - top) * 0.06)

  return createSvgBox(left - paddingX, top - paddingY, right - left + paddingX * 2, bottom - top + paddingY * 2)
}

function createTerminalDiagramGrid(width: number, height: number, background: string): TerminalDiagramCell[][] {
  return Array.from({ length: height }, () =>
    Array.from({ length: width }, (): TerminalDiagramCell => ({
      color: background,
      text: " ",
    })),
  )
}

function drawTerminalDiagramNode(
  grid: TerminalDiagramCell[][],
  node: TerminalDiagramNode,
  center: TerminalDiagramPoint,
  scaleX: number,
  theme: AppTheme,
) {
  const label = node.shape === "decision" ? `{ ${node.text} }` : node.text
  const minimumWidth = Math.min(grid[0]?.length ?? 0, Math.max(6, label.length + 4))
  const boxWidth = clamp(Math.round(node.box.width * scaleX), minimumWidth, grid[0]?.length ?? minimumWidth)
  const left = clamp(center.x - Math.floor(boxWidth / 2), 0, Math.max(0, (grid[0]?.length ?? boxWidth) - boxWidth))
  const top = clamp(center.y - 1, 0, Math.max(0, grid.length - 3))
  const right = left + boxWidth - 1
  const bottom = top + 2

  drawTerminalDiagramText(grid, left, top, `┌${"─".repeat(Math.max(0, boxWidth - 2))}┐`, theme.mauve)
  drawTerminalDiagramText(grid, left, bottom, `└${"─".repeat(Math.max(0, boxWidth - 2))}┘`, theme.mauve)
  putTerminalDiagramCell(grid, left, top + 1, "│", theme.mauve, true)
  putTerminalDiagramCell(grid, right, top + 1, "│", theme.mauve, true)

  const fittedLabel = fitText(label, Math.max(1, boxWidth - 2))
  const labelLeft = left + Math.max(1, Math.floor((boxWidth - fittedLabel.length) / 2))
  drawTerminalDiagramText(grid, labelLeft, top + 1, fittedLabel, theme.text)
}

function drawTerminalDiagramLine(
  grid: TerminalDiagramCell[][],
  from: TerminalDiagramPoint,
  to: TerminalDiagramPoint,
  color: string,
) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1)
  const glyph = getTerminalDiagramLineGlyph(dx, dy)

  for (let step = 0; step <= steps; step += 1) {
    const x = Math.round(from.x + (dx * step) / steps)
    const y = Math.round(from.y + (dy * step) / steps)
    putTerminalDiagramCell(grid, x, y, glyph, color)
  }
}

function getTerminalDiagramLineGlyph(dx: number, dy: number) {
  if (Math.abs(dx) > Math.abs(dy) * 2) {
    return "─"
  }
  if (Math.abs(dy) > Math.abs(dx) * 2) {
    return "│"
  }
  return dx * dy >= 0 ? "╲" : "╱"
}

function drawTerminalDiagramArrowhead(
  grid: TerminalDiagramCell[][],
  point: TerminalDiagramPoint,
  direction: TerminalDiagramPoint,
  color: string,
) {
  const x = point.x - Math.sign(direction.x)
  const y = point.y - Math.sign(direction.y)
  const isMostlyVertical = Math.abs(direction.y) >= Math.abs(direction.x) * 0.5
  const glyph =
    isMostlyVertical
      ? direction.y >= 0
        ? "▼"
        : "▲"
      : direction.x >= 0
        ? "▶"
        : "◀"
  putTerminalDiagramCell(grid, x, y, glyph, color, true)
}

function drawTerminalDiagramText(grid: TerminalDiagramCell[][], x: number, y: number, text: string, color: string) {
  for (let offset = 0; offset < text.length; offset += 1) {
    putTerminalDiagramCell(grid, x + offset, y, text[offset] ?? " ", color, true)
  }
}

function putTerminalDiagramCell(
  grid: TerminalDiagramCell[][],
  x: number,
  y: number,
  text: string,
  color: string,
  overwrite = false,
) {
  const row = grid[y]
  if (!row || x < 0 || x >= row.length) {
    return
  }

  const cell = row[x]
  if (!cell) {
    return
  }

  if (!overwrite && cell.text !== " " && cell.text !== text) {
    cell.text = "┼"
    cell.color = color
    return
  }

  cell.text = text
  cell.color = color
}

function trimTerminalDiagramGrid(grid: TerminalDiagramCell[][]) {
  let firstRow = 0
  let lastRow = grid.length - 1

  while (firstRow <= lastRow && isTerminalDiagramBlankRow(grid[firstRow]!)) {
    firstRow += 1
  }
  while (lastRow >= firstRow && isTerminalDiagramBlankRow(grid[lastRow]!)) {
    lastRow -= 1
  }

  return firstRow <= lastRow ? grid.slice(firstRow, lastRow + 1) : []
}

function isTerminalDiagramBlankRow(row: TerminalDiagramCell[]) {
  return row.every((cell) => cell.text === " ")
}

function createTerminalDiagramRowsFromGrid(grid: TerminalDiagramCell[][], renderWidth: number, background: string) {
  const rows: TerminalImageRow[] = []
  const gridWidth = grid[0]?.length ?? 0
  const leftPadding = Math.max(0, Math.floor((renderWidth - gridWidth) / 2))
  const rightPadding = Math.max(0, renderWidth - gridWidth - leftPadding)

  for (const gridRow of grid) {
    const runs: TerminalImageRun[] = []
    pushTerminalImageRun(runs, background, background, " ".repeat(leftPadding))
    for (const cell of gridRow) {
      pushTerminalImageRun(runs, cell.color, background, cell.text)
    }
    pushTerminalImageRun(runs, background, background, " ".repeat(rightPadding))
    rows.push({ runs })
  }

  return rows
}

function pushTerminalImageRun(runs: TerminalImageRun[], color: string, backgroundColor: string, text: string) {
  if (!text) {
    return
  }

  const previous = runs.at(-1)
  if (previous && previous.color === color && previous.backgroundColor === backgroundColor) {
    previous.text += text
    return
  }

  runs.push({ backgroundColor, color, text })
}

function createTerminalDiagramBox(x: number, y: number, width: number, height: number): TerminalDiagramBox {
  return {
    ...createSvgBox(x, y, width, height),
    centerX: x + width / 2,
    centerY: y + height / 2,
  }
}

function normalizeSvgText(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function parseSvgTranslate(value: string | null): TerminalDiagramPoint {
  const translateMatch = /translate\(\s*(-?\d+(?:\.\d+)?)(?:[ ,]+(-?\d+(?:\.\d+)?))?\s*\)/.exec(value ?? "")
  if (!translateMatch) {
    return { x: 0, y: 0 }
  }

  return {
    x: Number.parseFloat(translateMatch[1] ?? "0"),
    y: Number.parseFloat(translateMatch[2] ?? "0"),
  }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
}

function createMermaidSourceRows(
  code: string,
  firstLine: string,
  width: number,
  message: string,
  theme: AppTheme,
): TextRow[] {
  const background = getMermaidRenderBackground(theme)
  const rows: TextRow[] = [
    { backgroundColor: background, color: theme.mauve, text: formatMermaidTitle(firstLine) },
    {
      backgroundColor: background,
      color: theme.yellow,
      text: message,
    },
  ]

  for (const line of code.replace(/\r\n/g, "\n").split("\n")) {
    pushWrappedRows(rows, line || " ", width, theme.text, background)
  }

  return rows
}

function formatMermaidTitle(firstLine: string) {
  const flowchartMatch = /^(graph|flowchart)\s+([a-z]+)/i.exec(firstLine.trim())
  if (flowchartMatch) {
    return `Mermaid ${flowchartMatch[1]?.toLowerCase()} ${flowchartMatch[2]?.toUpperCase()}`
  }

  const diagramMatch = /^([a-z]+Diagram)\b/i.exec(firstLine.trim())
  if (diagramMatch) {
    return `Mermaid ${splitCamelCase(diagramMatch[1] ?? "diagram")}`
  }

  return "Mermaid diagram"
}

function splitCamelCase(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()
}

function hashString(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(36)
}
