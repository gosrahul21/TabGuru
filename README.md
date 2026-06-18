<div align="center">

# 🧙 TabGuru

### *Every tab must have a purpose.*

**A purpose-first browser extension that makes you pause, declare your intent, and browse with awareness.**

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Vite](https://img.shields.io/badge/Vite-Build-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)

</div>

---

## 💡 The Problem

You open a tab.  
Then another. And another.  
Twenty minutes later you've forgotten why you started.

Most "tab managers" solve this by limiting tabs or organizing them into trees.  
**TabGuru solves it at the root: intention.**

> *The app is for those who need a pause — to see, to be aware, to know what they are doing.*

---

## ✨ How it Works

Every tab must have a purpose. Before you browse, you declare why.

```
Press Ctrl+T  (or right-click → Open in new tab)
        │
        ▼
  🧙 TabGuru asks:
  ┌───────────────────────────────────────┐
  │  Why are you opening this tab?        │
  │  [ Research Spring Security...     ]  │
  │                                       │
  │  Estimated time:                      │
  │  ( 5m )  ( 15m )✓  ( 30m )  ( 60m ) │
  │                                       │
  │          [ Continue → ]               │
  └───────────────────────────────────────┘
        │
        ▼
  A floating banner appears on every page:
  🧙 Purpose: Research Spring Security  ⏱ 14:23
```

Instead of:
> Open tab → Get distracted → Forget why you came

You get:
> Open tab → Declare purpose → Stay intentional

---

## 👥 Who is it for?

**🔬 Researchers & Students**  
Track every tab opened during a research session. Set a time budget per topic. See your karma — a log of where your attention actually went.

**🚀 Founders & Creators**  
You flow from marketing to building to content creation and get lost. It's normal. Now you don't have to. TabGuru has your back.

**💼 Professionals**  
Stay organized across multiple work streams. Every tab is a commitment, not an accident.

---

## 🔑 Key Features (Phase 1)

| Feature | Description |
|---|---|
| **Purpose Gate** | Every new tab requires a declared intent before browsing — no skipping |
| **Link Interception** | Ctrl+Click, Middle-click, `target=_blank`, and right-click "Open in new tab" all trigger the purpose flow |
| **Timer Per Tab** | Each tab gets a time budget (5 / 15 / 30 / 60 min) — timer only counts when the tab is focused |
| **Pause on Switch** | Switch to another tab? Timer pauses. Only active time counts |
| **Floating Banner** | Minimal glassmorphic overlay shows your purpose and countdown on every page |
| **Mark Complete** | Click ✅ when done — tab closes with a "Goal achieved!" confirmation |
| **Extend Timer** | Need more time? +5m / +10m buttons right on the banner |
| **History Suggestions** | After 3+ sessions, your past purposes appear as one-click suggestions |

---

## 🗺️ Roadmap

| Phase | Feature | Status |
|---|---|---|
| **Phase 1** | [Purpose-First Browsing](docs/phase1_purpose_first.md) | ✅ Built |
| **Phase 2** | [Parent-Child Tab Tree](docs/phase2_parent_child.md) | 🔜 Next |
| **Phase 3** | [Smart Tab Limits](docs/phase3_tab_limits.md) | 📋 Planned |
| **Phase 4** | [Timeboxing & Drift Detection](docs/phase4_timeboxing_drift.md) | 📋 Planned |
| **Phase 5** | [Analytics & Daily Reflection](docs/phase5_analytics.md) | 📋 Planned |

---

## 🛠️ Tech Stack

- **Framework:** React 19 + TypeScript
- **Build:** Vite + `@crxjs/vite-plugin` (Manifest V3)
- **Styling:** Tailwind CSS v3 with custom glassmorphism design system
- **Extension APIs:** `chrome.tabs`, `chrome.storage.local`, `chrome.windows`, Content Scripts, Service Worker
- **UI Isolation:** Shadow DOM for the floating banner (no style leaks into host pages)

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Google Chrome (or any Chromium browser)

### Install & Build

```bash
git clone https://github.com/your-username/TabGuru.git
cd TabGuru
npm install
npm run build
```

### Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **"Load unpacked"**
4. Select the `dist/` folder

Open a new tab — TabGuru will greet you. 🧙

### Development

```bash
npm run dev   # Starts Vite dev server with HMR
```

---

## 🎨 Design Principles

- **Glassmorphism** — `backdrop-filter: blur`, translucent dark panels
- **Dark-first** — Background `#0a0a12`, Accent gradient `indigo-500 → violet-500 → purple-600`
- **Typography** — `Outfit` (headings) + `Inter` (body)
- **Micro-animations** — Slide-in banner, floating orbs, urgency pulse on expiring timers
- **Non-blocking** — The banner never prevents you from using the page. You can minimize it to a 🧙 icon.

---

## 📁 Project Structure

```
src/
├── types/          — Shared TypeScript interfaces
├── storage/        — chrome.storage.local CRUD helpers (pause/resume aware)
├── background/     — Service worker (tab lifecycle, timer pause, link interception)
├── newtab/         — New Tab override page (React + Tailwind)
│   └── components/ — PurposeInput, DurationChips, SuggestionChips, SearchInput
└── content/        — Content scripts (Banner, LinkModal, linkInterceptor)
docs/               — Phase-by-phase design & feature documentation
```

---

## 🧘 Philosophy

> *The purpose of this app is not to restrict what you do by limiting tabs,  
> but to let you observe your intention.*  
> 
> **Awareness is everything. Be in charge of your awareness.**  
> This awareness will transform you.

---

<div align="center">

Made with intention. 🧙

</div>