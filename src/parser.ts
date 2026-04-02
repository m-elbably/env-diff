import * as fs from "fs"
import * as yaml from "js-yaml"

export type ParsedFile = {
  path: string
  type: "env" | "yaml" | "json"
  entries: Record<string, string>
  /** 1-based line number for each key in the original file */
  lineNumbers: Record<string, number>
}

// ─── .env Parser ────────────────────────────────────────────────────────────

type EnvParseResult = { entries: Record<string, string>; lineNumbers: Record<string, number> }

function parseEnvFile(content: string): EnvParseResult {
  const entries: Record<string, string> = {}
  const lineNumbers: Record<string, number> = {}
  let lineNum = 0

  for (const rawLine of content.split("\n")) {
    lineNum++
    const line = rawLine.trim()

    // Skip empty lines and comments
    if (!line || line.startsWith("#")) continue

    const eqIndex = line.indexOf("=")
    if (eqIndex === -1) continue

    const key = line.slice(0, eqIndex).trim()
    if (!key) continue

    let value = line.slice(eqIndex + 1).trim()

    // Handle quoted values: "val", 'val'
    if (value.startsWith('"')) {
      const endQuote = value.indexOf('"', 1)
      value = endQuote !== -1 ? value.slice(1, endQuote) : value.slice(1)
    } else if (value.startsWith("'")) {
      const endQuote = value.indexOf("'", 1)
      value = endQuote !== -1 ? value.slice(1, endQuote) : value.slice(1)
    } else {
      // Strip inline comment
      const commentIdx = value.indexOf(" #")
      if (commentIdx !== -1) value = value.slice(0, commentIdx).trim()
    }

    entries[key] = value
    lineNumbers[key] = lineNum
  }

  return { entries, lineNumbers }
}

// ─── YAML Flattener ─────────────────────────────────────────────────────────

function flattenObject(
  obj: unknown,
  prefix = "",
  result: Record<string, string> = {}
): Record<string, string> {
  if (obj === null || obj === undefined) {
    result[prefix] = String(obj)
    return result
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      const key = prefix ? `${prefix}[${i}]` : `[${i}]`
      flattenObject(item, key, result)
    })
    return result
  }

  if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = prefix ? `${prefix}.${k}` : k
      flattenObject(v, key, result)
    }
    return result
  }

  result[prefix] = String(obj)
  return result
}

/** Best-effort line number estimation by scanning raw text for each leaf key */
function estimateLineNumbers(
  content: string,
  entries: Record<string, string>,
  format: "yaml" | "json"
): Record<string, number> {
  const lines = content.split("\n")
  const lineNumbers: Record<string, number> = {}

  for (const key of Object.keys(entries)) {
    // Use the last segment of the dotted key path (strip array indices)
    const leafKey = key.split(".").pop()?.replace(/\[\d+\]$/, "") ?? key
    const pattern =
      format === "yaml"
        ? new RegExp(`(?:^|\\s)${escapeRegex(leafKey)}\\s*:`, "i")
        : new RegExp(`"${escapeRegex(leafKey)}"\\s*:`, "i")

    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        lineNumbers[key] = i + 1
        break
      }
    }
  }

  return lineNumbers
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function parseYamlFile(content: string): EnvParseResult {
  const parsed = yaml.load(content)

  if (!parsed || typeof parsed !== "object") {
    return { entries: {}, lineNumbers: {} }
  }

  const entries = flattenObject(parsed as Record<string, unknown>)
  const lineNumbers = estimateLineNumbers(content, entries, "yaml")
  return { entries, lineNumbers }
}

function parseJsonFile(content: string): EnvParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return { entries: {}, lineNumbers: {} }
  }

  if (!parsed || typeof parsed !== "object") {
    return { entries: {}, lineNumbers: {} }
  }

  const entries = flattenObject(parsed as Record<string, unknown>)
  const lineNumbers = estimateLineNumbers(content, entries, "json")
  return { entries, lineNumbers }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function detectFileType(filePath: string): "env" | "yaml" | "json" {
  const lower = filePath.toLowerCase()
  if (lower.endsWith(".yml") || lower.endsWith(".yaml")) return "yaml"
  if (lower.endsWith(".json")) return "json"
  return "env"
}

export function parseFile(filePath: string): ParsedFile {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }

  const content = fs.readFileSync(filePath, "utf-8")
  const type = detectFileType(filePath)

  let result: EnvParseResult
  if (type === "yaml") {
    result = parseYamlFile(content)
  } else if (type === "json") {
    result = parseJsonFile(content)
  } else {
    result = parseEnvFile(content)
  }

  return { path: filePath, type, entries: result.entries, lineNumbers: result.lineNumbers }
}
