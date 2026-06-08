import { homedir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, existsSync } from 'node:fs';
import type { Metric } from './data.js';
import type { ThemeName, ModeName } from './colors.js';
import { queryDailyData } from './data.js';
import { buildGrid } from './heatmap.js';
import { renderHtml } from './render.js';

export interface CliOptions {
  days: number;
  fromDate: string;
  toDate: string;
  metric: Metric;
  output: string;
  theme: ThemeName;
  mode: ModeName;
  dbPath: string;
}

const VALID_METRICS: Metric[] = ['tokens', 'messages', 'tool-calls'];
const VALID_THEMES: ThemeName[] = ['orange', 'green', 'purple'];
const VALID_MODES: ModeName[] = ['dark', 'light'];

const HELP = `cc-heatmap — Visualize Claude Code usage as a GitHub-style heatmap

Usage: cc-heatmap [options]

Options:
  --days <n>        Number of days to show (default: 365)
  --from <date>     Start date YYYY-MM-DD (overrides --days when used with --to)
  --to <date>       End date YYYY-MM-DD
  --metric <name>   Metric: tokens | messages | tool-calls (default: tokens)
  --output <path>   Output HTML file path (default: cc-heatmap-<today>.html)
  --theme <name>    Color: orange | green | purple (default: orange)
  --mode <name>     Background: dark | light (default: dark)
  --db <path>       Path to usage.db (default: ~/.claude/usage.db)
  --help, -h        Show this help
`;

export function parseArgs(argv: string[]): CliOptions | null {
  const opts: Partial<CliOptions> = {};
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];

    switch (arg) {
      case '-h':
      case '--help':
        process.stdout.write(HELP);
        return null;

      case '--days': {
        const val = argv[++i];
        const n = parseInt(val, 10);
        if (isNaN(n) || n <= 0) throw new Error(`Invalid --days value: ${val}`);
        opts.days = n;
        break;
      }

      case '--from':
        opts.fromDate = argv[++i];
        break;

      case '--to':
        opts.toDate = argv[++i];
        break;

      case '--metric': {
        const val = argv[++i] as Metric;
        if (!VALID_METRICS.includes(val)) {
          throw new Error(`Invalid metric: ${val}. Must be one of: ${VALID_METRICS.join(', ')}`);
        }
        opts.metric = val;
        break;
      }

      case '--theme': {
        const val = argv[++i] as ThemeName;
        if (!VALID_THEMES.includes(val)) {
          throw new Error(`Invalid theme: ${val}. Must be one of: ${VALID_THEMES.join(', ')}`);
        }
        opts.theme = val;
        break;
      }

      case '--mode': {
        const val = argv[++i] as ModeName;
        if (!VALID_MODES.includes(val)) {
          throw new Error(`Invalid mode: ${val}. Must be one of: ${VALID_MODES.join(', ')}`);
        }
        opts.mode = val;
        break;
      }

      case '--output':
        opts.output = argv[++i];
        break;

      case '--db':
        opts.dbPath = argv[++i];
        break;

      default:
        throw new Error(`Unknown option: ${arg}. Use --help for usage.`);
    }
    i++;
  }

  return {
    days: opts.days ?? 365,
    fromDate: opts.fromDate ?? '',
    toDate: opts.toDate ?? '',
    metric: opts.metric ?? 'tokens',
    output: opts.output ?? '',
    theme: opts.theme ?? 'orange',
    mode: opts.mode ?? 'dark',
    dbPath: opts.dbPath ?? join(homedir(), '.claude', 'usage.db'),
  };
}

export function computeDateRange(
  opts: Pick<CliOptions, 'days' | 'fromDate' | 'toDate'>,
): [string, string] {
  const today = new Date();
  const todayStr = toDateStr(today);

  if (opts.fromDate && opts.toDate) {
    return [opts.fromDate, opts.toDate];
  }

  if (opts.fromDate) {
    return [opts.fromDate, todayStr];
  }

  const days = opts.days ?? 365;
  const from = new Date(today);
  from.setDate(from.getDate() - days + 1);
  return [toDateStr(from), todayStr];
}

export function defaultOutputPath(): string {
  return `cc-heatmap-${toDateStr(new Date())}.html`;
}

export async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts) return;

  if (!existsSync(opts.dbPath)) {
    process.stderr.write(`Error: usage.db not found at ${opts.dbPath}\n`);
    process.exit(1);
  }

  const [fromDate, toDate] = computeDateRange(opts);
  const data = queryDailyData(opts.dbPath, fromDate, toDate, opts.metric);
  const grid = buildGrid(data, fromDate, toDate);
  const html = renderHtml(grid, opts.metric, opts.theme, opts.mode);

  const outputPath = opts.output || defaultOutputPath();
  writeFileSync(outputPath, html, 'utf-8');
  process.stdout.write(`Heatmap saved to ${outputPath}\n`);
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
