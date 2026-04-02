import { expect, test, describe } from "bun:test"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { parseFile, detectFileType } from "../src/parser"

function withTempFile(content: string, ext: string, fn: (filePath: string) => void) {
  const tmpPath = path.join(os.tmpdir(), `env-diff-test-${Date.now()}-${Math.random()}${ext}`)
  fs.writeFileSync(tmpPath, content, "utf-8")
  try {
    fn(tmpPath)
  } finally {
    fs.unlinkSync(tmpPath)
  }
}

// ─── detectFileType ───────────────────────────────────────────────────────────

describe("detectFileType", () => {
  test("detects .yaml", () => {
    expect(detectFileType("app.yaml")).toBe("yaml")
    expect(detectFileType("/path/to/config.yaml")).toBe("yaml")
  })

  test("detects .yml", () => {
    expect(detectFileType("app.yml")).toBe("yaml")
  })

  test("detects .json", () => {
    expect(detectFileType("config.json")).toBe("json")
    expect(detectFileType("/path/config.json")).toBe("json")
  })

  test("defaults to env for .env files", () => {
    expect(detectFileType(".env")).toBe("env")
    expect(detectFileType(".env.production")).toBe("env")
    expect(detectFileType(".env.local")).toBe("env")
  })

  test("defaults to env for unknown extensions", () => {
    expect(detectFileType("config")).toBe("env")
    expect(detectFileType("settings.conf")).toBe("env")
  })
})

// ─── .env parser ─────────────────────────────────────────────────────────────

describe("parseFile - .env", () => {
  test("parses basic key=value pairs", () => {
    withTempFile("DB_HOST=localhost\nDB_PORT=5432\nAPP_NAME=myapp", ".env", (p) => {
      const result = parseFile(p)
      expect(result.type).toBe("env")
      expect(result.entries).toEqual({
        DB_HOST: "localhost",
        DB_PORT: "5432",
        APP_NAME: "myapp",
      })
    })
  })

  test("tracks 1-based line numbers", () => {
    withTempFile("DB_HOST=localhost\nDB_PORT=5432", ".env", (p) => {
      const result = parseFile(p)
      expect(result.lineNumbers["DB_HOST"]).toBe(1)
      expect(result.lineNumbers["DB_PORT"]).toBe(2)
    })
  })

  test("skips blank lines and # comments", () => {
    withTempFile("# a comment\n\nFOO=bar\n# another\nBAZ=qux", ".env", (p) => {
      const result = parseFile(p)
      expect(Object.keys(result.entries)).toEqual(["FOO", "BAZ"])
      expect(result.lineNumbers["FOO"]).toBe(3)
      expect(result.lineNumbers["BAZ"]).toBe(5)
    })
  })

  test("strips double-quoted values", () => {
    withTempFile(`A="hello world"`, ".env", (p) => {
      const result = parseFile(p)
      expect(result.entries["A"]).toBe("hello world")
    })
  })

  test("strips single-quoted values", () => {
    withTempFile(`B='single quoted'`, ".env", (p) => {
      const result = parseFile(p)
      expect(result.entries["B"]).toBe("single quoted")
    })
  })

  test("strips inline comments from unquoted values", () => {
    withTempFile("FOO=bar # inline comment", ".env", (p) => {
      const result = parseFile(p)
      expect(result.entries["FOO"]).toBe("bar")
    })
  })

  test("handles empty values", () => {
    withTempFile("EMPTY=\nALSO_EMPTY=", ".env", (p) => {
      const result = parseFile(p)
      expect(result.entries["EMPTY"]).toBe("")
      expect(result.entries["ALSO_EMPTY"]).toBe("")
    })
  })

  test("skips lines without =", () => {
    withTempFile("VALID=yes\nNO_EQUALS\nALSO_VALID=ok", ".env", (p) => {
      const result = parseFile(p)
      expect(Object.keys(result.entries)).toEqual(["VALID", "ALSO_VALID"])
    })
  })
})

// ─── JSON parser ─────────────────────────────────────────────────────────────

describe("parseFile - .json", () => {
  test("parses flat JSON object", () => {
    withTempFile(JSON.stringify({ DB_HOST: "localhost", DB_PORT: "5432" }), ".json", (p) => {
      const result = parseFile(p)
      expect(result.type).toBe("json")
      expect(result.entries["DB_HOST"]).toBe("localhost")
      expect(result.entries["DB_PORT"]).toBe("5432")
    })
  })

  test("flattens nested JSON with dot notation", () => {
    withTempFile(JSON.stringify({ db: { host: "localhost", port: 5432 } }), ".json", (p) => {
      const result = parseFile(p)
      expect(result.entries["db.host"]).toBe("localhost")
      expect(result.entries["db.port"]).toBe("5432")
    })
  })

  test("flattens deeply nested JSON", () => {
    withTempFile(JSON.stringify({ a: { b: { c: "deep" } } }), ".json", (p) => {
      const result = parseFile(p)
      expect(result.entries["a.b.c"]).toBe("deep")
    })
  })

  test("converts numeric values to strings", () => {
    withTempFile(JSON.stringify({ PORT: 8080, TIMEOUT: 30 }), ".json", (p) => {
      const result = parseFile(p)
      expect(result.entries["PORT"]).toBe("8080")
      expect(result.entries["TIMEOUT"]).toBe("30")
    })
  })

  test("converts boolean values to strings", () => {
    withTempFile(JSON.stringify({ DEBUG: true, PROD: false }), ".json", (p) => {
      const result = parseFile(p)
      expect(result.entries["DEBUG"]).toBe("true")
      expect(result.entries["PROD"]).toBe("false")
    })
  })

  test("returns empty entries for invalid JSON", () => {
    withTempFile("{invalid json}", ".json", (p) => {
      const result = parseFile(p)
      expect(result.entries).toEqual({})
      expect(result.lineNumbers).toEqual({})
    })
  })

  test("returns empty entries for non-object JSON", () => {
    withTempFile('"just a string"', ".json", (p) => {
      const result = parseFile(p)
      expect(result.entries).toEqual({})
    })
  })
})

// ─── YAML parser ─────────────────────────────────────────────────────────────

describe("parseFile - .yaml", () => {
  test("parses flat YAML", () => {
    withTempFile("db_host: localhost\ndb_port: 5432", ".yaml", (p) => {
      const result = parseFile(p)
      expect(result.type).toBe("yaml")
      expect(result.entries["db_host"]).toBe("localhost")
      expect(result.entries["db_port"]).toBe("5432")
    })
  })

  test("flattens nested YAML with dot notation", () => {
    withTempFile("db:\n  host: localhost\n  port: 5432", ".yaml", (p) => {
      const result = parseFile(p)
      expect(result.entries["db.host"]).toBe("localhost")
      expect(result.entries["db.port"]).toBe("5432")
    })
  })

  test("handles .yml extension", () => {
    withTempFile("key: value", ".yml", (p) => {
      const result = parseFile(p)
      expect(result.type).toBe("yaml")
      expect(result.entries["key"]).toBe("value")
    })
  })

  test("estimates line numbers for top-level keys", () => {
    withTempFile("first: a\nsecond: b\nthird: c", ".yaml", (p) => {
      const result = parseFile(p)
      expect(result.lineNumbers["first"]).toBe(1)
      expect(result.lineNumbers["second"]).toBe(2)
      expect(result.lineNumbers["third"]).toBe(3)
    })
  })

  test("returns empty entries for empty YAML", () => {
    withTempFile("", ".yaml", (p) => {
      const result = parseFile(p)
      expect(result.entries).toEqual({})
    })
  })
})

// ─── Error handling ───────────────────────────────────────────────────────────

test("throws for non-existent file", () => {
  expect(() => parseFile("/nonexistent/path/file.env")).toThrow("File not found")
})
