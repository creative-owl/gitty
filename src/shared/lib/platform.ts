import type { CliRenderer } from "@opentui/core"
import { pluralize } from "./text"

export type ClipboardCopyResult =
  | {
      method: string
      ok: true
    }
  | {
      message: string
      ok: false
    }

type ClipboardCommand = {
  command: string[]
  method: string
}

export function openExternalUrl(url: string): string | undefined {
  const trimmedUrl = url.trim()
  if (!/^https?:\/\//i.test(trimmedUrl)) {
    return "No browser URL available for this PR."
  }

  const command = createExternalUrlCommand(trimmedUrl)
  if (!command) {
    return "Opening URLs is not supported on this platform."
  }

  try {
    const result = Bun.spawnSync(command, {
      stderr: "pipe",
      stdin: "ignore",
      stdout: "ignore",
    })

    if (result.exitCode === 0) {
      return undefined
    }

    return result.stderr.toString().trim().split("\n").find(Boolean) || "Could not open PR URL."
  } catch {
    return "Could not open PR URL."
  }
}

function createExternalUrlCommand(url: string): string[] | undefined {
  if (process.platform === "darwin") {
    return ["open", url]
  }

  if (process.platform === "win32") {
    return ["cmd.exe", "/c", "start", "", url]
  }

  if (process.platform === "linux") {
    return ["xdg-open", url]
  }

  return undefined
}

export function copyTextToClipboard(renderer: CliRenderer, text: string): ClipboardCopyResult {
  if (!text) {
    return {
      message: "No selected text to copy.",
      ok: false,
    }
  }

  try {
    if (renderer.copyToClipboardOSC52(text)) {
      return {
        method: "terminal clipboard",
        ok: true,
      }
    }
  } catch {
    // Fall back to platform clipboard helpers below.
  }

  const clipboardCommand = createClipboardCommand()
  if (!clipboardCommand) {
    return {
      message: "Clipboard copy is not supported on this platform.",
      ok: false,
    }
  }

  try {
    const result = Bun.spawnSync(clipboardCommand.command, {
      stderr: "pipe",
      stdin: new TextEncoder().encode(text),
      stdout: "ignore",
    })

    if (result.exitCode === 0) {
      return {
        method: clipboardCommand.method,
        ok: true,
      }
    }

    const detail = result.stderr.toString().trim().split("\n").find(Boolean)
    return {
      message: detail ? `Clipboard copy failed: ${detail}` : "Clipboard copy failed.",
      ok: false,
    }
  } catch {
    return {
      message: "Clipboard copy failed.",
      ok: false,
    }
  }
}

function createClipboardCommand(): ClipboardCommand | undefined {
  if (process.platform === "darwin") {
    return findClipboardCommand([{ command: ["pbcopy"], method: "pbcopy" }])
  }

  if (process.platform === "win32") {
    return findClipboardCommand([
      { command: ["clip.exe"], method: "clip.exe" },
      { command: ["powershell.exe", "-NoProfile", "-Command", "Set-Clipboard"], method: "PowerShell" },
    ])
  }

  if (process.platform === "linux") {
    return findClipboardCommand([
      { command: ["wl-copy"], method: "wl-copy" },
      { command: ["xclip", "-selection", "clipboard"], method: "xclip" },
      { command: ["xsel", "--clipboard", "--input"], method: "xsel" },
    ])
  }

  return undefined
}

function findClipboardCommand(commands: ClipboardCommand[]): ClipboardCommand | undefined {
  return commands.find((clipboardCommand) => Bun.which(clipboardCommand.command[0] ?? ""))
}

export function formatCopiedSelectionStatus(text: string) {
  const lines = text.split(/\r\n|\r|\n/).length
  if (lines > 1) {
    return `Copied ${pluralize(lines, "line")} to clipboard.`
  }
  return `Copied ${pluralize([...text].length, "character")} to clipboard.`
}
