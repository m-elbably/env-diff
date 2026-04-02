import { useTerminalDimensions } from "@opentui/react"
import type { DiffEntry, DiffStatus } from "../diff"
import { charDiff } from "../diff"
import {
  COLORS,
  statusBg,
  statusColor,
  statusSymbol,
} from "./theme"

// Keys matching this pattern have their values masked unless showSecrets=true
const SECRET_PATTERN =
  /key|secret|token|password|passwd|pwd|private|auth|credential|cert|salt|hash|bearer/i

// How many visible rows fit in the diff panel.
// Title row (slick font ~6 rows, fills combined title+shortcuts row) + padding(2)
// + file-pills(3) + bottom-border(1) + col-header(1) + status-bar(1+2padding) = 16
const CONTENT_OVERHEAD = 16

type Props = {
  entries: DiffEntry[]
  scrollOffset: number
  cursor: number
  fileNameA: string
  fileNameB: string
  showSecrets: boolean
  showCharDiff: boolean
  searchQuery: string
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max - 1) + "…"
}

function formatLine(n: number | undefined): string {
  if (n === undefined) return "  ─  "
  return String(n).padStart(4, " ") + " "
}

// ─── Inline character-level value cell ───────────────────────────────────────

function InlineValueCell({
  value,
  missing,
  isModified,
  side,
  otherValue,
  color,
  bg,
  width,
  masked,
  showCharDiff,
}: {
  value: string | undefined
  missing: boolean
  isModified: boolean
  side: "a" | "b"
  otherValue: string | undefined
  color: string
  bg: string
  width: number
  masked: boolean
  showCharDiff: boolean
}) {
  const MAX_VAL = Math.max(4, width - 2)

  if (missing) {
    return (
      <box width={width} height={1} backgroundColor={COLORS.missingBg} paddingX={1}>
        <text>
          <span fg={COLORS.missingText}>{"─".repeat(Math.min(MAX_VAL, 6))}</span>
        </text>
      </box>
    )
  }

  const raw = value ?? ""

  if (masked) {
    const maskedStr = "*".repeat(Math.min(raw.length || 8, MAX_VAL))
    return (
      <box width={width} height={1} backgroundColor="transparent" paddingX={1}>
        <text>
          <span fg={COLORS.subtitle}>{maskedStr}</span>
        </text>
      </box>
    )
  }

  // For modified entries, show inline char-level diff.
  // charDiff(a, b) must always be called as charDiff(valueA, valueB) so that
  // aSpans annotates valueA and bSpans annotates valueB.
  // Side "a": raw=valueA, otherValue=valueB  → charDiff(raw, otherValue), take aSpans
  // Side "b": raw=valueB, otherValue=valueA  → charDiff(otherValue, raw),  take bSpans
  if (isModified && showCharDiff && otherValue !== undefined) {
    const { aSpans, bSpans } =
      side === "a" ? charDiff(raw, otherValue) : charDiff(otherValue, raw)
    const spans = side === "a" ? aSpans : bSpans
    let remaining = MAX_VAL

    return (
      <box width={width} height={1} backgroundColor={bg} paddingX={1}>
        <text>
          {spans.map((s, idx) => {
            if (remaining <= 0) return null
            const text = truncate(s.text, remaining)
            remaining -= text.length
            if (s.kind === "removed") {
              return (
                <span key={idx} fg={COLORS.charRemovedFg} bg={COLORS.charRemovedBg}>
                  {text}
                </span>
              )
            }
            if (s.kind === "added") {
              return (
                <span key={idx} fg={COLORS.charAddedFg} bg={COLORS.charAddedBg}>
                  {text}
                </span>
              )
            }
            return (
              <span key={idx} fg={COLORS.valueText}>
                {text}
              </span>
            )
          })}
        </text>
      </box>
    )
  }

  const display = truncate(raw, MAX_VAL)
  return (
    <box width={width} height={1} backgroundColor={bg} paddingX={1}>
      <text>
        <span fg={color}>{display}</span>
      </text>
    </box>
  )
}

// ─── Key cell with optional search highlight ──────────────────────────────────

function KeyCell({
  keyText,
  color,
  width,
  searchQuery,
}: {
  keyText: string
  color: string
  width: number
  searchQuery: string
}) {
  const MAX_KEY = Math.max(4, width - 2)
  const display = truncate(keyText, MAX_KEY)

  if (!searchQuery) {
    return (
      <box width={width} paddingX={1} alignItems="center">
        <text>
          <span fg={color}>{display}</span>
        </text>
      </box>
    )
  }

  const q = searchQuery.toLowerCase()
  const idx = display.toLowerCase().indexOf(q)

  if (idx === -1) {
    return (
      <box width={width} paddingX={1} alignItems="center">
        <text>
          <span fg={color}>{display}</span>
        </text>
      </box>
    )
  }

  const before = display.slice(0, idx)
  const match = display.slice(idx, idx + q.length)
  const after = display.slice(idx + q.length)

  return (
    <box width={width} paddingX={1} alignItems="center">
      <text>
        {before && <span fg={color}>{before}</span>}
        <span fg={COLORS.searchMatchFg} bg={COLORS.searchMatchBg}>
          {match}
        </span>
        {after && <span fg={color}>{after}</span>}
      </text>
    </box>
  )
}

// ─── Status-based value coloring ────────────────────────────────────────────
// A side: show the "was" color — red for removed/modified, neutral for unchanged
// B side: show the "now" color — green for added/modified, neutral for unchanged

function valueColorA(status: DiffStatus): string {
  switch (status) {
    case "removed":  return COLORS.removed
    case "modified": return COLORS.removed
    default:         return COLORS.valueText
  }
}

function valueColorB(status: DiffStatus): string {
  switch (status) {
    case "added":    return COLORS.added
    case "modified": return COLORS.added
    default:         return COLORS.valueText
  }
}

// ─── Main table ───────────────────────────────────────────────────────────────

export function DiffTable({
  entries,
  scrollOffset,
  cursor,
  fileNameA,
  fileNameB,
  showSecrets,
  showCharDiff,
  searchQuery,
}: Props) {
  const { width, height } = useTerminalDimensions()
  const visibleRows = Math.max(1, height - CONTENT_OVERHEAD)
  const visible = entries.slice(scrollOffset, scrollOffset + visibleRows)

  // Layout: [sym(3)] [lnA(5)] [lnB(5)] [key(keyW)] [valA(valW)] [valB(valW)]
  const totalW = width - 2
  const symW = 3
  const lnW = 5
  const keyW = Math.floor(totalW * 0.28)
  const valW = Math.floor((totalW - symW - lnW * 2 - keyW) / 2)

  return (
    <box flexDirection="column" width="100%" flexGrow={1} backgroundColor={COLORS.bg}>
      {/* Column headers */}
      <box
        flexDirection="row"
        width="100%"
        height={1}
        backgroundColor={COLORS.bgPanel}
        border={["bottom"]}
        borderColor={COLORS.border}
        paddingX={1}
      >
        <box width={symW}>
          <text>
            <span fg={COLORS.subtitle}> </span>
          </text>
        </box>
        <box width={lnW}>
          <text>
            <span fg={COLORS.subtitle}> #A  </span>
          </text>
        </box>
        <box width={lnW}>
          <text>
            <span fg={COLORS.subtitle}> #B  </span>
          </text>
        </box>
        <box width={keyW} paddingX={1}>
          <text>
            <span fg={COLORS.subtitle}>
              <strong>KEY</strong>
            </span>
          </text>
        </box>
        <box width={valW} paddingX={1}>
          <text>
            <span fg={COLORS.removed}>
              <strong>{truncate(fileNameA, valW - 2)}</strong>
            </span>
          </text>
        </box>
        <box flexGrow={1} paddingX={1}>
          <text>
            <span fg={COLORS.added}>
              <strong>{truncate(fileNameB, valW - 2)}</strong>
            </span>
          </text>
        </box>
      </box>

      {/* Data rows */}
      {visible.length === 0 ? (
        <box flexGrow={1} justifyContent="center" alignItems="center">
          <text>
            <span fg={COLORS.subtitle}>No entries to display</span>
          </text>
        </box>
      ) : (
        visible.map((entry, i) => {
          const absoluteIdx = scrollOffset + i
          const isSelected = absoluteIdx === cursor
          const sc = statusColor(entry.status)
          const sym = statusSymbol(entry.status)

          const isSecretKey = SECRET_PATTERN.test(entry.key)
          const masked = isSecretKey && !showSecrets

          const missingA = entry.valueA === undefined
          const missingB = entry.valueB === undefined
          const isModified = entry.status === "modified"

          // Row background: selected row overrides status bg
          const defaultBg =
            entry.status === "unchanged"
              ? i % 2 === 0
                ? COLORS.bgRow
                : COLORS.bgRowAlt
              : statusBg(entry.status)
          const rowBg = isSelected ? COLORS.selectedRow : defaultBg

          return (
            <box
              key={entry.key}
              flexDirection="row"
              width="100%"
              height={1}
              backgroundColor={rowBg}
            >
              {/* Status symbol */}
              <box width={symW} alignItems="center" justifyContent="center">
                <text>
                  <span fg={sc}>
                    <strong> {sym} </strong>
                  </span>
                </text>
              </box>

              {/* Line number A */}
              <box width={lnW} alignItems="center">
                <text>
                  <span fg={isSelected ? COLORS.accentBright : COLORS.subtitle}>
                    {formatLine(entry.lineA)}
                  </span>
                </text>
              </box>

              {/* Line number B */}
              <box width={lnW} alignItems="center">
                <text>
                  <span fg={isSelected ? COLORS.accentBright : COLORS.subtitle}>
                    {formatLine(entry.lineB)}
                  </span>
                </text>
              </box>

              {/* Key */}
              <KeyCell
                keyText={entry.key}
                color={sc}
                width={keyW}
                searchQuery={searchQuery}
              />

              {/* Value A */}
              <InlineValueCell
                value={entry.valueA}
                missing={missingA}
                isModified={isModified}
                side="a"
                otherValue={entry.valueB}
                color={missingA ? COLORS.missingText : valueColorA(entry.status)}
                bg={missingA ? COLORS.missingBg : "transparent"}
                width={valW}
                masked={masked}
                showCharDiff={showCharDiff}
              />

              {/* Value B */}
              <InlineValueCell
                value={entry.valueB}
                missing={missingB}
                isModified={isModified}
                side="b"
                otherValue={entry.valueA}
                color={missingB ? COLORS.missingText : valueColorB(entry.status)}
                bg={missingB ? COLORS.missingBg : "transparent"}
                width={valW}
                masked={masked}
                showCharDiff={showCharDiff}
              />
            </box>
          )
        })
      )}
    </box>
  )
}

export function visibleRowCount(height: number): number {
  return Math.max(1, height - CONTENT_OVERHEAD)
}
