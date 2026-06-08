import { DatabaseSync } from 'node:sqlite';

export type Metric = 'tokens' | 'messages' | 'tool-calls';
export type DataSource = 'claude' | 'cc-switch';

export interface DailyData {
  date: string;
  value: number;
}

// Claude Code usage.db — turns table（最多保留约30天）
const CLAUDE_SQL: Record<Metric, string> = {
  tokens: `SELECT date(timestamp) as date,
           SUM(input_tokens + output_tokens + cache_read_tokens + cache_creation_tokens) as value
           FROM turns WHERE date(timestamp) >= ? AND date(timestamp) <= ?
           GROUP BY date(timestamp) ORDER BY date(timestamp)`,

  messages: `SELECT date(timestamp) as date, COUNT(*) as value
             FROM turns WHERE date(timestamp) >= ? AND date(timestamp) <= ?
             GROUP BY date(timestamp) ORDER BY date(timestamp)`,

  'tool-calls': `SELECT date(timestamp) as date, COUNT(*) as value
                 FROM turns
                 WHERE date(timestamp) >= ? AND date(timestamp) <= ?
                   AND tool_name IS NOT NULL AND tool_name != ''
                 GROUP BY date(timestamp) ORDER BY date(timestamp)`,
};

// cc-switch — merges usage_daily_rollups + proxy_request_logs
// usage_daily_rollups: 按天预聚合，有数据截至最后一次 switch 同步
// proxy_request_logs: 原始请求日志（created_at 为 unix 秒）
const CCSWITCH_TOKEN_SQL = `
  SELECT day as date, SUM(value) as value FROM (
    SELECT date as day,
           SUM(input_tokens + output_tokens + cache_read_tokens + cache_creation_tokens) as value
    FROM usage_daily_rollups
    WHERE date >= ? AND date <= ?
    GROUP BY date

    UNION ALL

    SELECT date(datetime(created_at, 'unixepoch')) as day,
           SUM(input_tokens + output_tokens + cache_read_tokens + cache_creation_tokens) as value
    FROM proxy_request_logs
    WHERE created_at >= strftime('%s', ? || 'T00:00:00')
      AND created_at <= strftime('%s', ? || 'T23:59:59')
      AND status_code = 200
    GROUP BY day
  )
  WHERE day >= ? AND day <= ?
  GROUP BY day ORDER BY day
`;

const CCSWITCH_MESSAGES_SQL = `
  SELECT day as date, SUM(value) as value FROM (
    SELECT date as day, SUM(request_count) as value
    FROM usage_daily_rollups
    WHERE date >= ? AND date <= ?
    GROUP BY date

    UNION ALL

    SELECT date(datetime(created_at, 'unixepoch')) as day, COUNT(*) as value
    FROM proxy_request_logs
    WHERE created_at >= strftime('%s', ? || 'T00:00:00')
      AND created_at <= strftime('%s', ? || 'T23:59:59')
      AND status_code = 200
    GROUP BY day
  )
  WHERE day >= ? AND day <= ?
  GROUP BY day ORDER BY day
`;

const CCSWITCH_TOOL_SQL = `
  SELECT date(datetime(created_at, 'unixepoch')) as date, COUNT(*) as value
  FROM proxy_request_logs
  WHERE created_at >= strftime('%s', ? || 'T00:00:00')
    AND created_at <= strftime('%s', ? || 'T23:59:59')
    AND status_code = 200
  GROUP BY date ORDER BY date
`;

export function queryDailyData(
  dbPath: string,
  fromDate: string,
  toDate: string,
  metric: Metric,
  source: DataSource,
): DailyData[] {
  const db = new DatabaseSync(dbPath);
  try {
    if (source === 'cc-switch') {
      return queryCcSwitch(db, fromDate, toDate, metric);
    }

    const sql = CLAUDE_SQL[metric];
    const stmt = db.prepare(sql);
    return stmt.all(fromDate, toDate) as unknown as DailyData[];
  } finally {
    db.close();
  }
}

function queryCcSwitch(
  db: DatabaseSync,
  fromDate: string,
  toDate: string,
  metric: Metric,
): DailyData[] {
  if (metric === 'tool-calls') {
    const stmt = db.prepare(CCSWITCH_TOOL_SQL);
    return stmt.all(fromDate, toDate) as unknown as DailyData[];
  }

  const sql = metric === 'tokens' ? CCSWITCH_TOKEN_SQL : CCSWITCH_MESSAGES_SQL;
  // These queries need the date range bound multiple times
  // For UNION queries: fromDate, toDate, fromDate, toDate, fromDate, toDate (outer filter)
  const stmt = db.prepare(sql);
  if (metric === 'tokens') {
    return stmt.all(fromDate, toDate, fromDate, toDate, fromDate, toDate) as unknown as DailyData[];
  }
  return stmt.all(fromDate, toDate, fromDate, toDate, fromDate, toDate) as unknown as DailyData[];
}
