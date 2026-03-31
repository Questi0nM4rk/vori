import { existsSync, readFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { parse as parseYaml } from "yaml";
import type { Note } from "./types.ts";

const SKIP_DIRS = new Set(["node_modules", ".git", ".obsidian"]);

// Matches the closing frontmatter delimiter and any trailing whitespace/newline.
// Handles: \n---\n, \n---\r\n, \n--- \n, \n---<EOF>
const CLOSING_FENCE_RE = /\n---[ \t]*(?:\r?\n|$)/;

export function parseNote(filePath: string, vaultRoot: string): Note {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read ${filePath}: ${msg}`);
  }

  const name = basename(filePath, ".md");
  const path = relative(vaultRoot, filePath);

  // Split frontmatter — opening delimiter must be ---\n (not ---without-newline)
  let frontmatter: Record<string, unknown> = {};
  let body = raw;

  if (raw.startsWith("---\n") || raw.startsWith("---\r\n")) {
    const fenceStart = raw.indexOf("\n", 0); // index of newline after opening ---
    const tail = raw.slice(fenceStart);
    const match = tail.match(CLOSING_FENCE_RE);
    if (match?.index !== undefined) {
      const endPos = fenceStart + match.index;
      const yamlText = raw.slice(fenceStart + 1, endPos).trim();
      try {
        const parsed = parseYaml(yamlText);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          frontmatter = parsed as Record<string, unknown>;
        }
      } catch {
        // malformed YAML — leave frontmatter empty
      }
      body = raw.slice(endPos + match[0].length).trim();
    }
  }

  // Extract title from first H1 in body
  const h1Match = body.match(/^#\s+(.+)$/m);
  const title = h1Match ? h1Match[1].trim() : name;

  // Extract #hashtags — skip heading lines and fenced code blocks
  const hashtagSet = new Set<string>();
  let fenceChar: "`" | "~" | null = null;
  for (const line of body.split("\n")) {
    const trimmed = line.trimStart();
    // Track which fence character opened the current fence; only close on matching char
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);
    if (fenceMatch) {
      const ch = fenceMatch[1][0] as "`" | "~";
      if (fenceChar === null) {
        fenceChar = ch;
      } else if (fenceChar === ch) {
        fenceChar = null;
      }
      continue;
    }
    if (fenceChar !== null) continue;
    // Skip heading lines
    if (/^#{1,6}\s/.test(trimmed)) continue;
    for (const m of line.matchAll(/(?:^|\s)#([a-zA-Z][\w-/]*)/g)) {
      hashtagSet.add(m[1]);
    }
  }

  // Extract [[wikilinks]] — exclude ![[embeds]] using negative lookbehind
  // Strip section anchors (#heading) so [[design#Iron Laws]] resolves to "design"
  const wikilinkSet = new Set<string>();
  for (const m of body.matchAll(/(?<!!)\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
    wikilinkSet.add(m[1].trim().replace(/#.*$/, ""));
  }

  return {
    path,
    name,
    title,
    frontmatter,
    hashtags: [...hashtagSet],
    wikilinks: [...wikilinkSet],
    body,
  };
}

/**
 * Recursively load all .md files from a vault directory.
 * Throws if vault path not found. Skips unreadable files with a stderr warning.
 * Symlinked directories are traversed (followSymlinks: true).
 * Skips node_modules, .git, .obsidian.
 */
export function loadVault(vaultPath: string): Note[] {
  if (!existsSync(vaultPath)) {
    throw new Error(`Vault path not found: ${vaultPath}`);
  }

  const notes: Note[] = [];
  const glob = new Bun.Glob("**/*.md");

  for (const file of glob.scanSync({ cwd: vaultPath, followSymlinks: true })) {
    // Skip files under SKIP_DIRS (e.g. node_modules/.git/.obsidian)
    if (file.split("/").some((seg) => SKIP_DIRS.has(seg))) continue;

    const full = join(vaultPath, file);
    try {
      notes.push(parseNote(full, vaultPath));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`vori: warning: skipping ${full}: ${msg}\n`);
    }
  }

  return notes;
}
