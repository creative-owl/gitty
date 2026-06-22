import { createHash } from "node:crypto"
import { mkdir, rm, stat, writeFile } from "node:fs/promises"
import { basename, join, resolve } from "node:path"

type ReleaseTarget = {
  name: string
  bunTarget: string
  arch: NodeJS.Architecture
  platform: NodeJS.Platform
}

const RELEASE_TARGETS: ReleaseTarget[] = [
  {
    name: "darwin-arm64",
    bunTarget: "bun-darwin-arm64",
    platform: "darwin",
    arch: "arm64",
  },
  {
    name: "darwin-x64",
    bunTarget: "bun-darwin-x64",
    platform: "darwin",
    arch: "x64",
  },
  {
    name: "linux-arm64",
    bunTarget: "bun-linux-arm64",
    platform: "linux",
    arch: "arm64",
  },
  {
    name: "linux-x64",
    bunTarget: "bun-linux-x64",
    platform: "linux",
    arch: "x64",
  },
]

const TARGET_NAMES = RELEASE_TARGETS.map((target) => target.name).join(", ")

async function main() {
  const options = parseArgs(Bun.argv.slice(2))

  if (options.listTargets) {
    process.stdout.write(`${TARGET_NAMES}\n`)
    return
  }

  const target = resolveTarget(options.targetName)
  const distDir = resolve(process.cwd(), options.outDir)
  const workDir = join(distDir, ".release-build", target.name)
  const binaryPath = join(workDir, "gitty")
  const archiveName = `gitty-${target.name}.tar.gz`
  const archivePath = join(distDir, archiveName)
  const checksumPath = `${archivePath}.sha256`

  await mkdir(distDir, { recursive: true })
  await rm(workDir, { force: true, recursive: true })
  await mkdir(workDir, { recursive: true })
  await rm(archivePath, { force: true })
  await rm(checksumPath, { force: true })

  run([
    "bun",
    "build",
    "--compile",
    `--target=${target.bunTarget}`,
    "--outfile",
    binaryPath,
    "src/index.tsx",
  ])
  run(["tar", "-C", workDir, "-czf", archivePath, "gitty"])

  const archiveStat = await stat(archivePath)
  if (!archiveStat.isFile() || archiveStat.size === 0) {
    throw new Error(`Release archive was not created: ${archivePath}`)
  }

  const checksum = createHash("sha256").update(Buffer.from(await Bun.file(archivePath).arrayBuffer())).digest("hex")
  await writeFile(checksumPath, `${checksum}  ${archiveName}\n`, "utf8")

  process.stdout.write(`Built ${basename(archivePath)}\n`)
  process.stdout.write(`Wrote ${basename(checksumPath)}\n`)
}

type BuildOptions = {
  listTargets: boolean
  outDir: string
  targetName?: string
}

function parseArgs(args: string[]): BuildOptions {
  const options: BuildOptions = {
    listTargets: false,
    outDir: "dist",
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (!arg) {
      continue
    }

    if (arg === "--list-targets") {
      options.listTargets = true
      continue
    }

    if (arg === "--current") {
      options.targetName = currentTargetName()
      continue
    }

    if (arg === "--target") {
      const next = args[index + 1]
      if (!next) {
        throw new Error("--target requires a target name")
      }
      options.targetName = next
      index += 1
      continue
    }

    if (arg.startsWith("--target=")) {
      options.targetName = arg.slice("--target=".length)
      continue
    }

    if (arg === "--out-dir") {
      const next = args[index + 1]
      if (!next) {
        throw new Error("--out-dir requires a directory")
      }
      options.outDir = next
      index += 1
      continue
    }

    if (arg.startsWith("--out-dir=")) {
      options.outDir = arg.slice("--out-dir=".length)
      continue
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`)
    }

    if (options.targetName) {
      throw new Error(`Unexpected extra argument: ${arg}`)
    }

    options.targetName = arg
  }

  return options
}

function resolveTarget(targetName = process.env.GITTY_RELEASE_TARGET || currentTargetName()) {
  const target = RELEASE_TARGETS.find((candidate) => candidate.name === targetName)
  if (!target) {
    throw new Error(`Unsupported release target: ${targetName}. Expected one of: ${TARGET_NAMES}`)
  }
  return target
}

function currentTargetName() {
  const currentTarget = RELEASE_TARGETS.find(
    (target) => target.platform === process.platform && target.arch === process.arch,
  )
  if (!currentTarget) {
    throw new Error(`Unsupported current platform: ${process.platform}-${process.arch}`)
  }
  return currentTarget.name
}

function run(command: string[]) {
  const result = Bun.spawnSync(command, {
    stderr: "inherit",
    stdout: "inherit",
  })
  if (result.exitCode !== 0) {
    throw new Error(`Command failed: ${command.join(" ")}`)
  }
}

await main()
