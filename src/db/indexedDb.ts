// ─── TabGuru IndexedDB Layer ──────────────────────────────────────────────────
// Stores historical analytics without bloating chrome.storage.local.
// Database: TabGuruDB v1
// Stores:
//   - purposes    → completed/abandoned tab sessions
//   - drift_events → drift alerts and how the user resolved them

import type { HistoricalPurpose, DriftRecord } from '../types';

const DB_NAME = 'TabGuruDB';
const DB_VERSION = 1;

let _db: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // ── purposes store ────────────────────────────────────────────────────
      if (!db.objectStoreNames.contains('purposes')) {
        const purposeStore = db.createObjectStore('purposes', {
          keyPath: 'id',
          autoIncrement: true,
        });
        purposeStore.createIndex('date', 'date', { unique: false });
        purposeStore.createIndex('status', 'status', { unique: false });
        purposeStore.createIndex('category', 'category', { unique: false });
      }

      // ── drift_events store ────────────────────────────────────────────────
      if (!db.objectStoreNames.contains('drift_events')) {
        const driftStore = db.createObjectStore('drift_events', {
          keyPath: 'id',
          autoIncrement: true,
        });
        driftStore.createIndex('date', 'date', { unique: false });
        driftStore.createIndex('domain', 'domain', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      _db = (event.target as IDBOpenDBRequest).result;
      resolve(_db);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

function toDateString(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Write Helpers ────────────────────────────────────────────────────────────

export async function logCompletedPurpose(record: Omit<HistoricalPurpose, 'id'>): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('purposes', 'readwrite');
    tx.objectStore('purposes').add(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function logDriftEvent(record: Omit<DriftRecord, 'id'>): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('drift_events', 'readwrite');
    tx.objectStore('drift_events').add(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Query Helpers ────────────────────────────────────────────────────────────

export async function queryPurposesByDate(date: string): Promise<HistoricalPurpose[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('purposes', 'readonly');
    const index = tx.objectStore('purposes').index('date');
    const request = index.getAll(IDBKeyRange.only(date));
    request.onsuccess = () => resolve(request.result as HistoricalPurpose[]);
    request.onerror = () => reject(request.error);
  });
}

export async function queryDriftByDate(date: string): Promise<DriftRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('drift_events', 'readonly');
    const index = tx.objectStore('drift_events').index('date');
    const request = index.getAll(IDBKeyRange.only(date));
    request.onsuccess = () => resolve(request.result as DriftRecord[]);
    request.onerror = () => reject(request.error);
  });
}

export interface DailyStats {
  date: string;
  totalPurposes: number;
  completedPurposes: number;
  abandonedPurposes: number;
  completionRate: number;         // 0-100
  totalFocusMs: number;
  driftCount: number;
  driftGoBackCount: number;
  topCategory: string;
  starRating?: number;            // user's self-reported focus (1-5)
}

export async function getDailyStats(date: string): Promise<DailyStats> {
  const [purposes, drifts] = await Promise.all([
    queryPurposesByDate(date),
    queryDriftByDate(date),
  ]);

  const completed = purposes.filter((p) => p.status === 'completed');
  const totalFocusMs = purposes.reduce((sum, p) => sum + (p.timeSpentMs ?? 0), 0);

  // Top category by frequency
  const catCounts: Record<string, number> = {};
  for (const p of purposes) {
    catCounts[p.category] = (catCounts[p.category] ?? 0) + 1;
  }
  const topCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Other';

  // Retrieve star rating from chrome.storage.local
  let starRating: number | undefined;
  try {
    const result = await chrome.storage.local.get(`reflection_rating_${date}`);
    starRating = result[`reflection_rating_${date}`] as number | undefined;
  } catch { /* ignore */ }

  return {
    date,
    totalPurposes: purposes.length,
    completedPurposes: completed.length,
    abandonedPurposes: purposes.filter((p) => p.status === 'abandoned').length,
    completionRate: purposes.length > 0 ? Math.round((completed.length / purposes.length) * 100) : 0,
    totalFocusMs,
    driftCount: drifts.length,
    driftGoBackCount: drifts.filter((d) => d.userAction === 'go_back').length,
    topCategory,
    starRating,
  };
}

export interface WeeklyDay {
  date: string;          // YYYY-MM-DD
  label: string;         // e.g. "Mon"
  focusMs: number;
  driftCount: number;
  completionRate: number;
}

export async function getWeeklyStats(): Promise<WeeklyDay[]> {
  const days: WeeklyDay[] = [];
  const now = Date.now();
  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 6; i >= 0; i--) {
    const ts = now - i * 86_400_000;
    const date = toDateString(ts);
    const d = new Date(ts);
    const stats = await getDailyStats(date);
    days.push({
      date,
      label: DAY_LABELS[d.getDay()],
      focusMs: stats.totalFocusMs,
      driftCount: stats.driftCount,
      completionRate: stats.completionRate,
    });
  }
  return days;
}

export interface HistoryEntry extends HistoricalPurpose {
  id: number;
}

export async function getAllHistory(limit = 200): Promise<HistoryEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('purposes', 'readonly');
    const store = tx.objectStore('purposes');
    const request = store.openCursor(null, 'prev'); // newest first
    const results: HistoryEntry[] = [];

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor && results.length < limit) {
        results.push(cursor.value as HistoryEntry);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getDriftHotspots(days = 7): Promise<Array<{ domain: string; count: number }>> {
  const db = await openDb();
  const cutoff = toDateString(Date.now() - days * 86_400_000);

  return new Promise((resolve, reject) => {
    const tx = db.transaction('drift_events', 'readonly');
    const store = tx.objectStore('drift_events');
    const request = store.getAll();

    request.onsuccess = () => {
      const all = request.result as DriftRecord[];
      const recent = all.filter((r) => r.date >= cutoff);
      const counts: Record<string, number> = {};
      for (const r of recent) {
        counts[r.domain] = (counts[r.domain] ?? 0) + 1;
      }
      const sorted = Object.entries(counts)
        .map(([domain, count]) => ({ domain, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      resolve(sorted);
    };
    request.onerror = () => reject(request.error);
  });
}

// ─── Utility ──────────────────────────────────────────────────────────────────

export { toDateString };
