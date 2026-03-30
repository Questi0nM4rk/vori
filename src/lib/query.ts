import type { Note } from "./types.ts";

/**
 * Resolve a dot-notation key path against an object.
 * e.g. "tags.domain" on { tags: { domain: "testing" } } → "testing"
 */
function getNestedValue(obj: Record<string, unknown>, dotKey: string): unknown {
  const parts = dotKey.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Check if a frontmatter value matches the query string.
 * Supports array contains, scalar equality, and string coercion.
 */
function valueMatches(fieldValue: unknown, queryValue: string): boolean {
  if (fieldValue === undefined || fieldValue === null) return false;
  if (Array.isArray(fieldValue)) {
    return fieldValue.some((item) => String(item) === queryValue);
  }
  return String(fieldValue) === queryValue;
}

/**
 * Filter notes where frontmatter[key] matches value.
 * Supports dot notation for nested keys (e.g. "tags.domain=testing").
 * Arrays are matched with contains semantics.
 */
export function filterByFrontmatter(notes: Note[], key: string, value: string): Note[] {
  return notes.filter((note) => {
    const fieldValue = getNestedValue(note.frontmatter, key);
    return valueMatches(fieldValue, value);
  });
}

/**
 * Filter notes where note.hashtags includes the given tag.
 * Case-insensitive — normalizes both stored and query tag to lowercase.
 */
export function filterByHashtag(notes: Note[], tag: string): Note[] {
  const lower = tag.toLowerCase();
  return notes.filter((note) => note.hashtags.some((t) => t.toLowerCase() === lower));
}

/**
 * Return all notes that contain a [[wikilink]] pointing to targetName.
 * Self-links are excluded with case-insensitive name comparison.
 */
export function getBacklinks(notes: Note[], targetName: string): Note[] {
  const targetLower = targetName.toLowerCase();
  return notes.filter(
    (note) =>
      note.name.toLowerCase() !== targetLower &&
      note.wikilinks.some((link) => link.toLowerCase() === targetLower)
  );
}

/**
 * Normalize a frontmatter date value (string or Date object) to a Date.
 * Returns null for missing or unparsable values.
 */
function toDate(raw: unknown): Date | null {
  if (raw === undefined || raw === null) return null;
  if (raw instanceof Date) return raw;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Full-text search across note title, name, frontmatter values, hashtags, and body.
 * Searches frontmatter values only — not key names.
 */
export function textSearch(notes: Note[], query: string): Note[] {
  const lower = query.toLowerCase();
  return notes.filter((note) => {
    if (note.title.toLowerCase().includes(lower)) return true;
    if (note.name.toLowerCase().includes(lower)) return true;
    // Search frontmatter values only (not key names) to avoid false positives
    const fmValues = Object.values(note.frontmatter)
      .map((v) => (v instanceof Date ? v.toISOString() : String(v)))
      .join(" ")
      .toLowerCase();
    if (fmValues.includes(lower)) return true;
    if (note.hashtags.some((t) => t.toLowerCase().includes(lower))) return true;
    if (note.body.toLowerCase().includes(lower)) return true;
    return false;
  });
}

/**
 * Return notes with a `date` frontmatter field within the last N days,
 * sorted newest-first.
 */
export function recentNotes(notes: Note[], days: number): Note[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  // Pre-compute dates to avoid repeated allocation in sort comparator
  const withDates = notes
    .map((note) => ({ note, date: toDate(note.frontmatter.date) }))
    .filter(({ date }) => date !== null && date >= cutoff) as Array<{
    note: Note;
    date: Date;
  }>;

  withDates.sort((a, b) => b.date.getTime() - a.date.getTime());
  return withDates.map(({ note }) => note);
}

/**
 * Return notes with zero outgoing wikilinks AND zero incoming links from any other note.
 */
export function getOrphans(notes: Note[]): Note[] {
  // Build set of all link targets (lowercased)
  const allTargets = new Set<string>();
  for (const note of notes) {
    for (const link of note.wikilinks) {
      allTargets.add(link.toLowerCase());
    }
  }

  return notes.filter((note) => {
    const hasOutgoing = note.wikilinks.length > 0;
    const hasIncoming = allTargets.has(note.name.toLowerCase());
    return !hasOutgoing && !hasIncoming;
  });
}
