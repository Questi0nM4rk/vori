/**
 * check-doc-counts.test.ts
 *
 * Unit tests for the doc-count drift guard's PURE logic.
 *
 * The guard script (scripts/check-doc-counts.ts) runs `bun test` in a
 * subprocess to get the source-of-truth test count. That execution is
 * deliberately NOT exercised here: we test only the pure parse + compare
 * functions, which carry all the drift logic. The subprocess call is a thin
 * shell around `parseRanCount`, which IS tested.
 */

import { describe, expect, it } from "bun:test";
import {
  extractTestCountClaims,
  extractVersionMarkers,
  findTestCountMismatches,
  findVersionMarkerMismatches,
  parseRanCount,
} from "../scripts/check-doc-counts.ts";

describe("parseRanCount", () => {
  it("extracts the count from a bun test summary line", () => {
    const out = " 45 pass\n 0 fail\nRan 45 tests across 4 files. [251.00ms]";
    expect(parseRanCount(out)).toBe(45);
  });

  it("handles the count appearing with no surrounding pass/fail lines", () => {
    expect(parseRanCount("Ran 7 tests across 1 files. [1.00ms]")).toBe(7);
  });

  it("returns the last match when the phrase appears more than once", () => {
    // Defensive: bun prints one summary, but a wrapper could echo an earlier
    // partial. The final 'Ran N tests' is the authoritative total.
    const out = "Ran 10 tests across 2 files.\n...\nRan 45 tests across 4 files.";
    expect(parseRanCount(out)).toBe(45);
  });

  it("returns null when no summary line is present", () => {
    expect(parseRanCount("error: something blew up\nno summary here")).toBeNull();
  });

  it("returns null on an empty string", () => {
    expect(parseRanCount("")).toBeNull();
  });
});

describe("extractTestCountClaims", () => {
  it("matches a bare 'N tests' claim", () => {
    expect(extractTestCountClaims("bun test  # 45 tests")).toEqual([45]);
  });

  it("matches an 'N TypeScript tests' claim", () => {
    expect(extractTestCountClaims("- **45 TypeScript tests** via bun test")).toEqual([
      45,
    ]);
  });

  it("collects every claim in a document", () => {
    const content = "245 tests here\nand 45 TypeScript tests there";
    expect(extractTestCountClaims(content)).toEqual([245, 45]);
  });

  it("does not match 'Go tests' as a test claim source of truth", () => {
    // The pattern intentionally matches any 'N tests' / 'N TypeScript tests'.
    // A word other than 'TypeScript' between the number and 'tests' (e.g. 'Go')
    // must NOT be captured — assert the regex skips '52 Go tests'.
    expect(extractTestCountClaims("**52 Go tests**")).toEqual([]);
  });

  it("returns an empty array when there is no claim", () => {
    expect(extractTestCountClaims("no counts in this prose at all")).toEqual([]);
  });
});

describe("findTestCountMismatches", () => {
  const docs = [
    { path: "README.md", content: "- **45 tests**" },
    { path: "CLAUDE.md", content: "bun test  # 45 tests" },
  ];

  it("reports no violations when every claim matches the truth", () => {
    expect(findTestCountMismatches(45, docs)).toEqual([]);
  });

  it("reports a violation for a stale claim", () => {
    const stale = [{ path: "README.md", content: "- **245 tests**" }];
    const v = findTestCountMismatches(45, stale);
    expect(v).toHaveLength(1);
    expect(v[0]?.detail).toContain("README.md");
    expect(v[0]?.detail).toContain("245");
    expect(v[0]?.detail).toContain("45");
  });

  it("reports one violation per mismatched claim across docs", () => {
    const mixed = [
      { path: "README.md", content: "245 tests" },
      { path: "CLAUDE.md", content: "45 tests" },
    ];
    expect(findTestCountMismatches(45, mixed)).toHaveLength(1);
  });

  it("a doc with no claim is fine (not every doc carries a count)", () => {
    const partial = [
      { path: "README.md", content: "- **45 tests**" },
      { path: "CLAUDE.md", content: "no count in this one" },
    ];
    expect(findTestCountMismatches(45, partial)).toEqual([]);
  });
});

describe("extractVersionMarkers", () => {
  it("captures a 'Current: vX.Y.Z' marker", () => {
    expect(extractVersionMarkers("Current: v1.0.0")).toEqual(["1.0.0"]);
  });

  it("captures a 'Status: X.Y.Z' marker without the v prefix", () => {
    expect(extractVersionMarkers("Status: 1.2.3")).toEqual(["1.2.3"]);
  });

  it("captures multiple markers", () => {
    expect(extractVersionMarkers("Current: v1.0.0\nStatus:  v1.0.0")).toEqual([
      "1.0.0",
      "1.0.0",
    ]);
  });

  it("ignores plain version strings that are not Current/Status markers", () => {
    // The npm badge and prose mentions of versions must NOT trip the guard;
    // only the hardcoded Current:/Status: markers do.
    expect(extractVersionMarkers("shipped in v1.0.0; see the badge")).toEqual([]);
  });

  it("returns an empty array when there are no markers", () => {
    expect(extractVersionMarkers("no version markers here")).toEqual([]);
  });
});

describe("findVersionMarkerMismatches", () => {
  it("no violations when no markers exist (the preferred state)", () => {
    expect(findVersionMarkerMismatches("1.0.0", "rely on the npm badge")).toEqual([]);
  });

  it("no violations when a marker agrees with package.json", () => {
    expect(findVersionMarkerMismatches("1.0.0", "Current: v1.0.0")).toEqual([]);
  });

  it("reports a violation when a marker disagrees with package.json", () => {
    const v = findVersionMarkerMismatches("1.0.0", "Current: v0.9.0");
    expect(v).toHaveLength(1);
    expect(v[0]?.detail).toContain("0.9.0");
    expect(v[0]?.detail).toContain("1.0.0");
  });
});
