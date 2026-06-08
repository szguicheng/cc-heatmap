import { DatabaseSync } from 'node:sqlite';

export type Metric = 'tokens' | 'messages' | 'tool-calls';

export interface DailyData {
  date: string;
  value: number;
}

const METRIC_SQL: Record<Metric, string> = {
  tokens: `SELECT date(timestamp) as date, SUM(input_tokens + output_tokens + cache_read_tokens + cache_creation_tokens) as value
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

export function queryDailyData(
  dbPath: string,
  fromDate: string,
  toDate: string,
  metric: Metric,
): DailyData[] {
  const db = new DatabaseSync(dbPath);
  try {
    const sql = METRIC_SQL[metric];
    const stmt = db.prepare(sql);
    const rows = stmt.all(fromDate, toDate) as unknown as DailyData[];
    return rows;
  } finally {
    db.close();
  }
}
