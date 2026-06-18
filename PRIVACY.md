# Privacy Policy for TabGuru

**Effective Date:** June 18, 2026

TabGuru ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains our practices regarding data collection and usage for the TabGuru browser extension.

---

## 1. No Data Collection or Transmission
TabGuru is built with privacy as a core principle. 
* **Local Processing:** The extension runs entirely locally in your web browser.
* **No Remote Servers:** We do not host any remote databases, trackers, or telemetry servers.
* **No Transmission:** Your data is never sold, rented, shared, or transmitted to us or any third parties.

---

## 2. Information We Store Locally
To provide its core functionality, TabGuru stores the following information locally on your device using the browser's `chrome.storage.local` API:
* **Active tab purposes:** The reasons you write for opening your tabs.
* **Focus timers:** The durations and remaining times of your focus sessions.
* **Recently used purposes:** A history of recently entered purposes to provide suggestion chips (capped at the 10 most recent items).

You can clear this data at any time by clearing your browser cache/extension data or by uninstalling the extension.

---

## 3. Browser Permissions Used
TabGuru requests the following permissions solely to perform its local productivity features:
* **`tabs`:** Used to track tab lifecycle events (creation, updates, activation, and closure) to maintain parent-child tab relationships, display the focus banner, and close tabs when timers expire.
* **`storage`:** Used to store your active task purposes and timers locally on your device.
* **`windows`:** Used to detect when the browser window loses or gains focus, allowing the extension to automatically pause your tab's active focus timer when you leave the browser.
* **`<all_urls>` (Host Permissions):** Used to inject the floating focus banner and link-interception overlay on webpages you visit so that you can view your task timer and set a purpose before opening new tabs.

---

## 4. Third-Party Links
The extension does not integrate with any third-party APIs, analytics platforms, or advertisement networks.

---

## 5. Contact Us
If you have any questions or feedback about this Privacy Policy, please open an issue on our [GitHub Repository](https://github.com/gosrahul21/TabGuru).
