# 📊 TabGuru Documentation: Phase 5
## 📊 Analytics & Daily Reflection

Phase 5 turns raw behavioral data into actionable self-reflection. By logging completed purposes, time spent, and drift events, TabGuru generates daily summaries and weekly insights that show the user exactly where their digital attention is going.

---

## 🏗️ Architecture & Mechanics

### 1. IndexedDB Event Logging
To support historical data and complex analytical queries without bloating `chrome.storage.local` memory limits, we utilize **IndexedDB** in the service worker.

#### Database Schema: `TabGuruDB`
* **`purposes` Store:**
  * Key path: `id` (autoIncrement)
  * Index on: `date` (YYYY-MM-DD), `status`, `category`
  * Values:
    ```typescript
    interface HistoricalPurpose {
      id?: number;
      date: string;              // YYYY-MM-DD
      purpose: string;
      startTime: number;         // Timestamp
      endTime: number;           // Timestamp
      timeSpentMs: number;
      durationMinutesAllocated: number;
      status: 'completed' | 'abandoned';
      category: string;          // e.g. Programming, Shopping, Research
    }
    ```
* **`drift_events` Store:**
  * Key path: `id` (autoIncrement)
  * Index on: `date` (YYYY-MM-DD)
  * Values:
    ```typescript
    interface DriftRecord {
      id?: number;
      date: string;
      timestamp: number;
      domain: string;
      purposeText: string;
      userAction: 'go_back' | 'continue' | 'update_purpose';
    }
    ```

### 2. Category Classifier
When writing an event to the database, TabGuru assigns a basic category based on keywords in the purpose and domain:
* **Programming/Dev:** `github.com`, `stackoverflow.com`, keywords: *code, program, debug, deploy, api, git*
* **Learning/Research:** `wikipedia.org`, keywords: *learn, study, research, course, documentation*
* **Leisure/Entertainment:** `youtube.com`, `netflix.com`, keywords: *watch, video, music, movie*
* **Admin/Shopping:** `amazon.com`, `booking.com`, keywords: *buy, shop, ticket, hotel, order*

### 3. The Daily Reflection Flow
* At a user-configured time (e.g. 5:30 PM) or when the user initiates their first browse session the following morning, a **Daily Reflection Modal** appears.
* It blocks search input until they review their metrics for the day, prompting intentional review.
* Displays:
  * **Goal Completion Rate:** Circular progress ring.
  * **Drift Count:** Total warning triggers and how many times they went back.
  * **Focus Time:** Total duration spent in tabs with active, ongoing goals.
  * **Reflection Prompt:** A simple rating: *"How focused did you feel today? (1-5 ⭐)"* stored to track long-term wellness.

---

## 🎨 UI/UX Specifications

### Daily Reflection UI
* **Design:** Ambient dark theme with a glassmorphic card layout, subtle neon borders, and a congratulations confetti shower if completion rate is > 80%.
* **Font:** `Outfit` for large numbers, `Inter` for supporting statistics.

```
+-------------------------------------------------------+
|                                                       |
|                  🧙 Daily Reflection                  |
|                      Today                            |
|                                                       |
|           Purposes Completed      Drift Events        |
|                18 / 24                 4              |
|                 (75%)                                 |
|                                                       |
|           Deep Focus Time         Top Goal Category   |
|               3h 20m                 Programming      |
|                                                       |
|                                                       |
|            How focused did you feel today?            |
|             ⭐   ⭐   ⭐   ⭐   ⭐                  |
|                                                       |
|                     [ Done ]                          |
|                                                       |
+-------------------------------------------------------+
```

### Full-Page Productivity Dashboard
* Accessible via a "Full Dashboard" button in the Sidebar or Extension Popup.
* **Layout:** Dashboard layout with responsive CSS grid cards:
  * **Card 1: Weekly Progress Chart.** SVG bar chart tracking Focus Time and Drift counts per day.
  * **Card 2: Goal Completion Rate.** Gauge chart showing overall goals met.
  * **Card 3: Drift Hotspots.** A list of domains where drift occurred most frequently.
  * **Card 4: History Log.** Searchable table of past purposes with filter options.

---

## 📋 Implementation Checklist

1. [ ] **IndexedDB Setup**:
    * Create `src/db/indexedDb.js` to initialize the database and store logs.
    * Build helper methods for inserting and querying records.
2. [ ] **Daily Reflection Trigger**:
    * Track time of day in `background.js` and determine when to display the reflection screen.
    * Render the Reflection Screen on a custom page or overlay.
3. [ ] **Analytics Engine**:
    * Wire background script events (tab close, goal checked off, drift alert resolved) to write directly to the database.
4. [ ] **Category Classifier**:
    * Implement a basic classification script to tag new goals.
5. [ ] **Productivity Dashboard**:
    * Create `src/dashboard/dashboard.html` and corresponding JS/CSS.
    * Implement custom SVG/CSS bar and gauge charts for high-performance, dependency-free rendering.
