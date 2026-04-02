#!/usr/bin/env bun
import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { parseFile } from "./parser"
import type { ParsedFile } from "./parser"
import { computeDiff } from "./diff"
import { App } from "./ui/App"

// ─── CLI Argument Parsing ────────────────────────────────────────────────────

function printUsage() {
  console.error(`
  env-diff — Visual diff for .env, .yaml, and .json files

  Usage:
    env-diff [options] <file-a> <file-b>

  Options:
    --ignore-pattern <regex>   Ignore keys matching this pattern (case-insensitive)
    -h, --help                 Show this help

  Examples:
    env-diff .env.development .env.production
    env-diff app.yaml app.staging.yaml
    env-diff config.json config.prod.json
    env-diff --ignore-pattern 'CI_|DEBUG' .env .env.prod

  Keyboard shortcuts:
    up/k  Scroll up       /  Search           f  Cycle filter
    dn/j  Scroll down     o  Cycle sort        s  Toggle secrets
    g/G   Top / Bottom    c  Copy value        d/a  Diff / All
    q / ESC  Quit

  Exit codes: 0 = identical, 1 = differences found
`)
}

let ignorePattern: RegExp | undefined
const positional: string[] = []
const rawArgs = process.argv.slice(2)

for (let i = 0; i < rawArgs.length; i++) {
  const arg = rawArgs[i]
  if (arg === "-h" || arg === "--help") {
    printUsage()
    process.exit(0)
  } else if (arg === "--ignore-pattern") {
    const pattern = rawArgs[++i]
    if (!pattern) {
      console.error("Error: --ignore-pattern requires a regex argument")
      process.exit(1)
    }
    try {
      ignorePattern = new RegExp(pattern, "i")
    } catch {
      console.error(`Error: Invalid regex pattern: ${pattern}`)
      process.exit(1)
    }
  } else if (!arg.startsWith("-")) {
    positional.push(arg)
  } else {
    console.error(`Unknown option: ${arg}`)
    process.exit(1)
  }
}

if (positional.length !== 2) {
  printUsage()
  process.exit(1)
}

const [pathA, pathB] = positional

// ─── Parse & Diff ────────────────────────────────────────────────────────────

let fileA: ParsedFile, fileB: ParsedFile
try {
  fileA = parseFile(pathA)
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`Error reading file A: ${message}`)
  process.exit(1)
}

try {
  fileB = parseFile(pathB)
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`Error reading file B: ${message}`)
  process.exit(1)
}

const diff = computeDiff(fileA, fileB, { ignorePattern })

// Early exit if files are identical
if (diff.stats.modified === 0 && diff.stats.added === 0 && diff.stats.removed === 0) {
  console.log(`✓ Files are identical — ${diff.stats.unchanged} key(s) match.\n`)
  process.exit(0)
}

// Exit code 1 signals differences were found (used when process exits naturally)
process.exitCode = 1

// ─── Start TUI ───────────────────────────────────────────────────────────────

async function main() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    targetFps: 60,
  })

  createRoot(renderer).render(
    <App fileA={fileA} fileB={fileB} diff={diff} />
  )
}

main()
