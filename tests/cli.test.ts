import { describe, it, expect } from 'vitest';
import { parseArgs, computeDateRange, defaultOutputPath } from '../src/cli.js';
import { homedir } from 'node:os';
import { join } from 'node:path';

describe('parseArgs', () => {
  it('returns defaults with no arguments', () => {
    const opts = parseArgs([]);
    expect(opts!.metric).toBe('tokens');
    expect(opts!.theme).toBe('orange');
    expect(opts!.mode).toBe('dark');
    expect(opts!.days).toBe(365);
    expect(opts!.dbPath).toBe(join(homedir(), '.claude', 'usage.db'));
  });

  it('parses --days', () => {
    const opts = parseArgs(['--days', '90']);
    expect(opts!.days).toBe(90);
  });

  it('parses --from and --to', () => {
    const opts = parseArgs(['--from', '2026-01-01', '--to', '2026-06-01']);
    expect(opts!.fromDate).toBe('2026-01-01');
    expect(opts!.toDate).toBe('2026-06-01');
  });

  it('--from without --to is allowed', () => {
    const opts = parseArgs(['--from', '2026-01-01']);
    expect(opts!.fromDate).toBe('2026-01-01');
  });

  it('parses --metric', () => {
    expect(parseArgs(['--metric', 'tokens'])!.metric).toBe('tokens');
    expect(parseArgs(['--metric', 'messages'])!.metric).toBe('messages');
    expect(parseArgs(['--metric', 'tool-calls'])!.metric).toBe('tool-calls');
  });

  it('rejects invalid --metric', () => {
    expect(() => parseArgs(['--metric', 'invalid'])).toThrow('Invalid metric');
  });

  it('parses --theme', () => {
    expect(parseArgs(['--theme', 'green'])!.theme).toBe('green');
    expect(parseArgs(['--theme', 'purple'])!.theme).toBe('purple');
  });

  it('rejects invalid --theme', () => {
    expect(() => parseArgs(['--theme', 'blue'])).toThrow('Invalid theme');
  });

  it('parses --mode', () => {
    expect(parseArgs(['--mode', 'dark'])!.mode).toBe('dark');
    expect(parseArgs(['--mode', 'light'])!.mode).toBe('light');
  });

  it('rejects invalid --mode', () => {
    expect(() => parseArgs(['--mode', 'system'])).toThrow('Invalid mode');
  });

  it('parses --output', () => {
    const opts = parseArgs(['--output', '/tmp/out.html']);
    expect(opts!.output).toBe('/tmp/out.html');
  });

  it('parses --db', () => {
    const opts = parseArgs(['--db', '/custom/path/usage.db']);
    expect(opts!.dbPath).toBe('/custom/path/usage.db');
  });

  it('returns null for --help', () => {
    expect(parseArgs(['--help'])).toBeNull();
  });

  it('returns null for -h', () => {
    expect(parseArgs(['-h'])).toBeNull();
  });
});

describe('computeDateRange', () => {
  function todayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  it('uses --from and --to when both provided', () => {
    const [from, to] = computeDateRange({ fromDate: '2026-01-01', toDate: '2026-01-31' });
    expect(from).toBe('2026-01-01');
    expect(to).toBe('2026-01-31');
  });

  it('uses --from with today when --to not provided', () => {
    const [from, to] = computeDateRange({ fromDate: '2026-01-01', toDate: '' });
    expect(from).toBe('2026-01-01');
    expect(to).toBe(todayStr());
  });

  it('uses --days to compute start from today', () => {
    const [from, to] = computeDateRange({ days: 7 });
    expect(to).toBe(todayStr());
    const diff = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000);
    expect(diff).toBe(6);
  });

  it('defaults to 365 days when no range specified', () => {
    const [from, to] = computeDateRange({ days: 365 });
    const diff = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000);
    expect(diff).toBe(364);
  });
});

describe('defaultOutputPath', () => {
  it('generates filename with today date and .html extension', () => {
    const path = defaultOutputPath();
    expect(path).toContain('cc-heatmap-');
    expect(path).toMatch(/\.html$/);
  });
});
