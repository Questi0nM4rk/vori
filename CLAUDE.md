# CLAUDE.md — vori

Vault query CLI. Read-only queries against Obsidian-style markdown vaults from the terminal.

## What This Is

`vori` is a standalone CLI tool: 9 read-only commands, one production dependency (`yaml`),
compiled to a self-contained binary via `bun build --compile`. It works on any directory
of `.md` files with YAML frontmatter — Obsidian vaults, personal wikis, note collections.

## Development Commands

```bash
bun install          # install deps
bun test             # run 45 tests (must pass before any commit)
bun run typecheck    # tsgo --noEmit (TypeScript 7 native compiler, 7-10x faster than tsc)
bun run lint         # biome check (0 findings required)
bun run lint:fix     # biome check --write (auto-fix formatting)
bun run build        # compile → bin/vori (git-ignored)
```

## Architecture

```
src/
  main.ts          # parseArgs (single-pass), command dispatch, USAGE string
  lib/
    types.ts       # Note interface — the only shared type
    parser.ts      # loadVault, parseNote — reads .md files into Note[]
    query.ts       # filterByFrontmatter, filterByHashtag, getBacklinks,
                   # getOrphans, textSearch, recentNotes
    output.ts      # formatTable (Unicode-safe truncation), formatJson
__tests__/
  parser.test.ts   # loadVault, parseNote — frontmatter, hashtags, wikilinks
  query.test.ts    # all query functions
  output.test.ts   # formatTable column aliases, truncation, edge cases
  parseArgs.test.ts # arg parsing, error cases, --days validation
features/
  list.feature     # BDD behavior specs
  query.feature
  search.feature
  recent.feature
docs/specs/
  SPEC-INDEX.md
  SPEC-001-architecture.md  # authoritative design decisions
```

## Note Interface

```typescript
interface Note {
  path: string;      // absolute path
  name: string;      // filename without .md
  title: string;     // frontmatter.title or name as fallback
  frontmatter: Record<string, unknown>;
  hashtags: string[];   // #tags from body (outside code fences)
  wikilinks: string[];  // [[links]] from body (![[embeds]] excluded)
  body: string;
}
```

## Commands

| Command | Second positional | Flags |
|---------|-----------------|-------|
| `vori list <vault>` | — | `--json` |
| `vori query <vault>` | — | `--tag k=v`, `--hashtag t`, `--json` |
| `vori tags <vault>` | — | `--json` |
| `vori links <vault> <note>` | note name | `--json` |
| `vori backlinks <vault> <note>` | note name | `--json` |
| `vori orphans <vault>` | — | `--json` |
| `vori search <vault> <query>` | search string | `--json` |
| `vori recent <vault>` | — | `--days=N`, `--json` |

Query semantics: multiple `--tag` flags are ANDed. Multiple `--hashtag` flags are ANDed.
Dot notation for nested frontmatter: `--tag "meta.priority=high"`.

## Parser Behavior

- Frontmatter requires `---\n` (with newline) to be recognized
- Closing `---` accepts trailing whitespace or `\r\n` (Windows)
- Hashtags: only extracted from body lines outside fenced code blocks
- Wikilinks: `![[embed]]` are excluded; `[[link|alias]]` includes only the target
- Unreadable files: logged to stderr, skipped, load continues
- Symlinks: resolved via `statSync` — symlinked directories are traversed
- `date` frontmatter: accepts YAML Date objects and ISO string strings

## Constraints (Iron Laws)

1. **No vault mutation.** vori is strictly read-only. No write commands, ever.
2. **`yaml` is the only production dependency.** Adding a runtime dep requires a SPEC.
3. **Binary ≤5MB.** CI checks size on every release.
4. **Zero breaking changes within v1.x.** Flags and `--json` output shape are frozen.
5. **Obsidian-compatible, not Obsidian-exclusive.** Any `.md` directory is a valid vault.

## Git Workflow

- **No direct commits to main.** lefthook enforces this.
- Branch naming: `feat/<name>`, `fix/<name>`, `chore/<name>`
- Commit messages: Conventional Commits (`feat:`, `fix:`, `chore:`, etc.)
- All PRs run lefthook pre-commit: biome-fix, codespell, markdownlint, gitleaks, check-suppress-comments

## Adding a New Command

1. Add behavior spec to `features/<command>.feature`
2. Write failing unit tests in `__tests__/`
3. Implement in `src/lib/` (query function) + `src/main.ts` (case block)
4. `bun test` green, `bun run typecheck` clean, `bun run lint` 0 findings
5. Update USAGE string in `main.ts`
6. Update `docs/specs/` if the change is architectural

## Spec System

SPEC numbers are permanent. Next available: **SPEC-002**.

| SPEC | Title |
|------|-------|
| [SPEC-001](docs/specs/SPEC-001-architecture.md) | vori Architecture |

## ai-guardrails

Profile: `strict`. Config at `.ai-guardrails/config.toml`.

Pre-commit: biome-fix, gitleaks, codespell, markdownlint, suppress-comment check, no-commits-to-main, conventional commits.
CI: `bunx ai-guardrails check` — hold-the-line against baseline.

The `.claude/settings.json` deny list blocks destructive Claude Code commands (rm -rf, force push, --no-verify, etc.).
