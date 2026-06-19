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
      absolute inset-0 flex flex-col items-center justify-center z-50
      rounded-2xl bg-[#0f172a]/98 backdrop-blur-md border border-emerald-500/40
      text-emerald-400 gap-2
    ">
      <span className="text-4xl animate-bounce">🎉</span>
      <span className="text-sm font-bold font-inter tracking-wide">Goal achieved!</span>
    </div>
  );
}

// ─── Confirm close children dialog ───────────────────────────────────────────

const PREF_KEY = 'tabguru_skip_close_confirm';

function ConfirmCloseDialog({
  childCount,
  onConfirm,
  onCancel,
}: {
  childCount: number;
  onConfirm: (dontAskAgain: boolean) => void;
  onCancel: () => void;
}) {
  const [dontAskAgain, setDontAskAgain] = useState(false);

  return (
    <div className="
      absolute inset-0 z-50 flex flex-col items-center justify-center
      rounded-2xl bg-[#080e1e]/97 backdrop-blur-md border border-white/10 p-4 gap-3
    ">
      <span className="text-2xl">🗂️</span>

      <div className="text-center space-y-1">
        <p className="text-sm font-bold text-slate-100">Close child tabs?</p>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          This will also close{' '}
          <span className="text-slate-200 font-semibold">
            {childCount} child tab{childCount > 1 ? 's' : ''}
          </span>.
        </p>
      </div>

      {/* Don't ask me again */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={dontAskAgain}
          onChange={(e) => setDontAskAgain(e.target.checked)}
          className="w-3 h-3 accent-violet-500 cursor-pointer"
        />
        <span className="text-[10px] text-slate-500">Don't ask me again</span>
      </label>

      <div className="flex gap-2 w-full">
        <button
          onClick={onCancel}
          className="
            flex-1 py-1.5 rounded-lg text-[11px] font-semibold
            bg-white/5 hover:bg-white/10 text-slate-400
            border border-white/10 transition-all cursor-pointer
          "
        >
          Cancel
        </button>
        <button
          onClick={() => onConfirm(dontAskAgain)}
          className="
            flex-1 py-1.5 rounded-lg text-[11px] font-semibold
            bg-red-500/80 hover:bg-red-500 text-white
            border border-red-400/20 transition-all cursor-pointer
          "
        >
          Close All
        </button>
      </div>
    </div>
  );
}

// ─── Main Banner Component ────────────────────────────────────────────────────

interface Props {
  purpose: TabPurpose | null;
  tabId: number;
  activeChildren?: TabPurpose[];
  onRefresh?: () => void;
  parentPurposeText?: string | null;
}

export default function Banner({ purpose: initialPurpose, tabId, activeChildren = [], onRefresh, parentPurposeText }: Props) {
  const [purpose, setPurpose] = useState<TabPurpose | null>(initialPurpose);
  const [minimized, setMinimized] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [closeChildrenOnComplete, setCloseChildrenOnComplete] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [animationDone, setAnimationDone] = useState(false);

  // Inline editing
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input when edit mode is entered
  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditing]);

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
    // Don't initiate drag on interactive elements or when editing
    if (!minimized && (target.closest('button') || target.closest('a') || target.closest('input'))) return;
    if (isEditing) return;

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
      // Force UI refresh after completing the child
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to mark child tab complete:', err);
    }
  }, [onRefresh]);

  // Save renamed purpose text
  const handleSavePurpose = useCallback(async () => {
    const trimmed = editValue.trim();
    setIsEditing(false);
    if (!trimmed || trimmed === purpose?.purpose) return;
    try {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_PURPOSE',
        tabId,
        payload: { purpose: trimmed } as any,
      });
      // Optimistically update local state so it feels instant
      setPurpose((p) => p ? { ...p, purpose: trimmed } : p);
    } catch (err) {
      console.error('Failed to rename purpose:', err);
    }
  }, [editValue, purpose?.purpose, tabId]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  // Remove the old internal parent purpose fetch — now comes from AppShell as a prop

  const handleGoToParent = useCallback(async () => {
    if (!purpose?.openerTabId) return;
    try {
      await chrome.runtime.sendMessage({
        type: 'ACTIVATE_TAB',
        payload: { targetTabId: purpose.openerTabId },
      });
    } catch (err) {
      console.error('Failed to navigate to parent tab:', err);
    }
  }, [purpose?.openerTabId]);

  const { mins, secs, isUrgent, isExpired } = useCountdown(purpose);

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

  // Toggle pause
  const handleTogglePause = useCallback(async () => {
    if (!tabId) return;
    const msg: ExtensionMessage = {
      type: 'TOGGLE_PAUSE',
      tabId,
    };
    const res = await sendMsg(msg);
    if (res.success && res.data) setPurpose(res.data);
  }, [tabId]);

  // Mark complete — checks children count & user preference before proceeding
  const handleComplete = useCallback(async () => {
    if (activeChildren.length > 0) {
      const pref = await chrome.storage.local.get(PREF_KEY);
      if (pref[PREF_KEY]) {
        // Preference: skip dialog, always close children
        setCloseChildrenOnComplete(true);
        setShowToast(true);
      } else {
        setShowConfirmDialog(true);
      }
    } else {
      setCloseChildrenOnComplete(false);
      setShowToast(true);
    }
  }, [activeChildren.length]);

  const handleConfirmClose = useCallback(async (dontAskAgain: boolean) => {
    setShowConfirmDialog(false);
    if (dontAskAgain) {
      await chrome.storage.local.set({ [PREF_KEY]: true });
    }
    setCloseChildrenOnComplete(true);
    setShowToast(true);
  }, []);

  const handleCancelClose = useCallback(() => {
    setShowConfirmDialog(false);
  }, []);

  const handleToastDone = useCallback(async () => {
    await sendMsg({
      type: 'MARK_COMPLETE',
      tabId,
      payload: { closeChildren: closeChildrenOnComplete },
    });
  }, [tabId, closeChildrenOnComplete]);

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
        <img
          src={chrome.runtime.getURL('icons/icon128.png')}
          alt="TabGuru"
          className="w-10 h-10 object-contain drop-shadow-md pointer-events-none"
        />
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
      {showConfirmDialog && (
        <ConfirmCloseDialog
          childCount={activeChildren.length}
          onConfirm={handleConfirmClose}
          onCancel={handleCancelClose}
        />
      )}

      {/* Parent breadcrumb — only on child tabs */}
      {purpose?.openerTabId && (
        <button
          onClick={handleGoToParent}
          className="
            w-full flex items-center gap-1.5 mb-2.5 px-2 py-1 rounded-lg
            bg-white/5 hover:bg-white/10 border border-white/[0.06]
            text-slate-500 hover:text-slate-300 transition-colors text-left cursor-pointer
          "
        >
          <span className="text-[11px] leading-none">←</span>
          <span className="text-[9px] font-bold uppercase tracking-widest truncate">
            {parentPurposeText ?? 'Parent tab'}
          </span>
        </button>
      )}

      {/* Header row */}
      <div className="flex items-start gap-2">
        <img
          src={chrome.runtime.getURL('icons/icon128.png')}
          alt="TabGuru"
          className="w-5 h-5 mt-0.5 shrink-0 object-contain drop-shadow-sm pointer-events-none"
        />
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              ref={editInputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSavePurpose();
                if (e.key === 'Escape') handleCancelEdit();
                e.stopPropagation();
              }}
              onBlur={handleSavePurpose}
              className="
                w-full text-sm font-semibold text-slate-100 leading-snug
                bg-transparent border-b border-violet-500/60 outline-none
                pb-0.5 placeholder-slate-600
              "
              placeholder="Rename task…"
            />
          ) : (
            <p
              className="text-sm font-semibold text-slate-200 leading-snug truncate cursor-text hover:text-white group"
              title={`${purpose ? purpose.purpose : 'Browsing Context'} — click to rename`}
              onClick={() => {
                if (purpose) {
                  setEditValue(purpose.purpose);
                  setIsEditing(true);
                }
              }}
            >
              {purpose ? purpose.purpose : 'Browsing Context'}
              <span className="ml-1 opacity-0 group-hover:opacity-40 text-[9px] text-slate-400 transition-opacity">✎</span>
            </p>
          )}
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
              <span
                className={`text-sm font-mono font-bold tabular-nums ${
                  isExpired ? 'text-red-400' : isUrgent ? 'timer-urgent' : 'text-slate-300'
                }`}
              >
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
              </span>
              {isExpired && (
                <span className="text-[10px] text-red-400 font-semibold">Time's up!</span>
              )}
            </div>

            {/* Extend button */}
            <button
              onClick={() => handleExtend(5)}
              className="
                text-[10px] font-semibold px-2 py-0.5 rounded-md
                bg-white/5 border border-white/10 text-slate-500
                hover:border-violet-500/40 hover:text-slate-300 hover:bg-violet-500/10
                transition-all duration-150
              "
            >
              +5m
            </button>
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
          <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none px-1 mb-2">
              Pending sub tasks
            </p>
            {[...activeChildren]
              .sort((a, b) => b.startTime - a.startTime)
              .map((child) => (
                <div key={child.tabId} className="bg-white/5 rounded-xl p-2.5 space-y-2 border border-white/[0.03]">
                  <div className="flex items-center gap-2 min-w-0 pointer-events-none">
                    <span className="text-sm shrink-0">🌿</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-300 truncate leading-tight" title={child.purpose}>
                        "{child.purpose}"
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 justify-end">
                    <button
                      onClick={() => handleGoToTab(child.tabId)}
                      className="
                        text-[9px] font-bold px-2 py-1 rounded-md
                        bg-violet-600/20 hover:bg-violet-600/30 text-violet-400
                        border border-violet-500/20 transition-colors cursor-pointer
                        flex items-center gap-1
                      "
                    >
                      Go to Tab <span className="text-[10px]">→</span>
                    </button>
                    <button
                      onClick={() => handleMarkChildComplete(child.tabId)}
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
              ))}
          </div>
        </>
      )}
    </div>
  );
}
