import { expect, test, describe } from "bun:test"
import { computeDiff, charDiff } from "../src/diff"
import type { ParsedFile } from "../src/parser"

function makeFile(
  entries: Record<string, string>,
  type: "env" | "yaml" | "json" = "env"
): ParsedFile {
  return {
    path: `test.${type}`,
    type,
    entries,
    lineNumbers: Object.fromEntries(Object.keys(entries).map((k, i) => [k, i + 1])),
  }
}

// ─── computeDiff ─────────────────────────────────────────────────────────────

describe("computeDiff - status detection", () => {
  test("unchanged when values are identical", () => {
    const a = makeFile({ FOO: "bar", BAZ: "qux" })
    const b = makeFile({ FOO: "bar", BAZ: "qux" })
    const { stats } = computeDiff(a, b)
    expect(stats.unchanged).toBe(2)
    expect(stats.modified).toBe(0)
    expect(stats.added).toBe(0)
    expect(stats.removed).toBe(0)
  })

  test("modified when value changes", () => {
    const a = makeFile({ FOO: "old" })
    const b = makeFile({ FOO: "new" })
    const { entries, stats } = computeDiff(a, b)
    expect(stats.modified).toBe(1)
    const entry = entries.find((e) => e.key === "FOO")!
    expect(entry.status).toBe("modified")
    expect(entry.valueA).toBe("old")
    expect(entry.valueB).toBe("new")
  })

  test("added when key only exists in B", () => {
    const a = makeFile({})
    const b = makeFile({ NEW_KEY: "value" })
    const { entries, stats } = computeDiff(a, b)
    expect(stats.added).toBe(1)
    const entry = entries[0]
    expect(entry.status).toBe("added")
    expect(entry.valueA).toBeUndefined()
    expect(entry.valueB).toBe("value")
  })

  test("removed when key only exists in A", () => {
    const a = makeFile({ OLD_KEY: "value" })
    const b = makeFile({})
    const { entries, stats } = computeDiff(a, b)
    expect(stats.removed).toBe(1)
    const entry = entries[0]
    expect(entry.status).toBe("removed")
    expect(entry.valueA).toBe("value")
    expect(entry.valueB).toBeUndefined()
  })

  test("mixed diff with all statuses", () => {
    const a = makeFile({ A: "1", B: "old", C: "same" })
    const b = makeFile({ B: "new", C: "same", D: "added" })
    const { stats } = computeDiff(a, b)
    expect(stats.removed).toBe(1)  // A
    expect(stats.modified).toBe(1) // B
    expect(stats.unchanged).toBe(1) // C
    expect(stats.added).toBe(1)    // D
    expect(stats.total).toBe(4)
  })
})

describe("computeDiff - stats integrity", () => {
  test("total equals sum of all statuses", () => {
    const a = makeFile({ A: "1", B: "2", C: "3" })
    const b = makeFile({ A: "1", B: "changed", D: "new" })
    const { stats } = computeDiff(a, b)
    expect(stats.total).toBe(stats.added + stats.removed + stats.modified + stats.unchanged)
  })

  test("total matches entry array length", () => {
    const a = makeFile({ A: "1", B: "2", C: "3" })
    const b = makeFile({ A: "1", B: "changed", D: "new" })
    const { entries, stats } = computeDiff(a, b)
    expect(stats.total).toBe(entries.length)
  })

  test("empty files produce zero stats", () => {
    const a = makeFile({})
    const b = makeFile({})
    const { stats, entries } = computeDiff(a, b)
    expect(stats.total).toBe(0)
    expect(entries).toHaveLength(0)
  })
})

describe("computeDiff - ignorePattern", () => {
  test("skips keys matching pattern", () => {
    const a = makeFile({ FOO: "a", SECRET_KEY: "s3cr3t" })
    const b = makeFile({ FOO: "b", SECRET_KEY: "different" })
    const { entries } = computeDiff(a, b, { ignorePattern: /^SECRET_/ })
    expect(entries.every((e) => e.key !== "SECRET_KEY")).toBe(true)
  })

  test("stats reflect ignored keys being excluded", () => {
    const a = makeFile({ FOO: "a", IGNORE_ME: "x" })
    const b = makeFile({ FOO: "b", IGNORE_ME: "y" })
    const { stats } = computeDiff(a, b, { ignorePattern: /^IGNORE_/ })
    expect(stats.total).toBe(1)
    expect(stats.modified).toBe(1)
  })

  test("no pattern = no keys ignored", () => {
    const a = makeFile({ SECRET: "a", KEY: "b" })
    const b = makeFile({ SECRET: "x", KEY: "y" })
    const { stats } = computeDiff(a, b)
    expect(stats.total).toBe(2)
    expect(stats.modified).toBe(2)
  })
})

describe("computeDiff - line numbers", () => {
  test("preserves lineA and lineB from parsed files", () => {
    const a = makeFile({ FOO: "a", BAR: "b" })
    const b = makeFile({ FOO: "x", BAR: "b" })
    const { entries } = computeDiff(a, b)
    const foo = entries.find((e) => e.key === "FOO")!
    expect(foo.lineA).toBe(1)
    expect(foo.lineB).toBe(1)
  })

  test("lineA is undefined for added keys", () => {
    const a = makeFile({})
    const b = makeFile({ NEW: "val" })
    const { entries } = computeDiff(a, b)
    expect(entries[0].lineA).toBeUndefined()
    expect(entries[0].lineB).toBe(1)
  })

  test("lineB is undefined for removed keys", () => {
    const a = makeFile({ OLD: "val" })
    const b = makeFile({})
    const { entries } = computeDiff(a, b)
    expect(entries[0].lineA).toBe(1)
    expect(entries[0].lineB).toBeUndefined()
  })
})

// ─── charDiff ────────────────────────────────────────────────────────────────

describe("charDiff", () => {
  test("identical strings produce a single kept span", () => {
    const { aSpans, bSpans } = charDiff("hello", "hello")
    expect(aSpans).toEqual([{ text: "hello", kind: "kept" }])
    expect(bSpans).toEqual([{ text: "hello", kind: "kept" }])
  })

  test("empty strings produce no spans", () => {
    const { aSpans, bSpans } = charDiff("", "")
    expect(aSpans).toHaveLength(0)
    expect(bSpans).toHaveLength(0)
  })

  test("completely different strings have no kept spans", () => {
    const { aSpans, bSpans } = charDiff("abc", "xyz")
    expect(aSpans.every((s) => s.kind !== "kept")).toBe(true)
    expect(bSpans.every((s) => s.kind !== "kept")).toBe(true)
  })

  test("aSpans contain only kept or removed", () => {
    const { aSpans } = charDiff("hello world", "hello there")
    expect(aSpans.every((s) => s.kind === "kept" || s.kind === "removed")).toBe(true)
  })

  test("bSpans contain only kept or added", () => {
    const { bSpans } = charDiff("hello world", "hello there")
    expect(bSpans.every((s) => s.kind === "kept" || s.kind === "added")).toBe(true)
  })

  test("reconstructed text matches original input", () => {
    const cases: [string, string][] = [
      ["hello world", "hello there"],
      ["localhost:5432", "db.example.com:5432"],
      ["true", "false"],
      ["production", "staging"],
      ["http://api.example.com", "https://api.staging.example.com"],
    ]
    for (const [a, b] of cases) {
      const { aSpans, bSpans } = charDiff(a, b)
      expect(aSpans.map((s) => s.text).join("")).toBe(a)
      expect(bSpans.map((s) => s.text).join("")).toBe(b)
    }
  })

  test("single character change", () => {
    const { aSpans, bSpans } = charDiff("abc", "axc")
    expect(aSpans.map((s) => s.text).join("")).toBe("abc")
    expect(bSpans.map((s) => s.text).join("")).toBe("axc")
  })

  test("prefix addition", () => {
    const { aSpans, bSpans } = charDiff("world", "hello world")
    expect(aSpans.map((s) => s.text).join("")).toBe("world")
    expect(bSpans.map((s) => s.text).join("")).toBe("hello world")
  })

  test("caps at 120 chars without error", () => {
    const long = "a".repeat(200)
    const { aSpans, bSpans } = charDiff(long, long)
    // Should not throw and should reconstruct the capped input
    expect(aSpans.map((s) => s.text).join("").length).toBeLessThanOrEqual(120)
    expect(bSpans.map((s) => s.text).join("").length).toBeLessThanOrEqual(120)
  })
})
