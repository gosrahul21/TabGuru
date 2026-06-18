# 🎯 TabGuru Documentation: Phase 3
## 🎯 Smart Tab Limits

To prevent cognitive overload and maintain browser performance, TabGuru enforces a strict but customizable tab budget (default: **8 tabs**). When the user attempts to exceed this limit, TabGuru automatically manages the tab space according to the user's selected strategy.

---

## 🏗️ Architecture & Mechanics

### 1. Tab Limit Monitor
* **Service Worker Activity:**
  * Tracks the active tab count in real-time.
  * Listens to `chrome.tabs.onCreated`.
  * Before a new tab is fully registered, checks the total tab count.
  * If `currentTabCount > maxTabLimit` (e.g., 9 tabs open when limit is 8):
    * Trigger the **Auto-Close Candidate Selector**.

### 2. Tab Metadata & Protection
To make smart decisions, we must track which tabs are candidates for closure and which are protected.
* **Protected Tabs:**
  * A tab is protected if:
    * It is pinned via standard Chrome controls.
    * It has been explicitly "starred" or "protected" via the TabGuru Floating Banner or Sidebar.
    * It is the currently active tab.
* **Usage Metrics:**
  * We track the last time a tab was focused: `lastActivatedTime`.
  * We track total time spent on the tab: `totalActiveDuration`.

### 3. Closing Strategies
When a limit is hit, TabGuru selects a non-protected candidate using one of four strategies:

| Strategy | Description | Selection Logic |
| :--- | :--- | :--- |
| **Close Oldest** | Closes the tab that has been open the longest. | Min `createdAt` timestamp |
| **Close Newest** | Closes the tab opened most recently (excluding active). | Max `createdAt` timestamp |
| **Close Least Recently Used (LRU)** | Closes the tab that was least recently visited. | Min `lastActivatedTime` timestamp |
| **Close Least Interacted** | Closes the tab with the least amount of active focus time. | Min `totalActiveDuration` |

### 4. Recycler Bin (Undo Support)
To prevent frustration and preserve data, auto-closed tabs are not permanently gone.
* Closed tabs are pushed to a `recycled_tabs` stack in `chrome.storage.local` (stores URL, title, purpose, and parent state).
* A toast is immediately shown on the active tab:
  `🧙 Guru closed 'H2 Database Config' to keep your workspace clear. [Undo]`
* Clicking **Undo** restores the tab in its exact position in the tree structure.

---

## 🎨 UI/UX Specifications

### Strategy Configuration Dashboard
Located inside the extension popup and sidebar settings panel.
* **Theme:** Glossy dark card interface.
* **Interactive Budget Slider:** A slider to adjust the max limit (e.g., 5 to 20 tabs) with real-time numeric indicator and visual "stress colors" (Green for <= 8, Yellow for 9-12, Red for >12).
* **Strategy Selection Cards:** Segmented control tabs with glowing borders.

```
+--------------------------------------------------+
| ⚙️ Smart Tab Budget                              |
+--------------------------------------------------+
| Max Tabs: [=======o==================] ( 8 Tabs ) |
|                                                  |
| Strategy:                                        |
| [o] Least Recently Used (LRU) - *Recommended*   |
| [ ] Oldest Tab                                   |
| [ ] Newest Tab                                   |
|                                                  |
| Protected Domains:                               |
| [ + Add ] github.com, stackoverflow.com           |
+--------------------------------------------------+
```

### Floating Banner Protection Toggle
* A glowing star icon (`⭐`) added to the floating purpose banner.
* Toggling it on turns the banner's outline golden:
  * Golden outline indicate the tab is protected and immune to auto-closing.

---

## 📋 Implementation Checklist

1. [ ] **Configuration Storage**:
    * Store settings: `maxTabs` (integer), `autoCloseStrategy` (string), `protectedDomains` (array of strings).
2. [ ] **Metrics Tracker**:
    * Implement event listener `chrome.tabs.onActivated` to update `lastActivatedTime` for each tab.
    * Record tab creation times `createdAt`.
3. [ ] **Eviction Engine**:
    * Create eviction function in `background.js` that triggers on `chrome.tabs.onCreated`.
    * Filter out protected tabs, pins, and the active tab.
    * Sort and evict the top candidate based on the configured strategy.
4. [ ] **Restore & Toast UI**:
    * Implement the Toast overlay in the content script that reads from `recycled_tabs`.
    * Trigger `chrome.tabs.create` with the restored tab properties if the user clicks "Undo".
5. [ ] **Starring Feature**:
    * Connect the star icon in the floating banner and sidebar to toggle protection flags in the state storage.
