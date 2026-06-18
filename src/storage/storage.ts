import type { TabPurpose, ActivePurposes, PendingPurpose } from '../types';

const KEY_ACTIVE  = 'active_purposes';
const KEY_RECENT  = 'recent_purposes';
const KEY_PENDING = 'pending_purposes'; // short-lived, TTL 30s

// ─── Active Purpose CRUD ─────────────────────────────────────────────────────

export async function getPurpose(tabId: number): Promise<TabPurpose | null> {
  const result = await chrome.storage.local.get(KEY_ACTIVE);
  const all = (result[KEY_ACTIVE] ?? {}) as ActivePurposes;
  return all[String(tabId)] ?? null;
}

export async function savePurpose(purpose: TabPurpose): Promise<void> {
  const result = await chrome.storage.local.get(KEY_ACTIVE);
  const all = (result[KEY_ACTIVE] ?? {}) as ActivePurposes;
  all[String(purpose.tabId)] = purpose;
  await chrome.storage.local.set({ [KEY_ACTIVE]: all });

  if (purpose.purpose.trim()) {
    await addRecentPurpose(purpose.purpose.trim());
  }
}

export async function updatePurposeStatus(
  tabId: number,
  status: TabPurpose['status']
): Promise<void> {
  const result = await chrome.storage.local.get(KEY_ACTIVE);
  const all = (result[KEY_ACTIVE] ?? {}) as ActivePurposes;
  if (all[String(tabId)]) {
    all[String(tabId)].status = status;
    await chrome.storage.local.set({ [KEY_ACTIVE]: all });
  }
}

export async function removePurpose(tabId: number): Promise<void> {
  const result = await chrome.storage.local.get(KEY_ACTIVE);
  const all = (result[KEY_ACTIVE] ?? {}) as ActivePurposes;
  delete all[String(tabId)];
  await chrome.storage.local.set({ [KEY_ACTIVE]: all });
}

export async function extendPurpose(
  tabId: number,
  extraMinutes: number
): Promise<void> {
  const result = await chrome.storage.local.get(KEY_ACTIVE);
  const all = (result[KEY_ACTIVE] ?? {}) as ActivePurposes;
  const entry = all[String(tabId)];
  if (entry) {
    entry.durationMinutes += extraMinutes;
    await chrome.storage.local.set({ [KEY_ACTIVE]: all });
  }
}

// ─── Pause / Resume ───────────────────────────────────────────────────────────

/** Pause the timer for a tab (called when tab loses focus). */
export async function pausePurpose(tabId: number): Promise<void> {
  const result = await chrome.storage.local.get(KEY_ACTIVE);
  const all = (result[KEY_ACTIVE] ?? {}) as ActivePurposes;
  const entry = all[String(tabId)];
  if (!entry || entry.lastActivatedAt === null) return;

  const now = Date.now();
  entry.accumulatedMs += now - entry.lastActivatedAt;
  entry.lastActivatedAt = null;
  await chrome.storage.local.set({ [KEY_ACTIVE]: all });
}

/** Resume the timer for a tab (called when tab gains focus). */
export async function resumePurpose(tabId: number): Promise<void> {
  const result = await chrome.storage.local.get(KEY_ACTIVE);
  const all = (result[KEY_ACTIVE] ?? {}) as ActivePurposes;
  const entry = all[String(tabId)];
  if (!entry || entry.lastActivatedAt !== null) return;

  entry.lastActivatedAt = Date.now();
  await chrome.storage.local.set({ [KEY_ACTIVE]: all });
}

// ─── Pending Purposes (for link interception) ────────────────────────────────

const PENDING_TTL_MS = 30_000; // 30 seconds — discard stale intents

export async function storePendingPurpose(p: PendingPurpose): Promise<void> {
  const result = await chrome.storage.local.get(KEY_PENDING);
  const pending = (result[KEY_PENDING] ?? []) as PendingPurpose[];

  const now = Date.now();
  const fresh = pending.filter(
    (x) => x.url !== p.url && now - x.createdAt < PENDING_TTL_MS
  );
  fresh.push(p);
  await chrome.storage.local.set({ [KEY_PENDING]: fresh });
}

/**
 * Check (without consuming) whether a pending purpose already exists for a URL.
 * Used by the background onCreated listener to avoid double-intercepting tabs
 * that were already handled by the content-script link interceptor.
 */
export async function hasPendingPurposeForUrl(url: string): Promise<boolean> {
  const result = await chrome.storage.local.get(KEY_PENDING);
  const pending = (result[KEY_PENDING] ?? []) as PendingPurpose[];
  const now = Date.now();
  const normalise = (u: string) => u.replace(/[/#?].*$/, '').replace(/\/$/, '');
  return pending.some(
    (p) => normalise(p.url) === normalise(url) && now - p.createdAt < PENDING_TTL_MS
  );
}

/**
 * Consume a pending purpose by URL.
 * Called when a new tab's content script runs GET_PURPOSE and no active purpose
 * is found yet. Converts the pending entry into a full TabPurpose.
 */
export async function consumePendingPurpose(
  tabId: number,
  url: string
): Promise<TabPurpose | null> {
  const result = await chrome.storage.local.get(KEY_PENDING);
  const pending = (result[KEY_PENDING] ?? []) as PendingPurpose[];
  const now = Date.now();

  // Match by normalised URL (strip trailing slash / hash for robustness)
  const normalise = (u: string) => u.replace(/[/#?].*$/, '').replace(/\/$/, '');
  const idx = pending.findIndex(
    (p) =>
      normalise(p.url) === normalise(url) && now - p.createdAt < PENDING_TTL_MS
  );

  if (idx === -1) return null;

  const [match] = pending.splice(idx, 1);
  await chrome.storage.local.set({ [KEY_PENDING]: pending }); // consume it

  const purpose: TabPurpose = {
    tabId,
    purpose: match.purpose,
    durationMinutes: match.durationMinutes,
    startTime: now,
    endTime: now + match.durationMinutes * 60_000,
    status: 'active',
    destinationUrl: match.url,
    accumulatedMs: 0,
    lastActivatedAt: now,
  };

  await savePurpose(purpose);
  return purpose;
}

// ─── Recent Purposes (Suggestions) ───────────────────────────────────────────

export async function getRecentPurposes(): Promise<string[]> {
  const result = await chrome.storage.local.get(KEY_RECENT);
  return (result[KEY_RECENT] as string[]) ?? [];
}

async function addRecentPurpose(purpose: string): Promise<void> {
  const result = await chrome.storage.local.get(KEY_RECENT);
  let recent = ((result[KEY_RECENT] as string[]) ?? []);
  recent = [purpose, ...recent.filter((p) => p !== purpose)].slice(0, 10);
  await chrome.storage.local.set({ [KEY_RECENT]: recent });
}
