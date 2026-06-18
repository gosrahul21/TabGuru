# 🧙 TabGuru Documentation: Phase 1
## 🎯 Purpose-First Browsing (The Core Gem)

Phase 1 establishes the fundamental identity of TabGuru. Before any web page is loaded in a new tab, the user must declare their intent and set a time commitment.

> **Design Decisions (Finalized)**
> - 🚫 **No skipping** — declaring a purpose is mandatory. There is no escape/skip button.
> - 🔍 **Search engine** — dynamically detects and uses the browser's default search engine.
> - 📌 **Banner position** — top-right corner, compact and non-intrusive.
> - 📂 **Banner injection** — injected on all websites without exclusions.
> - 💡 **Suggestions on first install** — empty. Suggestions are populated only from the user's own history.
> - ✅ **Mark Complete** — closes the tab with a brief 'Goal achieved!' toast micro-animation. Conclusion notes are a Phase 5 feature.

---

## 🏗️ Architecture & Mechanics

### 1. New Tab Interception
* We override Chrome's default new tab page using the Manifest V3 override:
  ```json
  "chrome_url_overrides": {
    "newtab": "src/newtab/newtab.html"
  }
  ```
* When a user opens a new tab (`Ctrl + T`), they are greeted by the **TabGuru Interceptor Screen**.
* The screen displays:
  * A central prompt: *"Why are you opening this tab?"*
  * Quick-select suggestions based on frequent historical inputs (e.g., "Research Spring Boot", "Watch Tutorial", "Buy Flight Tickets").
  * A text input for a custom purpose.
  * A time commitment selector: `5 min`, `15 min`, `30 min`, or `Custom`.
  * A search/navigation input: This allows the user to immediately enter their search query or URL, avoiding a secondary redirect page.
* **Skipping is not allowed.** The user must declare a purpose before the tab proceeds. There is no "Skip" or "Escape" option.
* Once the user clicks **Continue** or presses **Enter**:
  * The purpose and duration are saved to `chrome.storage.local`.
  * If the destination input is a valid URL, navigate directly to it.
  * If it's a plain text query, dispatch it to **the browser's default search engine** (detected dynamically by reading `chrome.search.getDefaultSearchEngine()` or constructing a query URL using the browser's default settings).
  * The browser tab navigates to the destination.

### 2. State & Storage Architecture
We use `chrome.storage.local` to manage active tab purposes. The state needs to be synced and accessible by the background service worker, the popup, and content scripts.

#### Storage Schema:
```typescript
interface TabPurpose {
  tabId: number;
  purpose: string;
  durationMinutes: number;
  startTime: number;      // Epoch timestamp
  endTime: number;        // Epoch timestamp (startTime + duration)
  status: 'active' | 'completed' | 'abandoned';
  destinationUrl?: string; // Target URL user wanted to visit
}
```

Key storage key structure:
* `active_purposes`: Map of `tabId` to `TabPurpose`
* `recent_purposes`: List of strings (max 10) representing common custom goals for suggestions.

### 3. Purpose Banner Injection
Once the tab navigates to the target page, a content script injects a floating, glassmorphic banner.

* **Injection Strategy:** Inject a shadow DOM container into `document.documentElement` to prevent host website CSS from leaking into or breaking the banner layout. Injected on **all websites** without domain exclusions.
* **Banner Position:** Fixed **top-right corner** (`position: fixed; top: 16px; right: 16px`).
* **Banner Features:**
  * 🧙 **Purpose label**: Shows the user's declared goal.
  * ⏱️ **Timer widget**: Shows minutes/seconds remaining, updating in real-time.
  * ✅ **Mark Complete Button**: When clicked:
    1. Plays a brief "Goal achieved! 🎉" toast animation directly in the banner.
    2. Marks the purpose as `completed` in `chrome.storage.local`.
    3. Closes the tab after a short delay (~1.5s) to let the toast be seen.
    > **Note:** A detailed conclusion/journal flow is deferred to Phase 5 Analytics.
  * ➕ **Adjust/Extend Button**: Allows adding 5 or 10 minutes to the timer if the goal takes longer.
  * ➖ **Minimize Button**: Collapses the banner into a small wizard hat icon (`🧙`) in the top-right corner, expanding back on hover.

---

## 🎨 UI/UX Specifications

### The New Tab Interceptor Design
* **Layout:** Centered card with glassmorphism, vertical gradient background (`linear-gradient(135deg, #0f172a, #1e1b4b)`).
* **Typography:**
  * Header: `Outfit`, size `2.2rem`, weight `700`, with a text gradient (`#6366f1` to `#a855f7`).
* **Input Box:** Large, borderless search-like input field with a glowing indigo border on focus.
* **Duration Chips:** Interactive pill buttons that scale up slightly on hover and light up with an indigo glow when selected.
* **No Skip/Cancel Button:** The UI deliberately omits any dismiss mechanism. The modal is the only way in. The message is intentional: *every tab needs a purpose.*
* **Suggestions Behavior:** The suggestions row is **hidden on first install**. Once the user has completed at least 3 purposes, the most frequent 3 recent custom inputs are surfaced as quick-select chips.

```
+--------------------------------------------------------+
|                                                        |
|                    🧙 TabGuru                          |
|             Browse with intention.                     |
|                                                        |
|            Why are you opening this tab?               |
|            [ Research Spring Boot Security         ]   |
|                                                        |
|            Suggestions:                                |
|            [Buy Tickets] [Watch Tutorial] [Read Docs]  |
|                                                        |
|            Estimated Time:                             |
|            ( 5m )  ( 15m )*  ( 30m )  [ Custom... ]    |
|                                                        |
|            Where are you going?                        |
|            [ google.com or search query...        ]    |
|                                                        |
|                     [ Continue ]                       |
|                                                        |
+--------------------------------------------------------+
```

### The Injected Floating Banner
* **Position:** Fixed top-center or top-right, floating, absolute z-index (2147483647).
* **Style:**
  * `backdrop-filter: blur(12px)`
  * `background: rgba(15, 23, 42, 0.75)`
  * `border: 1px solid rgba(255, 255, 255, 0.1)`
  * `box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5)`
* **Micro-Animations:**
  * Slide down on load.
  * Pulsing orange timer when it has less than 2 minutes remaining.
  * Particle explosion (confetti) using canvas when checking off the task.

---

## 📋 Implementation Checklist

1. [x] **Setup Manifest V3**: `tabs`, `storage`, `windows`, `host_permissions: <all_urls>`.
2. [x] **New Tab Override**: `src/newtab/index.html` + React page.
3. [x] **Service Worker (Background)**:
    * Tab cleanup on close.
    * Pause/Resume on `tabs.onActivated` and `windows.onFocusChanged`.
    * `OPEN_TAB_WITH_PURPOSE` message handler.
4. [x] **Content Script — Purpose Banner**: Shadow DOM, live countdown, extend, complete.
5. [x] **Content Script — Link Interceptor**: Intercepts new-tab link clicks with purpose modal.
6. [x] **Storage Syncer**: `pause/resume/extend/save/remove` helpers with `accumulatedMs` model.

---

## 🔗 Feature: Link Click Interception

> **"When a user clicks a link that would open a new tab, TabGuru intercepts it, asks for the purpose of visiting that page, then opens the tab."**

### Trigger Conditions (intercepted link clicks)
A click is intercepted if the resulting navigation would open a **new tab**:
- Link has `target="_blank"`
- User holds **Ctrl** (Windows/Linux) or **⌘ Cmd** (macOS) while clicking
- User **middle-clicks** a link

### Flow Diagram
```
User on Tab 1
     │
     ▼
Clicks link (target=_blank / Ctrl+Click / Middle-Click)
     │
     ▼  [content script intercepts — default prevented]
     │
     ▼
Purpose Modal slides in on Tab 1:
┌────────────────────────────────────────┐
│  🧙 You're opening a new tab           │
│  Destination: docs.spring.io/security  │
│                                        │
│  Why are you visiting this?            │
│  [ Research Spring Security...      ]  │
│                                        │
│  Estimated time:                       │
│  ( 5m )  ( 15m )*  ( 30m )            │
│                                        │
│  [ Open Tab ]       [ Cancel ]         │
└────────────────────────────────────────┘
     │
     ▼  [user clicks Open Tab]
     │
Background stores pending purpose →
chrome.tabs.create({ url: destination })
     │
     ▼
New tab opens → Content script banner appears immediately
```

### Implementation Architecture

#### 1. Content Script: `src/content/linkInterceptor.ts`
- Attaches a single `click` listener to `document` (event delegation, not per-link).
- Detects interceptable clicks by inspecting `event.ctrlKey`, `event.metaKey`, `event.button === 1`, or `anchor.target === '_blank'`.
- Calls `event.preventDefault()` + `event.stopPropagation()` to block the default navigation.
- Mounts a `<LinkModal>` React component into the existing Shadow DOM host for the session.

#### 2. React Component: `src/content/LinkModal.tsx`
- A slide-up overlay modal rendered inside the existing Shadow DOM.
- Displays the destination hostname (e.g. `docs.spring.io`) as context.
- Contains a purpose input and duration chips (same components as the New Tab page).
- On **"Open Tab"**: sends `OPEN_TAB_WITH_PURPOSE` message to background with `{ url, purpose, durationMinutes }`.
- On **"Cancel"**: dismisses itself, no tab is opened.

#### 3. Background: `OPEN_TAB_WITH_PURPOSE` handler
```typescript
// In service-worker.ts
case 'OPEN_TAB_WITH_PURPOSE': {
  const { url, purpose, durationMinutes } = message.payload;
  // Store as a "pending" purpose keyed by URL (consumed once by the content script)
  await storePendingPurpose({ url, purpose, durationMinutes });
  // Create the tab — the content script will pick up the pending purpose on init
  chrome.tabs.create({ url, openerTabId: tabId });
  sendResponse({ success: true });
  return true;
}
```

#### 4. Storage: `pending_purposes` bucket
```typescript
interface PendingPurpose {
  url: string;          // exact URL the user is navigating to
  purpose: string;
  durationMinutes: number;
  createdAt: number;    // TTL: discard if older than 30s (stale navigations)
}
```
When the new tab's content script calls `GET_PURPOSE`, the background:
1. Checks `pending_purposes` for an entry whose URL matches the tab's current URL.
2. If found, converts it to a full `TabPurpose` (with `accumulatedMs: 0`, `lastActivatedAt: now`) and saves it.
3. Returns it to the content script to show the banner.

---

## ⏸ Feature: Tab Timer Pause on Switch

> **"When a user switches from Tab 1 to Tab 2, the timer on Tab 1 pauses. Only the currently focused tab's timer counts down."**

- **Implemented via:** `accumulatedMs` + `lastActivatedAt` fields on `TabPurpose`.
- **Events monitored:** `chrome.tabs.onActivated` (tab switches within same window), `chrome.windows.onFocusChanged` (switching to/from other apps).
- **Banner shows:** ⏸ icon + dimmed "Paused" text when `lastActivatedAt === null`.
- **Time remaining** = `durationMinutes × 60,000 − accumulatedMs − liveElapsedSinceLastActivated`


When moving from tab 1 to tab 2, we pause the timer of parent tab

when we refer to tab 2 from tab 1, like clicking on link, we shall ask the purpose of visiting, then allow opening that page