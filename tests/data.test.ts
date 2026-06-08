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

describe('queryDailyData (claude source)', () => {
  it('aggregates tokens per day', () => {
    const result = queryDailyData(dbPath, '2026-06-01', '2026-06-05', 'tokens', 'claude');
    expect(result).toEqual([
      { date: '2026-06-01', value: 450 },
      { date: '2026-06-03', value: 1050 },
      { date: '2026-06-05', value: 75 },
    ]);
  });

  it('counts messages per day', () => {
    const result = queryDailyData(dbPath, '2026-06-01', '2026-06-05', 'messages', 'claude');
    expect(result).toEqual([
      { date: '2026-06-01', value: 2 },
      { date: '2026-06-03', value: 2 },
      { date: '2026-06-05', value: 1 },
    ]);
  });

  it('counts tool calls per day', () => {
    const result = queryDailyData(dbPath, '2026-06-01', '2026-06-05', 'tool-calls', 'claude');
    expect(result).toEqual([
      { date: '2026-06-01', value: 1 },
      { date: '2026-06-03', value: 1 },
      { date: '2026-06-05', value: 1 },
    ]);
  });

  it('returns empty array for range with no data', () => {
    const result = queryDailyData(dbPath, '2020-01-01', '2020-01-31', 'tokens', 'claude');
    expect(result).toEqual([]);
  });
});

describe('queryDailyData (cc-switch source)', () => {
  let switchDb: DatabaseSync;
  let switchDir: string;
  let switchPath: string;

  beforeAll(() => {
    switchDir = mkdtempSync(join(tmpdir(), 'cc-heatmap-test-switch-'));
    switchPath = join(switchDir, 'test-cc-switch.db');
    switchDb = new DatabaseSync(switchPath);

    switchDb.exec(`
      CREATE TABLE usage_daily_rollups (
        date TEXT NOT NULL, app_type TEXT NOT NULL, provider_id TEXT NOT NULL,
        model TEXT NOT NULL, request_count INTEGER NOT NULL DEFAULT 0,
        success_count INTEGER NOT NULL DEFAULT 0,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cache_read_tokens INTEGER NOT NULL DEFAULT 0,
        cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
        total_cost_usd TEXT NOT NULL DEFAULT '0', avg_latency_ms INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (date, app_type, provider_id, model)
      );
      CREATE TABLE proxy_request_logs (
        request_id TEXT PRIMARY KEY, provider_id TEXT NOT NULL, app_type TEXT NOT NULL,
        model TEXT NOT NULL, input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cache_read_tokens INTEGER NOT NULL DEFAULT 0,
        cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
        latency_ms INTEGER NOT NULL, status_code INTEGER NOT NULL,
        created_at INTEGER NOT NULL, data_source TEXT NOT NULL DEFAULT 'proxy'
      );
    `);

    const rollupInsert = switchDb.prepare(`
      INSERT INTO usage_daily_rollups (date, app_type, provider_id, model, request_count, input_tokens, output_tokens, cache_read_tokens)
      VALUES (?, 'claude', 'p1', 'm1', 1, ?, ?, ?)
    `);
    rollupInsert.run('2026-04-15', 1000, 100, 500);
    rollupInsert.run('2026-04-16', 2000, 200, 0);

    const logInsert = switchDb.prepare(`
      INSERT INTO proxy_request_logs (request_id, provider_id, app_type, model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, latency_ms, status_code, created_at, data_source)
      VALUES (?, 'p1', 'claude', 'm1', ?, ?, ?, 0, 100, ?, ?, 'proxy')
    `);
    // These dates need to map to unix timestamps
    const ts0601 = Math.floor(new Date('2026-06-01T10:00:00Z').getTime() / 1000);
    const ts0603 = Math.floor(new Date('2026-06-03T10:00:00Z').getTime() / 1000);
    logInsert.run('r1', 500, 50, 200, 200, ts0601);
    logInsert.run('r2', 300, 30, 0, 200, ts0603);
  });

  afterAll(() => {
    switchDb.close();
    rmSync(switchDir, { recursive: true });
  });

  it('merges usage_daily_rollups and proxy_request_logs for tokens', () => {
    const result = queryDailyData(switchPath, '2026-04-01', '2026-06-30', 'tokens', 'cc-switch');
    expect(result).toHaveLength(4); // Apr 15, Apr 16, Jun 1, Jun 3
    expect(result[0]).toEqual({ date: '2026-04-15', value: 1600 }); // 1000+100+500
    expect(result[1]).toEqual({ date: '2026-04-16', value: 2200 }); // 2000+200+0
    expect(result[2]).toEqual({ date: '2026-06-01', value: 750 }); // 500+50+200
    expect(result[3]).toEqual({ date: '2026-06-03', value: 330 }); // 300+30+0
  });

  it('merges both tables for messages metric', () => {
    const result = queryDailyData(switchPath, '2026-04-01', '2026-06-30', 'messages', 'cc-switch');
    expect(result).toHaveLength(4);
    expect(result[0].value).toBe(1); // 1 row in daily_rollups for Apr 15
  });
});
