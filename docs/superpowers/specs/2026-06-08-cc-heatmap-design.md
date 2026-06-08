# cc-heatmap Design Spec

**Date:** 2026-06-08
**Status:** Draft

## Overview

`cc-heatmap` is a lightweight CLI tool that reads Claude Code's local `usage.db` (SQLite) and generates a self-contained HTML file displaying activity as a GitHub-style contribution heatmap. It defaults to showing token consumption with an orange (Anthropic-branded) color scheme.

## Functional Requirements

### CLI Interface

```
cc-heatmap [options]

Options:
  --days <n>        Number of days to show (default: 365)
  --from <date>     Start date YYYY-MM-DD (overrides --days when used with --to)
  --to <date>       End date YYYY-MM-DD
  --metric <name>   Metric to visualize: tokens | messages | tool-calls (default: tokens)
  --output <path>   Output HTML file path (default: cc-heatmap-<today>.html)
  --theme <name>    Color theme: orange | green | purple (default: orange)
  --db <path>       Path to usage.db (default: ~/.claude/usage.db)
  --help, -h        Show help
```

### Data Source

- **Primary:** `~/.claude/usage.db` → `turns` table
- Aggregate `SUM(input_tokens + output_tokens)` per day for `tokens` metric
- For `messages` metric: `COUNT(*)` per day (no pre-aggregated message count exists in turns; use row count as proxy)
- For `tool-calls`: `COUNT(*) WHERE tool_name IS NOT NULL AND tool_name != ''` per day
- Filter by date range using `date(timestamp)` in SQL

### Heatmap Rendering

- **Layout:** 7 rows (Sun–Sat) × N columns (weeks in range)
- **Color levels:** 5 tiers based on percentile thresholds (0/25/50/75/100) of the data range
- **Month labels:** Shown above the first week of each month
- **Day labels:** Mon, Wed, Fri on the left side
- **Hover tooltip:** Shows "Apr 8 · 12.5K tokens" on mouse hover
- **Legend:** 5 color blocks at the bottom with Less/More labels
- **Output:** Single self-contained HTML file with inline CSS, zero external dependencies

### Color Themes

- **orange (default):** Warm orange gradient, Anthropic-inspired
- **green:** Classic GitHub-style green gradient
- **purple:** Cool purple gradient

Each theme defines 5 hex values for the intensity levels, plus empty-cell color.

## Architecture

```
cc-heatmap/
├── src/
│   ├── cli.ts        # CLI entry, arg parsing
│   ├── data.ts       # Read usage.db, aggregate by day → DailyData[]
│   ├── heatmap.ts    # Convert DailyData[] → GridData for rendering
│   ├── render.ts     # Render GridData → HTML string
│   └── colors.ts     # Color theme definitions
├── package.json
├── tsconfig.json
└── bin/
    └── cc-heatmap    # Shebang executable entry
```

**Modules (4 files, single purpose each):**

| Module | Input | Output | Responsibility |
|--------|-------|--------|----------------|
| `cli.ts` | `process.argv` | Parsed options object | Argument parsing, help text |
| `data.ts` | SQLite path, date range, metric | `DailyData[]` | SQL query, date aggregation |
| `heatmap.ts` | `DailyData[]`, date range | `GridCell[][]` (7×N) | Week-grid layout, color level calc |
| `render.ts` | Grid data, theme, metric label | HTML string | HTML template, inline CSS |
| `colors.ts` | Theme name | 5-color array | Theme definitions |

### Data Flow

```
usage.db ──[sqlite3]──> data.ts ──> DailyData[] ──> heatmap.ts ──> GridCell[][] ──> render.ts ──> HTML file
                                    {date, value}                   {level, label}               (self-contained)
```

### Types

```typescript
interface DailyData { date: string; value: number }

interface GridCell {
  date: string      // YYYY-MM-DD or "" for padding
  value: number
  level: number     // 0–4 (0 = empty/no data, 1–4 = color tiers)
  dayLabel: string  // e.g. "Mon Apr 8"
}

interface CliOptions {
  days: number
  fromDate?: string
  toDate?: string
  metric: 'tokens' | 'messages' | 'tool-calls'
  output?: string
  theme: 'orange' | 'green' | 'purple'
  dbPath: string
}
```

## Color Level Calculation

Given a non-empty data set:
1. Remove zero-value days from the distribution (they get level 0)
2. Compute `P25`, `P50`, `P75` percentiles of the remaining values
3. Map: `value = 0 → 0`, `value ≤ P25 → 1`, `value ≤ P50 → 2`, `value ≤ P75 → 3`, `value > P75 → 4`
4. Days with no data record at all → empty cell (no color)

## Dependencies

- **Runtime:** `node:sqlite` (Node.js 24+ built-in), Node.js built-ins (path, fs)
- **Dev:** `typescript`, `tsx`, `@types/node`
- Zero external runtime dependencies. No web framework, no CSS library, no templating engine.

## Testing Strategy

- Unit tests for `data.ts` SQL aggregation (against a test SQLite db)
- Unit tests for `heatmap.ts` grid layout and color level calculation
- Unit tests for `colors.ts` theme lookup
- Snapshot test for `render.ts` HTML output against known grid data
- CLI integration test for argument parsing

## Non-Goals

- No PNG output (HTML only for this version)
- No real-time monitoring or daemon mode
- No web server or API
- No authentication or multi-user support
