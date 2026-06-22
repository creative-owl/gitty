import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import packageJson from "../package.json" with { type: "json" }

const TARGETS = ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64"] as const

type TargetName = (typeof TARGETS)[number]

async function main() {
  const options = parseArgs(Bun.argv.slice(2))
  const checksums = parseChecksums(await readFile(options.checksumsPath, "utf8"))
  const formula = renderFormula(options.version, checksums)

  if (options.outPath) {
    await mkdir(dirname(options.outPath), { recursive: true })
    await writeFile(options.outPath, formula, "utf8")
    process.stdout.write(`Wrote ${options.outPath}\n`)
    return
  }

  process.stdout.write(formula)
}

type FormulaOptions = {
  checksumsPath: string
  outPath?: string
  version: string
}

function parseArgs(args: string[]): FormulaOptions {
  const options: FormulaOptions = {
    checksumsPath: resolve(process.cwd(), "dist/checksums.txt"),
    version: packageJson.version,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (!arg) {
      continue
    }

    if (arg === "--checksums") {
      const next = args[index + 1]
      if (!next) {
        throw new Error("--checksums requires a path")
      }
      options.checksumsPath = resolve(process.cwd(), next)
      index += 1
      continue
    }

    if (arg.startsWith("--checksums=")) {
      options.checksumsPath = resolve(process.cwd(), arg.slice("--checksums=".length))
      continue
    }

    if (arg === "--out") {
      const next = args[index + 1]
      if (!next) {
        throw new Error("--out requires a path")
      }
      options.outPath = resolve(process.cwd(), next)
      index += 1
      continue
    }

    if (arg.startsWith("--out=")) {
      options.outPath = resolve(process.cwd(), arg.slice("--out=".length))
      continue
    }

    if (arg === "--version") {
      const next = args[index + 1]
      if (!next) {
        throw new Error("--version requires a version")
      }
      options.version = next
      index += 1
      continue
    }

    if (arg.startsWith("--version=")) {
      options.version = arg.slice("--version=".length)
      continue
    }

    throw new Error(`Unknown option: ${arg}`)
  }

  return options
}

function parseChecksums(value: string) {
  const checksums = new Map<TargetName, string>()

  for (const line of value.split(/\r?\n/)) {
    const match = /^([a-f0-9]{64})\s+\S*?(darwin-arm64|darwin-x64|linux-arm64|linux-x64)\.tar\.gz$/i.exec(
      line.trim(),
    )
    if (!match) {
      continue
    }
    const checksum = match[1]
    const target = match[2] as TargetName | undefined
    if (!checksum || !target) {
      continue
    }
    checksums.set(target, checksum.toLowerCase())
  }

  for (const target of TARGETS) {
    if (!checksums.has(target)) {
      throw new Error(`Missing checksum for ${target}`)
    }
  }

  return checksums
}

function renderFormula(version: string, checksums: Map<TargetName, string>) {
  const darwinArm64Sha = getChecksum(checksums, "darwin-arm64")
  const darwinX64Sha = getChecksum(checksums, "darwin-x64")
  const linuxArm64Sha = getChecksum(checksums, "linux-arm64")
  const linuxX64Sha = getChecksum(checksums, "linux-x64")

  return `# typed: false
# frozen_string_literal: true

class Gitty < Formula
  desc "Terminal review workspace for local git changes and GitHub pull requests"
  homepage "https://github.com/creative-owl/gitty"
  version "${version}"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/creative-owl/gitty/releases/download/v#{version}/gitty-darwin-arm64.tar.gz"
      sha256 "${darwinArm64Sha}"
    else
      url "https://github.com/creative-owl/gitty/releases/download/v#{version}/gitty-darwin-x64.tar.gz"
      sha256 "${darwinX64Sha}"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/creative-owl/gitty/releases/download/v#{version}/gitty-linux-arm64.tar.gz"
      sha256 "${linuxArm64Sha}"
    else
      url "https://github.com/creative-owl/gitty/releases/download/v#{version}/gitty-linux-x64.tar.gz"
      sha256 "${linuxX64Sha}"
    end
  end

  def install
    bin.install "gitty"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/gitty --version")
  end
end
`
}

function getChecksum(checksums: Map<TargetName, string>, target: TargetName) {
  const checksum = checksums.get(target)
  if (!checksum) {
    throw new Error(`Missing checksum for ${target}`)
  }
  return checksum
}

await main()
