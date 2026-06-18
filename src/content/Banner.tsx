import { useState, useEffect, useCallback } from 'react';
import type { TabPurpose, ExtensionMessage, ExtensionResponse } from '../types';

// ─── Timer Hook (pause-aware) ────────────────────────────────────────────────

function useCountdown(purpose: TabPurpose) {
  const computeRemaining = () => {
    const totalMs = purpose.durationMinutes * 60_000;
    const liveMs =
      purpose.lastActivatedAt !== null
        ? Date.now() - purpose.lastActivatedAt
        : 0;
    return Math.max(0, totalMs - purpose.accumulatedMs - liveMs);
  };

  const [msLeft, setMsLeft] = useState(computeRemaining);

  useEffect(() => {
    // If paused (lastActivatedAt === null), no need to tick
    if (purpose.lastActivatedAt === null) {
      setMsLeft(computeRemaining());
      return;
    }
    const id = setInterval(() => setMsLeft(computeRemaining()), 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purpose.lastActivatedAt, purpose.accumulatedMs, purpose.durationMinutes]);

  const mins = Math.floor(msLeft / 60_000);
  const secs = Math.floor((msLeft % 60_000) / 1000);
  const isUrgent = msLeft < 2 * 60_000 && msLeft > 0;
  const isExpired = msLeft === 0;
  const isPaused = purpose.lastActivatedAt === null;

  return { mins, secs, isUrgent, isExpired, isPaused, msLeft };
}

// ─── Helper: send message to background ──────────────────────────────────────

function sendMsg(msg: ExtensionMessage): Promise<ExtensionResponse> {
  return chrome.runtime.sendMessage(msg);
}

// ─── Toast overlay for "Goal Achieved" ───────────────────────────────────────

function GoalToast({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, 1800);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <div className="
      absolute inset-0 flex flex-col items-center justify-center
      rounded-2xl bg-emerald-500/20 backdrop-blur-sm border border-emerald-400/40
      text-emerald-300 gap-1
    ">
      <span className="text-2xl">🎉</span>
      <span className="text-xs font-semibold font-inter">Goal achieved!</span>
    </div>
  );
}

// ─── Main Banner Component ────────────────────────────────────────────────────

interface Props {
  purpose: TabPurpose;
  tabId: number;
}

export default function Banner({ purpose: initialPurpose, tabId }: Props) {
  const [purpose, setPurpose] = useState(initialPurpose);
  const [minimized, setMinimized] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const { mins, secs, isUrgent, isExpired, isPaused } = useCountdown(purpose);

  // Extend timer
  const handleExtend = useCallback(
    async (extra: number) => {
      const msg: ExtensionMessage = {
        type: 'EXTEND_TIMER',
        tabId,
        payload: { extraMinutes: extra },
      };
      const res = await sendMsg(msg);
      if (res.success && res.data) setPurpose(res.data);
    },
    [tabId]
  );

  // Mark complete
  const handleComplete = useCallback(async () => {
    setShowToast(true);
    await sendMsg({ type: 'MARK_COMPLETE', tabId });
  }, [tabId]);

  const handleToastDone = useCallback(() => {
    window.close();
  }, []);

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        title={`TabGuru: ${purpose.purpose}`}
        className="
          flex items-center justify-center w-10 h-10 rounded-full
          bg-[#0f172a]/90 border border-white/10 backdrop-blur-md
          shadow-[0_4px_20px_rgba(0,0,0,0.5)]
          hover:scale-110 transition-transform duration-200
          text-lg cursor-pointer
        "
        style={{ fontFamily: 'system-ui' }}
      >
        🧙
      </button>
    );
  }

  return (
    <div
      className="
        relative banner-enter
        rounded-2xl border border-white/10
        bg-[#0f172a]/80 backdrop-blur-xl
        shadow-[0_8px_40px_rgba(0,0,0,0.6)]
        p-3 min-w-[260px] max-w-[300px]
        font-inter
      "
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {showToast && <GoalToast onDone={handleToastDone} />}

      {/* Header row */}
      <div className="flex items-start gap-2">
        <span className="text-base mt-0.5 shrink-0">🧙</span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest leading-none mb-0.5">
            Purpose
          </p>
          <p className="text-sm font-semibold text-slate-200 leading-snug truncate" title={purpose.purpose}>
            {purpose.purpose}
          </p>
        </div>
        {/* Minimize */}
        <button
          onClick={() => setMinimized(true)}
          className="shrink-0 text-slate-600 hover:text-slate-300 transition-colors text-xs leading-none mt-0.5"
          title="Minimize"
        >
          ─
        </button>
      </div>

      {/* Timer row */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-600">{isPaused ? '⏸' : '⏱'}</span>
          <span
            className={`text-sm font-mono font-bold tabular-nums ${
              isExpired
                ? 'text-red-400'
                : isPaused
                ? 'text-slate-600'
                : isUrgent
                ? 'timer-urgent'
                : 'text-slate-300'
            }`}
          >
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </span>
          {isPaused && !isExpired && (
            <span className="text-[10px] text-slate-600 font-semibold">Paused</span>
          )}
          {isExpired && (
            <span className="text-[10px] text-red-400 font-semibold">Time's up!</span>
          )}
        </div>

        {/* Extend buttons */}
        <div className="flex gap-1">
          {[5, 10].map((n) => (
            <button
              key={n}
              onClick={() => handleExtend(n)}
              className="
                text-[10px] font-semibold px-2 py-0.5 rounded-md
                bg-white/5 border border-white/10 text-slate-500
                hover:border-violet-500/40 hover:text-slate-300 hover:bg-violet-500/10
                transition-all duration-150
              "
            >
              +{n}m
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="my-2 border-t border-white/[0.06]" />

      {/* Complete button */}
      <button
        onClick={handleComplete}
        className="
          w-full py-1.5 rounded-lg text-xs font-semibold
          bg-gradient-to-r from-emerald-500/80 to-teal-600/80
          hover:from-emerald-400/90 hover:to-teal-500/90
          text-white border border-emerald-400/20
          shadow-[0_2px_12px_rgba(16,185,129,0.25)]
          hover:shadow-[0_2px_20px_rgba(16,185,129,0.4)]
          transform hover:scale-[1.02] active:scale-[0.99]
          transition-all duration-150
        "
      >
        ✅ Mark Complete
      </button>
    </div>
  );
}
