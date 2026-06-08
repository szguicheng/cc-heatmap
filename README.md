# cc-heatmap

Visualize Claude Code usage as a GitHub-style activity heatmap.

Reads your [cc-switch](https://github.com/farion1231/cc-switch) usage tracking data and generates a self-contained HTML file — a full GitHub contribution graph showing your daily token consumption across months.

## Quick Start

```bash
# Show last 90 days (defaults to cc-switch data)
npx cc-heatmap --days 90

# Light mode + green GitHub theme
npx cc-heatmap --days 90 --theme green --mode light

# Claude Code built-in usage (last ~30 days)
npx cc-heatmap --source claude --days 30

# Message count instead of tokens
npx cc-heatmap --days 90 --metric messages

# Custom date range
npx cc-heatmap --from 2026-04-01 --to 2026-04-30

# Custom output path
npx cc-heatmap --days 30 --output my-heatmap.html
```

Open the generated HTML file in any browser — fully self-contained, zero external dependencies.

## Data Sources

| Source | Database | Coverage |
|--------|----------|----------|
| `cc-switch` (default) | `~/.cc-switch/cc-switch.db` | Full history (requires cc-switch installed) |
| `claude` | `~/.claude/usage.db` | ~30 days (Claude Code built-in) |

cc-switch merges both `usage_daily_rollups` (pre-aggregated historical data) and `proxy_request_logs` (live request logs), giving you the most complete picture.

## Install

```bash
npm install -g cc-heatmap
```

Or run directly:

```bash
npx cc-heatmap --days 90
```

Requires Node.js 24+ (uses built-in `node:sqlite`).

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--days <n>` | Number of days to show | `365` |
| `--from <date>` | Start date `YYY-MM-DD` | — |
| `--to <date>` | End date `YYY-MM-DD` | — |
| `--source <name>` | `claude` or `cc-switch` | `cc-switch` |
| `--metric <name>` | `tokens`, `messages`, or `tool-calls` | `tokens` |
| `--theme <name>` | `orange`, `green`, or `purple` | `orange` |
| `--mode <name>` | `dark` or `light` | `dark` |
| `--output <path>` | Output file path | `cc-heatmap-<today>.html` |
| `--db <path>` | Custom database path | auto-detected |
| `-h, --help` | Show help | — |

## Themes & Modes

| orange (default) | green | purple |
|:---:|:---:|:---:|
| Warm Anthropic-inspired | Classic GitHub-style | Cool purple gradient |

Both `--mode dark` and `--mode light` are available for any theme. Light mode uses GitHub's exact color palette.

## How It Works

Activity levels are computed as percentiles (P25/P50/P75) across the selected range and mapped to 5 color intensities — the same approach GitHub uses for its contribution graph. Each cell is positioned by actual day of week, so the heatmap always ends at the current date with no trailing blanks.

Token counts include `input + output + cache_read + cache_creation` tokens.

## License

MIT
