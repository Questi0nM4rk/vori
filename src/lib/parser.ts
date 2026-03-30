import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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
  let inFence = false;
  for (const line of body.split("\n")) {
    const trimmed = line.trimStart();
    // Toggle fence state on ``` or ~~~ markers
    if (/^(`{3,}|~{3,})/.test(trimmed)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    // Skip heading lines
    if (/^#{1,6}\s/.test(trimmed)) continue;
    for (const m of line.matchAll(/(?:^|\s)#([a-zA-Z][\w-/]*)/g)) {
      hashtagSet.add(m[1]);
    }
  }

  // Extract [[wikilinks]] — exclude ![[embeds]] using negative lookbehind
  const wikilinkSet = new Set<string>();
  for (const m of body.matchAll(/(?<!!)\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
    wikilinkSet.add(m[1].trim());
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
 * Note: symlinks to directories are traversed via statSync; symlinks to .md files included.
 */
export function loadVault(vaultPath: string): Note[] {
  if (!existsSync(vaultPath)) {
    throw new Error(`Vault path not found: ${vaultPath}`);
  }

  const notes: Note[] = [];

  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);

      // Resolve symlinks for directory detection (isDirectory() returns false for symlinks)
      let isDir = entry.isDirectory();
      if (entry.isSymbolicLink()) {
        try {
          isDir = statSync(full).isDirectory();
        } catch {
          continue; // broken symlink — skip
        }
      }

      if (isDir) {
        walk(full);
      } else if (
        entry.name.endsWith(".md") ||
        (entry.isSymbolicLink() && full.endsWith(".md"))
      ) {
        try {
          notes.push(parseNote(full, vaultPath));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          process.stderr.write(`vq: warning: skipping ${full}: ${msg}\n`);
        }
      }
    }
  }

  walk(vaultPath);
  return notes;
}
