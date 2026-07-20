import { useState, useEffect, useCallback } from 'react';
import type { ExtensionMessage } from '../types';
import DurationChips from '../newtab/components/DurationChips';

interface Props {
  destinationUrl: string;
  openerTabId: number;
  onClose: () => void;
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.slice(0, 40);
  }
}

export default function LinkModal({ destinationUrl, openerTabId, onClose }: Props) {
  const [purpose, setPurpose] = useState('');
  const [duration, setDuration] = useState<number>(15);
  const [isOpening, setIsOpening] = useState(false);
  const hostname = getHostname(destinationUrl);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleOpen = useCallback(async () => {
    setIsOpening(true);

    // Purpose is optional — fall back to a contextual label
    const resolvedPurpose = purpose.trim() || `Browsing ${hostname}`;

    const msg: ExtensionMessage = {
      type: 'OPEN_TAB_WITH_PURPOSE',
      tabId: openerTabId,
      payload: {
        url: destinationUrl,
        purpose: resolvedPurpose,
        durationMinutes: duration,
      } as never,
    };

    try {
      await chrome.runtime.sendMessage(msg);
      onClose();
    } catch {
      setIsOpening(false);
    }
  }, [purpose, hostname, duration, destinationUrl, openerTabId, onClose]);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[2147483646] flex items-end justify-end p-5 pointer-events-none"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* Modal card — slide up from bottom-right */}
      <div
        className="
          pointer-events-auto
          w-[320px] rounded-2xl
          border border-white/10 bg-[#0f172a]/90 backdrop-blur-xl
          shadow-[0_16px_60px_rgba(0,0,0,0.7)]
          p-5 space-y-4
          animate-[slideUp_0.3s_cubic-bezier(0.22,1,0.36,1)_forwards]
        "
        style={{
          animation: 'slideUp 0.3s cubic-bezier(0.22,1,0.36,1) forwards',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <img
              src={chrome.runtime.getURL('icons/icon128.png')}
              alt="TabGuru"
              className="w-8 h-8 object-contain drop-shadow-sm pointer-events-none"
            />
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest leading-none mb-0.5">
                Opening new tab
              </p>
              <p className="text-xs font-semibold text-indigo-400 truncate max-w-[200px]" title={destinationUrl}>
                {hostname}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-600 hover:text-slate-300 transition-colors text-sm leading-none mt-1 flex-shrink-0"
            title="Cancel (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Divider */}
        <div className="border-t border-white/[0.06]" />

        {/* Purpose input */}
        <div>
          <label className="block text-xs text-slate-400 font-semibold mb-1.5 uppercase tracking-widest">
            Why are you visiting this?
            <span className="ml-1 text-slate-600 normal-case tracking-normal font-normal">(optional)</span>
          </label>
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleOpen();
              }
            }}
            rows={2}
            autoFocus
            placeholder={`e.g. "Learn about ${hostname}", "Reference docs"…`}
            className="
              w-full resize-none rounded-xl px-3 py-2.5 text-sm
              bg-white/5 border border-white/10 text-slate-100 placeholder-slate-600
              hover:border-white/20 focus:border-violet-500/60
              outline-none transition-all duration-200
              focus:shadow-[0_0_0_2px_rgba(139,92,246,0.45)]
            "
          />
          <p className="mt-1 text-[10px] text-slate-600">
            Skip to open with auto-label “Browsing {hostname}”
          </p>
        </div>

        {/* Duration chips */}
        <div>
          <label className="block text-xs text-slate-500 font-semibold mb-2 uppercase tracking-widest">
            Estimated time
          </label>
          <DurationChips selected={duration} onChange={setDuration} />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="
              flex-1 py-2 rounded-lg text-xs font-semibold
              bg-white/5 border border-white/10 text-slate-500
              hover:text-slate-300 hover:border-white/20
              transition-all duration-150
            "
          >
            Cancel
          </button>
          <button
            onClick={handleOpen}
            disabled={isOpening}
            className="
              flex-[2] py-2 rounded-lg text-xs font-semibold
              bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600
              hover:from-indigo-400 hover:to-purple-500
              text-white shadow-[0_2px_16px_rgba(139,92,246,0.4)]
              hover:shadow-[0_2px_24px_rgba(139,92,246,0.6)]
              transform hover:scale-[1.02] active:scale-[0.99]
              transition-all duration-150
              disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100
            "
          >
            {isOpening ? 'Opening…' : 'Open Tab →'}
          </button>
        </div>
      </div>
    </div>
  );
}
