import type { TabPurpose, ActivePurposes, PendingPurpose, ExcludedDomain } from '../types';

const KEY_ACTIVE  = 'active_purposes';
const KEY_RECENT  = 'recent_purposes';
const KEY_PENDING = 'pending_purposes'; // short-lived, TTL 30s
const KEY_EXCLUDED_DOMAINS = 'excluded_domains';

// Default domains where TabGuru should never intercept
const DEFAULT_EXCLUDED_DOMAINS: ExcludedDomain[] = [{ domain: 'localhost' }];

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
    await addRecentPurpose(purpose.purpose.trim(), purpose.destinationUrl);
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

export async function updatePurposeText(tabId: number, newText: string): Promise<void> {
  const result = await chrome.storage.local.get(KEY_ACTIVE);
  const all = (result[KEY_ACTIVE] ?? {}) as ActivePurposes;
  if (all[String(tabId)]) {
    all[String(tabId)].purpose = newText;
    await chrome.storage.local.set({ [KEY_ACTIVE]: all });
  }
}

/** Remove the openerTabId from a purpose, making it a standalone (unlinked) tab. */
export async function detachFromParent(tabId: number): Promise<void> {
  const result = await chrome.storage.local.get(KEY_ACTIVE);
  const all = (result[KEY_ACTIVE] ?? {}) as ActivePurposes;
  if (all[String(tabId)]) {
    delete all[String(tabId)].openerTabId;
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
  url: string,
  openerTabId?: number
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
    openerTabId,
  };

  await savePurpose(purpose);
  return purpose;
}

export async function getActiveChildren(parentTabId: number): Promise<TabPurpose[]> {
  const result = await chrome.storage.local.get(KEY_ACTIVE);
  const all = (result[KEY_ACTIVE] ?? {}) as ActivePurposes;

  const candidates = Object.values(all).filter(
    (p) => p.openerTabId === parentTabId && p.status === 'active'
  );

  if (candidates.length === 0) return [];

  // Cross-check: verify each candidate tab still actually exists in Chrome.
  // If the user closed a tab via the browser X button and the onRemoved cleanup
  // was missed (e.g. MV3 service worker suspension), this self-heals.
  const existingTabs = await chrome.tabs.query({});
  const existingIds = new Set(existingTabs.map((t) => t.id).filter(Boolean) as number[]);

  const verified: TabPurpose[] = [];
  const staleIds: number[] = [];

  for (const p of candidates) {
    if (existingIds.has(p.tabId)) {
      verified.push(p);
    } else {
      staleIds.push(p.tabId); // tab was closed without cleanup
    }
  }

  // Self-heal: remove stale entries from storage so they never reappear
  if (staleIds.length > 0) {
    for (const id of staleIds) delete all[String(id)];
    await chrome.storage.local.set({ [KEY_ACTIVE]: all });
  }

  return verified;
}

/**
 * Recursively collect ALL descendants (children, grandchildren, …) of a tab.
 * Uses BFS so the order is breadth-first — safe to close in sequence.
 */
export async function getAllDescendants(rootTabId: number): Promise<TabPurpose[]> {
  const result = await chrome.storage.local.get(KEY_ACTIVE);
  const all = Object.values((result[KEY_ACTIVE] ?? {}) as ActivePurposes);

  const descendants: TabPurpose[] = [];
  const queue: number[] = [rootTabId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = all.filter(
      (p) => p.openerTabId === current && p.status === 'active'
    );
    for (const child of children) {
      descendants.push(child);
      queue.push(child.tabId); // recurse into grandchildren
    }
  }

  return descendants;
}

// ─── Recent Purposes (Suggestions) ───────────────────────────────────────────

export interface RecentPurpose {
  purpose: string;
  url?: string;
}

export async function getRecentPurposes(): Promise<RecentPurpose[]> {
  const result = await chrome.storage.local.get(KEY_RECENT);
  const raw = (result[KEY_RECENT] as any[]) || [];
  return raw.map((item: any) => 
    typeof item === 'string' ? { purpose: item } : item
  );
}

async function addRecentPurpose(purpose: string, url?: string): Promise<void> {
  const result = await chrome.storage.local.get(KEY_RECENT);
  let recent = (result[KEY_RECENT] as any[]) || [];
  // filter out older ones with same purpose
  recent = recent.filter((p) => (typeof p === 'string' ? p : p.purpose) !== purpose);
  recent.unshift({ purpose, url });
  recent = recent.slice(0, 10);
  await chrome.storage.local.set({ [KEY_RECENT]: recent });
}

// ─── Excluded Domains ─────────────────────────────────────────────────────────

/**
 * Returns the list of domains excluded from TabGuru interception.
 * Supports both the new ExcludedDomain object format and the legacy string[] format
 * (transparently migrates old data on first read).
 */
export async function getExcludedDomains(): Promise<ExcludedDomain[]> {
  const result = await chrome.storage.local.get(KEY_EXCLUDED_DOMAINS);
  if (result[KEY_EXCLUDED_DOMAINS] === undefined) {
    // First run — seed defaults
    await chrome.storage.local.set({ [KEY_EXCLUDED_DOMAINS]: DEFAULT_EXCLUDED_DOMAINS });
    return [...DEFAULT_EXCLUDED_DOMAINS];
  }
  const raw = result[KEY_EXCLUDED_DOMAINS] as (string | ExcludedDomain)[];
  // Backward compat: migrate plain strings to object format
  return raw.map((item) =>
    typeof item === 'string' ? { domain: item } : item
  );
}

/** Overwrite the full excluded domains list. */
export async function setExcludedDomains(domains: ExcludedDomain[]): Promise<void> {
  await chrome.storage.local.set({ [KEY_EXCLUDED_DOMAINS]: domains });
}

/** Helper: match hostname against a single domain pattern (supports wildcard prefix). */
function matchesDomain(hostname: string, d: string): boolean {
  if (d.startsWith('*.')) {
    const base = d.slice(2);
    return hostname === base || hostname.endsWith(`.${base}`);
  }
  return hostname === d || hostname === `www.${d}` || `www.${hostname}` === d;
}

/**
 * Returns true if the given URL's hostname is in the excluded domains list.
 * Supports exact hostname match and wildcard prefix (e.g. "*.company.com").
 */
export async function isUrlExcluded(url: string): Promise<boolean> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }
  const domains = await getExcludedDomains();
  return domains.some(({ domain: d }) => matchesDomain(hostname, d));
}

/**
 * Returns the saved intention for an excluded domain URL, or null if none is set.
 * Used to populate the auto-purpose label when a tracked excluded-domain tab is created.
 */
export async function getIntentionForUrl(url: string): Promise<string | null> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return null;
  }
  const domains = await getExcludedDomains();
  const match = domains.find(({ domain: d }) => matchesDomain(hostname, d));
  return match?.intention?.trim() || null;
}
