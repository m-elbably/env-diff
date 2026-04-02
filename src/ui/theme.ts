import type { DiffStatus } from "../diff"

// Palette used throughout the UI
export const COLORS = {
  // Backgrounds
  bg: "#0d1117",
  bgPanel: "#161b22",
  bgRow: "#0d1117",
  bgRowAlt: "#131920",
  bgRowHover: "#1c2333",

  // Status colors
  added: "#3fb950",       // green – key only in B
  addedBg: "#0d2b1a",
  removed: "#f85149",     // red – key only in A
  removedBg: "#2d0f0f",
  modified: "#d29922",    // amber – key in both, different value
  modifiedBg: "#241e00",
  unchanged: "#8b949e",   // muted – identical
  unchangedBg: "transparent",

  // Header / UI chrome
  border: "#30363d",
  title: "#e6edf3",
  subtitle: "#8b949e",
  accent: "#388bfd",
  accentBright: "#79c0ff",
  tag: "#1f6feb",
  tagText: "#cae8ff",

  // Value text
  valueText: "#e6edf3",
  missingText: "#484f58",
  missingBg: "#161b22",

  // Character-level diff highlights
  charRemovedBg: "#5c1010",
  charRemovedFg: "#ffaaaa",
  charAddedBg: "#0d3b1a",
  charAddedFg: "#a8ffb0",

  // Selected / cursor row
  selectedRow: "#1a3a5c",
  selectedBorder: "#388bfd",

  // Search match highlight
  searchMatchBg: "#4a3200",
  searchMatchFg: "#ffa657",

  // Masked secrets
  maskedBg: "#2a1f00",
  maskedFg: "#9e7a00",
} as const

export function statusColor(status: DiffStatus): string {
  switch (status) {
    case "added":    return COLORS.added
    case "removed":  return COLORS.removed
    case "modified": return COLORS.modified
    case "unchanged": return COLORS.unchanged
  }
}

export function statusBg(status: DiffStatus): string {
  switch (status) {
    case "added":    return COLORS.addedBg
    case "removed":  return COLORS.removedBg
    case "modified": return COLORS.modifiedBg
    case "unchanged": return COLORS.unchangedBg
  }
}

export function statusLabel(status: DiffStatus): string {
  switch (status) {
    case "added":    return "ADDED"
    case "removed":  return "REMOVED"
    case "modified": return "MODIFIED"
    case "unchanged": return "OK"
  }
}

export function statusSymbol(status: DiffStatus): string {
  switch (status) {
    case "added":    return "+"
    case "removed":  return "−"
    case "modified": return "~"
    case "unchanged": return "="
  }
}
