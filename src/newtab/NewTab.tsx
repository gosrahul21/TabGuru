import { useState, useEffect, useCallback } from 'react';
import { savePurpose, getRecentPurposes, type RecentPurpose } from '../storage/storage';
import type { TabPurpose } from '../types';
import PurposeInput from './components/PurposeInput';
import DurationChips from './components/DurationChips';
import SuggestionChips from './components/SuggestionChips';
import SearchInput from './components/SearchInput';
import ExcludedDomains from './components/ExcludedDomains';
import ShortcutsList from './components/ShortcutsList';
import ThemeSwitcher from './components/ThemeSwitcher';
import { ThemeProvider, useTheme } from './ThemeContext';

// Ambient floating orbs — colors come from the active theme
function Orbs() {
  const { theme } = useTheme();
  const positions = [
    '-top-32 -left-32 w-96 h-96 animate-pulse-slow',
    'top-1/2 -right-48 w-[500px] h-[500px] animate-pulse-slow delay-700',
    '-bottom-48 left-1/3 w-[400px] h-[400px] animate-pulse-slow delay-1500',
    'top-1/4 left-1/4 w-72 h-72 animate-pulse-slow delay-700',
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {theme.orb.map((colorCn, i) => (
        <div key={i} className={`absolute rounded-full ${colorCn} ${positions[i]}`} />
      ))}
    </div>
  );
}

// ─── Inner content (must be inside ThemeProvider) ────────────────────────────
function NewTabContent() {
  const { theme } = useTheme();

  // Detect redirect from right-click "Open in new tab"
  const params = new URLSearchParams(window.location.search);
  const redirectParam = params.get('redirect');
  const isRedirect = Boolean(redirectParam);
  const explicitOpenerFromUrl = (() => {
    const raw = params.get('opener');
    const n = raw && raw !== 'undefined' ? parseInt(raw, 10) : NaN;
    return isNaN(n) ? undefined : n;
  })();

  const redirectHostname = (() => {
    if (!redirectParam) return '';
    try { return new URL(redirectParam).hostname.replace(/^www\./, ''); } catch { return ''; }
  })();

  const [purpose, setPurpose] = useState('');
  const [duration, setDuration] = useState<number>(15);
  const [destination, setDestination] = useState(redirectParam ?? '');
  const [suggestions, setSuggestions] = useState<RecentPurpose[]>([]);
  const [shortcuts, setShortcuts] = useState<import('../types').Shortcut[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const [linkedToParent, setLinkedToParent] = useState(true);
  const [rawOpenerTabId, setRawOpenerTabId] = useState<number | undefined>(explicitOpenerFromUrl);
  const [parentPurposeText, setParentPurposeText] = useState<string | null>(null);

  useEffect(() => {
    getRecentPurposes().then((recent) => {
      if (recent.length > 0) setSuggestions(recent.slice(0, 3));
    });
  }, []);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_SHORTCUTS' })
      .then((res) => { if (res?.success && Array.isArray(res.shortcuts)) setShortcuts(res.shortcuts); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    async function fetchParentInfo() {
      let openerId = explicitOpenerFromUrl;
      if (!openerId) {
        const tab = await chrome.tabs.getCurrent().catch(() => null);
        openerId = tab?.openerTabId;
      }
      if (!openerId) return;
      setRawOpenerTabId(openerId);
      try {
        const res = await chrome.runtime.sendMessage({ type: 'GET_PURPOSE', tabId: openerId });
        if (res?.success && res?.data?.purpose) setParentPurposeText(res.data.purpose);
      } catch { /* no purpose on parent */ }
    }
    fetchParentInfo();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = useCallback(async () => {
    setError('');
    setIsSubmitting(true);
    try {
      const tab = await chrome.tabs.getCurrent();
      const tabId = tab?.id ?? Date.now();
      const openerTabId = linkedToParent ? rawOpenerTabId : undefined;
      const resolvedPurpose = purpose.trim()
        || (linkedToParent && parentPurposeText ? `Subtask of: ${parentPurposeText}` : '')
        || (redirectHostname ? `Browsing ${redirectHostname}` : '')
        || 'Quick browse';
      const now = Date.now();
      const newPurpose: TabPurpose = {
        tabId, purpose: resolvedPurpose, durationMinutes: duration,
        startTime: now, endTime: now + duration * 60_000, status: 'active',
        destinationUrl: destination.trim() || undefined,
        accumulatedMs: 0, lastActivatedAt: now, openerTabId,
      };
      await savePurpose(newPurpose);
      chrome.runtime.sendMessage({ type: 'BROADCAST_REFRESH' }).catch(() => {});
      const dest = (isRedirect ? redirectParam! : destination).trim();
      if (dest) {
        const isUrl = dest.startsWith('http://') || dest.startsWith('https://') || /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(dest);
        window.location.href = isUrl ? (dest.startsWith('http') ? dest : `https://${dest}`) : `https://www.google.com/search?q=${encodeURIComponent(dest)}`;
      } else {
        window.location.href = 'https://www.google.com';
      }
    } catch (err) {
      console.error(err);
      setError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  }, [purpose, duration, destination, linkedToParent, rawOpenerTabId, parentPurposeText, redirectHostname]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) handleSubmit();
  };

  const handleSaveShortcut = () => {
    const enteredPurpose = purpose.trim();
    if (!enteredPurpose) { setError('Please enter an intention to save it as a shortcut.'); return; }
    const newShortcut: import('../types').Shortcut = {
      id: Date.now().toString(), name: enteredPurpose, purpose: enteredPurpose,
      destinationUrl: destination.trim() || undefined, durationMinutes: duration,
    };
    const updated = [...shortcuts, newShortcut];
    chrome.runtime.sendMessage({ type: 'SET_SHORTCUTS', payload: { shortcuts: updated } as any })
      .then(() => setShortcuts(updated)).catch(() => {});
  };

  const handleRemoveShortcut = (id: string) => {
    const updated = shortcuts.filter((s) => s.id !== id);
    chrome.runtime.sendMessage({ type: 'SET_SHORTCUTS', payload: { shortcuts: updated } as any })
      .then(() => setShortcuts(updated)).catch(() => {});
  };

  const isTypingDestination = destination.trim().length > 0;
  const isTypingPurpose = purpose.trim().length > 0;
  const matchingShortcuts = (isTypingDestination || isTypingPurpose)
    ? shortcuts.filter((s) => {
        const destMatch = isTypingDestination && s.destinationUrl?.toLowerCase().includes(destination.toLowerCase());
        const purposeMatch = isTypingPurpose && s.purpose.toLowerCase().includes(purpose.toLowerCase());
        return destMatch || purposeMatch;
      }).slice(0, 3)
    : [];

  return (
    <div
      className="relative h-screen w-full font-outfit overflow-y-auto"
      style={theme.pageBg}
      onKeyDown={handleKeyDown}
    >
      <Orbs />

      <div className="relative z-10 w-full max-w-xl mx-auto px-4 py-10">
        {/* ── Logo & Headline ── */}
        <div className="mb-8 select-none flex flex-col items-center">
          <div className="flex flex-row items-center gap-4">
            <div className="drop-shadow-[0_0_28px_rgba(139,92,246,0.35)] animate-float">
              <img src="/icons/icon128.png" alt="TabGuru" className="w-14 h-14 rounded-2xl shadow-xl" />
            </div>
            <h1 className="text-5xl font-extrabold tracking-tight">
              <span className={theme.logoTab}>Tab</span>
              <span className="bg-gradient-to-r from-violet-500 to-indigo-500 bg-clip-text text-transparent">Guru</span>
            </h1>
          </div>
          <p className={`mt-3 text-sm font-inter font-medium tracking-wide ${theme.tagline}`}>
            Every tab starts with a purpose.
          </p>
          {/* Theme switcher — subtle, below tagline */}
          <div className="mt-3">
            <ThemeSwitcher />
          </div>
        </div>

        {/* ── Glass card ── */}
        <div className={`${theme.card} p-7 space-y-5`} style={theme.cardShadow}>

          {/* Right-click: destination badge */}
          {isRedirect && redirectParam && (
            <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border ${theme.indigoBadge}`}>
              <span className="text-base shrink-0">🔗</span>
              <div className="min-w-0">
                <p className={`text-[10px] font-semibold uppercase tracking-widest ${theme.indigoLabel}`}>Destination</p>
                <p className={`text-xs truncate font-inter ${theme.indigoText}`} title={redirectParam}>
                  {new URL(redirectParam).hostname.replace(/^www\./, '')}
                </p>
              </div>
            </div>
          )}

          {/* Right-click: parent badge */}
          {isRedirect && parentPurposeText && linkedToParent && (
            <div className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border ${theme.violetBadge}`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-base shrink-0">🌿</span>
                <div className="min-w-0">
                  <p className={`text-[10px] font-semibold uppercase tracking-widest ${theme.violetLabel}`}>From</p>
                  <p className={`text-xs truncate font-inter ${theme.violetText}`}>{parentPurposeText}</p>
                </div>
              </div>
              <button
                onClick={() => setLinkedToParent(false)}
                title="Open as independent tab"
                className={`shrink-0 p-1.5 rounded-lg transition-colors text-xs leading-none cursor-pointer ${theme.closeBtn}`}
              >
                ✕
              </button>
            </div>
          )}

          {/* Purpose question */}
          <div>
            <label className={`block text-base font-semibold mb-2 ${theme.label}`}>
              Why are you opening this tab?
              <span className={`ml-2 text-sm font-normal normal-case tracking-normal ${theme.labelOpt}`}>(optional)</span>
            </label>
            <PurposeInput value={purpose} onChange={setPurpose} hasError={false} />
            {error && <p className={`mt-1.5 text-xs font-inter ${theme.error}`}>{error}</p>}
            <p className={`mt-1.5 text-[11px] font-inter ${theme.hint}`}>
              Skip to auto-label as{' '}
              <span className={`font-mono ${theme.hintSpan}`}>
                &quot;{redirectHostname ? `Browsing ${redirectHostname}` : (linkedToParent && parentPurposeText ? `Subtask of: ${parentPurposeText}` : 'Quick browse')}&quot;
              </span>
              {' '}— editable later.
            </p>
          </div>

          <ShortcutsList
            shortcuts={shortcuts}
            onSelect={(s) => { setPurpose(s.purpose); if (s.destinationUrl) setDestination(s.destinationUrl); setDuration(s.durationMinutes); }}
            onRemove={handleRemoveShortcut}
          />

          {suggestions.length > 0 && (
            <SuggestionChips
              items={suggestions}
              onSelect={(s) => { setPurpose(s.purpose); if (s.url) setDestination(s.url); }}
            />
          )}

          {/* Duration */}
          <div>
            <label className={`block text-xs font-semibold mb-2 uppercase tracking-widest font-inter ${theme.secLabel}`}>
              Estimated time
            </label>
            <DurationChips selected={duration} onChange={setDuration} />
          </div>

          {/* + button parent chip */}
          {!isRedirect && parentPurposeText && (
            <button
              type="button"
              onClick={() => setLinkedToParent((v) => !v)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all duration-150 backdrop-blur-sm ${
                linkedToParent ? theme.parentActive : theme.parentInactive
              }`}
            >
              <span className="text-base shrink-0">🌿</span>
              <div className="min-w-0 flex-1">
                <p className={`text-[10px] font-semibold uppercase tracking-widest font-inter ${
                  linkedToParent ? theme.parentActiveLabel : theme.parentInactiveLabel
                }`}>
                  {linkedToParent ? 'Subtask of' : 'Open standalone'}
                </p>
                <p className={`text-xs truncate font-inter ${
                  linkedToParent ? theme.parentActiveText : theme.parentInactiveText
                }`}>
                  {parentPurposeText}
                </p>
              </div>
              <span className={`shrink-0 text-xs font-bold leading-none ${theme.closeBtn}`}>
                {linkedToParent ? '✕' : '+'}
              </span>
            </button>
          )}

          {/* Destination */}
          {!isRedirect && (
            <div>
              <label className={`block text-xs font-semibold mb-2 uppercase tracking-widest font-inter ${theme.secLabel}`}>
                Where are you going?{' '}
                <span className={`normal-case tracking-normal ${theme.labelOpt}`}>(optional)</span>
              </label>
              <SearchInput value={destination} onChange={setDestination} onSubmit={handleSubmit} />
              {matchingShortcuts.length > 0 && (
                <div className="mt-3">
                  <p className={`text-[10px] font-inter mb-1.5 uppercase tracking-widest font-semibold ${theme.secLabel}`}>
                    Matching Shortcuts
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {matchingShortcuts.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => { setPurpose(s.purpose); if (s.destinationUrl) setDestination(s.destinationUrl); setDuration(s.durationMinutes); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-left border transition-all duration-150 text-xs font-medium ${theme.matchChip}`}
                      >
                        ⚡ {s.name}
                        {s.destinationUrl && (
                          <span className={`text-[10px] font-normal ${theme.matchUrl}`}>
                            ({new URL(s.destinationUrl.startsWith('http') ? s.destinationUrl : `https://${s.destinationUrl}`).hostname.replace(/^www\./, '')})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`
                flex-1 py-3.5 rounded-xl font-semibold text-sm tracking-wide
                bg-gradient-to-r text-white
                transform hover:scale-[1.01] active:scale-[0.99]
                transition-all duration-200
                disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent
                ${theme.continueBtn}
              `}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Starting session…
                </span>
              ) : 'Continue →'}
            </button>
            <button
              onClick={handleSaveShortcut}
              title="Save current form as a shortcut"
              className={`
                px-4 py-3.5 rounded-xl font-semibold text-sm tracking-wide
                transform hover:scale-[1.02] active:scale-[0.98]
                transition-all duration-200 focus:outline-none focus:ring-2
                ${theme.saveBtn}
              `}
            >
              ⭐ Save
            </button>
          </div>

          <p className={`text-center text-xs font-inter ${theme.dimText}`}>
            Purpose is optional — you can always rename it later.
          </p>

          {/* Settings section */}
          <div className={`border-t ${theme.divider} pt-3`}>
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              className={`w-full flex items-center justify-between text-[11px] transition-colors cursor-pointer select-none ${theme.settingsBtn}`}
            >
              <span className="flex items-center gap-1.5">
                <span className="text-base leading-none">⚙️</span>
                Settings
              </span>
              <span className={`transition-transform duration-200 ${showSettings ? 'rotate-180' : ''}`}>▾</span>
            </button>

            {showSettings && (
              <div className="mt-3">
                <ExcludedDomains />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-5 px-1">
          <p className={`text-xs font-inter ${theme.dimText}`}>
            TabGuru — Every tab starts with a purpose.
          </p>
          <button
            type="button"
            onClick={() => { const url = chrome.runtime.getURL('src/dashboard/index.html'); window.open(url, '_blank'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${theme.statsBtn}`}
            title="Open productivity dashboard"
          >
            <span>📊</span>
            <span>Stats</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Exported default — wraps content in ThemeProvider ───────────────────────
export default function NewTab() {
  return (
    <ThemeProvider>
      <NewTabContent />
    </ThemeProvider>
  );
}
