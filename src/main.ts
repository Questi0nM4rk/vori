import { resolve } from "node:path";
import { formatJson, formatTable } from "./lib/output.ts";
import { loadVault } from "./lib/parser.ts";
import {
  filterByFrontmatter,
  filterByHashtag,
  getBacklinks,
  getOrphans,
  recentNotes,
  textSearch,
} from "./lib/query.ts";

const USAGE = `vori — vault query CLI for markdown vaults

Usage: vori <command> <vault-path> [options]

Commands:
  list <vault>                       List all .md files with frontmatter summary
  query <vault> --tag key=value      Filter notes by frontmatter key/value
                [--tag key2=value2]  Multiple --tag flags are ANDed
                [--hashtag tag]      Filter by #hashtag in body
  tags <vault>                       List all frontmatter keys + #hashtags with counts
  links <vault> <note-name>          Show outgoing [[wikilinks]] from a note
  backlinks <vault> <note-name>      Show incoming links to a note
  orphans <vault>                    Notes with zero incoming and outgoing links
  search <vault> <query>             Full-text search across title, frontmatter, body
  recent <vault> [--days=7]          Notes with 'date' frontmatter within last N days

Options:
  --json       Output as JSON
  --days=N     Number of days back for 'recent' command (default: 7)
  --help       Show this help

Examples:
  vori list skill-graph/skills
  vori query skill-graph/skills --tag "layer=methodology"
  vori query skill-graph/skills --tag "tags.domain=testing" --hashtag important
  vori tags skill-graph/skills
  vori links skill-graph/skills design
  vori backlinks skill-graph/skills tdd-workflow
  vori orphans skill-graph/skills
  vori search ~/.claude/mem-vault "bun test isolation"
  vori recent ~/.claude/mem-vault --days=14
  vori list skill-graph/skills --json | jq '.[].name'
`;

export interface ParseResult {
  command: string | undefined;
  vaultPath: string | undefined;
  noteArg: string | undefined;
  tags: Array<{ key: string; value: string }>;
  hashtags: string[];
  json: boolean;
  days: number;
  errors: string[];
}

/**
 * Single-pass argument parser.
 *
 * Positional args are the first N non-flag tokens after the command:
 *   argv[0] = command (already extracted)
 *   first non-flag → vaultPath
 *   second non-flag → noteArg
 *
 * All flag tokens are parsed in the same pass, so flag position relative to
 * positionals does not affect parsing.
 */
export function parseArgs(argv: string[]): ParseResult {
  const args = argv.slice(2);
  const command = args[0];
  const errors: string[] = [];

  const tags: Array<{ key: string; value: string }> = [];
  const hashtags: string[] = [];
  let json = false;
  let days = 7;
  let vaultPath: string | undefined;
  let noteArg: string | undefined;

  let i = 1; // skip command at index 0
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--json") {
      json = true;
      i++;
    } else if (arg === "--help" || arg === "-h") {
      i++;
    } else if (arg === "--tag") {
      if (i + 1 < args.length) {
        const kv = args[i + 1];
        const eqIdx = kv.indexOf("=");
        if (eqIdx <= 0) {
          errors.push(
            `Error: --tag requires "key=value" format, got: ${JSON.stringify(kv)}`
          );
        } else {
          tags.push({ key: kv.slice(0, eqIdx), value: kv.slice(eqIdx + 1) });
        }
        i += 2;
      } else {
        errors.push("Error: --tag requires a value");
        i++;
      }
    } else if (arg === "--hashtag") {
      if (i + 1 < args.length) {
        hashtags.push(args[i + 1]);
        i += 2;
      } else {
        errors.push("Error: --hashtag requires a value");
        i++;
      }
    } else if (arg.startsWith("--days=")) {
      const raw = arg.slice("--days=".length);
      const n = parseInt(raw, 10);
      if (Number.isNaN(n) || n <= 0) {
        errors.push(
          `Error: --days requires a positive integer, got: ${JSON.stringify(raw)}`
        );
      } else {
        days = n;
      }
      i++;
    } else if (!arg.startsWith("-")) {
      // Positional arg
      if (vaultPath === undefined) {
        vaultPath = arg;
      } else if (noteArg === undefined) {
        noteArg = arg;
      }
      i++;
    } else {
      // Unknown flag — skip
      i++;
    }
  }

  return { command, vaultPath, noteArg, tags, hashtags, json, days, errors };
}

function main(): void {
  const { command, vaultPath, noteArg, tags, hashtags, json, days, errors } = parseArgs(
    process.argv
  );

  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(USAGE);
    return;
  }

  if (errors.length > 0) {
    for (const err of errors) {
      process.stderr.write(`${err}\n`);
    }
    process.stderr.write("Run 'vori --help' for usage.\n");
    process.exit(1);
  }

  if (!vaultPath) {
    process.stderr.write("Error: vault-path is required.\n");
    process.stderr.write("Run 'vori --help' for usage.\n");
    process.exit(1);
  }

  const absVault = resolve(vaultPath);

  switch (command) {
    case "list": {
      const notes = loadVault(absVault);
      if (json) {
        process.stdout.write(formatJson(notes));
      } else {
        process.stdout.write(
          formatTable(notes, ["name", "title", "hashtags", "wikilinks"])
        );
      }
      break;
    }

    case "query": {
      let notes = loadVault(absVault);

      // Apply all --tag filters (AND semantics)
      for (const { key, value } of tags) {
        notes = filterByFrontmatter(notes, key, value);
      }

      // Apply all --hashtag filters (AND semantics)
      for (const tag of hashtags) {
        notes = filterByHashtag(notes, tag);
      }

      if (tags.length === 0 && hashtags.length === 0) {
        process.stderr.write(
          "Warning: no --tag or --hashtag filters specified — showing all notes.\n"
        );
      }

      if (json) {
        process.stdout.write(formatJson(notes));
      } else {
        process.stdout.write(formatTable(notes, ["name", "title", "hashtags"]));
      }
      break;
    }

    case "tags": {
      const notes = loadVault(absVault);

      // Collect all frontmatter keys with value counts
      const fmKeys = new Map<string, Map<string, number>>();
      for (const note of notes) {
        for (const [k, v] of Object.entries(note.frontmatter)) {
          let valMap = fmKeys.get(k);
          if (valMap === undefined) {
            valMap = new Map<string, number>();
            fmKeys.set(k, valMap);
          }
          const vals = Array.isArray(v) ? v.map(String) : [String(v)];
          for (const val of vals) {
            valMap.set(val, (valMap.get(val) ?? 0) + 1);
          }
        }
      }

      // Collect all #hashtags with counts
      const hashtagCounts = new Map<string, number>();
      for (const note of notes) {
        for (const tag of note.hashtags) {
          hashtagCounts.set(tag, (hashtagCounts.get(tag) ?? 0) + 1);
        }
      }

      if (json) {
        const out: Record<string, unknown> = {};
        for (const [key, valMap] of fmKeys) {
          out[key] = Object.fromEntries(valMap);
        }
        out["#hashtags"] = Object.fromEntries(hashtagCounts);
        process.stdout.write(formatJson(out));
      } else {
        process.stdout.write("\nFrontmatter keys:\n");
        for (const [key, valMap] of [...fmKeys].sort(([a], [b]) =>
          a.localeCompare(b)
        )) {
          const total = [...valMap.values()].reduce((s, n) => s + n, 0);
          process.stdout.write(`  ${key} (${total} occurrences)\n`);
          for (const [val, count] of [...valMap]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)) {
            process.stdout.write(`    ${val.padEnd(32)} ${count}\n`);
          }
        }
        if (hashtagCounts.size > 0) {
          process.stdout.write("\n#hashtags:\n");
          for (const [tag, count] of [...hashtagCounts].sort((a, b) => b[1] - a[1])) {
            process.stdout.write(`  #${tag.padEnd(30)} ${count}\n`);
          }
        } else {
          process.stdout.write("\n#hashtags: (none found)\n");
        }
        process.stdout.write("\n");
      }
      break;
    }

    case "links": {
      if (!noteArg) {
        process.stderr.write("Error: note-name is required for 'links' command.\n");
        process.exit(1);
      }
      const notes = loadVault(absVault);
      const note = notes.find((n) => n.name.toLowerCase() === noteArg.toLowerCase());
      if (!note) {
        process.stderr.write(`Note not found: ${noteArg}\n`);
        process.exit(1);
      }
      if (json) {
        process.stdout.write(
          formatJson({ note: note.name, wikilinks: note.wikilinks })
        );
      } else {
        if (note.wikilinks.length === 0) {
          process.stdout.write(`No outgoing wikilinks in: ${note.name}\n`);
        } else {
          process.stdout.write(`Outgoing wikilinks from: ${note.name}\n\n`);
          for (const link of note.wikilinks) {
            process.stdout.write(`  [[${link}]]\n`);
          }
          process.stdout.write(`\n${note.wikilinks.length} link(s)\n`);
        }
      }
      break;
    }

    case "backlinks": {
      if (!noteArg) {
        process.stderr.write("Error: note-name is required for 'backlinks' command.\n");
        process.exit(1);
      }
      const notes = loadVault(absVault);
      const incoming = getBacklinks(notes, noteArg);
      if (json) {
        process.stdout.write(
          formatJson({
            target: noteArg,
            backlinks: incoming.map((n) => ({ name: n.name, path: n.path })),
          })
        );
      } else {
        if (incoming.length === 0) {
          process.stdout.write(`No incoming links to: ${noteArg}\n`);
        } else {
          process.stdout.write(`Incoming links to: ${noteArg}\n\n`);
          for (const n of incoming) {
            process.stdout.write(`  ${n.name}  (${n.path})\n`);
          }
          process.stdout.write(`\n${incoming.length} backlink(s)\n`);
        }
      }
      break;
    }

    case "orphans": {
      const notes = loadVault(absVault);
      const orphans = getOrphans(notes);
      if (json) {
        process.stdout.write(formatJson(orphans));
      } else {
        if (orphans.length === 0) {
          process.stdout.write("No orphan notes found.\n");
        } else {
          process.stdout.write("Orphan notes (no incoming or outgoing links):\n\n");
          for (const n of orphans) {
            process.stdout.write(`  ${n.name}  (${n.path})\n`);
          }
          process.stdout.write(`\n${orphans.length} orphan(s)\n`);
        }
      }
      break;
    }

    case "search": {
      if (!noteArg) {
        process.stderr.write("Error: search query is required for 'search' command.\n");
        process.stderr.write("Usage: vori search <vault> <query>\n");
        process.exit(1);
      }
      const notes = loadVault(absVault);
      const results = textSearch(notes, noteArg);
      if (json) {
        process.stdout.write(formatJson(results));
      } else {
        if (results.length === 0) {
          process.stdout.write(`No notes matching: ${noteArg}\n`);
        } else {
          process.stdout.write(formatTable(results, ["name", "path", "title"]));
        }
      }
      break;
    }

    case "recent": {
      const notes = loadVault(absVault);
      const results = recentNotes(notes, days);
      if (json) {
        process.stdout.write(formatJson(results));
      } else {
        if (results.length === 0) {
          process.stdout.write(
            `No notes with 'date' frontmatter in the last ${days} day(s).\n`
          );
        } else {
          process.stdout.write(
            formatTable(results, ["name", "date", "title", "hashtags"])
          );
        }
      }
      break;
    }

    default:
      process.stderr.write(
        `Unknown command: ${JSON.stringify(command)}\nRun 'vori --help' for usage.\n`
      );
      process.exit(1);
  }
}

if (import.meta.main) {
  try {
    main();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${msg}\n`);
    process.exit(1);
  }
}
