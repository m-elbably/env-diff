import type { ParsedFile } from "./parser"

export type DiffStatus = "added" | "removed" | "modified" | "unchanged"

export type DiffEntry = {
  key: string
  /** Value in file A (left). Undefined if key is absent. */
  valueA: string | undefined
  /** Value in file B (right). Undefined if key is absent. */
  valueB: string | undefined
  status: DiffStatus
  /** 1-based line number in file A, if known */
  lineA: number | undefined
  /** 1-based line number in file B, if known */
  lineB: number | undefined
}

// ─── Character-level Diff ────────────────────────────────────────────────────

export type CharSpan = { text: string; kind: "kept" | "removed" | "added" }

export function charDiff(
  a: string,
  b: string
): { aSpans: CharSpan[]; bSpans: CharSpan[] } {
  // Cap length to avoid O(n²) perf on long values
  const MAX = 120
  const ta = a.slice(0, MAX)
  const tb = b.slice(0, MAX)
  const m = ta.length
  const n = tb.length

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        ta[i - 1] === tb[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  // Backtrack to produce per-character annotations
  type AChar = { ch: string; kind: "kept" | "removed" }
  type BChar = { ch: string; kind: "kept" | "added" }
  const aChars: AChar[] = []
  const bChars: BChar[] = []
  let i = m
  let j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && ta[i - 1] === tb[j - 1]) {
      aChars.unshift({ ch: ta[i - 1], kind: "kept" })
      bChars.unshift({ ch: tb[j - 1], kind: "kept" })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      bChars.unshift({ ch: tb[j - 1], kind: "added" })
      j--
    } else {
      aChars.unshift({ ch: ta[i - 1], kind: "removed" })
      i--
    }
  }

  // Merge consecutive same-kind chars into spans
  function merge<T extends { ch: string; kind: string }>(chars: T[]): CharSpan[] {
    const spans: CharSpan[] = []
    for (const c of chars) {
      if (spans.length && spans[spans.length - 1].kind === c.kind) {
        spans[spans.length - 1].text += c.ch
      } else {
        spans.push({ text: c.ch, kind: c.kind as CharSpan["kind"] })
      }
    }
    return spans
  }

  return { aSpans: merge(aChars), bSpans: merge(bChars) }
}

export type DiffResult = {
  entries: DiffEntry[]
  stats: {
    total: number
    added: number     // only in B
    removed: number   // only in A
    modified: number  // in both, different values
    unchanged: number
  }
}

export function computeDiff(
  fileA: ParsedFile,
  fileB: ParsedFile,
  options: { ignorePattern?: RegExp } = {}
): DiffResult {
  const { ignorePattern } = options
  const allKeys = new Set([
    ...Object.keys(fileA.entries),
    ...Object.keys(fileB.entries),
  ])

  const entries: DiffEntry[] = []

  for (const key of allKeys) {
    if (ignorePattern && ignorePattern.test(key)) continue

    const valueA = fileA.entries[key]
    const valueB = fileB.entries[key]

    let status: DiffStatus
    if (valueA === undefined) {
      status = "added"
    } else if (valueB === undefined) {
      status = "removed"
    } else if (valueA !== valueB) {
      status = "modified"
    } else {
      status = "unchanged"
    }

    entries.push({
      key,
      valueA,
      valueB,
      status,
      lineA: fileA.lineNumbers[key],
      lineB: fileB.lineNumbers[key],
    })
  }

  const stats = {
    total: entries.length,
    added: entries.filter((e) => e.status === "added").length,
    removed: entries.filter((e) => e.status === "removed").length,
    modified: entries.filter((e) => e.status === "modified").length,
    unchanged: entries.filter((e) => e.status === "unchanged").length,
  }

  return { entries, stats }
}
