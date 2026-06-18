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

export function initLinkInterceptor(openModal: OpenLinkModalFn): () => void {
  const handleClick = (event: MouseEvent) => {
    const anchor = findAnchor(event.target);
    if (!anchor) return;

    const href = anchor.href;

    // Only intercept http/https links (skip javascript:, mailto:, chrome:, etc.)
    if (!href || !/^https?:\/\//.test(href)) return;

    // Only intercept navigations that would open a new tab
    if (!wouldOpenNewTab(event, anchor)) return;

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
