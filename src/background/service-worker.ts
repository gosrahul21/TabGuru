import {
  getPurpose,
  removePurpose,
  updatePurposeStatus,
  extendPurpose,
  pausePurpose,
  resumePurpose,
  storePendingPurpose,
  consumePendingPurpose,
  hasPendingPurposeForUrl,
  getActiveChildren,
} from '../storage/storage';
import type { ExtensionMessage, ExtensionResponse } from '../types';

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

  // Redirect the new tab to our purpose page, preserving the original URL
  const purposePageWithRedirect = `${PURPOSE_PAGE}?redirect=${encodeURIComponent(url)}`;
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

  // Check if tab has an active purpose
  const purpose = await getPurpose(tabId);
  if (!purpose) {
    // Skip if there's a pending purpose (e.g. opened via link interception)
    const hasPending = await hasPendingPurposeForUrl(url);
    if (hasPending) return;

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

    if (!tabId) {
      sendResponse({ success: false, error: 'No tabId found' });
      return false;
    }

    switch (message.type) {
      // ── GET_PURPOSE ────────────────────────────────────────────────────────
      // First checks active purposes; if not found, checks pending_purposes
      // (for tabs that were opened via link interception).
      case 'GET_PURPOSE': {
        (async () => {
          try {
            // Try active first
            let data = await getPurpose(tabId);

            // If no active purpose, try to claim a pending one using the tab's URL
            if (!data && sender.tab?.url) {
              let openerTabId: number | undefined;
              if (sender.tab.id) {
                try {
                  const t = await chrome.tabs.get(sender.tab.id);
                  openerTabId = t.openerTabId;
                } catch { /* ignore */ }
              }
              data = await consumePendingPurpose(tabId, sender.tab.url, openerTabId);
              if (data) {
                await broadcastMessage({ type: 'REFRESH_STATE' });
              }
            }

            const activeChildren = await getActiveChildren(tabId);
            sendResponse({ success: true, data, activeChildren });
          } catch (err) {
            sendResponse({ success: false, error: String(err) });
          }
        })();
        return true;
      }

      // ── MARK_COMPLETE ──────────────────────────────────────────────────────
      case 'MARK_COMPLETE': {
        updatePurposeStatus(tabId, 'completed')
          .then(async () => {
            try {
              await chrome.tabs.remove(tabId);
            } catch { /* ignore if already closed */ }
          })
          .then(() => broadcastMessage({ type: 'REFRESH_STATE' }))
          .then(() => sendResponse({ success: true }))
          .catch((err) => sendResponse({ success: false, error: String(err) }));
        return true;
      }

      // ── EXTEND_TIMER ───────────────────────────────────────────────────────
      case 'EXTEND_TIMER': {
        const extra = message.payload?.extraMinutes ?? 5;
        extendPurpose(tabId, extra)
          .then(() => getPurpose(tabId))
          .then((data) => sendResponse({ success: true, data }))
          .catch((err) => sendResponse({ success: false, error: String(err) }));
        return true;
      }

      // ── OPEN_TAB_WITH_PURPOSE ──────────────────────────────────────────────
      // Called from the link interceptor modal when user confirms opening a link.
      // Stores a pending purpose, then creates the tab.
      case 'OPEN_TAB_WITH_PURPOSE': {
        const { url, purpose, durationMinutes } = message.payload ?? {};
        if (!url || !purpose || !durationMinutes) {
          sendResponse({ success: false, error: 'Missing payload fields' });
          return false;
        }

        storePendingPurpose({
          url,
          purpose,
          durationMinutes,
          createdAt: Date.now(),
        })
          .then(() =>
            chrome.tabs.create({ url, openerTabId: tabId })
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

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
        return false;
    }
  }
);
