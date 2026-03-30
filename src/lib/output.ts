import type { Note } from "./types.ts";

/**
 * Truncate a string to at most maxGraphemes grapheme clusters.
 * Uses Intl.Segmenter for Unicode-safe truncation (handles CJK, emoji, combining chars).
 */
function truncateGraphemes(s: string, maxGraphemes: number, ellipsis = "..."): string {
  const segmenter = new Intl.Segmenter();
  const segments = [...segmenter.segment(s)];
  if (segments.length <= maxGraphemes) return s;
  return (
    segments
      .slice(0, maxGraphemes - ellipsis.length)
      .map((seg) => seg.segment)
      .join("") + ellipsis
  );
}

/**
 * Format notes as a plain-text table.
 *
 * Column names:
 *   "name"      — note filename without .md
 *   "title"     — first H1 or filename (truncated to 48 graphemes)
 *   "hashtags"  — #hashtags from body (also accepts legacy alias "tags")
 *   "wikilinks" — [[wikilinks]] from body (also accepts legacy alias "links")
 *   "path"      — path relative to vault root
 *   "date"      — frontmatter date field, rendered as ISO date string
 *   <other>     — frontmatter field lookup by name
 */
export function formatTable(notes: Note[], columns?: string[]): string {
  if (notes.length === 0) return "No notes found.\n";

  const cols = columns ?? ["name", "title", "hashtags", "wikilinks"];
  const rows: string[][] = notes.map((note) => {
    return cols.map((col) => {
      switch (col) {
        case "name":
          return note.name;
        case "title":
          return truncateGraphemes(note.title, 48);
        case "tags": // legacy alias
        case "hashtags":
          return note.hashtags.length > 0 ? note.hashtags.join(", ") : "(none)";
        case "links": // legacy alias
        case "wikilinks":
          return note.wikilinks.length > 0 ? note.wikilinks.join(", ") : "(none)";
        case "path":
          return note.path;
        case "date": {
          const val = note.frontmatter.date;
          if (val === undefined || val === null) return "";
          if (val instanceof Date) return val.toISOString().slice(0, 10);
          return String(val);
        }
        default: {
          // frontmatter field lookup
          const val = note.frontmatter[col];
          if (val === undefined || val === null) return "";
          if (val instanceof Date) return val.toISOString().slice(0, 10);
          if (Array.isArray(val)) return val.join(", ");
          return String(val);
        }
      }
    });
  });

  // Calculate column widths using reduce to avoid spread call-stack limit on large vaults
  const headers = cols.map((c) => c.toUpperCase());
  const widths = headers.map((h, i) =>
    rows.reduce((max, r) => Math.max(max, r[i].length), h.length)
  );

  const header = headers.map((h, i) => h.padEnd(widths[i])).join("  ");
  const divider = widths.map((w) => "─".repeat(w)).join("  ");
  const body = rows
    .map((row) => row.map((cell, i) => cell.padEnd(widths[i])).join("  "))
    .join("\n");

  return `${header}\n${divider}\n${body}\n\n${notes.length} note(s)\n`;
}

/**
 * Format any data as indented JSON.
 */
export function formatJson(data: unknown): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}
