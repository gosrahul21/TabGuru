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
  purpose: TabPurpose | null;
  tabId: number;
}

function AppShell({ purpose, tabId }: AppShellProps) {
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  return (
    <>
      {/* Purpose banner — only visible if this tab has an active purpose */}
      {purpose && (
        <div style={{ position: 'fixed', top: '16px', right: '16px' }}>
          <Banner purpose={purpose} tabId={tabId} />
        </div>
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
      <AppShell purpose={purpose} tabId={tabId} />
    </React.StrictMode>
  );
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
