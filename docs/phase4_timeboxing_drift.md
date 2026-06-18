# ⏰ TabGuru Documentation: Phase 4
## ⏰ Timeboxing & Drift Detection

Phase 4 introduces proactive, gentle coaching. TabGuru helps users combat distraction not by blocking websites, but by raising self-awareness. It tracks time commitments and flags behavior that deviates from the declared purpose.

---

## 🏗️ Architecture & Mechanics

### 1. Timeboxing (Timer Core)
* **Background Alarms (`chrome.alarms`):**
  * When a tab's purpose is declared, we schedule a background alarm:
    ```javascript
    chrome.alarms.create(`timer_tab_${tabId}`, { delayInMinutes: durationMinutes });
    ```
  * Alarms are persistent across browser restarts and run efficiently in Manifest V3.
* **Real-time Countdown Syncing:**
  * To display a live countdown in the floating banner, the content script polls the background service worker or calculates time remaining locally from the target `endTime` stored in `chrome.storage.local`.
* **Alarm Trigger Action:**
  * When the alarm fires, the background script sends a message to the content script of the matching tab.
  * The content script displays a glassmorphic **Time Commitment Modal** that overlays the page.
  * **Options presented:**
    * **Finish Goal (Close Tab):** Safely saves statistics and closes the tab.
    * **Extend (+5 / +15 Mins):** Resets the alarm for an additional duration.

### 2. Drift Detection Engine
The Drift Engine monitors the active tab's URL and page title to identify potential context switching.

* **Heuristics Classifier:**
  * We maintain a customizable dictionary of **Distraction Domains** (e.g., `youtube.com`, `reddit.com`, `twitter.com`, `instagram.com`, `facebook.com`).
  * When a user navigates to a new URL inside a tab, the background script checks if the domain is in the distraction list.
  * If it matches, we perform **Purpose Relevance Matching**:
    * Clean and tokenize the tab's original purpose (e.g. *"Research Spring Boot Security"* -> `["research", "spring", "boot", "security"]`).
    * Clean and tokenize the current page title/URL (e.g. *"Funny Cat Compilations - YouTube"* -> `["funny", "cat", "compilations", "youtube"]`).
    * Check for overlap or allowed keyword exceptions:
      * If the website is `youtube.com` and the purpose contains keywords like `youtube`, `tutorial`, `learn`, `watch`, or matches technical terms, we classify it as **Productive**.
      * Otherwise, if no overlaps are found, it is classified as a **Drift Event**.

* **Drift Alert Sequence:**
  * To prevent false positives (e.g., clicking a link that quickly redirects), a **30-second Grace Period** is initiated.
  * If the user remains on the distraction page after 30 seconds, the content script injects a gentle warning popup.
  * **Actions:**
    * **[Go Back]:** Navigates the tab back to the last productive URL.
    * **[Update Purpose]:** Opens a prompt allowing the user to change their purpose to match what they are doing (e.g., switching from work to a planned break).
    * **[Keep Browsing]:** Dismisses the dialog but increments the "Drift Event Count" for analytics.

---

## 🎨 UI/UX Specifications

### Time Commitment Modal UI
* **Design:** Centered modal, blurred backdrop overlay (`backdrop-filter: blur(8px)`). High contrast indigo accents.
* **Message:** *"You've spent 15 minutes here. Still working on your goal?"*

```
+---------------------------------------------+
|                                             |
|              🧙 Time's Up!                  |
|                                             |
|    Your target for this tab (15 min) was:   |
|         "Research Spring Boot Security"     |
|                                             |
|        Still working on this goal?          |
|                                             |
|     [ Finish Goal ]    [ +5 min ]  [ +15 min ]|
|                                             |
+---------------------------------------------+
```

### Drift Nudge Overlay
* **Design:** Floating dialog sliding in from the right. Warm orange border-glow (`rgba(249, 115, 22, 0.4)`).
* **Text:** *"You may have drifted from your goal of 'Read Java docs'. Keep going?"*

```
+-------------------------------------------------+
| 🧙 Guru Nudge                                   |
| You opened this tab to:                         |
| "Read Java documentation"                       |
|                                                 |
| You are currently browsing:                     |
| YouTube Shorts                                  |
|                                                 |
|   [ Yes, Go Back ]    [ No, Update Purpose ]    |
+-------------------------------------------------+
```

---

## 📋 Implementation Checklist

1. [ ] **Alarm Management**:
    * Implement alarm listeners in `background.js` and storage sync for remaining time tracking.
2. [ ] **Content Modal UI**:
    * Design the Time's Up Modal using Shadow DOM inside the content script.
    * Handle user responses ("Finish" vs. "Snooze") and update background alarms accordingly.
3. [ ] **Distraction List & Classifier**:
    * Create a customizable list of distraction-prone domains.
    * Implement the matching classifier using natural language matching (stemming, tokenizing, and exact keyword matches).
4. [ ] **Grace Period Timer**:
    * Implement a debounced tracking mechanism in background script to wait 30 seconds before pushing the drift nudge.
5. [ ] **Nudge Content Injection**:
    * Inject the Drift Nudge Overlay via the content script.
    * Hook up actions to trigger history back-navigation or purpose editing.
