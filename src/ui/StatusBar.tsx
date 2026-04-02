import { COLORS } from "./theme"
import type { DiffResult } from "../diff"
import type { DisplayFilter, SortMode } from "./App"

type Props = {
  diff: DiffResult
  displayFilter: DisplayFilter
  sortMode: SortMode
  showSecrets: boolean
  searchMode: boolean
  searchQuery: string
  clipMessage: string | null
  visibleCount: number
  totalFiltered: number
}

function Pill({
  label,
  color,
  active,
}: {
  label: string
  color: string
  active?: boolean
}) {
  return (
    <box flexDirection="row" alignItems="center" marginRight={3}>
      <text>
        <span fg={active ? color : COLORS.subtitle}>■ </span>
        <span fg={active ? color : COLORS.subtitle}>{label}</span>
      </text>
    </box>
  )
}

function Legend({
  count,
  label,
  color,
}: {
  count: number
  label: string
  color: string
}) {
  return (
    <box flexDirection="row" alignItems="center" marginRight={2}>
      <text>
        <span fg={color}>█ </span>
        <span fg={color}>
          <strong>{count}</strong>
        </span>
        <span fg={COLORS.subtitle}> {label}</span>
      </text>
    </box>
  )
}

function filterLabel(filter: DisplayFilter): string {
  switch (filter) {
    case "all":      return "all"
    case "diffs":    return "diffs"
    case "added":    return "added"
    case "removed":  return "removed"
    case "modified": return "modified"
    case "unchanged":return "unchanged"
  }
}

function sortLabel(sort: SortMode): string {
  switch (sort) {
    case "status":  return "sort:status"
    case "alpha":   return "sort:alpha"
    case "a-order": return "sort:A-order"
    case "b-order": return "sort:B-order"
  }
}

export function StatusBar({
  diff,
  displayFilter,
  sortMode,
  showSecrets,
  searchMode,
  searchQuery,
  clipMessage,
  visibleCount,
  totalFiltered,
}: Props) {
  const { stats } = diff

  return (
    <box
      flexDirection="row"
      alignItems="center"
      width="100%"
      backgroundColor={COLORS.bgPanel}
      border={["top"]}
      borderColor={COLORS.border}
      paddingX={2}
      paddingY={1}
    >
      {/* Diff counts */}
      <Legend count={stats.removed}   label="removed"   color={COLORS.removed} />
      <Legend count={stats.added}     label="added"     color={COLORS.added} />
      <Legend count={stats.modified}  label="modified"  color={COLORS.modified} />
      <Legend count={stats.unchanged} label="unchanged" color={COLORS.unchanged} />

      {/* Divider */}
      <box marginRight={2}>
        <text><span fg={COLORS.border}>│</span></text>
      </box>

      {/* Active filter pill */}
      <Pill
        label={filterLabel(displayFilter)}
        color={COLORS.accent}
        active={displayFilter !== "all"}
      />

      {/* Sort pill */}
      <Pill
        label={sortLabel(sortMode)}
        color={COLORS.accentBright}
        active={sortMode !== "status"}
      />

      {/* Secrets pill */}
      {showSecrets ? (
        <Pill label="secrets: visible" color={COLORS.modified} active />
      ) : (
        <Pill label="secrets: masked" color={COLORS.subtitle} />
      )}

      {/* Search query */}
      {(searchMode || searchQuery) && (
        <box
          flexDirection="row"
          alignItems="center"
          marginRight={2}
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

      {/* Clipboard message */}
      {clipMessage && (
        <box marginRight={2}>
          <text>
            <span fg={COLORS.added}>{clipMessage}</span>
          </text>
        </box>
      )}

      <box flexGrow={1} />

      {/* Row count */}
      <text>
        <span fg={COLORS.subtitle}>
          {visibleCount} / {totalFiltered} keys  ({stats.total} total)
        </span>
      </text>
    </box>
  )
}
