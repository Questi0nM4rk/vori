/**
 * parseArgs.test.ts
 *
 * Tests for findings 1, 2, 3, 4, 5, 6 from strict review.
 * parseArgs is exported from main.ts.
 */

import { describe, expect, it } from "bun:test";
import { parseArgs } from "../src/main.ts";

// Helper: prefix with "node vq" to simulate process.argv
function argv(...args: string[]): string[] {
  return ["node", "vq", ...args];
}

// ---------------------------------------------------------------------------
// Finding 1 & 3: single-pass parser — flags before vault path don't interfere
// ---------------------------------------------------------------------------

describe("parseArgs - positional arg detection", () => {
  it("finds vaultPath when --json appears before it", () => {
    const r = parseArgs(argv("list", "--json", "my-vault"));
    expect(r.vaultPath).toBe("my-vault");
    expect(r.json).toBe(true);
  });

  it("finds noteArg when --json appears between vault and note", () => {
    const r = parseArgs(argv("links", "my-vault", "--json", "note-name"));
    expect(r.vaultPath).toBe("my-vault");
    expect(r.noteArg).toBe("note-name");
  });

  it("correctly distinguishes vault and note when both present with flags interleaved", () => {
    const r = parseArgs(
      argv("search", "my-vault", "--tag", "key=value", "search-query")
    );
    expect(r.vaultPath).toBe("my-vault");
    expect(r.noteArg).toBe("search-query");
    expect(r.tags).toEqual([{ key: "key", value: "value" }]);
  });

  it("returns undefined vaultPath when only command given", () => {
    const r = parseArgs(argv("list"));
    expect(r.vaultPath).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Finding 4: malformed --tag emits error
// ---------------------------------------------------------------------------

describe("parseArgs - --tag validation", () => {
  it("records error for --tag without = separator", () => {
    const r = parseArgs(argv("query", "vault", "--tag", "badvalue"));
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors[0]).toMatch(/--tag/);
  });

  it("records error for --tag with empty key (=value form)", () => {
    const r = parseArgs(argv("query", "vault", "--tag", "=value"));
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("accepts valid --tag key=value", () => {
    const r = parseArgs(argv("query", "vault", "--tag", "layer=methodology"));
    expect(r.errors).toHaveLength(0);
    expect(r.tags).toEqual([{ key: "layer", value: "methodology" }]);
  });

  it("accepts --tag with value containing =", () => {
    const r = parseArgs(argv("query", "vault", "--tag", "key=a=b"));
    expect(r.errors).toHaveLength(0);
    expect(r.tags[0]).toEqual({ key: "key", value: "a=b" });
  });
});

// ---------------------------------------------------------------------------
// Finding 5: invalid --days emits error instead of silent discard
// ---------------------------------------------------------------------------

describe("parseArgs - --days validation", () => {
  it("records error for --days=0", () => {
    const r = parseArgs(argv("recent", "vault", "--days=0"));
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors[0]).toMatch(/--days/);
  });

  it("records error for --days=-1", () => {
    const r = parseArgs(argv("recent", "vault", "--days=-1"));
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("records error for --days=abc (NaN)", () => {
    const r = parseArgs(argv("recent", "vault", "--days=abc"));
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("accepts --days=14 and uses it", () => {
    const r = parseArgs(argv("recent", "vault", "--days=14"));
    expect(r.errors).toHaveLength(0);
    expect(r.days).toBe(14);
  });

  it("accepts --days=1 (minimum valid value)", () => {
    const r = parseArgs(argv("recent", "vault", "--days=1"));
    expect(r.errors).toHaveLength(0);
    expect(r.days).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Finding 2: no dead guard (structural — verified by parser producing correct results)
// ---------------------------------------------------------------------------

describe("parseArgs - parser completeness", () => {
  it("handles all flags in one pass without double-consuming positionals", () => {
    const r = parseArgs(
      argv(
        "query",
        "my-vault",
        "--tag",
        "phase=planning",
        "--hashtag",
        "important",
        "--json",
        "--days=30"
      )
    );
    expect(r.vaultPath).toBe("my-vault");
    expect(r.tags).toEqual([{ key: "phase", value: "planning" }]);
    expect(r.hashtags).toEqual(["important"]);
    expect(r.json).toBe(true);
    expect(r.days).toBe(30);
    expect(r.errors).toHaveLength(0);
  });
});
