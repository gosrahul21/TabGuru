import {
  getPurpose,
  savePurpose,
  removePurpose,
  updatePurposeStatus,
  updatePurposeText,
  detachFromParent,
  extendPurpose,
  pausePurpose,
  resumePurpose,
  storePendingPurpose,
  consumePendingPurpose,
  hasPendingPurposeForUrl,
  getActiveChildren,
  getAllDescendants,
  getExcludedDomains,
  setExcludedDomains,
  isUrlExcluded,
  getIntentionForUrl,
  getShortcuts,
  setShortcuts,
  getInstallTime,
  setInstallTime,
  getLicenseKey,
  setLicenseKey,
} from '../storage/storage';
import { DODO_API_BASE, WELCOME_ONBOARDING_URL, PAYWALL_URL, UNINSTALL_URL } from '../config';
import type { ExtensionMessage, ExtensionResponse } from '../types';
import {
  logCompletedPurpose,
  logDriftEvent,
  getDailyStats,
  getWeeklyStats,
  getAllHistory,
  getDriftHotspots,
  toDateString,
} from '../db/indexedDb';
import { classifyPurpose } from '../db/classifier';

// ─── Trial and License Logic ───────────────────────────────────────────────────

const TRIAL_DURATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

async function isPremiumOrTrialActive(): Promise<boolean> {
  const licenseKey = await getLicenseKey();
  if (licenseKey && licenseKey.length > 4) {
    return true; // Assume valid if exists (verified during activation)
  }

  const installTime = await getInstallTime();
  if (!installTime) {
    // If somehow install time is missing, set it now to give them a trial
    await setInstallTime(Date.now());
    return true;
  }

  if (Date.now() - installTime < TRIAL_DURATION_MS) {
    return true; // Still in trial
  }

  return false; // Trial expired and no license
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    await setInstallTime(Date.now());
    if (WELCOME_ONBOARDING_URL) {
      chrome.tabs.create({ url: WELCOME_ONBOARDING_URL });
    }
  }

  if (UNINSTALL_URL) {
    chrome.runtime.setUninstallURL(UNINSTALL_URL);
  }
});

// ─── Tab Lifecycle ────────────────────────────────────────────────────────────

async function broadcastMessage(message: any) {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, message);
        } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  // Snapshot the purpose BEFORE marking complete & removing
  const existing = await getPurpose(tabId).catch(() => null);

  // Mark as completed first so any in-flight GET_PURPOSE calls exclude it immediately
  await updatePurposeStatus(tabId, 'completed').catch(() => {});

  // Log to IndexedDB for analytics
  if (existing) {
    const now = Date.now();
    const liveMs = existing.lastActivatedAt !== null ? now - existing.lastActivatedAt : 0;
    const timeSpentMs = existing.accumulatedMs + liveMs;
    let domain = '';
    try { domain = existing.destinationUrl ? new URL(existing.destinationUrl).hostname.replace(/^www\./, '') : ''; } catch { /* ignore */ }
    const category = classifyPurpose(existing.purpose, domain);
    
    // If it was already marked completed (via MARK_COMPLETE), log as completed. 
    // Otherwise, the user just closed the tab, so it's abandoned.
    const finalStatus = existing.status === 'completed' ? 'completed' : 'abandoned';
    
    logCompletedPurpose({
      date: toDateString(existing.startTime),
      purpose: existing.purpose,
      startTime: existing.startTime,
      endTime: now,
      timeSpentMs,
      durationMinutesAllocated: existing.durationMinutes,
      status: finalStatus,
      category,
      domain,
    }).catch(() => { /* non-critical */ });
  }

  await removePurpose(tabId);
  await broadcastMessage({ type: 'REFRESH_STATE' });
});

// ─── Right-click "Open in new tab" interception ───────────────────────────────
//
// The content script can intercept Ctrl+click / Middle-click / target=_blank.
// But right-click → context menu "Open in new tab" is a browser-level action
// that content scripts cannot see. We catch it here instead.
//
// Strategy: when a new tab is created with an openerTabId AND a real URL,
// check if the content script already handled it (has a pending purpose).
// If not → immediately redirect to our purpose page with ?redirect=<url>.

const PURPOSE_PAGE = chrome.runtime.getURL('src/newtab/index.html');

// URLs we must never intercept
const SKIP_PATTERNS = [
  /^chrome(-extension)?:\/\//,
  /^edge:\/\//,
  /^about:/,
  /^javascript:/,
  /^data:/,
  /^https?:\/\/(test\.)?checkout\.dodopayments\.com/,
];

chrome.tabs.onCreated.addListener(async (tab) => {
  // Only care about tabs opened from another tab (opener = right-click source)
  if (!tab.openerTabId || !tab.id) return;

  // Grab the URL — may be in pendingUrl before the tab fully loads
  const url = tab.pendingUrl ?? tab.url ?? '';

  // Skip blank tabs (handled by new-tab override), extension pages, and special URLs
  if (
    !url ||
    url === 'chrome://newtab/' ||
    url === 'edge://newtab/' ||
    SKIP_PATTERNS.some((p) => p.test(url))
  )
    return;

  // Skip tabs already handled by the content-script link interceptor
  // (those already have a pending purpose stored)
  const alreadyHandled = await hasPendingPurposeForUrl(url);
  if (alreadyHandled) return;

  // Auto-track excluded domains: store a pending purpose with saved intention (or hostname label)
  // so the new tab's content script picks it up and shows a banner.
  // The tab opens at its real destination (no redirect); we just book-keep it.
  if (await isUrlExcluded(url)) {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, '');
      const savedIntention = await getIntentionForUrl(url);
      await storePendingPurpose({
        url,
        purpose: savedIntention || `Browsing ${hostname}`,
        durationMinutes: 15,
        createdAt: Date.now(),
      });
    } catch { /* malformed URL — skip tracking */ }
    return;
  }

  // Trial Check
  const hasAccess = await isPremiumOrTrialActive();
  if (!hasAccess) {
    chrome.tabs.update(tab.id, { url: PAYWALL_URL });
    return;
  }

  // Redirect the new tab to our purpose page, preserving the original URL
  const purposePageWithRedirect = `${PURPOSE_PAGE}?redirect=${encodeURIComponent(url)}&opener=${tab.openerTabId}`;
  chrome.tabs.update(tab.id, { url: purposePageWithRedirect });
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only care about URL changes
  if (!changeInfo.url) return;

  const url = changeInfo.url;

  // Skip blank pages, extension pages, and internal browser pages
  if (
    !url ||
    url === 'chrome://newtab/' ||
    url === 'edge://newtab/' ||
    url.startsWith(PURPOSE_PAGE) ||
    SKIP_PATTERNS.some((p) => p.test(url))
  ) {
    return;
  }

  // Auto-track excluded domains: save a purpose directly to this tab
  // so it shows up in the parent's child list and gets a banner (no redirect).
  if (await isUrlExcluded(url)) {
    const existing = await getPurpose(tabId);
    if (!existing) {
      try {
        const hostname = new URL(url).hostname.replace(/^www\./, '');
        const savedIntention = await getIntentionForUrl(url);
        const now = Date.now();
        const openerTabId = tab.openerTabId ?? undefined;
        await savePurpose({
          tabId,
          purpose: savedIntention || `Browsing ${hostname}`,
          durationMinutes: 15,
          startTime: now,
          endTime: now + 15 * 60_000,
          status: 'active',
          destinationUrl: url,
          accumulatedMs: 0,
          lastActivatedAt: now,
          openerTabId,
        });
        await broadcastMessage({ type: 'REFRESH_STATE' });
      } catch { /* malformed URL — skip tracking */ }
    }
    return;
  }

  // Check if tab has an active purpose
  const purpose = await getPurpose(tabId);
  if (!purpose) {
    // Skip if there's a pending purpose (e.g. opened via link interception)
    const hasPending = await hasPendingPurposeForUrl(url);
    if (hasPending) return;

    // Trial Check
    const hasAccess = await isPremiumOrTrialActive();
    if (!hasAccess) {
      chrome.tabs.update(tabId, { url: PAYWALL_URL });
      return;
    }

    // Redirect to the purpose page, carrying the URL the user attempted to search/visit
    const purposePageWithRedirect = `${PURPOSE_PAGE}?redirect=${encodeURIComponent(url)}`;
    chrome.tabs.update(tabId, { url: purposePageWithRedirect });
  }
});

// ─── Pause / Resume on Tab Focus Changes ─────────────────────────────────────

let previousTabId: number | null = null;

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  if (previousTabId !== null && previousTabId !== tabId) {
    await pausePurpose(previousTabId);
  }
  await resumePurpose(tabId);
  previousTabId = tabId;
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    if (previousTabId !== null) await pausePurpose(previousTabId);
  } else {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, windowId });
      if (activeTab?.id) {
        await resumePurpose(activeTab.id);
        previousTabId = activeTab.id;
      }
    } catch { /* window may have closed */ }
  }
});

// ─── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender,
    sendResponse: (response: ExtensionResponse) => void
  ) => {
    const tabId = message.tabId ?? sender.tab?.id;

    const globalMessages = [
      'GET_EXCLUDED_DOMAINS', 'SET_EXCLUDED_DOMAINS',
      'GET_SHORTCUTS', 'SET_SHORTCUTS',
      'LOG_DRIFT_EVENT', 'GET_DAILY_STATS',
      'GET_WEEKLY_STATS', 'GET_HISTORY', 'GET_DRIFT_HOTSPOTS',
      'BROADCAST_REFRESH'
    ];

    if (!tabId && !globalMessages.includes(message.type) && message.type !== 'ACTIVATE_LICENSE') {
      sendResponse({ success: false, error: 'No tabId found' });
      return false;
    }

    switch (message.type) {
      // ── ACTIVATE_LICENSE ───────────────────────────────────────────────────
      case 'ACTIVATE_LICENSE': {
        const msg = message as Extract<ExtensionMessage, { type: 'ACTIVATE_LICENSE' }>;
        const DODO_ACTIVATE_URL = `${DODO_API_BASE}/licenses/activate`;
        
        fetch(DODO_ACTIVATE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ license_key: msg.licenseKey })
        })
        .then(async (res) => {
          if (!res.ok) throw new Error('Invalid license key');
          await setLicenseKey(msg.licenseKey);
          sendResponse({ success: true });
        })
        .catch(err => {
          sendResponse({ success: false, error: err.message || 'Invalid license key.' });
        });
        
        return true;
      }
      // ── GET_PURPOSE ────────────────────────────────────────────────────────
      // First checks active purposes; if not found, checks pending_purposes
      // (for tabs that were opened via link interception).
      case 'GET_PURPOSE': {
        (async () => {
          try {
            // Try active first
            let data = await getPurpose(tabId!);

            // If no active purpose, try to claim a pending one using the tab's URL
            if (!data && sender.tab?.url) {
              let openerTabId: number | undefined;
              if (sender.tab.id) {
                try {
                  const t = await chrome.tabs.get(sender.tab.id);
                  openerTabId = t.openerTabId;
                } catch { /* ignore */ }
              }
              data = await consumePendingPurpose(tabId!, sender.tab.url, openerTabId);
              if (data) {
                await broadcastMessage({ type: 'REFRESH_STATE' });
              }
            }

            const activeChildren = await getActiveChildren(tabId!);
            sendResponse({ success: true, data, activeChildren });
          } catch (err) {
            sendResponse({ success: false, error: String(err) });
          }
        })();
        return true;
      }

      // ── MARK_COMPLETE ──────────────────────────────────────────────────────
      case 'MARK_COMPLETE': {
        const shouldCloseChildren = message.payload?.closeChildren ?? false;
        updatePurposeStatus(tabId!, 'completed')
          .then(async () => {
            // Recursively close entire descendant tree if requested
            if (shouldCloseChildren) {
              const descendants = await getAllDescendants(tabId!);
              for (const desc of descendants) {
                await updatePurposeStatus(desc.tabId, 'completed').catch(() => {});
                await chrome.tabs.remove(desc.tabId).catch(() => {});
              }
            }
            try {
              await chrome.tabs.remove(tabId!);
            } catch { /* ignore if already closed */ }
          })
          .then(() => broadcastMessage({ type: 'REFRESH_STATE' }))
          .then(() => sendResponse({ success: true }))
          .catch((err) => sendResponse({ success: false, error: String(err) }));
        return true;
      }

      // ── EXTEND_TIMER ───────────────────────────────────────────────────────
      // ── DETACH_PARENT ─────────────────────────────────────────────────
      case 'DETACH_PARENT': {
        detachFromParent(tabId!)
          .then(() => broadcastMessage({ type: 'REFRESH_STATE' }))
          .then(() => sendResponse({ success: true }))
          .catch((err) => sendResponse({ success: false, error: String(err) }));
        return true;
      }

      // ── UPDATE_PURPOSE (rename task) ────────────────────────────────────────
      case 'UPDATE_PURPOSE': {
        const newText = message.payload?.purpose?.trim();
        if (!newText) { sendResponse({ success: false, error: 'Empty purpose' }); return false; }
        updatePurposeText(tabId!, newText)
          .then(() => broadcastMessage({ type: 'REFRESH_STATE' }))
          .then(() => sendResponse({ success: true }))
          .catch((err) => sendResponse({ success: false, error: String(err) }));
        return true;
      }

      case 'EXTEND_TIMER': {
        const extra = message.payload?.extraMinutes ?? 5;
        extendPurpose(tabId!, extra)
          .then(() => getPurpose(tabId!))
          .then((data) => sendResponse({ success: true, data }))
          .catch((err) => sendResponse({ success: false, error: String(err) }));
        return true;
      }

      // ── TOGGLE_PAUSE ───────────────────────────────────────────────────────
      case 'TOGGLE_PAUSE': {
        getPurpose(tabId!)
          .then(async (purpose) => {
            if (!purpose) return null;
            if (purpose.lastActivatedAt === null) {
              await resumePurpose(tabId!);
            } else {
              await pausePurpose(tabId!);
            }
            return getPurpose(tabId!);
          })
          .then((data) => sendResponse({ success: true, data }))
          .catch((err) => sendResponse({ success: false, error: String(err) }));
        return true;
      }

      // ── OPEN_TAB_WITH_PURPOSE ──────────────────────────────────────────────
      // Called from the link interceptor modal when user confirms opening a link.
      // Stores a pending purpose, then creates the tab.
      case 'OPEN_TAB_WITH_PURPOSE': {
        const { url, purpose, durationMinutes } = message.payload ?? {};
        if (!url || !durationMinutes) {
          sendResponse({ success: false, error: 'Missing payload fields' });
          return false;
        }

        // Purpose is optional — fall back to a generic label
        const resolvedPurpose = (purpose ?? '').trim() || 'Quick browse';

        storePendingPurpose({
          url,
          purpose: resolvedPurpose,
          durationMinutes,
          createdAt: Date.now(),
        })
          .then(() =>
            chrome.tabs.create({ url, openerTabId: tabId! })
          )
          .then(() => sendResponse({ success: true }))
          .catch((err) => sendResponse({ success: false, error: String(err) }));
        return true;
      }

      // ── BROADCAST_REFRESH ──────────────────────────────────────────────────
      case 'BROADCAST_REFRESH': {
        broadcastMessage({ type: 'REFRESH_STATE' })
          .then(() => sendResponse({ success: true }))
          .catch((err) => sendResponse({ success: false, error: String(err) }));
        return true;
      }

      // ── ACTIVATE_TAB ───────────────────────────────────────────────────────
      case 'ACTIVATE_TAB': {
        const targetTabId = message.payload?.targetTabId;
        if (!targetTabId) {
          sendResponse({ success: false, error: 'No target tab ID provided' });
          return false;
        }
        chrome.tabs.update(targetTabId, { active: true })
          .then(() => {
            // Also focus the window containing the tab
            chrome.tabs.get(targetTabId).then((tab) => {
              if (tab.windowId) {
                chrome.windows.update(tab.windowId, { focused: true });
              }
            }).catch(() => {});
            sendResponse({ success: true });
          })
          .catch((err) => sendResponse({ success: false, error: String(err) }));
        return true;
      }

      // ── GET_EXCLUDED_DOMAINS ───────────────────────────────────────────────
      case 'GET_EXCLUDED_DOMAINS': {
        getExcludedDomains()
          .then((domains) => sendResponse({ success: true, excludedDomains: domains }))
          .catch((err) => sendResponse({ success: false, error: String(err) }));
        return true;
      }

      // ── SET_EXCLUDED_DOMAINS ───────────────────────────────────────────────
      case 'SET_EXCLUDED_DOMAINS': {
        const domains = (message.payload as any)?.domains as import('../types').ExcludedDomain[] | undefined;
        if (!Array.isArray(domains)) {
          sendResponse({ success: false, error: 'domains must be an array' });
          return false;
        }
        setExcludedDomains(domains)
          .then(() => sendResponse({ success: true }))
          .catch((err) => sendResponse({ success: false, error: String(err) }));
        return true;
      }

      // ── GET_SHORTCUTS ──────────────────────────────────────────────────────
      case 'GET_SHORTCUTS': {
        getShortcuts()
          .then((shortcuts) => sendResponse({ success: true, shortcuts }))
          .catch((err) => sendResponse({ success: false, error: String(err) }));
        return true;
      }

      // ── SET_SHORTCUTS ──────────────────────────────────────────────────────
      case 'SET_SHORTCUTS': {
        const shortcuts = (message.payload as any)?.shortcuts as import('../types').Shortcut[] | undefined;
        if (!Array.isArray(shortcuts)) {
          sendResponse({ success: false, error: 'shortcuts must be an array' });
          return false;
        }
        setShortcuts(shortcuts)
          .then(() => sendResponse({ success: true }))
          .catch((err) => sendResponse({ success: false, error: String(err) }));
        return true;
      }

      // ── LOG_DRIFT_EVENT ────────────────────────────────────────────────────
      case 'LOG_DRIFT_EVENT': {
        const payload = (message.payload as any);
        logDriftEvent({
          date: toDateString(Date.now()),
          timestamp: Date.now(),
          domain: payload?.domain ?? '',
          purposeText: payload?.purposeText ?? '',
          userAction: payload?.userAction ?? 'continue',
        })
          .then(() => sendResponse({ success: true }))
          .catch((err) => sendResponse({ success: false, error: String(err) }));
        return true;
      }

      // ── GET_DAILY_STATS ───────────────────────────────────────────────────
      case 'GET_DAILY_STATS': {
        const date = (message.payload as any)?.date ?? toDateString(Date.now());
        getDailyStats(date)
          .then((stats) => sendResponse({ success: true, data: stats as any }))
          .catch((err) => sendResponse({ success: false, error: String(err) }));
        return true;
      }

      // ── GET_WEEKLY_STATS ──────────────────────────────────────────────────
      case 'GET_WEEKLY_STATS': {
        getWeeklyStats()
          .then((days) => sendResponse({ success: true, data: days as any }))
          .catch((err) => sendResponse({ success: false, error: String(err) }));
        return true;
      }

      // ── GET_HISTORY ───────────────────────────────────────────────────────
      case 'GET_HISTORY': {
        const limit = (message.payload as any)?.limit ?? 200;
        getAllHistory(limit)
          .then((history) => sendResponse({ success: true, data: history as any }))
          .catch((err) => sendResponse({ success: false, error: String(err) }));
        return true;
      }

      // ── GET_DRIFT_HOTSPOTS ────────────────────────────────────────────────
      case 'GET_DRIFT_HOTSPOTS': {
        getDriftHotspots(7)
          .then((hotspots) => sendResponse({ success: true, data: hotspots as any }))
          .catch((err) => sendResponse({ success: false, error: String(err) }));
        return true;
      }

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
        return false;
    }
  }
);
