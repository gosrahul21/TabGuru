import { useState, useEffect, useCallback } from 'react';
import { savePurpose, getRecentPurposes } from '../storage/storage';
import type { TabPurpose } from '../types';
import PurposeInput from './components/PurposeInput';
import DurationChips from './components/DurationChips';
import SuggestionChips from './components/SuggestionChips';
import SearchInput from './components/SearchInput';

// Ambient floating orbs for background
function Orbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-indigo-600/20 blur-[128px] animate-pulse-slow" />
      <div className="absolute top-1/2 -right-48 w-[500px] h-[500px] rounded-full bg-purple-700/15 blur-[140px] animate-pulse-slow delay-700" />
      <div className="absolute -bottom-48 left-1/3 w-[400px] h-[400px] rounded-full bg-violet-500/10 blur-[120px] animate-pulse-slow delay-1500" />
    </div>
  );
}

export default function NewTab() {
  // Detect if we were redirected from right-click "Open in new tab"
  // Background service worker sets ?redirect=<url>&opener=<tabId> in that case.
  const params = new URLSearchParams(window.location.search);
  const redirectParam = params.get('redirect');
  const isRedirect = Boolean(redirectParam);
  const explicitOpenerFromUrl = (() => {
    const raw = params.get('opener');
    const n = raw && raw !== 'undefined' ? parseInt(raw, 10) : NaN;
    return isNaN(n) ? undefined : n;
  })();

  const [purpose, setPurpose] = useState('');
  const [duration, setDuration] = useState<number>(15);
  // Pre-fill destination if we have a redirect param
  const [destination, setDestination] = useState(redirectParam ?? '');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Parent tab linking state
  // Right-click: starts linked (true). + button: starts standalone (false).
  const [linkedToParent, setLinkedToParent] = useState(isRedirect);
  const [rawOpenerTabId, setRawOpenerTabId] = useState<number | undefined>(explicitOpenerFromUrl);
  const [parentPurposeText, setParentPurposeText] = useState<string | null>(null);

  // Load suggestions from history (only shown after ≥3 entries)
  useEffect(() => {
    getRecentPurposes().then((recent) => {
      if (recent.length >= 3) setSuggestions(recent.slice(0, 5));
    });
  }, []);

  // Fetch the parent tab's purpose text to display in the chip / badge
  useEffect(() => {
    async function fetchParentInfo() {
      let openerId = explicitOpenerFromUrl;
      if (!openerId) {
        // + button case — Chrome sets openerTabId on the tab object
        const tab = await chrome.tabs.getCurrent().catch(() => null);
        openerId = tab?.openerTabId;
      }
      if (!openerId) return;
      setRawOpenerTabId(openerId);
      try {
        const res = await chrome.runtime.sendMessage({ type: 'GET_PURPOSE', tabId: openerId });
        if (res?.success && res?.data?.purpose) {
          setParentPurposeText(res.data.purpose);
        }
      } catch { /* no purpose on parent — don't show chip */ }
    }
    fetchParentInfo();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = useCallback(async () => {
    if (!purpose.trim()) {
      setError('Please describe your purpose for opening this tab.');
      return;
    }
    setError('');
    setIsSubmitting(true);

    try {
      // Get the current tab's ID from the background context
      const tab = await chrome.tabs.getCurrent();
      const tabId = tab?.id ?? Date.now(); // fallback for dev

      // openerTabId is fully controlled by the parent-link UI toggle
      const openerTabId = linkedToParent ? rawOpenerTabId : undefined;

      const now = Date.now();
      const newPurpose: TabPurpose = {
        tabId,
        purpose: purpose.trim(),
        durationMinutes: duration,
        startTime: now,
        endTime: now + duration * 60_000, // kept for reference
        status: 'active',
        destinationUrl: destination.trim() || undefined,
        // Timer starts counting immediately — tab is active right now
        accumulatedMs: 0,
        lastActivatedAt: now,
        openerTabId,
      };

      await savePurpose(newPurpose);
      chrome.runtime.sendMessage({ type: 'BROADCAST_REFRESH' }).catch(() => {});

      // Navigate to destination — always the redirect URL if present
      const dest = (isRedirect ? redirectParam! : destination).trim();
      if (dest) {
        // Detect if URL or search query
        const isUrl =
          dest.startsWith('http://') ||
          dest.startsWith('https://') ||
          /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(dest);
        window.location.href = isUrl
          ? dest.startsWith('http')
            ? dest
            : `https://${dest}`
          : `https://www.google.com/search?q=${encodeURIComponent(dest)}`;
      } else {
        // No destination — navigate to Google
        window.location.href = 'https://www.google.com';
      }
    } catch (err) {
      console.error(err);
      setError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  }, [purpose, duration, destination, linkedToParent, rawOpenerTabId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) handleSubmit();
  };

  return (
    <div
      className="relative min-h-screen w-full flex items-center justify-center bg-[#0a0a12] font-outfit overflow-hidden"
      onKeyDown={handleKeyDown}
    >
      <Orbs />

      {/* Main card */}
      <div className="relative z-10 w-full max-w-xl mx-4">
        {/* Logo & Headline */}
        <div className="mb-8 select-none flex flex-col items-center">
          <div className="flex flex-row items-center gap-4">
            <div className="drop-shadow-[0_0_32px_rgba(139,92,246,0.4)] animate-float">
              <img src="/icons/icon128.png" alt="TabGuru" className="w-14 h-14 rounded-2xl shadow-xl" />
            </div>
            <h1 className="text-5xl font-extrabold tracking-tight">
              <span className="text-slate-100">Tab</span>
              <span className="bg-gradient-to-r from-violet-400 to-blue-500 bg-clip-text text-transparent">Guru</span>
            </h1>
          </div>
          <p className="mt-3 text-slate-400 text-sm font-inter font-medium tracking-wide">
            Every tab starts with a purpose.
          </p>
        </div>

        {/* Glass card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_8px_60px_rgba(0,0,0,0.6)] p-7 space-y-5">

          {/* ── Right-click: destination badge ── */}
          {isRedirect && redirectParam && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <span className="text-base shrink-0">🔗</span>
              <div className="min-w-0">
                <p className="text-[10px] text-indigo-400 font-semibold uppercase tracking-widest">Destination</p>
                <p className="text-xs text-slate-300 truncate font-inter" title={redirectParam}>
                  {new URL(redirectParam).hostname.replace(/^www\./, '')}
                </p>
              </div>
            </div>
          )}

          {/* ── Right-click: parent badge (pre-filled, dismissible with ✕) ── */}
          {isRedirect && parentPurposeText && linkedToParent && (
            <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-base shrink-0">🌿</span>
                <div className="min-w-0">
                  <p className="text-[10px] text-violet-400 font-semibold uppercase tracking-widest">From</p>
                  <p className="text-xs text-slate-300 truncate font-inter">{parentPurposeText}</p>
                </div>
              </div>
              <button
                onClick={() => setLinkedToParent(false)}
                title="Open as independent tab"
                className="shrink-0 text-slate-500 hover:text-slate-300 hover:bg-white/10 p-1.5 rounded-lg transition-colors text-xs leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}
          {/* Question */}
          <div>
            <label className="block text-slate-200 text-base font-semibold mb-2">
              Why are you opening this tab?
            </label>
            <PurposeInput
              value={purpose}
              onChange={setPurpose}
              hasError={!!error && !purpose.trim()}
            />
            {error && (
              <p className="mt-1.5 text-xs text-red-400 font-inter">{error}</p>
            )}
          </div>

          {/* Suggestions (only shown once history builds up) */}
          {suggestions.length > 0 && (
            <SuggestionChips
              items={suggestions}
              onSelect={(s) => setPurpose(s)}
            />
          )}

          {/* Duration */}
          <div>
            <label className="block text-slate-400 text-xs font-semibold mb-2 uppercase tracking-widest font-inter">
              Estimated time
            </label>
            <DurationChips selected={duration} onChange={setDuration} />
          </div>

          {/* ── + button: opt-in parent chip (only shown if parent has an active purpose) ── */}
          {!isRedirect && parentPurposeText && (
            <button
              type="button"
              onClick={() => setLinkedToParent((v) => !v)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all duration-150 ${
                linkedToParent
                  ? 'bg-violet-500/15 border-violet-500/30'
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
            >
              <span className="text-base shrink-0">🌿</span>
              <div className="min-w-0 flex-1">
                <p className={`text-[10px] font-semibold uppercase tracking-widest font-inter ${
                  linkedToParent ? 'text-violet-400' : 'text-slate-500'
                }`}>
                  {linkedToParent ? 'Linked to parent' : 'Link to parent?'}
                </p>
                <p className={`text-xs truncate font-inter ${
                  linkedToParent ? 'text-slate-200' : 'text-slate-500'
                }`}>{parentPurposeText}</p>
              </div>
              <span className={`shrink-0 text-sm font-bold ${
                linkedToParent ? 'text-violet-400' : 'text-slate-600'
              }`}>
                {linkedToParent ? '✓' : '+'}
              </span>
            </button>
          )}

          {/* Destination — hidden when redirect URL is already known */}
          {!isRedirect && (
            <div>
              <label className="block text-slate-400 text-xs font-semibold mb-2 uppercase tracking-widest font-inter">
                Where are you going?{' '}
                <span className="text-slate-600 normal-case tracking-normal">
                  (optional)
                </span>
              </label>
              <SearchInput
                value={destination}
                onChange={setDestination}
                onSubmit={handleSubmit}
              />
            </div>
          )}

          {/* Continue button */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-xl font-semibold text-sm tracking-wide
              bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600
              hover:from-indigo-400 hover:via-violet-400 hover:to-purple-500
              text-white shadow-[0_4px_24px_rgba(139,92,246,0.4)]
              hover:shadow-[0_4px_32px_rgba(139,92,246,0.6)]
              transform hover:scale-[1.01] active:scale-[0.99]
              transition-all duration-200
              disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none
              focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-transparent"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Starting session…
              </span>
            ) : (
              'Continue →'
            )}
          </button>

          <p className="text-center text-xs text-slate-600 font-inter">
            Every tab deserves a purpose. No skipping.
          </p>
        </div>

        {/* Footer */}
        <p className="text-center mt-5 text-slate-700 text-xs font-inter">
          TabGuru — Every tab starts with a purpose.
        </p>
      </div>
    </div>
  );
}
