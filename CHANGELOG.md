# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-04-02

### Added
- Side-by-side TUI diff for `.env`, `.yaml`/`.yml`, and `.json` files
- Inline character-level diff highlighting (LCS algorithm, toggle with `h`)
- ASCII art title with keyboard shortcut bar
- Cursor navigation with auto-scroll (`↑`/`↓` or `j`/`k`)
- Status filter cycling (`f` key): all → diffs → added → removed → modified
- Sort modes (`o` key): by status, alphabetical, file-A order, file-B order
- Secret masking (`s` key) — masks values matching common secret patterns with `*`
- Search/filter (`/` key) with real-time highlighting
- Copy to clipboard (`c` key, or right-click) — xclip / xsel / wl-copy / pbcopy / OSC 52 fallback
- Line number columns for both files
- `--ignore-pattern <regex>` CLI flag to exclude matching keys
- Exit code `1` when diffs are found (useful in CI pipelines)
- Cross-platform standalone binaries (Linux x64/arm64, macOS x64/arm64, Windows x64)
