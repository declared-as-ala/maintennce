import * as SQLite from 'expo-sqlite';
import { CallEvent, ZoneId, CallEventStatus, CallSource, ButtonId } from '../types/maintenance';

const DB_NAME = 'maintenance_call.db';

let db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync(DB_NAME);
    await initDatabase(db);
  }
  return db;
}

async function initDatabase(database: SQLite.SQLiteDatabase): Promise<void> {
  // execAsync supports multiple semicolon-separated statements
  await database.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS calls (
      id TEXT PRIMARY KEY NOT NULL,
      zone TEXT NOT NULL,
      zone_name TEXT NOT NULL,
      button TEXT NOT NULL DEFAULT 'B1',
      panne_label TEXT NOT NULL DEFAULT '',
      started_at TEXT NOT NULL,
      acknowledged_at TEXT,
      duration_seconds INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      source TEXT NOT NULL DEFAULT 'esp32',
      created_at TEXT NOT NULL,
      pending_sync INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_calls_zone ON calls(zone);
    CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
    CREATE INDEX IF NOT EXISTS idx_calls_started_at ON calls(started_at DESC);
  `);

  // Lightweight migration for existing DBs created before button/panne columns.
  try {
    await database.runAsync(`ALTER TABLE calls ADD COLUMN button TEXT NOT NULL DEFAULT 'B1'`);
  } catch {}
  try {
    await database.runAsync(`ALTER TABLE calls ADD COLUMN panne_label TEXT NOT NULL DEFAULT ''`);
  } catch {}
}

function rowToCallEvent(row: Record<string, unknown>): CallEvent {
  return {
    id: row.id as string,
    zone: row.zone as ZoneId,
    zoneName: row.zone_name as string,
    button: ((row.button as string) ?? 'B1') as ButtonId,
    panneLabel: (row.panne_label as string) || 'Panne non specifiee',
    startedAt: row.started_at as string,
    acknowledgedAt: row.acknowledged_at as string | null,
    durationSeconds: row.duration_seconds as number | null,
    status: row.status as CallEventStatus,
    source: row.source as CallSource,
    createdAt: row.created_at as string,
    pendingSync: (row.pending_sync as number) === 1,
  };
}

export async function insertCall(event: CallEvent): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    `INSERT OR REPLACE INTO calls
      (id, zone, zone_name, button, panne_label, started_at, acknowledged_at, duration_seconds, status, source, created_at, pending_sync)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    event.id,
    event.zone,
    event.zoneName,
    event.button,
    event.panneLabel,
    event.startedAt,
    event.acknowledgedAt ?? null,
    event.durationSeconds ?? null,
    event.status,
    event.source,
    event.createdAt,
    event.pendingSync ? 1 : 0
  );
}

export async function acknowledgeCall(
  id: string,
  acknowledgedAt: string,
  durationSeconds: number
): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    `UPDATE calls SET status = 'acknowledged', acknowledged_at = ?, duration_seconds = ?, pending_sync = 0
     WHERE id = ?`,
    acknowledgedAt,
    durationSeconds,
    id
  );
}

export async function acknowledgeZoneCalls(zone: ZoneId, acknowledgedAt: string): Promise<void> {
  const database = await getDb();
  const rows = await database.getAllAsync<{ id: string; started_at: string }>(
    `SELECT id, started_at FROM calls WHERE zone = ? AND status = 'pending'`,
    zone
  );
  for (const row of rows) {
    const duration = Math.floor(
      (new Date(acknowledgedAt).getTime() - new Date(row.started_at).getTime()) / 1000
    );
    await database.runAsync(
      `UPDATE calls SET status = 'acknowledged', acknowledged_at = ?, duration_seconds = ? WHERE id = ?`,
      acknowledgedAt,
      duration,
      row.id
    );
  }
}

export async function acknowledgeAllCalls(acknowledgedAt: string): Promise<void> {
  const database = await getDb();
  const rows = await database.getAllAsync<{ id: string; started_at: string }>(
    `SELECT id, started_at FROM calls WHERE status = 'pending'`
  );
  for (const row of rows) {
    const duration = Math.floor(
      (new Date(acknowledgedAt).getTime() - new Date(row.started_at).getTime()) / 1000
    );
    await database.runAsync(
      `UPDATE calls SET status = 'acknowledged', acknowledged_at = ?, duration_seconds = ? WHERE id = ?`,
      acknowledgedAt,
      duration,
      row.id
    );
  }
}

export async function getAllCalls(): Promise<CallEvent[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM calls ORDER BY started_at DESC LIMIT 500`
  );
  return rows.map(rowToCallEvent);
}

export async function getCallsByZone(zone: ZoneId): Promise<CallEvent[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM calls WHERE zone = ? ORDER BY started_at DESC`,
    zone
  );
  return rows.map(rowToCallEvent);
}

export async function getPendingCalls(): Promise<CallEvent[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM calls WHERE status = 'pending' ORDER BY started_at ASC`
  );
  return rows.map(rowToCallEvent);
}

export async function getPendingSyncCalls(): Promise<CallEvent[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM calls WHERE pending_sync = 1`
  );
  return rows.map(rowToCallEvent);
}

export async function clearAllHistory(): Promise<void> {
  const database = await getDb();
  await database.execAsync(`DELETE FROM calls`);
}

export const DatabaseService = {
  insertCall,
  acknowledgeCall,
  acknowledgeZoneCalls,
  acknowledgeAllCalls,
  getAllCalls,
  getCallsByZone,
  getPendingCalls,
  getPendingSyncCalls,
  clearAllHistory,
};
