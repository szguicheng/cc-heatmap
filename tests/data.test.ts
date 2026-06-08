import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { queryDailyData } from '../src/data.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Metric } from '../src/data.js';

let db: DatabaseSync;
let dbPath: string;
let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'cc-heatmap-test-'));
  dbPath = join(dir, 'test-usage.db');
  db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE turns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      timestamp TEXT,
      model TEXT,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      cache_read_tokens INTEGER DEFAULT 0,
      cache_creation_tokens INTEGER DEFAULT 0,
      tool_name TEXT,
      cwd TEXT,
      message_id TEXT
    );
    CREATE INDEX idx_turns_timestamp ON turns(timestamp);
  `);

  const insert = db.prepare(`
    INSERT INTO turns (timestamp, input_tokens, output_tokens, tool_name)
    VALUES (?, ?, ?, ?)
  `);

  insert.run('2026-06-01T10:00:00.000Z', 100, 50, null);
  insert.run('2026-06-01T11:00:00.000Z', 200, 100, 'Bash');
  insert.run('2026-06-03T10:00:00.000Z', 300, 150, 'Read');
  insert.run('2026-06-03T11:00:00.000Z', 400, 200, '');
  insert.run('2026-06-05T10:00:00.000Z', 50, 25, 'Write');
});

afterAll(() => {
  db.close();
  rmSync(dir, { recursive: true });
});

describe('queryDailyData', () => {
  it('aggregates tokens per day', () => {
    const result = queryDailyData(dbPath, '2026-06-01', '2026-06-05', 'tokens');
    expect(result).toEqual([
      { date: '2026-06-01', value: 450 },
      { date: '2026-06-03', value: 1050 },
      { date: '2026-06-05', value: 75 },
    ]);
  });

  it('counts messages per day', () => {
    const result = queryDailyData(dbPath, '2026-06-01', '2026-06-05', 'messages');
    expect(result).toEqual([
      { date: '2026-06-01', value: 2 },
      { date: '2026-06-03', value: 2 },
      { date: '2026-06-05', value: 1 },
    ]);
  });

  it('counts tool calls per day', () => {
    const result = queryDailyData(dbPath, '2026-06-01', '2026-06-05', 'tool-calls');
    expect(result).toEqual([
      { date: '2026-06-01', value: 1 },
      { date: '2026-06-03', value: 1 },
      { date: '2026-06-05', value: 1 },
    ]);
  });

  it('returns empty array for range with no data', () => {
    const result = queryDailyData(dbPath, '2020-01-01', '2020-01-31', 'tokens');
    expect(result).toEqual([]);
  });
});
