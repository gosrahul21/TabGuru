/**
 * Link interception system.
 *
 * Attaches a single click listener to the document (event delegation).
 * When a click would open a new tab, prevents default and shows the
 * LinkModal instead, so the user must declare a purpose first.
 */

type OpenLinkModalFn = (url: string) => void;

/**
 * Determines whether a mouse event on an anchor element would normally
 * open a new tab.
 */
function wouldOpenNewTab(
  event: MouseEvent,
  anchor: HTMLAnchorElement
): boolean {
  // Middle-click
  if (event.button === 1) return true;
  // Ctrl+Click (Windows/Linux) or Cmd+Click (macOS)
  if (event.ctrlKey || event.metaKey) return true;
  // target="_blank" with a left click
  if (event.button === 0 && anchor.target === '_blank') return true;
  return false;
}

/**
 * Walks up the DOM from the clicked element to find the nearest <a> tag.
 */
function findAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  let el = target as HTMLElement | null;
  while (el && el.tagName !== 'A') {
    el = el.parentElement;
  }
  return el?.tagName === 'A' ? (el as HTMLAnchorElement) : null;
}

// ─── Excluded domains cache (refreshed every 5 seconds) ───────────────────────

import type { ExcludedDomain } from '../types';

let _excludedDomainsCache: ExcludedDomain[] = [];
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 5_000;

async function getExcludedDomainsCache(): Promise<ExcludedDomain[]> {
  const now = Date.now();
  if (now - _cacheTimestamp < CACHE_TTL_MS) return _excludedDomainsCache;
  try {
    const res = await chrome.runtime.sendMessage({ type: 'GET_EXCLUDED_DOMAINS' });
    if (res?.success && Array.isArray(res.excludedDomains)) {
      _excludedDomainsCache = res.excludedDomains;
      _cacheTimestamp = now;
    }
  } catch { /* extension context not ready */ }
  return _excludedDomainsCache;
}

function matchesDomain(hostname: string, d: string): boolean {
  if (d.startsWith('*.')) {
    const base = d.slice(2);
    return hostname === base || hostname.endsWith(`.${base}`);
  }
  return hostname === d || hostname === `www.${d}` || `www.${hostname}` === d;
}

function isHostnameExcluded(hostname: string, domains: ExcludedDomain[]): boolean {
  return domains.some(({ domain: d }) => matchesDomain(hostname, d));
}

function getSavedIntention(hostname: string, domains: ExcludedDomain[]): string | null {
  const match = domains.find(({ domain: d }) => matchesDomain(hostname, d));
  return match?.intention?.trim() || null;
}

export function initLinkInterceptor(openModal: OpenLinkModalFn): () => void {
  const handleClick = async (event: MouseEvent) => {
    const anchor = findAnchor(event.target);
    if (!anchor) return;

    const href = anchor.href;

    // Only intercept http/https links (skip javascript:, mailto:, chrome:, etc.)
    if (!href || !/^https?:\/\//.test(href)) return;

    // Only intercept navigations that would open a new tab
    if (!wouldOpenNewTab(event, anchor)) return;

    // Check if destination is in excluded domains
    // If excluded: open tab silently with an auto-purpose (no modal) so it's still tracked as a subtask
    try {
      const hostname = new URL(href).hostname.replace(/^www\./, '');
      const excluded = await getExcludedDomainsCache();
      if (isHostnameExcluded(hostname, excluded)) {
        // Prevent the browser from opening the tab (we'll create it with a purpose record)
        event.preventDefault();
        event.stopPropagation();
        // Look up the saved intention for this domain (falls back to hostname auto-label)
        const savedIntention = getSavedIntention(hostname, excluded);
        // Fire-and-forget — silently create tracked tab
        chrome.runtime.sendMessage({
          type: 'OPEN_TAB_WITH_PURPOSE',
          payload: {
            url: href,
            purpose: savedIntention || `Browsing ${hostname}`,
            durationMinutes: 15,
          } as never,
        }).catch(() => {
          // Extension context gone — fall back to native open
          window.open(href, '_blank');
        });
        return;
      }
    } catch { /* malformed URL — proceed with interception */ }

    // Block the default browser navigation
    event.preventDefault();
    event.stopPropagation();

    // Show the purpose modal
    openModal(href);
  };

  // Use capture phase so we see the event before page scripts can stop it
  document.addEventListener('click', handleClick, { capture: true });
  document.addEventListener('auxclick', handleClick, { capture: true }); // middle-click

  // Return cleanup function
  return () => {
    document.removeEventListener('click', handleClick, { capture: true });
    document.removeEventListener('auxclick', handleClick, { capture: true });
  };
}
