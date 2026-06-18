import { useState, useEffect, useCallback, useRef } from 'react';
import type { TabPurpose, ExtensionMessage, ExtensionResponse } from '../types';

// ─── Timer Hook (pause-aware) ────────────────────────────────────────────────

function useCountdown(purpose: TabPurpose | null) {
  const computeRemaining = () => {
    if (!purpose) return 0;
    const totalMs = purpose.durationMinutes * 60_000;
    const liveMs =
      purpose.lastActivatedAt !== null
        ? Date.now() - purpose.lastActivatedAt
        : 0;
    return Math.max(0, totalMs - purpose.accumulatedMs - liveMs);
  };

  const [msLeft, setMsLeft] = useState(computeRemaining);

  useEffect(() => {
    if (!purpose || purpose.lastActivatedAt === null) {
      setMsLeft(computeRemaining());
      return;
    }
    const id = setInterval(() => setMsLeft(computeRemaining()), 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purpose?.lastActivatedAt, purpose?.accumulatedMs, purpose?.durationMinutes]);

  const mins = Math.floor(msLeft / 60_000);
  const secs = Math.floor((msLeft % 60_000) / 1000);
  const isUrgent = msLeft < 2 * 60_000 && msLeft > 0;
  const isExpired = msLeft === 0 && purpose !== null;
  const isPaused = purpose ? purpose.lastActivatedAt === null : false;

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
  purpose: TabPurpose | null;
  tabId: number;
  activeChildren?: TabPurpose[];
}

export default function Banner({ purpose: initialPurpose, tabId, activeChildren = [] }: Props) {
  const [purpose, setPurpose] = useState<TabPurpose | null>(initialPurpose);
  const [minimized, setMinimized] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [animationDone, setAnimationDone] = useState(false);

  // Sync state with props
  useEffect(() => {
    setPurpose(initialPurpose);
  }, [initialPurpose]);

  // Keep banner positioned on screen resizing unless dragged
  useEffect(() => {
    const updatePosition = () => {
      if (!hasDragged) {
        const width = minimized ? 40 : 280;
        setPosition({
          x: window.innerWidth - 16 - width,
          y: 16,
        });
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [hasDragged, minimized]);

  // Prevent widget jumping when toggling minimized state after drag
  const prevMinimized = useRef(minimized);
  useEffect(() => {
    if (hasDragged && prevMinimized.current !== minimized) {
      if (minimized) {
        // Expanded (280px) -> Minimized (40px)
        setPosition((prev) => ({ ...prev, x: prev.x + 240 }));
      } else {
        // Minimized (40px) -> Expanded (280px)
        setPosition((prev) => ({ ...prev, x: prev.x - 240 }));
      }
    }
    prevMinimized.current = minimized;
  }, [minimized, hasDragged]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (!minimized && (target.closest('button') || target.closest('a'))) return;

    setIsDragging(true);
    const startX = e.clientX - position.x;
    const startY = e.clientY - position.y;

    let hasMoved = false;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - e.clientX;
      const dy = moveEvent.clientY - e.clientY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        hasMoved = true;
        setHasDragged(true);
      }
      setPosition({
        x: moveEvent.clientX - startX,
        y: moveEvent.clientY - startY,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      if (!hasMoved && minimized) {
        setMinimized(false);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [position, minimized]);

  const handleGoToTab = useCallback(async (childTabId: number) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'ACTIVATE_TAB',
        payload: { targetTabId: childTabId },
      });
    } catch (err) {
      console.error('Failed to activate child tab:', err);
    }
  }, []);

  const handleMarkChildComplete = useCallback(async (childTabId: number) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'MARK_COMPLETE',
        tabId: childTabId,
      });
    } catch (err) {
      console.error('Failed to mark child tab complete:', err);
    }
  }, []);

  const { mins, secs, isUrgent, isExpired, isPaused } = useCountdown(purpose);

  // Extend timer
  const handleExtend = useCallback(
    async (extra: number) => {
      if (!tabId) return;
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
  const handleComplete = useCallback(() => {
    setShowToast(true);
  }, []);

  const handleToastDone = useCallback(async () => {
    await sendMsg({ type: 'MARK_COMPLETE', tabId });
  }, [tabId]);

  if (minimized) {
    const tooltipText = purpose
      ? `TabGuru: ${purpose.purpose} (Drag to move, click to expand)`
      : `TabGuru: Active sub-tasks (Drag to move, click to expand)`;

    return (
      <div
        onMouseDown={handleMouseDown}
        title={tooltipText}
        className={`
          fixed z-[2147483647]
          flex items-center justify-center w-10 h-10 rounded-full
          bg-[#0f172a]/95 border border-white/10 backdrop-blur-md
          shadow-[0_4px_20px_rgba(0,0,0,0.5)]
          hover:scale-110 transition-all duration-200
          text-lg select-none
          ${isDragging ? 'shadow-[0_8px_32px_rgba(0,0,0,0.7)] scale-110' : ''}
        `}
        style={{
          fontFamily: 'system-ui',
          left: `${position.x}px`,
          top: `${position.y}px`,
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
      >
        🧙
        {activeChildren.length > 0 && (
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 border border-[#0f172a] shadow-sm animate-pulse">
            <span className="text-[8px]">🌿</span>
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      onAnimationEnd={() => setAnimationDone(true)}
      className={`
        fixed z-[2147483647] select-none
        rounded-2xl border border-white/10
        bg-[#0f172a]/95 backdrop-blur-xl
        p-3 min-w-[260px] max-w-[300px]
        font-inter transition-shadow duration-150
        ${animationDone ? '' : 'banner-enter'}
        ${isDragging ? 'shadow-[0_12px_48px_rgba(0,0,0,0.75)]' : 'shadow-[0_8px_40px_rgba(0,0,0,0.6)]'}
      `}
      style={{
        fontFamily: 'Inter, system-ui, sans-serif',
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
    >
      {showToast && <GoalToast onDone={handleToastDone} />}

      {/* Header row */}
      <div className="flex items-start gap-2">
        <span className="text-base mt-0.5 shrink-0">🧙</span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest leading-none mb-0.5">
            {purpose ? 'Purpose' : 'TabGuru'}
          </p>
          <p className="text-sm font-semibold text-slate-200 leading-snug truncate" title={purpose ? purpose.purpose : 'Browsing Context'}>
            {purpose ? purpose.purpose : 'Browsing Context'}
          </p>
        </div>
        {/* Minimize */}
        <button
          onClick={() => setMinimized(true)}
          className="
            shrink-0 text-slate-400 hover:text-slate-200 hover:bg-white/10
            transition-colors p-1 rounded cursor-pointer leading-none mt-0.5
          "
          title="Minimize"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" />
          </svg>
        </button>
      </div>

      {purpose && (
        <>
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
        </>
      )}

      {/* Child tab section */}
      {activeChildren.length > 0 && (
        <>
          <div className="my-2 border-t border-white/[0.06]" />
          <div className="bg-white/5 rounded-xl p-2.5 space-y-2 border border-white/[0.03]">
            <div className="flex items-center gap-2 min-w-0 pointer-events-none">
              <span className="text-sm shrink-0">🌿</span>
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">
                  Active Child Tab
                </p>
                <p className="text-xs font-semibold text-slate-300 truncate leading-tight" title={activeChildren[activeChildren.length - 1].purpose}>
                  "{activeChildren[activeChildren.length - 1].purpose}"
                </p>
              </div>
            </div>
            <div className="flex gap-1.5 justify-end">
              <button
                onClick={() => handleGoToTab(activeChildren[activeChildren.length - 1].tabId)}
                className="
                  text-[9px] font-bold px-2 py-1 rounded-md
                  bg-violet-600 hover:bg-violet-500 text-white
                  transition-colors cursor-pointer shadow-sm
                "
              >
                Go to Child
              </button>
              <button
                onClick={() => handleMarkChildComplete(activeChildren[activeChildren.length - 1].tabId)}
                className="
                  text-[9px] font-bold px-2 py-1 rounded-md
                  bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400
                  border border-emerald-500/20 transition-colors cursor-pointer
                "
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
