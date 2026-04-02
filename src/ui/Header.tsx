import { useTerminalDimensions } from "@opentui/react"
import type { DiffResult } from "../diff"
import type { ParsedFile } from "../parser"
import { COLORS } from "./theme"

type Props = {
  fileA: ParsedFile
  fileB: ParsedFile
  diff: DiffResult
  searchMode: boolean
  searchQuery: string
}

const SHORTCUTS = [
  { k: "↑↓/jk", label: "scroll" },
  { k: "/", label: "search" },
  { k: "f", label: "filter" },
  { k: "o", label: "sort" },
  { k: "h", label: "char-diff" },
  { k: "d/a", label: "view" },
  { k: "s", label: "secrets" },
  { k: "c", label: "copy" },
  { k: "q", label: "quit" },
]

function Shortcut({ k, label }: { k: string; label: string }) {
  return (
    <box flexDirection="row" marginRight={2} alignItems="center">
      {/* Key badge — the "small square" on the left */}
      <box backgroundColor={COLORS.tag} paddingX={1}>
        <text>
          <span fg={COLORS.tagText}>
            <strong>{k}</strong>
          </span>
        </text>
      </box>
      {/* Description */}
      <box paddingLeft={1}>
        <text>
          <span fg={COLORS.subtitle}>{label}</span>
        </text>
      </box>
    </box>
  )
}

export function Header({ fileA, fileB, diff, searchMode, searchQuery }: Props) {
  const { width } = useTerminalDimensions()
  const halfW = Math.max(20, Math.floor((width - 4) / 2))

  const fileNameA = fileA.path.split("/").pop() ?? fileA.path
  const fileNameB = fileB.path.split("/").pop() ?? fileB.path

  return (
    <box
      flexDirection="column"
      width="100%"
      backgroundColor={COLORS.bgPanel}
      border={["bottom"]}
      borderColor={COLORS.border}
    >
      {/* Title + shortcuts in one row — ASCII font left, shortcuts right, vertically centered */}
      <box
        flexDirection="row"
        alignItems="center"
        width="100%"
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
      >
        <ascii-font text="ENV-DIFF" font="slick" color={COLORS.accentBright} />

        <box flexGrow={1} />

        <box flexDirection="row" alignItems="center">
          {SHORTCUTS.map(({ k, label }) => (
            <Shortcut key={k} k={k} label={label} />
          ))}
        </box>
      </box>

      {/* File pills row */}
      <box flexDirection="row" paddingX={2} paddingBottom={1}>
        {/* File A */}
        <box
          width={halfW}
          flexDirection="row"
          alignItems="center"
          border
          borderStyle="rounded"
          borderColor={COLORS.removed}
          paddingX={1}
        >
          <text>
            <span fg={COLORS.removed}>A  </span>
            <span fg={COLORS.title}>
              <strong>{fileNameA}</strong>
            </span>
            <span fg={COLORS.subtitle}>  {fileA.type.toUpperCase()}</span>
          </text>
        </box>

        <box width={2} />

        {/* File B */}
        <box
          flexGrow={1}
          flexDirection="row"
          alignItems="center"
          border
          borderStyle="rounded"
          borderColor={COLORS.added}
          paddingX={1}
        >
          <text>
            <span fg={COLORS.added}>B  </span>
            <span fg={COLORS.title}>
              <strong>{fileNameB}</strong>
            </span>
            <span fg={COLORS.subtitle}>  {fileB.type.toUpperCase()}</span>
          </text>
        </box>

        {/* Search indicator */}
        {(searchMode || searchQuery) && (
          <box
            flexDirection="row"
            alignItems="center"
            marginLeft={2}
            border
            borderStyle="rounded"
            borderColor={COLORS.accent}
            paddingX={1}
          >
            <text>
              <span fg={COLORS.accentBright}>/ </span>
              <span fg={COLORS.title}>{searchQuery}</span>
              {searchMode && <span fg={COLORS.accent}>█</span>}
            </text>
          </box>
        )}
      </box>
    </box>
  )
}

