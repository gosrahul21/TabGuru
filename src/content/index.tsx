/**
 * Content script entry point.
 *
 * Two responsibilities:
 * 1. Purpose Banner — mounts into a Shadow DOM if this tab has an active purpose.
 * 2. Link Interceptor — globally intercepts new-tab link clicks to ask for purpose first.
 */
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import Banner from './Banner';
import LinkModal from './LinkModal';
import { initLinkInterceptor } from './linkInterceptor';
import type { ExtensionMessage, ExtensionResponse, TabPurpose } from '../types';
import bannerStyles from './banner.css?inline';
import ChildAwarenessBanner from './ChildAwarenessBanner';

// ─── Shadow DOM host ──────────────────────────────────────────────────────────

let shadowRoot: ShadowRoot | null = null;
let reactRoot: ReturnType<typeof ReactDOM.createRoot> | null = null;

function getOrCreateShadowHost(): ShadowRoot {
  if (shadowRoot) return shadowRoot;

  const host = document.createElement('div');
  host.id = 'tabguru-banner-host';
  Object.assign(host.style, {
    position: 'fixed',
    top: '0',
    right: '0',
    zIndex: '2147483647',
    pointerEvents: 'none', // host itself is transparent; children handle their own events
  });
  document.documentElement.appendChild(host);

  shadowRoot = host.attachShadow({ mode: 'open' });

  // Inject scoped Tailwind styles
  const styleEl = document.createElement('style');
  styleEl.textContent = bannerStyles;
  shadowRoot.appendChild(styleEl);

  // Slide-up animation for LinkModal
  const extraStyle = document.createElement('style');
  extraStyle.textContent = `
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(24px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  shadowRoot.appendChild(extraStyle);

  const mountEl = document.createElement('div');
  mountEl.style.pointerEvents = 'auto';
  shadowRoot.appendChild(mountEl);

  reactRoot = ReactDOM.createRoot(mountEl);

  return shadowRoot;
}

// ─── App Shell rendered into Shadow DOM ──────────────────────────────────────
// Keeps both Banner and LinkModal in the same React root so they can share state.

interface AppShellProps {
  initialPurpose: TabPurpose | null;
  initialChildren: TabPurpose[];
  tabId: number;
}

function AppShell({ initialPurpose, initialChildren, tabId }: AppShellProps) {
  const [purpose, setPurpose] = useState<TabPurpose | null>(initialPurpose);
  const [activeChildren, setActiveChildren] = useState<TabPurpose[]>(initialChildren);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  const fetchState = React.useCallback(async () => {
    try {
      const response: ExtensionResponse = await chrome.runtime.sendMessage({
        type: 'GET_PURPOSE',
        tabId,
      });
      if (response.success) {
        const activePurp =
          response.data && response.data.status === 'active'
            ? response.data
            : null;
        setPurpose(activePurp);
        setActiveChildren(response.activeChildren ?? []);
      }
    } catch {
      // Ignore context invalidated
    }
  }, [tabId]);

  React.useEffect(() => {
    // Listen for visibility change (user switching tabs back to this tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchState();
        setIsDismissed(false); // Reset dismissal on re-entry
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Listen for real-time broadcasts from background
    const handleMessage = (message: any) => {
      if (message.type === 'REFRESH_STATE') {
        fetchState();
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [fetchState]);

  // We show the most recent active child tab
  const activeChild = activeChildren.length > 0 ? activeChildren[activeChildren.length - 1] : null;

  return (
    <>
      {/* Purpose banner — only visible if this tab has an active purpose */}
      {purpose && (
        <div style={{ position: 'fixed', top: '16px', right: '16px' }}>
          <Banner purpose={purpose} tabId={tabId} />
        </div>
      )}

      {/* Child tab awareness banner */}
      {activeChild && !isDismissed && (
        <ChildAwarenessBanner
          child={activeChild}
          onDismiss={() => setIsDismissed(true)}
        />
      )}

      {/* Link interception modal — shows when user clicks a new-tab link */}
      {pendingUrl && (
        <LinkModal
          destinationUrl={pendingUrl}
          openerTabId={tabId}
          onClose={() => setPendingUrl(null)}
        />
      )}

      {/* Wire the link interceptor to this component's state (runs once) */}
      <LinkInterceptorSetup onLinkClick={setPendingUrl} />
    </>
  );
}

// Tiny helper component that sets up the interceptor on mount
function LinkInterceptorSetup({ onLinkClick }: { onLinkClick: (url: string) => void }) {
  React.useEffect(() => {
    const cleanup = initLinkInterceptor(onLinkClick);
    return cleanup;
  }, [onLinkClick]);
  return null;
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function init() {
  // Ask the background SW for the current tab's purpose
  const msg: ExtensionMessage = { type: 'GET_PURPOSE' };
  let response: ExtensionResponse;

  try {
    response = await chrome.runtime.sendMessage(msg);
  } catch {
    // Extension context not ready — still set up the link interceptor
    response = { success: false };
  }

  const purpose =
    response?.data && (response.data as TabPurpose).status === 'active'
      ? (response.data as TabPurpose)
      : null;

  const initialChildren = response?.activeChildren ?? [];

  // Get our tab ID
  const tabId =
    purpose?.tabId ??
    (await chrome.tabs
      .getCurrent()
      .then((t) => t?.id ?? 0)
      .catch(() => 0));

  // Create / reuse the Shadow DOM host and render
  getOrCreateShadowHost();
  reactRoot?.render(
    <React.StrictMode>
      <AppShell
        initialPurpose={purpose}
        initialChildren={initialChildren}
        tabId={tabId}
      />
    </React.StrictMode>
  );
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
