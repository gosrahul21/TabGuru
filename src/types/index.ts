// ─── Core Tab Purpose Types ─────────────────────────────────────────────────

export type TabStatus = 'active' | 'completed' | 'abandoned';

export interface TabPurpose {
  tabId: number;
  purpose: string;
  durationMinutes: number;
  startTime: number;         // Epoch ms — when session was created
  endTime: number;           // Epoch ms — kept for legacy reference only
  status: TabStatus;
  destinationUrl?: string;

  // ── Pause / Resume tracking ─────────────────────────────────────────────
  // Timer only counts when the tab is the active (focused) tab.
  accumulatedMs: number;     // Total ms the tab has been ACTIVE so far
  lastActivatedAt: number | null; // Epoch ms when tab was last focused,
                                  // null = currently paused / backgrounded
  openerTabId?: number;      // Tab ID of the parent tab that opened this tab
}

// Map of tabId (as string key) → TabPurpose
export type ActivePurposes = Record<string, TabPurpose>;

// ─── Storage Keys ────────────────────────────────────────────────────────────

export const STORAGE_KEY_ACTIVE = 'active_purposes' as const;
export const STORAGE_KEY_RECENT = 'recent_purposes' as const;

// ─── Message Types (content ↔ background) ────────────────────────────────────

export type MessageType =
  | 'GET_PURPOSE'
  | 'MARK_COMPLETE'
  | 'EXTEND_TIMER'
  | 'TOGGLE_PAUSE'
  | 'PURPOSE_SAVED'
  | 'OPEN_TAB_WITH_PURPOSE'  // Link interception: open new tab with a pre-set purpose
  | 'BROADCAST_REFRESH'
  | 'ACTIVATE_TAB';

export interface ExtensionMessage {
  type: MessageType;
  tabId?: number;
  payload?: Partial<TabPurpose> & {
    extraMinutes?: number;
    url?: string;            // for OPEN_TAB_WITH_PURPOSE
    durationMinutes?: number;
    targetTabId?: number;    // for ACTIVATE_TAB
  };
}

// ─── Pending Purpose (stored briefly for link-opened tabs) ───────────────────
// When a user clicks a link and enters a purpose, this is stored temporarily.
// The new tab's content script picks it up on init (TTL: 30 seconds).
export interface PendingPurpose {
  url: string;
  purpose: string;
  durationMinutes: number;
  createdAt: number;
}

export interface ExtensionResponse {
  success: boolean;
  data?: TabPurpose | null;
  activeChildren?: TabPurpose[];
  error?: string;
}
