# 🌳 TabGuru Documentation: Phase 2
## 🌳 Parent-Child Tab Tree

Phase 2 focuses on maintaining browsing context. When users browse, they branch out from single topics into multiple sub-tasks. TabGuru keeps track of these relationships so that the user never loses the context of how they arrived at a specific page.

---

## 🏗️ Architecture & Mechanics

### 1. Parent-Child Tracking
The key to identifying relationships is the Chrome extension `openerTabId` property, which indicates which tab spawned the current tab.

* **Monitoring Engine (`background.js`):**
  * Listen to `chrome.tabs.onCreated`.
  * If `tab.openerTabId` is defined, record it as the parent of `tab.id`.
  * If a user manually creates a tab (e.g. `Ctrl + T`), it becomes a new **Root Node** unless they were on an active tab and explicitly marked the new tab as a "sub-task" of the current one.
* **Tab Updates:**
  * Listen to `chrome.tabs.onUpdated` to track title changes, favicon URLs, and destination URLs to keep the tree model up to date in storage.
* **Tab Closures:**
  * Listen to `chrome.tabs.onRemoved`.
  * When a parent tab is closed, we need to decide what to do with its children. We can support two modes:
    1. **Promote Children:** Re-parent the child nodes to the parent's parent (or root).
    2. **Cascading Close:** Offer to close the entire sub-tree of tabs (optional configuration).

### 2. State & Storage Schema
The state represents a tree of active tab IDs.

#### Storage Schema (`tab_tree`):
```typescript
interface TreeNode {
  tabId: number;
  parentTabId: number | null;
  children: number[];
  title: string;
  url: string;
  favIconUrl: string;
  purpose: string;
  createdAt: number;
}

interface TreeState {
  nodes: Record<number, TreeNode>;
  roots: number[]; // Array of tabIds that are roots
}
```

### 3. Tree Visualization Sidebar
Instead of complex overlays on the web pages, we leverage Chrome's official **Side Panel API** (`chrome.sidePanel`) to display the tree. This is cleaner and does not interfere with website styling.

* **Permissions required in `manifest.json`:**
  ```json
  "permissions": ["sidePanel"],
  "side_panel": {
    "default_path": "src/sidebar/sidebar.html"
  }
  ```
* The side panel can be opened by clicking the extension icon or via a keyboard shortcut.
* It displays a live-updating tree diagram of the user's active tabs.

---

## 🎨 UI/UX Specifications

### Sidebar Design & Layout
* **Theme:** Semi-transparent blur background over standard pages, or standard dark theme with a clean grid system.
* **Font:** `Outfit` for headers, `Inter` for node titles and details.
* **Nodes:**
  * Each node displays:
    * Favicon of the page.
    * Page Title (truncated).
    * Sub-text displaying the declared **Tab Purpose** (e.g. "🧙 *JWT Refresh Token*").
    * Indicator dot representing state (Pulsing violet = Active tab, Dim violet = background tab).
  * **Connector Lines:** Curved, glowing CSS borders showing parent-child pathways.
  * **Hover Actions:** Close tab (`✕`), toggle mute, pin tab, edit purpose.

```
+------------------------------------+
| 🧙 TabGuru Tree                 ✕  |
+------------------------------------+
|  [Root] Spring Boot Auth (15m)     |
|   │                                |
|   ├── [Child] JWT Refresh Token    |
|   │    ├── [Sub] OAuth2 Protocol   |
|   │    └── [Sub] GitHub Repo       |
|   │                                |
|   └── [Child] H2 Database Config   |
|                                    |
|  [Root] Buy Flight Tickets (5m)    |
|   └── [Child] SkyScanner           |
+------------------------------------+
```

### Micro-interactions & Interactivity
* **Navigation:** Clicking any node in the tree switches the active tab directly:
  ```javascript
  chrome.tabs.update(tabId, { active: true });
  ```
* **Dynamic Collapse:** Expand/Collapse toggle buttons (`▼` and `►`) next to parent nodes to clean up vertical space.
* **Drag-and-Drop:** Ability to drag a node to a different parent node to manually reorganize the tree, dynamically updating the storage state.

---

## 📋 Implementation Checklist

1. [ ] **Update Manifest**: Include `"sidePanel"` in permissions, configure `"side_panel"`.
2. [ ] **Tree State Handler**:
    * Create a state manager in `background.js` that tracks `openerTabId` on creation and removes nodes on closure.
    * Handle reconnection/re-syncing of state when Chrome restarts.
3. [ ] **Sidebar View**:
    * Create `src/sidebar/sidebar.html`, `sidebar.css`, and `sidebar.js`.
    * Build dynamic DOM tree generation from the storage state.
4. [ ] **Communication Protocol**:
    * Set up runtime messaging between `background.js` and `sidebar.js` (using `chrome.runtime.onMessage`) to push live updates to the tree structure when tabs are created, modified, or closed.
5. [ ] **Visual Polish**:
    * Add CSS connector lines.
    * Implement animations for tab insertion and deletion.
