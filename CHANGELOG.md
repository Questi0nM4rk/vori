# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Features

- Initial vq release — vault query CLI for markdown vaults
- Configure npm publish — source-first, bun-native install (#2)

### Bug Fixes

- Use bin/vori.js wrapper — npm rejects .ts bin entries (#3)
- Bundle JS for npm publish — self-contained 250KB, no TS imports (#4)
- Publish as @questi0nm4rk/vori — npm blocked bare 'vori' name (#5)
- Codespell skip bin/, wikilink anchors, fence type mismatch, engines field, npm badge (#12)

### Chore

- Add ai-guardrails strict profile (#1)
- Add cc-review automated PR reviewer
- Disable CodeRabbit auto-review (#13)
- Grant WebSearch + WebFetch to cc-review workflow (#14)
- Enrich package.json metadata and realign LICENSE holder
