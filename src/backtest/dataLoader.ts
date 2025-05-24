// -----------------------------
// src/backtest/dataLoader.ts
// -----------------------------
import { Pool } from 'pg';
import { config } from '../config';
import { TimeSeriesPoint } from './types';

// Create a fresh connection pool for backtesting
const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
});

/**
 * Retrieves time-series LTP data for a given option token between two timestamps
 */
export async function getLtpSeries(
  token: string,
  start: Date,
  end: Date
): Promise<TimeSeriesPoint[]> {
  const sql = `
    SELECT l.received_at as time, l.ltp
    FROM ltp_data l
    JOIN topics t ON l.topic_id = t.topic_id
    WHERE t.topic_name = $1
      AND l.received_at BETWEEN $2 AND $3
    ORDER BY l.received_at ASC
  `;
  const res = await pool.query(sql, [
    `NSE_FO|${token}`,
    start.toISOString(),
    end.toISOString(),
  ]);

  console.log(`Loaded ${res.rowCount} rows for token ${token} between ${start.toISOString()} and ${end.toISOString()}`);
  return res.rows.map(r => ({ time: new Date(r.time), ltp: Number(r.ltp) }));
}

/**
 * Retrieves the LTP of an index (e.g., BANKNIFTY) at a specific timestamp
 */
export async function getIndexLtpAt(
  indexName: string,
  timestamp: Date
): Promise<number> {
  const sql = `
    SELECT l.ltp
    FROM ltp_data l
    JOIN topics t ON l.topic_id = t.topic_id
    WHERE t.index_name = $1 AND t.type = 'index'
      AND l.received_at <= $2
    ORDER BY l.received_at DESC
    LIMIT 1
  `;
  const res = await pool.query(sql, [indexName, timestamp.toISOString()]);
  if (res.rowCount === 0) {
    throw new Error(`No LTP found for index ${indexName} at ${timestamp}`);
  }
  return Number(res.rows[0].ltp);
}
