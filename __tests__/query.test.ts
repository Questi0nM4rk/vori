/**
 * query.test.ts
 *
 * Tests for findings 14, 15, 16, 17, 18 from strict review.
 */

import { describe, expect, it } from "bun:test";
import {
	filterByHashtag,
	getBacklinks,
	recentNotes,
	textSearch,
} from "../src/lib/query.ts";
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
// Finding 14: filterByHashtag case-insensitive
// ---------------------------------------------------------------------------

describe("filterByHashtag - case insensitivity", () => {
	it("matches query in different case than stored hashtag", () => {
		const notes = [
			makeNote({ name: "a", hashtags: ["Important"] }),
			makeNote({ name: "b", hashtags: ["other"] }),
		];
		const result = filterByHashtag(notes, "important");
		expect(result.map((n) => n.name)).toEqual(["a"]);
	});

	it("matches uppercase query against lowercase stored hashtag", () => {
		const notes = [makeNote({ name: "a", hashtags: ["typescript"] })];
		const result = filterByHashtag(notes, "TypeScript");
		expect(result).toHaveLength(1);
	});

	it("still excludes non-matching notes", () => {
		const notes = [
			makeNote({ name: "a", hashtags: ["rust"] }),
			makeNote({ name: "b", hashtags: ["go"] }),
		];
		const result = filterByHashtag(notes, "Python");
		expect(result).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Finding 15: getBacklinks self-link excludes with case mismatch
// ---------------------------------------------------------------------------

describe("getBacklinks - self-link case normalization", () => {
	it("excludes self-link when note name and wikilink differ in case", () => {
		// "TDD-Workflow" has wikilink to "tdd-workflow" (self-reference, different case)
		const notes = [
			makeNote({ name: "TDD-Workflow", wikilinks: ["tdd-workflow"] }),
			makeNote({ name: "other-note", wikilinks: ["tdd-workflow"] }),
		];
		const backlinks = getBacklinks(notes, "tdd-workflow");
		expect(backlinks.map((n) => n.name)).not.toContain("TDD-Workflow");
		expect(backlinks.map((n) => n.name)).toContain("other-note");
	});

	it("excludes self-link when query is uppercase but note name is lowercase", () => {
		const notes = [makeNote({ name: "design", wikilinks: ["Design"] })];
		const backlinks = getBacklinks(notes, "Design");
		expect(backlinks).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Finding 16: textSearch searches values only, not JSON-stringified keys
// ---------------------------------------------------------------------------

describe("textSearch - values only, not JSON keys", () => {
	it("does not match a frontmatter key name that appears in JSON.stringify output", () => {
		// Without the fix, JSON.stringify({active: true}) = '{"active":true}'
		// so searching "active" would match because it's in the JSON string
		const notes = [
			makeNote({
				name: "a",
				frontmatter: { active: true },
				body: "",
				title: "Unrelated",
			}),
			makeNote({
				name: "b",
				frontmatter: { status: "active" },
				title: "Unrelated",
			}),
		];
		const result = textSearch(notes, "active");
		// Only note b (value "active") should match, not note a (key "active")
		expect(result.map((n) => n.name)).not.toContain("a");
		expect(result.map((n) => n.name)).toContain("b");
	});

	it("matches frontmatter values", () => {
		const notes = [
			makeNote({ name: "a", frontmatter: { description: "active learning" } }),
		];
		const result = textSearch(notes, "active");
		expect(result).toHaveLength(1);
	});

	it("does not match null-valued fields via JSON.stringify", () => {
		// JSON.stringify({x: null}) = '{"x":null}' — "null" should not match key names
		const notes = [
			makeNote({ name: "a", frontmatter: { optionalField: null } }),
		];
		// Searching "optionalField" (a key name) should NOT match
		const result = textSearch(notes, "optionalField");
		expect(result).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Finding 17: recentNotes handles Date objects from yaml parsing
// ---------------------------------------------------------------------------

describe("recentNotes - Date object in frontmatter", () => {
	it("includes note when frontmatter.date is a Date object within range", () => {
		// yaml parses `date: 2026-03-28` as Date("2026-03-28") — 2 days before 2026-03-30
		const recentDate = new Date();
		recentDate.setDate(recentDate.getDate() - 2); // 2 days ago
		const notes = [
			makeNote({ name: "recent", frontmatter: { date: recentDate } }),
			makeNote({ name: "no-date", frontmatter: {} }),
		];
		const result = recentNotes(notes, 7);
		expect(result.map((n) => n.name)).toContain("recent");
		expect(result.map((n) => n.name)).not.toContain("no-date");
	});

	it("excludes note when frontmatter.date is a Date object outside range", () => {
		const oldDate = new Date("2020-01-01");
		const notes = [makeNote({ name: "old", frontmatter: { date: oldDate } })];
		const result = recentNotes(notes, 7);
		expect(result).toHaveLength(0);
	});

	it("handles string date correctly alongside Date object", () => {
		const recentDate = new Date();
		recentDate.setDate(recentDate.getDate() - 1);
		const isoString = recentDate.toISOString().slice(0, 10);
		const notes = [
			makeNote({ name: "string-date", frontmatter: { date: isoString } }),
			makeNote({ name: "date-object", frontmatter: { date: recentDate } }),
		];
		const result = recentNotes(notes, 7);
		expect(result).toHaveLength(2);
	});

	it("sorts newest-first when mixing Date objects and strings", () => {
		const d1 = new Date();
		d1.setDate(d1.getDate() - 1); // yesterday
		const d2 = new Date();
		d2.setDate(d2.getDate() - 3); // 3 days ago
		const notes = [
			makeNote({ name: "older", frontmatter: { date: d2 } }),
			makeNote({ name: "newer", frontmatter: { date: d1 } }),
		];
		const result = recentNotes(notes, 7);
		expect(result[0].name).toBe("newer");
		expect(result[1].name).toBe("older");
	});
});
