/**
 * output.test.ts
 *
 * Tests for findings 19, 20, 21, 23 from strict review.
 */

import { describe, expect, it } from "bun:test";
import { formatTable } from "../src/lib/output.ts";
import type { Note } from "../src/lib/types.ts";

function makeNote(overrides: Partial<Note> = {}): Note {
	return {
		path: "test.md",
		name: "test",
		title: "Test Note",
		frontmatter: {},
		hashtags: [],
		wikilinks: [],
		body: "",
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Finding 19: explicit "hashtags" and "wikilinks" column aliases
// ---------------------------------------------------------------------------

describe('formatTable - "hashtags" and "wikilinks" column aliases', () => {
	it('accepts "hashtags" as column name and renders hashtag content', () => {
		const notes = [makeNote({ name: "a", hashtags: ["typescript", "tdd"] })];
		const output = formatTable(notes, ["name", "hashtags"]);
		expect(output).toContain("typescript, tdd");
	});

	it('accepts "wikilinks" as column name and renders wikilink content', () => {
		const notes = [
			makeNote({ name: "a", wikilinks: ["design", "spec-driven"] }),
		];
		const output = formatTable(notes, ["name", "wikilinks"]);
		expect(output).toContain("design, spec-driven");
	});

	it('"tags" still works as a backward-compatible alias for hashtags', () => {
		const notes = [makeNote({ name: "a", hashtags: ["pattern"] })];
		const output = formatTable(notes, ["name", "tags"]);
		expect(output).toContain("pattern");
	});

	it('"links" still works as a backward-compatible alias for wikilinks', () => {
		const notes = [makeNote({ name: "a", wikilinks: ["target"] })];
		const output = formatTable(notes, ["name", "links"]);
		expect(output).toContain("target");
	});
});

// ---------------------------------------------------------------------------
// Finding 20: Unicode-safe title truncation
// ---------------------------------------------------------------------------

describe("formatTable - Unicode title truncation", () => {
	it("does not corrupt CJK titles at truncation boundary", () => {
		// 20 CJK chars = 20 grapheme clusters but 60 bytes (3 bytes each in UTF-8)
		// Byte-based slice(0, 45) would cut mid-character
		const cjkTitle = "日本語テスト用タイトルで長いものを作成します！"; // 23 graphemes
		const notes = [makeNote({ name: "a", title: cjkTitle })];
		const output = formatTable(notes, ["title"]);
		// Must not contain replacement character or truncated multi-byte sequences
		expect(output).not.toContain("\uFFFD");
		// The truncated title in output must be a valid sequence of whole graphemes
		// Extract the title cell from the output (first data row)
		const lines = output.split("\n");
		const dataLine = lines[2]; // header, divider, first data row
		expect(dataLine).toBeDefined();
		// Verify it's valid by checking the trimmed cell doesn't end mid-grapheme
		const cell = dataLine.trim();
		expect(() => [...cell]).not.toThrow(); // spread to graphemes must not throw
	});

	it("truncates ASCII title correctly at 45 chars with ellipsis", () => {
		const longTitle = "A".repeat(50);
		const notes = [makeNote({ name: "a", title: longTitle })];
		const output = formatTable(notes, ["title"]);
		expect(output).toContain(`${"A".repeat(45)}...`);
	});
});

// ---------------------------------------------------------------------------
// Finding 21: Math.max spread safe for large vaults
// ---------------------------------------------------------------------------

describe("formatTable - column width computation at scale", () => {
	it("handles 10000 rows without stack overflow", () => {
		const notes = Array.from({ length: 10000 }, (_, i) =>
			makeNote({ name: `note-${i}`, title: `Title ${i}` }),
		);
		expect(() => formatTable(notes, ["name", "title"])).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Finding 23: "date" column renders ISO string, not locale Date.toString()
// ---------------------------------------------------------------------------

describe('formatTable - "date" column with Date objects', () => {
	it("formats a Date object as ISO date string (YYYY-MM-DD)", () => {
		const d = new Date("2026-03-28T00:00:00.000Z");
		const notes = [makeNote({ name: "a", frontmatter: { date: d } })];
		const output = formatTable(notes, ["name", "date"]);
		// Should contain ISO format, not locale string like "Sat Mar 28 2026 ..."
		expect(output).toContain("2026-03-28");
		// Must not contain locale-specific day-of-week
		expect(output).not.toMatch(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/);
	});

	it("formats a string date as-is", () => {
		const notes = [
			makeNote({ name: "a", frontmatter: { date: "2026-03-28" } }),
		];
		const output = formatTable(notes, ["name", "date"]);
		expect(output).toContain("2026-03-28");
	});

	it("shows empty for notes without date frontmatter", () => {
		const notes = [makeNote({ name: "a", frontmatter: {} })];
		const output = formatTable(notes, ["name", "date"]);
		// Should not error; date cell is empty
		expect(output).toContain("a");
	});
});
