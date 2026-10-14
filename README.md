<div align="center">

# `vori`

**A read-only command line tool that queries a folder of Markdown notes (frontmatter, hashtags, wikilinks)
for people who keep notes in Obsidian-style vaults.**

[![npm](https://img.shields.io/npm/v/@questi0nm4rk/vori?color=cb3837&label=npm)](https://www.npmjs.com/package/@questi0nm4rk/vori)
[![CI](https://github.com/Questi0nM4rk/vori/actions/workflows/ci.yml/badge.svg)](https://github.com/Questi0nM4rk/vori/actions/workflows/ci.yml)
[![tests](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Questi0nM4rk/vori/badges/tests.json&style=flat-square)](https://github.com/Questi0nM4rk/vori/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/Questi0nM4rk/vori?color=blue)](./LICENSE)

</div>

```console
$ vori query notes/ --tag status=draft
NAME    TITLE   HASHTAGS
──────  ──────  ──────────
idea-a  idea-a  typescript

1 note(s)

$ vori backlinks notes/ idea-a
Incoming links to: idea-a

  idea-b  (idea-b.md)
```

## Why it exists

Agents and scripts that need to read a notes vault have only two choices today.
They open the Obsidian app, or they grep Markdown and miss the structure (frontmatter keys, hashtags, links).
vori reads that structure directly from the files and prints a table or JSON.
It never writes to a vault, so an agent can call it without risk.
It would have no reason to exist if the vault tools in Obsidian itself could be called from a shell.

## Quickstart

```bash
bun install && bun test
```

Expected: the output ends with `0 fail`.

```bash
bun src/main.ts list ./docs
```

Expected: a table with the columns NAME, TITLE, HASHTAGS, WIKILINKS and one row per `.md` file.

To install the published package instead: `bun add -g @questi0nm4rk/vori`.

Other checks: `bun run typecheck` and `bun run lint`. Commands, flags and filter rules are in [docs/guide.md](docs/guide.md).

## How it works

```mermaid
flowchart LR
  A[vault directory] --> B[parser: frontmatter, hashtags, wikilinks]
  B --> C[in-memory notes]
  C --> D[query: filter, search, links]
  D --> E[table or --json]
```

Every command reads all `.md` files on each run. There is no index and no cache.
No part of vori calls a model. Everything is deterministic.
The title of a note is its first `# H1`, or the file name if there is none.
The one runtime dependency is `yaml`.

## Numbers

[![tests](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Questi0nM4rk/vori/badges/tests.json&style=flat-square)](https://github.com/Questi0nM4rk/vori/actions/workflows/ci.yml)

Times vary by machine and run.

| What | How to measure |
| --- | --- |
| Tests passing and failing | `bun test`, the last `pass` and `fail` lines |
| Test run time | `bun test`, the last line |
| Source plus test code | `scc src __tests__` |
| npm bundle size | `bun run build:npm`, then `wc -c bin/vori.js` |
| Compiled binary size | `bun run build`, then `ls -l bin/vori` |
| Search time over a generated vault | `time bun bin/vori.js search <vault> "Note 500"`, with the vault size as the variable |

The generated notes are small (one short paragraph each).
A real vault with long notes will be slower. Each time includes the start-up of Bun.

Commits include agent-authored work under my identity;
design, orchestration and review are mine.

## Status

- **Works:** `list`, `query`, `tags`, `links`, `backlinks`, `orphans`, `search`, `recent`, and `--json` on all of them.
  Published to npm as `@questi0nm4rk/vori`.
- **Experimental:** None.
- **Known gaps:**
  - No index: every call parses the whole vault.
  - The compiled binary is large (it includes the Bun runtime); a `v*` tag uploads it to a GitHub release
    and stages the npm version, which a maintainer approves on npmjs.com (2FA).
  - The `title` frontmatter key is not used for the display name.
  - Only tested on Linux.

## License

GPL-3.0.

Releases published before 2026-10-12 remain available under MIT.
