# CLAUDE.md — vq

Vault query CLI. Reads Obsidian-style markdown vaults from the terminal.

## What This Is

`vq` is a standalone CLI tool: 9 read-only commands, one production dependency (`yaml`), compiled to a self-contained binary via `bun build --compile`.

## Commands

| Command | Description |
|---------|-------------|
| `vq list <vault>` | List all .md files with frontmatter summary |
| `vq query <vault> --tag key=value` | Filter by frontmatter key/value (AND semantics) |
| `vq query <vault> --hashtag tag` | Filter by #hashtag |
| `vq tags <vault>` | Show all frontmatter keys + #hashtags with counts |
| `vq links <vault> <note>` | Outgoing [[wikilinks]] from a note |
| `vq backlinks <vault> <note>` | Incoming links to a note |
| `vq orphans <vault>` | Notes with no incoming or outgoing links |
| `vq search <vault> <query>` | Full-text search across title, frontmatter values, body |
| `vq recent <vault> [--days=N]` | Notes with `date` frontmatter within last N days (default: 7) |

All commands support `--json` for structured output.

## Development

```bash
bun install          # install deps
bun test             # run 45 tests
bun run typecheck    # tsc --noEmit
bun run lint         # biome check
bun run build        # compile → bin/vq
```

## Architecture

- `src/main.ts` — entry point, `parseArgs`, command dispatch
- `src/lib/types.ts` — `Note` interface
- `src/lib/parser.ts` — `loadVault`, `parseNote`
- `src/lib/query.ts` — all filter/query functions
- `src/lib/output.ts` — `formatTable`, `formatJson`

## Constraints

- No vault mutation. Read-only.
- `yaml` is the only production dependency.
- Binary must be ≤5MB.
- Zero breaking changes within v1.x.

## Methodology

Spec-driven → BDD → TDD. See `docs/specs/`.
