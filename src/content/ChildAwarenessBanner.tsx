import { useState, useCallback } from 'react';
import type { TabPurpose } from '../types';

interface ChildAwarenessBannerProps {
  child: TabPurpose;
  onDismiss: () => void;
}

export default function ChildAwarenessBanner({ child, onDismiss }: ChildAwarenessBannerProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleGoToTab = useCallback(async () => {
    setIsProcessing(true);
    try {
      await chrome.runtime.sendMessage({
        type: 'ACTIVATE_TAB',
        payload: { targetTabId: child.tabId },
      });
    } catch (err) {
      console.error('Failed to activate child tab:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [child.tabId]);

  const handleMarkComplete = useCallback(async () => {
    setIsProcessing(true);
    try {
      await chrome.runtime.sendMessage({
        type: 'MARK_COMPLETE',
        tabId: child.tabId,
      });
    } catch (err) {
      console.error('Failed to mark child tab complete:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [child.tabId]);

  return (
    <div
      className="
        fixed top-4 left-1/2 -translate-x-1/2 z-[2147483647]
        pointer-events-auto banner-enter
        rounded-2xl border border-white/10
        bg-[#0f172a]/95 backdrop-blur-xl
        shadow-[0_8px_32px_rgba(0,0,0,0.5)]
        p-3 px-4 min-w-[320px] max-w-[480px]
        flex items-center justify-between gap-4
      "
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-lg shrink-0">🌿</span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">
            Pending Sub-task
          </p>
          <p className="text-xs font-semibold text-slate-200 truncate leading-tight" title={child.purpose}>
            "{child.purpose}"
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={handleGoToTab}
          disabled={isProcessing}
          className="
            text-[10px] font-bold px-3 py-1.5 rounded-lg
            bg-violet-600 hover:bg-violet-500 disabled:opacity-50
            text-white transition-all duration-150 cursor-pointer
            border border-violet-500/30 shadow-md hover:shadow-lg
          "
        >
          Go back
        </button>
        <button
          onClick={handleMarkComplete}
          disabled={isProcessing}
          className="
            text-[10px] font-bold px-3 py-1.5 rounded-lg
            bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400
            border border-emerald-500/20 disabled:opacity-50
            transition-all duration-150 cursor-pointer
          "
        >
          Done
        </button>
        <button
          onClick={onDismiss}
          disabled={isProcessing}
          className="
            text-slate-600 hover:text-slate-400 p-1 transition-colors
            text-xs font-semibold cursor-pointer ml-1
          "
          title="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
