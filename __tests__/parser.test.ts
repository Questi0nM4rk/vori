/**
 * parser.test.ts
 *
 * Tests for findings 7, 8, 10, 11, 12 from strict review.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadVault, parseNote } from "../src/lib/parser.ts";

let tmp: string;

beforeEach(() => {
	tmp = mkdtempSync(join(tmpdir(), "vq-parser-test-"));
});

afterEach(() => {
	rmSync(tmp, { recursive: true, force: true });
});

function writeMd(name: string, content: string): string {
	const p = join(tmp, `${name}.md`);
	writeFileSync(p, content, "utf8");
	return p;
}

// ---------------------------------------------------------------------------
// Finding 8: frontmatter detection requires ---\n (not just ---)
// ---------------------------------------------------------------------------

describe("parseNote - frontmatter detection", () => {
	it("ignores --- without trailing newline as frontmatter", () => {
		const p = writeMd("a", "---title: foo\n---\nBody");
		const note = parseNote(p, tmp);
		expect(note.frontmatter).toEqual({});
		expect(note.body).toContain("---title");
	});

	it("parses valid ---\\n frontmatter", () => {
		const p = writeMd("b", "---\ntitle: Hello\n---\nBody text");
		const note = parseNote(p, tmp);
		expect(note.frontmatter.title).toBe("Hello");
		expect(note.body).toBe("Body text");
	});
});

// ---------------------------------------------------------------------------
// Finding 10: closing delimiter handles trailing space and Windows endings
// ---------------------------------------------------------------------------

describe("parseNote - closing delimiter variants", () => {
	it("handles trailing space after closing ---", () => {
		const p = writeMd("c", "---\nfoo: bar\n--- \nBody after");
		const note = parseNote(p, tmp);
		expect(note.frontmatter.foo).toBe("bar");
		expect(note.body).toBe("Body after");
	});

	it("handles Windows line ending after closing ---", () => {
		const p = writeMd("d", "---\nfoo: bar\n---\r\nBody after");
		const note = parseNote(p, tmp);
		expect(note.frontmatter.foo).toBe("bar");
		expect(note.body).toBe("Body after");
	});
});

// ---------------------------------------------------------------------------
// Finding 11: hashtags not extracted from fenced code blocks
// ---------------------------------------------------------------------------

describe("parseNote - hashtag extraction", () => {
	it("does not extract hashtags from fenced code blocks", () => {
		const p = writeMd(
			"e",
			"---\n---\n\n```\n#inside-fence\n```\n\n#outside-fence",
		);
		const note = parseNote(p, tmp);
		expect(note.hashtags).not.toContain("inside-fence");
		expect(note.hashtags).toContain("outside-fence");
	});

	it("resumes hashtag extraction after closing fence", () => {
		const p = writeMd(
			"g",
			"---\n---\n\n#before\n\n```\n#in-fence\n```\n\n#after",
		);
		const note = parseNote(p, tmp);
		expect(note.hashtags).toContain("before");
		expect(note.hashtags).toContain("after");
		expect(note.hashtags).not.toContain("in-fence");
	});
});

// ---------------------------------------------------------------------------
// Finding 12: ![[embed]] not included in wikilinks
// ---------------------------------------------------------------------------

describe("parseNote - wikilink extraction", () => {
	it("excludes ![[embed]] from wikilinks", () => {
		const p = writeMd("h", "---\n---\n\n![[image.png]] and ![[diagram]]");
		const note = parseNote(p, tmp);
		expect(note.wikilinks).not.toContain("image.png");
		expect(note.wikilinks).not.toContain("diagram");
	});

	it("includes [[real-link]] in wikilinks", () => {
		const p = writeMd("i", "---\n---\n\n[[target-note]] and ![[image.png]]");
		const note = parseNote(p, tmp);
		expect(note.wikilinks).toContain("target-note");
		expect(note.wikilinks).not.toContain("image.png");
	});
});

// ---------------------------------------------------------------------------
// Finding 7: unreadable file skipped without aborting loadVault
// ---------------------------------------------------------------------------

describe("loadVault - unreadable file handling", () => {
	it("skips unreadable files and loads remaining notes", () => {
		if (process.getuid?.() === 0) {
			// root can read 000 files — skip this test
			return;
		}
		writeMd("readable", "---\ntitle: Good\n---\nBody");
		const unreadable = writeMd("unreadable", "---\ntitle: Bad\n---\nBody");
		chmodSync(unreadable, 0o000);

		let notes: ReturnType<typeof loadVault> = [];
		expect(() => {
			notes = loadVault(tmp);
		}).not.toThrow();
		expect(notes.map((n) => n.name)).toContain("readable");
		expect(notes.map((n) => n.name)).not.toContain("unreadable");
	});
});
