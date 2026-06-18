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
  // Background service worker sets ?redirect=<url> in that case.
  const redirectParam = new URLSearchParams(window.location.search).get('redirect');
  const isRedirect = Boolean(redirectParam);

  const [purpose, setPurpose] = useState('');
  const [duration, setDuration] = useState<number>(15);
  // Pre-fill destination if we have a redirect param
  const [destination, setDestination] = useState(redirectParam ?? '');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Load suggestions from history (only shown after ≥3 entries)
  useEffect(() => {
    getRecentPurposes().then((recent) => {
      if (recent.length >= 3) setSuggestions(recent.slice(0, 5));
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!purpose.trim()) {
      setError('Please describe your purpose for opening this tab.');
      return;
    }
    setError('');
    setIsSubmitting(true);

    try {
      // Get the current tab's ID from the background context
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tab.id ?? Date.now(); // fallback for dev

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
      };

      await savePurpose(newPurpose);

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
  }, [purpose, duration, destination]);

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
        <div className="text-center mb-8 select-none">
          <div className="text-5xl mb-3 drop-shadow-[0_0_32px_rgba(139,92,246,0.6)] animate-float">
            🧙
          </div>
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent tracking-tight">
            TabGuru
          </h1>
          <p className="mt-1 text-slate-400 text-sm font-inter font-medium tracking-widest uppercase">
            Browse with intention
          </p>
        </div>

        {/* Glass card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_8px_60px_rgba(0,0,0,0.6)] p-7 space-y-5">

          {/* Redirect context banner — shown when opened via right-click */}
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
          🧙 TabGuru — Purpose-First Browsing
        </p>
      </div>
    </div>
  );
}
