# SPEC-001 — vori Architecture

**Status:** Draft
**Domain:** CLI tooling
**Repo:** `Questi0nM4rk/vori`
**Related:** SPEC-005 (marketplace architecture), SPEC-007 (sg)

---

## Problem

`vori` is a generic markdown vault query tool with no dependency on qsm-marketplace concepts. Keeping it inside qsm-marketplace makes it:
- Unavailable to install independently (no npm package, no releases)
- Subject to marketplace conventions that don't apply to a standalone CLI
- Invisible to anyone searching for Obsidian-compatible CLI tools
- Tested but not shipped — 45 tests, no way to install without cloning the marketplace

**What this is NOT:** A rewrite. All existing functionality (list, query, tags, links, backlinks, orphans, search, recent), all 45 tests, and all fixes from the strict review are carried forward unchanged.

---

## Philosophy

1. **Small binary, long discoverability.** The command is `vori` — 2 characters. The npm package name, description, and keywords are optimized for search.
   WHY: CLI tools live or die by findability and typing friction. `vault-query` as a command would see zero adoption.

2. **Spec-driven from day 1.** Architectural decisions live in SPEC files before implementation. No "we'll figure it out."
   WHY: A new repo starts clean — establish the habit from the first commit, not after the codebase grows.

3. **BDD → TDD using @questi0nm4rk/feats.** Behavior specs in `.feature` files define what the CLI does; unit tests verify individual functions.
   WHY: Feature files are readable by non-TypeScript contributors and document command behavior durably.

4. **ai-guardrails as standard infrastructure.** Global hooks cover dangerous commands and config protection. Project-level config covers TypeScript-specific rules.
   WHY: Guardrails enforce standards without relying on model memory or session context.

5. **npm-first, binary-optional.** Published to npm for `bun add -g @questi0nm4rk/vori` install. Precompiled binaries on GitHub releases for systems without bun/node.
   WHY: npm is the primary install path; binaries serve users who want zero-dependency installs.

6. **No runtime dependencies beyond bun/node.** The `yaml` package is the only production dependency. `@questi0nm4rk/feats` and all test tooling are devDependencies.
   WHY: CLI tools with deep dep trees are fragile to install. A tool reading markdown files should be nearly dependency-free.

---

## Solution

Standalone GitHub repository: `Questi0nM4rk/vori`

### Repository Structure

```
vori/
├── src/
│   ├── main.ts              # Entry point, parseArgs, command dispatch
│   └── lib/
│       ├── types.ts         # Note interface
│       ├── parser.ts        # loadVault, parseNote
│       ├── query.ts         # filterByFrontmatter, filterByHashtag, getBacklinks, etc.
│       └── output.ts        # formatTable, formatJson
├── __tests__/
│   ├── parser.test.ts
│   ├── query.test.ts
│   ├── output.test.ts
│   └── parseArgs.test.ts
├── features/                # BDD feature files (@questi0nm4rk/feats)
│   ├── list.feature
│   ├── query.feature
│   ├── search.feature
│   └── recent.feature
├── docs/
│   └── specs/
│       ├── SPEC-001-architecture.md    # This document (renumbered for new repo)
│       └── SPEC-INDEX.md
├── bin/
│   └── vori                   # Compiled binary (git-ignored, CI artifact)
├── package.json
├── tsconfig.json
├── biome.json
├── .ai-guardrails.json      # Project-level guardrails (TypeScript-specific rules)
└── CLAUDE.md
```

### Commands (all carried forward from qsm-marketplace)

| Command | Description |
|---------|-------------|
| `vori list <vault>` | List all .md files with frontmatter summary |
| `vori query <vault> --tag key=value` | Filter by frontmatter key/value (dot notation, AND semantics) |
| `vori query <vault> --hashtag tag` | Filter by #hashtag |
| `vori tags <vault>` | Show all frontmatter keys + #hashtags with counts |
| `vori links <vault> <note>` | Outgoing [[wikilinks]] from a note |
| `vori backlinks <vault> <note>` | Incoming links to a note |
| `vori orphans <vault>` | Notes with no incoming or outgoing links |
| `vori search <vault> <query>` | Full-text search across title, frontmatter values, body |
| `vori recent <vault> [--days=N]` | Notes with `date` frontmatter within last N days (default: `--days=7`) |

All commands support `--json` for structured output.

### npm Package

```json
{
  "name": "vori",
  "version": "1.0.0",
  "description": "Vault query CLI — search and query Obsidian-style markdown vaults from the terminal",
  "keywords": [
    "obsidian", "obsidian-cli", "vault", "vault-search", "vault-query",
    "markdown", "markdown-cli", "notes", "knowledge-base", "wikilinks",
    "frontmatter", "yaml", "second-brain", "pkm"
  ],
  "bin": { "vori": "./bin/vori" }
}
```

### .ai-guardrails.json (project-level)

```json
{
  "rules": [
    {
      "id": "no-skip-tests",
      "description": "Do not skip or comment out tests",
      "pattern": "it\\.skip|describe\\.skip|test\\.skip",
      "action": "block",
      "message": "Tests must not be skipped. Fix the underlying issue."
    },
    {
      "id": "no-any",
      "description": "Avoid TypeScript any type",
      "pattern": ": any[^a-zA-Z]|as any",
      "action": "warn",
      "message": "Use unknown instead of any. See lib/types.ts for patterns."
    }
  ]
}
```

---

## Development Methodology

### Spec-Driven

All architectural decisions are documented in `docs/specs/SPEC-NNN.md` before implementation. The workflow:
1. Feature idea → interview → SPEC
2. Breaking agents on SPEC
3. Implement from SPEC

### BDD → TDD

```
features/list.feature       →   __tests__/parser.test.ts (RED)
                            →   src/lib/parser.ts (GREEN)
                            →   biome check (REFACTOR)
```

Feature files describe user-visible behavior. Unit tests verify function contracts. No merge without both green.

### Strict Review

All PRs run the `qsm-strict-review` plugin. Zero findings accepted — including nitpicks.

### ai-guardrails

Global hooks (from `~/.claude/settings.json`):
- `dangerous-cmd`: blocks destructive bash
- `protect-configs`: blocks direct edits to generated/protected files

Project-level `.ai-guardrails.json`:
- Blocks `it.skip` / `describe.skip`
- Warns on `any` type usage

---

## Constraints

1. **Binary must be ≤5MB.** Bun compile produces self-contained binaries. If size grows beyond this, investigate tree-shaking before adding dependencies.
   CHANGE TRIGGER: CI size check on every release.

2. **Zero breaking changes within a major version.** Command flags and output format are stable within v1.x. `--json` output shape is frozen.
   CHANGE TRIGGER: Any flag removal or output format change → bump major version.

3. **The `yaml` package is the only production dependency.** Adding runtime deps requires a SPEC.
   CHANGE TRIGGER: Feature that genuinely requires a new dep (e.g. fuzzy search library).

4. **No vault mutation.** vori is read-only. No write commands, no file modification.
   CHANGE TRIGGER: Never. Write operations belong in a separate tool.

5. **Obsidian-compatible, not Obsidian-exclusive.** Any directory of `.md` files with YAML frontmatter is a valid vault.
   CHANGE TRIGGER: If a feature requires Obsidian-specific metadata that breaks non-Obsidian use.

---

## Migration from qsm-marketplace

The migration is a file move, not a rewrite:

1. Create `Questi0nM4rk/vori` repo
2. Copy `src/tools/vori/` → `src/` in new repo
3. Copy `src/tools/vori/__tests__/` → `__tests__/` in new repo
4. Create standalone `package.json`, `tsconfig.json`, `biome.json`
5. Add `CLAUDE.md`, `docs/specs/SPEC-001-architecture.md` (this spec, renumbered)
6. Add `.ai-guardrails.json`
7. Set up GitHub Actions: `bun test`, `bunx biome check`, release workflow
8. Publish to npm
9. Remove `src/tools/vori/` from qsm-marketplace
10. Update `qsm-vault-tools` plugin setup script to install via `bun add -g @questi0nm4rk/vori`
11. Remove `build:vori` script and `vori` bin entry from marketplace `package.json`

**No functional changes during migration.** All 45 tests must pass in the new repo before the marketplace source is deleted.

---

## Evolution

| Trigger | Change |
|---------|--------|
| Request for fuzzy search | SPEC for new `--fuzzy` flag, dependency decision |
| Watch mode request | SPEC for `vori watch <vault>` — file system watcher |
| Multiple vault support | `vori query <vault1> <vault2>` — SPEC needed |
| Output format plugins | Custom output formatters — major version feature |
| `.trash` dir exclusion | Add to `SKIP_DIRS` in parser.ts — no SPEC needed |

---

## Open Questions

- Should `vori` publish TypeScript types alongside the binary for programmatic use?
- GitHub Actions: build binaries for Linux, macOS, Windows — or Linux only for v1?
