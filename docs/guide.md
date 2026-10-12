# vori guide

Command reference, examples and filter rules. The README holds the short version.

## Commands

| Command | Description |
|---------|-------------|
| `vori list <vault>` | List all notes with frontmatter summary |
| `vori query <vault> --tag key=value` | Filter by frontmatter key and value |
| `vori query <vault> --hashtag tag` | Filter by body `#hashtag` |
| `vori tags <vault>` | Show all frontmatter keys and `#hashtags` with counts |
| `vori links <vault> <note>` | Outgoing `[[wikilinks]]` from a note |
| `vori backlinks <vault> <note>` | Notes that link to a given note |
| `vori orphans <vault>` | Notes with no incoming or outgoing links |
| `vori search <vault> <query>` | Full-text search across title, frontmatter values and body |
| `vori recent <vault> [--days=N]` | Notes with a `date` frontmatter field within the last N days |

Every command accepts `--json` for structured output.

## Examples

```bash
# browse
vori list ~/notes
vori tags ~/notes

# filter by frontmatter (multiple filters are ANDed)
vori query ~/notes --tag status=draft --tag type=idea
vori query ~/notes --tag "meta.priority=high"

# filter by hashtag (case-insensitive)
vori query ~/notes --hashtag typescript

# tag and hashtag together
vori query ~/notes --tag status=active --hashtag project

# links
vori links ~/notes architecture
vori backlinks ~/notes tdd-workflow
vori orphans ~/notes

# search and recent
vori search ~/notes "bun test isolation"
vori recent ~/notes --days=30

# JSON and jq
vori list ~/notes --json | jq '.[].name'
vori query ~/notes --tag status=active --json | jq '.[].path'
```

## What vori reads

From each `.md` file:

- YAML frontmatter: key and value pairs between `---` delimiters.
- `#hashtags` in the body. Content inside code fences is skipped.
- `[[wikilinks]]`. `![[embeds]]` are excluded.
- The `date` field, used by `recent`. It accepts YAML dates and ISO strings.
- The title: the first `# H1` in the body. The file name is the fallback.
  The `title` frontmatter key is not used for the display name.

## Filter rules

- Multiple `--tag` flags are ANDed.
- Multiple `--hashtag` flags are ANDed.
- `--tag` and `--hashtag` together are ANDed.
- Hashtag matching is case-insensitive.
- Tag values use exact string match.
- Dot notation resolves nested frontmatter: `--tag "a.b=c"` matches `{ a: { b: "c" } }`.

## Constraints

- Read-only. No command writes or changes a file.
- One production dependency: `yaml`.
- Output flags and `--json` shapes are meant to stay stable within v1.x.

Architecture notes are in [`specs/`](specs/). Tests are in `__tests__/` and BDD feature files in `features/`.
