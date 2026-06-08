# cc-heatmap

Visualize Claude Code usage as a GitHub-style activity heatmap.

Reads your local Claude Code `usage.db` and generates a self-contained HTML file showing daily token consumption (or message count, or tool calls) in a familiar GitHub contribution graph layout.

## Quick Start

```bash
# Show last 90 days of token usage (default)
npx cc-heatmap --days 90

# Show with classic GitHub green theme
npx cc-heatmap --days 90 --theme green

# Show message count instead of tokens
npx cc-heatmap --days 90 --metric messages

# Custom date range
npx cc-heatmap --from 2026-04-01 --to 2026-04-30

# Custom output path
npx cc-heatmap --days 30 --output my-heatmap.html
```

Open the generated HTML file in any browser — it's fully self-contained, zero external dependencies.

## Install

```bash
npm install -g cc-heatmap
```

Or run directly without installing:

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
| `--metric <name>` | `tokens`, `messages`, or `tool-calls` | `tokens` |
| `--theme <name>` | `orange`, `green`, or `purple` | `orange` |
| `--output <path>` | Output file path | `cc-heatmap-<today>.html` |
| `--db <path>` | Path to `usage.db` | `~/.claude/usage.db` |
| `-h, --help` | Show help | — |

## Themes

| orange (default) | green | purple |
|:---:|:---:|:---:|
| Warm Anthropic-inspired | Classic GitHub-style | Cool purple gradient |

## How It Works

`cc-heatmap` reads Claude Code's local SQLite database (`~/.claude/usage.db`) and aggregates the `turns` table by day. Activity levels are computed as percentiles across the selected range and mapped to 5 color intensities — the same approach GitHub uses for its contribution graph.

## License

MIT
