# vq — vault query CLI

Search and query Obsidian-style markdown vaults from the terminal.

[![CI](https://github.com/Questi0nM4rk/vq/actions/workflows/ai-guardrails.yml/badge.svg)](https://github.com/Questi0nM4rk/vq/actions/workflows/ai-guardrails.yml)
[![npm](https://img.shields.io/npm/v/vq)](https://www.npmjs.com/package/vq)
[![license](https://img.shields.io/github/license/Questi0nM4rk/vq)](LICENSE)

`vq` is a fast, read-only CLI for querying directories of Markdown files.
It reads YAML frontmatter, `#hashtags`, and `[[wikilinks]]` — then lets you
filter, search, and navigate your notes without opening any app.

Works with Obsidian vaults, personal wikis, or any folder of `.md` files
with YAML frontmatter.

---

## Install

```bash
bun add -g vq
```

```bash
npm install -g vq
```

Or download a precompiled binary from [Releases](https://github.com/Questi0nM4rk/vq/releases).

---

## Commands

| Command | Description |
|---------|-------------|
| `vq list <vault>` | List all notes with frontmatter summary |
| `vq query <vault> --tag key=value` | Filter by frontmatter key/value |
| `vq query <vault> --hashtag tag` | Filter by body `#hashtag` |
| `vq tags <vault>` | Show all frontmatter keys and `#hashtags` with counts |
| `vq links <vault> <note>` | Outgoing `[[wikilinks]]` from a note |
| `vq backlinks <vault> <note>` | Notes that link to a given note |
| `vq orphans <vault>` | Notes with no incoming or outgoing links |
| `vq search <vault> <query>` | Full-text search across title, frontmatter values, body |
| `vq recent <vault> [--days=N]` | Notes with a `date` frontmatter field within last N days |

Every command accepts `--json` for structured output.

---

## Examples

### Browse a vault

```bash
vq list ~/notes
vq tags ~/notes
```

### Filter by frontmatter

```bash
# single filter
vq query ~/notes --tag status=draft

# multiple filters are ANDed
vq query ~/notes --tag status=draft --tag type=idea

# nested frontmatter with dot notation
vq query ~/notes --tag "meta.priority=high"
```

### Filter by hashtag

```bash
vq query ~/notes --hashtag typescript
# case-insensitive: matches #TypeScript, #typescript, #TYPESCRIPT
```

### Combine tag + hashtag

```bash
vq query ~/notes --tag status=active --hashtag project
```

### Navigate links

```bash
# what does this note link to?
vq links ~/notes architecture

# what links to this note?
vq backlinks ~/notes tdd-workflow

# what's disconnected?
vq orphans ~/notes
```

### Search by content

```bash
vq search ~/notes "bun test isolation"
vq search ~/notes alice
```

### Recent notes

```bash
# last 7 days (default)
vq recent ~/notes

# last 30 days
vq recent ~/notes --days=30
```

### JSON output + jq

```bash
vq list ~/notes --json | jq '.[].name'
vq query ~/notes --tag status=active --json | jq '.[].path'
vq recent ~/notes --json | jq '.[0].title'
vq tags ~/notes --json | jq '.status'
```

---

## What vq reads

From each `.md` file:

- **YAML frontmatter** — any key/value pairs between `---` delimiters
- **`#hashtags`** — tags in the body (skips content inside code fences)
- **`[[wikilinks]]`** — outgoing links (`![[embeds]]` are excluded)
- **`date` field** — used by `recent`; accepts YAML Date objects and ISO strings
- **`title` field** — used as display name; falls back to filename

---

## Filtering semantics

- Multiple `--tag` flags → **AND** (note must match all)
- Multiple `--hashtag` flags → **AND** (note must have all)
- `--tag` and `--hashtag` together → **AND**
- Hashtag matching is **case-insensitive**
- Tag values use **exact string match**
- Dot notation resolves nested frontmatter: `--tag "a.b=c"` matches `{ a: { b: "c" } }`

---

## Usage flow

```bash
# 1. discover what's in the vault
vq tags ~/notes

# 2. filter to what you care about
vq query ~/notes --tag status=active --tag type=project

# 3. explore a note's connections
vq links ~/notes my-project
vq backlinks ~/notes my-project

# 4. find disconnected notes
vq orphans ~/notes

# 5. find recent work
vq recent ~/notes --days=14

# 6. pipe to scripts
vq query ~/notes --tag type=project --json | jq '.[].name'
```

---

## Development

```bash
git clone https://github.com/Questi0nM4rk/vq
cd vq
bun install

bun test             # 45 tests
bun run typecheck    # strict TypeScript
bun run lint         # biome
bun run build        # compiles → bin/vq
```

Requires [Bun](https://bun.sh) v1.0+.

Architecture decisions live in [`docs/specs/`](docs/specs/).
Methodology: spec-driven → BDD ([`features/`](features/)) → TDD (`__tests__/`).

---

## Constraints

- **Read-only.** No write commands, no file modification, ever.
- **One production dependency** (`yaml`). Adding a runtime dep requires a design decision.
- **Binary ≤5MB.** Checked on every release.
- **Stable output within v1.x.** Flags and `--json` shapes are frozen.

---

## License

MIT
