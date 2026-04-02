import { useState, useCallback, useMemo } from "react"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import type { DiffResult, DiffStatus, DiffEntry } from "../diff"
import type { ParsedFile } from "../parser"
import { Header } from "./Header"
import { DiffTable, visibleRowCount } from "./DiffTable"
import { StatusBar } from "./StatusBar"

// ─── Types ───────────────────────────────────────────────────────────────────

export type DisplayFilter = "all" | "diffs" | DiffStatus
export type SortMode = "status" | "alpha" | "a-order" | "b-order"

const FILTER_CYCLE: DisplayFilter[] = [
  "all",
  "removed",
  "added",
  "modified",
  "unchanged",
]

const SORT_CYCLE: SortMode[] = ["status", "alpha", "a-order", "b-order"]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function applyFilter(entries: DiffEntry[], filter: DisplayFilter): DiffEntry[] {
  if (filter === "all") return entries
  if (filter === "diffs") return entries.filter((e) => e.status !== "unchanged")
  return entries.filter((e) => e.status === filter)
}

const STATUS_ORDER: Record<DiffStatus, number> = {
  removed: 0,
  added: 1,
  modified: 2,
  unchanged: 3,
}

function applySort(entries: DiffEntry[], mode: SortMode): DiffEntry[] {
  const sorted = [...entries]
  if (mode === "status") {
    sorted.sort((a, b) => {
      const d = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      return d !== 0 ? d : a.key.localeCompare(b.key)
    })
  } else if (mode === "alpha") {
    sorted.sort((a, b) => a.key.localeCompare(b.key))
  } else if (mode === "a-order") {
    sorted.sort((a, b) => (a.lineA ?? 999999) - (b.lineA ?? 999999))
  } else if (mode === "b-order") {
    sorted.sort((a, b) => (a.lineB ?? 999999) - (b.lineB ?? 999999))
  }
  return sorted
}

async function copyToClipboard(text: string): Promise<void> {
  // Use stdin:"pipe" for reliable text piping to clipboard tools
  const tools: string[][] = [
    ["xclip", "-selection", "clipboard"],
    ["xsel", "--clipboard", "--input"],
    ["wl-copy"],
    ["pbcopy"],
  ]
  for (const cmd of tools) {
    try {
      const proc = Bun.spawn(cmd, { stdin: "pipe", stdout: "ignore", stderr: "ignore" })
      proc.stdin!.write(text)
      await proc.stdin!.flush()
      proc.stdin!.end()
      const code = await proc.exited
      if (code === 0) return
    } catch {
      /* try next */
    }
  }
  // OSC 52 fallback (works in most modern terminals)
  try {
    const b64 = Buffer.from(text).toString("base64")
    process.stdout.write(`\x1b]52;c;${b64}\x07`)
  } catch {
    /* ignore */
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

type Props = {
  fileA: ParsedFile
  fileB: ParsedFile
  diff: DiffResult
}

export function App({ fileA, fileB, diff }: Props) {
  const renderer = useRenderer()
  const { height } = useTerminalDimensions()

  const [scrollOffset, setScrollOffset] = useState(0)
  const [cursor, setCursor] = useState(0)
  const [displayFilter, setDisplayFilter] = useState<DisplayFilter>("all")
  const [sortMode, setSortMode] = useState<SortMode>("status")
  const [showSecrets, setShowSecrets] = useState(false)
  const [showCharDiff, setShowCharDiff] = useState(true)
  const [searchMode, setSearchMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [clipMessage, setClipMessage] = useState<string | null>(null)

  // Apply sort → filter → search in that order
  const sortedEntries = useMemo(
    () => applySort(diff.entries, sortMode),
    [diff.entries, sortMode]
  )

  const filteredEntries = useMemo(() => {
    let entries = applyFilter(sortedEntries, displayFilter)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      entries = entries.filter((e) => e.key.toLowerCase().includes(q))
    }
    return entries
  }, [sortedEntries, displayFilter, searchQuery])

  const rowsOnScreen = visibleRowCount(height)
  const maxScroll = Math.max(0, filteredEntries.length - rowsOnScreen)
  const boundedCursor = Math.min(cursor, Math.max(0, filteredEntries.length - 1))

  const moveCursor = useCallback(
    (delta: number) => {
      setCursor((c) => {
        const next = Math.max(0, Math.min(filteredEntries.length - 1, c + delta))
        setScrollOffset((offset) => {
          if (next < offset) return next
          if (next >= offset + rowsOnScreen) return next - rowsOnScreen + 1
          return offset
        })
        return next
      })
    },
    [filteredEntries.length, rowsOnScreen]
  )

  const jumpToTop = useCallback(() => {
    setScrollOffset(0)
    setCursor(0)
  }, [])

  const jumpToBottom = useCallback(() => {
    setScrollOffset(maxScroll)
    setCursor(Math.max(0, filteredEntries.length - 1))
  }, [maxScroll, filteredEntries.length])

  useKeyboard((key) => {
    // ── Search mode: capture typed characters ──────────────────────────────
    if (searchMode) {
      if (key.name === "escape") {
        setSearchMode(false)
        setSearchQuery("")
        jumpToTop()
      } else if (key.name === "backspace") {
        setSearchQuery((q) => q.slice(0, -1))
      } else if (key.name === "return" || key.name === "enter") {
        setSearchMode(false) // commit — keep query active for filtering
      } else if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
        setSearchQuery((q) => q + key.sequence)
        jumpToTop()
      }
      return
    }

    // ── Normal mode ────────────────────────────────────────────────────────

    // Quit (q only — ESC is reserved for clearing search)
    if (key.name === "q") {
      renderer.destroy()
      return
    }

    // Open search
    if (key.sequence === "/") {
      setSearchMode(true)
      return
    }

    // Navigation
    if (key.name === "down" || key.name === "j") { moveCursor(1); return }
    if (key.name === "up" || key.name === "k") { moveCursor(-1); return }

    if (key.name === "pagedown" || (key.ctrl && key.name === "d")) {
      moveCursor(Math.floor(rowsOnScreen / 2))
      return
    }
    if (key.name === "pageup" || (key.ctrl && key.name === "u")) {
      moveCursor(-Math.floor(rowsOnScreen / 2))
      return
    }

    if (key.name === "home" || key.name === "g") { jumpToTop(); return }
    if (key.name === "end" || (key.shift && key.name === "g")) { jumpToBottom(); return }

    // View filters
    if (key.name === "h") {
      setShowCharDiff((v) => !v)
      return
    }
    if (key.name === "d") {
      setDisplayFilter("diffs")
      jumpToTop()
      return
    }
    if (key.name === "a") {
      setDisplayFilter("all")
      jumpToTop()
      return
    }
    if (key.name === "f") {
      setDisplayFilter((cur) => {
        const idx = FILTER_CYCLE.indexOf(cur)
        return FILTER_CYCLE[(idx + 1) % FILTER_CYCLE.length]
      })
      jumpToTop()
      return
    }

    // Sort
    if (key.name === "o") {
      setSortMode((cur) => {
        const idx = SORT_CYCLE.indexOf(cur)
        return SORT_CYCLE[(idx + 1) % SORT_CYCLE.length]
      })
      return
    }

    // Secret masking
    if (key.name === "s") {
      setShowSecrets((v) => !v)
      return
    }

    // Copy selected value to clipboard
    if (key.name === "c") {
      const entry = filteredEntries[boundedCursor]
      if (entry) {
        const val = entry.valueB ?? entry.valueA ?? ""
        copyToClipboard(val).then(() => {
          const preview = val.length > 35 ? val.slice(0, 35) + "…" : val
          setClipMessage(`Copied: ${preview}`)
          setTimeout(() => setClipMessage(null), 2500)
        })
      }
      return
    }
  })

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor="#0d1117"
      onMouseDown={(event: any) => {
        if (event.button === 2) {
          // Right-click: copy mouse-selected text, fall back to cursor row value
          const sel = renderer.getSelection()
          const selText = sel?.getSelectedText()?.trim() ?? ""
          const textToCopy = selText || 
            (filteredEntries[boundedCursor]
              ? (filteredEntries[boundedCursor].valueB ?? filteredEntries[boundedCursor].valueA ?? "")
              : "")
          if (textToCopy) {
            copyToClipboard(textToCopy).then(() => {
              const preview = textToCopy.length > 35 ? textToCopy.slice(0, 35) + "…" : textToCopy
              setClipMessage(`Copied: ${preview}`)
              setTimeout(() => setClipMessage(null), 2500)
            })
          }
        }
      }}
    >
      <Header
        fileA={fileA}
        fileB={fileB}
        diff={diff}
        searchMode={searchMode}
        searchQuery={searchQuery}
      />

      <DiffTable
        entries={filteredEntries}
        scrollOffset={scrollOffset}
        cursor={boundedCursor}
        fileNameA={fileA.path.split("/").pop() ?? fileA.path}
        fileNameB={fileB.path.split("/").pop() ?? fileB.path}
        showSecrets={showSecrets}
        showCharDiff={showCharDiff}
        searchQuery={searchQuery}
      />

      <StatusBar
        diff={diff}
        displayFilter={displayFilter}
        sortMode={sortMode}
        showSecrets={showSecrets}
        searchMode={searchMode}
        searchQuery={searchQuery}
        clipMessage={clipMessage}
        visibleCount={Math.min(filteredEntries.length - scrollOffset, rowsOnScreen)}
        totalFiltered={filteredEntries.length}
      />
    </box>
  )
}
