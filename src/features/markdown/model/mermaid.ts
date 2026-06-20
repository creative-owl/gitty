import { pushWrappedRows, type TextRow } from "../../../shared/lib/text"
import type { AppTheme } from "../../../shared/theme"
import type { MermaidDomWindow, MermaidRenderState, RgbColor, SvgBox, TerminalImageRow, TerminalImageRun } from "./types"

export const MERMAID_MAX_TERMINAL_ROWS = 32
const MERMAID_MAX_TERMINAL_WIDTH = 120
const MERMAID_MIN_TERMINAL_WIDTH = 12

let mermaidDomReady = false
let mermaidModulePromise: Promise<typeof import("mermaid")["default"]> | undefined
let mermaidRenderCounter = 0
let mermaidRenderQueue: Promise<void> = Promise.resolve()

const nearestMermaidColorCache = new Map<string, string>()
const mermaidPaletteRgbByTheme = new Map<string, { color: string; rgb: RgbColor }[]>()

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

function createMermaidRenderPalette(theme: AppTheme) {
  return [
    theme.base,
    theme.mantle,
    theme.surface0,
    theme.surface2,
    theme.subtext0,
    theme.text,
    theme.blue,
    theme.green,
    theme.lavender,
    theme.mauve,
    theme.red,
    theme.yellow,
  ] as const
}

function getMermaidPaletteRgb(theme: AppTheme) {
  const cached = mermaidPaletteRgbByTheme.get(theme.id)
  if (cached) {
    return cached
  }

  const palette = createMermaidRenderPalette(theme).map((color) => ({
    color,
    rgb: hexToRgb(color),
  }))
  mermaidPaletteRgbByTheme.set(theme.id, palette)
  return palette
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
  const sharp = (await import("sharp")).default
  const background = getMermaidRenderBackground(theme)
  const targetWidth = Math.max(MERMAID_MIN_TERMINAL_WIDTH, Math.min(width, MERMAID_MAX_TERMINAL_WIDTH))
  const maxPixelHeight = MERMAID_MAX_TERMINAL_ROWS * 2
  const { data, info } = await sharp(Buffer.from(svg))
    .resize({
      fit: "inside",
      height: maxPixelHeight,
      width: targetWidth,
      withoutEnlargement: false,
    })
    .flatten({ background })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  return createTerminalImageRows(data, info.width, info.height, info.channels, width, theme)
}

function createTerminalImageRows(
  data: Buffer,
  imageWidth: number,
  imageHeight: number,
  channels: number,
  renderWidth: number,
  theme: AppTheme,
) {
  const rows: TerminalImageRow[] = []
  const background = getMermaidRenderBackground(theme)
  const leftPadding = Math.max(0, Math.floor((renderWidth - imageWidth) / 2))
  const rightPadding = Math.max(0, renderWidth - imageWidth - leftPadding)

  for (let y = 0; y < imageHeight; y += 2) {
    const runs: TerminalImageRun[] = []
    pushTerminalImageRun(runs, background, background, " ".repeat(leftPadding))

    for (let x = 0; x < imageWidth; x += 1) {
      const topColor = readTerminalPixelColor(data, imageWidth, imageHeight, channels, x, y, theme)
      const bottomColor =
        y + 1 < imageHeight ? readTerminalPixelColor(data, imageWidth, imageHeight, channels, x, y + 1, theme) : background
      const glyph = topColor === background && bottomColor === background ? " " : "▀"
      pushTerminalImageRun(runs, topColor, bottomColor, glyph)
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

function readTerminalPixelColor(
  data: Buffer,
  imageWidth: number,
  imageHeight: number,
  channels: number,
  x: number,
  y: number,
  theme: AppTheme,
) {
  const backgroundColor = getMermaidRenderBackground(theme)
  if (x < 0 || y < 0 || x >= imageWidth || y >= imageHeight) {
    return backgroundColor
  }

  const offset = (y * imageWidth + x) * channels
  const alpha = channels > 3 ? (data[offset + 3] ?? 255) / 255 : 1
  const background = hexToRgb(backgroundColor)
  const color = {
    b: blendChannel(data[offset + 2] ?? background.b, background.b, alpha),
    g: blendChannel(data[offset + 1] ?? background.g, background.g, alpha),
    r: blendChannel(data[offset] ?? background.r, background.r, alpha),
  }

  return findNearestMermaidColor(color, theme)
}

function blendChannel(value: number, background: number, alpha: number) {
  return Math.round(value * alpha + background * (1 - alpha))
}

function findNearestMermaidColor(color: RgbColor, theme: AppTheme) {
  const cacheKey = `${theme.id}:${color.r},${color.g},${color.b}`
  const cached = nearestMermaidColorCache.get(cacheKey)
  if (cached) {
    return cached
  }

  let nearest = getMermaidRenderBackground(theme)
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const entry of getMermaidPaletteRgb(theme)) {
    const distance = (color.r - entry.rgb.r) ** 2 + (color.g - entry.rgb.g) ** 2 + (color.b - entry.rgb.b) ** 2
    if (distance < nearestDistance) {
      nearest = entry.color
      nearestDistance = distance
    }
  }

  nearestMermaidColorCache.set(cacheKey, nearest)
  return nearest
}

function hexToRgb(color: string): RgbColor {
  const normalized = color.replace(/^#/, "")
  return {
    b: Number.parseInt(normalized.slice(4, 6), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    r: Number.parseInt(normalized.slice(0, 2), 16),
  }
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
