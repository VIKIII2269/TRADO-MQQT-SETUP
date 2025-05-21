import { Pool } from "pg";
import { config } from "../config";

// Type for incoming data
export interface BatchItem {
  topic: string;
  ltp: number;
  indexName?: string;
  type?: string;
  strike?: number;
}

// PostgreSQL connection pool
let pool: Pool;
let dataBatch: BatchItem[] = [];
let batchTimer: NodeJS.Timeout | null = null;

// Topic ID cache to reduce DB queries
const topicCache = new Map<string, number>();

// Create and return a DB connection pool
export function createPool(): Pool {
  return new Pool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
  });
}

// Initialize the DB connection
export function initialize(dbPool: Pool) {
  pool = dbPool;
  console.log("Database initialized");
}

// Fetch or insert topic ID (with cache)
export async function getTopicId(
  topicName: string,
  indexName?: string,
  type?: string,
  strike?: number
): Promise<number> {
  if (topicCache.has(topicName)) {
    return topicCache.get(topicName)!;
  }

  // Try fetching from database
  const selectRes = await pool.query(
    `SELECT topic_id FROM topics WHERE topic_name = $1`,
    [topicName]
  );

  if (selectRes.rowCount != null && selectRes.rowCount > 0) {
    const id = selectRes.rows[0].topic_id;
    topicCache.set(topicName, id);
    return id;
  }

  // Insert new topic and return its ID
  const insertRes = await pool.query(
    `INSERT INTO topics (topic_name, index_name, type, strike)
     VALUES ($1, $2, $3, $4) RETURNING topic_id`,
    [topicName, indexName, type, strike]
  );

  const newId = insertRes.rows[0].topic_id;
  topicCache.set(topicName, newId);
  return newId;
}


// Queue data for batch insert
export function saveToDatabase(
  topic: string,
  ltp: number,
  indexName?: string,
  type?: string,
  strike?: number
) {
  dataBatch.push({ topic, ltp, indexName, type, strike });

  if (!batchTimer) {
    batchTimer = setTimeout(() => flushBatch(), config.app.batchInterval);
  }

  if (dataBatch.length >= config.app.batchSize) {
    flushBatch();
  }
}

// Flush batch to database
export async function flushBatch() {
  if (batchTimer) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }

  if (dataBatch.length === 0) return;

  console.log(`Flushing ${dataBatch.length} items to DB...`);

  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const topicIdMap = new Map<string, number>();

      // Resolve all topic IDs
      for (const item of dataBatch) {
        if (!topicIdMap.has(item.topic)) {
          const id = await getTopicId(item.topic, item.indexName, item.type, item.strike);
          topicIdMap.set(item.topic, id);
        }
      }

      // Prepare batched insert
      const insertValues: string[] = [];
      const insertParams: any[] = [];

      dataBatch.forEach((item, idx) => {
        const paramIdx = idx * 2;
        const topicId = topicIdMap.get(item.topic)!;

        insertValues.push(`($${paramIdx + 1}, $${paramIdx + 2})`);
        insertParams.push(topicId, item.ltp);
      });

      await client.query(
        `INSERT INTO ltp_data (topic_id, ltp) VALUES ${insertValues.join(", ")}`,
        insertParams
      );

      await client.query("COMMIT");
      console.log("Batch inserted successfully.");
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Error during batch insert:", err);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("DB Connection error during flush:", err);
  } finally {
    dataBatch = [];
  }
}

// Graceful shutdown and flush
export async function cleanupDatabase() {
  if (dataBatch.length > 0) {
    await flushBatch();
  }

  if (pool) {
    await pool.end();
  }

  console.log("Database cleanup completed.");
}
