export interface Note {
	path: string; // relative to vault root
	name: string; // filename without .md
	title: string; // first H1 or filename
	frontmatter: Record<string, unknown>; // parsed YAML
	hashtags: string[]; // #tags from body (without #)
	wikilinks: string[]; // [[targets]] (just the name part)
	body: string; // raw body text (after frontmatter)
}
